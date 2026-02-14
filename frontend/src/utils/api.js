// API utility to handle different environments
const getApiBaseUrl = () => {
  console.log('Environment check:', {
    isProd: import.meta.env.PROD,
    backendUrl: import.meta.env.VITE_BACKEND_URL,
    mode: import.meta.env.MODE
  });
  
  if (import.meta.env.PROD) {
    // Production: Use environment variable or fallback to hardcoded URL
    const url = import.meta.env.VITE_BACKEND_URL || 'https://auction-backend-l24v.onrender.com';
    console.log('Using backend URL:', url);
    return url;
  } else {
    // Development: Use localhost (proxy handles this)
    console.log('Using development proxy');
    return '';
  }
};

export const apiCall = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  return fetch(url, options);
};

export const API_BASE_URL = getApiBaseUrl();