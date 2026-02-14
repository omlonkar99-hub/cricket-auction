// API utility to handle different environments
const getApiBaseUrl = () => {
  // FORCE backend URL for all production calls
  const isProduction = typeof window !== 'undefined' && 
                      (window.location.hostname === 'cricketive.vercel.app' || 
                       window.location.hostname.includes('vercel.app'));
  
  if (isProduction) {
    const url = 'https://auction-backend-l24v.onrender.com';
    console.log('🚀 PRODUCTION: Using backend URL:', url);
    return url;
  }
  
  // Development
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