import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { Device, WebSocketMessage, SystemHealth, DeviceLog } from '@/shared/types';
import toast from 'react-hot-toast';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  devices: Device[];
  systemHealth: SystemHealth | null;
  logs: DeviceLog[];
  refreshDevices: () => void;
  reserveDevice: (deviceId: string, userId: string, duration: number, purpose: string) => Promise<void>;
  releaseDevice: (deviceId: string) => Promise<void>;
  sendCommand: (deviceId: string, type: string, payload: any) => Promise<void>;
  startScreenMirroring: (deviceId: string, fps?: number) => Promise<void>;
  stopScreenMirroring: (deviceId: string) => Promise<void>;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [screenUpdateCallbacks, setScreenUpdateCallbacks] = useState<Map<string, (screenshot: any) => void>>(new Map());

  useEffect(() => {
    const socketInstance = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');

    socketInstance.on('connect', () => {
      setIsConnected(true);
      toast.success('Connected to device farm');
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      toast.error('Disconnected from device farm');
    });

    socketInstance.on('devices:list', (devicesList: Device[]) => {
      setDevices(devicesList);
    });

    socketInstance.on('device:updated', (device: Device) => {
      setDevices(prev =>
        prev.map(d => d.id === device.id ? device : d)
      );
    });

    socketInstance.on('system:health', (health: SystemHealth) => {
      setSystemHealth(health);
    });

    socketInstance.on('device:log', (log: DeviceLog) => {
      setLogs(prev => [log, ...prev].slice(0, 1000)); // Keep only last 1000 logs
    });

    socketInstance.on('device:reserved', (reservation) => {
      toast.success('Device reserved successfully');
    });

    socketInstance.on('device:released', () => {
      toast.success('Device released successfully');
    });

    // Screenshot handling is done in takeScreenshot function

    // Screen mirroring events
    socketInstance.on('screen:update', (screenshot) => {
      // This will be handled by individual components via callbacks
    });

    socketInstance.on('screen:mirror:started', (data) => {
      // Screen mirroring started silently
    });

    socketInstance.on('screen:mirror:stopped', (data) => {
      // Screen mirroring stopped silently
    });

    socketInstance.on('device:command:result', (result) => {
      // ADB commands execute silently without notifications
    });

    socketInstance.on('error', (error) => {
      toast.error(error.message || 'An error occurred');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const refreshDevices = () => {
    if (socket) {
      socket.emit('devices:refresh');
    }
  };

  const reserveDevice = async (deviceId: string, userId: string, duration: number, purpose: string) => {
    return new Promise<void>((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const onReserved = () => {
        clearTimeout(timeout);
        socket.off('device:reserved', onReserved);
        socket.off('error', onError);
        resolve();
      };

      const onError = (error: any) => {
        clearTimeout(timeout);
        socket.off('device:reserved', onReserved);
        socket.off('error', onError);
        reject(new Error(error.message || 'Reservation failed'));
      };

      socket.on('device:reserved', onReserved);
      socket.on('error', onError);

      socket.emit('device:reserve', { deviceId, userId, duration, purpose });
    });
  };

  const releaseDevice = async (deviceId: string) => {
    return new Promise<void>((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const onReleased = () => {
        clearTimeout(timeout);
        socket.off('device:released', onReleased);
        socket.off('error', onError);
        resolve();
      };

      const onError = (error: any) => {
        clearTimeout(timeout);
        socket.off('device:released', onReleased);
        socket.off('error', onError);
        reject(new Error(error.message || 'Release failed'));
      };

      socket.on('device:released', onReleased);
      socket.on('error', onError);

      socket.emit('device:release', { deviceId });
    });
  };


  const sendCommand = async (deviceId: string, type: string, payload: any) => {
    return new Promise<void>((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 15000);

      const onResult = (result: any) => {
        if (result.commandId === commandId) {
          clearTimeout(timeout);
          socket.off('device:command:result', onResult);
          if (result.success) {
            resolve();
          } else {
            reject(new Error(result.error || 'Command failed'));
          }
        }
      };

      socket.on('device:command:result', onResult);

      socket.emit('device:command', {
        id: commandId,
        deviceId,
        type,
        payload,
        timestamp: new Date(),
        status: 'pending'
      });
    });
  };

  const startScreenMirroring = async (deviceId: string, fps?: number): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Screen mirroring start timeout'));
      }, 10000);

      const onStarted = () => {
        clearTimeout(timeout);
        socket.off('screen:mirror:started', onStarted);
        socket.off('error', onError);
        resolve();
      };

      const onError = (error: any) => {
        clearTimeout(timeout);
        socket.off('screen:mirror:started', onStarted);
        socket.off('error', onError);
        reject(new Error(error.message || 'Screen mirroring failed'));
      };

      socket.on('screen:mirror:started', onStarted);
      socket.on('error', onError);

      socket.emit('screen:mirror:start', { deviceId, fps });
    });
  };

  const stopScreenMirroring = async (deviceId: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Screen mirroring stop timeout'));
      }, 5000);

      const onStopped = () => {
        clearTimeout(timeout);
        socket.off('screen:mirror:stopped', onStopped);
        socket.off('error', onError);
        resolve();
      };

      const onError = (error: any) => {
        clearTimeout(timeout);
        socket.off('screen:mirror:stopped', onStopped);
        socket.off('error', onError);
        reject(new Error(error.message || 'Screen mirroring stop failed'));
      };

      socket.on('screen:mirror:stopped', onStopped);
      socket.on('error', onError);

      socket.emit('screen:mirror:stop', { deviceId });
    });
  };

  const value: SocketContextValue = {
    socket,
    isConnected,
    devices,
    systemHealth,
    logs,
    refreshDevices,
    reserveDevice,
    releaseDevice,
    sendCommand,
    startScreenMirroring,
    stopScreenMirroring
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}