import { phaseDurations, roleSelonNbJoueur } from "./state.ts";
import type { Player } from "./state.ts";
import type { Lobby } from "./lobby.ts";
import { API_URL, fetchWithRetry } from "../utils/fetch.ts";
import { getRandomSpawnPoint } from "../utils/map.ts";

// ==================== HELPERS ====================

/** Joueurs vivants ET non-admin (participent au jeu) d'un lobby donné. */
function alivePlayers(lobby: Lobby): Player[] {
  const alive: Player[] = [];
  lobby.players.forEach((p) => {
    if (!p.dead && !p.isAdmin) alive.push(p);
  });
  return alive;
}

// ==================== LOBBY (salle d'attente) ====================

export function miseAjourReady(lobby: Lobby) {
  lobby.nbReady = 0;
  lobby.players.forEach((player) => {
    if (!player.dead && !player.isAdmin && player.ready) lobby.nbReady += 1;
  });
}

export function miseAjourSkip(lobby: Lobby) {
  lobby.nbSkip = 0;
  lobby.players.forEach((player) => {
    if (!player.dead && !player.isAdmin && player.skip) lobby.nbSkip += 1;
  });
}

export function checkAllReady(lobby: Lobby): boolean {
  miseAjourReady(lobby);
  const aliveCount = alivePlayers(lobby).length;
  return aliveCount >= 3 && lobby.nbReady === aliveCount;
}

export function checkAllWantSkip(lobby: Lobby): boolean {
  miseAjourSkip(lobby);
  const aliveCount = alivePlayers(lobby).length;
  return aliveCount > 0 && lobby.nbSkip === aliveCount;
}

export function setReadyPlayer(lobby: Lobby, playerId: string) {
  const player = lobby.players.get(playerId);
  if (player) player.ready = true;
}

export function wantSkipPlayer(lobby: Lobby, playerId: string) {
  const player = lobby.players.get(playerId);
  if (player && !player.dead && !player.isAdmin) player.skip = true;
}

export function sendUpdatelobby(lobby: Lobby) {
  miseAjourReady(lobby);
  const aliveCount = alivePlayers(lobby).length;
  const data = JSON.stringify({
    type: "lobbyUpdate",
    nbReady: lobby.nbReady,
    total: aliveCount,
  });
  lobby.sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

// ==================== DÉMARRAGE ====================

/** Identifiant unique de connexion, indépendant de l'id du lobby. */
export function createPlayerId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function updatePlayer(
    lobby: Lobby,
    playerId: string,
    data: { x: number; y: number; d: string },
) {
  const player = lobby.players.get(playerId);
  if (player) {
    player.x = data.x;
    player.y = data.y;
    player.d = data.d;
  }
}

export function activatePlayer(
    lobby: Lobby,
    playerId: string,
    role: string,
    spawn?: { x: number; y: number },
) {
  const player = lobby.players.get(playerId);
  if (player) {
    player.active = true;
    player.type = role;
    if (spawn) {
      player.x = spawn.x;
      player.y = spawn.y;
    }
  }
}

async function fetchPartiApi(lobby: Lobby) {
  try {
    const partieRes = await fetchWithRetry(`${API_URL}/parties`, {
      method: "POST",
    });
    const partie = await partieRes.json();
    lobby.currentPartyId = partie.id;
    console.log(`[lobby ${lobby.id}] Partie créée : id=${lobby.currentPartyId}`);
  } catch (err) {
    console.error(`[lobby ${lobby.id}] Impossible de créer la partie :`, err);
  }
}

export async function startGame(lobby: Lobby) {
  lobby.finDePartie = false;
  await fetchPartiApi(lobby);
  await giveRoleAll(lobby);
  switchDayTime(lobby);
}

async function giveRoleAll(lobby: Lobby) {
  const tabInt = Array.from({ length: 21 }, (_, i) => i);
  const tabPlayer: string[] = [];
  let i = 0;

  // N'attribuer des rôles qu'aux joueurs vivants non-admin
  alivePlayers(lobby).forEach((player) => {
    tabPlayer[i] = player.id;
    i += 1;
    const r1 = Math.floor(Math.random() * alivePlayers(lobby).length);
    const r2 = Math.floor(Math.random() * alivePlayers(lobby).length);
    [tabInt[r1], tabInt[r2]] = [tabInt[r2], tabInt[r1]];
  });

  i = 0;
  const rolePossible = roleSelonNbJoueur[alivePlayers(lobby).length];

  for (const playerId of tabPlayer) {
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
      case "P":
        role = "parfumeuse";
        role_id = 6;
        break;
    }
    i++;

    await fetchWithRetry(`${API_URL}/historiques`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        party_id: lobby.currentPartyId,
        role_id,
      }),
    });

    const spawn = getRandomSpawnPoint(2600, 2000, 750, 600);
    activatePlayer(lobby, playerId, role, spawn);
    const playerSocket = lobby.sockets.get(playerId);
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
    console.log(`[lobby ${lobby.id}] Joueur ${playerId} enregistré avec le rôle ${role}`);
  }

  // Notifier les admins que la partie a commencé (sans rôle)
  lobby.players.forEach((player, playerId) => {
    if (!player.isAdmin) return;
    const sock = lobby.sockets.get(playerId);
    if (sock?.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({ type: "adminGameStart" }));
    }
  });
}

// ==================== CYCLE JOUR/NUIT ====================

function broadcast(lobby: Lobby, type: string, extra?: Record<string, unknown>) {
  const data = JSON.stringify({ type, ...extra });
  lobby.sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

export function switchDayTime(lobby: Lobby) {
  clearTimeout(lobby.dayTimeTimeoutId);
  if (lobby.gameState !== "playing") return;

  let duree = 4000;

  if (lobby.isMorning) {
    lobby.isMorning = false;
    lobby.isNoon = true;
    broadcast(lobby, "isNoon", { players: Array.from(lobby.players.values()) });
    duree = phaseDurations.isNoon;
    tpAllJoueurNoon(lobby);
  } else if (lobby.isNoon) {
    lobby.isNoon = false;
    lobby.isAfternoon = true;
    broadcast(lobby, "isAfternoon");
    duree = phaseDurations.isAfternoon;
  } else if (lobby.isAfternoon) {
    lobby.isAfternoon = false;
    lobby.isNight = true;
    broadcast(lobby, "isNight");
    duree = phaseDurations.isNight;
    tpAllJoueurNight(lobby);
  } else if (lobby.isNight) {
    lobby.isNight = false;
    lobby.isMidnight = true;
    broadcast(lobby, "isMidnight");
    duree = phaseDurations.isMidnight;
  } else if (lobby.isMidnight) {
    lobby.isMidnight = false;
    lobby.isDawn = true;
    broadcast(lobby, "isDawn");
    duree = phaseDurations.isDawn;
  } else if (lobby.isDawn) {
    lobby.isDawn = false;
    lobby.isMorning = true;
    broadcast(lobby, "isMorning");
    duree = phaseDurations.isMorning;
    tpAllJoueurMorning(lobby);
  }

  lobby.dayTimeTimeoutId = setTimeout(() => switchDayTime(lobby), duree);
}

export function forceSwitchDayTime(lobby: Lobby) {
  if (lobby.dayTimeTimeoutId !== 0) {
    clearTimeout(lobby.dayTimeTimeoutId);
    lobby.dayTimeTimeoutId = 0;
  }
  switchDayTime(lobby);
}

// ==================== TÉLÉPORTATIONS ====================

function tpAllJoueurNoon(lobby: Lobby) {
  const placeTable = [
    [1375, 275], [1600, 275], [1500, 375], [1500, 150],
    [1375, 200], [1600, 200], [1425, 375], [1425, 150],
    [1375, 250], [1600, 250], [1475, 150], [1475, 375],
    [1375, 300], [1600, 300], [1525, 375], [1525, 150],
    [1375, 225], [1600, 225], [1450, 150], [1450, 375],
    [1375, 325], [1600, 325], [1550, 375], [1550, 150],
  ];
  let i = 0;
  lobby.players.forEach((player, playerId) => {
    if (player.dead || player.isAdmin) return; // admins non téléportés
    const spawn = placeTable[i++];
    player.x = spawn[0];
    player.y = spawn[1];
    lobby.sockets.get(playerId)?.send(
        JSON.stringify({ type: "noonSpawn", x: spawn[0], y: spawn[1] }),
    );
  });
}

function tpAllJoueurMorning(lobby: Lobby) {
  lobby.players.forEach((player, playerId) => {
    if (player.dead || player.isAdmin) return;
    const spawn = getRandomSpawnPoint(2600, 2000, 750, 600);
    player.x = spawn.x;
    player.y = spawn.y;
    lobby.sockets.get(playerId)?.send(
        JSON.stringify({ type: "morningSpawn", x: spawn.x, y: spawn.y }),
    );
  });
}

function tpAllJoueurNight(lobby: Lobby) {
  lobby.players.forEach((player, playerId) => {
    if (player.dead || player.isAdmin) return;
    const spawn = getRandomSpawnPoint(2600, 2000, 750, 600);
    player.x = spawn.x;
    player.y = spawn.y;
    lobby.sockets.get(playerId)?.send(
        JSON.stringify({ type: "nightSpawn", x: spawn.x, y: spawn.y }),
    );
  });
}

// ==================== COMBAT ====================

export function sendKilled(lobby: Lobby, playerId: string) {
  const data = JSON.stringify({ type: "killed", playerId });
  lobby.sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

export async function tryKill(lobby: Lobby, attackerId: string, targetId: string) {
  const attacker = lobby.players.get(attackerId);
  const target = lobby.players.get(targetId);
  if (!attacker || !target) return;
  if (!attacker.active || !target.active) return;
  if (attacker.dead || target.dead) return;
  if (target.type === "assassin") return;

  const dx = attacker.x - target.x;
  const dy = attacker.y - target.y;
  if (Math.sqrt(dx * dx + dy * dy) > 60) return;

  target.dead = true;
  sendKilled(lobby, targetId);

  forceSwitchDayTime(lobby);

  const result = isEndGame(lobby);
  if (result !== "continue") {
    broadcastGameEnd(lobby, result);
    await closeGame(lobby);
  }
}

// ==================== ADMIN : KILL / KICK ====================

/** Un admin tue un joueur vivant (ignoré si admin ou déjà mort). */
export async function adminKill(lobby: Lobby, targetId: string) {
  const target = lobby.players.get(targetId);
  if (!target || target.dead || target.isAdmin) return;

  target.dead = true;
  sendKilled(lobby, targetId);

  if (lobby.gameState === "playing") {
    forceSwitchDayTime(lobby);
    const result = isEndGame(lobby);
    if (result !== "continue") {
      broadcastGameEnd(lobby, result);
      await closeGame(lobby);
    }
  }
}

/** Un admin kick un joueur (vivant ou mort, mais pas un autre admin). */
export function adminKick(lobby: Lobby, targetId: string) {
  const target = lobby.players.get(targetId);
  if (!target || target.isAdmin) return;

  const sock = lobby.sockets.get(targetId);
  if (sock) {
    sock.send(JSON.stringify({ type: "kicked" }));
    sock.close(1008, "Kicked by admin");
  }
  lobby.players.delete(targetId);
  lobby.sockets.delete(targetId);
  sendUpdatelobby(lobby);
}

export function removeParfume(lobby: Lobby) {
  lobby.players.forEach((player) => {
    player.isParfume = false;
  });
}

// ==================== VOTES ====================

export function checkVotesComplet(lobby: Lobby) {
  let elimine = "";
  let nbVotesMax = 0;
  let draw = false;
  let execo: string[] = [""];

  alivePlayers(lobby).forEach((player) => {
    let nbVotes = 0;
    lobby.votes.forEach((vote) => {
      if (vote === player.id) nbVotes += 1;
    });
    if (nbVotes > nbVotesMax) {
      nbVotesMax = nbVotes;
      elimine = player.id;
      draw = false;
      execo = [""];
      execo.push(player.id);
    } else if (nbVotes === nbVotesMax && nbVotes > 0) {
      draw = true;
      execo.push(player.id);
    }
  });

  if (draw) {
    sendVote(lobby, true, execo);
    return;
  }

  sendVote(lobby, false, execo, elimine);

  const target = lobby.players.get(elimine);
  if (target) target.dead = true;

  const result = isEndGame(lobby);
  if (result !== "continue") {
    broadcastGameEnd(lobby, result);
    closeGame(lobby);
  }
}

function sendVote(lobby: Lobby, draw: boolean, tabExeco?: string[], player?: string) {
  const data = draw
      ? JSON.stringify({ type: "vote", tabExeco, draw })
      : JSON.stringify({ type: "vote", player, draw });
  lobby.sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

// ==================== FIN DE PARTIE ====================

export function isEndGame(lobby: Lobby): string {
  if (lobby.finDePartie) return "continue";
  let nbInnocent = 0, nbPsyco = 0;
  alivePlayers(lobby).forEach((player) => {
    if (player.type === "innocent" || player.type === "petitefille") {
      nbInnocent += 1;
    } else if (player.type === "assassin") nbPsyco += 1;
  });
  if (nbPsyco <= 0) {
    lobby.finDePartie = true;
    return "vicInno";
  }
  if (nbPsyco > 0 && nbInnocent <= 1) {
    lobby.finDePartie = true;
    return "vicPsyco";
  }
  return "continue";
}

export function broadcastGameEnd(lobby: Lobby, result: string) {
  const data = JSON.stringify({ type: "gameEnd", result });
  lobby.sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
  setTimeout(() => resetToLobby(lobby), 5000);
}

export async function closeGame(lobby: Lobby) {
  if (lobby.gameState === "playing") {
    const result = isEndGame(lobby);
    if (result !== "continue") broadcastGameEnd(lobby, result);
  }
  if (
      lobby.players.size === 0 && lobby.gameState === "playing" &&
      lobby.currentPartyId
  ) {
    try {
      await fetchWithRetry(`${API_URL}/parties/${lobby.currentPartyId}/end`, {
        method: "PATCH",
      });
      console.log(`[lobby ${lobby.id}] Partie ${lobby.currentPartyId} terminée`);
    } catch (err) {
      console.error(`[lobby ${lobby.id}] Erreur fermeture partie :`, err);
    }
  }
  if (lobby.players.size === 0) {
    lobby.currentPartyId = null;
  }
}

export function resetToLobby(lobby: Lobby) {
  lobby.gameState = "lobby";
  lobby.nbReady = 0;
  lobby.currentPartyId = null;
  lobby.finDePartie = false;

  lobby.players.forEach((player) => {
    player.ready = false;
    player.active = false;
    player.type = undefined;
    player.skip = false;
    player.dead = false;
    if (!player.isAdmin) {
      const spawn = getRandomSpawnPoint(2600, 2000, 750, 600);
      player.x = spawn.x;
      player.y = spawn.y;
    }
  });

  lobby.isMorning = false;
  lobby.isNoon = false;
  lobby.isAfternoon = true;
  lobby.isNight = false;
  lobby.isMidnight = false;
  lobby.isDawn = false;

  sendUpdatelobby(lobby);

  // Le client (même lobby, même socket) doit reprendre l'écran d'attente
  // sans recharger la page ni retourner à la sélection de lobby.
  broadcast(lobby, "returnToLobby");
}