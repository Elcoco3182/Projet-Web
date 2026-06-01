import {
  phaseDurations,
  players,
  roleSelonNbJoueur,
  sockets,
  state,
  votes,
} from "./state.ts";
import { API_URL, fetchWithRetry } from "../utils/fetch.ts";
import { getRandomSpawnPoint } from "../utils/map.ts";

// ==================== LOBBY ====================

export function miseAjourReady() {
  state.nbReady = 0;
  players.forEach((player) => {
    if (player.ready) state.nbReady += 1;
  });
}

export function miseAjourSkip() {
  state.nbSkip = 0;
  players.forEach((player) => {
    if (player.skip) state.nbSkip += 1;
  });
}

export function checkAllReady(): boolean {
  miseAjourReady();
  return players.size >= 3 && state.nbReady === players.size;
}

export function checkAllWantSkip(): boolean {
  miseAjourSkip();
  return state.nbSkip === players.size;
}

export function setReadyPlayer(playerId: string) {
  const player = players.get(playerId);
  if (player) player.ready = true;
}

export function wantSkipPlayer(playerId: string) {
  const player = players.get(playerId);
  if (player) player.skip = true;
}

export function sendUpdatelobby() {
  miseAjourReady();
  const data = JSON.stringify({
    type: "lobbyUpdate",
    nbReady: state.nbReady,
    total: players.size,
  });
  sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

// ==================== DÉMARRAGE ====================

export function createPlayerId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function updatePlayer(
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

export function activatePlayer(
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

async function fetchPartiApi() {
  try {
    const partieRes = await fetchWithRetry(`${API_URL}/parties`, {
      method: "POST",
    });
    const partie = await partieRes.json();
    state.currentPartyId = partie.id;
    console.log(`Partie créée : id=${state.currentPartyId}`);
  } catch (err) {
    console.error("Impossible de créer la partie :", err);
  }
}

export async function startGame() {
  state.finDePartie = false;
  await fetchPartiApi();
  await giveRoleAll();
  switchDayTime();
}

async function giveRoleAll() {
  const tabInt = Array.from({ length: 21 }, (_, i) => i);
  const tabPlayer: string[] = [];
  let i = 0;

  players.forEach((player) => {
    tabPlayer[i] = player.id;
    i += 1;
    const r1 = Math.floor(Math.random() * players.size);
    const r2 = Math.floor(Math.random() * players.size);
    [tabInt[r1], tabInt[r2]] = [tabInt[r2], tabInt[r1]];
  });

  i = 0;
  const rolePossible = roleSelonNbJoueur[players.size];

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
        party_id: state.currentPartyId,
        role_id,
      }),
    });

    const spawn = getRandomSpawnPoint(2600, 2000, 750, 600);
    activatePlayer(playerId, role, spawn);
    const playerSocket = sockets.get(playerId);
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

// ==================== CYCLE JOUR/NUIT ====================

function broadcast(type: string, extra?: Record<string, unknown>) {
  const data = JSON.stringify({ type, ...extra });
  sockets.forEach((client) => {
    if (client.readyState === 1) client.send(data);
  });
}

export function switchDayTime() {
  clearTimeout(state.dayTimeTimeoutId);
  if (state.gameState !== "playing") return;

  let duree = 4000;

  if (state.isMorning) {
    state.isMorning = false;
    state.isNoon = true;
    broadcast("isNoon", { players: Array.from(players.values()) });
    duree = phaseDurations.isNoon;
    tpAllJoueurNoon();
  } else if (state.isNoon) {
    state.isNoon = false;
    state.isAfternoon = true;
    broadcast("isAfternoon");
    duree = phaseDurations.isAfternoon;
  } else if (state.isAfternoon) {
    state.isAfternoon = false;
    state.isNight = true;
    broadcast("isNight");
    duree = phaseDurations.isNight;
    tpAllJoueurNight();
  } else if (state.isNight) {
    state.isNight = false;
    state.isMidnight = true;
    broadcast("isMidnight");
    duree = phaseDurations.isMidnight;
  } else if (state.isMidnight) {
    state.isMidnight = false;
    state.isDawn = true;
    broadcast("isDawn");
    duree = phaseDurations.isDawn;
  } else if (state.isDawn) {
    state.isDawn = false;
    state.isMorning = true;
    broadcast("isMorning");
    duree = phaseDurations.isMorning;
    tpAllJoueurMorning();
  }

  state.dayTimeTimeoutId = setTimeout(() => switchDayTime(), duree);
}

export function forceSwitchDayTime() {
  if (state.dayTimeTimeoutId !== 0) {
    clearTimeout(state.dayTimeTimeoutId);
    state.dayTimeTimeoutId = 0;
  }
  switchDayTime();
}

// ==================== TÉLÉPORTATIONS ====================

function tpAllJoueurNoon() {
  const placeTable = [
    [1375, 275],
    [1600, 275],
    [1500, 375],
    [1500, 150],
    [1375, 200],
    [1600, 200],
    [1425, 375],
    [1425, 150],
    [1375, 250],
    [1600, 250],
    [1475, 150],
    [1475, 375],
    [1375, 300],
    [1600, 300],
    [1525, 375],
    [1525, 150],
    [1375, 225],
    [1600, 225],
    [1450, 150],
    [1450, 375],
    [1375, 325],
    [1600, 325],
    [1550, 375],
    [1550, 150],
  ];
  let i = 0;
  players.forEach((player, playerId) => {
    const spawn = placeTable[i++];
    player.x = spawn[0];
    player.y = spawn[1];
    sockets.get(playerId)?.send(
      JSON.stringify({ type: "noonSpawn", x: spawn[0], y: spawn[1] }),
    );
  });
}

function tpAllJoueurMorning() {
  players.forEach((player, playerId) => {
    const spawn = getRandomSpawnPoint(2600, 2000, 750, 600);
    player.x = spawn.x;
    player.y = spawn.y;
    sockets.get(playerId)?.send(
      JSON.stringify({ type: "morningSpawn", x: spawn.x, y: spawn.y }),
    );
  });
}

function tpAllJoueurNight() {
  players.forEach((player, playerId) => {
    const spawn = getRandomSpawnPoint(2600, 2000, 750, 600);
    player.x = spawn.x;
    player.y = spawn.y;
    sockets.get(playerId)?.send(
      JSON.stringify({ type: "nightSpawn", x: spawn.x, y: spawn.y }),
    );
  });
}

// ==================== COMBAT ====================

export function sendKilled(playerId: string) {
  const data = JSON.stringify({ type: "killed", playerId });
  sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

export async function tryKill(attackerId: string, targetId: string) {
  const attacker = players.get(attackerId);
  const target = players.get(targetId);
  if (!attacker || !target) return;
  if (!attacker.active || !target.active) return;
  if (target.type === "assassin") return;

  const dx = attacker.x - target.x;
  const dy = attacker.y - target.y;
  if (Math.sqrt(dx * dx + dy * dy) > 80) return;

  sendKilled(targetId);
  players.delete(targetId);

  const result = isEndGame();
  if (result !== "continue") {
    broadcastGameEnd(result);
    await closeGame();
  }
}

// ==================== VOTES ====================

export function checkVotesComplet() {
  let elimine = "";
  let nbVotesMax = 0;
  let draw = false;
  let execo: [string] = [""];

  players.forEach((player) => {
    let nbVotes = 0;
    votes.forEach((vote) => {
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
    sendVote(true, execo);
    return;
  }

  sendVote(false, execo, elimine);
  players.delete(elimine);

  const result = isEndGame();
  if (result !== "continue") {
    broadcastGameEnd(result);
    closeGame();
  }
}

function sendVote(draw: boolean, tabExeco?: [string], player?: string) {
  const data = draw
    ? JSON.stringify({ type: "vote", tabExeco, draw })
    : JSON.stringify({ type: "vote", player, draw });
  sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

// ==================== FIN DE PARTIE ====================

export function isEndGame(): string {
  if (state.finDePartie) {
    return "continue";
  }
  let nbInnocent = 0, nbPsyco = 0;
  players.forEach((player) => {
    if (player.type === "innocent" || player.type === "petitefille") {
      nbInnocent += 1;
    } else if (player.type === "assassin") nbPsyco += 1;
  });
  if (nbPsyco <= 0) {
    state.finDePartie = true;
    return "vicInno";
  }
  if (nbPsyco > 0 && nbInnocent <= 1) {
    state.finDePartie = true;
    return "vicPsyco";
  }
  return "continue";
}

export function broadcastGameEnd(result: string) {
  const data = JSON.stringify({ type: "gameEnd", result });
  sockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
  setTimeout(() => resetToLobby(), 5000);
}

export async function closeGame() {
  if (state.gameState === "playing") {
    const result = isEndGame();
    if (result !== "continue") broadcastGameEnd(result);
  }
  if (
    players.size === 0 && state.gameState === "playing" && state.currentPartyId
  ) {
    try {
      await fetchWithRetry(`${API_URL}/parties/${state.currentPartyId}/end`, {
        method: "PATCH",
      });
      console.log(`Partie ${state.currentPartyId} terminée`);
    } catch (err) {
      console.error("Erreur fermeture partie :", err);
    }
  }
  if (players.size === 0) {
    state.gameState = "noConnected";
    state.currentPartyId = null;
  }
}

export function resetToLobby() {
  state.gameState = "lobby";
  state.nbReady = 0;
  state.currentPartyId = null;
  state.finDePartie = false;

  players.forEach((player) => {
    player.ready = false;
    player.active = false;
    player.type = undefined;
    player.skip = false;
    const spawn = getRandomSpawnPoint(2600, 2000, 750, 600);
    player.x = spawn.x;
    player.y = spawn.y;
  });

  state.isMorning = false;
  state.isNoon = false;
  state.isAfternoon = true;
  state.isNight = false;
  state.isMidnight = false;
  state.isDawn = false;

  sendUpdatelobby();
}
