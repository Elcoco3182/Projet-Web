import { Context } from "@oak/oak";
import { verify } from "@zaubrik/djwt";
import { secretKey } from "../config.ts";

// ==================== COOKIES ====================

export function setAuthCookie(ctx: Context, token: string): void {
  ctx.response.headers.set(
    "Set-Cookie",
    `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
  );
}

export function clearAuthCookie(ctx: Context): void {
  ctx.response.headers.set(
    "Set-Cookie",
    `auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
  );
}

export function getTokenFromCookie(ctx: Context): string | null {
  const cookie = ctx.request.headers.get("cookie") ?? "";
  const match = cookie.split("; ").find((row: string) =>
    row.startsWith("auth_token=")
  );
  return match ? match.split("=")[1] : null;
}

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
