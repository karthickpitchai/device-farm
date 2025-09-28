import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CameraIcon,
  DevicePhoneMobileIcon,
  CommandLineIcon,
  PlayIcon,
  PauseIcon,
  HomeIcon,
  BackspaceIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

interface ScreenControlProps {
  deviceId: string;
  onTap: (x: number, y: number) => void;
}

function ScreenControl({ deviceId, onTap }: ScreenControlProps) {
  const [screenshotUrl, setScreenshotUrl] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { socket, startScreenMirroring, stopScreenMirroring } = useSocket();

  // Auto-start mirroring when component mounts
  useEffect(() => {
    if (!socket || !deviceId) return;

    let mounted = true;

    const initializeScreen = async () => {
      try {
        // Start mirroring immediately
        await startScreenMirroring(deviceId, 15); // 15 FPS for smooth performance
        if (mounted) {
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Failed to start mirroring:', error);
        toast.error('Failed to connect to device screen');
      }
    };

    initializeScreen();

    // Cleanup on unmount
    return () => {
      mounted = false;
      stopScreenMirroring(deviceId).catch(console.error);
    };
  }, [socket, deviceId]);

  useEffect(() => {
    if (!socket) return;

    const handleScreenUpdate = (screenshot: any) => {
      if (screenshot && screenshot.data) {
        // Convert Base64 data to data URL
        const dataUrl = `data:${screenshot.mimeType || 'image/png'};base64,${screenshot.data}`;
        setScreenshotUrl(dataUrl);
        setIsConnected(true);
      }
    };

    socket.on('screen:update', handleScreenUpdate);

    return () => {
      socket.off('screen:update', handleScreenUpdate);
    };
  }, [socket]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // Get the image element to get device's actual resolution
    const img = canvas.querySelector('img') as HTMLImageElement;
    if (!img) return;

    // Calculate the scale factors based on device's actual screen resolution vs canvas size
    const deviceScaleX = img.naturalWidth / rect.width;
    const deviceScaleY = img.naturalHeight / rect.height;

    // Calculate actual device coordinates
    const x = (e.clientX - rect.left) * deviceScaleX;
    const y = (e.clientY - rect.top) * deviceScaleY;

    // Show visual feedback for tap
    const tapIndicator = document.createElement('div');
    tapIndicator.className = 'absolute w-6 h-6 bg-blue-500 bg-opacity-50 rounded-full pointer-events-none animate-ping';
    tapIndicator.style.left = `${e.clientX - rect.left - 12}px`;
    tapIndicator.style.top = `${e.clientY - rect.top - 12}px`;

    const container = canvas.parentElement;
    if (container) {
      container.appendChild(tapIndicator);
      setTimeout(() => {
        if (container.contains(tapIndicator)) {
          container.removeChild(tapIndicator);
        }
      }, 600);
    }

    onTap(Math.round(x), Math.round(y));
  };

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Device Screen</h3>
          <div className="flex items-center space-x-2">
            <div className={`flex items-center text-sm ${isConnected ? 'text-green-600' : 'text-yellow-600'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              {isConnected ? 'Live' : 'Connecting...'}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="relative bg-black rounded-lg overflow-hidden mx-auto shadow-lg" style={{ width: '100%', maxWidth: '480px', aspectRatio: '9/16', minHeight: '600px' }}>
          {screenshotUrl ? (
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-full object-cover cursor-crosshair block"
            >
              <img
                src={screenshotUrl}
                alt="Device Screenshot"
                className="w-full h-full object-cover"
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  const canvas = canvasRef.current;
                  if (canvas) {
                    // Set canvas size to match container
                    const container = canvas.parentElement;
                    if (container) {
                      canvas.width = container.clientWidth;
                      canvas.height = container.clientHeight;

                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        // Clear and draw the image to fill the canvas
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                      }
                    }
                  }
                }}
              />
            </canvas>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <div className="text-center">
                <DevicePhoneMobileIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg opacity-75">
                  {isConnected ? 'Loading device screen...' : 'Connecting to device...'}
                </p>
                <p className="text-sm opacity-50 mt-2">Tap anywhere on the screen to interact</p>
                <div className="mt-4 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface VirtualKeysProps {
  onKeyPress: (keyCode: number) => void;
}

function VirtualKeys({ onKeyPress }: VirtualKeysProps) {
  const [pressedKey, setPressedKey] = useState<number | null>(null);

  const keys = [
    { name: 'Home', code: 3, icon: HomeIcon },
    { name: 'Back', code: 4, icon: ArrowLeftIcon },
    { name: 'Menu', code: 82, icon: Bars3Icon },
    { name: 'Power', code: 26, icon: null },
    { name: 'Volume Up', code: 24, icon: null },
    { name: 'Volume Down', code: 25, icon: null },
  ];

  const handleKeyPress = (keyCode: number) => {
    setPressedKey(keyCode);
    onKeyPress(keyCode);
    setTimeout(() => setPressedKey(null), 200); // Visual feedback for 200ms
  };

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium text-gray-900">Virtual Keys</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {keys.map((key) => (
            <button
              key={key.code}
              onClick={() => handleKeyPress(key.code)}
              className={`btn flex items-center justify-center transition-all duration-200 ${
                pressedKey === key.code ? 'btn-primary scale-95' : 'btn-secondary hover:btn-primary'
              }`}
            >
              {key.icon && <key.icon className="w-4 h-4 mr-2" />}
              {key.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface TextInputProps {
  onSendText: (text: string) => void;
}

function TextInput({ onSendText }: TextInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSendText(text);
      setText('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium text-gray-900">Text Input</h3>
      </div>
      <div className="p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type text to send to device..."
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="btn btn-primary"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

interface ShellCommandProps {
  onExecuteCommand: (command: string) => void;
}

function ShellCommand({ onExecuteCommand }: ShellCommandProps) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<Array<{ command: string; timestamp: Date }>>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onExecuteCommand(command);
      setHistory(prev => [...prev, { command, timestamp: new Date() }].slice(-10));
      setCommand('');
    }
  };

  const commonCommands = [
    'ps',
    'ls /sdcard/',
    'dumpsys battery',
    'input keyevent 4',
    'am start -a android.intent.action.MAIN -c android.intent.category.HOME'
  ];

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <CommandLineIcon className="w-5 h-5 mr-2" />
          Shell Commands
        </h3>
      </div>
      <div className="p-4 space-y-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="adb shell command..."
            className="input flex-1 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={!command.trim()}
            className="btn btn-primary"
          >
            Execute
          </button>
        </form>

        <div>
          <p className="text-sm text-gray-600 mb-2">Common Commands:</p>
          <div className="flex flex-wrap gap-2">
            {commonCommands.map((cmd) => (
              <button
                key={cmd}
                onClick={() => setCommand(cmd)}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-mono"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>

        {history.length > 0 && (
          <div>
            <p className="text-sm text-gray-600 mb-2">Recent Commands:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {history.slice().reverse().map((item, index) => (
                <div
                  key={index}
                  className="text-xs font-mono text-gray-600 bg-gray-50 p-2 rounded cursor-pointer hover:bg-gray-100"
                  onClick={() => setCommand(item.command)}
                >
                  {item.command}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DeviceDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { devices, sendCommand, reserveDevice, releaseDevice } = useSocket();

  const device = devices.find(d => d.id === deviceId);

  const handleTap = async (x: number, y: number) => {
    if (!deviceId) return;

    try {
      // Send command immediately without waiting for response
      sendCommand(deviceId, 'tap', { x, y });
      // No toast notification for tap - too frequent and distracting
    } catch (error) {
      // Tap commands fail silently to avoid UI clutter
    }
  };

  const handleKeyPress = async (keyCode: number) => {
    if (!deviceId) return;

    try {
      await sendCommand(deviceId, 'key', { keyCode });
      // Visual feedback in the button itself instead of toast
    } catch (error) {
      // Key events fail silently to avoid UI clutter
    }
  };

  const handleSendText = async (text: string) => {
    if (!deviceId) return;

    try {
      await sendCommand(deviceId, 'text', { text });
      // Text commands execute silently
    } catch (error) {
      // Text input fails silently to avoid UI clutter
    }
  };

  const handleExecuteCommand = async (command: string) => {
    if (!deviceId) return;

    try {
      await sendCommand(deviceId, 'shell', { command });
      // Shell commands execute silently
    } catch (error) {
      // Shell commands fail silently to avoid UI clutter
    }
  };

  const handleReserve = async () => {
    if (!deviceId) return;

    try {
      await reserveDevice(deviceId, 'user1', 60, 'Manual testing');
    } catch (error) {
      toast.error('Failed to reserve device');
    }
  };

  const handleRelease = async () => {
    if (!deviceId) return;

    try {
      await releaseDevice(deviceId);
    } catch (error) {
      toast.error('Failed to release device');
    }
  };

  if (!device) {
    return (
      <div className="text-center py-12">
        <DevicePhoneMobileIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-medium text-gray-900 mb-2">Device not found</h2>
        <p className="text-gray-500 mb-6">The device you're looking for doesn't exist or is no longer available.</p>
        <Link to="/devices" className="btn btn-primary">
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Devices
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link to="/devices" className="btn btn-secondary mr-4">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{device.name}</h1>
            <p className="text-sm text-gray-600">
              {device.manufacturer} • Android {device.androidVersion}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className={`badge ${
            device.status === 'online' ? 'badge-success' :
            device.status === 'reserved' ? 'badge-warning' :
            device.status === 'in-use' ? 'badge-primary' :
            'badge-gray'
          }`}>
            {device.status}
          </span>

          {device.status === 'online' && (
            <button onClick={handleReserve} className="btn btn-primary">
              <PlayIcon className="w-4 h-4 mr-2" />
              Reserve
            </button>
          )}

          {device.status === 'reserved' && (
            <button onClick={handleRelease} className="btn btn-warning">
              <PauseIcon className="w-4 h-4 mr-2" />
              Release
            </button>
          )}
        </div>
      </div>

      {/* Device Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Device Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Serial:</span>
              <span className="text-gray-900 font-mono">{device.serialNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API Level:</span>
              <span className="text-gray-900">{device.apiLevel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Resolution:</span>
              <span className="text-gray-900">{device.screenResolution || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Orientation:</span>
              <span className="text-gray-900 capitalize">{device.orientation || 'Unknown'}</span>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Battery Status</h3>
          <div className="space-y-2">
            {device.batteryLevel && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Level:</span>
                  <span className="text-gray-900">{device.batteryLevel}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full">
                  <div
                    className={`h-2 rounded-full ${
                      device.batteryLevel > 50 ? 'bg-success-500' :
                      device.batteryLevel > 20 ? 'bg-warning-500' : 'bg-danger-500'
                    }`}
                    style={{ width: `${device.batteryLevel}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Connection Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Connected:</span>
              <span className="text-gray-900">
                {device.connectedAt ? new Date(device.connectedAt).toLocaleString() : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Last Seen:</span>
              <span className="text-gray-900">
                {new Date(device.lastSeen).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <ScreenControl deviceId={device.id} onTap={handleTap} />
        </div>

        <div className="space-y-6">
          <VirtualKeys onKeyPress={handleKeyPress} />
          <TextInput onSendText={handleSendText} />
          <ShellCommand onExecuteCommand={handleExecuteCommand} />
        </div>
      </div>
    </div>
  );
}