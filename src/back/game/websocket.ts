//src/back/game/websocket.ts
import { Router } from "@oak/oak";
import { verify } from "@zaubrik/djwt";
import bcrypt from "@bcryptjs";
import { secretKey } from "../config.ts";
import { AVATARS } from "./state.ts";
import { lobbyManager } from "./lobby.ts";
import type { Lobby } from "./lobby.ts";
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
import { MAP_HEIGHT, MAP_WIDTH } from "./state.ts";

export const wsRouter = new Router();

export function getCurrentDayTime(lobby: Lobby): string {
  if (lobby.isMorning) return "isMorning";
  if (lobby.isNoon) return "isNoon";
  if (lobby.isAfternoon) return "isAfternoon";
  if (lobby.isNight) return "isNight";
  if (lobby.isMidnight) return "isMidnight";
  if (lobby.isDawn) return "isDawn";
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

  // ── Résolution du lobby ciblé ────────────────────────────────────────────
  const lobbyId = ctx.request.url.searchParams.get("lobbyId");
  const password = ctx.request.url.searchParams.get("password") ?? "";

  if (!lobbyId) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Paramètre lobbyId manquant." };
    return;
  }

  const lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Lobby introuvable." };
    return;
  }

  if (lobby.passwordHash) {
    const valid = await bcrypt.compare(password, lobby.passwordHash);
    if (!valid) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Mot de passe du lobby incorrect." };
      return;
    }
  }

  // Récupérer le statut admin AVANT l'upgrade
  const isAdmin = await fetchIsAdmin(username);

  // Les admins ne comptent pas dans la limite des 20 joueurs
  const nonAdminCount = Array.from(lobby.players.values()).filter((p) =>
    !p.isAdmin
  ).length;
  if (!isAdmin && (lobby.gameState === "playing" || nonAdminCount >= 20)) {
    ctx.response.status = 403;
    ctx.response.body = { error: "Partie pleine ou en cours." };
    return;
  }

  const ws = ctx.upgrade();
  const playerId = createPlayerId();
  let rejected = false;

  ws.onclose = () => {
    if (rejected) return;
    lobby.players.delete(playerId);
    lobby.sockets.delete(playerId);
    sendUpdatelobby(lobby);
    closeGame(lobby).then(() => {
      // Suppression automatique du lobby s'il n'a plus aucun joueur
      lobbyManager.deleteLobbyIfEmpty(lobby.id);
    });
  };

  const spawnPoint = getRandomSpawnPoint(2600, 2000, 750, 600);

  lobby.sockets.set(playerId, ws);
  lobby.players.set(playerId, {
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

  if (!isAdmin) sendUpdatelobby(lobby);

  ws.onopen = () => {
    try {
      // Un non-admin ne peut pas rejoindre si partie en cours
      if (!isAdmin && (lobby.gameState === "playing" || nonAdminCount > 20)) {
        rejected = true;
        ws.send(JSON.stringify({ type: "rejected" }));
        lobby.players.delete(playerId);
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
      ws.send(JSON.stringify({ type: getCurrentDayTime(lobby) }));

      // Si admin, on lui envoie immédiatement l'état courant de la liste joueurs
      if (isAdmin) {
        ws.send(JSON.stringify({
          type: "adminInit",
          players: Array.from(lobby.players.values()),
        }));
      }
    } catch (err) {
      console.error("Erreur onopen :", err);
    }
  };

  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      const player = lobby.players.get(playerId);

      switch (data.type) {
        case "update":
          updatePlayer(lobby, playerId, data);
          break;
        case "disconnect":
          lobby.players.delete(playerId);
          if (lobby.gameState === "lobby") sendUpdatelobby(lobby);
          break;
        case "killFromAssassin":
          if (player?.dead || player?.isAdmin) break;
          await tryKill(lobby, playerId, data.targetId);
          break;
        case "setReady":
          if (player?.dead || player?.isAdmin) break;
          setReadyPlayer(lobby, playerId);
          sendUpdatelobby(lobby);
          if (checkAllReady(lobby)) {
            lobby.gameState = "playing";
            startGame(lobby);
          }
          break;
        case "skip":
          if (player?.dead || player?.isAdmin) break;
          wantSkipPlayer(lobby, playerId);
          if (checkAllWantSkip(lobby)) {
            forceSwitchDayTime(lobby);
            lobby.nbSkip = 0;
          }
          break;
        case "setAvatar": {
          // Admins ne peuvent pas changer d'avatar
          if (lobby.gameState !== "lobby" || player?.isAdmin) break;
          const avatar = data.avatar;
          if (!AVATARS.includes(avatar)) break;
          const p = lobby.players.get(playerId);
          if (p) p.avatar = avatar;
          const avatarUpdate = JSON.stringify({
            type: "avatarUpdate",
            playerId,
            avatar,
          });
          lobby.sockets.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) client.send(avatarUpdate);
          });
          break;
        }
        case "vote":
          if (player?.dead || player?.isAdmin) break;
          lobby.votes.push(data.vote);
          {
            const aliveCount =
              Array.from(lobby.players.values()).filter((p) =>
                !p.dead && !p.isAdmin
              ).length;
            if (lobby.votes.length === aliveCount + 1) {
              checkVotesComplet(lobby);
              lobby.votes = [""];
              forceSwitchDayTime(lobby);
            }
          }
          break;
        case "parfume": {
          if (player?.dead || player?.isAdmin) break;
          const p = lobby.players.get(data.targetId);
          if (p) p.isParfume = true;
          break;
        }
        case "unParfume":
          removeParfume(lobby);
          break;

        // ── Commandes admin ────────────────────────────────────────────
        case "adminKill":
          if (!player?.isAdmin) break;
          await adminKill(lobby, data.targetId);
          break;
        case "adminKick":
          if (!player?.isAdmin) break;
          adminKick(lobby, data.targetId);
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
          players: Array.from(lobby.players.values()),
        }),
      );
    } else {
      clearInterval(interval);
    }
  }, 1000 / 60);
});
