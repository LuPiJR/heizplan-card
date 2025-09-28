# Heizplan Card v2 🏠🌡️

An advanced Home Assistant custom card for managing heating schedules with real-time temperature control and persistent schedule storage using input helpers.

## ✨ Features

- **Interactive Schedule Management**: Visual timeline with clickable time blocks
- **Multi-Room Support**: Individual temperature control for multiple rooms
- **Real-Time Updates**: Immediate thermostat control with schedule synchronization
- **Persistent Storage**: Save schedule changes using Home Assistant input helpers
- **Week/Day Views**: Switch between single day and full week schedule views
- **Intelligent Time Blocks**: Automatic period detection and temperature mapping
- **Modal Editing**: Click time blocks for detailed temperature adjustment
- **Responsive Design**: Clean, modern interface that adapts to your dashboard

## 🚀 Quick Start

### Prerequisites

- Home Assistant with HACS installed (or manual installation)
- A climate entity (thermostat)
- Basic knowledge of YAML configuration

### Installation

#### Method 1: HACS Installation (Recommended)
1. Go to HACS → Frontend
2. Click the menu (three dots) → Custom repositories
3. Add: `https://github.com/yourusername/heizplan-card` (Type: Lovelace)
4. Find "Heizplan Card v2" and install
5. Add the resource to your Lovelace resources

#### Method 2: Manual Installation
1. Download `dist/heizplan-card-v2.js` from the latest release
2. Copy to `/config/www/community/heizplan-card/heizplan-card-v2.js`
3. Add to your Lovelace resources:
   ```yaml
   resources:
     - url: /local/community/heizplan-card/heizplan-card-v2.js
       type: module
   ```

## 🔧 Complete Setup Guide

### Step 1: Create Input Helpers

The card uses Home Assistant input helpers to store your schedule data persistently. We provide pre-configured files that match your existing schedule structure.

#### Copy the Configuration Files

1. **Download/copy these files to your Home Assistant config directory:**
   - `heating_schedule_helpers.yaml` - Master controls and daily toggles
   - `heating_schedule_times.yaml` - Time periods for all days
   - `heating_schedule_temperatures.yaml` - Temperature values for all rooms/periods
   - `heating_schedule_templates.yaml` - Status sensors and current period detection

2. **Add includes to your `configuration.yaml`:**

```yaml
# Heating Schedule Input Helpers
input_boolean: !include heating_schedule_helpers.yaml
input_datetime: !include heating_schedule_times.yaml
input_number: !include heating_schedule_temperatures.yaml
template: !include heating_schedule_templates.yaml
```

**If you already have these sections**, you can either:
- Use `!include_dir_merge_named` to merge multiple files
- Manually copy the contents into your existing files
- Use separate subdirectories for organization

3. **Restart Home Assistant** or reload YAML configuration

#### What Gets Created

The input helpers recreate your exact schedule structure:

**Control Helpers:**
- `input_boolean.heat_schedule_enabled` - Master on/off
- `input_boolean.heat_schedule_monday_active` through `sunday_active`

**Time Period Helpers:**
- Weekday periods (Mon-Thu): 6 time periods
- Friday periods: 6 time periods (with special evening period)
- Weekend periods (Sat-Sun): 5 time periods

**Temperature Helpers (per room, per period):**
- `input_number.heat_weekday_period1_lukas_park`
- `input_number.heat_weekday_period1_kueche`
- `input_number.heat_weekend_period2_guest`
- ...and many more for all room/period combinations

**Template Sensors:**
- `binary_sensor.heat_schedule_active_now` - True when schedule is active
- `sensor.current_heat_schedule_period` - Shows current period name

### Step 2: Configure the Card

Add the card to your Lovelace dashboard:

#### Legacy Vanilla Card (`custom:heizplan-card`)

```yaml
type: custom:heizplan-card
entity: climate.hk_kuche
name: "Küche Heizplan"
schedule_text_entity: input_text.heizplan_schedule
min_temp: 5
max_temp: 30
temp_step: 0.5
```

> The vanilla JavaScript card stores its schedule in a single `input_text` helper referenced by `schedule_text_entity`. It does not accept `room_temp_key` or persistence blocks.

#### LitElement Card (`custom:heizplan-card-v2`)

```yaml
type: custom:heizplan-card-v2
entity: climate.hk_kuche
name: "Küche Heizplan"
min_temp: 5
max_temp: 30
temp_step: 0.5
room_temp_key: T_kueche
persistence:
  domain: input_number
  service: set_value
  include_entity: true
  schedule_key: value
  data: {}
debug: false
```

### Step 3: Verify Setup

1. **Check input helpers were created:**
   - Go to Settings → Devices & Services → Helpers
   - Look for helpers starting with "heat_"

2. **Test the card:**
   - Temperature +/- buttons should update thermostat immediately
   - Modal editing (click time blocks) should save to input helpers
   - Room selector should show your available rooms

3. **Monitor debug output** (if `debug: true`):
   - Browser console shows detailed operation logs
   - Service call details and entity mappings

## 📖 Configuration Reference

### LitElement Card (`custom:heizplan-card-v2`)

| Option | Type | Default | Required | Description |
|--------|------|---------|----------|-------------|
| `entity` | string | - | ✅ | Your climate entity ID |
| `name` | string | "Heizplan" | ❌ | Card title displayed in header |
| `min_temp` | number | 5 | ❌ | Minimum temperature limit |
| `max_temp` | number | 30 | ❌ | Maximum temperature limit |
| `temp_step` | number | 0.5 | ❌ | Temperature adjustment increment |
| `room_temp_key` | string | "default_room" | ❌ | Primary room identifier |
| `persistence` | object | - | ✅ | Storage configuration |
| `debug` | boolean | false | ❌ | Enable detailed logging |

### Legacy Vanilla Card (`custom:heizplan-card`)

| Option | Type | Default | Required | Description |
|--------|------|---------|----------|-------------|
| `entity` | string | - | ✅ | Climate entity controlled by the card |
| `name` | string | "Heizplan" | ❌ | Card title displayed in header |
| `min_temp` | number | 5 | ❌ | Minimum temperature limit |
| `max_temp` | number | 30 | ❌ | Maximum temperature limit |
| `temp_step` | number | 0.5 | ❌ | Temperature adjustment increment |
| `schedule_text_entity` | string | - | ✅ | `input_text` helper used to persist the schedule |

### Persistence Configuration

| Option | Type | Default | Required | Description |
|--------|------|---------|----------|-------------|
| `domain` | string | - | ✅ | Must be `input_number` |
| `service` | string | - | ✅ | Must be `set_value` |
| `include_entity` | boolean | true | ❌ | Include entity_id in calls |
| `schedule_key` | string | "value" | ❌ | Parameter name (use "value") |
| `data` | object | {} | ❌ | Additional service data |

### Room Configuration

The card supports these rooms (matching your Bosch.md configuration):

| Room Key | Display Name | Description |
|----------|--------------|-------------|
| `T_lukas_park` | Lukas Park | Main room |
| `T_lukas_kirche` | Lukas Kirche | Secondary room |
| `T_lukas_schillerstr` | Lukas Schillerstr | Third room |
| `T_kueche` | Küche | Kitchen |
| `T_philip` | Philip | Philip's room |
| `T_guest` | Guest | Guest room |

## 🎯 How It Works

### Temperature Update Flow

1. **User adjusts temperature** via +/- buttons or modal
2. **Thermostat updates immediately** for instant comfort
3. **Card determines current time period** and room
4. **Appropriate input helper is updated** with new temperature
5. **Changes persist** across Home Assistant restarts

### Input Helper Mapping

The card automatically maps your actions to specific input helpers:

```
Example: Kitchen temperature adjustment on Monday at 08:00
↓
Current period: Weekday Period 2 (07:00-09:30)
Current room: T_kueche → kueche
↓
Target entity: input_number.heat_weekday_period2_kueche
↓
Service call: input_number.set_value
  entity_id: input_number.heat_weekday_period2_kueche
  value: 21.5
```

### Schedule Structure

**Time Periods by Day Type:**

- **Weekdays (Mon-Thu)**: 6 periods
  - Period 1: 00:00-07:00 (5°C all rooms)
  - Period 2: 07:00-09:30 (21°C most, 20°C guest)
  - Period 3: 09:30-14:30 (21°C most, 20°C guest)
  - Period 4: 14:30-21:00 (21°C most, 20°C guest)
  - Period 5: 21:00-23:00 (21.5°C most, 20°C guest)
  - Period 6: 23:00-24:00 (5°C all rooms)

- **Friday**: 6 periods (same as weekdays except Period 5 = 21°C not 21.5°C)

- **Weekend (Sat-Sun)**: 5 periods
  - Period 1: 00:00-07:30 (5°C all rooms)
  - Period 2: 07:30-10:30 (21°C most, 20°C guest)
  - Period 3: 10:30-19:00 (21°C most, 20°C guest)
  - Period 4: 19:00-23:00 (21.5°C most, 20°C guest)
  - Period 5: 23:00-23:59:59 (5°C all rooms)

## 🔍 Troubleshooting

### Common Issues

#### "Failed to save schedule" errors

**Problem**: Temperature changes don't persist
**Solutions**:
1. Verify persistence configuration:
   ```yaml
   persistence:
     domain: input_number     # Must be exactly this
     service: set_value      # Must be exactly this
     include_entity: true    # Required
     schedule_key: value     # Must be exactly this
   ```

2. Check that input helpers exist:
   - Go to Settings → Devices & Services → Helpers
   - Look for `input_number.heat_*` entities

3. Verify entity naming matches expected pattern:
   - `input_number.heat_weekday_period1_kueche`
   - `input_number.heat_weekend_period2_guest`
   - etc.

#### "Service unavailable" errors

**Problem**: "Cannot persist schedule: service input_number.set_value is unavailable"
**Solutions**:
1. Check input helpers are properly loaded
2. Restart Home Assistant after adding helpers
3. Verify YAML syntax in configuration files
4. Check Home Assistant logs for YAML parsing errors

#### Room selection issues

**Problem**: "No rooms available in the schedule"
**Solutions**:
1. Ensure temperature input helpers exist for your rooms
2. _(V2)_ Verify `room_temp_key` matches your room naming
3. _(V1)_ Confirm `schedule_text_entity` points to the intended `input_text`
4. Check that helpers follow naming convention: `heat_[period]_[room]`

#### Temperature changes reset after reload

**Problem**: Changes don't survive browser refresh
**Solutions**:
1. Confirm all input helpers are created
2. Verify persistence configuration is complete
3. Check browser console for JavaScript errors
4. Enable debug mode for detailed logging

### Debug Mode

Enable comprehensive debugging:

```yaml
type: custom:heizplan-card-v2
entity: climate.hk_kuche
debug: true  # Enable detailed logging
persistence:
  domain: input_number
  service: set_value
  include_entity: true
  schedule_key: value
```

**Debug information appears in:**
- Browser Developer Console (F12 → Console)
- Home Assistant notification area
- Card status messages

**Typical debug output:**
```
[heizplan-card] Generated entity_id: input_number.heat_weekday_period2_kueche for day=monday, period=1, room=T_kueche
[heizplan-card] Calling input_number.set_value with payload: {entity_id: "input_number.heat_weekday_period2_kueche", value: 21.5}
[heizplan-card] Successfully updated input_number.heat_weekday_period2_kueche to 21.5°C
```

### Validation Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "You must define a climate entity" | Missing `entity` | Add valid climate entity ID |
| "expected float for dictionary value" | Wrong persistence setup | Use `input_number.set_value` config |
| "No current time block found" | Outside schedule periods | Check time period configuration |
| "No room selected, cannot update" | Room mapping issue | Verify room configuration |

## 🚀 Advanced Configuration

### Multiple Cards for Different Rooms

```yaml
# Kitchen Card
type: custom:heizplan-card-v2
entity: climate.hk_kuche
name: "Kitchen Heating"
room_temp_key: T_kueche
persistence:
  domain: input_number
  service: set_value
  include_entity: true
  schedule_key: value

---

# Living Room Card
type: custom:heizplan-card-v2
entity: climate.hk_wohnzimmer
name: "Living Room Heating"
room_temp_key: T_wohnzimmer
persistence:
  domain: input_number
  service: set_value
  include_entity: true
  schedule_key: value
```

### Custom Styling

```yaml
type: custom:heizplan-card-v2
entity: climate.hk_kuche
name: "Kitchen"
persistence:
  domain: input_number
  service: set_value
  include_entity: true
  schedule_key: value
card_mod:
  style: |
    ha-card {
      --primary-color: #ff6b6b;
      --card-background-color: #2c3e50;
      --primary-text-color: #ecf0f1;
    }
```

### Integration with Automations

Use the template sensors in automations:

```yaml
# Automation to react to schedule changes
automation:
  - alias: "Heating Schedule Changed"
    trigger:
      - platform: state
        entity_id: sensor.current_heat_schedule_period
    condition:
      - condition: state
        entity_id: binary_sensor.heat_schedule_active_now
        state: 'on'
    action:
      - service: notify.mobile_app
        data:
          message: "Heating period changed to: {{ trigger.to_state.state }}"
```

### Custom Room Setup

To add your own rooms, modify the temperature helpers:

```yaml
# Add to heating_schedule_temperatures.yaml
input_number:
  heat_weekday_period1_my_new_room:
    name: "Weekday Period 1 - My New Room"
    min: 5
    max: 30
    step: 0.5
    initial: 20
    unit_of_measurement: "°C"
    icon: mdi:thermometer
  # ... repeat for all periods
```

Then update your card configuration:
```yaml
room_temp_key: T_my_new_room
```

## 📚 File Structure

Your setup should look like this:

```
/config/
├── configuration.yaml                    # Main config with includes
├── heating_schedule_helpers.yaml         # Control switches
├── heating_schedule_times.yaml          # Time periods
├── heating_schedule_temperatures.yaml   # Temperature values
├── heating_schedule_templates.yaml      # Status sensors
└── www/
    └── community/
        └── heizplan-card/
            └── heizplan-card-v2.js      # Card file
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/yourusername/heizplan-card
cd heizplan-card
npm install
npm run build
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Home Assistant community for inspiration and support
- LitElement for the web component framework
- Original Bosch thermostat integration

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/heizplan-card/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/heizplan-card/discussions)
- **Community**: [Home Assistant Community Forum](https://community.home-assistant.io/)

---

**Made with ❤️ for smart home automation**