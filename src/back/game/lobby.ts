// ==================== MODÈLE LOBBY ====================
// Chaque lobby encapsule sa propre partie indépendante : joueurs, sockets,
// état de jeu, votes, cycle jour/nuit. Avant ce fichier, tout ceci vivait
// dans des variables globales (un seul lobby possible à la fois).

import type { Player } from "./state.ts";

export type GameState = "lobby" | "playing";

export interface Lobby {
  readonly id: string;
  name: string;
  passwordHash: string | null;

  players: Map<string, Player>;
  sockets: Map<string, WebSocket>;

  gameState: GameState;
  nbReady: number;
  nbSkip: number;
  currentPartyId: number | null;
  votes: string[];
  /** false pendant qu'une phase de vote (isNoon) est en cours et pas encore
   * résolue — évite de compter les votes deux fois (une fois si tout le
   * monde a voté avant le chrono, une fois si le chrono arrive à zéro). */
  votesResolved: boolean;

  isMorning: boolean;
  isNoon: boolean;
  isAfternoon: boolean;
  isNight: boolean;
  isMidnight: boolean;
  isDawn: boolean;
  dayTimeTimeoutId: number;
  finDePartie: boolean;

  readonly createdAt: number;
}

/** Résumé public d'un lobby, sans jamais exposer le hash du mot de passe. */
export interface LobbySummary {
  id: string;
  name: string;
  playerCount: number;
  gameState: GameState;
  isPrivate: boolean;
}

// Alphabet sans caractères ambigus (pas de 0/O ni 1/I) : plus simple à
// partager et retaper à la main pour rejoindre un lobby privé.
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ID_LENGTH = 6;

function generateId(): string {
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return id;
}

class LobbyManager {
  private lobbies = new Map<string, Lobby>();

  createLobby(name: string, passwordHash: string | null): Lobby {
    let id = generateId();
    while (this.lobbies.has(id)) id = generateId();

    const lobby: Lobby = {
      id,
      name: name.trim() ? name.trim() : `Partie ${id}`,
      passwordHash,
      players: new Map(),
      sockets: new Map(),
      gameState: "lobby",
      nbReady: 0,
      nbSkip: 0,
      currentPartyId: null,
      votes: [""],
      votesResolved: true,
      isMorning: false,
      isNoon: false,
      isAfternoon: true,
      isNight: false,
      isMidnight: false,
      isDawn: false,
      dayTimeTimeoutId: 0,
      finDePartie: false,
      createdAt: Date.now(),
    };

    this.lobbies.set(id, lobby);
    console.log(`Lobby ${id} ("${name}") créé.`);
    return lobby;
  }

  getLobby(id: string): Lobby | undefined {
    return this.lobbies.get(id.toUpperCase());
  }

  /** Liste des lobbies publics (pas de mot de passe), filtrable par nom/id. */
  listPublicLobbies(search = ""): LobbySummary[] {
    const term = search.trim().toLowerCase();
    return Array.from(this.lobbies.values())
      .filter((l) => !l.passwordHash)
      .filter((l) =>
        !term ||
        l.name.toLowerCase().includes(term) ||
        l.id.toLowerCase().includes(term)
      )
      .map(toSummary);
  }

  /** Permet de vérifier qu'un lobby existe (y compris privé) avant de tenter un join. */
  findSummary(id: string): LobbySummary | null {
    const lobby = this.getLobby(id);
    return lobby ? toSummary(lobby) : null;
  }

  /** Supprime le lobby s'il n'a plus aucun joueur connecté. */
  deleteLobbyIfEmpty(id: string): void {
    const lobby = this.lobbies.get(id);
    if (!lobby) return;
    if (lobby.players.size === 0) {
      if (lobby.dayTimeTimeoutId) clearTimeout(lobby.dayTimeTimeoutId);
      this.lobbies.delete(id);
      console.log(`Lobby ${id} supprimé (0 joueur restant).`);
    }
  }
}

function toSummary(lobby: Lobby): LobbySummary {
  return {
    id: lobby.id,
    name: lobby.name,
    playerCount: lobby.players.size,
    gameState: lobby.gameState,
    isPrivate: !!lobby.passwordHash,
  };
}

export const lobbyManager = new LobbyManager();
