#!/usr/bin/env node

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

app.get("/", (req, res) => {
  res.send(`
    <h2>Fyers Auth Helper</h2>
    <p><strong>Status:</strong> ${getAccessToken() ? '✅ Authenticated' : '❌ Not Authenticated'}</p>
    <p><a href="/auth">🔐 Click here to authenticate</a></p>
    <p><a href="/quotes">📊 View Market Quotes</a></p>
  `);
});

app.get("/auth", (req, res) => {
  try {
    const authURL = generateAuthURL();
    console.log("[Fyers] Redirecting to auth URL:", authURL);
    res.redirect(authURL);
  } catch (err) {
    console.error("[Fyers] Error generating auth URL:", err.message);
    res.status(500).send(`Error: ${err.message}`);
  }
});

app.get("/callback", async (req, res) => {
  const { auth_code, code, state } = req.query;

  const effectiveCode = auth_code || code;

  if (!effectiveCode) {
    console.warn("[Fyers] Callback missing auth_code. Query params:", req.query);
    return res.status(400).send("Authorization code missing.");
  }

  console.log("[Fyers] Callback query params:", req.query);
  console.log(`[Fyers] Using auth code (priority auth_code param): ${auth_code ? "auth_code" : "code"}`);
  console.log(`[Fyers] Auth code value: ${effectiveCode}`);
  console.log(`[Fyers] State value: ${state || "n/a"}`);

  try {
    const tokens = await exchangeToken(effectiveCode);
    
    // LOG TOKENS SO YOU CAN ADD THEM TO RAILWAY
    console.log('=================================');
    console.log('COPY THESE TO RAILWAY VARIABLES:');
    console.log('=================================');
    console.log('FYERS_ACCESS_TOKEN =', tokens.accessToken);
    console.log('FYERS_REFRESH_TOKEN =', tokens.refreshToken);
    console.log('=================================');
    
    res.send(`
      <h2>✅ Access token generated!</h2>
      <p>Check Railway logs for tokens to save as environment variables.</p>
      <p><a href="/quotes">Test Quotes API</a></p>
      <p><a href="/">Go Home</a></p>
    `);
  } catch (err) {
    res.status(500).send("Failed to exchange authorization code. Check the terminal for details.");
  }
});

app.get("/quotes", async (req, res) => {
  console.log("[Fyers] /quotes endpoint hit. Symbols:", req.query.symbols);
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(",") : DEFAULT_SYMBOLS;
    const data = await getQuotes(symbols);
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    const payload = err.response?.data || { message: err.message || "Failed to fetch quotes" };
    console.log("[Fyers] /quotes error status:", status);
    console.log("[Fyers] /quotes error payload:", payload);
    res.status(status).json({
      error: payload,
      hint: "Ensure FYERS_APP_ID/FYERS_SECRET/FYERS_REDIRECT_URI are correct and tokens are generated via /callback.",
    });
  }
});

app.listen(PORT, async () => {
  console.log(`[Fyers] Helper server running on port ${PORT}`);

  // Don't auto-open browser in production
  if (!process.env.RAILWAY_PUBLIC_DOMAIN && !getAccessToken()) {
    try {
      await openAuthURL();
    } catch (err) {
      console.error("[Fyers] Unable to initiate browser auth:", err.message);
    }
  } else {
    console.log("[Fyers] Visit /auth to authenticate");
  }
});
