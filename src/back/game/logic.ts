import { players, roleSelonNbJoueur, sockets, state } from "./state.ts";
import { API_URL, fetchWithRetry } from "../utils/fetch.ts";
import { getRandomSpawnPoint } from "../utils/map.ts";

// ==================== LOBBY ====================

export function miseAjourReady() {
  state.nbReady = 0;
  players.forEach((player) => {
    if (player.ready) state.nbReady += 1;
  });
}

export function checkAllReady(): boolean {
  miseAjourReady();
  return players.size >= 3 && state.nbReady === players.size;
}

export function setReadyPlayer(playerId: string) {
  const player = players.get(playerId);
  if (player) player.ready = true;
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

// ==================== DÉMARRAGE PARTIE ====================

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
  await fetchPartiApi();
  await giveRoleAll();
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
    }
    i++;

    console.log("Envoi historique:", {
      user_id: 1,
      party_id: state.currentPartyId,
      role_id,
    });

    await fetchWithRetry(`${API_URL}/historiques`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1, // ← à remplacer quand tu auras un système de login
        party_id: state.currentPartyId,
        role_id,
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

// ==================== FIN DE PARTIE ====================

export function isEndGame(): string {
  let nbInnocent = 0;
  let nbPsyco = 0;
  players.forEach((player) => {
    if (player.type === "innocent" || player.type === "petitefille") {
      nbInnocent += 1;
    } else if (player.type === "assassin") nbPsyco += 1;
  });
  if (nbPsyco <= 0) return "vicInno";
  if (nbPsyco >= nbInnocent) return "vicPsyco";
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

  players.forEach((player) => {
    player.ready = false;
    player.active = false;
    player.type = undefined;
    const spawn = getRandomSpawnPoint(2250, 2000, 1300, 1000);
    player.x = spawn.x;
    player.y = spawn.y;
  });

  state.isMorning = false;
  state.isNoon = false;
  state.isAfternoon = true;
  state.isNight = false;
  state.isMidnight = false;

  sendUpdatelobby();
}
