// ==================== VARIABLES D'ENVIRONNEMENT ====================

export const PORT = parseInt(Deno.env.get("API_PORT") ?? "3000");

export const API_URL = Deno.env.get("API_URL") ?? "http://api:8000";

const allowedApiUrls = ["http://api:8000"];
if (!allowedApiUrls.includes(API_URL)) {
  console.error(`FATAL: API_URL non autorisée: ${API_URL}`);
  Deno.exit(1);
}

const JWT_SECRET = Deno.env.get("JWT_SECRET");
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    "FATAL: JWT_SECRET doit être défini et faire au moins 32 caractères.",
  );
  Deno.exit(1);
}

const POIVRE = Deno.env.get("POIVRE");
if (!POIVRE || POIVRE.length < 16) {
  console.error("FATAL: POIVRE manquant ou trop court.");
  Deno.exit(1);
}

export { POIVRE };

// ==================== CLÉ JWT ====================

export const secretKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_SECRET),
  { name: "HMAC", hash: "SHA-512" },
  false,
  ["sign", "verify"],
);
