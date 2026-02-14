// API utility to handle different environments
const getApiBaseUrl = () => {
  // Always use the backend URL in production environments
  const isProduction = typeof window !== 'undefined' && 
                      (window.location.hostname !== 'localhost' && 
                       window.location.hostname !== '127.0.0.1');
  
  if (isProduction) {
    const url = 'https://auction-backend-l24v.onrender.com';
    console.log('🚀 PRODUCTION: Using backend URL:', url);
    return url;
  }
  
  // Development - use proxy
  console.log('🔧 DEVELOPMENT: Using proxy');
  return '';
};

export const apiCall = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  console.log('📡 API Call:', url);
  
  return fetch(url, options);
};

export const API_BASE_URL = getApiBaseUrl();