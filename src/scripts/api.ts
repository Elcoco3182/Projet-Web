/**
 * api.ts — Serveur d'authentification
 *
 * Responsabilités :
 *   - POST /register  : créer un compte utilisateur
 *   - POST /login     : authentifier un utilisateur ,  s'authentifier, reçoit un cookie JWT HttpOnly
 *   - POST /logout    : invalider la session soit supprimer le cookie
 *   - GET  /verify    : vérifier si le token est valide  (utilisé par le serveur de jeu)
 *
 */

import { Application, Context, Router } from "https://deno.land/x/oak@v17.1.6/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import bcrypt from "npm:bcryptjs@2.4.3";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";


// ─────────────────────────────────────────────────────────────────────────────
// Configuration depuis les variables d'environnement
// ─────────────────────────────────────────────────────────────────────────────

//vérification des variables d'environnement 
function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`FATAL : la variable d'environnement "${name}" est manquante.`);
    Deno.exit(1);
  }
  return value;
}


const PORT = parseInt(Deno.env.get("API_PORT") ?? "3000");
const FRONT_ORIGIN = Deno.env.get("FRONT_ORIGIN")?? "http://localhost:8080";

// Vérification: le secret JWT doit être défini explicitement
const JWT_SECRET = Deno.env.get("JWT_SECRET");

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("FATAL: JWT_SECRET doit être défini et faire au moins 32 caractères.");
  console.error("Générer avec : openssl rand -base64 64");
  Deno.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Clé JWT — Stable entre les redémarrages → les tokens existants restent valides.
// ─────────────────────────────────────────────────────────────────────────────

const secretKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_SECRET),
  { name: "HMAC", hash: "SHA-512" },
  false,
  ["sign", "verify"]
);

// ─────────────────────────────────────────────────────────────────────────────
// Pool de connexions PostgreSQL
// ─────────────────────────────────────────────────────────────────────────────

const pool = new Pool(
  {
    hostname: Deno.env.get("POSTGRES_HOST")     ?? "db",
    port:     parseInt(Deno.env.get("POSTGRES_PORT") ?? "5432"),
    user:     Deno.env.get("POSTGRES_USER"),
    password: Deno.env.get("POSTGRES_PASSWORD"),
    database: Deno.env.get("POSTGRES_DB"),
  },
  5 // Taille du pool de connexions
);

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting (protection brute force sur /login)
// 5 tentatives max par IP par fenêtre de 60 secondes
// ─────────────────────────────────────────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const RATE_WINDOW_MS     = 60_000;

interface RateEntry {
  count: number;
  resetAt: number;
}
const loginAttempts = new Map<string, RateEntry>();

function isRateLimited(ip: string): boolean {
  const now   = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return true;
  }

  entry.count++;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers cookie et token
// ─────────────────────────────────────────────────────────────────────────────

// Pose le cookie JWT HttpOnly dans la réponse
function setAuthCookie(ctx: Context, token: string): void {
  // HttpOnly  : inaccessible depuis JavaScript (protection XSS)
  // SameSite=Strict : non envoyé lors de requêtes cross-site (protection CSRF)
  // Path=/    : valide sur tout le domaine
  // Max-Age   : 24 heures
  ctx.response.headers.set(
    "Set-Cookie",
    `auth_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`
  );
}

/** Efface le cookie JWT (logout) */
function clearAuthCookie(ctx: Context): void {
  ctx.response.headers.set(
    "Set-Cookie",
    `auth_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
  );
}

// Extrait le token depuis le header Cookie
function getTokenFromCookie(ctx: Context): string | null {
  const cookie = ctx.request.headers.get("cookie") ?? "";
  const match  = cookie.split("; ").find((row) => row.startsWith("auth_token="));
  return match ? match.split("=")[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation des inputs utilisateur
// ─────────────────────────────────────────────────────────────────────────────

function validateUsername(username: string): string | null {
  if (!username || username.length < 3) return "Le nom d'utilisateur doit faire au moins 3 caractères.";
  if (username.length > 30)            return "Le nom d'utilisateur ne peut pas dépasser 30 caractères.";
  //vérification avec expression régulière
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return "Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscores.";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return "Le mot de passe doit faire au moins 8 caractères.";
  if (password.length > 128)            return "Le mot de passe est trop long.";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

const router = new Router();

// ── POST /register ────────────────────────────────────────────────────────────
router.post("/register", async (ctx) => {
  let body: { username?: string; password?: string };
  try {
    body = await ctx.request.body.json();
  } catch {
    ctx.response.status = 400;
    ctx.response.body   = { error: "Corps de requête JSON invalide." };
    return;
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  // Validation username
  const usernameError = validateUsername(username);
  if (usernameError) {
    ctx.response.status = 400;
    ctx.response.body   = { error: usernameError };
    return;
  }

  // Validation password
  const passwordError = validatePassword(password);
  if (passwordError) {
    ctx.response.status = 400;
    ctx.response.body   = { error: passwordError };
    return;
  }

  const client = await pool.connect();
  try {
    // Vérifier si le username est déjà pris
    const existing = await client.queryObject<{ id: number }>(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );
    if (existing.rows.length > 0) {
      ctx.response.status = 409;
      ctx.response.body   = { error: "Ce nom d'utilisateur est déjà pris." };
      return;
    }

    // Hasher le mot de passe  avant de l'insérer
    const salt          = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Insérer l'utilisateur dans la bd
    await client.queryObject(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
      [username, password_hash]
    );

    // Auto-login après inscription
    const token = await create(
      { alg: "HS512", typ: "JWT" },
      { username },
      secretKey
    );
    setAuthCookie(ctx, token);
    ctx.response.status = 201;
    ctx.response.body   = { message: "Compte créé avec succès.", username };
  } finally {
    client.release();
  }
});

// ── POST /login ───────────────────────────────────────────────────────────────
router.post("/login", async (ctx) => {
  // Rate limiting par IP
  const ip = ctx.request.ip;
  if (isRateLimited(ip)) {
    ctx.response.status = 429;
    ctx.response.body   = { error: "Trop de tentatives. Réessayez dans une minute." };
    return;
  }

  let body: { username?: string; password?: string };
  try {
    body = await ctx.request.body.json();
  } catch {
    ctx.response.status = 400;
    ctx.response.body   = { error: "Corps de requête JSON invalide." };
    return;
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!username || !password) {
    ctx.response.status = 400;
    ctx.response.body   = { error: "Nom d'utilisateur et mot de passe requis." };
    return;
  }

  const client = await pool.connect();
  try {
    const result = await client.queryObject<{
      username: string;
      password_hash: string;
    }>(
      "SELECT username, password_hash FROM users WHERE username = $1",
      [username]
    );

    const user = result.rows[0];

    // Timing attack prevention :
    // On exécute bcrypt.compare même si l'utilisateur n'existe pas,
    // pour éviter qu'un attaquant mesure la différence de temps de réponse.
    const hashToCheck = user?.password_hash ?? "$2a$12$invalide.hash.pour.eviter.timing.attaque";
    const valid       = await bcrypt.compare(password, hashToCheck);

    // Message d'erreur identique dans les deux cas (user inexistant ou mauvais mdp)
    if (!user || !valid) {
      ctx.response.status = 401;
      ctx.response.body   = { error: "Nom d'utilisateur ou mot de passe incorrect." };
      return;
    }

    //Authentification  réussie
    const token = await create(
      { alg: "HS512", typ: "JWT" },
      { username: user.username },
      secretKey
    );
    setAuthCookie(ctx, token);

    ctx.response.status = 200;
    ctx.response.body   = { message: "Connexion réussie.", username: user.username };
  } finally {
    client.release();
  }
});

// ── POST /logout ──────────────────────────────────────────────────────────────
router.post("/logout", (ctx) => {
  clearAuthCookie(ctx);
  ctx.response.status = 200;
  ctx.response.body   = { message: "Déconnexion réussie." };
});

// ── GET /verify ───────────────────────────────────────────────────────────────
// Utilisé par le serveur de jeu pour valider qu'un joueur est bien authentifié
router.get("/verify", async (ctx) => {
  const token = getTokenFromCookie(ctx);
  if (!token) {
    ctx.response.status = 401;
    ctx.response.body   = { error: "Non authentifié." };
    return;
  }

  try {
    const payload       = await verify(token, secretKey);
    
    ctx.response.status = 200;
    ctx.response.body   = { username: payload.username };
  } catch {
    // Token invalide ou expiré
    clearAuthCookie(ctx); // Nettoyer le cookie corrompu
    ctx.response.status = 401;
    ctx.response.body   = { error: "Token invalide ou expiré." };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Application
// ─────────────────────────────────────────────────────────────────────────────

const app = new Application();

// CORS : autoriser uniquement le serveur front à appeler l'API
app.use(
  oakCors({
    origin:         FRONT_ORIGIN,
    methods:        ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials:    true, // Nécessaire pour que les cookies soient envoyés
  })
);

// Logger minimal (sans données sensibles)
app.use(async (ctx, next) => {
  await next();
  console.log(`${ctx.request.method} ${ctx.request.url.pathname} → ${ctx.response.status}`);
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log(`Serveur API démarré sur le port ${PORT}`);
await app.listen({ port: PORT });
