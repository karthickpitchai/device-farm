import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execAsync = promisify(exec);

export class ADBClient {
  private adbPath: string;

  constructor(adbPath: string = 'adb') {
    this.adbPath = adbPath;
  }

  async isAdbServerRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`${this.adbPath} version`);
      return stdout.includes('Android Debug Bridge');
    } catch (error) {
      logger.error('ADB server check failed:', error);
      return false;
    }
  }

  async startAdbServer(): Promise<void> {
    try {
      await execAsync(`${this.adbPath} start-server`);
      logger.info('ADB server started');
    } catch (error) {
      logger.error('Failed to start ADB server:', error);
      throw error;
    }
  }

  async getConnectedDevices(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`${this.adbPath} devices`);
      const lines = stdout.split('\n').slice(1); // Skip header
      const devices = lines
        .filter(line => line.trim() && !line.includes('offline') && !line.includes('unauthorized'))
        .map(line => line.split('\t')[0].trim())
        .filter(device => device);

      return devices;
    } catch (error) {
      logger.error('Failed to get connected devices:', error);
      return [];
    }
  }

  async getDeviceProperties(deviceId: string): Promise<Record<string, string>> {
    try {
      const { stdout } = await execAsync(`${this.adbPath} -s ${deviceId} shell getprop`);
      const properties: Record<string, string> = {};

      stdout.split('\n').forEach(line => {
        const match = line.match(/\[(.*?)\]: \[(.*?)\]/);
        if (match) {
          properties[match[1]] = match[2];
        }
      });

      return properties;
    } catch (error) {
      logger.error(`Failed to get properties for device ${deviceId}:`, error);
      return {};
    }
  }

  async getBatteryInfo(deviceId: string): Promise<{ level: number; status: string }> {
    try {
      const { stdout } = await execAsync(`${this.adbPath} -s ${deviceId} shell dumpsys battery`);
      const levelMatch = stdout.match(/level: (\d+)/);
      const statusMatch = stdout.match(/status: (\d+)/);

      return {
        level: levelMatch ? parseInt(levelMatch[1]) : 0,
        status: statusMatch ? this.getBatteryStatus(parseInt(statusMatch[1])) : 'unknown'
      };
    } catch (error) {
      logger.error(`Failed to get battery info for device ${deviceId}:`, error);
      return { level: 0, status: 'unknown' };
    }
  }

  private getBatteryStatus(status: number): string {
    const statusMap: Record<number, string> = {
      1: 'unknown',
      2: 'charging',
      3: 'discharging',
      4: 'not_charging',
      5: 'full'
    };
    return statusMap[status] || 'unknown';
  }

  async takeScreenshotRaw(deviceId: string, quality: number = 80): Promise<Buffer> {
    try {
      // Use spawn instead of exec for binary data with timeout and resource protection
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error(`Screenshot timeout for device ${deviceId}`));
        }, 10000); // 10 second timeout

        const proc = spawn(this.adbPath, ['-s', deviceId, 'exec-out', 'screencap', '-p'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        const chunks: Buffer[] = [];

        proc.stdout.on('data', (chunk) => {
          chunks.push(chunk);
        });

        proc.stderr.on('data', (data) => {
          // Only log actual errors, not EAGAIN which is expected under load
          const errorStr = data.toString();
          if (!errorStr.includes('EAGAIN') && !errorStr.includes('Resource temporarily unavailable')) {
            logger.error(`ADB stderr for device ${deviceId}:`, errorStr);
          }
        });

        proc.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve(Buffer.concat(chunks));
          } else {
            reject(new Error(`ADB command failed with code ${code}`));
          }
        });

        proc.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      logger.error(`Failed to take raw screenshot for device ${deviceId}:`, error);
      throw error;
    }
  }

  async tapScreen(deviceId: string, x: number, y: number): Promise<void> {
    try {
      await execAsync(`${this.adbPath} -s ${deviceId} shell input tap ${x} ${y}`);
    } catch (error) {
      logger.error(`Failed to tap screen for device ${deviceId}:`, error);
      throw error;
    }
  }

  async swipeScreen(deviceId: string, startX: number, startY: number, endX: number, endY: number, duration: number = 300): Promise<void> {
    try {
      await execAsync(`${this.adbPath} -s ${deviceId} shell input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`);
    } catch (error) {
      logger.error(`Failed to swipe screen for device ${deviceId}:`, error);
      throw error;
    }
  }

  async sendKeyEvent(deviceId: string, keyCode: number): Promise<void> {
    try {
      await execAsync(`${this.adbPath} -s ${deviceId} shell input keyevent ${keyCode}`);
    } catch (error) {
      logger.error(`Failed to send key event for device ${deviceId}:`, error);
      throw error;
    }
  }

  async inputText(deviceId: string, text: string): Promise<void> {
    try {
      const escapedText = text.replace(/'/g, "\\'").replace(/ /g, '%s');
      await execAsync(`${this.adbPath} -s ${deviceId} shell input text '${escapedText}'`);
    } catch (error) {
      logger.error(`Failed to input text for device ${deviceId}:`, error);
      throw error;
    }
  }

  async installApk(deviceId: string, apkPath: string): Promise<void> {
    try {
      await execAsync(`${this.adbPath} -s ${deviceId} install "${apkPath}"`);
    } catch (error) {
      logger.error(`Failed to install APK for device ${deviceId}:`, error);
      throw error;
    }
  }

  async uninstallApp(deviceId: string, packageName: string): Promise<void> {
    try {
      await execAsync(`${this.adbPath} -s ${deviceId} uninstall ${packageName}`);
    } catch (error) {
      logger.error(`Failed to uninstall app for device ${deviceId}:`, error);
      throw error;
    }
  }

  async executeShellCommand(deviceId: string, command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`${this.adbPath} -s ${deviceId} shell ${command}`);
      return stdout;
    } catch (error) {
      logger.error(`Failed to execute shell command for device ${deviceId}:`, error);
      throw error;
    }
  }

  async getScreenResolution(deviceId: string): Promise<string> {
    try {
      const output = await this.executeShellCommand(deviceId, 'wm size');
      const match = output.match(/(\d+x\d+)/);
      return match ? match[1] : 'unknown';
    } catch (error) {
      logger.error(`Failed to get screen resolution for device ${deviceId}:`, error);
      return 'unknown';
    }
  }

  async getOrientation(deviceId: string): Promise<'portrait' | 'landscape'> {
    try {
      // Try multiple methods to get orientation
      let output = '';
      let match = null;

      // Method 1: Try dumpsys display (most reliable)
      try {
        output = await this.executeShellCommand(deviceId, 'dumpsys display');
        match = output.match(/mCurrentOrientation=(\d+)/);
        if (match) {
          const orientation = parseInt(match[1]);
          return orientation === 0 || orientation === 2 ? 'portrait' : 'landscape';
        }
      } catch (displayError) {
        logger.debug(`Display method failed for device ${deviceId}, trying alternative methods`);
      }

      // Method 2: Try dumpsys window
      try {
        output = await this.executeShellCommand(deviceId, 'dumpsys window');
        match = output.match(/rotation[=\s]+(\d+)/);
        if (match) {
          const orientation = parseInt(match[1]);
          return orientation === 0 || orientation === 2 ? 'portrait' : 'landscape';
        }
      } catch (windowError) {
        logger.debug(`Window method failed for device ${deviceId}, trying legacy method`);
      }

      // Method 3: Fallback to original method (for older devices)
      try {
        output = await this.executeShellCommand(deviceId, 'dumpsys input | grep SurfaceOrientation');
        match = output.match(/SurfaceOrientation: (\d+)/);
        if (match) {
          const orientation = parseInt(match[1]);
          return orientation === 0 || orientation === 2 ? 'portrait' : 'landscape';
        }
      } catch (inputError) {
        logger.debug(`Input method failed for device ${deviceId}`);
      }

      // Default fallback
      logger.warn(`Could not determine orientation for device ${deviceId}, defaulting to portrait`);
      return 'portrait';
    } catch (error) {
      logger.error(`Failed to get orientation for device ${deviceId}:`, error);
      return 'portrait';
    }
  }

  async startLogcat(deviceId: string, callback: (log: string) => void): Promise<() => void> {
    const logcat = spawn(this.adbPath, ['-s', deviceId, 'logcat', '-v', 'time']);

    logcat.stdout.on('data', (data) => {
      callback(data.toString());
    });

    logcat.stderr.on('data', (data) => {
      logger.error(`Logcat error for device ${deviceId}:`, data.toString());
    });

    return () => {
      logcat.kill();
    };
  }
}