import { Router } from "@oak/oak";
import { verify } from "@zaubrik/djwt";
import { secretKey } from "../config.ts";
import {
  AVATARS,
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
  adminKick,
  adminKill,
  checkAllReady,
  checkAllWantSkip,
  checkVotesComplet,
  closeGame,
  createPlayerId,
  forceSwitchDayTime,
  removeParfume,
  sendUpdatelobby,
  setReadyPlayer,
  startGame,
  tryKill,
  updatePlayer,
  wantSkipPlayer,
} from "./logic.ts";
import { getTokenFromCookie } from "../auth/middleware.ts";
import { API_URL, fetchWithRetry } from "../utils/fetch.ts";

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

function sendObstacles(ws: WebSocket): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "obstacles", obstacles }));
}

/** Récupère isAdmin depuis l'API pour un username donné. */
async function fetchIsAdmin(username: string): Promise<boolean> {
  try {
    const res = await fetchWithRetry(
      `${API_URL}/users/by-username/${encodeURIComponent(username)}`,
    );
    if (!res.ok) return false;
    const data = await res.json() as { adminbool?: boolean };
    return data.adminbool === true;
  } catch {
    return false;
  }
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

  // Récupérer le statut admin AVANT l'upgrade
  const isAdmin = await fetchIsAdmin(username);

  // Les admins ne comptent pas dans la limite des 20 joueurs
  const nonAdminCount = Array.from(players.values()).filter((p) =>
    !p.isAdmin
  ).length;
  if (!isAdmin && (state.gameState === "playing" || nonAdminCount >= 20)) {
    ctx.response.status = 403;
    ctx.response.body = { error: "Partie pleine ou en cours." };
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

  const spawnPoint = getRandomSpawnPoint(2600, 2000, 750, 600);

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
    avatar: "innocent",
    isParfume: false,
    dead: isAdmin, // admin commence en mode spectateur (dead=true)
    isAdmin,
  });

  if (!isAdmin) sendUpdatelobby();

  ws.onopen = () => {
    try {
      // Un non-admin ne peut pas rejoindre si partie en cours
      if (!isAdmin && (state.gameState === "playing" || nonAdminCount > 20)) {
        rejected = true;
        ws.send(JSON.stringify({ type: "rejected" }));
        players.delete(playerId);
        ws.close(1008, "Partie en cours");
        return;
      }
      sendObstacles(ws);
      ws.send(
        JSON.stringify({
          type: "playerId",
          playerId,
          startX: spawnPoint.x,
          startY: spawnPoint.y,
          isAdmin,
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

      // Si admin, on lui envoie immédiatement l'état courant de la liste joueurs
      if (isAdmin) {
        ws.send(JSON.stringify({
          type: "adminInit",
          players: Array.from(players.values()),
        }));
      }
    } catch (err) {
      console.error("Erreur onopen :", err);
    }
  };

  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      const player = players.get(playerId);

      switch (data.type) {
        case "update":
          updatePlayer(playerId, data);
          break;
        case "disconnect":
          players.delete(playerId);
          if (state.gameState === "lobby") sendUpdatelobby();
          break;
        case "killFromAssassin":
          if (player?.dead || player?.isAdmin) break;
          await tryKill(playerId, data.targetId);
          break;
        case "setReady":
          if (player?.dead || player?.isAdmin) break;
          setReadyPlayer(playerId);
          sendUpdatelobby();
          if (checkAllReady()) {
            state.gameState = "playing";
            startGame();
          }
          break;
        case "skip":
          if (player?.dead || player?.isAdmin) break;
          wantSkipPlayer(playerId);
          if (checkAllWantSkip()) {
            forceSwitchDayTime();
            state.nbSkip = 0;
          }
          break;
        case "setAvatar": {
          // Admins ne peuvent pas changer d'avatar
          if (state.gameState !== "lobby" || player?.isAdmin) break;
          const avatar = data.avatar;
          if (!AVATARS.includes(avatar)) break;
          const p = players.get(playerId);
          if (p) p.avatar = avatar;
          const avatarUpdate = JSON.stringify({
            type: "avatarUpdate",
            playerId,
            avatar,
          });
          sockets.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) client.send(avatarUpdate);
          });
          break;
        }
        case "vote":
          if (player?.dead || player?.isAdmin) break;
          pushVote(data.vote);
          {
            const aliveCount =
              Array.from(players.values()).filter((p) => !p.dead && !p.isAdmin)
                .length;
            if (votes.length === aliveCount + 1) {
              checkVotesComplet();
              resetVotes();
              forceSwitchDayTime();
            }
          }
          break;
        case "parfume": {
          if (player?.dead || player?.isAdmin) break;
          const p = players.get(data.targetId);
          if (p) p.isParfume = true;
          break;
        }
        case "unParfume":
          removeParfume();
          break;

        // ── Commandes admin ────────────────────────────────────────────
        case "adminKill":
          if (!player?.isAdmin) break;
          await adminKill(data.targetId);
          break;
        case "adminKick":
          if (!player?.isAdmin) break;
          adminKick(data.targetId);
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
        }),
      );
    } else {
      clearInterval(interval);
    }
  }, 1000 / 60);
});
