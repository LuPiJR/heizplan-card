// Heizplan Card for Home Assistant
// Custom Lovelace card for thermostat schedule management

const cardTemplate = document.createElement('template');
cardTemplate.innerHTML = `
<style>
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

    .time-block {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
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

    /* Temperature-based colors */
    .temp-5 { background-color: var(--temp-cold-color, #175e7f); }
    .temp-17 { background-color: var(--temp-medium-color, #f39c12); }
    .temp-19 { background-color: var(--temp-warm-color, #e74c3c); }
    .temp-20 { background-color: var(--temp-warm-color, #e67e22); }
    .temp-21 { background-color: var(--temp-hot-color, #c0392b); }
    .temp-21-5 { background-color: var(--temp-very-hot-color, #a93226); }

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

    .week-timeline .time-block {
        height: 100%;
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        transition: all 0.2s ease;
    }

    .week-timeline .time-block:hover {
        opacity: 0.8;
        transform: scaleY(1.1);
        z-index: 10;
    }

    .time-markers {
        display: flex;
        justify-content: space-between;
        margin-top: 0.5rem;
        font-size: 0.75rem;
        color: var(--secondary-text-color, #aaa);
    }

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

    .mode-controls {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
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
        display: none;
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
</style>

<div class="heizplan-card">
    <div class="card-header">
        <div class="card-title"></div>
        <div class="current-temp"></div>
    </div>

    <div class="view-controls">
        <button class="view-button single-day active">Today</button>
        <button class="view-button week-view">Week</button>
    </div>

    <div class="schedule-container single-day-view">
        <div class="day-header"></div>
        <div class="timeline"></div>
        <div class="time-markers">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>24h</span>
        </div>
    </div>

    <div class="week-schedule-container" style="display: none;">
        <div class="week-days">
            <div class="week-day" data-day="monday">
                <div class="week-day-header">Mo</div>
                <div class="week-timeline"></div>
            </div>
            <div class="week-day" data-day="tuesday">
                <div class="week-day-header">Di</div>
                <div class="week-timeline"></div>
            </div>
            <div class="week-day" data-day="wednesday">
                <div class="week-day-header">Mi</div>
                <div class="week-timeline"></div>
            </div>
            <div class="week-day" data-day="thursday">
                <div class="week-day-header">Do</div>
                <div class="week-timeline"></div>
            </div>
            <div class="week-day" data-day="friday">
                <div class="week-day-header">Fr</div>
                <div class="week-timeline"></div>
            </div>
            <div class="week-day" data-day="saturday">
                <div class="week-day-header">Sa</div>
                <div class="week-timeline"></div>
            </div>
            <div class="week-day" data-day="sunday">
                <div class="week-day-header">So</div>
                <div class="week-timeline"></div>
            </div>
        </div>
        <div class="time-markers week-markers">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>24h</span>
        </div>
    </div>

    <div class="controls">
        <div class="temp-control">
            <button class="temp-button decrease">−</button>
            <div class="temp-display"></div>
            <button class="temp-button increase">+</button>
        </div>
        <div class="mode-controls">
            <div class="mode-display"></div>
            <button class="toggle-switch">
                <span class="toggle-off">OFF</span>
                <span class="toggle-on">HEAT</span>
            </button>
        </div>
    </div>

    <div class="error-message"></div>
</div>

<!-- Edit Modal -->
<div class="edit-modal">
    <div class="edit-modal-content">
        <h3>Edit Temperature</h3>
        <p class="edit-time-range"></p>
        <div class="edit-controls">
            <button class="temp-button decrease">−</button>
            <div class="temp-display edit-temp"></div>
            <button class="temp-button increase">+</button>
        </div>
        <div class="modal-buttons">
            <button class="modal-button primary save-btn">Save</button>
            <button class="modal-button secondary cancel-btn">Cancel</button>
        </div>
    </div>
</div>
`;

class HeizplanCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(cardTemplate.content.cloneNode(true));

        // Default configuration
        this._config = {};
        this._hass = null;
        this._schedule = this.getDefaultSchedule();
        this._currentDay = this.getCurrentDay();
        this._editingBlock = null;
        this._currentView = 'single'; // 'single' or 'week'

        this.setupEventListeners();
    }

    // Home Assistant integration
    setConfig(config) {
        if (!config.entity) {
            throw new Error('Please define a thermostat entity');
        }

        this._config = {
            entity: config.entity,
            name: config.name || 'Heizplan',
            min_temp: config.min_temp || 5,
            max_temp: config.max_temp || 30,
            temp_step: config.temp_step || 0.5,
            schedule: config.schedule,
            schedule_entity: config.schedule_entity,
            room_temp_key: config.room_temp_key || 'T_kueche', // Which thermostat in your multi-room setup
            ...config
        };

        // Use provided schedule, or default if none provided
        if (config.schedule) {
            this._schedule = this.createMutableSchedule(config.schedule);
            console.log('Using provided schedule:', this._schedule);
        } else {
            this._schedule = this.getDefaultSchedule();
            console.log('Using default schedule:', this._schedule);
        }

        this.updateCard();
    }

    set hass(hass) {
        this._hass = hass;

        // Try to load schedule from HA entity
        if (this._config.schedule_entity) {
            this.loadScheduleFromHA(hass);
        }

        this.updateCard();
    }

    loadScheduleFromHA(hass) {
        // Try multiple ways to access the schedule from HA
        const scheduleEntityName = this._config.schedule_entity || 'schedule.heizung_schedule';

        console.log('Looking for schedule entity:', scheduleEntityName);
        console.log('Available entities:', Object.keys(hass.states).filter(key => key.includes('schedule')));

        // Method 1: Try direct entity access
        let scheduleEntity = hass.states[scheduleEntityName];
        console.log('Direct entity lookup result:', scheduleEntity);

        if (scheduleEntity) {
            console.log('Schedule entity state:', scheduleEntity.state);
            console.log('Schedule entity attributes:', scheduleEntity.attributes);

            // Check if the schedule data is in attributes
            if (scheduleEntity.attributes && Object.keys(scheduleEntity.attributes).length > 1) {
                try {
                    this._schedule = this.convertHAScheduleFormat(scheduleEntity.attributes, this._config.room_temp_key);
                    console.log('Successfully loaded schedule from entity attributes:', this._schedule);
                    return;
                } catch (error) {
                    console.warn('Failed to convert schedule from attributes:', error);
                }
            }
        }

        // Method 2: Look for schedule data in hass.config or other locations
        console.log('Hass object keys:', Object.keys(hass));
        if (hass.config) {
            console.log('Hass config keys:', Object.keys(hass.config));
        }

        // Method 3: Search for any schedule-related entities
        const allScheduleEntities = Object.keys(hass.states).filter(key =>
            key.includes('schedule') || key.includes('heizung')
        );
        console.log('All schedule-related entities found:', allScheduleEntities);

        // Try each schedule entity
        for (const entityKey of allScheduleEntities) {
            const entity = hass.states[entityKey];
            console.log(`Entity ${entityKey}:`, entity);

            if (entity.attributes && this.hasScheduleData(entity.attributes)) {
                try {
                    this._schedule = this.convertHAScheduleFormat(entity.attributes, this._config.room_temp_key);
                    console.log(`Successfully loaded schedule from ${entityKey}:`, this._schedule);
                    return;
                } catch (error) {
                    console.warn(`Failed to convert schedule from ${entityKey}:`, error);
                }
            }
        }

        // Method 4: Try to call schedule service to get data
        this.tryScheduleService(hass);

        console.warn('No valid schedule found in HA, using default schedule');
        this._schedule = this.getDefaultSchedule();
    }

    async tryScheduleService(hass) {
        try {
            // Try to get schedule data via service call
            const result = await hass.callService('schedule', 'list_schedules', {});
            console.log('Schedule service call result:', result);
        } catch (error) {
            console.log('Schedule service not available:', error);
        }

        // Also try to find schedule-related services
        if (hass.services) {
            const scheduleServices = Object.keys(hass.services).filter(service =>
                service.includes('schedule') || service === 'schedule'
            );
            console.log('Available schedule services:', scheduleServices);

            scheduleServices.forEach(serviceName => {
                console.log(`${serviceName} service methods:`, Object.keys(hass.services[serviceName] || {}));
            });
        }
    }

    hasScheduleData(attributes) {
        // Check if attributes contain schedule-like data
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        return days.some(day => attributes[day] && Array.isArray(attributes[day]));
    }

    convertHAScheduleFormat(haSchedule, roomKey = 'T_kueche') {
        const convertedSchedule = {};

        Object.keys(haSchedule).forEach(day => {
            if (Array.isArray(haSchedule[day])) {
                convertedSchedule[day] = haSchedule[day].map(period => ({
                    start: period.from.substring(0, 5), // Convert "07:00:00" to "07:00"
                    stop: period.to.substring(0, 5),
                    temperature: period.data[roomKey] || 21 // Extract temp for specific room
                }));
            }
        });

        return convertedSchedule;
    }

    getCardSize() {
        return 3;
    }

    createMutableSchedule(schedule) {
        const mutableSchedule = {};

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

    getCurrentDay() {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days[new Date().getDay()];
    }

    getDefaultSchedule() {
        // Convert your HA schedule format to card format
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

    setupEventListeners() {
        const increaseBtn = this.shadowRoot.querySelector('.controls .increase');
        const decreaseBtn = this.shadowRoot.querySelector('.controls .decrease');
        const timeline = this.shadowRoot.querySelector('.timeline');
        const modal = this.shadowRoot.querySelector('.edit-modal');
        const saveBtn = this.shadowRoot.querySelector('.save-btn');
        const cancelBtn = this.shadowRoot.querySelector('.cancel-btn');
        const editIncreaseBtn = this.shadowRoot.querySelector('.edit-controls .increase');
        const editDecreaseBtn = this.shadowRoot.querySelector('.edit-controls .decrease');
        const modeDisplay = this.shadowRoot.querySelector('.mode-display');
        const toggleSwitch = this.shadowRoot.querySelector('.toggle-switch');
        const singleDayBtn = this.shadowRoot.querySelector('.view-button.single-day');
        const weekViewBtn = this.shadowRoot.querySelector('.view-button.week-view');

        // Manual temperature control
        increaseBtn.addEventListener('click', () => this.adjustTemperature(this._config.temp_step));
        decreaseBtn.addEventListener('click', () => this.adjustTemperature(-this._config.temp_step));

        // HVAC mode control
        modeDisplay.addEventListener('click', () => this.cycleHvacMode());
        toggleSwitch.addEventListener('click', () => this.toggleHeatMode());

        // View switching
        singleDayBtn.addEventListener('click', () => this.switchView('single'));
        weekViewBtn.addEventListener('click', () => this.switchView('week'));

        // Timeline editing
        timeline.addEventListener('click', (e) => this.handleTimelineClick(e));

        // Week timeline editing
        const weekTimelines = this.shadowRoot.querySelectorAll('.week-timeline');
        weekTimelines.forEach(weekTimeline => {
            weekTimeline.addEventListener('click', (e) => this.handleWeekTimelineClick(e));
        });

        // Modal controls
        saveBtn.addEventListener('click', () => this.saveEdit());
        cancelBtn.addEventListener('click', () => this.cancelEdit());
        editIncreaseBtn.addEventListener('click', () => this.adjustEditTemp(this._config.temp_step));
        editDecreaseBtn.addEventListener('click', () => this.adjustEditTemp(-this._config.temp_step));

        // Close modal on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.cancelEdit();
        });
    }

    updateCard() {
        if (!this._hass || !this._config.entity) return;

        const entity = this._hass.states[this._config.entity];
        if (!entity) {
            this.showError(`Entity ${this._config.entity} not found`);
            return;
        }

        this.updateHeader(entity);
        if (this._currentView === 'single') {
            this.updateScheduleDisplay();
        } else {
            this.updateWeekScheduleDisplay();
        }
        this.updateControls(entity);
        this.clearError();
    }

    updateHeader(entity) {
        const title = this.shadowRoot.querySelector('.card-title');
        const currentTemp = this.shadowRoot.querySelector('.current-temp');

        title.textContent = this._config.name;
        currentTemp.textContent = `${entity.attributes.current_temperature || '--'}°C`;
    }

    updateScheduleDisplay() {
        const dayHeader = this.shadowRoot.querySelector('.day-header');
        const timeline = this.shadowRoot.querySelector('.timeline');

        dayHeader.textContent = this._currentDay.charAt(0).toUpperCase() + this._currentDay.slice(1);

        // Clear existing blocks
        timeline.innerHTML = '';

        const daySchedule = this._schedule[this._currentDay] || [];
        console.log('Day schedule for', this._currentDay, ':', daySchedule);

        if (daySchedule.length === 0) {
            console.warn('No schedule found for', this._currentDay);
            timeline.innerHTML = '<div style="padding: 1rem; text-align: center; color: #aaa;">No schedule available for today</div>';
            return;
        }

        const totalMinutes = 1440; // 24 hours

        daySchedule.forEach((entry, index) => {
            const startMinutes = this.timeToMinutes(entry.start);
            const stopMinutes = this.timeToMinutes(entry.stop);
            const widthPercentage = ((stopMinutes - startMinutes) / totalMinutes) * 100;
            const leftPercentage = (startMinutes / totalMinutes) * 100;

            const block = document.createElement('div');
            // Convert decimal temperatures to CSS-safe class names
            const tempClass = `temp-${entry.temperature.toString().replace('.', '-')}`;
            block.classList.add('time-block', tempClass);
            block.style.width = `${widthPercentage}%`;
            block.style.left = `${leftPercentage}%`;
            block.style.position = 'absolute';
            block.dataset.index = index;

            console.log(`Block ${index}: ${entry.start}-${entry.stop} = ${entry.temperature}°C, class: ${tempClass}, width: ${widthPercentage}%, left: ${leftPercentage}%`);

            // Add text for larger blocks
            const durationMinutes = stopMinutes - startMinutes;
            if (durationMinutes > 90) {
                block.textContent = `${entry.temperature}°C`;
            }

            timeline.appendChild(block);
        });
    }

    switchView(viewType) {
        this._currentView = viewType;

        const singleDayBtn = this.shadowRoot.querySelector('.view-button.single-day');
        const weekViewBtn = this.shadowRoot.querySelector('.view-button.week-view');
        const singleDayView = this.shadowRoot.querySelector('.schedule-container.single-day-view');
        const weekView = this.shadowRoot.querySelector('.week-schedule-container');

        if (viewType === 'single') {
            singleDayBtn.classList.add('active');
            weekViewBtn.classList.remove('active');
            singleDayView.style.display = 'block';
            weekView.style.display = 'none';
            this.updateScheduleDisplay();
        } else {
            singleDayBtn.classList.remove('active');
            weekViewBtn.classList.add('active');
            singleDayView.style.display = 'none';
            weekView.style.display = 'block';
            this.updateWeekScheduleDisplay();
        }
    }

    updateWeekScheduleDisplay() {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

        days.forEach(day => {
            const weekTimeline = this.shadowRoot.querySelector(`.week-day[data-day="${day}"] .week-timeline`);
            if (!weekTimeline) return;

            // Clear existing blocks
            weekTimeline.innerHTML = '';

            const daySchedule = this._schedule[day] || [];
            if (daySchedule.length === 0) return;

            const totalMinutes = 1440; // 24 hours

            daySchedule.forEach((entry, index) => {
                const startMinutes = this.timeToMinutes(entry.start);
                const stopMinutes = this.timeToMinutes(entry.stop);
                const widthPercentage = ((stopMinutes - startMinutes) / totalMinutes) * 100;
                const leftPercentage = (startMinutes / totalMinutes) * 100;

                const block = document.createElement('div');
                const tempClass = `temp-${entry.temperature.toString().replace('.', '-')}`;
                block.classList.add('time-block', tempClass);
                block.style.width = `${widthPercentage}%`;
                block.style.left = `${leftPercentage}%`;
                block.dataset.index = index;
                block.dataset.day = day;

                // Add text for larger blocks (smaller threshold for week view)
                const durationMinutes = stopMinutes - startMinutes;
                if (durationMinutes > 120) {
                    block.textContent = `${entry.temperature}°`;
                }

                weekTimeline.appendChild(block);
            });
        });
    }

    handleWeekTimelineClick(e) {
        const timeBlock = e.target.closest('.time-block');
        if (!timeBlock) return;

        const index = parseInt(timeBlock.dataset.index);
        const day = timeBlock.dataset.day;
        const daySchedule = this._schedule[day] || [];
        const entry = daySchedule[index];

        if (!entry) return;

        // Create a proper deep copy of the entry to avoid read-only issues
        this._editingBlock = {
            day: day,
            index,
            entry: {
                start: entry.start,
                stop: entry.stop,
                temperature: Number(entry.temperature)
            }
        };

        console.log('Editing week block:', this._editingBlock);
        this.showEditModal();
    }

    updateControls(entity) {
        const tempDisplay = this.shadowRoot.querySelector('.controls .temp-display');
        const modeDisplay = this.shadowRoot.querySelector('.mode-display');
        const toggleSwitch = this.shadowRoot.querySelector('.toggle-switch');

        tempDisplay.textContent = `${entity.attributes.temperature || '--'}°C`;
        modeDisplay.textContent = entity.state || 'unknown';

        // Update toggle switch based on HVAC mode
        if (entity.state === 'heat' || entity.state === 'auto') {
            toggleSwitch.classList.add('active');
        } else {
            toggleSwitch.classList.remove('active');
        }
    }

    handleTimelineClick(e) {
        const timeBlock = e.target.closest('.time-block');
        if (!timeBlock) return;

        const index = parseInt(timeBlock.dataset.index);
        const daySchedule = this._schedule[this._currentDay] || [];
        const entry = daySchedule[index];

        if (!entry) return;

        // Create a proper deep copy of the entry to avoid read-only issues
        this._editingBlock = {
            day: this._currentDay,
            index,
            entry: {
                start: entry.start,
                stop: entry.stop,
                temperature: Number(entry.temperature) // Ensure it's a mutable number
            }
        };

        console.log('Editing block created:', this._editingBlock);
        this.showEditModal();
    }

    showEditModal() {
        const modal = this.shadowRoot.querySelector('.edit-modal');
        const timeRange = this.shadowRoot.querySelector('.edit-time-range');
        const editTemp = this.shadowRoot.querySelector('.edit-temp');

        const { entry } = this._editingBlock;
        timeRange.textContent = `${entry.start} - ${entry.stop}`;
        editTemp.textContent = `${entry.temperature}°C`;

        modal.style.display = 'flex';
    }

    adjustEditTemp(delta) {
        if (!this._editingBlock) return;

        const newTemp = this._editingBlock.entry.temperature + delta;
        const clampedTemp = Math.max(this._config.min_temp,
                           Math.min(this._config.max_temp, newTemp));

        this._editingBlock.entry.temperature = clampedTemp;

        const editTemp = this.shadowRoot.querySelector('.edit-temp');
        editTemp.textContent = `${clampedTemp}°C`;
    }

    saveEdit() {
        if (!this._editingBlock) return;

        const { day, index, entry } = this._editingBlock;

        // Create a deep copy of the schedule to avoid read-only issues
        if (!this._schedule[day]) {
            this._schedule[day] = [];
        }

        // Create a new entry object instead of modifying the existing one
        this._schedule[day][index] = {
            start: entry.start,
            stop: entry.stop,
            temperature: entry.temperature
        };

        console.log('Updated schedule entry:', this._schedule[day][index]);

        // Update display
        if (this._currentView === 'single') {
            this.updateScheduleDisplay();
        } else {
            this.updateWeekScheduleDisplay();
        }

        // Close modal
        this.cancelEdit();

        // Optionally trigger immediate temperature change
        if (this.isCurrentTimeBlock(entry)) {
            this.setThermostatTemperature(entry.temperature);
        }
    }

    cancelEdit() {
        const modal = this.shadowRoot.querySelector('.edit-modal');
        modal.style.display = 'none';
        this._editingBlock = null;
    }

    adjustTemperature(delta) {
        if (!this._hass || !this._config.entity) return;

        const entity = this._hass.states[this._config.entity];
        const currentTemp = entity.attributes.temperature || 20;
        const newTemp = currentTemp + delta;
        const clampedTemp = Math.max(this._config.min_temp,
                           Math.min(this._config.max_temp, newTemp));

        this.setThermostatTemperature(clampedTemp);
    }

    setThermostatTemperature(temperature) {
        if (!this._hass) return;

        this._hass.callService('climate', 'set_temperature', {
            entity_id: this._config.entity,
            temperature: temperature
        }).catch(error => {
            this.showError(`Failed to set temperature: ${error.message}`);
        });
    }

    cycleHvacMode() {
        if (!this._hass || !this._config.entity) return;

        const entity = this._hass.states[this._config.entity];
        const availableModes = entity.attributes.hvac_modes || ['off', 'heat', 'auto'];
        const currentMode = entity.state;

        // Find next mode in cycle
        let currentIndex = availableModes.indexOf(currentMode);
        if (currentIndex === -1) currentIndex = 0;

        const nextIndex = (currentIndex + 1) % availableModes.length;
        const nextMode = availableModes[nextIndex];

        this._hass.callService('climate', 'set_hvac_mode', {
            entity_id: this._config.entity,
            hvac_mode: nextMode
        }).catch(error => {
            this.showError(`Failed to set HVAC mode: ${error.message}`);
        });
    }

    toggleHeatMode() {
        if (!this._hass || !this._config.entity) return;

        const entity = this._hass.states[this._config.entity];
        const currentMode = entity.state;

        // Toggle between off and heat
        const newMode = (currentMode === 'off') ? 'heat' : 'off';

        this._hass.callService('climate', 'set_hvac_mode', {
            entity_id: this._config.entity,
            hvac_mode: newMode
        }).catch(error => {
            this.showError(`Failed to toggle HVAC mode: ${error.message}`);
        });
    }

    isCurrentTimeBlock(entry) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = this.timeToMinutes(entry.start);
        const stopMinutes = this.timeToMinutes(entry.stop);

        return currentMinutes >= startMinutes && currentMinutes < stopMinutes;
    }

    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    showError(message) {
        const errorEl = this.shadowRoot.querySelector('.error-message');
        errorEl.textContent = message;
    }

    clearError() {
        const errorEl = this.shadowRoot.querySelector('.error-message');
        errorEl.textContent = '';
    }

    // Required Home Assistant methods
    static getStubConfig() {
        return {
            entity: 'climate.thermostat',
            name: 'Heizplan'
        };
    }
}

// Register the card
customElements.define('heizplan-card', HeizplanCard);

// Register with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
    type: 'heizplan-card',
    name: 'Heizplan Card',
    description: 'Interactive thermostat schedule card'
});

console.info(
    '%c  HEIZPLAN-CARD  %c  Version 1.0.0  ',
    'color: orange; font-weight: bold; background: black',
    'color: white; font-weight: bold; background: dimgray',
);