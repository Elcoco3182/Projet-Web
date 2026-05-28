import { Router, send } from "@oak/oak";
import { create, verify } from "@zaubrik/djwt";
import bcrypt from "@bcryptjs";
import { POIVRE, secretKey } from "../config.ts";
import { API_URL, fetchWithRetry } from "../utils/fetch.ts";
import { validatePassword, validateUsername } from "./validation.ts";
import {
  clearAuthCookie,
  getTokenFromCookie,
  isRateLimited,
  requireAuth,
  setAuthCookie,
} from "./middleware.ts";

export const authRouter = new Router();

// ── POST /register ────────────────────────────────────────────────────────────
authRouter.post("/register", async (ctx) => {
  let body: { username?: string; password?: string };
  try {
    body = await ctx.request.body.json();
  } catch {
    ctx.response.status = 400;
    ctx.response.body = { error: "Corps de requête JSON invalide." };
    return;
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  const usernameError = validateUsername(username);
  if (usernameError) {
    ctx.response.status = 400;
    ctx.response.body = { error: usernameError };
    return;
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    ctx.response.status = 400;
    ctx.response.body = { error: passwordError };
    return;
  }

  const salt = await bcrypt.genSalt(12);
  const password_hash = await bcrypt.hash(password + POIVRE, salt);

  let res: Response;
  try {
    res = await fetchWithRetry(`${API_URL}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password_hash }),
    });
  } catch {
    ctx.response.status = 503;
    ctx.response.body = { error: "Service indisponible, réessayez plus tard." };
    return;
  }

  if (res.status === 409) {
    ctx.response.status = 409;
    ctx.response.body = { error: "Ce nom d'utilisateur est déjà pris." };
    return;
  }
  if (!res.ok) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Erreur lors de la création du compte." };
    return;
  }

  const token = await create(
    { alg: "HS512", typ: "JWT" },
    { username },
    secretKey,
  );
  setAuthCookie(ctx, token);
  ctx.response.status = 201;
  ctx.response.body = { message: "Compte créé avec succès.", username };
});

// ── POST /login ───────────────────────────────────────────────────────────────
authRouter.post("/login", async (ctx) => {
  const ip = ctx.request.ip;
  if (isRateLimited(ip)) {
    ctx.response.status = 429;
    ctx.response.body = {
      error: "Trop de tentatives. Réessayez dans une minute.",
    };
    return;
  }

  let body: { username?: string; password?: string };
  try {
    body = await ctx.request.body.json();
  } catch {
    ctx.response.status = 400;
    ctx.response.body = { error: "Corps de requête JSON invalide." };
    return;
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!username || !password) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Nom d'utilisateur et mot de passe requis." };
    return;
  }

  let userRes: Response | null = null;
  try {
    userRes = await fetchWithRetry(
      `${API_URL}/users/by-username/${encodeURIComponent(username)}`,
    );
  } catch {
    /* L'API est down — on continue avec un hash invalide pour éviter le timing attack */
  }

  let hashToCheck = "$2a$12$invalide.hash.pour.eviter.timing.attaque";
  let fetchedUsername: string | null = null;

  if (userRes?.ok) {
    const userData = await userRes.json() as {
      username: string;
      password_hash: string;
    };
    hashToCheck = userData.password_hash;
    fetchedUsername = userData.username;
  }

  const valid = await bcrypt.compare(password + POIVRE, hashToCheck);

  if (!fetchedUsername || !valid) {
    ctx.response.status = 401;
    ctx.response.body = {
      error: "Nom d'utilisateur ou mot de passe incorrect.",
    };
    return;
  }

  const token = await create({ alg: "HS512", typ: "JWT" }, {
    username: fetchedUsername,
  }, secretKey);
  setAuthCookie(ctx, token);
  ctx.response.status = 200;
  ctx.response.body = {
    message: "Connexion réussie.",
    username: fetchedUsername,
  };
});

// ── POST /logout ──────────────────────────────────────────────────────────────
authRouter.post("/logout", (ctx) => {
  clearAuthCookie(ctx);
  ctx.response.status = 200;
  ctx.response.body = { message: "Déconnexion réussie." };
});

// ── GET /verify ───────────────────────────────────────────────────────────────
authRouter.get("/verify", async (ctx) => {
  const token = getTokenFromCookie(ctx);
  if (!token) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Non authentifié." };
    return;
  }
  try {
    const payload = await verify(token, secretKey);
    ctx.response.status = 200;
    ctx.response.body = { username: payload.username };
  } catch {
    clearAuthCookie(ctx);
    ctx.response.status = 401;
    ctx.response.body = { error: "Token invalide ou expiré." };
  }
});

// ── Fichiers statiques publics ────────────────────────────────────────────────
authRouter.get("/login.html", async (ctx) => {
  await send(ctx, "login.html", { root: "./public" });
});
authRouter.get("/login.css", async (ctx) => {
  await send(ctx, "login.css", { root: "./public" });
});
authRouter.get("/login.js", async (ctx) => {
  await send(ctx, "login.js", { root: "./public" });
});

// ── Routes protégées ──────────────────────────────────────────────────────────
authRouter.get("/", requireAuth, async (ctx) => {
  await send(ctx, "index.html", { root: "./public" });
});
authRouter.get("/index.html", requireAuth, async (ctx) => {
  await send(ctx, "index.html", { root: "./public" });
});
