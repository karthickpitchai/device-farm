import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  DevicePhoneMobileIcon,
  EyeIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { useSocket } from '../hooks/useSocket';
import { Device } from '@/shared/types';
import { apiRequest } from '../utils/api';

// Android Icon Component
const AndroidIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.5 11.5 0 0 0-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85l1.84 3.18C4.25 11.24 2.5 13.88 2.5 17h19c0-3.12-1.75-5.76-3.9-7.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
  </svg>
);

// Apple Icon Component
const AppleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

// Device Icon with Platform Symbol
const DeviceIcon = ({ platform, status }: { platform: string; status: string }) => {
  const getColor = () => {
    switch (status) {
      case 'online':
        return platform === 'ios' ? 'text-green-700' : 'text-green-600';
      case 'offline':
        return 'text-gray-400';
      case 'reserved':
        return 'text-orange-600';
      case 'in-use':
        return 'text-blue-600';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="relative w-8 h-8">
      <DevicePhoneMobileIcon className={`w-8 h-8 ${getColor()}`} />
      {platform === 'ios' ? (
        <AppleIcon className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 ${getColor()}`} />
      ) : (
        <AndroidIcon className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 ${getColor()}`} />
      )}
    </div>
  );
};

interface DeviceCardProps {
  device: Device;
  onReserve: (device: Device) => void;
  onRelease: (device: Device) => void;
}

function DeviceCard({ device, onReserve, onRelease }: DeviceCardProps) {
  const canReserve = device.status === 'online';
  const canRelease = device.status === 'reserved';
  const isOffline = device.status === 'offline';

  return (
    <div className="card p-6 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div className={`p-3 rounded-lg ${
            device.status === 'online'
              ? 'bg-green-50'
              : device.status === 'offline'
              ? 'bg-gray-50'
              : device.status === 'reserved'
              ? 'bg-orange-50'
              : device.status === 'in-use'
              ? 'bg-blue-50'
              : 'bg-gray-50'
          }`}>
            <DeviceIcon platform={device.platform} status={device.status} />
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium text-gray-900">{device.name}</h3>
            <p className="text-sm text-gray-600">{device.manufacturer}</p>
            <p className="text-sm text-gray-500">
              {device.platform === 'ios'
                ? `iOS ${device.platformVersion}${device.deviceType === 'simulator' ? ' (Simulator)' : ''}`
                : `Android ${device.platformVersion} (API ${device.apiLevel})`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`badge ${
            device.status === 'online' ? 'badge-success' :
            device.status === 'reserved' ? 'badge-warning' :
            device.status === 'in-use' ? 'badge-primary' :
            'badge-gray'
          }`}>
            {device.status}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Resolution:</span>
          <span className="ml-1 text-gray-900">{device.screenResolution || 'Unknown'}</span>
        </div>
        <div>
          <span className="text-gray-500">Orientation:</span>
          <span className="ml-1 text-gray-900 capitalize">{device.orientation || 'Unknown'}</span>
        </div>
        {device.batteryLevel && (
          <div className="col-span-2">
            <span className="text-gray-500">Battery:</span>
            <div className="flex items-center mt-1">
              <div className="flex-1 h-2 bg-gray-200 rounded-full">
                <div
                  className="h-2 rounded-full bg-sky-400"
                  style={{ width: `${device.batteryLevel}%` }}
                />
              </div>
              <span className="ml-2 text-sm text-gray-900">{device.batteryLevel}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Last seen: {new Date(device.lastSeen).toLocaleString()}
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to={`/devices/${device.id}`}
            className="btn btn-sm btn-secondary"
          >
            <EyeIcon className="w-4 h-4 mr-1" />
            View
          </Link>

          {canReserve && (
            <button
              onClick={() => onReserve(device)}
              className="btn btn-sm btn-primary"
            >
              <PlayIcon className="w-4 h-4 mr-1" />
              Reserve
            </button>
          )}

          {canRelease && (
            <button
              onClick={() => onRelease(device)}
              className="btn btn-sm btn-warning"
            >
              <PauseIcon className="w-4 h-4 mr-1" />
              Release
            </button>
          )}

          {isOffline && (
            <span className="text-xs text-gray-500 px-3 py-1 bg-gray-100 rounded">
              Device offline
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ReserveModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onReserve: (deviceId: string, userId: string, duration: number, purpose: string) => void;
}

function ReserveModal({ device, isOpen, onClose, onReserve }: ReserveModalProps) {
  const [userId, setUserId] = useState('user1');
  const [duration, setDuration] = useState(60);
  const [purpose, setPurpose] = useState('Testing');

  if (!isOpen || !device) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onReserve(device.id, userId, duration, purpose);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Reserve Device: {device.name}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <input
              type="text"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="input"
              min="1"
              max="1440"
              required
            />
          </div>

          <div>
            <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
              Purpose
            </label>
            <input
              type="text"
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="flex items-center justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Reserve Device
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DeviceList() {
  const { devices, refreshDevices, reserveDevice, releaseDevice } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Read status filter from URL query parameters on mount
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, [searchParams]);

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.manufacturer.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;

    const matchesPlatform = platformFilter === 'all' || device.platform === platformFilter;

    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const handleReserve = (device: Device) => {
    setSelectedDevice(device);
    setReserveModalOpen(true);
  };

  const handleReserveSubmit = async (deviceId: string, userId: string, duration: number, purpose: string) => {
    try {
      // Use the auto-start endpoint that reserves device AND starts Appium server
      const response = await apiRequest(`/api/devices/${deviceId}/appium/auto-start`, {
        method: 'POST',
        body: JSON.stringify({ userId, duration, purpose })
      });

      if (response.ok) {
        // Refresh devices to update state across all tabs
        refreshDevices();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reserve device and start Appium server');
      }
    } catch (error) {
      console.error('Failed to reserve device:', error);
    }
  };

  const handleRelease = async (device: Device) => {
    try {
      // Use the Appium stop endpoint that stops server AND releases device
      const response = await apiRequest(`/api/devices/${device.id}/appium/stop`, {
        method: 'POST'
      });

      if (response.ok) {
        // Refresh devices to update state across all tabs
        refreshDevices();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to stop Appium server and release device');
      }
    } catch (error) {
      console.error('Failed to release device:', error);
    }
  };

  const statusCounts = {
    all: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    reserved: devices.filter(d => d.status === 'reserved').length,
    'in-use': devices.filter(d => d.status === 'in-use').length,
    offline: devices.filter(d => d.status === 'offline').length
  };

  const platformCounts = {
    all: devices.length,
    android: devices.filter(d => d.platform === 'android').length,
    ios: devices.filter(d => d.platform === 'ios').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Devices</h2>
            <p className="text-sm text-gray-600 mt-1">
              {filteredDevices.length} of {devices.length} devices
            </p>
          </div>

          {/* Platform Tabs - Moved to left side */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPlatformFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                platformFilter === 'all'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
              }`}
            >
              All ({platformCounts.all})
            </button>
            <button
              onClick={() => setPlatformFilter('android')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                platformFilter === 'android'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700'
              }`}
            >
              Android ({platformCounts.android})
            </button>
            <button
              onClick={() => setPlatformFilter('ios')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                platformFilter === 'ios'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              iOS ({platformCounts.ios})
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={refreshDevices}
            className="btn btn-primary"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          <div className="relative">
            <FunnelIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input pl-10 pr-8"
            >
              <option value="all">All Status ({statusCounts.all})</option>
              <option value="online">Online ({statusCounts.online})</option>
              <option value="reserved">Reserved ({statusCounts.reserved})</option>
              <option value="in-use">In Use ({statusCounts['in-use']})</option>
              <option value="offline">Offline ({statusCounts.offline})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Device Grid */}
      {filteredDevices.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onReserve={handleReserve}
              onRelease={handleRelease}
            />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <DevicePhoneMobileIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter !== 'all' || platformFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Connect an Android device (USB debugging) or iOS device/simulator'
            }
          </p>
          <button
            onClick={refreshDevices}
            className="btn btn-primary"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Refresh Devices
          </button>
        </div>
      )}

      {/* Reserve Modal */}
      <ReserveModal
        device={selectedDevice}
        isOpen={reserveModalOpen}
        onClose={() => setReserveModalOpen(false)}
        onReserve={handleReserveSubmit}
      />
    </div>
  );
}