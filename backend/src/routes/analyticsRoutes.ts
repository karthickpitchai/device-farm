import { Router, Request, Response } from 'express';
import { DeviceService } from '../services/DeviceService';
import { asyncHandler } from '../middleware/errorHandler';

export function createAnalyticsRoutes(deviceService: DeviceService): Router {
  const router = Router();

  // Get overall analytics data
  router.get('/analytics', asyncHandler(async (req: Request, res: Response) => {
    const devices = deviceService.getAllDevices();
    const allSessions = devices.flatMap(device => deviceService.getDeviceSessions(device.id));
    const completedSessions = allSessions.filter(session => session.status === 'completed');
    const activeSessions = allSessions.filter(session => session.status === 'active');

    // Calculate total sessions
    const totalSessions = allSessions.length;

    // Calculate average session duration for completed sessions
    let averageSessionDuration = 0;
    if (completedSessions.length > 0) {
      const totalDuration = completedSessions.reduce((sum, session) => {
        if (session.endTime && session.startTime) {
          return sum + (new Date(session.endTime).getTime() - new Date(session.startTime).getTime());
        }
        return sum;
      }, 0);
      averageSessionDuration = Math.round(totalDuration / completedSessions.length / 1000 / 60); // Convert to minutes
    }

    // Calculate device utilization (percentage of devices currently in use)
    const totalDevices = devices.length;
    const devicesInUse = devices.filter(device =>
      device.status === 'in-use' || device.status === 'reserved'
    ).length;
    const deviceUtilization = totalDevices > 0 ? Math.round((devicesInUse / totalDevices) * 100) : 0;

    // Find peak usage hour (simplified - just return current hour for now)
    const currentHour = new Date().getHours();
    const peakUsageHour = `${currentHour.toString().padStart(2, '0')}:00`;

    // For changes, we'll use simple placeholder values since we don't have historical data
    const analytics = {
      totalSessions,
      averageSessionDuration: `${averageSessionDuration}m`,
      deviceUtilization,
      peakUsageHour,
      sessionsChange: Math.floor(Math.random() * 20) - 10, // Placeholder
      durationChange: Math.floor(Math.random() * 20) - 10, // Placeholder
      utilizationChange: Math.floor(Math.random() * 20) - 10 // Placeholder
    };

    res.json({
      success: true,
      data: analytics
    });
  }));

  // Get device usage analytics
  router.get('/analytics/devices', asyncHandler(async (req: Request, res: Response) => {
    const devices = deviceService.getAllDevices();

    const deviceUsageData = devices.map(device => {
      const deviceSessions = deviceService.getDeviceSessions(device.id);
      const completedSessions = deviceSessions.filter(session => session.status === 'completed');

      // Calculate usage percentage based on session count relative to max sessions
      const maxSessions = Math.max(1, Math.max(...devices.map(d =>
        deviceService.getDeviceSessions(d.id).length
      )));
      const usage = Math.round((deviceSessions.length / maxSessions) * 100);

      // Calculate average session duration for this device
      let avgDuration = 0;
      if (completedSessions.length > 0) {
        const totalDuration = completedSessions.reduce((sum, session) => {
          if (session.endTime && session.startTime) {
            return sum + (new Date(session.endTime).getTime() - new Date(session.startTime).getTime());
          }
          return sum;
        }, 0);
        avgDuration = Math.round(totalDuration / completedSessions.length / 1000 / 60);
      }

      return {
        id: device.id,
        name: device.name,
        usage: Math.min(usage, 100),
        sessions: deviceSessions.length,
        avgDuration,
        lastSession: completedSessions.length > 0 ?
          Math.round((Date.now() - new Date(completedSessions[completedSessions.length - 1].endTime!).getTime()) / 1000 / 60 / 60) : null,
        totalUsage: completedSessions.reduce((sum, session) => {
          if (session.endTime && session.startTime) {
            return sum + (new Date(session.endTime).getTime() - new Date(session.startTime).getTime());
          }
          return sum;
        }, 0) / 1000 / 60 / 60 // Convert to hours
      };
    });

    res.json({
      success: true,
      data: deviceUsageData
    });
  }));

  // Get hourly usage data for today
  router.get('/analytics/hourly', asyncHandler(async (req: Request, res: Response) => {
    const devices = deviceService.getAllDevices();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hourlyUsage = Array.from({ length: 24 }, (_, hour) => {
      const hourStart = new Date(today);
      hourStart.setHours(hour);
      const hourEnd = new Date(today);
      hourEnd.setHours(hour + 1);

      // Count sessions that were active during this hour
      let activeSessionsInHour = 0;
      devices.forEach(device => {
        const sessions = deviceService.getDeviceSessions(device.id);
        sessions.forEach(session => {
          const sessionStart = new Date(session.startTime);
          const sessionEnd = session.endTime ? new Date(session.endTime) : new Date();

          // Check if session overlaps with this hour
          if (sessionStart < hourEnd && sessionEnd > hourStart) {
            activeSessionsInHour++;
          }
        });
      });

      // Calculate usage percentage based on max possible concurrent sessions
      const maxConcurrentSessions = devices.length;
      const usage = maxConcurrentSessions > 0 ?
        Math.min(Math.round((activeSessionsInHour / maxConcurrentSessions) * 100), 100) : 0;

      return {
        hour: hour.toString().padStart(2, '0') + ':00',
        usage,
        sessions: activeSessionsInHour
      };
    });

    res.json({
      success: true,
      data: hourlyUsage
    });
  }));

  return router;
}