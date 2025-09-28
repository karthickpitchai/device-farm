import React from 'react';
import { WifiIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useSocket } from '../hooks/useSocket';

export default function ConnectionStatus() {
  const { isConnected, refreshDevices } = useSocket();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        {isConnected ? (
          <WifiIcon className="w-5 h-5 text-success-500" />
        ) : (
          <ExclamationTriangleIcon className="w-5 h-5 text-danger-500" />
        )}
        <span className="ml-2 text-sm font-medium text-gray-900">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <button
        onClick={refreshDevices}
        className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
        title="Refresh devices"
      >
        <ArrowPathIcon className="w-4 h-4" />
      </button>
    </div>
  );
}