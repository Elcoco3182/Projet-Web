import { Application, Router } from "jsr:@oak/oak";
//import { Application, Context, Router } from "https://deno.land/x/oak@v17.1.6/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import bcrypt from "npm:bcryptjs@2.4.3";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";



// ==================== CONFIG DB ====================

const API_URL = Deno.env.get("API_URL") ?? "http://api:8000";

async function fetchWithRetry(url: string, options?: RequestInit, retries = 5, delay = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
    } catch {
      console.log(`API non disponible, retry ${i + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error(`API inaccessible après ${retries} tentatives`);
}

// ==================== CONFIG SERVEUR ====================

const router = new Router();
const app = new Application();

const sockets = new Map();
const players = new Map();

const mapHeight = Math.random() * 1000 + 1000;
const mapWidth = Math.random() * 1000 + 1000;

let obstacles = generateRandomObstacles();

// ==================== CRÉATION DE LA PARTIE ====================

let currentPartyId: number | null = null;
let partyStarted = false;

try {
  const partieRes = await fetchWithRetry(`${API_URL}/parties`, { method: "POST" });
  const partie = await partieRes.json();
  currentPartyId = partie.id;
  console.log(`Partie créée : id=${currentPartyId}`);
} catch (err) {
  console.error("Impossible de créer la partie :", err);
}


// ==================== HEALTHCHECK ====================

router.get("/health", (ctx) => {
  ctx.response.status = 200;
  ctx.response.body = "ok";
});


// ==================== WEBSOCKET ====================

router.get("/ws", (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501);
  }

  const ws = ctx.upgrade();
  const playerId = createPlayerId();
  sockets.set(playerId, ws);

  const spawnPoint = getRandomSpawnPoint();
  players.set(playerId, {
    id: playerId,
    x: spawnPoint.x,
    y: spawnPoint.y,
    height: 40,
    width: 20,
    kills: 0,
    active: false,
  });

  ws.onopen = async () => {
    try {
      const rolesRes = await fetchWithRetry(`${API_URL}/roles`);
      const roles = await rolesRes.json();

      ws.send(JSON.stringify({ type: "playerId", playerId, startX: spawnPoint.x, startY: spawnPoint.y }));
      ws.send(JSON.stringify({ type: "mapSize", height: mapHeight, width: mapWidth }));
      ws.send(JSON.stringify({ type: "roles", roles }));
    } catch (err) {
      console.error("Erreur onopen :", err);
    }
  };

  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "update":
          updatePlayer(playerId, data);
          break;

        case "disconnect":
          players.delete(playerId);
          break;

        case "activatePlayer": {
          activatePlayer(playerId, data.joueurType);
          partyStarted = true;

          const rolesRes = await fetchWithRetry(`${API_URL}/roles`);
          const roles: { id: number; name: string }[] = await rolesRes.json();
          const role = roles.find(r => r.name === data.joueurType);

          if (role && currentPartyId) {
            await fetchWithRetry(`${API_URL}/historiques`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: 1, // ← à remplacer quand tu auras un système de login
                party_id: currentPartyId,
                role_id: role.id,
              }),
            });
            console.log(`Joueur ${playerId} enregistré avec le rôle ${data.joueurType}`);
          }
          break;
        }

        case "kill":
          await tryKill(playerId, data.targetId);
          break;
      }
    } catch (err) {
      console.error("Erreur onmessage :", err);
    }
  };

  ws.onclose = async () => {
    players.delete(playerId);
    sockets.delete(playerId);

    // Terminer la partie seulement si elle a commencé et qu'il n'y a plus personne
    if (players.size === 0 && partyStarted && currentPartyId) {
      try {
        await fetchWithRetry(`${API_URL}/parties/${currentPartyId}/end`, { method: "PATCH" });
        console.log(`Partie ${currentPartyId} terminée`);
        partyStarted = false;
      } catch (err) {
        console.error("Erreur fermeture partie :", err);
      }
    }
  };

  // Boucle de jeu : envoyer l'état 60 fois par seconde
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "update",
        players: Array.from(players.values()),
        obstacles: obstacles,
      }));
    } else {
      clearInterval(interval); // ← stopper l'interval si le client est déconnecté
    }
  }, 1000 / 60);
});

// ==================== FICHIERS STATIQUES ====================

// Fait maintenant dans src/scripts/front.ts

// ==================== FONCTIONS JEU ====================

function createPlayerId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function updatePlayer(playerId: string, data: { x: number; y: number }) {
  const player = players.get(playerId);
  if (player) {
    player.x = data.x;
    player.y = data.y;
  }
}

function activatePlayer(playerId: string, joueurType: string) {
  const player = players.get(playerId);
  if (player) {
    player.active = true;
    player.type = joueurType;
  }
}

async function sendKilled(playerId: string) {
  const data = JSON.stringify({ type: "killed", playerId });
  sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

async function tryKill(attackerId: string, targetId: string) {
  const attacker = players.get(attackerId);
  const target = players.get(targetId);

  if (!attacker || !target) return;
  if (!attacker.active || !target.active) return;
  if (target.type === "assassin") return;

  const dx = attacker.x - target.x;
  const dy = attacker.y - target.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > 80) return;

  await sendKilled(targetId);
  players.delete(targetId);
}

function generateRandomObstacles() {
  const obstacles = [];
  const obstacleDensity = 0.00001;
  const numObstacles = Math.floor(obstacleDensity * mapWidth * mapHeight);

  for (let i = 0; i < numObstacles; i++) {
    const x = Math.random() * (mapWidth - 10);
    const y = Math.random() * (mapHeight - 10);
    const width = 50 + Math.random() * 100;
    const height = 50 + Math.random() * 100;
    obstacles.push({ x, y, width, height });
  }

  return obstacles;
}

function collidesWithObstacle(x: number, y: number, width: number, height: number): boolean {
  for (const obstacle of obstacles) {
    if (
        x < obstacle.x + obstacle.width &&
        x + width > obstacle.x &&
        y < obstacle.y + obstacle.height &&
        y + height > obstacle.y
    ) {
      return true;
    }
  }
  return false;
}

function getRandomSpawnPoint(): { x: number; y: number } {
  let x = 0, y = 0;
  let validSpawn = false;

  while (!validSpawn) {
    x = Math.random() * (mapWidth - 100) + 50;
    y = Math.random() * (mapHeight - 100) + 50;
    if (!collidesWithObstacle(x, y, 60, 50)) {
      validSpawn = true;
    }
  }

  return { x, y };
}


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


// ==================== DÉMARRAGE ====================

console.log("Server listening on port 3000");
app.use(router.routes());
app.use(router.allowedMethods());
await app.listen({ port: 3000 });