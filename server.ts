import { Application, Router } from "jsr:@oak/oak";

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

// ==================== DÉMARRAGE ====================

console.log("Server listening on port 3000");
app.use(router.routes());
app.use(router.allowedMethods());
await app.listen({ port: 3000 });