import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { ADBClient } from '../utils/adb';
import { logger } from '../utils/logger';
import {
  Device,
  DeviceSession,
  DeviceCommand,
  DeviceReservation,
  DeviceCapabilities,
  TapCommand,
  SwipeCommand,
  KeyCommand,
  TextCommand,
  InstallCommand,
  ShellCommand,
  DeviceLog
} from '../../../shared/types';

export class DeviceService {
  private adb: ADBClient;
  private devices: Map<string, Device> = new Map();
  private sessions: Map<string, DeviceSession> = new Map();
  private commands: Map<string, DeviceCommand> = new Map();
  private reservations: Map<string, DeviceReservation> = new Map();
  private logcatProcesses: Map<string, () => void> = new Map();
  private screenMirrorIntervals: Map<string, NodeJS.Timeout> = new Map();
  private screenMirrorCallbacks: Map<string, (screenshotData: any) => void> = new Map();
  private webSocketService: any = null; // Will be set later to avoid circular dependency
  private appiumService: any = null; // Will be set later to avoid circular dependency

  setWebSocketService(webSocketService: any): void {
    this.webSocketService = webSocketService;
  }

  setAppiumService(appiumService: any): void {
    this.appiumService = appiumService;
  }

  private broadcastLog(message: string, level: 'info' | 'warn' | 'error' = 'info', tag = 'Device'): void {
    if (this.webSocketService) {
      const log: DeviceLog = {
        id: uuidv4(),
        deviceId: 'system',
        level,
        message,
        timestamp: new Date(),
        tag
      };
      this.webSocketService.broadcastDeviceLog(log);
    }
  }

  constructor() {
    this.adb = new ADBClient();
  }

  // Method to add mock offline devices for demonstration
  addMockOfflineDevices(): void {
    const mockDevices: Device[] = [
      {
        id: 'mock-offline-1',
        name: 'Samsung Galaxy S21',
        model: 'SM-G991B',
        manufacturer: 'Samsung',
        androidVersion: '13',
        apiLevel: 33,
        serialNumber: 'R58M123ABCD',
        status: 'offline',
        batteryLevel: 67,
        screenResolution: '1080x2400',
        orientation: 'portrait',
        lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        connectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        capabilities: {
          touchscreen: true,
          camera: true,
          wifi: true,
          bluetooth: true,
          gps: true,
          nfc: true,
          fingerprint: true,
          accelerometer: true,
          gyroscope: true
        },
        properties: {}
      },
      {
        id: 'mock-offline-2',
        name: 'Google Pixel 7',
        model: 'Pixel 7',
        manufacturer: 'Google',
        androidVersion: '14',
        apiLevel: 34,
        serialNumber: 'ABC123XYZ789',
        status: 'offline',
        batteryLevel: 23,
        screenResolution: '1080x2400',
        orientation: 'portrait',
        lastSeen: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        connectedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        capabilities: {
          touchscreen: true,
          camera: true,
          wifi: true,
          bluetooth: true,
          gps: true,
          nfc: true,
          fingerprint: true,
          accelerometer: true,
          gyroscope: true
        },
        properties: {}
      }
    ];

    // Add mock devices only if we have very few real devices
    if (this.devices.size < 2) {
      mockDevices.forEach(device => {
        this.devices.set(device.id, device);
        logger.info(`Added mock offline device: ${device.name}`);
      });
    }
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Device Service...');

    if (!await this.adb.isAdbServerRunning()) {
      await this.adb.startAdbServer();
    }

    await this.ensureDirectories();
    await this.discoverDevices();

    // Add mock offline devices for demonstration if no real devices are connected
    this.addMockOfflineDevices();

    logger.info('Device Service initialized successfully');
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      path.join(__dirname, '../../uploads/apks'),
      path.join(__dirname, '../../logs')
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        logger.error(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  async discoverDevices(): Promise<Device[]> {
    try {
      const deviceIds = await this.adb.getConnectedDevices();
      const discoveredDevices: Device[] = [];

      for (const deviceId of deviceIds) {
        try {
          // Check if device already exists by serial number
          const existingDevice = this.getDeviceBySerial(deviceId);

          if (existingDevice) {
            // Update existing device status and last seen
            // Only set to 'online' if device is not reserved or in use
            if (existingDevice.status === 'offline') {
              existingDevice.status = 'online';
            }
            existingDevice.lastSeen = new Date();
            discoveredDevices.push(existingDevice);
          } else {
            // Create new device only if it doesn't exist
            const device = await this.createDeviceFromADB(deviceId);
            this.devices.set(device.id, device);
            discoveredDevices.push(device);
            this.startDeviceMonitoring(device.id);
          }
        } catch (error) {
          logger.error(`Failed to process device ${deviceId}:`, error);
        }
      }

      // Mark devices that are no longer connected as offline (keep them in the list)
      for (const [id, device] of this.devices) {
        if (!deviceIds.includes(device.serialNumber)) {
          // Only update if device is not already offline
          if (device.status !== 'offline') {
            this.stopDeviceMonitoring(id);

            // Stop Appium server for disconnected device
            if (this.appiumService) {
              try {
                await this.appiumService.stopServerForDevice(id);
                this.broadcastLog(`Stopped Appium server for disconnected device: ${device.name}`, 'info');
              } catch (error) {
                logger.error(`Failed to stop Appium server for disconnected device ${device.name}:`, error);
              }
            }

            // Mark as offline instead of deleting
            device.status = 'offline';
            device.lastSeen = new Date();
            logger.info(`Device marked as offline: ${device.name} (${device.serialNumber})`);
            this.broadcastLog(`Device disconnected and marked as offline: ${device.name}`, 'warn');
          }
        }
      }

      logger.info(`Discovered ${discoveredDevices.length} devices`);
      return discoveredDevices;
    } catch (error) {
      logger.error('Failed to discover devices:', error);
      return [];
    }
  }

  private async createDeviceFromADB(deviceId: string): Promise<Device> {
    const properties = await this.adb.getDeviceProperties(deviceId);
    const batteryInfo = await this.adb.getBatteryInfo(deviceId);
    const screenResolution = await this.adb.getScreenResolution(deviceId);
    const orientation = await this.adb.getOrientation(deviceId);

    // Determine the best device name
    let deviceName = 'Unknown Device';

    // For emulators, prefer AVD name if available
    if (properties['ro.boot.qemu.avd_name']) {
      deviceName = properties['ro.boot.qemu.avd_name'];
    }
    // For real devices or if AVD name not available, try device model
    else if (properties['ro.product.model'] &&
             properties['ro.product.model'] !== 'sdk_gphone64_arm64' &&
             !properties['ro.product.model'].startsWith('sdk_')) {
      deviceName = properties['ro.product.model'];
    }
    // Fallback to manufacturer + model combination
    else if (properties['ro.product.manufacturer'] && properties['ro.product.model']) {
      const manufacturer = properties['ro.product.manufacturer'];
      const model = properties['ro.product.model'];
      if (model.startsWith('sdk_')) {
        // For SDK devices, create a more friendly name
        deviceName = `${manufacturer} Android Emulator`;
      } else {
        deviceName = `${manufacturer} ${model}`;
      }
    }

    return {
      id: uuidv4(),
      name: deviceName,
      model: properties['ro.product.model'] || 'Unknown',
      manufacturer: properties['ro.product.manufacturer'] || 'Unknown',
      androidVersion: properties['ro.build.version.release'] || 'Unknown',
      apiLevel: parseInt(properties['ro.build.version.sdk']) || 0,
      serialNumber: deviceId,
      status: 'online',
      batteryLevel: batteryInfo.level,
      screenResolution,
      orientation,
      lastSeen: new Date(),
      connectedAt: new Date(),
      capabilities: this.detectCapabilities(properties),
      properties
    };
  }

  private detectCapabilities(properties: Record<string, string>): DeviceCapabilities {
    return {
      touchscreen: properties['ro.hardware.touchscreen'] !== 'notouch',
      camera: properties['ro.camera.sound.forced'] === '1' || properties['camera.disable_zsl_mode'] === '1',
      wifi: properties['ro.kernel.qemu.wifi'] !== '1',
      bluetooth: properties['ro.kernel.qemu.bluetooth'] !== '1',
      gps: properties['ro.kernel.qemu.gps'] !== '1',
      nfc: properties['ro.hardware.nfc'] === 'true',
      fingerprint: properties['ro.hardware.fingerprint'] === 'true',
      accelerometer: properties['ro.hardware.sensors.accelerometer'] === 'true',
      gyroscope: properties['ro.hardware.sensors.gyroscope'] === 'true'
    };
  }

  private startDeviceMonitoring(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (!device) return;

    // Start logcat monitoring
    this.adb.startLogcat(device.serialNumber, (logData) => {
      this.handleLogData(deviceId, logData);
    }).then((stopLogcat) => {
      this.logcatProcesses.set(deviceId, stopLogcat);
    }).catch((error) => {
      logger.error(`Failed to start logcat for device ${deviceId}:`, error);
    });
  }

  private stopDeviceMonitoring(deviceId: string): void {
    const stopLogcat = this.logcatProcesses.get(deviceId);
    if (stopLogcat) {
      stopLogcat();
      this.logcatProcesses.delete(deviceId);
    }
  }

  private handleLogData(deviceId: string, logData: string): void {
    const lines = logData.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const match = line.match(/^(\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(\w)\/(.+?)\(\s*(\d+)\):\s*(.+)$/);
      if (match) {
        const [, timestamp, level, tag, pid, message] = match;

        const log: DeviceLog = {
          id: uuidv4(),
          deviceId,
          timestamp: new Date(),
          level: this.mapLogLevel(level),
          tag,
          message: message.trim()
        };

        // Store log and emit via WebSocket (handled by WebSocketService)
        this.emitDeviceLog(log);
      }
    }
  }

  private mapLogLevel(level: string): DeviceLog['level'] {
    const levelMap: Record<string, DeviceLog['level']> = {
      'V': 'verbose',
      'D': 'debug',
      'I': 'info',
      'W': 'warn',
      'E': 'error',
      'F': 'fatal'
    };
    return levelMap[level] || 'info';
  }

  private emitDeviceLog(log: DeviceLog): void {
    // This will be called by WebSocketService
  }

  getAllDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  getDevice(deviceId: string): Device | undefined {
    return this.devices.get(deviceId);
  }

  getDeviceBySerial(serialNumber: string): Device | undefined {
    return Array.from(this.devices.values()).find(device => device.serialNumber === serialNumber);
  }

  async reserveDevice(deviceId: string, userId: string, duration: number, purpose: string): Promise<DeviceReservation> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    if (device.status !== 'online') {
      throw new Error(`Device is not available for reservation. Current status: ${device.status}`);
    }

    const reservation: DeviceReservation = {
      id: uuidv4(),
      deviceId,
      userId,
      startTime: new Date(),
      endTime: new Date(Date.now() + duration * 60000), // duration in minutes
      status: 'active',
      purpose
    };

    device.status = 'reserved';
    device.reservedBy = userId;
    device.reservedAt = new Date();

    this.reservations.set(reservation.id, reservation);

    this.broadcastLog(`Device ${device.name} reserved by ${userId} for ${purpose}`, 'info');

    return reservation;
  }

  async releaseDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    device.status = 'online';
    device.reservedBy = undefined;
    device.reservedAt = undefined;

    // Mark reservation as completed
    const reservation = Array.from(this.reservations.values())
      .find(r => r.deviceId === deviceId && r.status === 'active');

    if (reservation) {
      reservation.status = 'completed';
      reservation.endTime = new Date();
    }

    this.broadcastLog(`Device ${device.name} released and available`, 'info');
  }

  async executeCommand(command: DeviceCommand): Promise<void> {
    const device = this.devices.get(command.deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    command.status = 'executing';
    this.commands.set(command.id, command);

    try {
      switch (command.type) {
        case 'tap':
          const tapPayload = command.payload as TapCommand;
          await this.adb.tapScreen(device.serialNumber, tapPayload.x, tapPayload.y);
          break;

        case 'swipe':
          const swipePayload = command.payload as SwipeCommand;
          await this.adb.swipeScreen(
            device.serialNumber,
            swipePayload.startX,
            swipePayload.startY,
            swipePayload.endX,
            swipePayload.endY,
            swipePayload.duration
          );
          break;

        case 'key':
          const keyPayload = command.payload as KeyCommand;
          await this.adb.sendKeyEvent(device.serialNumber, keyPayload.keyCode);
          break;

        case 'text':
          const textPayload = command.payload as TextCommand;
          await this.adb.inputText(device.serialNumber, textPayload.text);
          break;


        case 'install':
          const installPayload = command.payload as InstallCommand;
          await this.adb.installApk(device.serialNumber, installPayload.apkPath);
          break;

        case 'uninstall':
          const uninstallPayload = command.payload as { packageName: string };
          await this.adb.uninstallApp(device.serialNumber, uninstallPayload.packageName);
          break;

        case 'shell':
          const shellPayload = command.payload as ShellCommand;
          const result = await this.adb.executeShellCommand(device.serialNumber, shellPayload.command);
          command.result = result;
          break;

        default:
          throw new Error(`Unsupported command type: ${command.type}`);
      }

      command.status = 'completed';
    } catch (error) {
      command.status = 'failed';
      command.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }





  createSession(deviceId: string, userId: string): DeviceSession {
    const session: DeviceSession = {
      id: uuidv4(),
      deviceId,
      userId,
      startTime: new Date(),
      status: 'active',
      logs: []
    };

    this.sessions.set(session.id, session);

    const device = this.devices.get(deviceId);
    if (device) {
      device.status = 'in-use';
      this.broadcastLog(`Session started for ${device.name} by ${userId}`, 'info', 'Session');
    }

    return session;
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.endTime = new Date();

      const device = this.devices.get(session.deviceId);
      if (device && device.reservedBy) {
        device.status = 'reserved';
      } else if (device) {
        device.status = 'online';
      }

      if (device) {
        this.broadcastLog(`Session ended for ${device.name} by ${session.userId}`, 'info', 'Session');
      }
    }
  }

  getSession(sessionId: string): DeviceSession | undefined {
    return this.sessions.get(sessionId);
  }

  getDeviceSessions(deviceId: string): DeviceSession[] {
    return Array.from(this.sessions.values()).filter(session => session.deviceId === deviceId);
  }

  getUserSessions(userId: string): DeviceSession[] {
    return Array.from(this.sessions.values()).filter(session => session.userId === userId);
  }

  getActiveReservations(): DeviceReservation[] {
    return Array.from(this.reservations.values()).filter(r => r.status === 'active');
  }

  getUserReservations(userId: string): DeviceReservation[] {
    return Array.from(this.reservations.values()).filter(r => r.userId === userId);
  }

  async startScreenMirroring(deviceId: string, callback: (screenshotData: any) => void, fps: number = 2): Promise<void> {
    logger.info(`DeviceService.startScreenMirroring called for device ${deviceId}`);
    const device = this.devices.get(deviceId);
    if (!device) {
      logger.error(`Device not found in DeviceService: ${deviceId}`);
      logger.error(`Available devices: ${Array.from(this.devices.keys()).join(', ')}`);
      throw new Error('Device not found');
    }

    logger.info(`Found device ${device.name} (${device.serialNumber}) for mirroring`);

    // Check if already mirroring this device
    if (this.screenMirrorIntervals.has(deviceId)) {
      logger.info(`Already mirroring device ${deviceId}, updating callback`);
      this.screenMirrorCallbacks.set(deviceId, callback);
      return;
    }

    // Store the callback
    this.screenMirrorCallbacks.set(deviceId, callback);

    // Test screenshot first
    try {
      logger.info(`Testing screenshot for device ${device.serialNumber}`);
      const testBuffer = await this.adb.takeScreenshotRaw(device.serialNumber);
      logger.info(`Test screenshot successful, buffer size: ${testBuffer.length} bytes`);
    } catch (error) {
      logger.error(`Test screenshot failed for device ${device.serialNumber}:`, error);
      throw error;
    }

    // Create interval for continuous screenshots
    const interval = setInterval(async () => {
      try {
        const screenshotBuffer = await this.adb.takeScreenshotRaw(device.serialNumber);

        const screenshotData = {
          id: uuidv4(),
          deviceId,
          timestamp: new Date(),
          data: screenshotBuffer.toString('base64'),
          mimeType: 'image/png'
        };

        const currentCallback = this.screenMirrorCallbacks.get(deviceId);
        if (currentCallback) {
          currentCallback(screenshotData);
        }
      } catch (error) {
        logger.error(`Screen mirroring error for device ${deviceId}:`, error);
      }
    }, 1000 / fps); // Convert fps to milliseconds

    this.screenMirrorIntervals.set(deviceId, interval);
    logger.info(`Started screen mirroring for device ${deviceId} at ${fps}fps`);
  }

  async stopScreenMirroring(deviceId: string): Promise<void> {
    const interval = this.screenMirrorIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.screenMirrorIntervals.delete(deviceId);
    }

    this.screenMirrorCallbacks.delete(deviceId);
    logger.info(`Stopped screen mirroring for device ${deviceId}`);
  }

  isScreenMirroring(deviceId: string): boolean {
    return this.screenMirrorIntervals.has(deviceId);
  }
}