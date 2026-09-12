// Google OAuth2 client setup: builds the client, generates the consent
// screen URL, exchanges an auth code for tokens, and persists refreshed
// tokens back to the DB. Every other email file goes through here rather
// than touching "googleapis" directly.

import { google } from "googleapis";
import { db } from "./db";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const tokens = db.getGoogleTokens();
  if (tokens) client.setCredentials(tokens);

  // Whenever googleapis silently refreshes an expired access_token, this
  // fires so we can persist the new one — otherwise every request after
  // expiry would refresh again and again without ever saving it.
  client.on("tokens", (newTokens) => {
    db.saveGoogleTokens({ ...tokens, ...newTokens });
  });

  return client;
}

export function getAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES
  });
}

export async function exchangeCodeForTokens(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}
