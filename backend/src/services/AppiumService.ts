import { spawn, ChildProcess } from 'child_process';
import { logger } from '../utils/logger';
import { Device, DeviceLog } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface AppiumServer {
  deviceId: string;
  port: number;
  process: ChildProcess;
  status: 'starting' | 'running' | 'stopped' | 'error';
  logs: string[];
}

export class AppiumService {
  private servers: Map<string, AppiumServer> = new Map();
  private basePort = 4723;
  private portRange = 100; // Ports 4723-4823
  private webSocketService: any = null; // Will be set later to avoid circular dependency
  private maxLogsPerServer = 500; // Limit logs to prevent memory issues

  setWebSocketService(webSocketService: any): void {
    this.webSocketService = webSocketService;
  }

  // Strip ANSI color codes and control characters from log output
  private stripAnsiCodes(text: string): string {
    // Remove ANSI escape sequences
    return text
      .replace(/\x1b\[[0-9;]*m/g, '') // Color codes
      .replace(/\x1b\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g, '') // Extended ANSI codes
      .replace(/\x1b\[?[0-9;]*[a-zA-Z]/g, '') // Any remaining ANSI sequences
      .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '') // Control characters
      .trim();
  }

  // Remove stacktrace from JSON-like structures in log messages
  private removeStacktraceFromLog(text: string): string {
    try {
      // Try to parse as JSON and remove stacktrace key
      if (text.includes('{') && text.includes('}')) {
        // Remove "stacktrace": "..." or 'stacktrace': '...'
        text = text.replace(/"stacktrace"\s*:\s*"[^"]*"/gi, '"stacktrace": "[removed]"');
        text = text.replace(/'stacktrace'\s*:\s*'[^']*'/gi, "'stacktrace': '[removed]'");

        // Remove stackTrace key (camelCase)
        text = text.replace(/"stackTrace"\s*:\s*"[^"]*"/gi, '"stackTrace": "[removed]"');
        text = text.replace(/'stackTrace'\s*:\s*'[^']*'/gi, "'stackTrace': '[removed]'");

        // Remove entire stacktrace object if it's nested
        text = text.replace(/"stacktrace"\s*:\s*\{[^}]*\}/gi, '');
        text = text.replace(/'stacktrace'\s*:\s*\{[^}]*\}/gi, '');
      }
      return text;
    } catch (e) {
      return text;
    }
  }

  // Filter unnecessary and verbose log entries
  private shouldFilterLog(logLine: string): boolean {
    if (!logLine || logLine.trim().length === 0) {
      return true; // Filter empty lines
    }

    const lowerLine = logLine.toLowerCase();

    // Filter patterns
    const filterPatterns = [
      // Stack traces
      /^\s*at\s+/i,
      /^\s*Error:\s*$/i,
      /Exception in thread/i,
      /stacktrace/i,
      /stack trace/i,
      /"stacktrace":/i,
      /'stacktrace':/i,
      /stackTrace/i,

      // Deprecation warnings
      /deprecat/i,
      /deprecated/i,

      // Verbose debug info
      /verbose/i,
      /^\s*\[debug\]/i,

      // Internal Appium messages
      /welcome to appium/i,
      /appium version/i,
      /appium updates/i,
      /check update/i,
      /installed plugins/i,
      /installed drivers/i,
      /available plugins/i,
      /available drivers/i,

      // Capability noise
      /desired capabilities/i,
      /processed capabilities/i,
      /session capabilities/i,

      // WebDriver protocol noise
      /w3c capability/i,
      /creating new/i,
      /automation name/i,

      // System paths and verbose config
      /using.*path.*node_modules/i,
      /creating session with/i,
      /set new command timeout/i,

      // HTTP request noise (too verbose)
      /^\[HTTP\]/i,
      /^\[W3C\]/i,

      // Empty brackets or minimal content
      /^\[\s*\]\s*$/,
      /^\s*-+\s*$/,
      /^\s*=+\s*$/,
    ];

    // Check if line matches any filter pattern
    return filterPatterns.some(pattern => pattern.test(logLine));
  }

  // Extract only important execution logs
  private extractImportantLog(logLine: string): string | null {
    const lowerLine = logLine.toLowerCase();

    // Keep important messages
    const importantPatterns = [
      /server.*start/i,
      /server.*listen/i,
      /server.*running/i,
      /session.*created/i,
      /session.*start/i,
      /ready.*accept.*command/i,
      /executing.*command/i,
      /command.*success/i,
      /command.*fail/i,
      /driver.*initiali/i,
      /app.*launch/i,
      /app.*install/i,
      /element.*found/i,
      /click.*element/i,
      /navigate.*to/i,
      /test.*start/i,
      /test.*complete/i,
      /error/i,
      /fail/i,
      /warn/i,
    ];

    // If it matches important pattern, return it
    if (importantPatterns.some(pattern => pattern.test(logLine))) {
      return logLine;
    }

    // If it's a short, informative message (not too verbose)
    if (logLine.length < 200 && !this.shouldFilterLog(logLine)) {
      return logLine;
    }

    return null;
  }

  async cleanupOrphanedProcesses(): Promise<void> {
    try {
      const { spawn } = require('child_process');
      const killProcess = spawn('pkill', ['-f', 'appium']);

      killProcess.on('close', (code: number | null) => {
        if (code === 0) {
          logger.info('Cleaned up orphaned Appium processes');
          this.broadcastLog('Cleaned up orphaned Appium processes', 'info');
        }
      });
    } catch (error) {
      logger.warn('Failed to cleanup orphaned processes:', error);
    }
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

      const port = await this.getAvailablePort();
      logger.info(`Starting Appium server for device ${device.name} on port ${port}`);
      this.broadcastLog(`Starting Appium server for ${device.name} on port ${port}`, 'info');

      const appiumProcess = spawn('appium', [
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
        status: 'starting',
        logs: []
      };

      this.servers.set(device.id, server);

      // Helper to add log with timestamp and filtering
      const addLog = (message: string, level: 'info' | 'debug' | 'warn' | 'error' = 'info', forceAdd = false) => {
        // Clean the message by stripping ANSI codes and control characters
        let cleanMessage = this.stripAnsiCodes(message);

        // Remove stacktrace from the message
        cleanMessage = this.removeStacktraceFromLog(cleanMessage);

        // Skip empty messages after cleaning
        if (!cleanMessage || cleanMessage.length === 0) {
          return;
        }

        // Apply filtering unless forced
        if (!forceAdd) {
          // Check if should filter this log
          if (this.shouldFilterLog(cleanMessage)) {
            return;
          }

          // Extract important log or skip
          const importantLog = this.extractImportantLog(cleanMessage);
          if (!importantLog) {
            return;
          }
        }

        // Check for duplicate (same as last log entry)
        const lastLog = server.logs.length > 0 ? server.logs[server.logs.length - 1] : null;
        if (lastLog && lastLog.includes(cleanMessage)) {
          return; // Skip duplicate
        }

        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${cleanMessage}`;
        server.logs.push(logEntry);

        // Limit logs to prevent memory issues
        if (server.logs.length > this.maxLogsPerServer) {
          server.logs.shift();
        }
      };

      // Initial log (force add, always show)
      addLog(`Starting Appium server for ${device.name} on port ${port}`, 'info', true);

      appiumProcess.stdout?.on('data', (data) => {
        const output = data.toString();

        // Split by newlines and process each line
        output.split('\n').forEach((line: string) => {
          const cleanedLine = this.stripAnsiCodes(line).trim();
          if (cleanedLine) {
            addLog(cleanedLine, 'info');
          }
        });

        if (output.includes('Appium REST http interface listener started')) {
          server.status = 'running';
          logger.info(`Appium server for device ${device.name} is ready on port ${port}`);
          this.broadcastLog(`Appium server for ${device.name} is now running on port ${port}`, 'info');
          addLog(`Server is ready and listening on port ${port}`, 'info', true);
        }
      });

      appiumProcess.stderr?.on('data', (data) => {
        const errorOutput = data.toString();

        // Split by newlines and process each line
        errorOutput.split('\n').forEach((line: string) => {
          const cleanedLine = this.stripAnsiCodes(line).trim();
          if (cleanedLine) {
            // Only add critical errors, filter stack traces
            if (!cleanedLine.startsWith('at ') && !this.shouldFilterLog(cleanedLine)) {
              addLog(cleanedLine, 'error');
            }
          }
        });

        // Log to console for debugging (but don't add to user-visible logs)
        const cleanedError = this.stripAnsiCodes(errorOutput).trim();
        if (cleanedError && !cleanedError.startsWith('at ')) {
          logger.error(`Appium server error for device ${device.name}: ${cleanedError}`);
        }
      });

      appiumProcess.on('close', (code) => {
        if (code !== 0) {
          server.status = 'error';
        } else {
          server.status = 'stopped';
        }
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
      // Clean up the server entry if it exists
      this.servers.delete(device.id);
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

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();

      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });

      server.on('error', () => resolve(false));
    });
  }

  private async getAvailablePort(): Promise<number> {
    const usedPorts = new Set(Array.from(this.servers.values()).map(s => s.port));

    for (let i = 0; i < this.portRange; i++) {
      const port = this.basePort + i;
      if (!usedPorts.has(port) && await this.isPortAvailable(port)) {
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

  // Get logs for a device's Appium server
  getServerLogs(deviceId: string): string[] {
    const server = this.servers.get(deviceId);
    return server ? [...server.logs] : [];
  }

  // Clear logs for a device's Appium server
  clearServerLogs(deviceId: string): boolean {
    const server = this.servers.get(deviceId);
    if (server) {
      server.logs = [];
      logger.info(`Cleared logs for device ${deviceId}`);
      return true;
    }
    return false;
  }
}