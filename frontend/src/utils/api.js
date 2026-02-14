// API utility to handle different environments
const getApiBaseUrl = () => {
  // Always use the backend URL in production environments
  const isProduction = typeof window !== 'undefined' && 
                      (window.location.hostname !== 'localhost' && 
                       window.location.hostname !== '127.0.0.1');
  
  if (isProduction) {
    const url = 'https://auction-backend-l24v.onrender.com';
    return url;
  }
  
  // Development - use proxy
  return '';
};

export const apiCall = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  return fetch(url, options);
};

export const API_BASE_URL = getApiBaseUrl();