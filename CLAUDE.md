# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Device Farm is a comprehensive Custom Device Lab with Web Interface for **both Android and iOS devices**, featuring real-time monitoring, device control, session management, and Appium integration for automated testing.

## Commands

### Development
```bash
# Start full development environment (both backend and frontend)
npm run dev

# Start individual services
npm run dev:backend   # Backend: http://localhost:5000
npm run dev:frontend  # Frontend: http://localhost:3000

# Build everything
npm run build

# Start production server
npm run start
```

### Testing & Quality
```bash
# Run all tests
npm test

# Run specific tests
npm run test:backend
npm run test:frontend

# Lint and type checking
npm run lint          # Lint all code
npm run typecheck     # TypeScript type checking
```

### Backend-specific commands (from backend/ directory)
```bash
cd backend
npm run dev           # Development with nodemon + ts-node
npm run build         # TypeScript compilation to dist/
npm start            # Run built JavaScript from dist/
npm test             # Jest tests
npm run lint         # ESLint for TypeScript files
```

### Frontend-specific commands (from frontend/ directory)
```bash
cd frontend
npm run dev          # Vite development server
npm run build        # TypeScript compile + Vite build
npm run preview      # Preview production build
npm test             # Vitest tests
npm run lint         # ESLint for React TypeScript files
```

## Architecture

The application follows a monorepo structure with three main components:

### Backend (`backend/`)
- **Node.js/TypeScript** server using Express and Socket.IO
- **Core Services:**
  - `DeviceService`: Manages ADB/iOS connections and cross-platform device operations
  - `AppiumService`: Manages Appium server instances for automated testing
  - `WebSocketService`: Real-time bidirectional communication with frontend
  - `MonitoringService`: System health monitoring and device status tracking
- **Device Integration:**
  - **Android**: Direct ADB commands via `ADBClient`
  - **iOS**: iOS Simulator and physical device support via `IOSClient`
- **Routes:** RESTful API endpoints for devices, sessions, Appium servers, analytics, and system status

### Frontend (`frontend/`)
- **React 18 + TypeScript** with Vite build tool
- **State Management:** Context-based state with custom `useSocket` hook
- **UI Framework:** Tailwind CSS with Heroicons
- **Real-time Updates:** Socket.IO client for live device status, logs, and screen mirroring
- **Key Pages:** Dashboard, DeviceList, DeviceDetail, Sessions, Analytics, Automation

### Shared Types (`shared/`)
- **TypeScript interfaces** shared between frontend and backend
- **Key Types:** Device, DeviceSession, DeviceCommand, WebSocketMessage

## Key Architecture Patterns

### Cross-Platform Device Management Flow
1. **Device Discovery**: `ADBClient` (Android) and `IOSClient` (iOS) discover devices independently
2. **Unified Management**: `DeviceService` maintains unified device state across platforms
3. **Real-time Broadcasting**: `WebSocketService` broadcasts device updates to all connected clients
4. **Frontend Subscriptions**: React components subscribe to real-time device updates via `useSocket` hook

### Service Dependency Injection
- Services use setter injection to avoid circular dependencies
- `AppiumService.setWebSocketService()` and `DeviceService.setWebSocketService()` called during server startup
- Enables loose coupling between core services

### Command Execution Patterns
- **Cross-platform commands**: tap, swipe, screenshot, shell commands work on both Android and iOS
- **Platform-specific handling**: `DeviceService` delegates to appropriate client (`ADBClient` or `IOSClient`)
- **Status tracking**: Commands progress through `pending` → `executing` → `completed`/`failed` states
- **File management**: Screenshots saved to `uploads/screenshots/` and served as static files

### Real-time Communication Architecture
- **WebSocket Events**: Bidirectional communication for device updates, logs, screen mirroring
- **Screen Mirroring**: Live device screen streaming with configurable FPS
- **Log Broadcasting**: Real-time device logs and system events to frontend
- **Auto-reconnection**: Frontend handles WebSocket reconnection with user notifications

### Appium Integration
- **Dynamic Server Management**: `AppiumService` spawns Appium servers per device on unique ports
- **Auto-start Workflow**: Device reservation can automatically start Appium server
- **Port Management**: Automatic port allocation (4723-4823 range) for Appium servers
- **Lifecycle Management**: Servers are cleaned up when devices are released

### Session and Reservation Management
- **Exclusive Access**: Device reservations prevent conflicts between multiple users
- **Auto-release**: Sessions include duration limits with automatic cleanup
- **State Persistence**: Device states (reserved, in-use, online, offline) maintained across service restarts

## Development Environment

### Prerequisites
- **Node.js 18+** and npm
- **Android SDK** with `adb` in PATH for Android device support
- **iOS Development Tools** (macOS only):
  - Xcode with iOS Simulator support
  - `libimobiledevice` for physical iOS devices: `brew install libimobiledevice`
- **Appium** globally installed: `npm install -g appium`
- **Connected devices** with debugging enabled (USB debugging for Android, Developer mode for iOS)

### Environment Configuration
```bash
# Backend environment
cp backend/.env.example backend/.env

# Frontend environment
cp frontend/.env.example frontend/.env
```

### Docker Support
Use `docker-compose.yml` for containerized deployment with USB device passthrough.

## Code Conventions

### Backend
- **Service Pattern:** Business logic in service classes (`DeviceService`, etc.)
- **Route Handlers:** Thin controllers that delegate to services
- **Error Handling:** Centralized error middleware with proper logging
- **Async/Await:** Consistent promise handling throughout

### Frontend
- **Component Organization:** Pages in `pages/`, reusable components in `components/`
- **Custom Hooks:** Shared logic in `hooks/` (e.g., `useSocket`, `useDevices`)
- **API Integration:** React Query for server state management
- **Styling:** Tailwind CSS classes with consistent design tokens

### TypeScript
- **Strict Configuration:** Both projects use strict TypeScript settings
- **Shared Types:** Import from `shared/types` for consistency
- **Proper Typing:** Avoid `any` - use specific interfaces and union types

## Testing Strategy

- **Backend:** Jest for unit and integration tests
- **Frontend:** Vitest for component and utility testing
- **Device Mocking:** Mock ADB/iOS calls in tests to avoid device dependencies
- **API Testing:** Test REST endpoints and WebSocket events independently
- **Cross-platform Testing:** Ensure Android and iOS device operations work consistently

## Important Port Configuration

- **Backend API:** Port 5000 (development), configurable via `PORT` environment variable
- **Frontend Dev Server:** Port 3000 (Vite development server)
- **WebSocket:** Uses same port as backend API server
- **Appium Servers:** Dynamic allocation from port 4723-4823 range

## Key Files and Patterns

### Service Layer Architecture
- `backend/src/services/DeviceService.ts`: Core device management and cross-platform operations
- `backend/src/services/AppiumService.ts`: Appium server lifecycle management
- `backend/src/services/WebSocketService.ts`: Real-time communication hub
- `backend/src/utils/adb.ts`: Android device operations via ADB
- `backend/src/utils/ios.ts`: iOS device operations (simulators and physical devices)

### Frontend State Management
- `frontend/src/hooks/useSocket.tsx`: Central WebSocket connection and state management
- Context-based approach with provider pattern for device state
- Real-time updates automatically propagated to all components

### API Route Organization
- `backend/src/routes/deviceRoutes.ts`: Device CRUD and control operations
- `backend/src/routes/appiumRoutes.ts`: Appium server management endpoints
- `backend/src/routes/analyticsRoutes.ts`: Usage analytics and metrics
- Auto-start endpoints: `/api/devices/:id/appium/auto-start` combines reservation + Appium startup