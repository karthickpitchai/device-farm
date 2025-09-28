export interface Device {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  androidVersion: string;
  apiLevel: number;
  serialNumber: string;
  status: 'online' | 'offline' | 'unauthorized' | 'reserved' | 'in-use';
  batteryLevel?: number;
  screenResolution?: string;
  orientation?: 'portrait' | 'landscape';
  lastSeen: Date;
  connectedAt?: Date;
  reservedBy?: string;
  reservedAt?: Date;
  capabilities: DeviceCapabilities;
  properties: Record<string, string>;
}

export interface DeviceCapabilities {
  touchscreen: boolean;
  camera: boolean;
  wifi: boolean;
  bluetooth: boolean;
  gps: boolean;
  nfc: boolean;
  fingerprint: boolean;
  accelerometer: boolean;
  gyroscope: boolean;
}

export interface DeviceSession {
  id: string;
  deviceId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'failed';
  logs: DeviceLog[];
}


export interface DeviceLog {
  id: string;
  deviceId: string;
  sessionId?: string;
  timestamp: Date;
  level: 'verbose' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  tag: string;
  message: string;
}

export interface DeviceCommand {
  id: string;
  deviceId: string;
  type: 'tap' | 'swipe' | 'key' | 'text' | 'install' | 'uninstall' | 'shell';
  payload: any;
  timestamp: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface TapCommand {
  x: number;
  y: number;
}

export interface SwipeCommand {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration?: number;
}

export interface KeyCommand {
  keyCode: number;
}

export interface TextCommand {
  text: string;
}

export interface InstallCommand {
  apkPath: string;
  packageName?: string;
}

export interface ShellCommand {
  command: string;
}

export interface DeviceReservation {
  id: string;
  deviceId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  purpose: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface WebSocketMessage {
  type: string;
  deviceId?: string;
  sessionId?: string;
  data?: any;
  timestamp: Date;
}

export interface DeviceStats {
  totalDevices: number;
  onlineDevices: number;
  reservedDevices: number;
  inUseDevices: number;
  offlineDevices: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  adbServer: {
    running: boolean;
    version?: string;
  };
}