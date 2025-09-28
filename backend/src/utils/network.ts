import os from 'os';

export function getServerIpAddress(): string {
  const networkInterfaces = os.networkInterfaces();

  // Try to find the first non-internal IPv4 address
  for (const interfaceName in networkInterfaces) {
    const networkInterface = networkInterfaces[interfaceName];
    if (networkInterface) {
      for (const config of networkInterface) {
        // Skip internal addresses and IPv6
        if (!config.internal && config.family === 'IPv4') {
          return config.address;
        }
      }
    }
  }

  // Fallback to localhost if no external IP found
  return 'localhost';
}