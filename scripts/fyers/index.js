const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const crypto = require("crypto");
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Fyers config
const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET = process.env.FYERS_SECRET;
const FYERS_REDIRECT_URI = process.env.FYERS_REDIRECT_URI;
const FYERS_API_BASE = process.env.FYERS_API_BASE || "https://api.fyers.in";
let accessToken = process.env.FYERS_ACCESS_TOKEN || null;
let refreshToken = process.env.FYERS_REFRESH_TOKEN || null;

// Build appIdHash (SHA256 of APP_ID:SECRET)
const buildAppIdHash = () => {
  if (!FYERS_APP_ID || !FYERS_SECRET) {
    throw new Error("FYERS_APP_ID and FYERS_SECRET are required");
  }
  const input = `${FYERS_APP_ID}:${FYERS_SECRET}`;
  return crypto.createHash("sha256").update(input).digest("hex");
};

// Route to start OAuth login
app.get("/auth", (req, res) => {
  if (!FYERS_APP_ID || !FYERS_REDIRECT_URI) {
    return res.status(500).send("FYERS_APP_ID and FYERS_REDIRECT_URI must be set");
  }
  const authURL = `${FYERS_API_BASE}/api/v3/generate-authcode?client_id=${FYERS_APP_ID}&redirect_uri=${encodeURIComponent(FYERS_REDIRECT_URI)}&response_type=code&state=123`;
  res.redirect(authURL);
});

// Callback route to receive auth code
app.get("/callback", async (req, res) => {
  const { auth_code, code } = req.query;
  const effectiveCode = auth_code || code;
  
  if (!effectiveCode) {
    return res.status(400).send("Authorization code missing.");
  }

  try {
    const appIdHash = buildAppIdHash();
    const response = await axios.post(`${FYERS_API_BASE}/api/v3/token`, {
      grant_type: "authorization_code",
      appIdHash,
      code: effectiveCode,
    }, {
      headers: { "Content-Type": "application/json" },
    });

    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;

    // Log tokens for Railway environment variables
    console.log('\n=================================');
    console.log('COPY THESE TO RAILWAY VARIABLES:');
    console.log('=================================');
    console.log('FYERS_ACCESS_TOKEN =', accessToken);
    console.log('FYERS_REFRESH_TOKEN =', refreshToken);
    console.log('=================================\n');

    res.send(`
      <h2>✅ Access Token Generated!</h2>
      <p>You can now use the /quotes endpoint.</p>
      <p><strong>Important:</strong> Check Railway logs and copy the tokens to environment variables to make them persistent.</p>
    `);
  } catch (err) {
    console.error("Error exchanging code:", err.response?.data || err.message);
    res.status(500).send(`Failed to exchange authorization code: ${err.response?.data?.message || err.message}`);
  }
});

// Fetch quotes
app.get("/quotes", async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: "Access token is missing. Authorize first via /auth" });
  }

  if (!FYERS_APP_ID) {
    return res.status(500).json({ error: "FYERS_APP_ID is not configured" });
  }

  const symbols = req.query.symbols || "NSE:RELIANCE-EQ,NSE:TCS-EQ";

  try {
    const response = await axios.get(`${FYERS_API_BASE}/data-rest/v3/quotes/?symbols=${encodeURIComponent(symbols)}`, {
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

app.listen(PORT, () => {
  console.log(`[Fyers] Helper server running on port ${PORT}`);
  if (accessToken) {
    console.log("[Fyers] Access token loaded from environment variable");
  } else {
    console.log("[Fyers] Go to /auth to authorize the app and generate token");
  }
});
