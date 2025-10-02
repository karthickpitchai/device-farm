import React, { useState, useEffect, useRef } from 'react';
import {
  PlayIcon,
  StopIcon,
  CodeBracketIcon,
  ClipboardDocumentIcon,
  CommandLineIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  XMarkIcon,
  DevicePhoneMobileIcon,
  PauseIcon,
  TrashIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon
} from '@heroicons/react/24/outline';
import { useSocket } from '../hooks/useSocket';

interface AppiumServer {
  deviceId: string;
  deviceName: string;
  status: string;
  port: number;
  webDriverUrl: string;
  capabilities: any;
}

interface CompactDeviceScreenProps {
  deviceId: string;
  onTap?: (x: number, y: number) => void;
}

function CompactDeviceScreen({ deviceId, onTap }: CompactDeviceScreenProps) {
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
        // Start mirroring with lower FPS for logs modal
        await startScreenMirroring(deviceId, 5); // 5 FPS for logs modal
        if (mounted) {
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Failed to start mirroring:', error);
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
    if (!onTap) return;

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

    onTap(Math.round(x), Math.round(y));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">Device Screen</h4>
        <div className={`flex items-center text-xs ${isConnected ? 'text-green-600' : 'text-yellow-600'}`}>
          <div className={`w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          {isConnected ? 'Live' : 'Connecting...'}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0">
        <div
          className="relative bg-black rounded-lg overflow-hidden shadow-lg w-full"
          style={{
            aspectRatio: '9/16',
            height: 'auto',
            maxHeight: 'calc(85vh - 200px)'
          }}
        >
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
              <DevicePhoneMobileIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm opacity-75">
                {isConnected ? 'Loading screen...' : 'Connecting...'}
              </p>
              <div className="mt-2 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default function Automation() {
  const { devices, sendCommand } = useSocket();
  const [servers, setServers] = useState<AppiumServer[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState('automation-user');
  const [logsModal, setLogsModal] = useState<{
    isOpen: boolean;
    deviceId: string | null;
    deviceName: string | null;
    logs: string[];
    loading: boolean;
    isPaused: boolean;
    isFullscreen: boolean;
  }>({
    isOpen: false,
    deviceId: null,
    deviceName: null,
    logs: [],
    loading: false,
    isPaused: false,
    isFullscreen: false
  });
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchServers = async () => {
    try {
      const response = await fetch('/api/appium/servers');
      const data = await response.json();
      setServers(data.servers || []);
    } catch (error) {
      console.error('Failed to fetch Appium servers:', error);
    }
  };

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Debug loading state changes
  useEffect(() => {
    console.log('Loading state changed:', loading);
  }, [loading]);


  const startAppiumServer = (deviceId: string) => {
    console.log(`[DEBUG] Starting Appium server for device: ${deviceId}`);
    console.log(`[DEBUG] Current loading state before:`, loading);

    setLoading(prev => {
      const newState = { ...prev, [deviceId]: true };
      console.log(`[DEBUG] Setting loading state to:`, newState);
      return newState;
    });

    // Log the state after setting
    setTimeout(() => {
      console.log(`[DEBUG] Loading state after setLoading:`, loading);
    }, 100);

    // Start the API call in the background
    fetch(`/api/devices/${deviceId}/appium/auto-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userName,
        duration: 180,
        purpose: 'WebDriverIO Testing'
      })
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Failed to start Appium server');
      }
    })
    .then(data => {
      console.log('Appium server started successfully:', data);
      // Refresh servers list after successful start
      fetchServers();
    })
    .catch(error => {
      console.error('Failed to start Appium server:', error);
      alert('Failed to start Appium server');
    });

    // Set minimum loading duration (same as test loader pattern)
    setTimeout(() => {
      console.log(`[DEBUG] Stopping loader for device: ${deviceId}`);
      console.log(`[DEBUG] Current loading state before stopping:`, loading);

      setLoading(prev => {
        const newState = { ...prev, [deviceId]: false };
        console.log(`[DEBUG] Setting loading state to:`, newState);
        return newState;
      });
    }, 3000); // 3 seconds like the test loader
  };

  const stopAppiumServer = async (deviceId: string) => {
    setLoading(prev => ({ ...prev, [deviceId]: true }));
    try {
      const response = await fetch(`/api/devices/${deviceId}/appium/stop`, {
        method: 'POST'
      });

      if (response.ok) {
        await fetchServers();

        // Close logs modal if it's open for this device
        if (logsModal.isOpen && logsModal.deviceId === deviceId) {
          closeLogsModal();
        }
      } else {
        const error = await response.json();
        alert(`Failed to stop Appium server: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to stop Appium server:', error);
      alert('Failed to stop Appium server');
    } finally {
      setLoading(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(`${type}-copied`);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getWebDriverIOConfig = (server: AppiumServer) => {
    // Extract hostname from webDriverUrl to use server's actual IP
    const hostUrl = server.webDriverUrl ?
      new URL(server.webDriverUrl).hostname :
      window.location.hostname;

    return `// WebDriverIO Configuration
export const config = {
  runner: 'local',
  hostname: '${hostUrl}',
  port: ${server.port},
  path: '/wd/hub',

  capabilities: [{
    platformName: '${server.capabilities?.platformName || 'Android'}',
    'appium:platformVersion': '${server.capabilities?.['appium:platformVersion'] || ''}',
    'appium:deviceName': '${server.capabilities?.['appium:deviceName'] || ''}',
    'appium:udid': '${server.capabilities?.['appium:udid'] || ''}',
    'appium:automationName': 'UiAutomator2',
    'appium:newCommandTimeout': 300,
    'appium:noReset': true
  }],

  framework: 'mocha',
  mochaOpts: {
    timeout: 60000
  }
};`;
  };

  const fetchLogs = async (deviceId: string) => {
    try {
      // Check if server is still running
      const statusResponse = await fetch(`/api/devices/${deviceId}/appium/status`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.status === 'stopped' || statusData.status === 'error') {
          console.log('Appium server stopped, closing logs modal');
          closeLogsModal();
          return;
        }
      }

      const response = await fetch(`/api/devices/${deviceId}/appium/logs`);

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();

      setLogsModal(prev => ({
        ...prev,
        logs: data.logs || [],
        loading: false
      }));
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLogsModal(prev => ({
        ...prev,
        logs: ['Error fetching logs. Make sure the Appium server is running.'],
        loading: false
      }));
    }
  };

  const openLogsModal = async (deviceId: string, deviceName: string) => {
    setLogsModal({
      isOpen: true,
      deviceId,
      deviceName,
      logs: [],
      loading: true,
      isPaused: false,
      isFullscreen: false
    });

    // Initial fetch
    await fetchLogs(deviceId);

    // Start auto-refresh every 5 seconds for better readability
    logsIntervalRef.current = setInterval(() => {
      setLogsModal(prev => {
        if (prev.isOpen && prev.deviceId && !prev.isPaused) {
          fetchLogs(prev.deviceId);
        }
        return prev;
      });
    }, 5000);
  };

  const toggleLogsPause = () => {
    setLogsModal(prev => ({
      ...prev,
      isPaused: !prev.isPaused
    }));
  };

  const clearLogs = async () => {
    if (!logsModal.deviceId) return;

    try {
      const response = await fetch(`/api/devices/${logsModal.deviceId}/appium/logs`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to clear logs');
      }

      // Clear logs from the modal display
      setLogsModal(prev => ({
        ...prev,
        logs: []
      }));
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const toggleFullscreen = () => {
    setLogsModal(prev => ({
      ...prev,
      isFullscreen: !prev.isFullscreen
    }));
  };

  const closeLogsModal = () => {
    // Clear the interval when closing
    if (logsIntervalRef.current) {
      clearInterval(logsIntervalRef.current);
      logsIntervalRef.current = null;
    }

    setLogsModal({
      isOpen: false,
      deviceId: null,
      deviceName: null,
      logs: [],
      loading: false,
      isPaused: false,
      isFullscreen: false
    });
  };

  // Auto-scroll to bottom when logs update (unless paused)
  useEffect(() => {
    if (!logsModal.isPaused && logsEndRef.current && logsModal.logs.length > 0) {
      // Use a slower, more gradual scroll for better readability
      logsEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [logsModal.logs, logsModal.isPaused]);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (logsModal.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [logsModal.isOpen]);

  const availableDevices = devices.filter(device => {
    const hasRunningServer = servers.some(s => s.deviceId === device.id && s.status === 'running');
    return (device.status === 'online' || device.status === 'reserved' || device.status === 'in-use') && !hasRunningServer;
  });

  // Only show running servers for devices that are currently available
  const runningServers = servers.filter(server =>
    server.status === 'running' &&
    devices.some(device =>
      device.id === server.deviceId &&
      (device.status === 'online' || device.status === 'reserved' || device.status === 'in-use')
    )
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Automation Setup</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage Appium servers for WebDriverIO automation testing
        </p>
      </div>

      {/* User Configuration */}
      <div className="card p-4">
        <div className="flex items-center space-x-4">
          <label htmlFor="userName" className="text-sm font-medium text-gray-700">
            User Name:
          </label>
          <input
            type="text"
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="input flex-1 max-w-xs"
            placeholder="Enter your name"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-primary-50 rounded-lg">
              <CommandLineIcon className="w-6 h-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Running Servers</p>
              <p className="text-2xl font-semibold text-gray-900">{runningServers.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-success-50 rounded-lg">
              <CheckCircleIcon className="w-6 h-6 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available Devices</p>
              <p className="text-2xl font-semibold text-gray-900">{availableDevices.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-warning-50 rounded-lg">
              <ClockIcon className="w-6 h-6 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Reserved Devices</p>
              <p className="text-2xl font-semibold text-gray-900">
                {devices.filter(d => d.status === 'reserved').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Running Servers */}
      {runningServers.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Active Appium Servers</h3>

          <div className="space-y-4">
            {runningServers.map((server) => (
              <div key={server.deviceId} className={`card p-6 ${loading[server.deviceId] ? 'opacity-75' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-success-50 rounded-lg">
                        <CommandLineIcon className="w-5 h-5 text-success-600" />
                      </div>
                      <div className="ml-3">
                        <h4 className="font-medium text-gray-900">{server.deviceName}</h4>
                        <p className="text-sm text-gray-600">Port: {server.port}</p>
                      </div>
                      <span className="ml-4 badge badge-success">Running</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* WebDriver URL */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          WebDriver URL
                        </label>
                        <div className="flex">
                          <input
                            type="text"
                            value={server.webDriverUrl}
                            readOnly
                            className="input flex-1 font-mono text-sm"
                          />
                          <button
                            onClick={() => copyToClipboard(server.webDriverUrl, 'url')}
                            className="ml-2 btn btn-sm btn-secondary"
                          >
                            <ClipboardDocumentIcon className="w-4 h-4" />
                          </button>
                        </div>
                        {copiedUrl === 'url-copied' && (
                          <p className="text-xs text-success-600 mt-1">Copied to clipboard!</p>
                        )}
                      </div>

                      {/* WebDriverIO Config */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          WebDriverIO Configuration
                        </label>
                        <button
                          onClick={() => copyToClipboard(getWebDriverIOConfig(server), 'config')}
                          className="btn btn-sm btn-secondary w-full"
                        >
                          <CodeBracketIcon className="w-4 h-4 mr-2" />
                          Copy WebDriverIO Config
                        </button>
                        {copiedUrl === 'config-copied' && (
                          <p className="text-xs text-success-600 mt-1">Configuration copied to clipboard!</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 flex space-x-2">
                    <button
                      onClick={() => openLogsModal(server.deviceId, server.deviceName)}
                      className="btn btn-sm btn-secondary"
                    >
                      <DocumentTextIcon className="w-4 h-4 mr-2" />
                      View Execution Logs
                    </button>

                    <button
                      onClick={() => stopAppiumServer(server.deviceId)}
                      disabled={loading[server.deviceId]}
                      className={`btn btn-sm ${loading[server.deviceId] ? 'btn-secondary' : 'btn-danger'}`}
                    >
                      {loading[server.deviceId] ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                          Stopping...
                        </>
                      ) : (
                        <>
                          <StopIcon className="w-4 h-4 mr-2" />
                          Stop Server
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Devices */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Available Devices</h3>

        {availableDevices.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {availableDevices.map((device) => (
              <div key={device.id} className={`card p-6 transition-all duration-200 ${loading[device.id] ? 'opacity-75 pointer-events-none bg-gray-100' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <CommandLineIcon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="ml-3">
                        <h4 className="font-medium text-gray-900">{device.name}</h4>
                        <p className="text-sm text-gray-600">{device.manufacturer}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <span className={`badge ${
                          device.status === 'online' ? 'badge-success' :
                          device.status === 'reserved' ? 'badge-warning' : 'badge-gray'
                        }`}>
                          {device.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">OS:</span>
                        <span className="text-gray-900">
                          {device.platform === 'ios'
                            ? `iOS ${device.platformVersion}${device.deviceType === 'simulator' ? ' (Sim)' : ''}`
                            : `Android ${device.platformVersion}`
                          }
                        </span>
                      </div>
                      {device.batteryLevel && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Battery:</span>
                          <span className="text-gray-900">{device.batteryLevel}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => {
                      console.log(`[DEBUG] Button clicked for device: ${device.id}`);
                      console.log(`[DEBUG] Current loading state in onClick:`, loading);
                      console.log(`[DEBUG] loading[${device.id}]:`, loading[device.id]);
                      startAppiumServer(device.id);
                    }}
                    disabled={loading[device.id]}
                    className={`btn btn-sm w-full ${
                      loading[device.id]
                        ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'
                        : 'btn-primary'
                    }`}
                  >
                    {(() => {
                      console.log(`[DEBUG] Rendering button for ${device.id}, loading:`, loading[device.id]);
                      return loading[device.id] ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin text-white" />
                          Starting Appium Server...
                        </>
                      ) : (
                        <>
                          <PlayIcon className="w-4 h-4 mr-2" />
                          Start Appium Server
                        </>
                      );
                    })()}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <XCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No devices available</h3>
            <p className="text-gray-500">
              Connect Android devices or ensure they are online to start Appium servers
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Getting Started</h3>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-900">1. Start an Appium Server</h4>
            <p className="text-gray-600">Click "Start Appium Server" on any available device above.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">2. Copy Configuration</h4>
            <p className="text-gray-600">Use the "Copy WebDriverIO Config" button to get the complete configuration.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">3. Run Your Tests</h4>
            <p className="text-gray-600">Use the copied configuration in your WebDriverIO test suite to connect to the device.</p>
          </div>
        </div>
      </div>

      {/* Logs Modal */}
      {logsModal.isOpen && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${
          logsModal.isFullscreen ? 'p-0' : 'p-4'
        }`}>
          <div className={`bg-white shadow-xl w-full flex flex-col ${
            logsModal.isFullscreen ? 'max-w-full h-full rounded-none' : 'max-w-6xl h-[85vh] rounded-lg'
          }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center">
                <DocumentTextIcon className="w-6 h-6 text-gray-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Execution Logs - {logsModal.deviceName}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title={logsModal.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {logsModal.isFullscreen ? (
                    <ArrowsPointingInIcon className="w-5 h-5" />
                  ) : (
                    <ArrowsPointingOutIcon className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={closeLogsModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden">
              {logsModal.loading ? (
                <div className="flex items-center justify-center h-64 p-6">
                  <div className="flex items-center space-x-2">
                    <ArrowPathIcon className="w-5 h-5 animate-spin text-primary-600" />
                    <span className="text-gray-600">Loading logs...</span>
                  </div>
                </div>
              ) : (
                <div className="h-full flex">
                  {/* Device Screen Section - 30% */}
                  <div className="p-4 border-r border-gray-200 flex flex-col" style={{ width: '30%' }}>
                    {logsModal.deviceId && (
                      <CompactDeviceScreen
                        deviceId={logsModal.deviceId}
                        onTap={(x, y) => {
                          if (logsModal.deviceId) {
                            sendCommand(logsModal.deviceId, 'tap', { x, y });
                          }
                        }}
                      />
                    )}
                  </div>

                  {/* Logs Section - 70% */}
                  <div className="p-6 flex flex-col" style={{ width: '70%' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Execution Logs</h4>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={clearLogs}
                          className="btn btn-sm btn-danger z-10"
                          type="button"
                          disabled={logsModal.logs.length === 0}
                        >
                          <TrashIcon className="w-4 h-4 mr-1.5" />
                          Clear
                        </button>
                        <button
                          onClick={toggleLogsPause}
                          className={`btn btn-sm z-10 ${logsModal.isPaused ? 'btn-warning' : 'btn-secondary'}`}
                          type="button"
                        >
                          {logsModal.isPaused ? (
                            <>
                              <PlayIcon className="w-4 h-4 mr-1.5" />
                              Resume
                            </>
                          ) : (
                            <>
                              <PauseIcon className="w-4 h-4 mr-1.5" />
                              Pause
                            </>
                          )}
                        </button>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${logsModal.isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`}></div>
                          <span className="text-sm text-gray-500">
                            {logsModal.logs.length} entries
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-4 overflow-auto">
                      {logsModal.logs.length > 0 ? (
                        <>
                          {logsModal.logs.map((log, index) => (
                            <div key={index} className="mb-1">
                              {log}
                            </div>
                          ))}
                          <div ref={logsEndRef} />
                        </>
                      ) : (
                        <div className="text-gray-500">No logs available</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center p-6 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                Tap on the device screen (left panel) to interact with the device
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    const logText = logsModal.logs.join('\n');
                    navigator.clipboard.writeText(logText);
                  }}
                  className="btn btn-sm btn-secondary"
                >
                  <ClipboardDocumentIcon className="w-4 h-4 mr-2" />
                  Copy Logs
                </button>
                <button
                  onClick={closeLogsModal}
                  className="btn btn-sm btn-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}