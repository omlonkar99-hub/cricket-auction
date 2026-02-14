# UptimeRobot Setup Guide

## Quick Setup Steps

### 1. Create Account
- Go to [uptimerobot.com](https://uptimerobot.com)
- Sign up (free tier gives 50 monitors, 5-minute intervals)

### 2. Add Monitor
```
Monitor Type: HTTP(s)
Friendly Name: Cricket Auction API
URL: https://your-app-name.onrender.com/health
Interval: 5 minutes
Timeout: 30 seconds
Method: GET
```

### 3. Expected Response
Your health endpoint should return:
```json
{
  "status": "healthy",
  "timestamp": "2024-02-14T10:30:00Z",
  "service": "cricket-auction-api"
}
```

## Benefits for Your App

### 1. **Keeps Server Warm**
- Render free tier sleeps after 15 minutes of inactivity
- UptimeRobot pings every 5 minutes → server stays awake
- Users get faster response times (no cold starts)

### 2. **Monitoring & Alerts**
- Get notified if your app goes down
- Track uptime statistics
- Monitor response times

### 3. **Free Tier Limits**
- 50 monitors (you only need 1)
- 5-minute check intervals
- Email alerts
- 2-month log retention

## Testing Your Setup

### Before UptimeRobot:
1. Test your health endpoint:
   ```bash
   curl https://your-app-name.onrender.com/health
   ```

2. Or use the test script:
   ```bash
   # Update the URL in test-health-endpoint.js first
   node test-health-endpoint.js
   ```

### After UptimeRobot:
1. Check UptimeRobot dashboard for green status
2. Verify your app doesn't go to sleep
3. Test WebSocket connections stay alive during idle periods

## Advanced Configuration (Optional)

### Custom Headers
If you need authentication:
```
Custom HTTP Headers:
Authorization: Bearer your-token
```

### Keyword Monitoring
Monitor for specific text in response:
```
Keyword: "healthy"
Keyword Type: exists
```

### Multiple Endpoints
You can also monitor:
- `https://your-app.onrender.com/api/health` (API health)
- `https://your-app.onrender.com/` (Frontend health)

## Troubleshooting

### Common Issues:
1. **404 Error**: Check if `/health` endpoint is deployed
2. **Timeout**: Render app might be sleeping (wait 30s for cold start)
3. **SSL Issues**: Use `https://` for Render apps

### Verification Commands:
```bash
# Test health endpoint
curl -v https://your-app-name.onrender.com/health

# Check if server is responding
curl -I https://your-app-name.onrender.com/

# Test with timeout
curl --max-time 30 https://your-app-name.onrender.com/health
```

## Expected Results

Once set up correctly:
- ✅ UptimeRobot shows 99%+ uptime
- ✅ Your app responds faster (no cold starts)
- ✅ WebSocket connections stay alive in auction rooms
- ✅ Users don't experience disconnections during idle periods

## Cost
- **Free tier**: Perfect for your needs
- **Paid tiers**: Available if you need 1-minute intervals or more monitors