# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Android Device Farm is a comprehensive Custom Device Lab with Web Interface for Android devices, featuring real-time monitoring, device control, and session management through ADB commands.

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
  - `DeviceService`: Manages ADB connections and device operations
  - `WebSocketService`: Real-time communication with frontend
  - `MonitoringService`: System health and device monitoring
- **ADB Integration:** Direct Android device control via ADB commands
- **Routes:** RESTful API endpoints for devices, sessions, and system status

### Frontend (`frontend/`)
- **React 18 + TypeScript** with Vite build tool
- **State Management:** Zustand for global state, React Query for server state
- **UI Framework:** Tailwind CSS with Headless UI components
- **Real-time Updates:** Socket.IO client for live device status

### Shared Types (`shared/`)
- **TypeScript interfaces** shared between frontend and backend
- **Key Types:** Device, DeviceSession, DeviceCommand, WebSocketMessage

## Key Architecture Patterns

### Device Management Flow
1. `ADBClient` discovers and manages Android devices via ADB
2. `DeviceService` maintains device state and handles reservations
3. `WebSocketService` broadcasts device updates to connected clients
4. Frontend components subscribe to real-time device updates

### Command Execution
- Commands (tap, swipe, screenshot, shell) are queued and executed via ADB
- Results are tracked with status (`pending` → `executing` → `completed`/`failed`)
- Screenshots are saved to `uploads/screenshots/` and served statically

### Session Management
- Users can reserve devices for exclusive access
- Sessions track device usage, commands executed, and screenshots taken
- Reservations prevent conflicts between multiple users

## Development Environment

### Prerequisites
- **Node.js 18+** and npm
- **Android SDK** with `adb` in PATH
- **Connected Android devices** with USB debugging enabled

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
- **ADB Mocking:** Mock ADB calls in tests to avoid device dependencies
- **API Testing:** Test REST endpoints and WebSocket events independently