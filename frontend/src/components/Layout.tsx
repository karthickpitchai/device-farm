import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  DevicePhoneMobileIcon,
  PlayCircleIcon,
  ChartBarIcon,
  CommandLineIcon,
  Cog6ToothIcon,
  WifiIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useSocket } from '../hooks/useSocket';
import ConnectionStatus from './ConnectionStatus';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Devices', href: '/devices', icon: DevicePhoneMobileIcon },
  { name: 'Sessions', href: '/sessions', icon: PlayCircleIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Automation', href: '/automation', icon: CommandLineIcon },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { isConnected, systemHealth, devices } = useSocket();

  const onlineDevicesCount = devices.filter(d => d.status === 'online').length;
  const totalDevicesCount = devices.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center">
              <DevicePhoneMobileIcon className="w-8 h-8 text-primary-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">Device Farm</span>
            </div>
          </div>

          {/* Connection Status */}
          <div className="p-4 border-b border-gray-200">
            <ConnectionStatus />
          </div>

          {/* System Status */}
          <div className="p-4 border-b border-gray-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">System Health</span>
                <div className="flex items-center">
                  {systemHealth?.status === 'healthy' && (
                    <div className="w-2 h-2 bg-success-500 rounded-full mr-1" />
                  )}
                  {systemHealth?.status === 'degraded' && (
                    <div className="w-2 h-2 bg-warning-500 rounded-full mr-1" />
                  )}
                  {systemHealth?.status === 'unhealthy' && (
                    <div className="w-2 h-2 bg-danger-500 rounded-full mr-1" />
                  )}
                  <span className="text-gray-900 font-medium capitalize">
                    {systemHealth?.status || 'Unknown'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Devices</span>
                <span className="text-gray-900 font-medium">
                  {onlineDevicesCount}/{totalDevicesCount}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={classNames(
                    isActive
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    'group flex items-center px-3 py-2 text-sm font-medium border-l-4 transition-colors duration-200'
                  )}
                >
                  <item.icon
                    className={classNames(
                      isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500',
                      'mr-3 h-5 w-5'
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <p>Android Device Farm v1.0.0</p>
              <p className="mt-1">
                Uptime: {systemHealth?.uptime ? Math.floor(systemHealth.uptime / 3600) : 0}h
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-64">
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900">
                {navigation.find(nav => nav.href === location.pathname)?.name || 'Device Farm'}
              </h1>

              <div className="flex items-center space-x-4">
                {!isConnected && (
                  <div className="flex items-center text-sm text-danger-600">
                    <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                    Connection Lost
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}