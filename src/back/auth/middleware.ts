import { Context } from "@oak/oak";
import { verify } from "@zaubrik/djwt";
import { secretKey } from "../config.ts";

// ==================== HASH HELPER ============================================
// Utilisé pour hasher les refresh tokens avant stockage/comparaison en base.
// On ne stocke pas le token brut les tokens sont inutilisables sans les valeurs originales.

export async function hashToken(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ==================== ACCESS TOKEN COOKIES ====================
//durrée de 15 min
//le refresh token prend le relais pour renouveler

export function setAuthCookie(ctx: Context, token: string): void {
  ctx.response.headers.set(
    "Set-Cookie",
    // MODIFIÉ : Max-Age 86400 (24h) → 900 (15 min)
    // L'access token est maintenant court. Le refresh token gère la durée longue.
    `auth_token=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=900`,
  );
}

export function clearAuthCookie(ctx: Context): void {
  ctx.response.headers.set(
    "Set-Cookie",
    `auth_token=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`,
  );
}

export function getTokenFromCookie(ctx: Context): string | null {
  const cookie = ctx.request.headers.get("cookie") ?? "";
  const match = cookie.split("; ").find((row: string) =>
    row.startsWith("auth_token=")
  );
  return match ? match.split("=")[1] : null;
}
// ==================== REFRESH TOKEN COOKIE ===================================
// Durée : 30 jours (2 592 000 secondes)
// Stocké en base sous forme hashée — ce cookie contient la valeur BRUTE.

export function setRefreshTokenCookie(ctx: Context, token: string): void {
  ctx.response.headers.append(
    "Set-Cookie",
    `refresh_token=${token}; HttpOnly; Secure; SameSite=None  ; Path=/refresh; Max-Age=2592000`,
  );
}

export function clearRefreshTokenCookie(ctx: Context): void {
  ctx.response.headers.append(
    "Set-Cookie",
    `refresh_token=; HttpOnly; Secure; SameSite=None; Path=/refresh; Max-Age=0`,
  );
}

export function getRefreshTokenFromCookie(ctx: Context): string | null {
  const cookie = ctx.request.headers.get("cookie") ?? "";
  const match = cookie.split("; ").find((row: string) =>
    row.startsWith("refresh_token=")
  );
  return match ? match.split("=")[1] : null;
}

// ==================== MIDDLEWARE D'AUTHENTIFICATION (pages HTML) =============
// Vérifie l'access token sur les routes protégées.
// Si expiré → redirige vers /login.html (le navigateur tentera un /refresh avant).

export async function requireAuth(ctx: Context, next: () => Promise<unknown>) {
  const token = getTokenFromCookie(ctx);
  if (!token) {
    ctx.response.redirect("/login.html");
    return;
  }
  try {
    await verify(token, secretKey);
    await next();
  } catch {
    clearAuthCookie(ctx);
    ctx.response.redirect("/login.html");
  }
}

// ==================== MIDDLEWARE D'AUTHENTIFICATION (routes API JSON) ========
// Même vérification que requireAuth, mais renvoie un 401 JSON au lieu d'une
// redirection HTML — indispensable pour les endpoints appelés via fetch()
// (ex : /lobbies), où une redirection casserait le parsing JSON côté client.

export async function requireAuthJson(
  ctx: Context,
  next: () => Promise<unknown>,
) {
  const token = getTokenFromCookie(ctx);
  if (!token) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Non authentifié." };
    return;
  }
  try {
    await verify(token, secretKey);
    await next();
  } catch {
    clearAuthCookie(ctx);
    ctx.response.status = 401;
    ctx.response.body = { error: "Token invalide ou expiré." };
  }
}

// ==================== RATE LIMITING ====================

const MAX_LOGIN_ATTEMPTS = 5;
const RATE_WINDOW_MS = 60_000;

interface RateEntry {
  count: number;
  resetAt: number;
}
const loginAttempts = new Map<string, RateEntry>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) return true;
  entry.count++;
  return false;
}
