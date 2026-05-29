import { Router } from "@oak/oak";
import { verify } from "@zaubrik/djwt";
import { secretKey } from "../config.ts";
import { MAP_HEIGHT, MAP_WIDTH, players, sockets, state } from "./state.ts";
import { obstacles } from "../utils/map.ts";
import { getRandomSpawnPoint } from "../utils/map.ts";
import {
  checkAllReady,
  closeGame,
  createPlayerId,
  sendUpdatelobby,
  setReadyPlayer,
  startGame,
  tryKill,
  updatePlayer,
} from "./logic.ts";
import { getTokenFromCookie } from "../auth/middleware.ts";

export const wsRouter = new Router();

// ==================== CYCLE JOUR / NUIT ====================

function getCurrentDayTime(): string {
  if (state.isMorning) return "isMorning";
  if (state.isNoon) return "isNoon";
  if (state.isAfternoon) return "isAfternoon";
  if (state.isNight) return "isNight";
  if (state.isMidnight) return "isMidnight";
  return "Inconnu";
}

function broadcast(type: string) {
  const data = JSON.stringify({ type });
  sockets.forEach((client) => {
    if (client.readyState === 1) client.send(data);
  });
}

export function switchDayTime() {
  if (state.gameState !== "playing") return;

  if (state.isMorning) {
    state.isMorning = false;
    state.isNoon = true;
    broadcast("isNoon");
  } else if (state.isNoon) {
    state.isNoon = false;
    state.isAfternoon = true;
    broadcast("isAfternoon");
  } else if (state.isAfternoon) {
    state.isAfternoon = false;
    state.isNight = true;
    broadcast("isNight");
  } else if (state.isNight) {
    state.isNight = false;
    state.isMidnight = true;
    broadcast("isMidnight");
  } else if (state.isMidnight) {
    state.isMidnight = false;
    state.isMorning = true;
    broadcast("isMorning");
  }
}

// ==================== ROUTE WEBSOCKET ====================

wsRouter.get("/ws", async (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501);
    return;
  }

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

  if (state.gameState === "noConnected") state.gameState = "lobby";

  const spawnPoint = getRandomSpawnPoint(2250, 2000, 1300, 1000);

  if (state.gameState === "lobby") {
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
      username,
    });
    sendUpdatelobby();
  }

  ws.onopen = () => {
    try {
      if (state.gameState === "playing") {
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
        JSON.stringify({
          type: "mapSize",
          height: MAP_HEIGHT,
          width: MAP_WIDTH,
        }),
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
          if (state.gameState === "lobby") sendUpdatelobby();
          break;
        case "kill":
          await tryKill(playerId, data.targetId);
          break;
        case "setReady":
          setReadyPlayer(playerId);
          sendUpdatelobby();
          if (checkAllReady()) {
            state.gameState = "playing";
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
        obstacles,
      }));
    } else {
      clearInterval(interval);
    }
  }, 1000 / 60);
});
