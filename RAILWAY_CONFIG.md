# 🚂 Railway Configuration for Production

## Your Railway URL
**Base URL**: `https://fyers-production-bc19.up.railway.app`

## Required Configuration

### 1. Railway Environment Variables

In Railway Dashboard → Your Project → Variables, set these:

```
FYERS_APP_ID=WPRK56TF2X-100
FYERS_SECRET=I46BU8P4DM
FYERS_REDIRECT_URI=https://fyers-production-bc19.up.railway.app/callback
FYERS_API_BASE=https://api.fyers.in
FYERS_DATA_BASE=https://api.fyers.in
```

### 2. Fyers Dashboard Configuration

1. Go to [myapi.fyers.in/dashboard](https://myapi.fyers.in/dashboard)
2. Find your app: `WPRK56TF2X-100`
3. Add redirect URI: `https://fyers-production-bc19.up.railway.app/callback`
4. Save the changes

### 3. Endpoints

After deployment, your endpoints will be:

- **Home/Status**: `https://fyers-production-bc19.up.railway.app/`
- **Health Check**: `https://fyers-production-bc19.up.railway.app/health`
- **Auth**: `https://fyers-production-bc19.up.railway.app/auth`
- **Callback**: `https://fyers-production-bc19.up.railway.app/callback`
- **Quotes**: `https://fyers-production-bc19.up.railway.app/quotes?symbols=NSE:RELIANCE-EQ,NSE:TCS-EQ`

### 4. After First Authentication

Once you authenticate via `/auth`, copy the tokens from Railway logs and add to Railway Variables:

```
FYERS_ACCESS_TOKEN=<your_access_token>
FYERS_REFRESH_TOKEN=<your_refresh_token>
```

This makes tokens persist across deployments.

## Troubleshooting

If you see 502 errors:
1. Check Railway logs for errors
2. Verify all environment variables are set
3. Make sure the code is deployed (check Railway → Deployments)
4. Ensure the service is running (Railway → Metrics)

