import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DevicePhoneMobileIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  CpuChipIcon,
  ServerIcon
} from '@heroicons/react/24/outline';
import { useSocket } from '../hooks/useSocket';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  color: 'green' | 'blue' | 'yellow' | 'red' | 'gray';
  subtitle?: string;
  filterStatus?: string;
}

function StatCard({ title, value, icon: Icon, color, subtitle, filterStatus }: StatCardProps) {
  const navigate = useNavigate();

  const colorClasses = {
    green: 'bg-success-50 text-success-600 border-success-200',
    blue: 'bg-primary-50 text-primary-600 border-primary-200',
    yellow: 'bg-warning-50 text-warning-600 border-warning-200',
    red: 'bg-danger-50 text-danger-600 border-danger-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200'
  };

  const handleClick = () => {
    if (filterStatus) {
      navigate(`/devices?status=${filterStatus}`);
    }
  };

  return (
    <div
      className={`card p-6 ${filterStatus ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200' : ''}`}
      onClick={handleClick}
    >
      <div className="flex items-center">
        <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { devices, systemHealth, logs } = useSocket();

  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    reserved: devices.filter(d => d.status === 'reserved').length,
    inUse: devices.filter(d => d.status === 'in-use').length,
    offline: devices.filter(d => d.status === 'offline').length
  };

  const recentLogs = logs.slice(0, 10);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total Devices"
          value={stats.total}
          icon={DevicePhoneMobileIcon}
          color="gray"
          filterStatus="all"
        />
        <StatCard
          title="Online"
          value={stats.online}
          icon={CheckCircleIcon}
          color="green"
          filterStatus="online"
        />
        <StatCard
          title="Reserved"
          value={stats.reserved}
          icon={ClockIcon}
          color="yellow"
          filterStatus="reserved"
        />
        <StatCard
          title="In Use"
          value={stats.inUse}
          icon={CpuChipIcon}
          color="blue"
          filterStatus="in-use"
        />
        <StatCard
          title="Offline"
          value={stats.offline}
          icon={ExclamationCircleIcon}
          color="red"
          filterStatus="offline"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <ServerIcon className="w-5 h-5 mr-2" />
              System Health
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Status</span>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  systemHealth?.status === 'healthy' ? 'bg-success-500' :
                  systemHealth?.status === 'degraded' ? 'bg-warning-500' : 'bg-danger-500'
                }`} />
                <span className="text-sm text-gray-900 capitalize">
                  {systemHealth?.status || 'Unknown'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Uptime</span>
              <span className="text-sm text-gray-900">
                {systemHealth?.uptime ? formatUptime(systemHealth.uptime) : '0h 0m'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Memory Usage</span>
              <div className="text-right">
                <span className="text-sm text-gray-900">
                  {systemHealth?.memory ? formatBytes(systemHealth.memory.used) : '0 MB'}
                </span>
                <div className="w-20 h-2 bg-gray-200 rounded-full mt-1">
                  <div
                    className="h-2 bg-primary-500 rounded-full"
                    style={{
                      width: `${systemHealth?.memory?.percentage || 0}%`
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">CPU Usage</span>
              <div className="text-right">
                <span className="text-sm text-gray-900">
                  {systemHealth?.cpu?.usage?.toFixed(1) || '0.0'}%
                </span>
                <div className="w-20 h-2 bg-gray-200 rounded-full mt-1">
                  <div
                    className="h-2 bg-warning-500 rounded-full"
                    style={{
                      width: `${systemHealth?.cpu?.usage || 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin">
              {recentLogs.length > 0 ? (
                recentLogs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      log.level === 'error' ? 'bg-danger-500' :
                      log.level === 'warn' ? 'bg-warning-500' :
                      log.level === 'info' ? 'bg-primary-500' : 'bg-gray-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {log.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        {log.tag} • {new Date(log.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Device Status Overview */}
      <div className="card">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Device Overview</h3>
          <Link
            to="/devices"
            className="text-sm text-primary-600 hover:text-primary-900 font-medium"
          >
            View All Devices →
          </Link>
        </div>
        <div className="p-6">
          {devices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {devices.map((device) => (
                <Link
                  key={device.id}
                  to={`/devices/${device.id}`}
                  className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 hover:border-primary-300"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 truncate">{device.name}</h4>
                    <span className={`badge ${
                      device.status === 'online' ? 'badge-success' :
                      device.status === 'reserved' ? 'badge-warning' :
                      device.status === 'in-use' ? 'badge-primary' :
                      'badge-gray'
                    }`}>
                      {device.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{device.manufacturer}</p>
                  <p className="text-sm text-gray-500">
                    {device.platform === 'ios'
                      ? `iOS ${device.platformVersion}${device.deviceType === 'simulator' ? ' (Simulator)' : ''}`
                      : `Android ${device.platformVersion}`
                    }
                  </p>
                  {device.batteryLevel && (
                    <div className="mt-2 flex items-center">
                      <span className="text-xs text-gray-500 mr-2">Battery:</span>
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                        <div
                          className="h-1.5 rounded-full bg-sky-400"
                          style={{ width: `${device.batteryLevel}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 ml-2">{device.batteryLevel}%</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <DevicePhoneMobileIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No devices connected</p>
              <p className="text-sm text-gray-400 mt-2">
                Connect an Android device with USB debugging enabled
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}