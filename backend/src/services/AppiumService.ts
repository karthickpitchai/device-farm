import { spawn, ChildProcess } from 'child_process';
import { logger } from '../utils/logger';
import { Device, DeviceLog } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface AppiumServer {
  deviceId: string;
  port: number;
  process: ChildProcess;
  status: 'starting' | 'running' | 'stopped' | 'error';
}

export class AppiumService {
  private servers: Map<string, AppiumServer> = new Map();
  private basePort = 4723;
  private portRange = 100; // Ports 4723-4823
  private webSocketService: any = null; // Will be set later to avoid circular dependency

  setWebSocketService(webSocketService: any): void {
    this.webSocketService = webSocketService;
  }

  private broadcastLog(message: string, level: 'info' | 'warn' | 'error' = 'info', tag = 'Appium'): void {
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

  async startServerForDevice(device: Device): Promise<number> {
    try {
      const existingServer = this.servers.get(device.id);
      if (existingServer && existingServer.status === 'running') {
        return existingServer.port;
      }

      const port = this.getAvailablePort();
      logger.info(`Starting Appium server for device ${device.name} on port ${port}`);
      this.broadcastLog(`Starting Appium server for ${device.name} on port ${port}`, 'info');

      const appiumProcess = spawn('npx', [
        'appium',
        '--port', port.toString(),
        '--session-override',
        '--log-level', 'info',
        '--default-capabilities', JSON.stringify({
          'appium:udid': device.serialNumber,
          'appium:platformName': 'Android',
          'appium:automationName': 'UiAutomator2',
          'appium:deviceName': device.name,
          'appium:platformVersion': device.androidVersion,
          'appium:newCommandTimeout': 300,
          'appium:noReset': true
        })
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      const server: AppiumServer = {
        deviceId: device.id,
        port,
        process: appiumProcess,
        status: 'starting'
      };

      this.servers.set(device.id, server);

      appiumProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Appium REST http interface listener started')) {
          server.status = 'running';
          logger.info(`Appium server for device ${device.name} is ready on port ${port}`);
          this.broadcastLog(`Appium server for ${device.name} is now running on port ${port}`, 'info');
        }
      });

      appiumProcess.stderr?.on('data', (data) => {
        logger.error(`Appium server error for device ${device.name}: ${data.toString()}`);
      });

      appiumProcess.on('close', (code) => {
        server.status = 'stopped';
        logger.info(`Appium server for device ${device.name} exited with code ${code}`);
        this.servers.delete(device.id);
      });

      appiumProcess.on('error', (error) => {
        server.status = 'error';
        logger.error(`Failed to start Appium server for device ${device.name}:`, error);
        this.servers.delete(device.id);
      });

      // Wait for server to start
      await this.waitForServerStart(device.id, 30000);
      return port;

    } catch (error) {
      logger.error(`Failed to start Appium server for device ${device.id}:`, error);
      throw error;
    }
  }

  async stopServerForDevice(deviceId: string): Promise<void> {
    const server = this.servers.get(deviceId);
    if (server) {
      logger.info(`Stopping Appium server for device ${deviceId}`);
      this.broadcastLog(`Stopping Appium server for device ${deviceId}`, 'info');
      server.process.kill('SIGTERM');
      this.servers.delete(deviceId);
    }
  }

  getServerPort(deviceId: string): number | null {
    const server = this.servers.get(deviceId);
    return server && server.status === 'running' ? server.port : null;
  }

  getServerStatus(deviceId: string): string {
    const server = this.servers.get(deviceId);
    return server ? server.status : 'stopped';
  }

  getAllRunningServers(): Array<{ deviceId: string; port: number; status: string }> {
    return Array.from(this.servers.values()).map(server => ({
      deviceId: server.deviceId,
      port: server.port,
      status: server.status
    }));
  }

  async stopAllServers(): Promise<void> {
    logger.info('Stopping all Appium servers...');
    const stopPromises = Array.from(this.servers.keys()).map(deviceId =>
      this.stopServerForDevice(deviceId)
    );
    await Promise.all(stopPromises);
  }

  private getAvailablePort(): number {
    const usedPorts = new Set(Array.from(this.servers.values()).map(s => s.port));

    for (let i = 0; i < this.portRange; i++) {
      const port = this.basePort + i;
      if (!usedPorts.has(port)) {
        return port;
      }
    }

    throw new Error('No available ports for Appium server');
  }

  private async waitForServerStart(deviceId: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = 500;
      const maxAttempts = timeout / checkInterval;
      let attempts = 0;

      const check = () => {
        const server = this.servers.get(deviceId);

        if (!server) {
          reject(new Error('Server not found'));
          return;
        }

        if (server.status === 'running') {
          resolve();
          return;
        }

        if (server.status === 'error') {
          reject(new Error('Server failed to start'));
          return;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error('Server start timeout'));
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  // Get WebDriver session URL for external clients
  getWebDriverUrl(deviceId: string, hostIp?: string): string | null {
    const port = this.getServerPort(deviceId);
    if (!port) return null;

    const host = hostIp || 'localhost';
    return `http://${host}:${port}/wd/hub`;
  }

  // Get device capabilities for WebDriverIO
  getDeviceCapabilities(device: Device): any {
    return {
      platformName: 'Android',
      'appium:platformVersion': device.androidVersion,
      'appium:deviceName': device.name,
      'appium:udid': device.serialNumber,
      'appium:automationName': 'UiAutomator2',
      'appium:newCommandTimeout': 300,
      'appium:noReset': true,
      'appium:fullReset': false,
      'appium:skipServerInstallation': true,
      'appium:skipDeviceInitialization': false
    };
  }
}