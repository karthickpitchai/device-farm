import * as os from 'os';
import { DeviceService } from './DeviceService';
import { WebSocketService } from './WebSocketService';
import { ADBClient } from '../utils/adb';
import { IOSClient } from '../utils/ios';
import { logger } from '../utils/logger';
import { SystemHealth, DeviceStats } from '../../../shared/types';

export class MonitoringService {
  private deviceService: DeviceService;
  private webSocketService: WebSocketService;
  private adb: ADBClient;
  private ios: IOSClient;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private deviceDiscoveryInterval: NodeJS.Timeout | null = null;
  private startTime: number;

  constructor(deviceService: DeviceService, webSocketService: WebSocketService) {
    this.deviceService = deviceService;
    this.webSocketService = webSocketService;
    this.adb = new ADBClient();
    this.ios = new IOSClient();
    this.startTime = Date.now();
  }

  async start(): Promise<void> {
    logger.info('Starting monitoring service...');

    this.monitoringInterval = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        this.webSocketService.broadcastSystemHealth(health);
      } catch (error) {
        logger.error('Error in system health monitoring:', error);
      }
    }, 10000); // Every 10 seconds

    this.deviceDiscoveryInterval = setInterval(async () => {
      try {
        const devices = await this.deviceService.discoverDevices();
        this.webSocketService.broadcastDeviceList();
        logger.info(`Device discovery completed. Found ${devices.length} devices.`);
      } catch (error) {
        logger.error('Error in device discovery:', error);
      }
    }, 30000); // Every 30 seconds

    logger.info('Monitoring service started successfully');
  }

  async stop(): Promise<void> {
    logger.info('Stopping monitoring service...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.deviceDiscoveryInterval) {
      clearInterval(this.deviceDiscoveryInterval);
      this.deviceDiscoveryInterval = null;
    }

    logger.info('Monitoring service stopped');
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    // For macOS, use a more realistic memory calculation
    // Use process memory usage instead of system-wide for health checks
    const processMemoryMB = memoryUsage.rss / 1024 / 1024;
    const totalMemoryGB = totalMemory / 1024 / 1024 / 1024;

    // Calculate more reasonable memory percentage based on process usage
    const memoryPercentage = Math.min(95, (processMemoryMB / (totalMemoryGB * 10.24))); // Cap at 95% and use reasonable baseline

    const cpuUsage = await this.getCPUUsage();

    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    let status: SystemHealth['status'] = 'healthy';

    // More reasonable thresholds for Node.js applications
    if (processMemoryMB > 1000 || cpuUsage > 95) { // 1GB process memory or 95% CPU
      status = 'unhealthy';
    } else if (processMemoryMB > 500 || cpuUsage > 85) { // 500MB process memory or 85% CPU
      status = 'degraded';
    }

    // Use system memory for display but process memory for health decisions
    const usedMemory = totalMemory - freeMemory;
    const systemMemoryPercentage = (usedMemory / totalMemory) * 100;

    // Check ADB server status in a simple way
    const adbRunning = await this.adb.isAdbServerRunning();

    // Check iOS tools availability
    const iosToolsAvailable = await this.ios.isIOSToolsAvailable();
    const xcodeAvailable = await this.ios.isXcodeAvailable();

    return {
      status,
      uptime,
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: systemMemoryPercentage, // Use system memory for display
        processMemoryMB: Math.round(processMemoryMB) // Add process memory info
      },
      cpu: {
        usage: cpuUsage
      },
      adbServer: {
        running: adbRunning
      },
      iosTools: {
        available: iosToolsAvailable || xcodeAvailable,
        xcodeAvailable,
        libimobiledeviceAvailable: iosToolsAvailable
      }
    };
  }

  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const cpus = os.cpus();

      // Get initial CPU times
      const startTimes = cpus.map(cpu => {
        const times = cpu.times;
        return {
          idle: times.idle,
          total: times.user + times.nice + times.sys + times.idle + times.irq
        };
      });

      // Wait 1 second then calculate usage
      setTimeout(() => {
        const endCpus = os.cpus();
        const endTimes = endCpus.map(cpu => {
          const times = cpu.times;
          return {
            idle: times.idle,
            total: times.user + times.nice + times.sys + times.idle + times.irq
          };
        });

        // Calculate average CPU usage across all cores
        let totalIdleDiff = 0;
        let totalDiff = 0;

        for (let i = 0; i < startTimes.length; i++) {
          const idleDiff = endTimes[i].idle - startTimes[i].idle;
          const totalTimeDiff = endTimes[i].total - startTimes[i].total;

          totalIdleDiff += idleDiff;
          totalDiff += totalTimeDiff;
        }

        const avgIdle = totalIdleDiff / startTimes.length;
        const avgTotal = totalDiff / startTimes.length;

        const cpuUsagePercent = avgTotal > 0 ? ((avgTotal - avgIdle) / avgTotal) * 100 : 0;
        resolve(Math.max(0, Math.min(100, cpuUsagePercent)));
      }, 1000);
    });
  }

  getDeviceStats(): DeviceStats {
    const devices = this.deviceService.getAllDevices();

    return {
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => d.status === 'online').length,
      reservedDevices: devices.filter(d => d.status === 'reserved').length,
      inUseDevices: devices.filter(d => d.status === 'in-use').length,
      offlineDevices: devices.filter(d => d.status === 'offline').length
    };
  }

  getConnectedClientsCount(): number {
    return this.webSocketService.getConnectedClients();
  }

}