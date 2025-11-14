const express = require("express");
const dotenv = require("dotenv");
const {
  openAuthURL,
  generateAuthURL,
  exchangeToken,
  getQuotes,
  getAccessToken,
} = require("../../fyersClient");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || process.env.FYERS_PORT || 3000);
const DEFAULT_SYMBOLS = (process.env.FYERS_DEFAULT_SYMBOLS || "NSE:RELIANCE-EQ,NSE:TCS-EQ").split(",");

console.log("[Fyers] Helper configuration summary:", {
  FYERS_APP_ID: process.env.FYERS_APP_ID,
  FYERS_REDIRECT_URI: process.env.FYERS_REDIRECT_URI,
  FYERS_API_BASE: process.env.FYERS_API_BASE,
  FYERS_DATA_BASE: process.env.FYERS_DATA_BASE,
});

// Home page
app.get("/", (req, res) => {
  const isAuthenticated = getAccessToken() ? true : false;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fyers API Integration</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .status { padding: 10px; border-radius: 5px; margin: 20px 0; }
        .authenticated { background: #d4edda; color: #155724; }
        .not-authenticated { background: #f8d7da; color: #721c24; }
        a { display: inline-block; margin: 10px 10px 10px 0; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        a:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <h1>Fyers API Integration</h1>
      <div class="status ${isAuthenticated ? 'authenticated' : 'not-authenticated'}">
        <strong>Status:</strong> ${isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
      </div>
      ${!isAuthenticated ? '<a href="/auth">🔐 Authenticate with Fyers</a>' : ''}
      <a href="/quotes">📊 View Market Quotes</a>
    </body>
    </html>
  `);
});

// Authentication route - redirects to Fyers login
app.get("/auth", (req, res) => {
  try {
    const authURL = generateAuthURL();
    console.log("[Fyers] Redirecting to auth URL:", authURL);
    res.redirect(authURL);
  } catch (err) {
    console.error("[Fyers] Error generating auth URL:", err.message);
    res.status(500).send(`<h2>Error</h2><p>${err.message}</p>`);
  }
});

// Callback route - Fyers redirects here after login
app.get("/callback", async (req, res) => {
  const { auth_code, code, state } = req.query;
  const effectiveCode = auth_code || code;

  if (!effectiveCode) {
    console.warn("[Fyers] Callback missing auth_code. Query params:", req.query);
    return res.status(400).send("<h2>Error</h2><p>Authorization code missing.</p>");
  }

  console.log("[Fyers] Callback query params:", req.query);
  console.log(`[Fyers] Using auth code: ${effectiveCode.substring(0, 20)}...`);
  console.log(`[Fyers] State value: ${state || "n/a"}`);

  try {
    const tokens = await exchangeToken(effectiveCode);
    
    // LOG TOKENS FOR RAILWAY ENVIRONMENT VARIABLES
    console.log('\n=================================');
    console.log('COPY THESE TO RAILWAY VARIABLES:');
    console.log('=================================');
    console.log('FYERS_ACCESS_TOKEN =', tokens.accessToken);
    console.log('FYERS_REFRESH_TOKEN =', tokens.refreshToken);
    console.log('=================================\n');
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Success</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .success { background: #d4edda; padding: 20px; border-radius: 5px; color: #155724; }
          a { display: inline-block; margin: 10px 10px 10px 0; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="success">
          <h2>✅ Authentication Successful!</h2>
          <p>Access token has been generated.</p>
          <p><strong>Important:</strong> Check Railway logs and copy the tokens to environment variables to make them persistent.</p>
        </div>
        <a href="/quotes">Test Quotes API</a>
        <a href="/">Go Home</a>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("[Fyers] Token exchange failed:", err.message);
    res.status(500).send(`
      <h2>Authentication Failed</h2>
      <p>${err.message}</p>
      <p>Check the Railway logs for details.</p>
    `);
  }
});

// Quotes route - fetch market data
app.get("/quotes", async (req, res) => {
  console.log("[Fyers] /quotes endpoint hit");
  
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(",") : DEFAULT_SYMBOLS;
    console.log("[Fyers] Fetching quotes for:", symbols);
    
    const data = await getQuotes(symbols);
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    const payload = err.response?.data || { message: err.message || "Failed to fetch quotes" };
    
    console.error("[Fyers] /quotes error:", payload);
    
    res.status(status).json({
      error: payload,
      hint: "Ensure FYERS_APP_ID/FYERS_SECRET/FYERS_REDIRECT_URI are correct and tokens are generated via /callback.",
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`[Fyers] Helper server running on port ${PORT}`);
  console.log(`[Fyers] Environment: ${process.env.RAILWAY_PUBLIC_DOMAIN ? 'Railway Production' : 'Local Development'}`);

  // Only auto-open browser in local development
  if (!process.env.RAILWAY_PUBLIC_DOMAIN && !process.env.PORT && !getAccessToken()) {
    try {
      console.log("[Fyers] Opening browser for authentication...");
      await openAuthURL();
    } catch (err) {
      console.error("[Fyers] Unable to open browser:", err.message);
    }
  } else {
    console.log("[Fyers] Ready! Visit /auth to authenticate");
  }
});