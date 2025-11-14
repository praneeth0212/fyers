const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Fyers config
const FYERS_APP_ID = process.env.FYERS_APP_ID;
const FYERS_SECRET = process.env.FYERS_SECRET;
const FYERS_REDIRECT_URI = process.env.FYERS_REDIRECT_URI;
const FYERS_API_BASE = "https://api.fyers.in";
let accessToken = null;

// Route to start OAuth login
app.get("/auth", (req, res) => {
  const authURL = `https://api.fyers.in/api/v2/authorize?client_id=${FYERS_APP_ID}&redirect_uri=${encodeURIComponent(FYERS_REDIRECT_URI)}&response_type=code&state=123`;
  res.redirect(authURL);
});

// Callback route to receive auth code
app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Authorization code missing.");
  }

  try {
    const response = await axios.post(`${FYERS_API_BASE}/api/v2/token`, {
      grant_type: "authorization_code",
      client_id: FYERS_APP_ID,
      secret_key: FYERS_SECRET,
      code,
      redirect_uri: FYERS_REDIRECT_URI,
    });

    accessToken = response.data.access_token;
    res.send(`
      <h2>Access Token Generated!</h2>
      <p>You can now use the /quotes endpoint.</p>
    `);
  } catch (err) {
    console.error("Error exchanging code:", err.response?.data || err.message);
    res.status(500).send("Failed to exchange authorization code.");
  }
});

// Fetch quotes
app.get("/quotes", async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: "Access token is missing. Authorize first via /auth" });
  }

  const symbols = req.query.symbols || "NSE:RELIANCE-EQ,NSE:TCS-EQ";

  try {
    const response = await axios.get(`${FYERS_API_BASE}/data-rest/v3/quotes/${symbols}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    res.json(response.data);
  } catch (err) {
    console.error("Quotes error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Fyers] Helper server running on port ${PORT}`);
  console.log("[Fyers] Go to /auth to authorize the app and generate token");
});
