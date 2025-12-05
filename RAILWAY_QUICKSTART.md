# 🚂 Railway Deployment - Quick Start

## Prerequisites
- Railway account ([railway.app](https://railway.app))
- Fyers app credentials

## Deployment Steps

### 1. Push to GitHub (if not already)
```bash
git init
git add .
git commit -m "Ready for Railway deployment"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Deploy on Railway
1. Go to [railway.app](https://railway.app) → New Project
2. Choose "Deploy from GitHub repo"
3. Select your repository

### 3. Set Environment Variables in Railway
In Railway dashboard → Variables, add:

```
FYERS_APP_ID=WPRK56TF2X-100
FYERS_SECRET=I46BU8P4DM
FYERS_API_BASE=https://api.fyers.in
FYERS_DATA_BASE=https://api.fyers.in
```

### 4. Get Your Railway URL
1. Railway → Settings → Domains
2. Copy your domain (e.g., `fyers-xxxx.up.railway.app`)
3. Your callback URL: `https://fyers-xxxx.up.railway.app/callback`

### 5. Register Redirect URI in Fyers
1. Go to [myapi.fyers.in/dashboard](https://myapi.fyers.in/dashboard)
2. Add redirect URI: `https://your-railway-domain.up.railway.app/callback`
3. Save

### 6. Add Redirect URI to Railway Variables
In Railway → Variables, add:

```
FYERS_REDIRECT_URI=https://your-railway-domain.up.railway.app/callback
```

### 7. Test
- Visit: `https://your-railway-domain.up.railway.app/auth`
- Authenticate with Fyers
- Test: `https://your-railway-domain.up.railway.app/quotes`

## Done! 🎉

