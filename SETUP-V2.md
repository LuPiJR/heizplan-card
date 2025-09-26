# Heizplan Card V2 - LitElement Setup Guide

## Overview

Heizplan Card V2 is a complete rewrite using LitElement, providing the same functionality as V1 with improved performance, better maintainability, and modern TypeScript architecture.

## Key Improvements in V2

- **LitElement Foundation**: Modern reactive component architecture
- **TypeScript**: Full type safety and better IDE support
- **Reactive Properties**: Automatic UI updates when state changes
- **Efficient Rendering**: Only updates changed parts of the UI
- **Better Performance**: Optimized rendering and event handling
- **Modern Build System**: TypeScript compilation with Rollup bundling

## Installation

### Method 1: Pre-built Version (Recommended)

1. **Download the built file** from releases or build locally
2. **Copy to Home Assistant**
   ```bash
   cp dist/heizplan-card-v2.js /config/www/heizplan-card/
   ```

3. **Add Resource to Home Assistant**
   - Go to **Settings** → **Dashboards** → **Resources**
   - Click **Add Resource**
   - URL: `/local/heizplan-card/heizplan-card-v2.js`
   - Resource type: **JavaScript Module**

### Method 2: Build from Source

1. **Install Node.js** (v18 or later)

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Copy built file to Home Assistant**
   ```bash
   cp dist/heizplan-card-v2.js /config/www/heizplan-card/
   ```

## Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development mode**
   ```bash
   npm run dev
   ```

3. **Watch for changes** and copy to HA for testing
   ```bash
   # In another terminal
   fswatch -o dist/heizplan-card-v2.js | xargs -n1 -I{} cp dist/heizplan-card-v2.js /config/www/heizplan-card/
   ```

## Card Configuration

### Basic Configuration
```yaml
type: custom:heizplan-card-v2
entity: climate.hk_kuche
name: "Küche Heizplan"
room_temp_key: T_kueche
```

> 💾 **Important:** without configuring a persistence helper the card only keeps edits in memory. Add a `persistence` block so schedule changes are written somewhere Home Assistant can reload.

### Advanced Configuration
```yaml
type: custom:heizplan-card-v2
entity: climate.hk_kuche
name: "Küche Heizplan"
room_temp_key: T_kueche
schedule_entity: schedule.heizung_schedule

# Temperature limits
min_temp: 5
max_temp: 30
temp_step: 0.5

# Optional: Manual schedule override
schedule:
  monday:
    - { start: "00:00", stop: "07:00", temperature: 5 }
    - { start: "07:00", stop: "09:30", temperature: 21 }
    # ... rest of schedule

# CSS custom properties for theming
style: |
  heizplan-card-v2 {
    --temp-cold-color: #175e7f;
    --temp-medium-color: #f39c12;
    --temp-hot-color: #c0392b;
    --primary-color: #f39c12;
  }
```

### Supported persistence backends

Use persistence targets that accept JSON/text payloads when saving schedules:

- `input_text.set_value`
- `variable.set_variable`
- `python_script` (custom logic for storing the schedule)
- `rest_command` or comparable services that accept structured data

⚠️ **Avoid numeric helpers** such as `input_number.set_value` or `number.set_value`. They only handle single numeric values and the card will refuse to send schedules to them.

## Features

### All V1 Features Included
- ✅ **Automatic schedule loading** from Home Assistant
- ✅ **Single day and week views** with German weekday names (Mo, Di, Mi...)
- ✅ **Interactive temperature editing** by clicking timeline blocks
- ✅ **Manual thermostat control** with +/- buttons
- ✅ **HVAC mode switching** (off/heat toggle + cycle modes)
- ✅ **Real-time updates** when thermostat changes
- ✅ **Multi-room support** for complex heating systems
- ✅ **Visual timeline** with color-coded temperature zones
- ✅ **Error handling** and user feedback

### V2 Enhancements
- ⚡ **Better Performance**: Efficient reactive updates
- 🔧 **TypeScript**: Full type safety and IntelliSense
- 🎯 **Precise Rendering**: Only updates changed elements
- 🛡️ **Improved Error Handling**: Better error reporting
- 📝 **Better Documentation**: Full TypeScript interfaces
- 🔄 **Reactive Properties**: Automatic UI synchronization

## TypeScript Interfaces

```typescript
interface HeizplanCardConfig {
  entity: string;              // Required: thermostat entity ID
  name?: string;               // Display name
  min_temp?: number;           // Minimum temperature (default: 5)
  max_temp?: number;           // Maximum temperature (default: 30)
  temp_step?: number;          // Temperature step (default: 0.5)
  schedule?: Schedule;         // Manual schedule override
  schedule_entity?: string;    // HA schedule entity ID
  room_temp_key?: string;      // Room key for multi-room setups
}

interface Schedule {
  [day: string]: ScheduleEntry[];
}

interface ScheduleEntry {
  start: string;               // "HH:MM" format
  stop: string;                // "HH:MM" format
  temperature: number;         // Temperature in °C
}
```

## Migration from V1

### Automatic Migration
V2 uses the same configuration format as V1, so you can simply:

1. **Install V2** following the setup instructions above
2. **Change card type** in your dashboard:
   ```yaml
   # Change this:
   type: custom:heizplan-card

   # To this:
   type: custom:heizplan-card-v2
   ```
3. **Keep all other settings** exactly the same

### Benefits After Migration
- **Faster UI updates** when editing schedules
- **Better error messages** if something goes wrong
- **More consistent behavior** across different browsers
- **Future-proof architecture** for new features

## Build Scripts

```bash
npm run build      # Build for production
npm run dev        # Development mode with watch
npm run lint       # Check TypeScript/ESLint issues
npm run format     # Format code with Prettier
```

## Browser Compatibility

- **Modern Browsers**: Chrome 79+, Firefox 72+, Safari 13.1+, Edge 79+
- **Home Assistant**: Supports all HA-supported browsers
- **Mobile**: Full support on iOS Safari and Android Chrome

## Troubleshooting

### Common Issues

1. **Card not loading**
   ```
   Check browser console for TypeScript/module errors
   Verify resource URL points to v2 file
   ```

2. **Schedule not loading**
   ```
   Same debugging as V1 - check browser console
   Verify schedule_entity exists in HA
   ```

3. **TypeScript errors during build**
   ```bash
   npm run lint  # Check for type issues
   ```

4. **Performance issues**
   ```
   V2 should be faster than V1
   Check for browser extensions interfering
   ```

## Development Notes

### Architecture Changes
- **Reactive Properties**: Use `@state()` for internal state, `@property()` for external props
- **Render Method**: All HTML in `render()`, no manual DOM manipulation
- **Event Handling**: Lit's `@click=${handler}` syntax
- **Styling**: Static `css` tagged template literals
- **Lifecycle**: Use `updated()` instead of manual update calls

### Adding New Features
1. Add state properties with `@state()`
2. Update render methods to include new UI
3. Add event handlers following Lit patterns
4. Update TypeScript interfaces as needed

## Future Roadmap

- **Home Assistant 2024+ integration** features
- **Advanced scheduling** (multiple temperature zones per day)
- **Energy monitoring** integration
- **Preset management** (vacation mode, etc.)
- **Mobile-optimized** editing interface

## Support

For issues with V2 specifically, please provide:
- Home Assistant version
- Browser and version
- TypeScript/build errors (if building from source)
- Browser console errors
- Configuration YAML

V2 maintains full compatibility with V1 configurations while providing a modern, maintainable foundation for future enhancements.