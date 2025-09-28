import { Server as SocketIOServer, Socket } from 'socket.io';
import { DeviceService } from './DeviceService';
import { logger } from '../utils/logger';
import { WebSocketMessage } from '../../../shared/types';

export class WebSocketService {
  private io: SocketIOServer;
  private deviceService: DeviceService;
  private connectedClients: Map<string, Socket> = new Map();
  private clientMirroringDevices: Map<string, string> = new Map(); // socketId -> deviceId

  constructor(io: SocketIOServer, deviceService: DeviceService) {
    this.io = io;
    this.deviceService = deviceService;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, socket);

      socket.emit('devices:list', this.deviceService.getAllDevices());

      socket.on('device:reserve', async (data: { deviceId: string; userId: string; duration: number; purpose: string }) => {
        try {
          const reservation = await this.deviceService.reserveDevice(
            data.deviceId,
            data.userId,
            data.duration,
            data.purpose
          );

          socket.emit('device:reserved', reservation);
          this.broadcastDeviceUpdate(data.deviceId);
        } catch (error) {
          socket.emit('error', { message: error instanceof Error ? error.message : 'Reservation failed' });
        }
      });

      socket.on('device:release', async (data: { deviceId: string }) => {
        try {
          await this.deviceService.releaseDevice(data.deviceId);
          socket.emit('device:released', { deviceId: data.deviceId });
          this.broadcastDeviceUpdate(data.deviceId);
        } catch (error) {
          socket.emit('error', { message: error instanceof Error ? error.message : 'Release failed' });
        }
      });


      socket.on('device:command', async (data: any) => {
        try {
          await this.deviceService.executeCommand(data);
          socket.emit('device:command:result', { commandId: data.id, success: true });
        } catch (error) {
          socket.emit('device:command:result', {
            commandId: data.id,
            success: false,
            error: error instanceof Error ? error.message : 'Command failed'
          });
        }
      });

      socket.on('session:start', (data: { deviceId: string; userId: string }) => {
        try {
          const session = this.deviceService.createSession(data.deviceId, data.userId);
          socket.emit('session:started', session);
          this.broadcastDeviceUpdate(data.deviceId);
        } catch (error) {
          socket.emit('error', { message: error instanceof Error ? error.message : 'Session start failed' });
        }
      });

      socket.on('session:end', (data: { sessionId: string }) => {
        try {
          const session = this.deviceService.getSession(data.sessionId);
          if (session) {
            this.deviceService.endSession(data.sessionId);
            socket.emit('session:ended', { sessionId: data.sessionId });
            this.broadcastDeviceUpdate(session.deviceId);
          }
        } catch (error) {
          socket.emit('error', { message: error instanceof Error ? error.message : 'Session end failed' });
        }
      });

      socket.on('devices:refresh', async () => {
        try {
          const devices = await this.deviceService.discoverDevices();
          this.io.emit('devices:list', devices);
        } catch (error) {
          socket.emit('error', { message: error instanceof Error ? error.message : 'Device refresh failed' });
        }
      });

      // Screen mirroring handlers
      socket.on('screen:mirror:start', async (data: { deviceId: string; fps?: number }) => {
        logger.info(`Received screen:mirror:start request from ${socket.id} for device ${data.deviceId}`);
        try {
          const fps = data.fps || 10; // Default 10fps for smooth experience

          // Check if this client is already mirroring this device
          const currentDevice = this.clientMirroringDevices.get(socket.id);
          if (currentDevice === data.deviceId) {
            // Already mirroring this device, just confirm
            logger.info(`Client ${socket.id} already mirroring device ${data.deviceId}`);
            socket.emit('screen:mirror:started', { deviceId: data.deviceId, fps });
            return;
          }

          // Stop any previous mirroring by this client
          if (currentDevice) {
            logger.info(`Stopping previous mirroring for client ${socket.id}, device ${currentDevice}`);
            await this.deviceService.stopScreenMirroring(currentDevice);
          }

          // Start new mirroring
          logger.info(`Starting screen mirroring for device ${data.deviceId} at ${fps}fps`);
          await this.deviceService.startScreenMirroring(data.deviceId, (screenshotData) => {
            socket.emit('screen:update', screenshotData);
          }, fps);

          // Track this client's mirroring
          this.clientMirroringDevices.set(socket.id, data.deviceId);

          socket.emit('screen:mirror:started', { deviceId: data.deviceId, fps });
          logger.info(`Client ${socket.id} started mirroring device ${data.deviceId}`);
        } catch (error) {
          logger.error(`Screen mirroring start failed for device ${data.deviceId}:`, error);
          socket.emit('error', { message: error instanceof Error ? error.message : 'Screen mirroring start failed' });
        }
      });

      socket.on('screen:mirror:stop', async (data: { deviceId: string }) => {
        try {
          await this.deviceService.stopScreenMirroring(data.deviceId);
          this.clientMirroringDevices.delete(socket.id);
          socket.emit('screen:mirror:stopped', { deviceId: data.deviceId });
          logger.info(`Client ${socket.id} stopped mirroring device ${data.deviceId}`);
        } catch (error) {
          socket.emit('error', { message: error instanceof Error ? error.message : 'Screen mirroring stop failed' });
        }
      });



      socket.on('disconnect', async () => {
        logger.info(`Client disconnected: ${socket.id}`);

        // Stop screen mirroring if this client was mirroring
        const mirroringDevice = this.clientMirroringDevices.get(socket.id);
        if (mirroringDevice) {
          try {
            await this.deviceService.stopScreenMirroring(mirroringDevice);
            this.clientMirroringDevices.delete(socket.id);
            logger.info(`Stopped mirroring for disconnected client ${socket.id}, device ${mirroringDevice}`);
          } catch (error) {
            logger.error(`Failed to stop mirroring on disconnect for device ${mirroringDevice}:`, error);
          }
        }

        this.connectedClients.delete(socket.id);
      });
    });
  }

  broadcastDeviceUpdate(deviceId: string): void {
    const device = this.deviceService.getDevice(deviceId);
    if (device) {
      this.io.emit('device:updated', device);
    }
  }

  broadcastDeviceList(): void {
    const devices = this.deviceService.getAllDevices();
    this.io.emit('devices:list', devices);
  }

  broadcastMessage(message: WebSocketMessage): void {
    this.io.emit('message', message);
  }

  sendToClient(clientId: string, event: string, data: any): void {
    const client = this.connectedClients.get(clientId);
    if (client) {
      client.emit(event, data);
    }
  }

  broadcastDeviceLog(log: any): void {
    this.io.emit('device:log', log);
  }

  broadcastSystemHealth(health: any): void {
    this.io.emit('system:health', health);
  }

  getConnectedClients(): number {
    return this.connectedClients.size;
  }
}