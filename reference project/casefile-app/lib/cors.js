// lib/cors.js — the Expo app and a browser preview may call this API from a
// different origin than the Next.js server, so keep CORS permissive here.
// Lock this down (specific origins) before shipping past a hackathon demo.

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export function withCors(json, init = {}) {
  return Response.json(json, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers || {}) }
  });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
