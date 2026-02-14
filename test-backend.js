// Test script to check backend status and CORS
const testBackend = async () => {
  const backendUrl = 'https://auction-backend-l24v.onrender.com';
  
  console.log('Testing backend:', backendUrl);
  
  try {
    // Test health endpoint
    const healthResponse = await fetch(`${backendUrl}/health`);
    console.log('Health check status:', healthResponse.status);
    console.log('Health check headers:', Object.fromEntries(healthResponse.headers.entries()));
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.text();
      console.log('Health response:', healthData);
    }
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
  
  try {
    // Test CORS preflight for login endpoint
    const corsResponse = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://cricketive-auction.onrender.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log('CORS preflight status:', corsResponse.status);
    console.log('CORS preflight headers:', Object.fromEntries(corsResponse.headers.entries()));
  } catch (error) {
    console.error('CORS test failed:', error.message);
  }
};

testBackend();