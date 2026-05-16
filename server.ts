import { Application, Router } from "https://deno.land/x/oak@v17.2.0/mod.ts";
import { send } from "https://deno.land/x/oak@v17.2.0/send.ts";
import * as path from "https://deno.land/std@0.188.0/path/mod.ts";

//const __filename = path.fromFileUrl(import.meta.url);
// Without trailing slash
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));


const router = new Router();
const app = new Application();
let sockets = new Map();
let isNight = false;


const mapHeight = 4000;
const mapWidth = 2000;

let players = new Map();
let obstacles = generateRandomObstacles(); 

console.log("Server listening on port 8080");

router.get("/ws", (ctx) => {
    if (!ctx.isUpgradable) {
      ctx.throw(501);
    }
    const ws = ctx.upgrade();
    // socket est ton WebSocket natif
    let playerId = createPlayerId();
    sockets.set(playerId,ws);
    let spawnPoint = getRandomSpawnPoint();
    players.set(playerId, {
      id: playerId,
      x: spawnPoint.x,
      y: spawnPoint.y,
      height: 40,
      width: 20,
      kills: 0,
      active: false,
    });

    ws.onopen = () => { 
      ws.send(JSON.stringify({ type: "playerId", playerId, startX: spawnPoint.x, startY: spawnPoint.y }));
      ws.send(JSON.stringify({ type: "mapSize", height: mapHeight, width: mapWidth }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "update":
          updatePlayer(playerId, data);
          break;
        case "disconnect":
          players.delete(playerId);
          break;
        case "activatePlayer":
          activatePlayer(playerId, data.joueurType);
          break;
        case "kill":
          tryKill(playerId, data.targetId);
          break;
        case "toggleNight":
          isNight = !isNight;
          sendNight(playerId);
          break;
      }
    };

    ws.onclose = () => {
      players.delete(playerId);
      sockets.delete(playerId);
    };

    setInterval(() => { 
      ws.send(
        JSON.stringify({
          type: "update",
          players: Array.from(players.values()),
          obstacles: obstacles,
          isNight: isNight,
        })
      );
    }, 1000 / 60);
});

// Serve static files from the 'public' directory
//app.use(express.static(path.join(__dirname, 'public')));
router.get("/(.*)", async (ctx) => {
   await send(ctx, ctx.request.url.pathname ,{ root: path.join(__dirname, "public") });
})

function createPlayerId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function updatePlayer(playerId, data) {
  let player = players.get(playerId);
  if (player) {
    player.x = data.x;
    player.y = data.y;
  }
}

function activatePlayer(playerId, joueurType) {
  let player = players.get(playerId);
  if (player) {
    player.active = true;
    player.type = joueurType;
  }
}

function sendKilled(playerId) {
    const data = JSON.stringify({ type: "killed", playerId });
    sockets.forEach((client) => {
        if (client.readyState === 1 ) {
            client.send(data);
        }
    });
}

function sendNight(playerId) {
    const data = JSON.stringify({ type: "toggleNight", playerId });
    sockets.forEach((client) => {
        if (client.readyState === 1 ) {
            client.send(data);
        }
    });
}

function generateRandomObstacles() {
  const obstacles = [];

  const obstacleDensity = 0.00001; // Adjust this value to control the number of obstacles per square unit
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

function collidesWithObstacle(x, y, width, height) {
  for (let obstacle of obstacles) {
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

function getRandomSpawnPoint() {
  let x, y;
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

function tryKill(attackerId, targetId) {
    const attacker = players.get(attackerId);
    const target = players.get(targetId);

    if (!attacker || !target) return;
    if (!attacker.active || !target.active) return;
    if(target.type=="assassin") return;

    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 80) return; // trop loin → ignoré

    sendKilled(targetId);
    players.delete(targetId);
}

app.use(router.routes());
app.use(router.allowedMethods())
await app.listen({ port: 8080 });