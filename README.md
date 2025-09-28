# Android Device Farm

A comprehensive Custom Device Lab with Web Interface for Android devices, featuring real-time monitoring, device control, and session management.

## Features

### 🏗️ **Device Management**
- **Automatic Discovery**: Automatically detect connected Android devices via ADB
- **Real-time Status**: Monitor device status, battery level, and connection state
- **Device Information**: View detailed device specs including model, Android version, and capabilities

### 🎮 **Remote Device Control**
- **Screen Interaction**: Take screenshots and interact with devices through web interface
- **Touch Input**: Tap, swipe, and gesture control directly from the browser
- **Virtual Keys**: Hardware buttons (Home, Back, Menu, Volume) simulation
- **Text Input**: Send text to devices remotely
- **Shell Commands**: Execute ADB shell commands with history

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

### 🌐 **Web Interface**
- **Modern UI**: Responsive design built with React and Tailwind CSS
- **Real-time Updates**: WebSocket-based live updates for all device changes
- **Dashboard**: Comprehensive overview of device farm status
- **Mobile Friendly**: Works on desktop, tablet, and mobile devices

## Architecture

```
┌─────────────────┐    WebSocket/REST    ┌──────────────────┐
│   Web Frontend  │◄────────────────────►│  Backend Server  │
│   (React/TS)    │                      │   (Node.js/TS)   │
└─────────────────┘                      └──────────────────┘
                                                    │
                                                    │ ADB Commands
                                                    ▼
                                         ┌──────────────────┐
                                         │  Android Device  │
                                         │     Manager      │
                                         └──────────────────┘
                                                    │
                                      ┌─────────────┼─────────────┐
                                      │             │             │
                                      ▼             ▼             ▼
                               ┌───────────┐ ┌───────────┐ ┌───────────┐
                               │  Device 1 │ │  Device 2 │ │  Device N │
                               │(Connected)│ │(Connected)│ │(Connected)│
                               └───────────┘ └───────────┘ └───────────┘
```

## Prerequisites

- **Node.js** 18+ and npm
- **Android SDK** with ADB in PATH
- **Android devices** with USB debugging enabled
- **Chrome/Firefox** modern browser for web interface

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

### 3. Connect Android Devices

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

# Run with docker-compose
docker-compose up -d
```

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

**❌ No devices detected**
- Check USB connections
- Verify USB debugging is enabled
- Run `adb devices` to confirm ADB can see devices
- Try `adb kill-server && adb start-server`

**❌ WebSocket connection failed**
- Check backend server is running on correct port
- Verify CORS settings in backend
- Check firewall settings

**❌ Screenshots not working**
- Ensure device has granted USB debugging permission
- Check device screen is unlocked
- Verify ADB has permission to take screenshots

**❌ Commands not executing**
- Check device is not in deep sleep
- Verify ADB connection is stable
- Try reconnecting device

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