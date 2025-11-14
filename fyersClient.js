const axios = require("axios");
const open = require("open");
const crypto = require("crypto");
require("dotenv").config();

console.log("[Fyers] DEBUG - Environment variables loaded:");
console.log("[Fyers] APP_ID:", process.env.FYERS_APP_ID);
console.log("[Fyers] SECRET:", process.env.FYERS_SECRET ? "[hidden]" : undefined);
console.log("[Fyers] APP_ID length:", process.env.FYERS_APP_ID?.length);

const APP_ID = process.env.FYERS_APP_ID;
const SECRET = process.env.FYERS_SECRET;
const REDIRECT_URI = process.env.FYERS_REDIRECT_URI || process.env.REDIRECT_URI;
const APP_HASH_ENV = process.env.FYERS_APP_HASH;
const API_BASE = process.env.FYERS_API_BASE || "https://api.fyers.in";
const DATA_BASE = process.env.FYERS_DATA_BASE || "https://api.fyers.in";

if (!APP_ID || !SECRET || !REDIRECT_URI) {
  console.warn(
    "[Fyers] Missing FYERS_APP_ID, FYERS_SECRET, or FYERS_REDIRECT_URI in environment variables. Authentication may fail."
  );
}

// Initialize tokens from environment variables (for Railway/production) or in-memory (for local)
const accessTokenBox = { value: process.env.FYERS_ACCESS_TOKEN || null };
const refreshTokenBox = { value: process.env.FYERS_REFRESH_TOKEN || null };

if (accessTokenBox.value) {
  console.log("[Fyers] Access token loaded from environment variable");
} else {
  console.log("[Fyers] No access token found in environment. Authentication required.");
}

const USE_VALIDATE_FLOW = /api-t1\.fyers\.in/i.test(API_BASE);

const FYERS_AUTHORIZE_URL = `${API_BASE}/api/v3/generate-authcode`;
const FYERS_VALIDATE_URL = `${API_BASE}/api/v3/validate-authcode`;
const FYERS_TOKEN_URL = `${API_BASE}/api/v3/token`;
const FYERS_QUOTES_URL = USE_VALIDATE_FLOW
  ? `${DATA_BASE}/data/quotes`
  : `${DATA_BASE}/data-rest/v3/quotes/`;

const buildAppIdHash = () => {
  if (APP_HASH_ENV) return APP_HASH_ENV;
  if (!APP_ID || !SECRET) {
    throw new Error("Cannot resolve appIdHash without FYERS_APP_ID and FYERS_SECRET (Secret ID).");
  }
  console.log("[Fyers] Building hash with APP_ID:", APP_ID);
  console.log("[Fyers] Building hash with SECRET:", SECRET ? "[hidden]" : undefined);
  const input = `${APP_ID}:${SECRET}`;
  console.log("[Fyers] Input string for hash:", input);
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  console.log("[Fyers] Generated hash:", hash);
  return hash;
};

const generateAuthURL = () => {
  if (!APP_ID || !REDIRECT_URI) {
    throw new Error("Fyers credentials are missing. Set FYERS_APP_ID and FYERS_REDIRECT_URI in your environment.");
  }

  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    state: "state123",
  });

  return `${FYERS_AUTHORIZE_URL}?${params.toString()}`;
};

const openAuthURL = async () => {
  const url = generateAuthURL();
  console.log("[Fyers] Opening browser for authentication...");
  try {
    if (typeof open === "function") {
      await open(url);
    } else if (open && typeof open.default === "function") {
      await open.default(url);
    } else {
      throw new Error("The 'open' package did not export a callable function.");
    }
  } catch (err) {
    console.warn("[Fyers] Unable to launch the browser automatically. Please open this URL manually:", url);
    throw err;
  }
};

const exchangeToken = async (authCode) => {
  try {
    const appIdHash = buildAppIdHash();
    const payload = {
      grant_type: "authorization_code",
      appIdHash,
      code: authCode,
    };

    console.log("[Fyers] appIdHash used for exchange:", appIdHash);
    console.log("[Fyers] Exchanging auth code for tokens with payload:", payload);

    // Use validate-authcode for test, token for production
    const isTestEnv = API_BASE.includes('api-t1');
    const endpoint = isTestEnv ? FYERS_VALIDATE_URL : FYERS_TOKEN_URL;
    
    console.log("[Fyers] Environment:", isTestEnv ? 'TEST' : 'PRODUCTION');
    console.log("[Fyers] Using endpoint:", endpoint);

    const resp = await axios.post(endpoint, payload, {
      headers: { "Content-Type": "application/json" },
    });

    accessTokenBox.value = resp.data.access_token;
    refreshTokenBox.value = resp.data.refresh_token;

    console.log("[Fyers] Access token issued.");
    console.log("[Fyers] Access token:", accessTokenBox.value);
    console.log("[Fyers] Refresh token:", refreshTokenBox.value);

    return {
      accessToken: accessTokenBox.value,
      refreshToken: refreshTokenBox.value,
      expiresIn: resp.data.expires_in,
    };
  } catch (err) {
    console.error("[Fyers] Token exchange error payload:", err.response?.data);
    console.error("[Fyers] Token exchange status:", err.response?.status);
    console.error("[Fyers] Token exchange message:", err.message);
    throw err;
  }
};

const refreshAccessToken = async () => {
  if (!refreshTokenBox.value) {
    throw new Error("No refresh token available. Authorize the app first.");
  }

  try {
    const appIdHash = buildAppIdHash();
    const payload = {
      grant_type: "refresh_token",
      appIdHash,
      refresh_token: refreshTokenBox.value,
    };

    console.log("[Fyers] Refreshing access token with payload:", payload);
    const targetEndpoint = USE_VALIDATE_FLOW ? `${API_BASE}/api/v3/validate-refresh-token` : `${API_BASE}/api/v3/refresh-token`;
    console.log("[Fyers] Refresh endpoint:", targetEndpoint);

    const resp = await axios.post(targetEndpoint, payload, {
      headers: { "Content-Type": "application/json" },
    });

    accessTokenBox.value = resp.data.access_token;
    refreshTokenBox.value = resp.data.refresh_token;

    console.log("[Fyers] Access token refreshed.");
    console.log("[Fyers] Access token:", accessTokenBox.value);
    console.log("[Fyers] Refresh token:", refreshTokenBox.value);

    return {
      accessToken: accessTokenBox.value,
      refreshToken: refreshTokenBox.value,
      expiresIn: resp.data.expires_in,
    };
  } catch (err) {
    console.error("[Fyers] Refresh token error:", err.response?.data || err.message);
    throw err;
  }
};

const getAccessToken = () => accessTokenBox.value;
const getRefreshToken = () => refreshTokenBox.value;

const getQuotes = async (symbols) => {
  if (!accessTokenBox.value) {
    throw new Error("Access token is missing. Authorize the application first.");
  }

  const list = Array.isArray(symbols) ? symbols : [symbols];
  console.log("[Fyers] Preparing quotes request for symbols:", list);

  try {
    const url = `${FYERS_QUOTES_URL}?symbols=${encodeURIComponent(list.join(","))}`;
    console.log("[Fyers] Quotes URL:", url);
    const resp = await axios.get(url, {
      headers: {
        Authorization: `${APP_ID}:${accessTokenBox.value}`,
      },
      validateStatus: () => true,
    });

    console.log("[Fyers] Quotes response status:", resp.status);

    if (resp.status >= 400) {
      console.error("[Fyers] Quotes error payload:", resp.data);
      throw new Error(`Fyers quotes request failed with status ${resp.status}`);
    }

    return resp.data;
  } catch (err) {
    console.error("[Fyers] Quote fetch error:", err.response?.data || err.message);
    throw err;
  }
};

module.exports = {
  openAuthURL,
  generateAuthURL,
  exchangeToken,
  refreshAccessToken,
  getAccessToken,
  getRefreshToken,
  getQuotes,
  FYERS_APP_ID: APP_ID,
  FYERS_REDIRECT_URI: REDIRECT_URI,
  FYERS_API_BASE: API_BASE,
  FYERS_DATA_BASE: DATA_BASE,
};

