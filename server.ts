import { Application, Context, Router, send } from "@oak/oak";
//import { Application, Context, Router } from "https://deno.land/x/oak@v17.1.6/mod.ts";
import { oakCors } from "@deno.land/x/cors";
import { create, verify } from "@zaubrik/djwt";
import bcrypt from "@bcryptjs";
//import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

// ==================== CONFIG DB ====================

const API_URL = Deno.env.get("API_URL") ?? "http://api:8000";

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 5,
  delay = 2000,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      console.log(`Réponse non-ok: ${res.status} pour ${url}`); // ← ici
    } catch {
      console.log(`API non disponible, retry ${i + 1}/${retries}...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`API inaccessible après ${retries} tentatives`);
}

// ==================== Config chlag ======================

// a = assassin p = petitefille i = innocent
const roleSelonNbJoueur = [
  "",
  "",
  "",
  "api",
  "apii",
  "apiii",
  "aapiii",
  "aappiii",
  "aappiiii",
  "aaapppiii",
  "aaapppiiii",
];

// ==================== CONFIG SERVEUR ====================

const router = new Router();
const app = new Application();

const sockets = new Map();
const players = new Map();
// des booleans pour savoir à quel moment du cycle jour nuit on est
let isMorning = false;
let isNoon = false;
let isAfternoon = true;
let isNight = false;
let isMidnight = false;

let gameState = "noConnected";
let nbReady = 0;

const mapHeight = 1550;
const mapWidth = 4000;

import rectangles from "./public/assets/map/polytech.json" with {
  type: "json",
};

const obstacles = setObstacle();

setInterval(() => {
  switchDayTime();
}, 4_000); // on switch de phase toute les minutes pour l(instant toute les 1à sec pour des test)

// ==================== CRÉATION DE LA PARTIE ====================

let currentPartyId: number | null = null;

async function fecthPartiApi() {
  try {
    const partieRes = await fetchWithRetry(`${API_URL}/parties`, {
      method: "POST",
    });
    const partie = await partieRes.json();
    currentPartyId = partie.id;
    console.log(`Partie créée : id=${currentPartyId}`);
  } catch (err) {
    console.error("Impossible de créer la partie :", err);
  }
}

// ==================== HEALTHCHECK ====================

router.get("/health", (ctx) => {
  ctx.response.status = 200;
  ctx.response.body = "ok";
});

// ==================== WEBSOCKET ====================

router.get("/ws", async (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501);
  }

  // Vérifier le token et récupérer le username
  const token = getTokenFromCookie(ctx);
  if (!token) {
    ctx.throw(401);
    return;
  }
  let username = "Inconnu";
  try {
    const payload = await verify(token, secretKey);
    username = payload.username as string;
  } catch {
    ctx.throw(401);
    return;
  }

  const ws = ctx.upgrade();
  const playerId = createPlayerId();
  let rejected = false;

  ws.onclose = () => {
    if (rejected) return;

    players.delete(playerId);
    sockets.delete(playerId);
    sendUpdatelobby();

    closeGame();
  };

  if (gameState === "noConnected") {
    gameState = "lobby";
  }

  const spawnPoint = getRandomSpawnPoint(2250, 2000, 1300, 1000);

  if (gameState === "noConnected" || gameState === "lobby") {
    sockets.set(playerId, ws);

    players.set(playerId, {
      id: playerId,
      x: spawnPoint.x,
      y: spawnPoint.y,
      height: 40,
      width: 20,
      kills: 0,
      active: false,
      ready: false,
      username: username, // ← ajouter ça
    });

    sendUpdatelobby();
  }

  ws.onopen = () => {
    try {
      if (gameState === "playing") {
        rejected = true;
        ws.send(JSON.stringify({ type: "rejected" }));
        ws.close(1008, "Partie en cours");
        return;
      }
      ws.send(
        JSON.stringify({
          type: "playerId",
          playerId,
          startX: spawnPoint.x,
          startY: spawnPoint.y,
        }),
      );
      ws.send(
        JSON.stringify({ type: "mapSize", height: mapHeight, width: mapWidth }),
      );
      ws.send(JSON.stringify({ type: getCurrentDayTime() }));
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
          if (gameState === "lobby") {
            sendUpdatelobby();
          }
          break;
        case "kill":
          await tryKill(playerId, data.targetId);
          break;
        case "setReady":
          setReadyPlayer(playerId);
          sendUpdatelobby();
          if (checkAllReady()) {
            gameState = "playing";
            startGame();
          }
          break;
      }
    } catch (err) {
      console.error("Erreur onmessage :", err);
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

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function getRandomArbitrary(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

async function startGame() {
  await fecthPartiApi();
  await giveRoleAll();
}

async function giveRoleAll() {
  const tabInt = [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
  ];
  const tabPlayer: string[] = [];
  let i = 0;

  players.forEach((player) => {
    tabPlayer[i] = player.id;
    i += 1;

    const indexrand1 = getRandomInt(players.size);
    const indexrand2 = getRandomInt(players.size);
    let buffer = 0;

    buffer = tabInt[indexrand1];
    tabInt[indexrand1] = tabInt[indexrand2];
    tabInt[indexrand2] = buffer;
  });

  i = 0;
  const rolePossible = roleSelonNbJoueur[players.size];

  for (const playerId of tabPlayer) {
    // ton code
    // il  faut ici choisir un rôle aléatoirement
    let role = rolePossible.charAt(tabInt[i]);
    let role_id = 0;
    switch (role) {
      case "a":
        role = "assassin";
        role_id = 2;
        break;
      case "p":
        role = "petitefille";
        role_id = 3;
        break;
      case "i":
        role = "innocent";
        role_id = 1;
        break;
    }

    i++;

    console.log("Envoi historique:", {
      user_id: 1,
      party_id: currentPartyId,
      role_id: role_id,
    });

    await fetchWithRetry(`${API_URL}/historiques`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1, // ← à remplacer quand tu auras un système de login
        party_id: currentPartyId,
        role_id: role_id,
      }),
    });

    const spawn = getRandomSpawnPoint(2250, 2000, 1300, 1000);
    activatePlayer(playerId, role, spawn);
    const playerSocket = sockets.get(playerId);
    console.log(`Joueur role ${role}`);
    if (playerSocket?.readyState === WebSocket.OPEN) {
      playerSocket.send(
        JSON.stringify({
          type: "gameStart",
          role,
          startX: spawn.x,
          startY: spawn.y,
        }),
      );
    }

    console.log(`Joueur ${playerId} enregistré avec le rôle ${role}`);
  }
}

function createPlayerId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function updatePlayer(
  playerId: string,
  data: { x: number; y: number; d: string },
) {
  const player = players.get(playerId);
  if (player) {
    player.x = data.x;
    player.y = data.y;
    player.d = data.d;
  }
}

function activatePlayer(
  playerId: string,
  role: string,
  spawn?: { x: number; y: number },
) {
  const player = players.get(playerId);
  if (player) {
    player.active = true;
    player.type = role;
    if (spawn) {
      player.x = spawn.x;
      player.y = spawn.y;
    }
  }
}

function setReadyPlayer(playerId: string) {
  const player = players.get(playerId);
  if (player) {
    player.ready = true;
  }
}

function miseAjourReady() {
  nbReady = 0;
  players.forEach((player) => {
    if (player.ready) {
      nbReady += 1;
    }
  });
}

function checkAllReady() {
  miseAjourReady();
  return players.size >= 3 && nbReady == players.size;
}

function sendKilled(playerId: string) {
  const data = JSON.stringify({ type: "killed", playerId });
  sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function sendUpdatelobby() {
  miseAjourReady();
  const data = JSON.stringify({
    type: "lobbyUpdate",
    nbReady,
    total: players.size,
  });
  sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function switchDayTime() {
  if (gameState == "playing") {
    if (isMorning) {
      isMorning = false;
      isNoon = true;
      const data = JSON.stringify({ type: "isNoon" });
      sockets.forEach((client) => {
        if (client.readyState === 1) {
          client.send(data);
        }
      });
    } else if (isNoon) {
      isNoon = false;
      isAfternoon = true;
      const data = JSON.stringify({ type: "isAfternoon" });
      sockets.forEach((client) => {
        if (client.readyState === 1) {
          client.send(data);
        }
      });
    } else if (isAfternoon) {
      isAfternoon = false;
      isNight = true;
      const data = JSON.stringify({ type: "isNight" });
      sockets.forEach((client) => {
        if (client.readyState === 1) {
          client.send(data);
        }
      });
    } else if (isNight) {
      isNight = false;
      isMidnight = true;
      const data = JSON.stringify({ type: "isMidnight" });
      sockets.forEach((client) => {
        if (client.readyState === 1) {
          client.send(data);
        }
      });
    } else if (isMidnight) {
      isMidnight = false;
      isMorning = true;
      const data = JSON.stringify({ type: "isMorning" });
      sockets.forEach((client) => {
        if (client.readyState === 1) {
          client.send(data);
        }
      });
    }
  }
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

  const result = isEndGame();
  if (result !== "continue") {
    broadcastGameEnd(result);
    closeGame();
  }
}

function isEndGame() {
  let nbInnocent = 0;
  let nbPsyco = 0;
  players.forEach((player) => {
    switch (player.type) {
      case "innocent":
        nbInnocent += 1;
        break;
      case "petitefille":
        nbInnocent += 1;
        break;
      case "assassin":
        nbPsyco += 1;
        break;
    }
  });

  if (nbPsyco <= 0) {
    return "vicInno";
  }
  if (nbPsyco >= nbInnocent) {
    return "vicPsyco";
  }
  return "continue";
}

async function closeGame() {
  if (gameState === "playing") {
    const result = isEndGame();
    if (result !== "continue") {
      broadcastGameEnd(result);
    }
  }

  if (players.size === 0 && gameState === "playing" && currentPartyId) {
    try {
      await fetchWithRetry(`${API_URL}/parties/${currentPartyId}/end`, {
        method: "PATCH",
      });
      console.log(`Partie ${currentPartyId} terminée`);
    } catch (err) {
      console.error("Erreur fermeture partie :", err);
    }
  }

  if (players.size === 0) {
    gameState = "noConnected";
    currentPartyId = null;
  }
}

function broadcastGameEnd(result: string) {
  const data = JSON.stringify({ type: "gameEnd", result });
  sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });

  // Reset du state côté serveur avec un délai pour laisser le message arriver
  setTimeout(() => {
    resetToLobby();
  }, 5000);
}

function resetToLobby() {
  gameState = "lobby";
  nbReady = 0;
  currentPartyId = null;

  // Remettre tous les joueurs en état "non prêt"
  players.forEach((player) => {
    player.ready = false;
    player.active = false;
    player.type = undefined;
    // Nouveau point de spawn
    const spawn = getRandomSpawnPoint(2250, 2000, 1300, 1000);
    player.x = spawn.x;
    player.y = spawn.y;
  });

  // Réinitialiser le cycle jour/nuit
  isMorning = false;
  isNoon = false;
  isAfternoon = true;
  isNight = false;
  isMidnight = false;

  sendUpdatelobby();
}

function setObstacle() {
  const obstacles: { x: number; y: number; width: number; height: number }[] =
    [];

  rectangles.forEach((rectangle) =>
    obstacles.push({
      x: rectangle[0],
      y: rectangle[1],
      width: rectangle[2],
      height: rectangle[3],
    })
  );

  return obstacles;
}

function collidesWithObstacle(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
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

function getRandomSpawnPoint(
  maxX: number,
  minX: number,
  maxY: number,
  minY: number,
): { x: number; y: number } {
  let x = 0, y = 0;
  let validSpawn = false;

  while (!validSpawn) {
    x = getRandomArbitrary(minX, maxX);
    y = getRandomArbitrary(minY, maxY);

    if (!collidesWithObstacle(x, y, 60, 50)) {
      validSpawn = true;
    }
  }

  return { x, y };
}

function getCurrentDayTime() {
  if (isMorning) return "isMorning";
  if (isNoon) return "isNoon";
  if (isAfternoon) return "isAfternoon";
  if (isNight) return "isNight";
  if (isMidnight) return "isMidnight";
  return "Inconnu";
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration depuis les variables d'environnement
// ─────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(Deno.env.get("API_PORT") ?? "3000");
//const FRONT_ORIGIN = Deno.env.get("FRONT_ORIGIN") ?? "https://localhost:8080";

// Vérification: le secret JWT doit être défini explicitement
const JWT_SECRET = Deno.env.get("JWT_SECRET");

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    "FATAL: JWT_SECRET doit être défini et faire au moins 32 caractères.",
  );
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
  ["sign", "verify"],
);

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting (protection brute force sur /login)
// 5 tentatives max par IP par fenêtre de 60 secondes
// ─────────────────────────────────────────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const RATE_WINDOW_MS = 60_000;

interface RateEntry {
  count: number;
  resetAt: number;
}
const loginAttempts = new Map<string, RateEntry>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
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

function setAuthCookie(ctx: Context, token: string): void {
  ctx.response.headers.set(
    "Set-Cookie",
    `auth_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
  );
}

function clearAuthCookie(ctx: Context): void {
  ctx.response.headers.set(
    "Set-Cookie",
    `auth_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
  );
}

function getTokenFromCookie(ctx: Context): string | null {
  const cookie = ctx.request.headers.get("cookie") ?? "";
  const match = cookie.split("; ").find((row: string) =>
    row.startsWith("auth_token=")
  );
  return match ? match.split("=")[1] : null;
}

async function requireAuth(ctx: Context, next: () => Promise<unknown>) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Validation des inputs utilisateur
// ─────────────────────────────────────────────────────────────────────────────

function validateUsername(username: string): string | null {
  if (!username || username.length < 3) {
    return "Le nom d'utilisateur doit faire au moins 3 caractères.";
  }
  if (username.length > 30) {
    return "Le nom d'utilisateur ne peut pas dépasser 30 caractères.";
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return "Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscores.";
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "Le mot de passe doit faire au moins 8 caractères.";
  }
  if (password.length > 128) return "Le mot de passe est trop long.";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes d'authentification
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /register ────────────────────────────────────────────────────────────
router.post("/register", async (ctx) => {
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

  // Hachage du mot de passe (reste dans server.ts, api.ts ne voit jamais le mot de passe en clair)
  const POIVRE = Deno.env.get("POIVRE");
  const salt = await bcrypt.genSalt(12);
  const password_hash = await bcrypt.hash(password + POIVRE, salt);

  // Déléguer la persistance à api.ts
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

  // Auto-login après inscription
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
router.post("/login", async (ctx) => {
  // Rate limiting par IP
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

  // Récupérer le hash depuis api.ts
  let userRes: Response | null = null;
  try {
    userRes = await fetchWithRetry(
      `${API_URL}/users/by-username/${encodeURIComponent(username)}`,
    );
  } catch {
    // L'API est down — on continue avec un hash invalide pour éviter le timing attack
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

  // Timing-safe : bcrypt.compare s'exécute même si l'utilisateur n'existe pas
  const POIVRE =  Deno.env.get("POIVRE")
  const valid = await bcrypt.compare(password + POIVRE, hashToCheck);
  

  // Message d'erreur identique dans les deux cas (user inexistant ou mauvais mdp)
  if (!fetchedUsername || !valid) {
    ctx.response.status = 401;
    ctx.response.body = {
      error: "Nom d'utilisateur ou mot de passe incorrect.",
    };
    return;
  }

  const token = await create(
    { alg: "HS512", typ: "JWT" },
    { username: fetchedUsername },
    secretKey,
  );
  setAuthCookie(ctx, token);
  ctx.response.status = 200;
  ctx.response.body = {
    message: "Connexion réussie.",
    username: fetchedUsername,
  };
});

// ── POST /logout ──────────────────────────────────────────────────────────────
router.post("/logout", (ctx) => {
  clearAuthCookie(ctx);
  ctx.response.status = 200;
  ctx.response.body = { message: "Déconnexion réussie." };
});

// ── GET /verify ───────────────────────────────────────────────────────────────
router.get("/verify", async (ctx) => {
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

router.get("/login.html", async (ctx) => {
  await send(ctx, "login.html", { root: "./public" });
});
router.get("/style.css", async (ctx) => {
  await send(ctx, "style.css", { root: "./public" });
});
router.get("/login.js", async (ctx) => {
  await send(ctx, "login.js", { root: "./public" });
});

// Route protégée pour index.html
router.get("/", requireAuth, async (ctx) => {
  await send(ctx, "index.html", { root: "./public" });
});
router.get("/index.html", requireAuth, async (ctx) => {
  await send(ctx, "index.html", { root: "./public" });
});

// ─────────────────────────────────────────────────────────────────────────────
// Application
// ─────────────────────────────────────────────────────────────────────────────

// ==================== CORS ====================

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",");

app.use(
  oakCors({
    origin: (requestOrigin) => {
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
        return requestOrigin || "*";
      }
      return false;
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Logger minimal (sans données sensibles)
app.use(async (ctx, next) => {
  await next();
  console.log(
    `${ctx.request.method} ${ctx.request.url.pathname} → ${ctx.response.status}`,
  );
});

// ==================== DÉMARRAGE ====================

console.log("Server listening on port 3000");
app.use(router.routes());
app.use(router.allowedMethods());
// ==================== HTTPS ====================

await app.listen({
  port: PORT,
  secure: true,
  cert: await Deno.readTextFile("./certs/localhost+2.pem"),
  key: await Deno.readTextFile("./certs/localhost+2-key.pem"),
});
