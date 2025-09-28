import { Router, Request, Response } from 'express';
import { DeviceService } from '../services/DeviceService';
import { MonitoringService } from '../services/MonitoringService';
import { asyncHandler } from '../middleware/errorHandler';

export default function systemRoutes(deviceService: DeviceService, monitoringService: MonitoringService) {
  const router = Router();

  // Get system health
  router.get('/health', asyncHandler(async (req: Request, res: Response) => {
    const health = await monitoringService.getSystemHealth();

    res.json({
      success: true,
      data: health
    });
  }));

  // Get device statistics
  router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
    const stats = monitoringService.getDeviceStats();
    const connectedClients = monitoringService.getConnectedClientsCount();

    res.json({
      success: true,
      data: {
        ...stats,
        connectedClients
      }
    });
  }));

  // Get all reservations
  router.get('/reservations', asyncHandler(async (req: Request, res: Response) => {
    const { status, userId } = req.query;

    let reservations = deviceService.getActiveReservations();

    if (status) {
      reservations = reservations.filter(r => r.status === status);
    }

    if (userId) {
      reservations = reservations.filter(r => r.userId === userId);
    }

    res.json({
      success: true,
      data: reservations
    });
  }));

  // Get system logs (placeholder)
  router.get('/logs', asyncHandler(async (req: Request, res: Response) => {
    const { level, deviceId, limit = 100 } = req.query;

    // This is a placeholder - in a real implementation, you'd fetch logs from a database or log store
    const logs: any[] = [];

    res.json({
      success: true,
      data: logs,
      meta: {
        total: logs.length,
        limit: parseInt(limit as string)
      }
    });
  }));

  // Get API information
  router.get('/info', asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        name: 'Android Device Farm API',
        version: '1.0.0',
        description: 'Custom Device Lab with Web Interface for Android devices',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    });
  }));

  return router;
}