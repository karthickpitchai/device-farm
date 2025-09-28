import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PlayCircleIcon,
  ClockIcon,
  UserIcon,
  DevicePhoneMobileIcon
} from '@heroicons/react/24/outline';
import { useSocket } from '../hooks/useSocket';

interface Session {
  id: string;
  deviceId: string;
  userId: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed' | 'failed';
}

function formatDuration(start: string, end?: string) {
  const startTime = new Date(start);
  const endTime = end ? new Date(end) : new Date();
  const duration = endTime.getTime() - startTime.getTime();

  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function Sessions() {
  const { devices } = useSocket();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      if (data.success) {
        setSessions(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const activeSessions = sessions.filter(s => s.status === 'active');
  const completedSessions = sessions.filter(s => s.status === 'completed').slice(0, 10);

  const getDeviceName = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    return device?.name || 'Unknown Device';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Sessions</h2>
          <p className="text-sm text-gray-600 mt-1">
            {activeSessions.length} active, {completedSessions.length} recent
          </p>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Active Sessions</h3>

        {activeSessions.length > 0 ? (
          <div className="space-y-3">
            {activeSessions.map((session) => (
              <div key={session.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <PlayCircleIcon className="w-6 h-6 text-primary-600" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">
                          {getDeviceName(session.deviceId)}
                        </h4>
                        <span className="badge badge-primary">Active</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600 mt-1 space-x-4">
                        <div className="flex items-center">
                          <UserIcon className="w-4 h-4 mr-1" />
                          {session.userId}
                        </div>
                        <div className="flex items-center">
                          <ClockIcon className="w-4 h-4 mr-1" />
                          {formatDuration(session.startTime)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/devices/${session.deviceId}`}
                      className="btn btn-sm btn-secondary"
                    >
                      <DevicePhoneMobileIcon className="w-4 h-4 mr-1" />
                      View Device
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <PlayCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No active sessions</p>
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Recent Sessions</h3>

        {completedSessions.length > 0 ? (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {completedSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <DevicePhoneMobileIcon className="w-5 h-5 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">
                            {getDeviceName(session.deviceId)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <UserIcon className="w-4 h-4 text-gray-400 mr-1" />
                          <span className="text-sm text-gray-900">{session.userId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(session.startTime, session.endTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(session.startTime).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`badge ${
                          session.status === 'completed' ? 'badge-success' :
                          session.status === 'failed' ? 'badge-danger' :
                          'badge-gray'
                        }`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/devices/${session.deviceId}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View Device
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center">
            <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recent sessions</p>
          </div>
        )}
      </div>
    </div>
  );
}