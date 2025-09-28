const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const apiRequest = async (endpoint: string, options?: RequestInit) => {
  const url = `${API_BASE_URL}${endpoint}`;
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
};

export { API_BASE_URL };