# 🚀 Deploying Fyers Helper to Railway

This guide will help you deploy the Fyers Helper to Railway so you can use an HTTPS URL for production.

## Step-by-Step Instructions

### 1. Prepare Your Code

Your code is already ready! The server uses `process.env.PORT` which Railway provides automatically.

### 2. Create a Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up or log in (you can use GitHub for quick signup)

### 3. Create a New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"** (recommended) OR **"Empty Project"**
3. If using GitHub:
   - Connect your GitHub account if needed
   - Select the repository containing this code
   - Railway will automatically detect it's a Node.js app

### 4. Configure Environment Variables

In Railway dashboard, go to your project → **Variables** tab and add:

```
FYERS_APP_ID=WPRK56TF2X-100
FYERS_SECRET=I46BU8P4DM
FYERS_API_BASE=https://api.fyers.in
FYERS_DATA_BASE=https://api.fyers.in
```

**Important:** Do NOT set `FYERS_REDIRECT_URI` yet. We'll set it after getting the Railway URL.

### 5. Get Your Railway URL

1. After deployment, Railway will generate a public URL
2. Go to your project → **Settings** → **Domains**
3. Copy the default Railway domain (e.g., `fyers-production-xxxx.up.railway.app`)
4. Your callback URL will be: `https://fyers-production-xxxx.up.railway.app/callback`

### 6. Register Redirect URI in Fyers Dashboard

1. Go to [myapi.fyers.in/dashboard](https://myapi.fyers.in/dashboard)
2. Find your app (`WPRK56TF2X-100`)
3. Add the Railway callback URL: `https://your-railway-url.up.railway.app/callback`
4. Save the changes

### 7. Update Railway Environment Variable

1. Go back to Railway → **Variables**
2. Add or update:
   ```
   FYERS_REDIRECT_URI=https://your-railway-url.up.railway.app/callback
   ```
   (Replace `your-railway-url` with your actual Railway domain)

3. Railway will automatically redeploy when you save

### 8. Test Your Deployment

1. Visit: `https://your-railway-url.up.railway.app/auth`
2. Complete the Fyers authentication
3. You should be redirected to the callback and get tokens
4. Check Railway logs to see the tokens

### 9. Save Tokens (Optional but Recommended)

After authentication, copy the tokens from Railway logs and add them as environment variables:

```
FYERS_ACCESS_TOKEN=your_access_token_here
FYERS_REFRESH_TOKEN=your_refresh_token_here
```

This makes tokens persist across deployments.

### 10. Test Quotes Endpoint

Visit: `https://your-railway-url.up.railway.app/quotes?symbols=NSE:RELIANCE-EQ,NSE:TCS-EQ`

## 🎯 Quick Reference

- **Auth URL**: `https://your-railway-url.up.railway.app/auth`
- **Quotes URL**: `https://your-railway-url.up.railway.app/quotes`
- **Callback URL**: `https://your-railway-url.up.railway.app/callback`

## 🔧 Troubleshooting

- **503 Error**: Make sure the redirect URI is registered in Fyers dashboard
- **Token Missing**: Authenticate again via `/auth` endpoint
- **Deployment Fails**: Check Railway logs for errors

