// Test script to verify health endpoint is working
// Run with: node test-health-endpoint.js

const https = require('https');
const http = require('http');

// Your actual Render URL
const RENDER_URL = 'https://auction-backend-l24v.onrender.com/health';

function testHealthEndpoint(url) {
  const protocol = url.startsWith('https') ? https : http;
  
  console.log(`Testing health endpoint: ${url}`);
  console.log('---');
  
  const startTime = Date.now();
  
  const req = protocol.get(url, (res) => {
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Status Code: ${res.statusCode}`);
    console.log(`⏱️  Response Time: ${responseTime}ms`);
    console.log(`📋 Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        console.log(`📄 Response Body:`, jsonData);
        
        if (jsonData.status === 'healthy') {
          console.log('\n🎉 Health endpoint is working correctly!');
          console.log('✅ Ready for UptimeRobot monitoring');
        } else {
          console.log('\n⚠️  Health endpoint responded but status is not "healthy"');
        }
      } catch (e) {
        console.log(`📄 Raw Response:`, data);
        console.log('\n❌ Response is not valid JSON');
      }
    });
  });
  
  req.on('error', (error) => {
    console.log(`❌ Error: ${error.message}`);
    console.log('\n🔧 Make sure your Render app is deployed and running');
  });
  
  req.setTimeout(10000, () => {
    console.log('❌ Request timed out after 10 seconds');
    req.destroy();
  });
}

// Test the endpoint
testHealthEndpoint(RENDER_URL);

// Also test localhost if running locally
console.log('\n' + '='.repeat(50));
testHealthEndpoint('http://localhost:8080/health');