const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config(); // Load .env for local dev

const app = express();

// Use PORT from env or default to 3000
const PORT = process.env.PORT || 3000;

// Detect production environment
const IS_PRODUCTION = process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

// Middleware
app.use(express.json());

// Fyers config
const FYERS_APP_ID = process.env.FYERS_APP_ID || "YOUR_LOCAL_APP_ID";
const FYERS_SECRET = process.env.FYERS_SECRET || "YOUR_LOCAL_SECRET";

// For local development fallback
const FYERS_REDIRECT_URI =
  process.env.FYERS_REDIRECT_URI ||
  (IS_PRODUCTION
    ? `https://${process.env.RAILWAY_PUBLIC_URL}/callback`
    : `http://127.0.0.1:${PORT}/callback`);

// Fyers API URLs
const FYERS_API_BASE = process.env.FYERS_API_BASE || "https://api.fyers.in";
const FYERS_DATA_BASE = process.env.FYERS_DATA_BASE || FYERS_API_BASE;
const USE_VALIDATE_FLOW = /api-t1\.fyers\.in/i.test(FYERS_API_BASE);

let accessToken = process.env.FYERS_ACCESS_TOKEN || null;
let refreshToken = process.env.FYERS_REFRESH_TOKEN || null;

// Build appIdHash
const buildAppIdHash = () => {
  if (!FYERS_APP_ID || !FYERS_SECRET) {
    console.error("[Fyers] ERROR: FYERS_APP_ID and FYERS_SECRET are required");
    process.exit(1);
  }
  return crypto.createHash("sha256").update(`${FYERS_APP_ID}:${FYERS_SECRET}`).digest("hex");
};

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Fyers Helper API",
    environment: USE_VALIDATE_FLOW ? "TEST" : "PRODUCTION",
    endpoints: { auth: "/auth", callback: "/callback", quotes: "/quotes", health: "/health" },
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString(), hasToken: !!accessToken });
});

// OAuth login
app.get("/auth", (req, res) => {
  if (!FYERS_APP_ID || !FYERS_REDIRECT_URI) {
    return res.status(500).json({
      error: { message: "FYERS_APP_ID and FYERS_REDIRECT_URI must be set" },
      hint: "Set them in your .env file or replace placeholders in code for local dev",
    });
  }
  const authURL = `${FYERS_API_BASE}/api/v3/generate-authcode?client_id=${FYERS_APP_ID}&redirect_uri=${encodeURIComponent(
    FYERS_REDIRECT_URI
  )}&response_type=code&state=123`;
  res.redirect(authURL);
});

// Callback
app.get("/callback", async (req, res) => {
  const { auth_code, code } = req.query;
  const effectiveCode = auth_code || code;

  if (!effectiveCode) return res.status(400).json({ error: { message: "Authorization code missing." } });

  try {
    const appIdHash = buildAppIdHash();
    const endpoint = USE_VALIDATE_FLOW
      ? `${FYERS_API_BASE}/api/v3/validate-authcode`
      : `${FYERS_API_BASE}/api/v3/token`;

    const response = await axios.post(
      endpoint,
      { grant_type: "authorization_code", appIdHash, code: effectiveCode },
      { headers: { "Content-Type": "application/json" } }
    );

    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;

    console.log("[Fyers] ✅ Access token generated", accessToken);

    res.send(`
      <h2>✅ Access Token Generated!</h2>
      <p>Use /quotes endpoint now.</p>
      <p><a href="/quotes">/quotes</a></p>
      <p><a href="/">Back home</a></p>
    `);
  } catch (err) {
    console.error("Error exchanging code:", err.response?.data || err.message);
    res.status(500).json({ error: { message: "Failed to exchange authorization code" } });
  }
});

// Quotes endpoint
app.get("/quotes", async (req, res) => {
  if (!accessToken) return res.status(401).json({ error: "Authorize app first via /auth" });

  const symbols = req.query.symbols || "NSE:RELIANCE-EQ,NSE:TCS-EQ";
  const quotesURL = USE_VALIDATE_FLOW
    ? `${FYERS_DATA_BASE}/data/quotes?symbols=${encodeURIComponent(symbols)}`
    : `${FYERS_DATA_BASE}/data-rest/v3/quotes/?symbols=${encodeURIComponent(symbols)}`;

  try {
    const response = await axios.get(quotesURL, { headers: { Authorization: `${FYERS_APP_ID}:${accessToken}` } });
    res.json(response.data);
  } catch (err) {
    console.error("Quotes error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
});

// 404
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Start server
app.listen(PORT, () => {
  console.log(`[Fyers] Server running on http://127.0.0.1:${PORT}`);
  console.log(`[Fyers] Redirect URI: ${FYERS_REDIRECT_URI}`);
});
