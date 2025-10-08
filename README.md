# Device Farm

A comprehensive Custom Device Lab with Web Interface for **both Android and iOS devices**, featuring real-time monitoring, device control, session management, and supports mobile apps automation testing with CICD integration.

## Why Device Farm?

Modern mobile development teams face significant challenges when testing applications across diverse device ecosystems. Device Farm addresses these challenges by providing a centralized, scalable, and cost-effective solution for managing and accessing physical and virtual mobile devices.

### The Traditional Testing Approach Falls Short

**Device Fragmentation**: With 100+ Android models and 20+ iOS devices in the market, ensuring app compatibility requires access to a wide range of devices.

**Physical Access Limitations**: Teams often struggle with devices scattered across locations, requiring physical handovers that slow down testing cycles.

**Resource Conflicts**: Multiple QA engineers competing for the same devices creates bottlenecks and delays.

**High Operational Costs**: Purchasing, maintaining, and managing a physical device lab is expensive and resource-intensive.

## Current Challenges in Mobile Testing

### 1. **Device Accessibility**
- Devices assigned to specifc engineeer which can be used only by one 
- No access for remote or distributed teams
- Waiting time for device availability
- Physical device handover coordination

### 2. **Testing Efficiency**
- Manual device setup and configuration
- Limited parallel testing capabilities
- No centralized monitoring or logging
- Difficult to reproduce test conditions

### 3. **Team Collaboration**
- No visibility into device availability
- Lack of reservation and scheduling system
- Difficulty tracking device usage
- No session management or audit trails

### 4. **Automation Limitations**
- Manual Appium server setup per device
- Complex configuration management
- Limited CI/CD integration
- Inconsistent test environments

### 5. **Cost Management**
- High upfront investment in device procurement for new joinees

## Uses & Advantages

### 🧪 **For QA & Testing**
- **Comprehensive Coverage**: Test across entire device matrix (Android + iOS)
- **Automated Testing**: Integrated Appium support for CI/CD pipelines
- **Parallel Testing**: Run tests on multiple devices simultaneously without local setup
- **Session Tracking**: Monitor who tested what, when, and for how long
- **Bug Reproduction**: Quickly access specific device configurations

### ⚡ **Operational Efficiency**
- **5x Faster Access**: No physical device handover required
- **24/7 Availability**: Access devices anytime, anywhere
- **Zero Conflicts**: Smart reservation system prevents device conflicts
- **Centralized Management**: Single interface for all devices
- **Real-time Monitoring**: Track device health, battery, and status

### 🔧 **DevOps & Automation**
- **CI/CD Integration**: RESTful API for automated testing workflows
- **Appium Ready**: Pre-configured servers with auto-start capability
- **Consistent Environment**: Reproducible test conditions every time
- **API-Driven**: Automate device reservation, testing, and release
- **Webhook Support**: Integrate with existing DevOps tools

### 💰 **Cost-Effective Solution**
- **Cost Reduction**: Compared to traditional device labs
- **Better Utilization**: Achieve 85% device utilization 
- **No Shipping Costs**: Centralized location eliminates shipping expenses
- **Extended Device Life**: Better care and management prolongs device lifespan
- **Scalable Infrastructure**: Add devices as needed without major infrastructure changes

## Device Farm Features

### 🏗️ **Device Management**
- **Cross-Platform Support**: Full support for both Android and iOS devices
- **Automatic Discovery**: Automatically detect connected devices
  - Android devices via ADB
  - iOS physical devices via libimobiledevice
  - iOS Simulators via Xcode
- **Real-time Status**: Monitor device status, battery level, and connection state
- **Device Information**: View detailed device specs including model, OS version, and capabilities
- **Unified Management**: Single interface for managing all devices regardless of platform

### 🎮 **Remote Device Control**
- **Screen Interaction**: Take screenshots and interact with devices through web interface
- **Touch Input**: Tap, swipe, and gesture control directly from the browser (Android & iOS)
- **Virtual Keys**: Hardware buttons simulation
  - Android: Home, Back, Menu, Volume
  - iOS: Home, Lock, Volume
- **Text Input**: Send text to devices remotely
- **Shell Commands**: Execute shell commands with history
  - Android: ADB shell commands
  - iOS: iOS device commands

### 📊 **Monitoring & Analytics**
- **System Health**: Monitor CPU, memory usage, and system uptime
- **Real-time Logs**: Live device logs with filtering and search
- **Usage Analytics**: Device utilization statistics and session analytics
- **Performance Metrics**: Track device usage patterns and peak hours

### 🔒 **Session Management**
- **Device Reservation**: Reserve devices for specific users and time periods
- **Session Control**: Start, monitor, and end device sessions
- **Queue Management**: Organize device access and prevent conflicts
- **User Management**: Track user sessions and device assignments

### 🤖 **Appium Integration**
- **Automated Testing**: Full Appium server integration for test automation
- **Dynamic Server Management**: Automatic Appium server spawning per device
- **Auto-start Workflow**: Device reservation can automatically start Appium server
- **Port Management**: Automatic port allocation (4723-4823 range)
- **Cross-Platform Testing**: Support for both Android and iOS automation

### 🌐 **Web Interface**
- **Modern UI**: Responsive design built with React and Tailwind CSS
- **Real-time Updates**: WebSocket-based live updates for all device changes
- **Dashboard**: Comprehensive overview of device farm status
- **Mobile Friendly**: Works on desktop, tablet, and mobile devices

## Platform Support

| Feature | Android | iOS |
|---------|---------|-----|
| **Physical Devices** | ✅ Via ADB | ✅ Via libimobiledevice (macOS only) |
| **Emulators/Simulators** | ✅ Android Emulator | ✅ iOS Simulator (macOS only) |
| **Remote Control** | ✅ Tap, swipe, keys | ✅ Tap, swipe, keys |
| **Screenshots** | ✅ | ✅ |
| **Shell Commands** | ✅ ADB shell | ✅ iOS commands |
| **Appium Integration** | ✅ UiAutomator2 | ✅ XCUITest |
| **Device Discovery** | ✅ Automatic | ✅ Automatic |
| **Session Management** | ✅ | ✅ |
| **Real-time Monitoring** | ✅ | ✅ |

**Note**: iOS support requires macOS. Linux and Windows hosts can only manage Android devices.

## Architecture

```
┌─────────────────┐    WebSocket/REST    ┌──────────────────┐
│   Web Frontend  │◄────────────────────►│  Backend Server  │
│   (React/TS)    │                      │   (Node.js/TS)   │
└─────────────────┘                      └──────────────────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                              ▼                     ▼                     ▼
                    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
                    │  DeviceService   │  │ AppiumService    │  │ WebSocketService │
                    │   (Unified)      │  │  (Per Device)    │  │  (Real-time)     │
                    └──────────────────┘  └──────────────────┘  └──────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌──────────────────┐          ┌──────────────────┐
    │    ADBClient     │          │    IOSClient     │
    │  (Android Mgmt)  │          │   (iOS Mgmt)     │
    └──────────────────┘          └──────────────────┘
              │                               │
    ┌─────────┼─────────┐         ┌──────────┼──────────┐
    ▼         ▼         ▼         ▼          ▼          ▼
┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐
│Android 1││Android 2││Android N││ iOS 1   ││ iOS 2   ││ iOS N   │
│ Device  ││ Device  ││ Device  ││ Device  ││Simulator││ Device  │
└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘
```

## API Documentation

### Device Endpoints

```http
GET    /api/devices              # List all devices
GET    /api/devices/:id          # Get device details
POST   /api/devices/refresh      # Refresh device list
POST   /api/devices/:id/reserve  # Reserve device
POST   /api/devices/:id/release  # Release device
POST   /api/devices/:id/screenshot  # Take screenshot
POST   /api/devices/:id/tap      # Send tap command
POST   /api/devices/:id/swipe    # Send swipe command
POST   /api/devices/:id/key      # Send key event
POST   /api/devices/:id/text     # Send text input
POST   /api/devices/:id/shell    # Execute shell command
```

### Session Endpoints

```http
GET    /api/sessions             # List sessions
POST   /api/sessions             # Create session
GET    /api/sessions/:id         # Get session details
POST   /api/sessions/:id/end     # End session
```

### System Endpoints

```http
GET    /api/system/health        # System health status
GET    /api/system/stats         # Device statistics
GET    /api/system/reservations  # List reservations
```

### Appium Endpoints

```http
GET    /api/appium/servers                    # List all Appium servers
POST   /api/appium/start                      # Start Appium server for device
POST   /api/appium/stop/:deviceId             # Stop Appium server
GET    /api/appium/status/:deviceId           # Get Appium server status
POST   /api/devices/:id/appium/auto-start     # Reserve device + start Appium
```

### Analytics Endpoints

```http
GET    /api/analytics/usage                   # Device usage analytics
GET    /api/analytics/sessions                # Session statistics
GET    /api/analytics/devices/:id/history     # Device usage history
```

### WebSocket Events

```javascript
// Client to Server
'device:reserve'     // Reserve device
'device:release'     // Release device
'device:screenshot'  // Take screenshot
'device:command'     // Execute command
'devices:refresh'    // Refresh device list

// Server to Client
'devices:list'       // Updated device list
'device:updated'     // Device status changed
'device:log'         // New device log
'system:health'      // System health update
```

## Prerequisites

### Required for All Platforms
- **Node.js** 18+ and npm
- **Appium** globally installed: `npm install -g appium`
- **Chrome/Firefox** modern browser for web interface

### For Android Devices
- **Android SDK** with `adb` in PATH
- **Android devices** with USB debugging enabled
- Connected via USB with debugging authorized

### For iOS Devices (macOS only)
- **Xcode** with iOS Simulator support
- **libimobiledevice** for physical iOS devices: `brew install libimobiledevice`
- **iOS devices** with Developer mode enabled (for physical devices)
- Trust relationship established between Mac and iOS devices

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd DeviceFarm

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# Backend configuration
cp backend/.env.example backend/.env
# Edit backend/.env as needed

# Frontend configuration
cp frontend/.env.example frontend/.env
# Edit frontend/.env as needed
```

### 3. Connect Devices

#### For Android Devices:
1. Enable **Developer Options** on your Android devices
2. Enable **USB Debugging**
3. Connect devices via USB
4. Accept debugging prompts on devices

```bash
# Verify ADB can see devices
adb devices

# Should show:
List of devices attached
device_serial_1    device
device_serial_2    device
```

#### For iOS Devices (macOS only):
1. Enable **Developer Mode** on your iOS devices (Settings > Privacy & Security > Developer Mode)
2. Connect devices via USB and trust the computer when prompted
3. For simulators, ensure Xcode is installed

```bash
# Verify libimobiledevice can see physical devices
idevice_id -l

# List available iOS simulators
xcrun simctl list devices available
```

### 4. Start the Application

```bash
# Start both backend and frontend
npm run dev

# Or start separately:
npm run dev:backend  # Backend: http://localhost:5000
npm run dev:frontend # Frontend: http://localhost:3000
```

### 5. Access the Web Interface

Open your browser to **http://localhost:3000**

You should see:
- Connected devices in the dashboard
- Real-time device status updates
- Interactive device control interface

## Usage Guide

### Device Control

1. **View Devices**: Navigate to "Devices" to see all connected devices
2. **Reserve Device**: Click "Reserve" to claim a device for your session
3. **Control Device**:
   - Click "View" to open device control interface
   - Take screenshots to see current screen
   - Click on screenshot to simulate taps
   - Use virtual buttons for hardware keys
   - Send text input or shell commands

### Session Management

1. **Start Session**: Reserve a device to automatically start a session
2. **Monitor Sessions**: View active sessions in "Sessions" page
3. **End Session**: Release device or end session manually

### Analytics & Monitoring

1. **Dashboard**: Overview of all devices and system health
2. **Analytics**: Usage statistics and device utilization metrics
3. **Real-time Logs**: Monitor device logs and system events

### Automated Testing with Appium

1. **Start Appium Server**:
   - Navigate to "Automation" page
   - Select a device and click "Start Appium Server"
   - Or use auto-start when reserving a device

2. **Connect Your Tests**:
   - Use the provided Appium server URL (e.g., `http://localhost:4723`)
   - Configure your test framework (WebDriverIO, Appium, etc.)
   - Run automated tests against the device

3. **Monitor Appium Sessions**:
   - View active Appium servers in the UI
   - Check server status and logs
   - Stop servers when tests are complete

Example Appium capabilities:
```javascript
// Android
const capabilities = {
  platformName: 'Android',
  'appium:deviceName': 'device_serial',
  'appium:automationName': 'UiAutomator2'
};

// iOS
const capabilities = {
  platformName: 'iOS',
  'appium:deviceName': 'iPhone 14',
  'appium:automationName': 'XCUITest',
  'appium:udid': 'device_udid'
};
```

## Development

### Project Structure

```
DeviceFarm/
├── backend/           # Node.js backend server
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   └── utils/          # Utilities (ADB, logger)
│   └── package.json
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   └── services/       # API services
│   └── package.json
├── shared/           # Shared TypeScript types
│   └── types/
└── package.json      # Root package.json
```

### Available Scripts

```bash
# Development
npm run dev           # Start both backend and frontend
npm run dev:backend   # Start backend only
npm run dev:frontend  # Start frontend only

# Building
npm run build         # Build both backend and frontend
npm run build:backend # Build backend only
npm run build:frontend# Build frontend only

# Testing
npm test              # Run all tests
npm run test:backend  # Backend tests
npm run test:frontend # Frontend tests

# Linting
npm run lint          # Lint all code
npm run typecheck     # TypeScript type checking
```

### Adding New Features

1. **Backend**: Add routes in `backend/src/routes/`
2. **Frontend**: Add components in `frontend/src/components/`
3. **Types**: Update shared types in `shared/types/`
4. **WebSocket**: Add events in `WebSocketService.ts`

## Deployment

### Production Build

```bash
# Build for production
npm run build

# Start production server
cd backend && npm start
```

### Docker Deployment

```bash
# Build Docker images
docker build -t device-farm-backend ./backend
docker build -t device-farm-frontend ./frontend

# Run with docker-compose (includes USB device passthrough)
docker-compose up -d
```

**Note**: Docker deployment supports USB device passthrough for both Android and iOS devices. The `docker-compose.yml` includes necessary device mappings and privileged mode for device access.

### Environment Variables

Set these environment variables for production:

```bash
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-domain.com
LOG_LEVEL=info
```

## Troubleshooting

### Common Issues

#### Android Devices

**❌ No Android devices detected**
- Check USB connections
- Verify USB debugging is enabled
- Run `adb devices` to confirm ADB can see devices
- Try `adb kill-server && adb start-server`
- Check USB debugging authorization on device

**❌ Screenshots not working (Android)**
- Ensure device has granted USB debugging permission
- Check device screen is unlocked
- Verify ADB has permission to take screenshots

#### iOS Devices (macOS only)

**❌ No iOS devices detected**
- Check USB connections and trust relationship
- Verify Developer Mode is enabled on iOS device
- Run `idevice_id -l` to confirm libimobiledevice can see devices
- For simulators, ensure Xcode is properly installed
- Try `brew reinstall libimobiledevice` if having connection issues

**❌ Screenshots not working (iOS)**
- Ensure trust relationship is established
- Check device screen is unlocked
- Verify simulator is booted (for simulators)
- Check libimobiledevice is properly installed

#### General Issues

**❌ WebSocket connection failed**
- Check backend server is running on correct port
- Verify CORS settings in backend
- Check firewall settings

**❌ Commands not executing**
- Check device is not in deep sleep
- Verify device connection is stable
- Try reconnecting device

**❌ Appium server not starting**
- Verify Appium is globally installed: `npm list -g appium`
- Check port is not already in use
- Review Appium logs in the UI
- Ensure proper drivers are installed for platform

### Debug Mode

Enable debug logging:

```bash
# Backend debug logs
LOG_LEVEL=debug npm run dev:backend

# Frontend debug logs
DEBUG=true npm run dev:frontend
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check existing issues and documentation
- Review troubleshooting section above

---

**Built with ❤️ for mobile developers and QA engineers**
