// API utility to handle different environments
const getApiBaseUrl = () => {
  if (import.meta.env.PROD) {
    // Production: Use environment variable
    return import.meta.env.VITE_BACKEND_URL || 'https://auction-backend-l24v.onrender.com';
  } else {
    // Development: Use localhost (proxy handles this)
    return '';
  }
};

export const apiCall = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  return fetch(url, options);
};

export const API_BASE_URL = getApiBaseUrl();