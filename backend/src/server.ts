import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { DeviceService } from './services/DeviceService';
import { WebSocketService } from './services/WebSocketService';
import { MonitoringService } from './services/MonitoringService';
import { AppiumService } from './services/AppiumService';

import deviceRoutes from './routes/deviceRoutes';
import sessionRoutes from './routes/sessionRoutes';
import systemRoutes from './routes/systemRoutes';
import { createAppiumRoutes } from './routes/appiumRoutes';
import { createAnalyticsRoutes } from './routes/analyticsRoutes';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const deviceService = new DeviceService();
const appiumService = new AppiumService();
const webSocketService = new WebSocketService(io, deviceService);
const monitoringService = new MonitoringService(deviceService, webSocketService);

// Inject services to avoid circular dependencies
appiumService.setWebSocketService(webSocketService);
deviceService.setWebSocketService(webSocketService);
deviceService.setAppiumService(appiumService);

app.use('/api/devices', deviceRoutes(deviceService, appiumService));
app.use('/api/sessions', sessionRoutes(deviceService));
app.use('/api/system', systemRoutes(deviceService, monitoringService));
app.use('/api', createAppiumRoutes(appiumService, deviceService, webSocketService));
app.use('/api', createAnalyticsRoutes(deviceService));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    // Clean up any orphaned Appium processes first
    await appiumService.cleanupOrphanedProcesses();

    await deviceService.initialize();
    await monitoringService.start();

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${NODE_ENV} mode`);
      logger.info(`WebSocket server ready for connections`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await monitoringService.stop();
  await appiumService.stopAllServers();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  await monitoringService.stop();
  await appiumService.stopAllServers();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

if (require.main === module) {
  startServer();
}

export { app, server, io };