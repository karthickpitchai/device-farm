import { Router, Request, Response } from 'express';
import { DeviceService } from '../services/DeviceService';
import { asyncHandler, createError } from '../middleware/errorHandler';

export default function sessionRoutes(deviceService: DeviceService) {
  const router = Router();

  // Create new session
  router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const { deviceId, userId } = req.body;

    if (!deviceId || !userId) {
      throw createError('Device ID and User ID are required', 400);
    }

    const device = deviceService.getDevice(deviceId);
    if (!device) {
      throw createError('Device not found', 404);
    }

    if (device.status !== 'online' && device.status !== 'reserved') {
      throw createError('Device is not available for session', 400);
    }

    const session = deviceService.createSession(deviceId, userId);

    res.json({
      success: true,
      data: session,
      message: 'Session created successfully'
    });
  }));

  // Get session by ID
  router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const session = deviceService.getSession(req.params.id);
    if (!session) {
      throw createError('Session not found', 404);
    }

    res.json({
      success: true,
      data: session
    });
  }));

  // End session
  router.post('/:id/end', asyncHandler(async (req: Request, res: Response) => {
    const session = deviceService.getSession(req.params.id);
    if (!session) {
      throw createError('Session not found', 404);
    }

    if (session.status !== 'active') {
      throw createError('Session is not active', 400);
    }

    deviceService.endSession(req.params.id);

    res.json({
      success: true,
      message: 'Session ended successfully'
    });
  }));

  // Get user sessions
  router.get('/user/:userId', asyncHandler(async (req: Request, res: Response) => {
    const sessions = deviceService.getUserSessions(req.params.userId);

    res.json({
      success: true,
      data: sessions
    });
  }));

  // Get all active sessions
  router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;
    const allSessions = deviceService.getAllDevices()
      .flatMap(device => deviceService.getDeviceSessions(device.id));

    const filteredSessions = status
      ? allSessions.filter(session => session.status === status)
      : allSessions;

    res.json({
      success: true,
      data: filteredSessions
    });
  }));

  return router;
}