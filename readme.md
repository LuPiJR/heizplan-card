# Heizplan Card - Home Assistant Setup Guide

## Installation Methods

### Method 1: Manual Installation (Recommended for Development)

1. **Copy Files to Home Assistant**
   ```bash
   # Copy the entire folder to your HA config directory
   cp -r /path/to/HeizplanCard /config/www/heizplan-card/
   ```

2. **Add Resource to Home Assistant**
   - Go to **Settings** → **Dashboards** → **Resources** (top right menu)
   - Click **Add Resource**
   - URL: `/local/heizplan-card/heizplan-card.js`
   - Resource type: **JavaScript Module**

### Method 2: HACS Installation (Future)
*Will be available once packaged for HACS distribution*

## Card Configuration

### Basic Configuration (Recommended)
**The card will automatically load your schedule from `configuration.yaml`!**

Add this simple configuration to your Lovelace dashboard:

```yaml
type: custom:heizplan-card
entity: climate.hk_kuche  # Your thermostat entity
name: "Küche Heizplan"
room_temp_key: T_kueche  # Which room from your multi-room schedule
```

That's it! The card will automatically find and load your `schedule.heizung_schedule` from your Home Assistant configuration.

### Manual Configuration (If automatic loading fails)
If the automatic schedule loading doesn't work, you can manually specify the schedule:

```yaml
type: custom:heizplan-card
entity: climate.hk_kuche
name: "Küche Heizplan"
room_temp_key: T_kueche

# Manual schedule (copy from your configuration.yaml if needed)
schedule:
  monday:
    - { start: "00:00", stop: "07:00", temperature: 5 }
    - { start: "07:00", stop: "09:30", temperature: 21 }
    # ... rest of schedule
```

### Advanced Configuration
```yaml
type: custom:heizplan-card
entity: climate.hk_kuche
name: "Küche Heizplan"
schedule_entity: schedule.heizung_schedule  # Your HA schedule entity
room_temp_key: T_kueche  # Which room from your multi-room schedule

# Temperature limits (matches your thermostat)
min_temp: 5
max_temp: 30
temp_step: 0.5

# Alternative rooms you can monitor
# room_temp_key: T_lukas_park
# room_temp_key: T_guest
# room_temp_key: T_philip

# CSS custom properties for theming
style: |
  ha-card {
    --temp-cold-color: #175e7f;      # 5°C (blue)
    --temp-medium-color: #f39c12;    # 17°C (orange)
    --temp-warm-color: #e67e22;      # 20°C (orange-red)
    --temp-hot-color: #c0392b;       # 21°C (red)
    --temp-very-hot-color: #a93226;  # 21.5°C (dark red)
  }
```

## Required Home Assistant Setup

### 1. Helper Entities (Optional - for advanced schedule storage)
If you want schedules stored in HA entities:

```yaml
# Add to configuration.yaml
input_datetime:
  heizplan_monday_1_start:
    name: "Monday Schedule 1 Start"
    has_time: true
  heizplan_monday_1_end:
    name: "Monday Schedule 1 End"
    has_time: true

input_number:
  heizplan_monday_1_temp:
    name: "Monday Schedule 1 Temperature"
    min: 5
    max: 30
    step: 0.5
    unit_of_measurement: "°C"
```

### 2. Automation Template (Optional - for schedule enforcement)
The card can generate automations, or you can create them manually:

```yaml
# Add to automations.yaml
- id: heizplan_monday_morning
  alias: "Heizplan: Monday Morning"
  trigger:
    - platform: time
      at: "07:00:00"
  condition:
    - condition: time
      weekday:
        - mon
  action:
    - service: climate.set_temperature
      target:
        entity_id: climate.hk_kuche
      data:
        temperature: 17
```

## Troubleshooting

### Card Not Loading
1. **Check browser console** for JavaScript errors
2. **Verify file path**: Ensure `/local/heizplan-card/heizplan-card.js` exists
3. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
4. **Check resource URL**: Must start with `/local/`

### Thermostat Not Responding
1. **Verify entity ID**: Check in Developer Tools → States
2. **Test service call**: Use Developer Tools → Services:
   ```yaml
   service: climate.set_temperature
   target:
     entity_id: climate.hk_kuche
   data:
     temperature: 20
   ```

### Schedule Not Working
1. **Check automations**: Verify they're enabled
2. **Test time triggers**: Check automation traces
3. **Verify entity states**: Helper entities should update

## File Structure
Your Home Assistant setup should look like:
```
/config/
  ├── www/
  │   └── heizplan-card/
  │       ├── heizplan-card.js     # Main card file
  │       └── README.md
  ├── configuration.yaml           # Helper entities (optional)
  └── automations.yaml            # Schedule automations (optional)
```

## Development/Testing Mode

For development, you can:

1. **Enable HACS Developer Mode**
   - HACS → Integrations → Custom repositories
   - Add your local repository

2. **Use file watcher** for auto-reload:
   ```bash
   # Watch for changes and copy to HA
   fswatch -o heizplan-card.js | xargs -n1 -I{} cp heizplan-card.js /config/www/heizplan-card/
   ```

3. **Browser dev tools**: Monitor console for errors and debug

## Next Steps
1. Install the card using Method 1
2. Add basic configuration to your dashboard
3. Test temperature control functionality
4. Customize schedule and styling as needed