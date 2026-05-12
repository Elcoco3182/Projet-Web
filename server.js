const WebSocket = require("ws");
const http = require("http");
const express = require("express");
const path = require("path");

const app = express();

const errorHandler = error => {
  if (error.syscall !== 'listen') {
    throw error;
  }
  switch (error.code) {
    case 'EADDRINUSE':
      console.error('port: 8080 is already in use.');
      process.exit(1);
      break;
    default:
      throw error;
  }
};

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
server.on('error', errorHandler);

const wss = new WebSocket.Server({ server });

const mapHeight = Math.random() * 1000 + 1000;
const mapWidth = Math.random() * 1000 + 1000;

let players = new Map();
let obstacles = generateRandomObstacles(); 

wss.on("connection", (ws) => {
  let playerId = createPlayerId();
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

  ws.send(JSON.stringify({ type: "playerId", playerId, startX: spawnPoint.x, startY: spawnPoint.y }));
  ws.send(JSON.stringify({ type: "mapSize", height: mapHeight, width: mapWidth }));

  ws.on("message", (message) => {
    let data = JSON.parse(message);
    switch (data.type) {
      case "update":
        updatePlayer(playerId, data);
        break;
      case "disconnect":
        players.delete(playerId);
        break;
      case "activatePlayer": 
        activatePlayer(playerId);
        break;
      case "kill":
        tryKill(playerId, data.targetId);
        break;
    }
  });

  ws.on("close", () => {
    players.delete(playerId);
  });

  setInterval(() => { 
    ws.send(
      JSON.stringify({
        type: "update",
        players: Array.from(players.values()),
        obstacles: obstacles,
      })
    );
  }, 1000 / 60);
});

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

function activatePlayer(playerId) {
  let player = players.get(playerId);
  if (player) {
    player.active = true;
  }
}

function sendKilled(playerId) {
    const data = JSON.stringify({ type: "killed", playerId }); // ← minuscule
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
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

    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 80) return; // trop loin → ignoré

    sendKilled(targetId);
    players.delete(targetId);
}

// Listen on port 8080 for both HTTP and WebSocket
server.listen(8080, () => {
  console.log("Server listening on port 8080, connect to play");
  require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    console.log('Play with anyone on your network: ' + add + ':8080');
  })
});