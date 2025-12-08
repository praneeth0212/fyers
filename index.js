const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const crypto = require("crypto");
dotenv.config();

const app = express();
const PORT = process.env.PORT;
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT;

if (!PORT) {
  console.error("[Fyers] ERROR: PORT environment variable is required");
  process.exit(1);
}


// Middleware
app.use(express.json());

// Fyers config
const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET = process.env.FYERS_SECRET;

// Auto-detect Railway URL if available, otherwise use configured redirect URI
const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;
const FYERS_REDIRECT_URI = process.env.FYERS_REDIRECT_URI || 
  (RAILWAY_PUBLIC_DOMAIN ? `https://${RAILWAY_PUBLIC_DOMAIN}/callback` : null) ||
  (IS_PRODUCTION ? 'https://fyers-production-bc19.up.railway.app/callback' : `http://127.0.0.1:3000/callback`);

const FYERS_API_BASE = process.env.FYERS_API_BASE || "https://api.fyers.in";
const FYERS_DATA_BASE = process.env.FYERS_DATA_BASE || FYERS_API_BASE;
const USE_VALIDATE_FLOW = /api-t1\.fyers\.in/i.test(FYERS_API_BASE);
let accessToken = process.env.FYERS_ACCESS_TOKEN || null;
let refreshToken = process.env.FYERS_REFRESH_TOKEN || null;

// Build appIdHash (SHA256 of APP_ID:SECRET)
const buildAppIdHash = () => {
  if (!FYERS_APP_ID || !FYERS_SECRET) {
    const error = new Error("FYERS_APP_ID and FYERS_SECRET are required");
    console.error("[Fyers] Configuration error:", error.message);
    throw error;
  }
  const input = `${FYERS_APP_ID}:${FYERS_SECRET}`;
  return crypto.createHash("sha256").update(input).digest("hex");
};

// Health check endpoint (required for Railway)
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Fyers Helper API",
    environment: USE_VALIDATE_FLOW ? "TEST" : "PRODUCTION",
    endpoints: {
      auth: "/auth",
      callback: "/callback",
      quotes: "/quotes?symbols=NSE:RELIANCE-EQ,NSE:TCS-EQ",
      health: "/health"
    }
  });
});

// Health check endpoint (must return 200 for Railway)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    hasToken: !!accessToken
  });
});

// Route to start OAuth login
app.get("/auth", (req, res) => {
  if (!FYERS_APP_ID || !FYERS_REDIRECT_URI) {
    return res.status(500).json({ 
      error: { 
        message: "FYERS_APP_ID and FYERS_REDIRECT_URI must be set" 
      },
      hint: "Ensure FYERS_APP_ID/FYERS_SECRET/FYERS_REDIRECT_URI are set in your environment variables."
    });
  }
  const authURL = `${FYERS_API_BASE}/api/v3/generate-authcode?client_id=${FYERS_APP_ID}&redirect_uri=${encodeURIComponent(FYERS_REDIRECT_URI)}&response_type=code&state=123`;
  res.redirect(authURL);
});

// Callback route to receive auth code
app.get("/callback", async (req, res) => {
  const { auth_code, code } = req.query;
  const effectiveCode = auth_code || code;
  
  if (!effectiveCode) {
    return res.status(400).json({ 
      error: { message: "Authorization code missing." },
      hint: "Make sure you complete the authorization flow at /auth first."
    });
  }

  try {
    const appIdHash = buildAppIdHash();
    // Use validate-authcode for test, token for production
    const endpoint = USE_VALIDATE_FLOW 
      ? `${FYERS_API_BASE}/api/v3/validate-authcode`
      : `${FYERS_API_BASE}/api/v3/token`;
    
    console.log(`[Fyers] Environment: ${USE_VALIDATE_FLOW ? 'TEST' : 'PRODUCTION'}`);
    console.log(`[Fyers] Using endpoint: ${endpoint}`);
    
    const response = await axios.post(endpoint, {
      grant_type: "authorization_code",
      appIdHash,
      code: effectiveCode,
    }, {
      headers: { "Content-Type": "application/json" },
    });

    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;

    // Log tokens for environment variables
    console.log('\n=================================');
    console.log('ACCESS TOKEN GENERATED:');
    console.log('=================================');
    console.log('FYERS_ACCESS_TOKEN =', accessToken);
    console.log('FYERS_REFRESH_TOKEN =', refreshToken);
    console.log('=================================');
    
    if (IS_PRODUCTION) {
      console.log('Add these to Railway environment variables to persist tokens');
    } else {
      console.log('Add these to your .env file to persist tokens');
    }
    console.log('');

    const instructions = IS_PRODUCTION
      ? '<p><strong>Important:</strong> Check Railway logs and add the tokens to Railway environment variables to make them persistent.</p>'
      : '<p><strong>Important:</strong> Check the server logs and add the tokens to your .env file to make them persistent.</p>';

    res.send(`
      <h2>✅ Access Token Generated!</h2>
      <p>You can now use the /quotes endpoint.</p>
      ${instructions}
      <p><a href="/quotes">Try /quotes endpoint</a></p>
      <p><a href="/">Back to home</a></p>
    `);
  } catch (err) {
    console.error("Error exchanging code:", err.response?.data || err.message);
    res.status(500).json({ 
      error: { 
        message: `Failed to exchange authorization code: ${err.response?.data?.message || err.message}` 
      },
      hint: "Ensure FYERS_APP_ID/FYERS_SECRET/FYERS_REDIRECT_URI are correct and tokens are generated via /callback."
    });
  }
});

// Fetch quotes
app.get("/quotes", async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ 
      error: {
        message: "Access token is missing. Authorize the application first."
      },
      hint: "Ensure FYERS_APP_ID/FYERS_SECRET/FYERS_REDIRECT_URI are correct and tokens are generated via /callback."
    });
  }

  if (!FYERS_APP_ID) {
    return res.status(500).json({ 
      error: { message: "FYERS_APP_ID is not configured" },
      hint: "Set FYERS_APP_ID in your environment variables."
    });
  }

  const symbols = req.query.symbols || "NSE:RELIANCE-EQ,NSE:TCS-EQ";

  try {
    // Use different quotes endpoint for test vs production
    const quotesURL = USE_VALIDATE_FLOW
      ? `${FYERS_DATA_BASE}/data/quotes?symbols=${encodeURIComponent(symbols)}`
      : `${FYERS_DATA_BASE}/data-rest/v3/quotes/?symbols=${encodeURIComponent(symbols)}`;
    
    const response = await axios.get(quotesURL, {
      headers: { 
        Authorization: `${FYERS_APP_ID}:${accessToken}`,
      },
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      console.error("Quotes error:", response.data);
      return res.status(response.status).json({ error: response.data });
    }

    res.json(response.data);
  } catch (err) {
    console.error("Quotes error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: {
      message: "Internal server error",
      hint: "Check server logs for details"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: "Route not found",
      hint: "Available routes: /, /health, /auth, /callback, /quotes"
    }
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Fyers] Server running on ${PORT}`);
  console.log(`[Fyers] Environment: ${USE_VALIDATE_FLOW ? 'TEST' : 'PRODUCTION'}`);
  console.log(`[Fyers] API Base: ${FYERS_API_BASE}`);
  console.log(`[Fyers] Redirect URI: ${FYERS_REDIRECT_URI}`);
  
  if (accessToken) {
    console.log("[Fyers] ✅ Access token loaded from environment variable");
  } else {
    console.log(`[Fyers] No token. Visit /auth manually to authorize the app.`);
  }
  
  const healthURL = IS_PRODUCTION 
    ? (RAILWAY_PUBLIC_DOMAIN ? `https://${RAILWAY_PUBLIC_DOMAIN}/health` : 'https://fyers-production-bc19.up.railway.app/health')
    : `http://127.0.0.1:3000/health`;
  console.log(`[Fyers] Health check: ${healthURL}`);
});

// Graceful shutdown for Railway
process.on('SIGTERM', () => {
  console.log('[Fyers] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[Fyers] Server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
