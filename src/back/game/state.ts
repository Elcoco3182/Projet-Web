// ==================== ÉTAT GLOBAL DU JEU ====================
// Ce fichier est le seul endroit où vivent les variables mutables partagées.
// Tous les autres modules les importent depuis ici.

export const sockets = new Map<string, WebSocket>();
export const players = new Map<string, Player>();

export type Player = {
  id: string;
  x: number;
  y: number;
  d?: string;
  height: number;
  width: number;
  kills: number;
  active: boolean;
  ready: boolean;
  username: string;
  type?: string;
};

export type GameState = "noConnected" | "lobby" | "playing";

// gameState et nbReady sont mutables : on les expose dans un objet
// pour permettre aux autres modules de les modifier par référence.
export const state = {
  gameState: "noConnected" as GameState,
  nbReady: 0,
  currentPartyId: null as number | null,
  isMorning: false,
  isNoon: false,
  isAfternoon: true,
  isNight: false,
  isMidnight: false,
};

// ==================== CONFIG RÔLES ====================

// a = assassin  p = petitefille  i = innocent
export const roleSelonNbJoueur = [
  "",
  "",
  "",
  "api",
  "apii",
  "apiii",
  "aapiii",
  "aappiii",
  "aappiiii",
  "aaapppiii",
  "aaapppiiii",
];

// ==================== DIMENSIONS DE LA CARTE ====================

export const MAP_HEIGHT = 1550;
export const MAP_WIDTH = 4000;
