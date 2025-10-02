import { Router, Request, Response } from 'express';
import { AppiumService } from '../services/AppiumService';
import { DeviceService } from '../services/DeviceService';
import { WebSocketService } from '../services/WebSocketService';
import { logger } from '../utils/logger';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { getServerIpAddress } from '../utils/network';

export function createAppiumRoutes(appiumService: AppiumService, deviceService: DeviceService, webSocketService: WebSocketService): Router {
  const router = Router();

  // Start Appium server for a device
  router.post('/devices/:deviceId/appium/start', asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const device = deviceService.getDevice(deviceId);

    if (!device) {
      throw createError('Device not found', 404);
    }

    if (device.status !== 'reserved' && device.status !== 'in-use') {
      throw createError('Device must be reserved or in-use to start Appium server', 400);
    }

    const port = await appiumService.startServerForDevice(device);
    const serverIp = getServerIpAddress();
    const webDriverUrl = appiumService.getWebDriverUrl(deviceId, serverIp);

    res.json({
      success: true,
      port,
      webDriverUrl,
      capabilities: appiumService.getDeviceCapabilities(device)
    });
  }));

  // Stop Appium server for a device
  router.post('/devices/:deviceId/appium/stop', asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const device = deviceService.getDevice(deviceId);

    if (!device) {
      throw createError('Device not found', 404);
    }

    // Stop the Appium server
    await appiumService.stopServerForDevice(deviceId);

    // End any active sessions for this device
    const deviceSessions = deviceService.getDeviceSessions(deviceId);
    const activeSessions = deviceSessions.filter(s => s.status === 'active');
    activeSessions.forEach(session => {
      deviceService.endSession(session.id);
    });

    let deviceReleased = false;

    // Release the device if it was reserved
    if (device.status === 'reserved' || device.status === 'in-use') {
      await deviceService.releaseDevice(deviceId);
      deviceReleased = true;

      // Broadcast device update to all connected clients
      webSocketService.broadcastDeviceUpdate(deviceId);

      logger.info(`Device ${deviceId} released after stopping Appium server`);
    }

    res.json({
      success: true,
      deviceReleased
    });
  }));

  // Get Appium server status for a device
  router.get('/devices/:deviceId/appium/status', asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const device = deviceService.getDevice(deviceId);

    if (!device) {
      throw createError('Device not found', 404);
    }

    const status = appiumService.getServerStatus(deviceId);
    const port = appiumService.getServerPort(deviceId);
    const serverIp = getServerIpAddress();
    const webDriverUrl = port ? appiumService.getWebDriverUrl(deviceId, serverIp) : null;

    res.json({
      deviceId,
      status,
      port,
      webDriverUrl,
      capabilities: status === 'running' ? appiumService.getDeviceCapabilities(device) : null
    });
  }));

  // Get Appium server logs for a device
  router.get('/devices/:deviceId/appium/logs', asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const device = deviceService.getDevice(deviceId);

    if (!device) {
      throw createError('Device not found', 404);
    }

    const logs = appiumService.getServerLogs(deviceId);

    res.json({
      deviceId,
      deviceName: device.name,
      logs,
      count: logs.length
    });
  }));

  // Clear Appium server logs for a device
  router.delete('/devices/:deviceId/appium/logs', asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const device = deviceService.getDevice(deviceId);

    if (!device) {
      throw createError('Device not found', 404);
    }

    const cleared = appiumService.clearServerLogs(deviceId);

    if (!cleared) {
      throw createError('No Appium server running for this device', 404);
    }

    res.json({
      success: true,
      deviceId,
      deviceName: device.name,
      message: 'Logs cleared successfully'
    });
  }));

  // List all running Appium servers
  router.get('/appium/servers', asyncHandler(async (req: Request, res: Response) => {
    const servers = appiumService.getAllRunningServers();
    const serverIp = getServerIpAddress();

    const serversWithDetails = servers.map(server => {
      const device = deviceService.getDevice(server.deviceId);
      const webDriverUrl = server.status === 'running' ?
        appiumService.getWebDriverUrl(server.deviceId, serverIp) : null;

      return {
        ...server,
        deviceName: device?.name,
        webDriverUrl,
        capabilities: device && server.status === 'running' ?
          appiumService.getDeviceCapabilities(device) : null
      };
    });

    res.json({
      servers: serversWithDetails,
      count: servers.length
    });
  }));

  // Auto-start Appium server when device is reserved
  router.post('/devices/:deviceId/appium/auto-start', asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const device = deviceService.getDevice(deviceId);

    if (!device) {
      throw createError('Device not found', 404);
    }

    // Check if device is available for Appium server startup
    if (device.status === 'offline') {
      throw createError(`Device ${device.name} is offline and cannot start Appium server`, 400);
    }

    // Reserve device first if it's available
    const { userId = 'automation', duration = 120, purpose = 'WebDriverIO Testing' } = req.body;
    if (device.status === 'online') {
      await deviceService.reserveDevice(deviceId, userId, duration, purpose);

      // Broadcast device update to all connected clients
      webSocketService.broadcastDeviceUpdate(deviceId);
    }

    // Start Appium server only for online/reserved devices
    const port = await appiumService.startServerForDevice(device);
    const serverIp = getServerIpAddress();
    const webDriverUrl = appiumService.getWebDriverUrl(deviceId, serverIp);

    // Create session for tracking
    const session = deviceService.createSession(deviceId, userId);

    res.json({
      success: true,
      deviceReserved: device.status === 'reserved',
      port,
      webDriverUrl,
      capabilities: appiumService.getDeviceCapabilities(device),
      instructions: {
        webdriverio: {
          config: {
            hostname: serverIp,
            port,
            path: '/wd/hub',
            capabilities: appiumService.getDeviceCapabilities(device)
          }
        }
      }
    });
  }));

  return router;
}