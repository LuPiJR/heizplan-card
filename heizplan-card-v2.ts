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
  locale?: { language: string };
}

interface HeizplanCardConfig {
  entity: string;
  name?: string;
  min_temp?: number;
  max_temp?: number;
  temp_step?: number;
  schedule?: LegacySchedule;
  schedule_entity?: string;
  room_temp_key?: string;
  persistence?: PersistenceConfig;
  debug?: boolean;
}

interface ScheduleEntry {
  start: string;
  stop: string;
  temperatures: Record<string, number>;
}

type Schedule = Record<string, ScheduleEntry[]>;

interface LegacyScheduleEntry {
  start: string;
  stop: string;
  temperature: number;
}

type LegacySchedule = Record<string, LegacyScheduleEntry[]>;

interface EditingBlock {
  day: string;
  index: number;
  start: string;
  stop: string;
  temperature: number;
}

interface PersistenceConfig {
  domain: string;
  service: string;
  include_entity?: boolean;
  schedule_key?: string;
  data?: Record<string, unknown>;
}

const DAY_LABELS: Record<string, { long: string; short: string }> = {
  monday: { long: 'Montag', short: 'Mo' },
  tuesday: { long: 'Dienstag', short: 'Di' },
  wednesday: { long: 'Mittwoch', short: 'Mi' },
  thursday: { long: 'Donnerstag', short: 'Do' },
  friday: { long: 'Freitag', short: 'Fr' },
  saturday: { long: 'Samstag', short: 'Sa' },
  sunday: { long: 'Sonntag', short: 'So' }
};

@customElement('heizplan-card-v2')
export class HeizplanCardV2 extends LitElement {
  private _hass?: HomeAssistant;
  private _config!: HeizplanCardConfig;

  @property({ attribute: false })
  public get hass(): HomeAssistant {
    return this._hass as HomeAssistant;
  }

  public set hass(value: HomeAssistant) {
    const oldValue = this._hass;
    this._hass = value;
    this.requestUpdate('hass', oldValue);
    if (value && this._config?.schedule_entity) {
      this._maybeLoadScheduleFromHA(value);
    } else if (value && this._config?.persistence?.domain === 'input_number') {
      this._maybeLoadScheduleFromInputHelpers(value);
    }
  }

  @property({ type: Object })
  public get config(): HeizplanCardConfig {
    return this._config;
  }

  public set config(value: HeizplanCardConfig) {
    const oldValue = this._config;
    this._config = value;
    this.requestUpdate('config', oldValue);
  }

  @state() private _schedule: Schedule = {};
  @state() private _currentView: 'single' | 'week' = 'single';
  @state() private _currentDay: string = this._getCurrentDay();
  @state() private _editingBlock: EditingBlock | null = null;
  @state() private _errorMessage = '';
  @state() private _selectedRoom: string | null = null;
  @state() private _availableRooms: string[] = [];
  @state() private _isPersisting = false;

  private _lastKnownSchedule: Schedule | null = null;
  private _lastScheduleFingerprint: string | null = null;

  static get styles(): CSSResultGroup {
    return css`
      .heizplan-card {
        background: var(--card-background-color, #1e1e1e);
        border-radius: var(--border-radius, 0.5rem);
        padding: 0.75rem;
        font-family: var(--primary-font-family, Arial, sans-serif);
        color: var(--primary-text-color, #fff);
        box-shadow: var(--card-box-shadow, 0 0.4rem 0.6rem rgba(0, 0, 0, 0.2));
      }

      .card-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.6rem;
        row-gap: 0.4rem;
        margin-bottom: 0.75rem;
      }

      .header-section {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .header-info {
        flex: 1 1 9rem;
        min-width: 8rem;
      }

      .title-stack {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .card-title {
        font-size: 1.1rem;
        font-weight: 600;
      }

      .current-temp {
        font-size: 0.9rem;
        color: var(--secondary-text-color, #aaa);
      }

      .room-selector {
        font-size: 0.75rem;
        color: var(--secondary-text-color, #aaa);
      }

      .room-selector.header-section {
        justify-content: flex-end;
        min-width: 8rem;
      }

      .room-selector label {
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .room-selector span {
        font-size: 0.95rem;
        color: var(--primary-text-color, #fff);
      }

      .room-selector select {
        background: var(--ha-card-background, rgba(255, 255, 255, 0.08));
        color: var(--primary-text-color, #fff);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 0.25rem;
        padding: 0.2rem 0.5rem;
        min-width: 7rem;
      }

      .room-selector select:focus-visible {
        outline: 2px solid var(--primary-color, #f39c12);
        outline-offset: 1px;
      }

      /* View Controls */
      .view-controls {
        display: flex;
        justify-content: center;
        gap: 0.4rem;
        margin-bottom: 0.75rem;
      }

      .view-button {
        padding: 0.35rem 0.75rem;
        border: 1px solid var(--primary-color, #f39c12);
        background: transparent;
        color: var(--primary-color, #f39c12);
        border-radius: 0.25rem;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.85rem;
      }

      .view-button:hover {
        background: var(--primary-color, #f39c12);
        color: white;
      }

      .view-button:focus-visible {
        outline: 2px solid var(--primary-color, #f39c12);
        outline-offset: 2px;
      }

      .view-button.active {
        background: var(--primary-color, #f39c12);
        color: white;
      }

      /* Single Day View */
      .schedule-container {
        width: 100%;
        margin: 0.75rem 0 0.5rem;
      }

      .day-header {
        font-size: 1rem;
        margin-bottom: 0.35rem;
        color: var(--primary-text-color, #fff);
      }

      .timeline {
        display: flex;
        position: relative;
        height: 1.8rem;
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
        margin-top: 0.4rem;
        font-size: 0.72rem;
        color: var(--secondary-text-color, #aaa);
        padding: 0 0 0 1.6rem;
      }

      .week-days {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .week-day {
        display: flex;
        align-items: center;
        min-height: 1.75rem;
      }

      .week-day-header {
        min-width: 2rem;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--primary-text-color, #fff);
        text-align: center;
        padding-right: 0.4rem;
      }

      .week-timeline {
        flex: 1;
        height: 1.4rem;
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
        font-size: 0.85rem;
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
        font-size: 0.65rem;
      }

      .week-timeline .time-block:hover {
        transform: scaleY(1.1);
      }

      /* Time Markers */
      .time-markers {
        display: flex;
        justify-content: space-between;
        margin-top: 0.35rem;
        font-size: 0.7rem;
        color: var(--secondary-text-color, #aaa);
      }

      /* Controls */
      .header-controls {
        flex: 1 1 12rem;
        justify-content: flex-end;
        gap: 0.6rem;
        margin-left: auto;
      }

      .temp-control {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }

      .temp-button {
        background: var(--primary-color, #f39c12);
        border: none;
        border-radius: 50%;
        width: 1.6rem;
        height: 1.6rem;
        color: white;
        cursor: pointer;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .temp-button:hover {
        opacity: 0.8;
      }

      .temp-display {
        font-size: 1.05rem;
        font-weight: 600;
        min-width: 2.5rem;
        text-align: center;
      }

      .mode-controls {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-wrap: wrap;
      }

      .mode-display {
        font-size: 0.8rem;
        color: var(--secondary-text-color, #aaa);
        text-transform: capitalize;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
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
        width: 64px;
        height: 26px;
        border-radius: 13px;
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
        font-size: 0.65rem;
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

      .status-message {
        color: var(--secondary-text-color, #aaa);
        font-size: 0.85rem;
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

  public setConfig(config: HeizplanCardConfig): void {
    if (!config?.entity) {
      throw new Error('You must define a climate entity in the card configuration.');
    }

    const normalizedPersistence = config.persistence
      ? {
          domain: config.persistence.domain,
          service: config.persistence.service,
          include_entity: config.persistence.include_entity ?? true,
          schedule_key: config.persistence.schedule_key ?? 'schedule',
          data: config.persistence.data ?? {}
        }
      : undefined;

    if (normalizedPersistence && (!normalizedPersistence.domain || !normalizedPersistence.service)) {
      throw new Error('Persistence configuration must specify both a domain and a service.');
    }

    if (normalizedPersistence) {
      this._validatePersistenceConfig(normalizedPersistence);
    }

    const normalizedConfig: HeizplanCardConfig = {
      ...config,
      name: config.name ?? 'Heizplan',
      min_temp: config.min_temp ?? 5,
      max_temp: config.max_temp ?? 30,
      temp_step: config.temp_step ?? 0.5,
      persistence: normalizedPersistence
    };

    this.config = normalizedConfig;
    this._currentDay = this._getCurrentDay();
    this._errorMessage = '';

    const initialSchedule = config.schedule
      ? this._fromLegacySchedule(config.schedule, config.room_temp_key)
      : this._getDefaultSchedule(config.room_temp_key);

    if (Object.keys(initialSchedule).length > 0) {
      this._applySchedule(initialSchedule);
    }

    if (!this._selectedRoom && this._availableRooms.length > 0) {
      this._selectedRoom = this._availableRooms[0] ?? null;
    }

    if (this._hass && config.schedule_entity) {
      this._maybeLoadScheduleFromHA(this._hass);
    } else if (this._hass && normalizedConfig.persistence?.domain === 'input_number') {
      this._maybeLoadScheduleFromInputHelpers(this._hass);
    }
  }

  private _validatePersistenceConfig(persistence: PersistenceConfig): void {
    const { domain, service } = persistence;
    const serviceKey = `${domain}.${service}`;

    // Allow input_number.set_value since we handle it specially with individual temperature values
    if (domain === 'input_number' && service === 'set_value') {
      this._debug(`Using input_number.set_value - will save individual temperature values instead of full schedule`);
      return;
    }

    if (this._isNumericPersistenceTarget(domain, service)) {
      throw new Error(
        `Persistence target ${serviceKey} only supports numeric payloads. Please choose a text/JSON capable helper such as input_text.set_value or variable.set_variable, or use input_number.set_value for individual temperature persistence.`,
      );
    }
  }

  private _isNumericPersistenceTarget(domain: string, service: string): boolean {
    const normalizedDomain = domain?.toLowerCase();
    const normalizedService = service?.toLowerCase();
    if (!normalizedDomain || !normalizedService) {
      return false;
    }

    const serviceKey = `${normalizedDomain}.${normalizedService}`;
    const numericHelpers = new Set([
      'input_number.set_value',
      'input_number.increment',
      'input_number.decrement',
      'number.set_value',
      'number.increment',
      'number.decrement'
    ]);

    return numericHelpers.has(serviceKey) || ['input_number', 'number'].includes(normalizedDomain);
  }

  private _getCurrentDay(): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }

  private _getDefaultSchedule(roomKey?: string): Schedule {
    const key = roomKey ?? 'default_room';
    const makeEntry = (start: string, stop: string, temperature: number): ScheduleEntry => ({
      start,
      stop,
      temperatures: { [key]: temperature }
    });

    return {
      monday: [
        makeEntry('00:00', '07:00', 5),
        makeEntry('07:00', '09:30', 21),
        makeEntry('09:30', '14:30', 21),
        makeEntry('14:30', '21:00', 21),
        makeEntry('21:00', '23:00', 21.5),
        makeEntry('23:00', '24:00', 5)
      ],
      tuesday: [
        makeEntry('00:00', '07:00', 5),
        makeEntry('07:00', '09:30', 21),
        makeEntry('09:30', '14:30', 21),
        makeEntry('14:30', '21:00', 21),
        makeEntry('21:00', '23:00', 21.5),
        makeEntry('23:00', '24:00', 5)
      ],
      wednesday: [
        makeEntry('00:00', '07:00', 5),
        makeEntry('07:00', '09:30', 21),
        makeEntry('09:30', '14:30', 21),
        makeEntry('14:30', '21:00', 21),
        makeEntry('21:00', '23:00', 21.5),
        makeEntry('23:00', '24:00', 5)
      ],
      thursday: [
        makeEntry('00:00', '07:00', 5),
        makeEntry('07:00', '09:30', 21),
        makeEntry('09:30', '14:30', 21),
        makeEntry('14:30', '21:00', 21),
        makeEntry('21:00', '23:00', 21.5),
        makeEntry('23:00', '24:00', 5)
      ],
      friday: [
        makeEntry('00:00', '07:00', 5),
        makeEntry('07:00', '09:30', 21),
        makeEntry('09:30', '14:30', 21),
        makeEntry('14:30', '21:00', 21),
        makeEntry('21:00', '23:00', 21),
        makeEntry('23:00', '24:00', 5)
      ],
      saturday: [
        makeEntry('00:00', '07:30', 5),
        makeEntry('07:30', '10:30', 21),
        makeEntry('10:30', '19:00', 21),
        makeEntry('19:00', '23:00', 21.5),
        makeEntry('23:00', '24:00', 5)
      ],
      sunday: [
        makeEntry('00:00', '07:30', 5),
        makeEntry('07:30', '10:30', 21),
        makeEntry('10:30', '19:00', 21),
        makeEntry('19:00', '23:00', 21.5),
        makeEntry('23:00', '24:00', 5)
      ]
    };
  }

  private _applySchedule(schedule: Schedule): void {
    const mutable = this._createMutableSchedule(schedule);
    this._schedule = mutable;
    this._lastKnownSchedule = this._createMutableSchedule(schedule);
    this._updateAvailableRoomsFromSchedule(mutable);
  }

  private _fromLegacySchedule(schedule: LegacySchedule, roomKey?: string): Schedule {
    const key = roomKey ?? this._config?.room_temp_key ?? 'default_room';
    const converted: Schedule = {};

    Object.entries(schedule).forEach(([day, entries]) => {
      if (!Array.isArray(entries)) {
        return;
      }

      converted[day.toLowerCase()] = entries.map(entry => ({
        start: String(entry.start),
        stop: String(entry.stop),
        temperatures: { [key]: Number(entry.temperature) }
      }));
    });

    return converted;
  }

  private _updateAvailableRoomsFromSchedule(schedule: Schedule): void {
    const rooms = new Set<string>();

    Object.values(schedule).forEach(entries => {
      entries?.forEach(entry => {
        Object.keys(entry.temperatures || {}).forEach(room => {
          if (room) {
            rooms.add(room);
          }
        });
      });
    });

    const sortedRooms = Array.from(rooms).sort();
    this._availableRooms = sortedRooms;

    if (sortedRooms.length === 0) {
      this._selectedRoom = null;
      return;
    }

    const preferred = this._config?.room_temp_key;
    if (preferred && sortedRooms.includes(preferred)) {
      this._selectedRoom = preferred;
      return;
    }

    if (!this._selectedRoom || !sortedRooms.includes(this._selectedRoom)) {
      this._selectedRoom = sortedRooms[0];
    }
  }

  private _formatDayLabel(day: string, short = false): string {
    const key = day.toLowerCase();
    const labels = DAY_LABELS[key];

    if (labels) {
      return short ? labels.short : labels.long;
    }

    const normalized = day.charAt(0).toUpperCase() + day.slice(1);
    return short ? normalized.slice(0, 2) : normalized;
  }

  private _formatRoomName(room: string): string {
    return room
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  private _getTemperature(entry: ScheduleEntry, room: string | null = this._selectedRoom): number | null {
    if (!room) {
      return null;
    }

    const value = entry.temperatures?.[room];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }

    return null;
  }

  private _formatTemperature(value: number): string {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  }

  private _temperatureToColor(temp: number): string {
    const min = this._config?.min_temp ?? 5;
    const max = this._config?.max_temp ?? 30;
    const safeSpan = Math.max(1, max - min);
    const ratio = Math.min(1, Math.max(0, (temp - min) / safeSpan));

    const cold = [23, 126, 199];
    const hot = [234, 83, 48];

    const r = Math.round(cold[0] + (hot[0] - cold[0]) * ratio);
    const g = Math.round(cold[1] + (hot[1] - cold[1]) * ratio);
    const b = Math.round(cold[2] + (hot[2] - cold[2]) * ratio);

    return `rgb(${r}, ${g}, ${b})`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._currentDay = this._getCurrentDay();
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
    if (!this._config?.entity) {
      return html`<div class="heizplan-card">Card is not configured.</div>`;
    }

    if (!this._hass) {
      return html`<div class="heizplan-card">Loading…</div>`;
    }

    const entity = this._hass.states[this._config.entity];
    if (!entity) {
      return html`
        <div class="heizplan-card">
          <div class="error-message">Entity ${this._config.entity} not found</div>
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
        ${this._renderErrorMessage()}
        ${this._renderEditModal()}
      </div>
    `;
  }

  private _renderHeader(entity: any): TemplateResult {
    const title = this._config.name || entity.attributes.friendly_name || 'Heizplan';

    return html`
      <div class="card-header">
        <div class="header-section header-info">
          <div class="title-stack">
            <div class="card-title">${title}</div>
            <div class="current-temp">${entity.attributes.current_temperature ?? '--'}°C</div>
          </div>
        </div>
        ${this._renderRoomSelector()}
        ${this._renderControls(entity)}
      </div>
    `;
  }

  private _renderRoomSelector(): TemplateResult {
    if (this._availableRooms.length === 0) {
      return html``;
    }

    if (this._availableRooms.length === 1) {
      return html`
        <div class="room-selector header-section" role="presentation">
          <label>Room</label>
          <span>${this._formatRoomName(this._availableRooms[0])}</span>
        </div>
      `;
    }

    const selectId = `room-select-${this._config.entity.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

    return html`
      <div class="room-selector header-section">
        <label for=${selectId}>Room</label>
        <select id=${selectId} @change=${this._handleRoomChange}>
          ${this._availableRooms.map(
            room => html`<option value=${room} ?selected=${room === this._selectedRoom}>${this._formatRoomName(room)}</option>`
          )}
        </select>
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
    const dayLabel = this._formatDayLabel(this._currentDay);

    if (!this._selectedRoom) {
      return html`
        <div class="schedule-container">
          <div class="day-header">${dayLabel}</div>
          <div class="status-message">No rooms available in the schedule.</div>
        </div>
      `;
    }

    return html`
      <div class="schedule-container">
        <div class="day-header">${dayLabel}</div>
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
      { key: 'monday', label: this._formatDayLabel('monday', true) },
      { key: 'tuesday', label: this._formatDayLabel('tuesday', true) },
      { key: 'wednesday', label: this._formatDayLabel('wednesday', true) },
      { key: 'thursday', label: this._formatDayLabel('thursday', true) },
      { key: 'friday', label: this._formatDayLabel('friday', true) },
      { key: 'saturday', label: this._formatDayLabel('saturday', true) },
      { key: 'sunday', label: this._formatDayLabel('sunday', true) }
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
    const temp = this._getTemperature(entry);
    const displayTemp = temp !== null ? `${this._formatTemperature(temp)}°C` : '';
    const backgroundColor = temp !== null
      ? this._temperatureToColor(temp)
      : 'var(--timeline-background, #2e2e2e)';

    return html`
      <div
        class="time-block"
        style=${styleMap({
          width: `${widthPercentage}%`,
          left: `${leftPercentage}%`,
          position: 'absolute',
          background: backgroundColor
        })}
        data-index=${index}
        aria-label=${`Setpoint ${displayTemp || 'not set'} from ${entry.start} to ${entry.stop}`}
      >
        ${durationMinutes > 90 ? displayTemp : ''}
      </div>
    `;
  }

  private _renderWeekTimeBlock(entry: ScheduleEntry, index: number, day: string): TemplateResult {
    const { widthPercentage, leftPercentage, durationMinutes } = this._calculateTimeBlockDimensions(entry);
    const temp = this._getTemperature(entry);
    const displayTemp = temp !== null ? `${this._formatTemperature(temp)}°` : '';
    const backgroundColor = temp !== null
      ? this._temperatureToColor(temp)
      : 'var(--timeline-background, #2e2e2e)';

    return html`
      <div
        class="time-block"
        style=${styleMap({
          width: `${widthPercentage}%`,
          left: `${leftPercentage}%`,
          position: 'absolute',
          background: backgroundColor
        })}
        data-index=${index}
        data-day=${day}
        aria-label=${`Setpoint ${displayTemp || 'not set'} on ${day} from ${entry.start} to ${entry.stop}`}
      >
        ${durationMinutes > 120 ? displayTemp : ''}
      </div>
    `;
  }

  private _renderControls(entity: any): TemplateResult {
    const isHeatMode = entity.state === 'heat' || entity.state === 'auto';

    return html`
      <div class="header-section header-controls">
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
    const messages: TemplateResult[] = [];

    if (this._isPersisting) {
      messages.push(html`<div class="status-message" role="status">Saving schedule…</div>`);
    }

    if (this._errorMessage) {
      messages.push(html`<div class="error-message" role="alert">${this._errorMessage}</div>`);
    }

    return html`${messages}`;
  }

  private _renderEditModal(): TemplateResult {
    if (!this._editingBlock) {
      return html``;
    }

    const { start, stop, temperature } = this._editingBlock;
    const roomLabel = this._selectedRoom ? this._formatRoomName(this._selectedRoom) : '';

    return html`
      <div class="edit-modal" @click=${this._handleModalBackdropClick}>
        <div class="edit-modal-content">
          <h3>Edit ${roomLabel ? `${roomLabel} ` : ''}Temperature</h3>
          <p class="edit-time-range">${start} - ${stop}</p>
          <div class="edit-controls">
            <button class="temp-button decrease" @click=${this._decreaseEditTemp}>−</button>
            <div class="temp-display edit-temp">${this._formatTemperature(temperature)}°C</div>
            <button class="temp-button increase" @click=${this._increaseEditTemp}>+</button>
          </div>
          <div class="modal-buttons">
            <button class="modal-button primary" @click=${this._saveEdit} ?disabled=${this._isPersisting}>
              ${this._isPersisting ? 'Saving…' : 'Save'}
            </button>
            <button class="modal-button secondary" @click=${this._cancelEdit} ?disabled=${this._isPersisting}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Helper methods
  private _calculateTimeBlockDimensions(entry: ScheduleEntry) {
    const totalMinutes = 1440; // 24 hours
    const startMinutes = Math.max(0, Math.min(totalMinutes, this._timeToMinutes(entry.start)));
    const stopMinutes = Math.max(startMinutes, Math.min(totalMinutes, this._timeToMinutes(entry.stop)));
    const durationMinutes = Math.max(0, stopMinutes - startMinutes);
    const widthPercentage = (durationMinutes / totalMinutes) * 100;
    const leftPercentage = (startMinutes / totalMinutes) * 100;

    return { widthPercentage, leftPercentage, durationMinutes };
  }

  private _timeToMinutes(timeStr: string): number {
    if (!timeStr) {
      return 0;
    }

    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = Number(hoursStr);
    let minutes = Number(minutesStr ?? '0');

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return 0;
    }

    if (hours >= 24) {
      return 1440;
    }

    minutes = Math.max(0, Math.min(59, minutes));
    hours = Math.max(0, Math.min(23, hours));

    return hours * 60 + minutes;
  }

  private _createMutableSchedule(schedule: Schedule): Schedule {
    const mutableSchedule: Schedule = {};

    Object.keys(schedule).forEach(day => {
      if (Array.isArray(schedule[day])) {
        mutableSchedule[day] = schedule[day].map(entry => ({
          start: String(entry.start),
          stop: String(entry.stop),
          temperatures: { ...entry.temperatures }
        }));
      }
    });

    return mutableSchedule;
  }

  // Event handlers
  private _switchView(viewType: 'single' | 'week') {
    this._currentView = viewType;
  }

  private _handleRoomChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const newRoom = select?.value;
    if (!newRoom || newRoom === this._selectedRoom) {
      return;
    }

    this._selectedRoom = newRoom;

    if (this._editingBlock) {
      const daySchedule = this._schedule[this._editingBlock.day] || [];
      const entry = daySchedule[this._editingBlock.index];
      const temperature = entry ? this._getTemperature(entry, newRoom) : null;

      if (temperature === null) {
        this._editingBlock = null;
        this._errorMessage = `No setpoint defined for ${this._formatRoomName(newRoom)}.`;
        return;
      }

      this._editingBlock = {
        ...this._editingBlock,
        start: entry.start,
        stop: entry.stop,
        temperature
      };
    }
  }

  private _handleTimelineClick(e: Event) {
    const timeBlock = (e.target as Element).closest('.time-block') as HTMLElement;
    if (!timeBlock) return;

    const index = parseInt(timeBlock.dataset.index || '0', 10);
    this._openEditingBlock(this._currentDay, index);
  }

  private _handleWeekTimelineClick(e: Event) {
    const timeBlock = (e.target as Element).closest('.time-block') as HTMLElement;
    if (!timeBlock) return;

    const index = parseInt(timeBlock.dataset.index || '0', 10);
    const day = timeBlock.dataset.day || '';
    this._openEditingBlock(day, index);
  }

  private _handleModalBackdropClick(e: Event) {
    if (e.target === e.currentTarget) {
      this._cancelEdit();
    }
  }

  private _openEditingBlock(day: string, index: number) {
    if (!this._selectedRoom) {
      this._errorMessage = 'Select a room to edit its schedule.';
      return;
    }

    const daySchedule = this._schedule[day] || [];
    const entry = daySchedule[index];

    if (!entry) {
      return;
    }

    const temperature = this._getTemperature(entry, this._selectedRoom);

    if (temperature === null) {
      this._errorMessage = `No setpoint defined for ${this._formatRoomName(this._selectedRoom)} on ${this._formatDayLabel(day)}.`;
      return;
    }

    this._editingBlock = {
      day,
      index,
      start: entry.start,
      stop: entry.stop,
      temperature
    };
    this._errorMessage = '';
  }

  private _increaseTemperature() {
    this._adjustTemperature(this._config.temp_step || 0.5);
  }

  private _decreaseTemperature() {
    this._adjustTemperature(-(this._config.temp_step || 0.5));
  }

  private _increaseEditTemp() {
    if (!this._editingBlock) {
      return;
    }

    const step = this._config.temp_step ?? 0.5;
    const max = this._config.max_temp ?? 30;
    const min = this._config.min_temp ?? 5;
    const newTemp = Math.min(max, this._editingBlock.temperature + step);
    const clampedTemp = Math.max(min, newTemp);

    this._editingBlock = {
      ...this._editingBlock,
      temperature: Number(clampedTemp.toFixed(2))
    };
  }

  private _decreaseEditTemp() {
    if (!this._editingBlock) {
      return;
    }

    const step = this._config.temp_step ?? 0.5;
    const max = this._config.max_temp ?? 30;
    const min = this._config.min_temp ?? 5;
    const newTemp = Math.max(min, this._editingBlock.temperature - step);
    const clampedTemp = Math.min(max, newTemp);

    this._editingBlock = {
      ...this._editingBlock,
      temperature: Number(clampedTemp.toFixed(2))
    };
  }

  private async _adjustTemperature(delta: number) {
    if (!this._hass || !this._config.entity) return;

    const entity = this._hass.states[this._config.entity];
    const currentTemp = entity?.attributes?.temperature ?? 20;
    const min = this._config.min_temp ?? 5;
    const max = this._config.max_temp ?? 30;
    const newTemp = currentTemp + delta;
    const clampedTemp = Math.max(min, Math.min(max, newTemp));

    this._setThermostatTemperature(clampedTemp);

    try {
      const scheduleUpdated = await this._updateCurrentScheduleEntry(clampedTemp);
      if (scheduleUpdated) {
        this._debug(`Successfully updated both thermostat and schedule to ${clampedTemp}°C`);
      } else {
        this._debug(`Thermostat updated to ${clampedTemp}°C, but schedule was not updated (no current time block or persistence not configured)`);
      }
    } catch (error) {
      this._debug('Error updating schedule entry:', error);
    }
  }

  private _setThermostatTemperature(temperature: number) {
    if (!this._hass) return;

    this._hass.callService('climate', 'set_temperature', {
      entity_id: this._config.entity,
      temperature: temperature
    }).catch((error: any) => {
      this._errorMessage = `Failed to set temperature: ${error.message}`;
    });
  }

  private _cycleHvacMode() {
    if (!this._hass || !this._config.entity) return;

    const entity = this._hass.states[this._config.entity];
    const availableModes = entity.attributes.hvac_modes || ['off', 'heat', 'auto'];
    const currentMode = entity.state;

    let currentIndex = availableModes.indexOf(currentMode);
    if (currentIndex === -1) currentIndex = 0;

    const nextIndex = (currentIndex + 1) % availableModes.length;
    const nextMode = availableModes[nextIndex];

    this._hass.callService('climate', 'set_hvac_mode', {
      entity_id: this._config.entity,
      hvac_mode: nextMode
    }).catch((error: any) => {
      this._errorMessage = `Failed to set HVAC mode: ${error.message}`;
    });
  }

  private _toggleHeatMode() {
    if (!this._hass || !this._config.entity) return;

    const entity = this._hass.states[this._config.entity];
    const currentMode = entity.state;
    const newMode = (currentMode === 'off') ? 'heat' : 'off';

    this._hass.callService('climate', 'set_hvac_mode', {
      entity_id: this._config.entity,
      hvac_mode: newMode
    }).catch((error: any) => {
      this._errorMessage = `Failed to toggle HVAC mode: ${error.message}`;
    });
  }

  private async _saveEdit() {
    if (!this._editingBlock || !this._selectedRoom) {
      return;
    }

    const { day, index, start, stop, temperature } = this._editingBlock;
    const daySchedule = this._schedule[day] || [];
    const existingEntry = daySchedule[index];

    if (!existingEntry) {
      return;
    }

    const updatedEntry: ScheduleEntry = {
      start,
      stop,
      temperatures: {
        ...existingEntry.temperatures,
        [this._selectedRoom]: temperature
      }
    };

    const updatedDay = [...daySchedule];
    updatedDay[index] = updatedEntry;

    this._schedule = {
      ...this._schedule,
      [day]: updatedDay
    };

    this._lastKnownSchedule = this._createMutableSchedule(this._schedule);

    const shouldUpdateThermostat = this._isCurrentTimeBlock(updatedEntry);

    // Use the appropriate persistence method based on configuration
    let saved;
    if (this._config?.persistence?.domain === 'input_number') {
      saved = await this._persistInputNumberValue(temperature, day, index);
    } else {
      saved = await this._persistSchedule();
    }

    if (saved && shouldUpdateThermostat) {
      this._setThermostatTemperature(temperature);
    }

    if (saved) {
      this._cancelEdit();
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
    const effectiveStop = Math.max(startMinutes + 1, stopMinutes);

    return currentMinutes >= startMinutes && currentMinutes < effectiveStop;
  }

  private _getCurrentTimeBlock(): { entry: ScheduleEntry; index: number } | null {
    const currentDay = this._getCurrentDay();
    const daySchedule = this._schedule[currentDay];

    if (!daySchedule || !Array.isArray(daySchedule)) {
      return null;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < daySchedule.length; i++) {
      const entry = daySchedule[i];
      const startMinutes = this._timeToMinutes(entry.start);
      const stopMinutes = this._timeToMinutes(entry.stop);
      const effectiveStop = Math.max(startMinutes + 1, stopMinutes);

      if (currentMinutes >= startMinutes && currentMinutes < effectiveStop) {
        return { entry, index: i };
      }
    }

    return null;
  }

  private async _updateCurrentScheduleEntry(newTemperature: number): Promise<boolean> {
    if (!this._selectedRoom) {
      this._debug('No room selected, cannot update schedule entry');
      return false;
    }

    const currentTimeBlock = this._getCurrentTimeBlock();
    if (!currentTimeBlock) {
      this._debug('No current time block found, schedule not updated');
      return false;
    }

    const { entry, index } = currentTimeBlock;
    const currentDay = this._getCurrentDay();

    const updatedEntry: ScheduleEntry = {
      start: entry.start,
      stop: entry.stop,
      temperatures: {
        ...entry.temperatures,
        [this._selectedRoom]: newTemperature
      }
    };

    const updatedDaySchedule = [...this._schedule[currentDay]];
    updatedDaySchedule[index] = updatedEntry;

    this._schedule = {
      ...this._schedule,
      [currentDay]: updatedDaySchedule
    };

    this._lastKnownSchedule = this._createMutableSchedule(this._schedule);

    this._debug(`Updated schedule entry for ${this._selectedRoom} at ${entry.start}-${entry.stop} to ${newTemperature}°C`);

    // For input_number services, persist the individual temperature value
    if (this._config?.persistence?.domain === 'input_number') {
      return await this._persistInputNumberValue(newTemperature, currentDay, index);
    }

    // For other persistence methods, use the full schedule approach
    return await this._persistSchedule();
  }

  private async _persistInputNumberValue(temperature: number, day: string, periodIndex: number): Promise<boolean> {
    if (!this._config?.persistence || !this._hass || !this._selectedRoom) {
      return false;
    }

    const { domain, service, schedule_key } = this._config.persistence;

    if (domain !== 'input_number' || service !== 'set_value') {
      this._debug('Not an input_number.set_value service, falling back to regular persistence');
      return await this._persistSchedule();
    }

    // Determine the input_number entity name based on day, period, and room
    const entityId = this._getInputNumberEntityId(day, periodIndex);
    if (!entityId) {
      this._debug(`Could not determine input_number entity for ${day} period ${periodIndex} room ${this._selectedRoom}`);
      return false;
    }

    const payload: Record<string, unknown> = {
      entity_id: entityId,
      [schedule_key ?? 'value']: temperature
    };

    this._isPersisting = true;

    try {
      this._debug(`Calling input_number.set_value with payload:`, payload);
      await this._hass.callService(domain, service, payload);
      this._debug(`Successfully updated ${entityId} to ${temperature}°C`);
      return true;
    } catch (error: any) {
      this._errorMessage = `Failed to save temperature: ${error?.message ?? error}`;
      this._debug('Error while saving temperature to input_number', error);
      return false;
    } finally {
      this._isPersisting = false;
    }
  }

  private _getInputNumberEntityId(day: string, periodIndex: number): string | null {
    if (!this._selectedRoom) {
      return null;
    }

    // Map room names to input_number naming convention
    const roomMap: Record<string, string> = {
      'T_lukas_park': 'lukas_park',
      'T_lukas_kirche': 'lukas_kirche',
      'T_lukas_schillerstr': 'lukas_schillerstr',
      'T_kueche': 'kueche',
      'T_philip': 'philip',
      'T_guest': 'guest'
    };

    const roomSuffix = roomMap[this._selectedRoom] || this._selectedRoom.toLowerCase().replace(/^t_/, '');

    // Determine day type and period name
    const dayOfWeek = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    const isFriday = dayOfWeek === 5;

    let periodPrefix: string;

    if (isWeekend) {
      // Weekend periods: 0-4 -> weekend_period1-5
      periodPrefix = `weekend_period${periodIndex + 1}`;
    } else if (isFriday && periodIndex === 4) {
      // Friday has special period 5
      periodPrefix = 'friday_period5';
    } else {
      // Weekday periods: 0-5 -> weekday_period1-6
      periodPrefix = `weekday_period${periodIndex + 1}`;
    }

    const entityId = `input_number.heat_${periodPrefix}_${roomSuffix}`;
    this._debug(`Generated entity_id: ${entityId} for day=${day}, period=${periodIndex}, room=${this._selectedRoom}`);

    return entityId;
  }

  private _maybeLoadScheduleFromHA(hass: HomeAssistant): void {
    if (!this._config?.schedule_entity) {
      return;
    }

    const scheduleEntity = hass.states[this._config.schedule_entity];
    if (!scheduleEntity) {
      this._errorMessage = `Schedule entity ${this._config.schedule_entity} not found.`;
      return;
    }

    const sourceAttributes =
      typeof scheduleEntity.attributes?.data === 'object' && scheduleEntity.attributes?.data !== null
        ? scheduleEntity.attributes.data
        : scheduleEntity.attributes;

    if (!sourceAttributes || typeof sourceAttributes !== 'object') {
      this._debug('Schedule entity attributes not in expected format.', scheduleEntity.attributes);
      return;
    }

    const fingerprint = JSON.stringify(sourceAttributes);
    if (fingerprint === this._lastScheduleFingerprint) {
      return;
    }

    try {
      const converted = this._convertHAScheduleFormat(sourceAttributes);
      if (Object.keys(converted).length === 0) {
        this._debug('Converted schedule was empty; skipping update.');
        return;
      }

      this._applySchedule(converted);
      this._lastScheduleFingerprint = fingerprint;
      this._errorMessage = '';
    } catch (error) {
      this._errorMessage = 'Failed to parse schedule from Home Assistant.';
      this._debug('Schedule parsing failed', error);
      if (this._lastKnownSchedule) {
        this._schedule = this._createMutableSchedule(this._lastKnownSchedule);
      }
    }
  }

  private _maybeLoadScheduleFromInputHelpers(hass: HomeAssistant): void {
    if (!this._config?.persistence || this._config.persistence.domain !== 'input_number') {
      return;
    }

    try {
      const schedule = this._buildScheduleFromInputHelpers(hass);
      if (Object.keys(schedule).length > 0) {
        this._applySchedule(schedule);
        this._debug('Successfully loaded schedule from input helpers');
      } else {
        this._debug('No input helpers found, using default schedule');
        // Use default schedule if no input helpers are found
        const defaultSchedule = this._getDefaultSchedule(this._config.room_temp_key);
        this._applySchedule(defaultSchedule);
      }
    } catch (error) {
      this._debug('Error loading schedule from input helpers:', error);
      this._errorMessage = 'Failed to load schedule from input helpers. Using default schedule.';
      // Fallback to default schedule
      const defaultSchedule = this._getDefaultSchedule(this._config.room_temp_key);
      this._applySchedule(defaultSchedule);
    }
  }

  private _buildScheduleFromInputHelpers(hass: HomeAssistant): Schedule {
    const schedule: Schedule = {};
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Room mapping - reverse of what we use for saving
    const allRooms = ['lukas_park', 'lukas_kirche', 'lukas_schillerstr', 'kueche', 'philip', 'guest'];
    const roomToTempKey: Record<string, string> = {
      'lukas_park': 'T_lukas_park',
      'lukas_kirche': 'T_lukas_kirche',
      'lukas_schillerstr': 'T_lukas_schillerstr',
      'kueche': 'T_kueche',
      'philip': 'T_philip',
      'guest': 'T_guest'
    };

    for (const day of dayNames) {
      const daySchedule: ScheduleEntry[] = [];

      // Determine number of periods and their prefixes for this day
      const dayOfWeek = dayNames.indexOf(day); // 0=monday, 6=sunday
      const isWeekend = dayOfWeek >= 5; // saturday=5, sunday=6
      const isFriday = dayOfWeek === 4;

      let periods: string[];
      let timeHelperPrefixes: string[];

      if (isWeekend) {
        periods = ['weekend_period1', 'weekend_period2', 'weekend_period3', 'weekend_period4', 'weekend_period5'];
        timeHelperPrefixes = ['heat_weekend_period1', 'heat_weekend_period2', 'heat_weekend_period3', 'heat_weekend_period4', 'heat_weekend_period5'];
      } else {
        periods = ['weekday_period1', 'weekday_period2', 'weekday_period3', 'weekday_period4', 'weekday_period5', 'weekday_period6'];
        timeHelperPrefixes = ['heat_weekday_period1', 'heat_weekday_period2', 'heat_weekday_period3', 'heat_weekday_period4', 'heat_weekday_period5', 'heat_weekday_period6'];

        // Special case for Friday period 5
        if (isFriday) {
          periods[4] = 'friday_period5';
          timeHelperPrefixes[4] = 'heat_friday_period5';
        }
      }

      // Build schedule entries for this day
      for (let periodIndex = 0; periodIndex < periods.length; periodIndex++) {
        const periodPrefix = periods[periodIndex];
        const timePrefix = timeHelperPrefixes[periodIndex];

        // Get start and end times
        const startEntity = hass.states[`input_datetime.${timePrefix}_start`];
        const endEntity = hass.states[`input_datetime.${timePrefix}_end`];

        if (!startEntity || !endEntity) {
          this._debug(`Missing time helpers for ${timePrefix}`);
          continue;
        }

        const start = this._extractTimeFromInputDateTime(startEntity.state);
        const stop = this._extractTimeFromInputDateTime(endEntity.state);

        if (!start || !stop) {
          this._debug(`Invalid time values for ${timePrefix}: start=${startEntity.state}, end=${endEntity.state}`);
          continue;
        }

        // Get temperatures for all rooms
        const temperatures: Record<string, number> = {};
        for (const room of allRooms) {
          const tempEntityId = `input_number.heat_${periodPrefix}_${room}`;
          const tempEntity = hass.states[tempEntityId];

          if (tempEntity && !isNaN(Number(tempEntity.state))) {
            const tempKey = roomToTempKey[room];
            if (tempKey) {
              temperatures[tempKey] = Number(tempEntity.state);
            }
          }
        }

        // Only add entry if we have at least one temperature
        if (Object.keys(temperatures).length > 0) {
          daySchedule.push({
            start,
            stop,
            temperatures
          });
        }
      }

      if (daySchedule.length > 0) {
        schedule[day] = daySchedule;
      }
    }

    this._debug(`Built schedule from input helpers:`, schedule);
    return schedule;
  }

  private _extractTimeFromInputDateTime(state: string): string | null {
    if (!state) return null;

    // Input datetime returns time in HH:MM:SS format
    if (state.match(/^\d{2}:\d{2}:\d{2}$/)) {
      // Convert HH:MM:SS to HH:MM
      return state.substring(0, 5);
    }

    // If it's already HH:MM format
    if (state.match(/^\d{2}:\d{2}$/)) {
      return state;
    }

    this._debug(`Unable to parse time from input_datetime state: ${state}`);
    return null;
  }

  private _convertHAScheduleFormat(haSchedule: any): Schedule {
    const converted: Schedule = {};
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    dayNames.forEach(day => {
      const periods = haSchedule?.[day];
      if (!Array.isArray(periods)) {
        return;
      }

      const convertedPeriods = periods
        .map((period: any) => this._convertHAPeriod(period))
        .filter((entry): entry is ScheduleEntry => entry !== null);

      if (convertedPeriods.length > 0) {
        converted[day] = convertedPeriods;
      }
    });

    return converted;
  }

  private _convertHAPeriod(period: any): ScheduleEntry | null {
    if (!period || typeof period !== 'object') {
      return null;
    }

    const start = this._normalizeTime(period.from ?? period.start);
    const stop = this._normalizeTime(period.to ?? period.end ?? period.stop);

    if (!start || !stop) {
      return null;
    }

    const temperatures = this._normalizeTemperatures(period.data ?? period.temperatures ?? {});

    if (Object.keys(temperatures).length === 0) {
      const fallback = Number(period.temperature ?? period.setpoint);
      if (!Number.isNaN(fallback)) {
        const room = this._config?.room_temp_key ?? 'default_room';
        temperatures[room] = fallback;
      }
    }

    if (Object.keys(temperatures).length === 0) {
      return null;
    }

    return {
      start,
      stop,
      temperatures
    };
  }

  private _normalizeTime(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number' && !Number.isNaN(value)) {
      const minutes = Math.round(value);
      const clamped = Math.max(0, Math.min(1440, minutes));
      const hours = Math.min(24, Math.floor(clamped / 60));
      const mins = clamped % 60;
      if (hours === 24 && mins > 0) {
        return '24:00';
      }
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (timeMatch) {
        let hours = Number(timeMatch[1]);
        let minutes = Number(timeMatch[2]);
        const seconds = Number(timeMatch[3] ?? 0);

        if (hours === 24 && minutes === 0) {
          return '24:00';
        }

        if (hours === 23 && minutes === 59 && seconds >= 59) {
          return '24:00';
        }

        if (seconds >= 30) {
          minutes += 1;
        }

        hours = Math.max(0, Math.min(24, hours));

        if (minutes >= 60) {
          hours = Math.min(24, hours + Math.floor(minutes / 60));
          minutes %= 60;
        }

        if (hours === 24) {
          return '24:00';
        }

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }

      const isoMatch = trimmed.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
      if (isoMatch) {
        return this._normalizeTime(`${isoMatch[1]}:${isoMatch[2]}:${isoMatch[3] ?? '00'}`);
      }
    }

    return null;
  }

  private _normalizeTemperatures(data: any): Record<string, number> {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const result: Record<string, number> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (!key) {
        return;
      }

      const numericValue = typeof value === 'string' ? Number(value) : value;
      if (typeof numericValue === 'number' && !Number.isNaN(numericValue)) {
        result[key] = numericValue;
      }
    });

    return result;
  }

  private _convertScheduleToHAFormat(schedule: Schedule): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    Object.entries(schedule).forEach(([day, entries]) => {
      result[day] = entries.map(entry => ({
        from: this._toHaTime(entry.start),
        to: this._toHaTime(entry.stop),
        data: { ...entry.temperatures }
      }));
    });

    return result;
  }

  private _toHaTime(time: string): string {
    if (!time) {
      return '00:00:00';
    }

    if (time === '24:00') {
      return '24:00:00';
    }

    const [hours = '00', minutes = '00'] = time.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
  }

  private async _persistSchedule(): Promise<boolean> {
    if (!this._config?.persistence) {
      this._errorMessage = 'Schedule not saved: configure a persistence helper in the card options so changes survive reloads.';
      this._debug('No persistence configuration provided; refusing to persist schedule.');
      return false;
    }

    if (!this._hass) {
      this._errorMessage = 'Unable to save schedule: Home Assistant connection unavailable.';
      return false;
    }

    const { domain, service } = this._config.persistence;
    const serviceKey = `${domain}.${service}`;

    // Allow input_number.set_value since we handle it specially with individual temperature values
    if (this._isNumericPersistenceTarget(domain, service) && !(domain === 'input_number' && service === 'set_value')) {
      this._errorMessage = `Cannot persist schedule: ${serviceKey} only accepts numeric payloads. Please switch to a text/JSON helper such as input_text.set_value.`;
      this._debug(`Skipping persistence because ${serviceKey} only accepts numeric payloads.`);
      return false;
    }

    const domainServices = this._hass.services?.[domain];
    if (!domainServices || !(service in domainServices)) {
      this._errorMessage = `Cannot persist schedule: service ${serviceKey} is unavailable. Verify that the helper exists and is loaded.`;
      this._debug(`Persistence service ${serviceKey} is not available in Home Assistant.`, this._hass.services);
      return false;
    }

    // Check if this is the schedule integration which doesn't support runtime updates
    if (domain === 'schedule') {
      this._debug('Schedule integration does not support runtime updates. Schedule changes are only visual in the card.');
      this._errorMessage = 'Schedule changes saved locally only (schedule integration doesn\'t support runtime updates)';
      return false; // Return false so thermostat is updated but user knows schedule isn't persisted
    }

    const { include_entity, schedule_key, data } = this._config.persistence;
    const payload: Record<string, unknown> = { ...(data ?? {}) };

    // Only add entity_id for services that support it
    if (include_entity === true && this._config.schedule_entity) {
      const servicesWithEntityId = ['input_text.set_value', 'variable.set_variable', 'python_script'];
      const serviceKey = `${domain}.${service}`;

      if (servicesWithEntityId.some(s => serviceKey.startsWith(s.split('.')[0]))) {
        payload.entity_id = this._config.schedule_entity;
        this._debug(`Added entity_id to payload for service: ${serviceKey}`);
      } else {
        this._debug(`Skipping entity_id for service ${serviceKey} as it typically doesn't accept this parameter`);
      }
    }

    const key = schedule_key ?? 'schedule';
    payload[key] = this._convertScheduleToHAFormat(this._schedule);

    try {
      this._isPersisting = true;
      this._debug(`Calling service ${domain}.${service} with payload:`, payload);
      await this._hass.callService(domain, service, payload);
      return true;
    } catch (error: any) {
      this._errorMessage = `Failed to save schedule: ${error?.message ?? error}`;
      this._debug('Error while saving schedule', error);
      return false;
    } finally {
      this._isPersisting = false;
    }
  }

  private _debug(message: string, ...optionalParams: unknown[]): void {
    if (!this._config?.debug) {
      return;
    }

    // eslint-disable-next-line no-console
    console.debug('[heizplan-card]', message, ...optionalParams);
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