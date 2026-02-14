// API utility to handle different environments
const getApiBaseUrl = () => {
  // Force production backend URL for now
  if (typeof window !== 'undefined') {
    // We're in the browser
    if (window.location.hostname === 'localhost') {
      // Development: Use proxy
      console.log('Using development proxy');
      return '';
    } else {
      // Production: Use hardcoded backend URL
      const url = 'https://auction-backend-l24v.onrender.com';
      console.log('Using backend URL:', url);
      return url;
    }
  }
  
  // Fallback
  return 'https://auction-backend-l24v.onrender.com';
};

export const apiCall = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  return fetch(url, options);
};

export const API_BASE_URL = getApiBaseUrl();