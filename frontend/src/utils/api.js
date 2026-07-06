const getApiBaseUrl = () => {
  // Get from environment variable or use default
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  
  // Fallback to localhost if not in env
  return 'http://localhost:8080';
};

// Get or create device UUID
const getOrCreateDeviceUUID = () => {
  if (typeof window === 'undefined') return '';
  
  let uuid = localStorage.getItem('deviceUUID');
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem('deviceUUID', uuid);
  }
  return uuid;
};

export const apiCall = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  // Auto-add X-Device-UUID header if not already present
  const headers = {
    ...options.headers
  };
  
  if (!headers['X-Device-UUID']) {
    headers['X-Device-UUID'] = getOrCreateDeviceUUID();
  }
  
  return fetch(url, {
    ...options,
    headers
  });
};

export const API_BASE_URL = getApiBaseUrl();