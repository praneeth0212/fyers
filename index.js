const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

// Use Railway's injected PORT, or fallback to 3000 for local dev
const PORT = process.env.PORT || 3000;

// Detect production environment
const IS_PRODUCTION = process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

// Middleware
app.use(express.json());

// Fyers config from Railway environment variables
const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET = process.env.FYERS_SECRET;

// Railway public URL auto-detection
const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_URL || process.env.RAILWAY_STATIC_URL;
const FYERS_REDIRECT_URI =
  process.env.FYERS_REDIRECT_URI ||
  (RAILWAY_PUBLIC_DOMAIN ? `https://${RAILWAY_PUBLIC_DOMAIN}/callback` : `http://127.0.0.1:${PORT}/callback`);

// Fyers API URLs
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
  return crypto.createHash("sha256").update(`${FYERS_APP_ID}:${FYERS_SECRET}`).digest("hex");
};

// Health check
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

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    hasToken: !!accessToken
  });
});

// OAuth login
app.get("/auth", (req, res) => {
  if (!FYERS_APP_ID || !FYERS_REDIRECT_URI) {
    return res.status(500).json({ 
      error: { message: "FYERS_APP_ID and FYERS_REDIRECT_URI must be set" },
      hint: "Ensure FYERS_APP_ID/FYERS_SECRET/FYERS_REDIRECT_URI are set in Railway environment variables."
    });
  }
  const authURL = `${FYERS_API_BASE}/api/v3/generate-authcode?client_id=${FYERS_APP_ID}&redirect_uri=${encodeURIComponent(FYERS_REDIRECT_URI)}&response_type=code&state=123`;
  res.redirect(authURL);
});

// Callback to get access token
app.get("/callback", async (req, res) => {
  const { auth_code, code } = req.query;
  const effectiveCode = auth_code || code;

  if (!effectiveCode) {
    return res.status(400).json({ 
      error: { message: "Authorization code missing." },
      hint: "Complete the flow via /auth first."
    });
  }

  try {
    const appIdHash = buildAppIdHash();
    const endpoint = USE_VALIDATE_FLOW
      ? `${FYERS_API_BASE}/api/v3/validate-authcode`
      : `${FYERS_API_BASE}/api/v3/token`;

    const response = await axios.post(endpoint, {
      grant_type: "authorization_code",
      appIdHash,
      code: effectiveCode
    }, {
      headers: { "Content-Type": "application/json" }
    });

    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;

    console.log(`[Fyers] ✅ Access token generated`);
    console.log('FYERS_ACCESS_TOKEN =', accessToken);
    console.log('FYERS_REFRESH_TOKEN =', refreshToken);

    res.send(`
      <h2>✅ Access Token Generated!</h2>
      <p>Use /quotes endpoint now.</p>
      <p><a href="/quotes">/quotes</a></p>
      <p><a href="/">Back home</a></p>
    `);
  } catch (err) {
    console.error("Error exchanging code:", err.response?.data || err.message);
    res.status(500).json({ 
      error: { message: `Failed to exchange authorization code: ${err.response?.data?.message || err.message}` },
      hint: "Check FYERS_APP_ID, FYERS_SECRET, FYERS_REDIRECT_URI"
    });
  }
});

// Fetch quotes
app.get("/quotes", async (req, res) => {
  if (!accessToken) return res.status(401).json({ error: "Authorize app first via /auth" });

  const symbols = req.query.symbols || "NSE:RELIANCE-EQ,NSE:TCS-EQ";
  const quotesURL = USE_VALIDATE_FLOW
    ? `${FYERS_DATA_BASE}/data/quotes?symbols=${encodeURIComponent(symbols)}`
    : `${FYERS_DATA_BASE}/data-rest/v3/quotes/?symbols=${encodeURIComponent(symbols)}`;

  try {
    const response = await axios.get(quotesURL, {
      headers: { Authorization: `${FYERS_APP_ID}:${accessToken}` },
      validateStatus: () => true
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

// Error handling
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server on Railway
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Fyers] Server running on port ${PORT}`);
  console.log(`[Fyers] Redirect URI: ${FYERS_REDIRECT_URI}`);
  console.log(`[Fyers] Health check: ${IS_PRODUCTION ? `https://${RAILWAY_PUBLIC_DOMAIN}/health` : `http://127.0.0.1:${PORT}/health`}`);
  if (!accessToken) console.log(`[Fyers] No token. Visit /auth to authorize.`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Fyers] SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
