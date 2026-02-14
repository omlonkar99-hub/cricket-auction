// Script to fix all API calls in frontend components
const fs = require('fs');
const path = require('path');

const componentsToFix = [
  'frontend/src/components/DashboardHome.jsx',
  'frontend/src/components/RetentionWaitingRoom.jsx',
  'frontend/src/components/RetentionWindow.jsx',
  'frontend/src/components/RetentionAuctionContainer.jsx',
  'frontend/src/components/RetentionReview.jsx',
  'frontend/src/components/PostAuctionActions.jsx',
  'frontend/src/components/ManageTeams.jsx',
  'frontend/src/components/ManagePlayers.jsx',
  'frontend/src/components/auction-creation/TeamSelection.jsx',
  'frontend/src/components/CreateRetentionAuction.jsx',
  'frontend/src/components/auction-creation/RoleOrder.jsx',
  'frontend/src/components/auction-creation/ReviewAuction.jsx',
  'frontend/src/components/auction-creation/PlayerSelection.jsx',
  'frontend/src/components/auction-creation/PlayerOrder.jsx',
  'frontend/src/components/AuditLogs.jsx',
  'frontend/src/components/AuctionWaitingRoom.jsx',
  'frontend/src/components/AuctionSummary.jsx'
];

componentsToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add import if not present
    if (!content.includes("import { apiCall }")) {
      // Find the last import line
      const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
      const lastImportIndex = content.lastIndexOf(importLines[importLines.length - 1]);
      const insertIndex = content.indexOf('\n', lastImportIndex) + 1;
      
      content = content.slice(0, insertIndex) + 
                "import { apiCall } from '../utils/api';\n" + 
                content.slice(insertIndex);
    }
    
    // Replace fetch('/api/ with apiCall('/api/
    content = content.replace(/fetch\('\/api\//g, "apiCall('/api/");
    content = content.replace(/fetch\(`\/api\//g, "apiCall(`/api/");
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${filePath}`);
  } else {
    console.log(`❌ Not found: ${filePath}`);
  }
});

console.log('\n🎉 All API calls fixed!');
console.log('📝 Remember to:');
console.log('1. Add VITE_BACKEND_URL to Vercel environment variables');
console.log('2. Push changes to trigger redeployment');
console.log('3. Test login and other API calls');