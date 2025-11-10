# 🔐 Fyers Auth & Market Data Helper

This standalone Node.js utility handles OAuth for the Fyers API (v3) and lets you test quote endpoints without touching the main AI stock agent.

## 📁 Structure

```
fyers-helper/
├── env.example          # Copy to .env and fill in your Fyers credentials
├── fyersClient.js       # OAuth + token refresh + quotes helper
├── index.js             # Express server exposing /callback and /quotes
└── package.json         # Local dependencies (axios, express, dotenv, open)
```

## 🚀 Getting Started

1. **Install dependencies**
   ```bash
   cd fyers-helper
   npm install
   ```

2. **Create a `.env` file**

   Copy `env.example` to `.env` and fill in your details:
   ```
   FYERS_APP_ID=YOUR_APP_ID
   FYERS_SECRET=YOUR_SECRET_ID
   FYERS_REDIRECT_URI=https://your-tunnel-domain/callback
   FYERS_API_BASE=https://api-t1.fyers.in      # sandbox (use https://api.fyers.in for prod)
   FYERS_DATA_BASE=https://api-t1.fyers.in
   ```

   > Keep APP_ID consistent (usually without the `-100` suffix for hashing) and make sure the redirect URI matches the one configured in the Fyers console.

3. **Expose your local server**

   Use ngrok or localtunnel so Fyers can reach your `/callback`. Example:
   ```bash
   ngrok http 3000
   # or
   lt --port 3000 --subdomain myagent
   ```

4. **Run the helper**
   ```bash
   npm start
   ```

   The script prints the auth URL and opens your browser. Log in quickly—auth codes expire within ~60 seconds.

5. **Test quotes**

   After seeing “Access token issued” in the terminal, visit:
   ```
   http://localhost:3000/quotes
   ```
   or pass custom symbols:
   ```
   http://localhost:3000/quotes?symbols=NSE:INFY-EQ,NSE:TCS-EQ
   ```

   The helper automatically uses:
   - Sandbox endpoints (`/api/v3/validate-authcode`, `/data/quotes`) when `FYERS_API_BASE` contains `api-t1`.
   - Production endpoints (`/api/v3/token`, `/data-rest/v3/quotes/`) otherwise.

## 🧰 What’s Included

- Browser automation via `open` to start the OAuth flow.
- Verbose logging for auth codes, hash inputs, chosen endpoints, and HTTP statuses.
- Quote requests with the required `Authorization: APP_ID:ACCESS_TOKEN` header format.
- Optional refresh token helper (`refreshAccessToken`) if you want to extend sessions.

## 🔄 Integrating with the main app

Once you have working tokens, you can copy `accessTokenBox.value` into your main service or call `refreshAccessToken()` as needed. Because the helper lives in its own project, you can develop and deploy it independently of the AI stock agent.

---

Questions or enhancements? Tweak `fyersClient.js` and send a PR!

