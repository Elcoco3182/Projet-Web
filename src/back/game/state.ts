// ==================== ÉTAT GLOBAL DU JEU ====================

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
  skip?: boolean;
  username: string;
  type?: string;
};

export type GameState = "noConnected" | "lobby" | "playing";

export const state = {
  gameState: "noConnected" as GameState,
  nbReady: 0,
  nbSkip: 0,
  currentPartyId: null as number | null,
  isMorning: false,
  isNoon: false,
  isAfternoon: true,
  isNight: false,
  isMidnight: false,
  isDawn: false,
  dayTimeTimeoutId: 0 as number,
  finDePartie: false,
};

export let votes: [string] = [""];
export function resetVotes() { votes = [""]; }
export function pushVote(v: string) { votes.push(v); }

// ==================== CONFIG RÔLES ====================

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

// ==================== DURÉES DES PHASES ====================

/*
export const phaseDurations = {
    isMorning: 35_000,
    isNoon: 120_000,
    isAfternoon: 60_000,
    isNight: 10_000,
    isMidnight: 45_000,
    isDawn : 45_000,
}
*/


export const phaseDurations = {
  isMorning:   8_000,
  isNoon:    120_000,
  isAfternoon: 10_000,
  isNight:     10_000,
  isMidnight:  45_000,
  isDawn:       5_000,
};

// ==================== DIMENSIONS DE LA CARTE ====================

export const MAP_HEIGHT = 1550;
export const MAP_WIDTH  = 4000;