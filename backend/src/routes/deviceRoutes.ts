import { Router, Request, Response } from 'express';
import { DeviceService } from '../services/DeviceService';
import { AppiumService } from '../services/AppiumService';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

export default function deviceRoutes(deviceService: DeviceService, appiumService: AppiumService) {
  const router = Router();

  // Configure multer for app file uploads
  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'apps');
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 500 * 1024 * 1024 // 500MB max file size
    },
    fileFilter: (req, file, cb) => {
      const allowedExtensions = ['.apk', '.ipa', '.app', '.zip'];
      const ext = path.extname(file.originalname).toLowerCase();
      const originalName = file.originalname.toLowerCase();

      // Allow .zip files if they contain .app in the name (for iOS .app bundles)
      if (allowedExtensions.includes(ext) || (ext === '.zip' && originalName.includes('.app'))) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only APK, IPA, and APP files are allowed.'));
      }
    }
  });

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

  // Drag screen
  router.post('/:id/drag', asyncHandler(async (req: Request, res: Response) => {
    const { startX, startY, endX, endY, duration = 1000 } = req.body;

    if (typeof startX !== 'number' || typeof startY !== 'number' ||
        typeof endX !== 'number' || typeof endY !== 'number') {
      throw createError('Start and end coordinates are required', 400);
    }

    const command = {
      id: uuidv4(),
      deviceId: req.params.id,
      type: 'drag' as const,
      payload: { startX, startY, endX, endY, duration },
      timestamp: new Date(),
      status: 'pending' as const
    };

    await deviceService.executeCommand(command);

    res.json({
      success: true,
      data: command,
      message: 'Drag command executed successfully'
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

  // Install app on device
  router.post('/:id/install-app', upload.single('app'), asyncHandler(async (req: Request, res: Response) => {
    const deviceId = req.params.id;
    const device = deviceService.getDevice(deviceId);

    if (!device) {
      throw createError('Device not found', 404);
    }

    if (!req.file) {
      throw createError('No app file provided', 400);
    }

    let appPath = req.file.path;
    let extractedPath: string | null = null;

    try {
      // If it's a zip file, extract it first (for .app bundles)
      if (path.extname(req.file.originalname).toLowerCase() === '.zip') {
        const extractDir = path.join(path.dirname(appPath), `extracted-${Date.now()}`);
        await fs.mkdir(extractDir, { recursive: true });

        // Extract zip file using unzip command
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        await execAsync(`unzip -q "${appPath}" -d "${extractDir}"`);

        // Find the .app file in the extracted directory
        const files = await fs.readdir(extractDir);
        const appFile = files.find(f => f.endsWith('.app'));

        if (!appFile) {
          throw new Error('No .app file found in the zip archive');
        }

        extractedPath = extractDir;
        appPath = path.join(extractDir, appFile);
      }

      const result = await deviceService.installApp(deviceId, appPath);

      // Clean up the uploaded file and extracted directory after installation
      await fs.unlink(req.file.path).catch(err => {
        console.error('Failed to delete uploaded app file:', err);
      });

      if (extractedPath) {
        await fs.rm(extractedPath, { recursive: true, force: true }).catch(err => {
          console.error('Failed to delete extracted directory:', err);
        });
      }

      res.json({
        success: true,
        data: result,
        message: 'App installed successfully'
      });
    } catch (error) {
      // Clean up the uploaded file and extracted directory on error
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(err => {
          console.error('Failed to delete uploaded app file:', err);
        });
      }

      if (extractedPath) {
        await fs.rm(extractedPath, { recursive: true, force: true }).catch(err => {
          console.error('Failed to delete extracted directory:', err);
        });
      }

      throw error;
    }
  }));

  return router;
}