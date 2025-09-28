import { Router, Request, Response } from 'express';
import { DeviceService } from '../services/DeviceService';
import { AppiumService } from '../services/AppiumService';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export default function deviceRoutes(deviceService: DeviceService, appiumService: AppiumService) {
  const router = Router();

  // Get all devices
  router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const devices = deviceService.getAllDevices();
    res.json({
      success: true,
      data: devices
    });
  }));

  // Get device by ID
  router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const device = deviceService.getDevice(req.params.id);
    if (!device) {
      throw createError('Device not found', 404);
    }

    res.json({
      success: true,
      data: device
    });
  }));

  // Refresh device list
  router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
    const devices = await deviceService.discoverDevices();
    res.json({
      success: true,
      data: devices,
      message: `Discovered ${devices.length} devices`
    });
  }));

  // Reserve device
  router.post('/:id/reserve', asyncHandler(async (req: Request, res: Response) => {
    const { userId, duration = 60, purpose = 'Testing' } = req.body;

    if (!userId) {
      throw createError('User ID is required', 400);
    }

    const reservation = await deviceService.reserveDevice(
      req.params.id,
      userId,
      duration,
      purpose
    );

    res.json({
      success: true,
      data: reservation,
      message: 'Device reserved successfully'
    });
  }));

  // Release device
  router.post('/:id/release', asyncHandler(async (req: Request, res: Response) => {
    const deviceId = req.params.id;

    // Stop any running Appium server for this device
    const serverStatus = appiumService.getServerStatus(deviceId);
    if (serverStatus === 'running') {
      await appiumService.stopServerForDevice(deviceId);
    }

    // Release the device
    await deviceService.releaseDevice(deviceId);

    res.json({
      success: true,
      message: 'Device released successfully',
      appiumServerStopped: serverStatus === 'running'
    });
  }));


  // Execute command
  router.post('/:id/command', asyncHandler(async (req: Request, res: Response) => {
    const { type, payload } = req.body;

    if (!type || !payload) {
      throw createError('Command type and payload are required', 400);
    }

    const command = {
      id: uuidv4(),
      deviceId: req.params.id,
      type,
      payload,
      timestamp: new Date(),
      status: 'pending' as const
    };

    await deviceService.executeCommand(command);

    res.json({
      success: true,
      data: command,
      message: 'Command executed successfully'
    });
  }));

  // Tap screen
  router.post('/:id/tap', asyncHandler(async (req: Request, res: Response) => {
    const { x, y } = req.body;

    if (typeof x !== 'number' || typeof y !== 'number') {
      throw createError('X and Y coordinates are required', 400);
    }

    const command = {
      id: uuidv4(),
      deviceId: req.params.id,
      type: 'tap' as const,
      payload: { x, y },
      timestamp: new Date(),
      status: 'pending' as const
    };

    await deviceService.executeCommand(command);

    res.json({
      success: true,
      data: command,
      message: 'Tap command executed successfully'
    });
  }));

  // Swipe screen
  router.post('/:id/swipe', asyncHandler(async (req: Request, res: Response) => {
    const { startX, startY, endX, endY, duration = 300 } = req.body;

    if (typeof startX !== 'number' || typeof startY !== 'number' ||
        typeof endX !== 'number' || typeof endY !== 'number') {
      throw createError('Start and end coordinates are required', 400);
    }

    const command = {
      id: uuidv4(),
      deviceId: req.params.id,
      type: 'swipe' as const,
      payload: { startX, startY, endX, endY, duration },
      timestamp: new Date(),
      status: 'pending' as const
    };

    await deviceService.executeCommand(command);

    res.json({
      success: true,
      data: command,
      message: 'Swipe command executed successfully'
    });
  }));

  // Send key event
  router.post('/:id/key', asyncHandler(async (req: Request, res: Response) => {
    const { keyCode } = req.body;

    if (typeof keyCode !== 'number') {
      throw createError('Key code is required', 400);
    }

    const command = {
      id: uuidv4(),
      deviceId: req.params.id,
      type: 'key' as const,
      payload: { keyCode },
      timestamp: new Date(),
      status: 'pending' as const
    };

    await deviceService.executeCommand(command);

    res.json({
      success: true,
      data: command,
      message: 'Key event sent successfully'
    });
  }));

  // Input text
  router.post('/:id/text', asyncHandler(async (req: Request, res: Response) => {
    const { text } = req.body;

    if (typeof text !== 'string' || !text.trim()) {
      throw createError('Text is required', 400);
    }

    const command = {
      id: uuidv4(),
      deviceId: req.params.id,
      type: 'text' as const,
      payload: { text },
      timestamp: new Date(),
      status: 'pending' as const
    };

    await deviceService.executeCommand(command);

    res.json({
      success: true,
      data: command,
      message: 'Text input sent successfully'
    });
  }));

  // Execute shell command
  router.post('/:id/shell', asyncHandler(async (req: Request, res: Response) => {
    const { command } = req.body;

    if (typeof command !== 'string' || !command.trim()) {
      throw createError('Shell command is required', 400);
    }

    const deviceCommand = {
      id: uuidv4(),
      deviceId: req.params.id,
      type: 'shell' as const,
      payload: { command },
      timestamp: new Date(),
      status: 'pending' as const
    };

    await deviceService.executeCommand(deviceCommand);

    res.json({
      success: true,
      data: deviceCommand,
      message: 'Shell command executed successfully'
    });
  }));

  // Get device sessions
  router.get('/:id/sessions', asyncHandler(async (req: Request, res: Response) => {
    const sessions = deviceService.getDeviceSessions(req.params.id);

    res.json({
      success: true,
      data: sessions
    });
  }));

  // Get device reservations
  router.get('/:id/reservations', asyncHandler(async (req: Request, res: Response) => {
    const reservations = deviceService.getActiveReservations()
      .filter(r => r.deviceId === req.params.id);

    res.json({
      success: true,
      data: reservations
    });
  }));

  return router;
}