// Heizplan Card (clean, input_text-only)
// Vanilla Web Component tailored for Home Assistant Lovelace
// - Shadow DOM encapsulation
// - Reactive render()
// - Event delegation
// - Accessibility & keyboard support
// - input_text (schedule_text_entity) is the single source of truth
// - Parser & serializer with 255-char guard
(() => {
  const TEMPLATE = document.createElement('template');
  TEMPLATE.innerHTML = /* html */ `
    <style>
      :host { display: block; }
      .heizplan-card { background: var(--card-background-color, #1e1e1e); border-radius: var(--border-radius, 0.5rem); padding: 1rem; font-family: var(--primary-font-family, Arial, sans-serif); color: var(--primary-text-color, #fff); box-shadow: var(--card-box-shadow, 0 0.4rem 0.6rem rgba(0,0,0,.2)); }
      .card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; font-size:1.1rem; font-weight:600; }
      .current-temp { font-size:.95rem; color: var(--secondary-text-color, #aaa); }

      .view-controls{ display:flex; justify-content:center; gap:.5rem; margin-bottom:1rem; }
      .view-button{ padding:.5rem 1rem; border:1px solid var(--primary-color,#f39c12); background:transparent; color:var(--primary-color,#f39c12); border-radius:.375rem; cursor:pointer; transition:.2s; font-size:.9rem; }
      .view-button:hover,.view-button.active{ background:var(--primary-color,#f39c12); color:#fff; }

      .time-markers, .week-markers{ display:flex; justify-content:space-between; margin-top:.5rem; font-size:.75rem; color:var(--secondary-text-color,#aaa); }

      .timeline, .week-timeline { position:relative; height:2.2rem; background:var(--timeline-background,#2e2e2e); border-radius:.25rem; overflow:hidden; cursor:pointer; }
      .week-day{ display:flex; align-items:center; gap:.5rem; min-height:2rem; }
      .week-day-header{ width:2.25rem; font-size:.85rem; font-weight:600; text-align:center; color:var(--primary-text-color,#fff); }
      .week-timeline{ flex:1; height:1.6rem; }

      .time-block{ position:absolute; inset-block:0; display:flex; align-items:center; justify-content:center; font-size:.8rem; color:#fff; border-right:1px solid rgba(255,255,255,.08); transition:transform .15s ease,opacity .15s ease; }
      .time-block:hover{ opacity:.9; transform:scale(1.02); z-index:1; }

      /* Temperature -> color mapping via HSL so any °C works */
      .time-block{ background: hsl(var(--_h, 18) calc(var(--_s, 80%)) calc(var(--_l, 44%))); }

      .controls{ display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-top:1rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,.1); }
      .temp-control{ display:flex; align-items:center; gap:.5rem; }
      .temp-button{ background:var(--primary-color,#f39c12); border:none; border-radius:999px; width:2rem; height:2rem; color:#fff; cursor:pointer; font-size:1rem; display:grid; place-items:center; }
      .temp-display{ font-weight:700; min-width:3rem; text-align:center; }

      .mode-controls{ display:flex; flex-direction:column; align-items:center; gap:.5rem; }
      .mode-display{ font-size:.9rem; color:var(--secondary-text-color,#aaa); text-transform:capitalize; cursor:pointer; padding:.3rem .6rem; border:1px solid var(--secondary-text-color,#aaa); border-radius:.25rem; transition:.2s; }
      .mode-display:hover{ background:var(--primary-color,#f39c12); color:#fff; border-color:var(--primary-color,#f39c12); }

      .toggle-switch{ position:relative; width:80px; height:32px; border-radius:16px; border:none; background:#666; cursor:pointer; transition:all .3s; overflow:hidden; }
      .toggle-switch[aria-pressed="true"]{ background:var(--primary-color,#f39c12); }
      .toggle-switch span{ position:absolute; top:50%; transform:translateY(-50%); font-size:.7rem; font-weight:700; color:#fff; transition:opacity .3s; }
      .toggle-off{ left:8px; }
      .toggle-on{ right:8px; opacity:0; }
      .toggle-switch[aria-pressed="true"] .toggle-off{ opacity:0; }
      .toggle-switch[aria-pressed="true"] .toggle-on{ opacity:1; }

      .error-message{ color:var(--error-color,#ff6b6b); font-size:.9rem; margin-top:.5rem; text-align:center; }

      /* Modal */
      .edit-modal{ position:fixed; inset:0; background:rgba(0,0,0,.7); display:none; place-items:center; z-index:1000; }
      .edit-modal[open]{ display:grid; }
      .edit-modal-content{ background:var(--card-background-color,#1e1e1e); padding:1.25rem; border-radius:.5rem; min-width:300px; text-align:center; }
      .edit-controls{ display:flex; justify-content:center; gap:1rem; margin:1rem 0; }
      .modal-buttons{ display:flex; justify-content:center; gap:1rem; margin-top:1rem; }
      .modal-button{ padding:.5rem 1rem; border:none; border-radius:.25rem; cursor:pointer; font-size:.9rem; }
      .modal-button.primary{ background:var(--primary-color,#f39c12); color:#fff; }
      .modal-button.secondary{ background:var(--secondary-color,#666); color:#fff; }
    </style>

    <div class="heizplan-card" part="card">
      <div class="card-header">
        <div class="card-title" part="title"></div>
        <div class="current-temp" part="current"></div>
      </div>

      <div class="view-controls" role="tablist" aria-label="Schedule view">
        <button class="view-button js-view" data-view="single" role="tab" aria-selected="true">Today</button>
        <button class="view-button js-view" data-view="week" role="tab" aria-selected="false">Week</button>
      </div>

      <section class="single-day-view" part="single" aria-label="Single day schedule">
        <div class="day-header" part="day"></div>
        <div class="timeline" part="timeline" data-day="" title="Click to add a split"></div>
        <div class="time-markers"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
      </section>

      <section class="week-schedule-view" part="week" hidden aria-label="Week schedule">
        <div class="week-days"></div>
        <div class="week-markers time-markers"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
      </section>

      <div class="controls">
        <div class="temp-control">
          <button class="temp-button js-dec" aria-label="Decrease setpoint">−</button>
          <div class="temp-display js-temp"></div>
          <button class="temp-button js-inc" aria-label="Increase setpoint">+</button>
        </div>
        <div class="mode-controls">
          <div class="mode-display js-mode" role="button" tabindex="0" aria-label="Cycle HVAC mode"></div>
          <button class="toggle-switch js-toggle" role="switch" aria-pressed="false" aria-label="Toggle heat">
            <span class="toggle-off">OFF</span>
            <span class="toggle-on">HEAT</span>
          </button>
        </div>
      </div>

      <div class="error-message js-error" aria-live="polite"></div>
    </div>

    <!-- Edit Modal -->
    <div class="edit-modal" aria-modal="true" role="dialog" aria-labelledby="edit-title">
      <div class="edit-modal-content">
        <h3 id="edit-title">Edit Temperature</h3>
        <p class="edit-time-range js-range"></p>
        <div class="edit-controls">
          <button class="temp-button js-edit-dec" aria-label="Decrease temp">−</button>
          <div class="temp-display js-edit-temp"></div>
          <button class="temp-button js-edit-inc" aria-label="Increase temp">+</button>
        </div>
        <div class="modal-buttons">
          <button class="modal-button primary js-save">Save</button>
          <button class="modal-button secondary js-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;

  const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const DAY_SHORT = { monday: 'Mo', tuesday: 'Di', wednesday: 'Mi', thursday: 'Do', friday: 'Fr', saturday: 'Sa', sunday: 'So' };

  class HeizplanCard extends HTMLElement {
    // ----- Lifecycle -----
    constructor(){
      super();
      this._hass = null;
      this._config = {};
      this._schedule = this._defaultSchedule();
      this._currentDay = this._getCurrentDay();
      this._currentView = 'single';
      this._editing = null; // {day, index, entry}
      this.attachShadow({mode:'open'}).appendChild(TEMPLATE.content.cloneNode(true));

      // Cache refs
      this.$ = {
        title: this.shadowRoot.querySelector('.card-title'),
        current: this.shadowRoot.querySelector('.current-temp'),
        single: this.shadowRoot.querySelector('.single-day-view'),
        week: this.shadowRoot.querySelector('.week-schedule-view'),
        dayHeader: this.shadowRoot.querySelector('.day-header'),
        timeline: this.shadowRoot.querySelector('.timeline'),
        weekDays: this.shadowRoot.querySelector('.week-days'),
        temp: this.shadowRoot.querySelector('.js-temp'),
        mode: this.shadowRoot.querySelector('.js-mode'),
        toggle: this.shadowRoot.querySelector('.js-toggle'),
        error: this.shadowRoot.querySelector('.js-error'),
        modal: this.shadowRoot.querySelector('.edit-modal'),
        range: this.shadowRoot.querySelector('.js-range'),
        editTemp: this.shadowRoot.querySelector('.js-edit-temp'),
      };
    }

    connectedCallback(){ this._bindEvents(); this._render(); }
    disconnectedCallback(){
      this.shadowRoot.removeEventListener('click', this._onClick);
      this.shadowRoot.removeEventListener('keydown', this._onKeyDown);
    }

    // ----- HA integration -----
    setConfig(config){
      if(!config?.entity) throw new Error('Please define a thermostat entity');
      this._config = {
        name: config.name || 'Heizplan',
        min_temp: Number(config.min_temp ?? 5),
        max_temp: Number(config.max_temp ?? 30),
        temp_step: Number(config.temp_step ?? 0.5),
        room_temp_key: config.room_temp_key || 'T_kueche',
        entity: config.entity,
        schedule_text_entity: config.schedule_text_entity, // single source of truth
      };
      this._schedule = this._defaultSchedule(); // until hass() loads input_text
      this._render();
    }

    set hass(hass){
      this._hass = hass;
      const key = this._config.schedule_text_entity;
      const raw = key ? hass?.states?.[key]?.state : undefined;
      if (typeof raw === 'string' && raw.trim()) {
        try { this._schedule = this._parseTextSchedule(raw); }
        catch(e){ this._setError('Invalid schedule format in input_text'); }
      }
      this._render();
    }

    getCardSize(){ return 3; }
    static getStubConfig(){ return { entity:'climate.thermostat', name:'Heizplan' }; }

    // ----- Events -----
    _bindEvents(){
      // Event delegation
      this._onClick = (e) => {
        const t = e.target;

        // view switch
        const vBtn = t.closest('.js-view');
        if(vBtn){ this._switchView(vBtn.dataset.view); return; }

        // inc/dec setpoint
        if(t.closest('.js-inc')){ this._adjustTemp(this._config.temp_step); return; }
        if(t.closest('.js-dec')){ this._adjustTemp(-this._config.temp_step); return; }

        // mode
        if(t.closest('.js-toggle')){ this._toggleHeat(); return; }
        if(t.closest('.js-mode')){ this._cycleHvacMode(); return; }

        // modal buttons
        if(t.closest('.js-save')){ this._saveEdit(); return; }
        if(t.closest('.js-cancel')){ this._closeModal(); return; }

        // add split on single-day empty area
        const tl = t.closest('.timeline');
        const block = t.closest('.time-block');
        if(tl && tl === this.$.timeline && !block){ this._addBreakpointFromClick(e, tl); return; }

        // block click (single or week)
        if(block){ this._startEditFromBlock(block); return; }

        // modal backdrop
        if(t === this.$.modal){ this._closeModal(); return; }
      };

      this._onKeyDown = (e) => { if(e.key === 'Escape' && this.$.modal.hasAttribute('open')) this._closeModal(); };

      this.shadowRoot.addEventListener('click', this._onClick);
      this.shadowRoot.addEventListener('keydown', this._onKeyDown);

      // Edit modal stepper
      this.shadowRoot.querySelector('.js-edit-inc').addEventListener('click', () => this._adjustEdit(this._config.temp_step));
      this.shadowRoot.querySelector('.js-edit-dec').addEventListener('click', () => this._adjustEdit(-this._config.temp_step));
    }

    // ----- Render -----
    _render(){
      const entity = this._entity();
      if(!entity){ this._setError(`Entity ${this._config.entity ?? ''} not found`); return; }
      this._clearError();

      // Header
      this.$.title.textContent = this._config.name;
      this.$.current.textContent = `${entity.attributes.current_temperature ?? '--'}°C`;

      // Controls
      this.$.temp.textContent = `${entity.attributes.temperature ?? '--'}°C`;
      this.$.mode.textContent = entity.state || 'unknown';
      this.$.toggle.setAttribute('aria-pressed', String(entity.state === 'heat' || entity.state === 'auto'));

      // Views
      if(this._currentView === 'single'){
        this.$.single.hidden = false; this.$.week.hidden = true;
        this._renderSingleDay();
      } else {
        this.$.single.hidden = true; this.$.week.hidden = false;
        this._renderWeek();
      }

      // Update tabs aria
      this.shadowRoot.querySelectorAll('.js-view').forEach(b => {
        const isActive = b.dataset.view === this._currentView;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', String(isActive));
      });
    }

    _renderSingleDay(){
      const day = this._currentDay;
      this.$.dayHeader.textContent = day[0].toUpperCase() + day.slice(1);
      this.$.timeline.dataset.day = day;
      this._fillTimeline(this.$.timeline, this._schedule[day] || [], day);
    }

    _renderWeek(){
      if(!this.$.weekDays.hasChildNodes()){
        const frag = document.createDocumentFragment();
        for(const d of DAYS){
          const row = document.createElement('div');
          row.className = 'week-day';
          row.innerHTML = `<div class="week-day-header">${DAY_SHORT[d]}</div><div class="week-timeline" data-day="${d}"></div>`;
          frag.appendChild(row);
        }
        this.$.weekDays.appendChild(frag);
      }
      this.$.weekDays.querySelectorAll('.week-timeline').forEach(tl => {
        const d = tl.dataset.day; this._fillTimeline(tl, this._schedule[d] || [], d);
      });
    }

    _fillTimeline(container, entries, day){
      container.textContent = '';
      if(!Array.isArray(entries) || entries.length === 0){
        container.insertAdjacentHTML('beforeend', `<div style="position:absolute;inset:0;display:grid;place-items:center;color:#aaa;font-size:.9rem;">No schedule</div>`);
        return;
      }
      const total = 24*60;
      const frag = document.createDocumentFragment();
      entries.forEach((e, idx) => {
        const start = this._toMin(e.start), stop = this._toMin(e.stop);
        const w = Math.max(0, stop - start) / total * 100;
        const l = start / total * 100;
        const block = document.createElement('div');
        block.className = 'time-block';
        block.style.width = w + '%';
        block.style.left  = l + '%';
        block.tabIndex = 0;
        block.setAttribute('role', 'button');
        block.dataset.index = String(idx);
        block.dataset.day = day;
        // map temp to hue (5°C blue -> 25°C red)
        const t = Number(e.temperature);
        const hue = 220 - Math.max(0, Math.min(1, (t - 5) / 20)) * 200;
        block.style.setProperty('--_h', hue.toFixed(0));
        block.textContent = (stop - start) > 90 ? `${t}°C` : '';
        frag.appendChild(block);
      });
      container.appendChild(frag);
    }

    // ----- Editing -----
    _startEditFromBlock(block){
      const day = block.dataset.day;
      const index = Number(block.dataset.index);
      const entry = (this._schedule[day] || [])[index];
      if(!entry) return;
      this._editing = { day, index, entry: { start: entry.start, stop: entry.stop, temperature: Number(entry.temperature) } };
      this.$.range.textContent = `${this._editing.entry.start} - ${this._editing.entry.stop}`;
      this.$.editTemp.textContent = `${this._editing.entry.temperature}°C`;
      this.$.modal.setAttribute('open', '');
    }

    _addBreakpointFromClick(e, timelineEl){
      const rect = timelineEl.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const minutes = Math.round(ratio * 24 * 60);
      const day = this._currentDay;
      const arr = this._schedule[day] || [];
      const idx = arr.findIndex(p => this._toMin(p.start) < minutes && minutes < this._toMin(p.stop));
      if(idx === -1) return; // boundary or no segment
      const seg = arr[idx];
      const mid = this._toTime(minutes);
      // split into two segments with same temperature
      const left = { start: seg.start, stop: mid, temperature: seg.temperature };
      const right = { start: mid, stop: seg.stop, temperature: seg.temperature };
      arr.splice(idx, 1, left, right);
      this._schedule[day] = arr;
      this._dispatchScheduleChange(day);
      this._render();
      // open editor on the new right segment
      const block = this.$.timeline.querySelector(`.time-block[data-index="${idx+1}"]`);
      if(block) this._startEditFromBlock(block);
    }

    _adjustEdit(delta){
      if(!this._editing) return;
      const cfg = this._config; const v = this._editing.entry.temperature + delta;
      const clamped = Math.max(cfg.min_temp, Math.min(cfg.max_temp, Number((v).toFixed(2))));
      const stepped = Math.round(clamped / cfg.temp_step) * cfg.temp_step;
      this._editing.entry.temperature = Number(stepped.toFixed(2));
      this.$.editTemp.textContent = `${this._editing.entry.temperature}°C`;
    }

    _saveEdit(){
      if(!this._editing) return;
      const { day, index, entry } = this._editing;
      if(!Array.isArray(this._schedule[day])) this._schedule[day] = [];
      this._schedule[day] = this._schedule[day].map((it, i) => i === index ? { ...entry } : it);
      this._dispatchScheduleChange(day);
      this._closeModal();
      this._render();
      if(this._isNow(entry)) this._setTemp(entry.temperature);
    }

    _closeModal(){ this.$.modal.removeAttribute('open'); this._editing = null; }

    // ----- Controls -----
    _adjustTemp(delta){
      const entity = this._entity(); if(!entity) return;
      const current = Number(entity.attributes.temperature ?? 20);
      const v = current + delta; const cfg = this._config;
      const clamped = Math.max(cfg.min_temp, Math.min(cfg.max_temp, Number((v).toFixed(2))));
      const stepped = Math.round(clamped / cfg.temp_step) * cfg.temp_step;
      this._setTemp(Number(stepped.toFixed(2)));
    }

    _setTemp(value){
      if(!this._hass) return;
      this._hass.callService('climate','set_temperature',{ entity_id: this._config.entity, temperature: value })
        .catch(err => this._setError(`Failed to set temperature: ${err?.message || err}`));
    }

    _cycleHvacMode(){
      const entity = this._entity(); if(!entity) return;
      const modes = entity.attributes.hvac_modes || ['off','heat','auto'];
      const idx = Math.max(0, modes.indexOf(entity.state));
      const next = modes[(idx + 1) % modes.length];
      this._hass?.callService('climate','set_hvac_mode',{ entity_id: this._config.entity, hvac_mode: next })
        .catch(err => this._setError(`Failed to set HVAC mode: ${err?.message || err}`));
    }

    _toggleHeat(){
      const entity = this._entity(); if(!entity) return;
      const newMode = entity.state === 'off' ? 'heat' : 'off';
      this._hass?.callService('climate','set_hvac_mode',{ entity_id: this._config.entity, hvac_mode: newMode })
        .catch(err => this._setError(`Failed to toggle HVAC mode: ${err?.message || err}`));
    }

    // ----- Persist via input_text -----
    async _pushScheduleToHA(day){
      const key = this._config.schedule_text_entity; if(!key || !this._hass) return;
      const value = this._buildTextFromSchedule();
      if (value.length > 255) {
        this._setError(`Schedule too long for input_text (${value.length}/255). Simplify blocks or group days.`);
        return;
      }
      try {
        await this._hass.callService('input_text','set_value',{ entity_id: key, value });
      } catch(e){ this._setError(`Failed to write input_text: ${e?.message || e}`); }
    }

    _dispatchScheduleChange(day){
      this.dispatchEvent(new CustomEvent('schedule-change',{ detail: { day, schedule: this._schedule[day] }, bubbles: true, composed: true }));
      this._pushScheduleToHA(day);
    }

    // ----- Codec (compact text <-> internal schedule) -----
    _parseTextSchedule(text){
      // Example input:
      // R=climate.wohnzimmer;WD=1-5(06:00@21,08:30@18,17:00@21,22:30@17)|6(08:00@21,23:00@17)|7(08:30@20,22:00@17)
      const out = {}; DAYS.forEach(d => out[d] = []);
      const wdMatch = String(text).trim().match(/WD=([^;]+)/i);
      if(!wdMatch) return out;

      const toMin = s => { const [h,m]=s.split(':').map(Number); return h*60+(m||0); };
      const toTime = n => String(Math.floor(n/60)).padStart(2,'0') + ':' + String(n%60).padStart(2,'0');

      const dayChanges = {1:[],2:[],3:[],4:[],5:[],6:[],7:[]};
      for (const block of wdMatch[1].split('|')) {
        const m = block.trim().match(/^(\d(?:-\d)?)\(([^)]*)\)$/);
        if(!m) continue;
        const [from,to] = m[1].includes('-') ? m[1].split('-').map(Number) : [Number(m[1]), Number(m[1])];
        const changes = m[2].split(',').map(s => s.trim()).filter(Boolean)
          .map(s => { const [time, t] = s.split('@'); return { time, temp: Number(t) }; });
        for (let i=from; i<=to; i++) dayChanges[i].push(...changes);
      }

      const idxToDay = i => DAYS[(i-1+7)%7]; // 1=Mon..7=Sun
      let lastTemp = 17;
      for (let i=1; i<=7; i++) {
        const changes = dayChanges[i].sort((a,b)=> toMin(a.time)-toMin(b.time));
        let cursor = 0, current = lastTemp; const segs = [];
        for (const ch of changes) {
          const t = toMin(ch.time);
          if (t > cursor) segs.push({ start: toTime(cursor), stop: toTime(t), temperature: current });
          current = ch.temp; cursor = t;
        }
        if (cursor < 1440) segs.push({ start: toTime(cursor), stop: '24:00', temperature: current });
        out[idxToDay(i)] = segs;
        lastTemp = current;
      }
      return out;
    }

    _buildTextFromSchedule(){
      // Build minimal change-lists per day, then compress day indices into ranges
      const dayToIdx = d => ({monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,sunday:7}[d]);
      const toMin = s => { const [h,m]=s.split(':').map(Number); return h*60+(m||0); };

      const changesByDay = {};
      let prevLast = null;
      for (const d of DAYS) {
        const segs = (this._schedule[d]||[]).slice().sort((a,b)=> toMin(a.start)-toMin(b.start));
        const ch = [];
        let lastT = prevLast;
        for (const s of segs) {
          const startMin = toMin(s.start);
          if (lastT === null) { lastT = s.temperature; if (startMin>0) ch.push({ time:s.start, temp:s.temperature }); }
          else if (s.temperature !== lastT) { ch.push({ time:s.start, temp:s.temperature }); lastT = s.temperature; }
        }
        prevLast = segs.length ? segs[segs.length-1].temperature : prevLast;
        changesByDay[d] = ch;
      }

      // Group identical patterns -> ranges
      const patternMap = new Map(); // 'HH:MM@T,...' -> [dayIndices]
      for (const d of DAYS) {
        const s = changesByDay[d].map(c => `${c.time}@${c.temp}`).join(',');
        const arr = patternMap.get(s) || [];
        arr.push(dayToIdx(d));
        patternMap.set(s, arr);
      }

      const toRanges = (arr) => {
        arr.sort((a,b)=>a-b);
        const out = [];
        let start = arr[0], prev = arr[0];
        for (let i=1;i<arr.length;i++){
          if (arr[i] === prev+1) { prev = arr[i]; continue; }
          out.push([start, prev]); start = prev = arr[i];
        }
        out.push([start, prev]);
        return out.map(([a,b]) => a===b ? `${a}` : `${a}-${b}`).join('|');
      };

      const wdParts = [];
      for (const [pat, idxs] of patternMap.entries()) {
        wdParts.push(`${toRanges(idxs)}(${pat})`); // pat may be '' if no changes
      }

      const R = `R=${this._config.entity}`; // keep for traceability; remove if you want to save a few chars
      const WD = `WD=${wdParts.join('|')}`;
      return `${R};${WD}`;
    }

    // ----- Helpers -----
    _toMin(str){ const [h,m] = String(str).split(':').map(Number); return (h*60) + (m||0); }
    _toTime(min){ const h=Math.floor(min/60), m=min%60; const pad=n=>String(n).padStart(2,'0'); return `${pad(h)}:${pad(m)}`; }
    _isNow(entry){ const n = new Date(); const cur = n.getHours()*60 + n.getMinutes(); const s = this._toMin(entry.start), e = this._toMin(entry.stop); return cur >= s && cur < e; }
    _entity(){ return this._hass?.states?.[this._config.entity]; }

    _getCurrentDay(){ return DAYS[(new Date().getDay()+6)%7]; /* convert Sun=0 to Sunday last */ }

    _defaultSchedule(){
      const base = [
        { start:'00:00', stop:'07:00', temperature:5 },
        { start:'07:00', stop:'09:30', temperature:21 },
        { start:'09:30', stop:'14:30', temperature:21 },
        { start:'14:30', stop:'21:00', temperature:21 },
        { start:'21:00', stop:'23:00', temperature:21.5 },
        { start:'23:00', stop:'24:00', temperature:5 },
      ];
      const sat = [
        { start:'00:00', stop:'07:30', temperature:5 },
        { start:'07:30', stop:'10:30', temperature:21 },
        { start:'10:30', stop:'19:00', temperature:21 },
        { start:'19:00', stop:'23:00', temperature:21.5 },
        { start:'23:00', stop:'24:00', temperature:5 },
      ];
      const sun = [...sat];
      return { monday:[...base], tuesday:[...base], wednesday:[...base], thursday:[...base], friday:[...base], saturday:sat, sunday:sun };
    }

    _switchView(view){ if(view !== 'single' && view !== 'week') return; this._currentView = view; this._render(); }
    _setError(msg){ this.$.error.textContent = msg || ''; }
    _clearError(){ this._setError(''); }
  }

  customElements.define('heizplan-card', HeizplanCard);

  // Home Assistant registration
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'heizplan-card', name: 'Heizplan Card', description: 'Interactive thermostat schedule card (input_text-only)' });

  console.info('%c  HEIZPLAN-CARD  %c  input_text-only  ', 'color: orange; font-weight: bold; background: black', 'color: white; font-weight: bold; background: dimgray');
})();
