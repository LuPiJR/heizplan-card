import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

// TypeScript interfaces
interface HomeAssistant {
  states: { [key: string]: any };
  services: { [domain: string]: { [service: string]: any } };
  callService: (domain: string, service: string, data?: any) => Promise<any>;
  config: any;
}

interface HeizplanCardConfig {
  entity: string;
  name?: string;
  min_temp?: number;
  max_temp?: number;
  temp_step?: number;
  schedule?: Schedule;
  schedule_entity?: string;
  room_temp_key?: string;
}

interface ScheduleEntry {
  start: string;
  stop: string;
  temperature: number;
}

interface Schedule {
  [day: string]: ScheduleEntry[];
}

interface EditingBlock {
  day: string;
  index: number;
  entry: ScheduleEntry;
}

@customElement('heizplan-card-v2')
export class HeizplanCardV2 extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ type: Object }) public config!: HeizplanCardConfig;

  @state() private _schedule: Schedule = {};
  @state() private _currentView: 'single' | 'week' = 'single';
  @state() private _currentDay: string = this._getCurrentDay();
  @state() private _editingBlock: EditingBlock | null = null;
  @state() private _errorMessage: string = '';

  static get styles(): CSSResultGroup {
    return css`
      .heizplan-card {
        background: var(--card-background-color, #1e1e1e);
        border-radius: var(--border-radius, 0.5rem);
        padding: 1rem;
        font-family: var(--primary-font-family, Arial, sans-serif);
        color: var(--primary-text-color, #fff);
        box-shadow: var(--card-box-shadow, 0 0.4rem 0.6rem rgba(0, 0, 0, 0.2));
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        font-size: 1.3rem;
        font-weight: bold;
      }

      .current-temp {
        font-size: 1rem;
        color: var(--secondary-text-color, #aaa);
      }

      /* View Controls */
      .view-controls {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }

      .view-button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--primary-color, #f39c12);
        background: transparent;
        color: var(--primary-color, #f39c12);
        border-radius: 0.25rem;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
      }

      .view-button:hover {
        background: var(--primary-color, #f39c12);
        color: white;
      }

      .view-button.active {
        background: var(--primary-color, #f39c12);
        color: white;
      }

      /* Single Day View */
      .schedule-container {
        width: 100%;
        margin: 1rem 0;
      }

      .day-header {
        font-size: 1.1rem;
        margin-bottom: 0.5rem;
        color: var(--primary-text-color, #fff);
      }

      .timeline {
        display: flex;
        position: relative;
        height: 2.5rem;
        background-color: var(--timeline-background, #2e2e2e);
        border-radius: 0.25rem;
        overflow: hidden;
        cursor: pointer;
      }

      /* Week View Styles */
      .week-schedule-container {
        width: 100%;
      }

      .week-markers {
        display: flex;
        justify-content: space-between;
        margin-top: 0.5rem;
        font-size: 0.75rem;
        color: var(--secondary-text-color, #aaa);
        padding: 0 0 0 2rem;
      }

      .week-days {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }

      .week-day {
        display: flex;
        align-items: center;
        min-height: 2rem;
      }

      .week-day-header {
        min-width: 2rem;
        font-size: 0.9rem;
        font-weight: bold;
        color: var(--primary-text-color, #fff);
        text-align: center;
        padding-right: 0.5rem;
      }

      .week-timeline {
        flex: 1;
        height: 1.8rem;
        position: relative;
        background-color: var(--timeline-background, #2e2e2e);
        border-radius: 0.25rem;
        overflow: hidden;
        cursor: pointer;
      }

      /* Time Blocks */
      .time-block {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        color: #fff;
        height: 100%;
        box-sizing: border-box;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        position: absolute;
        transition: all 0.2s ease;
      }

      .time-block:hover {
        opacity: 0.8;
        transform: scale(1.02);
        z-index: 10;
      }

      .time-block:last-child {
        border-right: none;
      }

      .week-timeline .time-block {
        font-size: 0.7rem;
      }

      .week-timeline .time-block:hover {
        transform: scaleY(1.1);
      }

      /* Temperature Colors */
      .temp-5 { background-color: var(--temp-cold-color, #175e7f); }
      .temp-17 { background-color: var(--temp-medium-color, #f39c12); }
      .temp-19 { background-color: var(--temp-warm-color, #e74c3c); }
      .temp-20 { background-color: var(--temp-warm-color, #e67e22); }
      .temp-21 { background-color: var(--temp-hot-color, #c0392b); }
      .temp-21-5 { background-color: var(--temp-very-hot-color, #a93226); }

      /* Time Markers */
      .time-markers {
        display: flex;
        justify-content: space-between;
        margin-top: 0.5rem;
        font-size: 0.75rem;
        color: var(--secondary-text-color, #aaa);
      }

      /* Controls */
      .controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .temp-control {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .temp-button {
        background: var(--primary-color, #f39c12);
        border: none;
        border-radius: 50%;
        width: 2rem;
        height: 2rem;
        color: white;
        cursor: pointer;
        font-size: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .temp-button:hover {
        opacity: 0.8;
      }

      .temp-display {
        font-size: 1.2rem;
        font-weight: bold;
        min-width: 3rem;
        text-align: center;
      }

      .mode-controls {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }

      .mode-display {
        font-size: 0.9rem;
        color: var(--secondary-text-color, #aaa);
        text-transform: capitalize;
        cursor: pointer;
        padding: 0.3rem 0.6rem;
        border: 1px solid var(--secondary-text-color, #aaa);
        border-radius: 0.25rem;
        transition: all 0.2s ease;
      }

      .mode-display:hover {
        background: var(--primary-color, #f39c12);
        color: white;
        border-color: var(--primary-color, #f39c12);
      }

      .toggle-switch {
        position: relative;
        width: 80px;
        height: 32px;
        border-radius: 16px;
        border: none;
        background: #666;
        cursor: pointer;
        transition: all 0.3s ease;
        overflow: hidden;
      }

      .toggle-switch.active {
        background: var(--primary-color, #f39c12);
      }

      .toggle-switch span {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.7rem;
        font-weight: bold;
        color: white;
        transition: opacity 0.3s ease;
      }

      .toggle-off {
        left: 8px;
        opacity: 1;
      }

      .toggle-on {
        right: 8px;
        opacity: 0;
      }

      .toggle-switch.active .toggle-off {
        opacity: 0;
      }

      .toggle-switch.active .toggle-on {
        opacity: 1;
      }

      /* Error Message */
      .error-message {
        color: var(--error-color, #ff6b6b);
        font-size: 0.9rem;
        margin-top: 0.5rem;
        text-align: center;
      }

      /* Edit Modal */
      .edit-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }

      .edit-modal-content {
        background: var(--card-background-color, #1e1e1e);
        padding: 2rem;
        border-radius: 0.5rem;
        min-width: 300px;
        text-align: center;
      }

      .edit-modal-content h3 {
        margin-top: 0;
      }

      .edit-controls {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin: 1rem 0;
      }

      .modal-buttons {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-top: 1.5rem;
      }

      .modal-button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.9rem;
      }

      .modal-button.primary {
        background: var(--primary-color, #f39c12);
        color: white;
      }

      .modal-button.secondary {
        background: var(--secondary-color, #666);
        color: white;
      }

      .hidden {
        display: none;
      }
    `;
  }

  private _getCurrentDay(): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }

  private _getDefaultSchedule(): Schedule {
    return {
      monday: [
        { start: '00:00', stop: '07:00', temperature: 5 },
        { start: '07:00', stop: '09:30', temperature: 21 },
        { start: '09:30', stop: '14:30', temperature: 21 },
        { start: '14:30', stop: '21:00', temperature: 21 },
        { start: '21:00', stop: '23:00', temperature: 21.5 },
        { start: '23:00', stop: '24:00', temperature: 5 }
      ],
      tuesday: [
        { start: '00:00', stop: '07:00', temperature: 5 },
        { start: '07:00', stop: '09:30', temperature: 21 },
        { start: '09:30', stop: '14:30', temperature: 21 },
        { start: '14:30', stop: '21:00', temperature: 21 },
        { start: '21:00', stop: '23:00', temperature: 21.5 },
        { start: '23:00', stop: '24:00', temperature: 5 }
      ],
      wednesday: [
        { start: '00:00', stop: '07:00', temperature: 5 },
        { start: '07:00', stop: '09:30', temperature: 21 },
        { start: '09:30', stop: '14:30', temperature: 21 },
        { start: '14:30', stop: '21:00', temperature: 21 },
        { start: '21:00', stop: '23:00', temperature: 21.5 },
        { start: '23:00', stop: '24:00', temperature: 5 }
      ],
      thursday: [
        { start: '00:00', stop: '07:00', temperature: 5 },
        { start: '07:00', stop: '09:30', temperature: 21 },
        { start: '09:30', stop: '14:30', temperature: 21 },
        { start: '14:30', stop: '21:00', temperature: 21 },
        { start: '21:00', stop: '23:00', temperature: 21.5 },
        { start: '23:00', stop: '24:00', temperature: 5 }
      ],
      friday: [
        { start: '00:00', stop: '07:00', temperature: 5 },
        { start: '07:00', stop: '09:30', temperature: 21 },
        { start: '09:30', stop: '14:30', temperature: 21 },
        { start: '14:30', stop: '21:00', temperature: 21 },
        { start: '21:00', stop: '23:00', temperature: 21 },
        { start: '23:00', stop: '24:00', temperature: 5 }
      ],
      saturday: [
        { start: '00:00', stop: '07:30', temperature: 5 },
        { start: '07:30', stop: '10:30', temperature: 21 },
        { start: '10:30', stop: '19:00', temperature: 21 },
        { start: '19:00', stop: '23:00', temperature: 21.5 },
        { start: '23:00', stop: '24:00', temperature: 5 }
      ],
      sunday: [
        { start: '00:00', stop: '07:30', temperature: 5 },
        { start: '07:30', stop: '10:30', temperature: 21 },
        { start: '10:30', stop: '19:00', temperature: 21 },
        { start: '19:00', stop: '23:00', temperature: 21.5 },
        { start: '23:00', stop: '24:00', temperature: 5 }
      ]
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this._currentDay = this._getCurrentDay();
    this._schedule = this._getDefaultSchedule();
  }

  setConfig(config: HeizplanCardConfig) {
    if (!config.entity) {
      throw new Error('Please define a thermostat entity');
    }

    this.config = {
      name: 'Heizplan',
      min_temp: 5,
      max_temp: 30,
      temp_step: 0.5,
      room_temp_key: 'T_kueche',
      ...config
    };

    // Use provided schedule or try to load from HA
    if (config.schedule) {
      this._schedule = this._createMutableSchedule(config.schedule);
    } else {
      this._schedule = this._getDefaultSchedule();
    }
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);

    // Auto-load schedule when hass becomes available
    if (changedProperties.has('hass') && this.hass) {
      this._loadScheduleFromHA();
    }
  }

  getCardSize(): number {
    return 4;
  }

  static getStubConfig() {
    return {
      entity: 'climate.thermostat',
      name: 'Heizplan'
    };
  }

  render(): TemplateResult {
    if (!this.hass || !this.config?.entity) {
      return html`<div class="heizplan-card">Loading...</div>`;
    }

    const entity = this.hass.states[this.config.entity];
    if (!entity) {
      return html`
        <div class="heizplan-card">
          <div class="error-message">Entity ${this.config.entity} not found</div>
        </div>
      `;
    }

    return html`
      <div class="heizplan-card">
        ${this._renderHeader(entity)}
        ${this._renderViewControls()}
        ${this._currentView === 'single'
          ? this._renderSingleDayView()
          : this._renderWeekView()}
        ${this._renderControls(entity)}
        ${this._renderErrorMessage()}
        ${this._renderEditModal()}
      </div>
    `;
  }

  private _renderHeader(entity: any): TemplateResult {
    return html`
      <div class="card-header">
        <div class="card-title">${this.config.name}</div>
        <div class="current-temp">${entity.attributes.current_temperature || '--'}°C</div>
      </div>
    `;
  }

  private _renderViewControls(): TemplateResult {
    return html`
      <div class="view-controls">
        <button
          class=${classMap({
            'view-button': true,
            'single-day': true,
            'active': this._currentView === 'single'
          })}
          @click=${() => this._switchView('single')}
        >
          Today
        </button>
        <button
          class=${classMap({
            'view-button': true,
            'week-view': true,
            'active': this._currentView === 'week'
          })}
          @click=${() => this._switchView('week')}
        >
          Week
        </button>
      </div>
    `;
  }

  private _renderSingleDayView(): TemplateResult {
    const daySchedule = this._schedule[this._currentDay] || [];

    return html`
      <div class="schedule-container">
        <div class="day-header">
          ${this._currentDay.charAt(0).toUpperCase() + this._currentDay.slice(1)}
        </div>
        <div class="timeline" @click=${this._handleTimelineClick}>
          ${daySchedule.map((entry, index) => this._renderTimeBlock(entry, index))}
        </div>
        <div class="time-markers">
          <span>0h</span>
          <span>6h</span>
          <span>12h</span>
          <span>18h</span>
          <span>24h</span>
        </div>
      </div>
    `;
  }

  private _renderWeekView(): TemplateResult {
    const days = [
      { key: 'monday', label: 'Mo' },
      { key: 'tuesday', label: 'Di' },
      { key: 'wednesday', label: 'Mi' },
      { key: 'thursday', label: 'Do' },
      { key: 'friday', label: 'Fr' },
      { key: 'saturday', label: 'Sa' },
      { key: 'sunday', label: 'So' }
    ];

    return html`
      <div class="week-schedule-container">
        <div class="week-days">
          ${days.map(day => this._renderWeekDay(day.key, day.label))}
        </div>
        <div class="time-markers week-markers">
          <span>0h</span>
          <span>6h</span>
          <span>12h</span>
          <span>18h</span>
          <span>24h</span>
        </div>
      </div>
    `;
  }

  private _renderWeekDay(day: string, label: string): TemplateResult {
    const daySchedule = this._schedule[day] || [];

    return html`
      <div class="week-day" data-day=${day}>
        <div class="week-day-header">${label}</div>
        <div class="week-timeline" @click=${this._handleWeekTimelineClick}>
          ${daySchedule.map((entry, index) => this._renderWeekTimeBlock(entry, index, day))}
        </div>
      </div>
    `;
  }

  private _renderTimeBlock(entry: ScheduleEntry, index: number): TemplateResult {
    const { widthPercentage, leftPercentage, durationMinutes } = this._calculateTimeBlockDimensions(entry);
    const tempClass = `temp-${entry.temperature.toString().replace('.', '-')}`;

    return html`
      <div
        class="time-block ${tempClass}"
        style=${styleMap({
          width: `${widthPercentage}%`,
          left: `${leftPercentage}%`,
          position: 'absolute'
        })}
        data-index=${index}
      >
        ${durationMinutes > 90 ? `${entry.temperature}°C` : ''}
      </div>
    `;
  }

  private _renderWeekTimeBlock(entry: ScheduleEntry, index: number, day: string): TemplateResult {
    const { widthPercentage, leftPercentage, durationMinutes } = this._calculateTimeBlockDimensions(entry);
    const tempClass = `temp-${entry.temperature.toString().replace('.', '-')}`;

    return html`
      <div
        class="time-block ${tempClass}"
        style=${styleMap({
          width: `${widthPercentage}%`,
          left: `${leftPercentage}%`,
          position: 'absolute'
        })}
        data-index=${index}
        data-day=${day}
      >
        ${durationMinutes > 120 ? `${entry.temperature}°` : ''}
      </div>
    `;
  }

  private _renderControls(entity: any): TemplateResult {
    const isHeatMode = entity.state === 'heat' || entity.state === 'auto';

    return html`
      <div class="controls">
        <div class="temp-control">
          <button class="temp-button decrease" @click=${this._decreaseTemperature}>−</button>
          <div class="temp-display">${entity.attributes.temperature || '--'}°C</div>
          <button class="temp-button increase" @click=${this._increaseTemperature}>+</button>
        </div>
        <div class="mode-controls">
          <div class="mode-display" @click=${this._cycleHvacMode}>
            ${entity.state || 'unknown'}
          </div>
          <button
            class=${classMap({
              'toggle-switch': true,
              'active': isHeatMode
            })}
            @click=${this._toggleHeatMode}
          >
            <span class="toggle-off">OFF</span>
            <span class="toggle-on">HEAT</span>
          </button>
        </div>
      </div>
    `;
  }

  private _renderErrorMessage(): TemplateResult {
    return this._errorMessage
      ? html`<div class="error-message">${this._errorMessage}</div>`
      : html``;
  }

  private _renderEditModal(): TemplateResult {
    if (!this._editingBlock) {
      return html``;
    }

    const { entry } = this._editingBlock;

    return html`
      <div class="edit-modal" @click=${this._handleModalBackdropClick}>
        <div class="edit-modal-content">
          <h3>Edit Temperature</h3>
          <p class="edit-time-range">${entry.start} - ${entry.stop}</p>
          <div class="edit-controls">
            <button class="temp-button decrease" @click=${this._decreaseEditTemp}>−</button>
            <div class="temp-display edit-temp">${entry.temperature}°C</div>
            <button class="temp-button increase" @click=${this._increaseEditTemp}>+</button>
          </div>
          <div class="modal-buttons">
            <button class="modal-button primary" @click=${this._saveEdit}>Save</button>
            <button class="modal-button secondary" @click=${this._cancelEdit}>Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  // Helper methods
  private _calculateTimeBlockDimensions(entry: ScheduleEntry) {
    const totalMinutes = 1440; // 24 hours
    const startMinutes = this._timeToMinutes(entry.start);
    const stopMinutes = this._timeToMinutes(entry.stop);
    const widthPercentage = ((stopMinutes - startMinutes) / totalMinutes) * 100;
    const leftPercentage = (startMinutes / totalMinutes) * 100;
    const durationMinutes = stopMinutes - startMinutes;

    return { widthPercentage, leftPercentage, durationMinutes };
  }

  private _timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private _createMutableSchedule(schedule: Schedule): Schedule {
    const mutableSchedule: Schedule = {};

    Object.keys(schedule).forEach(day => {
      if (Array.isArray(schedule[day])) {
        mutableSchedule[day] = schedule[day].map(entry => ({
          start: String(entry.start),
          stop: String(entry.stop),
          temperature: Number(entry.temperature)
        }));
      }
    });

    return mutableSchedule;
  }

  // Event handlers
  private _switchView(viewType: 'single' | 'week') {
    this._currentView = viewType;
  }

  private _handleTimelineClick(e: Event) {
    const timeBlock = (e.target as Element).closest('.time-block') as HTMLElement;
    if (!timeBlock) return;

    const index = parseInt(timeBlock.dataset.index || '0');
    const daySchedule = this._schedule[this._currentDay] || [];
    const entry = daySchedule[index];

    if (!entry) return;

    this._editingBlock = {
      day: this._currentDay,
      index,
      entry: {
        start: entry.start,
        stop: entry.stop,
        temperature: Number(entry.temperature)
      }
    };
  }

  private _handleWeekTimelineClick(e: Event) {
    const timeBlock = (e.target as Element).closest('.time-block') as HTMLElement;
    if (!timeBlock) return;

    const index = parseInt(timeBlock.dataset.index || '0');
    const day = timeBlock.dataset.day || '';
    const daySchedule = this._schedule[day] || [];
    const entry = daySchedule[index];

    if (!entry) return;

    this._editingBlock = {
      day: day,
      index,
      entry: {
        start: entry.start,
        stop: entry.stop,
        temperature: Number(entry.temperature)
      }
    };
  }

  private _handleModalBackdropClick(e: Event) {
    if (e.target === e.currentTarget) {
      this._cancelEdit();
    }
  }

  private _increaseTemperature() {
    this._adjustTemperature(this.config.temp_step || 0.5);
  }

  private _decreaseTemperature() {
    this._adjustTemperature(-(this.config.temp_step || 0.5));
  }

  private _increaseEditTemp() {
    if (this._editingBlock) {
      const newTemp = this._editingBlock.entry.temperature + (this.config.temp_step || 0.5);
      const clampedTemp = Math.max(this.config.min_temp || 5,
                         Math.min(this.config.max_temp || 30, newTemp));
      this._editingBlock.entry.temperature = clampedTemp;
      this.requestUpdate();
    }
  }

  private _decreaseEditTemp() {
    if (this._editingBlock) {
      const newTemp = this._editingBlock.entry.temperature - (this.config.temp_step || 0.5);
      const clampedTemp = Math.max(this.config.min_temp || 5,
                         Math.min(this.config.max_temp || 30, newTemp));
      this._editingBlock.entry.temperature = clampedTemp;
      this.requestUpdate();
    }
  }

  private _adjustTemperature(delta: number) {
    if (!this.hass || !this.config.entity) return;

    const entity = this.hass.states[this.config.entity];
    const currentTemp = entity.attributes.temperature || 20;
    const newTemp = currentTemp + delta;
    const clampedTemp = Math.max(this.config.min_temp || 5,
                       Math.min(this.config.max_temp || 30, newTemp));

    this._setThermostatTemperature(clampedTemp);
  }

  private _setThermostatTemperature(temperature: number) {
    if (!this.hass) return;

    this.hass.callService('climate', 'set_temperature', {
      entity_id: this.config.entity,
      temperature: temperature
    }).catch((error: any) => {
      this._errorMessage = `Failed to set temperature: ${error.message}`;
    });
  }

  private _cycleHvacMode() {
    if (!this.hass || !this.config.entity) return;

    const entity = this.hass.states[this.config.entity];
    const availableModes = entity.attributes.hvac_modes || ['off', 'heat', 'auto'];
    const currentMode = entity.state;

    let currentIndex = availableModes.indexOf(currentMode);
    if (currentIndex === -1) currentIndex = 0;

    const nextIndex = (currentIndex + 1) % availableModes.length;
    const nextMode = availableModes[nextIndex];

    this.hass.callService('climate', 'set_hvac_mode', {
      entity_id: this.config.entity,
      hvac_mode: nextMode
    }).catch((error: any) => {
      this._errorMessage = `Failed to set HVAC mode: ${error.message}`;
    });
  }

  private _toggleHeatMode() {
    if (!this.hass || !this.config.entity) return;

    const entity = this.hass.states[this.config.entity];
    const currentMode = entity.state;
    const newMode = (currentMode === 'off') ? 'heat' : 'off';

    this.hass.callService('climate', 'set_hvac_mode', {
      entity_id: this.config.entity,
      hvac_mode: newMode
    }).catch((error: any) => {
      this._errorMessage = `Failed to toggle HVAC mode: ${error.message}`;
    });
  }

  private _saveEdit() {
    if (!this._editingBlock) return;

    const { day, index, entry } = this._editingBlock;

    // Create a deep copy to avoid mutation issues
    if (!this._schedule[day]) {
      this._schedule[day] = [];
    }

    this._schedule[day][index] = {
      start: entry.start,
      stop: entry.stop,
      temperature: entry.temperature
    };

    // Trigger re-render
    this.requestUpdate();

    // Close modal
    this._cancelEdit();

    // Optionally trigger immediate temperature change
    if (this._isCurrentTimeBlock(entry)) {
      this._setThermostatTemperature(entry.temperature);
    }
  }

  private _cancelEdit() {
    this._editingBlock = null;
  }

  private _isCurrentTimeBlock(entry: ScheduleEntry): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = this._timeToMinutes(entry.start);
    const stopMinutes = this._timeToMinutes(entry.stop);

    return currentMinutes >= startMinutes && currentMinutes < stopMinutes;
  }

  private _loadScheduleFromHA() {
    if (!this.hass || !this.config.schedule_entity) return;

    // Try to load schedule from HA entity (simplified version)
    const scheduleEntity = this.hass.states[this.config.schedule_entity];
    if (scheduleEntity && scheduleEntity.attributes) {
      try {
        const convertedSchedule = this._convertHAScheduleFormat(
          scheduleEntity.attributes,
          this.config.room_temp_key || 'T_kueche'
        );
        if (Object.keys(convertedSchedule).length > 0) {
          this._schedule = convertedSchedule;
        }
      } catch (error) {
        console.warn('Failed to load schedule from HA:', error);
      }
    }
  }

  private _convertHAScheduleFormat(haSchedule: any, roomKey: string = 'T_kueche'): Schedule {
    const convertedSchedule: Schedule = {};

    Object.keys(haSchedule).forEach(day => {
      if (Array.isArray(haSchedule[day])) {
        convertedSchedule[day] = haSchedule[day].map((period: any) => ({
          start: period.from.substring(0, 5), // Convert "07:00:00" to "07:00"
          stop: period.to.substring(0, 5),
          temperature: period.data[roomKey] || 21 // Extract temp for specific room
        }));
      }
    });

    return convertedSchedule;
  }
}

// Register with Home Assistant
declare global {
  interface HTMLElementTagNameMap {
    'heizplan-card-v2': HeizplanCardV2;
  }
}

// Register with Home Assistant card registry
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'heizplan-card-v2',
  name: 'Heizplan Card V2',
  description: 'Interactive thermostat schedule card (LitElement version)'
});

console.info(
  '%c  HEIZPLAN-CARD-V2  %c  Version 2.0.0  ',
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);