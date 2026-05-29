import { Router } from "@oak/oak";
import { verify } from "@zaubrik/djwt";
import { secretKey } from "../config.ts";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  players,
  pushVote,
  resetVotes,
  sockets,
  state,
  votes,
} from "./state.ts";
import { getRandomSpawnPoint, obstacles } from "../utils/map.ts";
import {
  checkAllReady,
  checkAllWantSkip,
  checkVotesComplet,
  closeGame,
  createPlayerId,
  forceSwitchDayTime,
  sendUpdatelobby,
  setReadyPlayer,
  startGame,
  tryKill,
  updatePlayer,
  wantSkipPlayer,
} from "./logic.ts";
import { getTokenFromCookie } from "../auth/middleware.ts";

export const wsRouter = new Router();

export function getCurrentDayTime(): string {
  if (state.isMorning) return "isMorning";
  if (state.isNoon) return "isNoon";
  if (state.isAfternoon) return "isAfternoon";
  if (state.isNight) return "isNight";
  if (state.isMidnight) return "isMidnight";
  if (state.isDawn) return "isDawn";
  return "Inconnu";
}

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

  if (state.gameState === "lobby" && players.size <= 20) {
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
      if (state.gameState === "playing" || players.size > 20) {
        rejected = true;
        ws.send(JSON.stringify({ type: "rejected" }));
        players.delete(playerId);
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
        case "killFromAssassin":
          await tryKill(playerId, data.targetId);
          forceSwitchDayTime();
          break;
        case "setReady":
          setReadyPlayer(playerId);
          sendUpdatelobby();
          if (checkAllReady()) {
            state.gameState = "playing";
            startGame();
          }
          break;
        case "skip":
          wantSkipPlayer(playerId);
          if (checkAllWantSkip()) {
            forceSwitchDayTime();
            state.nbSkip = 0;
          }
          break;
        case "vote":
          pushVote(data.vote);
          if (votes.length === players.size + 1) {
            checkVotesComplet();
            resetVotes();
            forceSwitchDayTime();
          }
          break;
      }
    } catch (err) {
      console.error("Erreur onmessage :", err);
    }
  };

  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "update",
          players: Array.from(players.values()),
          obstacles,
        }),
      );
    } else {
      clearInterval(interval);
    }
  }, 1000 / 60);
});
