import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ClockIcon,
  DevicePhoneMobileIcon,
  UserIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import { useSocket } from '../hooks/useSocket';
import { apiRequest } from '../utils/api';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<any>;
  color: 'blue' | 'green' | 'yellow' | 'red';
}

function MetricCard({ title, value, change, icon: Icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-primary-50 text-primary-600 border-primary-200',
    green: 'bg-success-50 text-success-600 border-success-200',
    yellow: 'bg-warning-50 text-warning-600 border-warning-200',
    red: 'bg-danger-50 text-danger-600 border-danger-200'
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        </div>

        {change !== undefined && (
          <div className="text-right">
            <div className={`flex items-center text-sm ${
              change >= 0 ? 'text-success-600' : 'text-danger-600'
            }`}>
              {change >= 0 ? (
                <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
              ) : (
                <ArrowTrendingDownIcon className="w-4 h-4 mr-1" />
              )}
              {Math.abs(change)}%
            </div>
            <p className="text-xs text-gray-500">vs last week</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface AnalyticsData {
  totalSessions: number;
  averageSessionDuration: string;
  deviceUtilization: number;
  peakUsageHour: string;
  sessionsChange: number;
  durationChange: number;
  utilizationChange: number;
}

interface DeviceUsageData {
  id: string;
  name: string;
  usage: number;
  sessions: number;
  avgDuration: number;
  lastSession: number | null;
  totalUsage: number;
}

interface HourlyUsageData {
  hour: string;
  usage: number;
  sessions: number;
}

export default function Analytics() {
  const { devices, systemHealth } = useSocket();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [deviceUsageData, setDeviceUsageData] = useState<DeviceUsageData[]>([]);
  const [hourlyUsage, setHourlyUsage] = useState<HourlyUsageData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      // Fetch all analytics data in parallel
      const [analyticsRes, deviceUsageRes, hourlyUsageRes] = await Promise.all([
        apiRequest('/api/analytics'),
        apiRequest('/api/analytics/devices'),
        apiRequest('/api/analytics/hourly')
      ]);

      const analyticsData = await analyticsRes.json();
      const deviceUsageResp = await deviceUsageRes.json();
      const hourlyUsageResp = await hourlyUsageRes.json();

      if (analyticsData.success) {
        setAnalytics(analyticsData.data);
      }

      if (deviceUsageResp.success) {
        setDeviceUsageData(deviceUsageResp.data);
      }

      if (hourlyUsageResp.success) {
        setHourlyUsage(hourlyUsageResp.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    // Refresh analytics data every 30 seconds
    const interval = setInterval(fetchAnalyticsData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Analytics</h2>
        <p className="text-sm text-gray-600 mt-1">
          Device farm usage statistics and insights
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Sessions"
          value={analytics.totalSessions}
          change={analytics.sessionsChange}
          icon={ChartBarIcon}
          color="blue"
        />
        <MetricCard
          title="Avg Session Duration"
          value={analytics.averageSessionDuration}
          change={analytics.durationChange}
          icon={ClockIcon}
          color="green"
        />
        <MetricCard
          title="Device Utilization"
          value={`${analytics.deviceUtilization}%`}
          change={analytics.utilizationChange}
          icon={DevicePhoneMobileIcon}
          color="yellow"
        />
        <MetricCard
          title="Peak Usage"
          value={analytics.peakUsageHour}
          icon={ArrowTrendingUpIcon}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Usage Chart */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Device Usage</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {deviceUsageData.map((device, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-900">{device.name}</span>
                      <span className="text-gray-600">{device.usage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full"
                        style={{ width: `${device.usage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                      <span>{device.sessions} sessions</span>
                      <span>Avg: {device.avgDuration}m</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hourly Usage */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Hourly Usage (Today)</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-12 gap-1 h-32">
              {hourlyUsage.map((data, index) => (
                <div key={index} className="flex flex-col justify-end items-center">
                  <div
                    className="w-full bg-primary-500 rounded-t min-h-1"
                    style={{ height: `${data.usage}%` }}
                  />
                  <span className="text-xs text-gray-500 mt-2 transform rotate-45 origin-bottom-left">
                    {data.hour}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Device Status Overview */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Device Status Overview</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Battery
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Session
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Usage
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deviceUsageData.map((deviceUsage) => {
                  const device = devices.find(d => d.id === deviceUsage.id);
                  return (
                    <tr key={deviceUsage.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <DevicePhoneMobileIcon className="w-5 h-5 text-gray-400 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{deviceUsage.name}</div>
                            <div className="text-sm text-gray-500">{device?.manufacturer || 'Unknown'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`badge ${
                          device?.status === 'online' ? 'badge-success' :
                          device?.status === 'reserved' ? 'badge-warning' :
                          device?.status === 'in-use' ? 'badge-primary' :
                          'badge-gray'
                        }`}>
                          {device?.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device?.batteryLevel ? (
                          <div className="flex items-center">
                            <div className="w-16 h-2 bg-gray-200 rounded-full mr-2">
                              <div
                                className={`h-2 rounded-full ${
                                  device.batteryLevel > 50 ? 'bg-success-500' :
                                  device.batteryLevel > 20 ? 'bg-warning-500' : 'bg-danger-500'
                                }`}
                                style={{ width: `${device.batteryLevel}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-900">{device.batteryLevel}%</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Unknown</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {deviceUsage.lastSession !== null ? `${deviceUsage.lastSession}h ago` : 'No sessions'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {deviceUsage.totalUsage > 0 ? `${Math.round(deviceUsage.totalUsage)}h` : '0h'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* System Performance */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">System Performance</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Memory Usage</span>
                <span className="text-gray-900 font-medium">
                  {systemHealth?.memory?.percentage?.toFixed(1) || 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full"
                  style={{ width: `${systemHealth?.memory?.percentage || 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">CPU Usage</span>
                <span className="text-gray-900 font-medium">
                  {systemHealth?.cpu?.usage?.toFixed(1) || 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-warning-500 h-2 rounded-full"
                  style={{ width: `${systemHealth?.cpu?.usage || 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">System Uptime</span>
                <span className="text-gray-900 font-medium">
                  {systemHealth?.uptime ? Math.floor(systemHealth.uptime / 3600) : 0}h
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-success-500 h-2 rounded-full" style={{ width: '85%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}