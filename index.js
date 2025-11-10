const express = require("express");
const dotenv = require("dotenv");
const {
  openAuthURL,
  exchangeToken,
  getQuotes,
  getAccessToken,
  FYERS_APP_ID,
  FYERS_REDIRECT_URI,
  FYERS_API_BASE,
  FYERS_DATA_BASE,
} = require("./fyersClient");

dotenv.config();

const app = express();
const PORT = Number(process.env.FYERS_PORT || 3000);
const DEFAULT_SYMBOLS = (process.env.FYERS_DEFAULT_SYMBOLS || "NSE:RELIANCE-EQ,NSE:TCS-EQ").split(",");

app.get("/", (req, res) => {
  res.send(`
    <h2>Fyers Auth Helper</h2>
    <p>Use <a href="/quotes">/quotes</a> to fetch sample market data once access tokens are generated.</p>
  `);
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
    await exchangeToken(effectiveCode);
    res.send(`
      <h2>Access token generated!</h2>
      <p>You can close this window and return to the terminal.</p>
    `);
  } catch (err) {
    console.error("[Fyers] Callback token exchange failed.");
    res.status(500).send("Failed to exchange authorization code. Check the terminal for details.");
  }
});

app.get("/quotes", async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(",") : DEFAULT_SYMBOLS;
    console.log("[Fyers] /quotes endpoint hit. Symbols:", symbols);
    const data = await getQuotes(symbols);
    console.log("[Fyers] /quotes response payload:", JSON.stringify(data).slice(0, 500));
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    const payload = err.response?.data || { message: err.message || "Failed to fetch quotes" };
    console.error("[Fyers] /quotes error status:", status);
    console.error("[Fyers] /quotes error payload:", payload);
    res.status(status).json({
      error: payload,
      hint: "Ensure FYERS_APP_ID/FYERS_SECRET/FYERS_REDIRECT_URI are correct and tokens are generated via /callback.",
    });
  }
});

app.listen(PORT, async () => {
  console.log(`[Fyers] Helper server running on http://localhost:${PORT}`);
  console.log("[Fyers] Helper configuration summary:", {
    FYERS_APP_ID,
    FYERS_REDIRECT_URI,
    FYERS_API_BASE,
    FYERS_DATA_BASE,
  });

  if (!getAccessToken()) {
    try {
      await openAuthURL();
    } catch (err) {
      console.error("[Fyers] Unable to initiate browser auth:", err.message);
    }
  } else {
    console.log("[Fyers] Existing access token detected. Use /quotes to test the API.");
  }
});

