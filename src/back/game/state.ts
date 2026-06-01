// ==================== ÉTAT GLOBAL DU JEU ====================

export const sockets = new Map<string, WebSocket>();
export const players = new Map<string, Player>();

export const AVATARS = [
  "innocent",
  "policeman",
  "parasolLady",
  "baby",
  "vieu",
  "giovanni",
  "clown",
] as const;
export type AvatarId = typeof AVATARS[number];

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
  avatar: AvatarId;
  isParfume: boolean;
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
export function resetVotes() {
  votes = [""];
}
export function pushVote(v: string) {
  votes.push(v);
}

// ==================== CONFIG RÔLES ====================

export const roleSelonNbJoueur = [
  "",
  "",
  "",
  "api",
  "apii",
  "apiii",
  "apPiii",
  "apPiiii",
  "aapPiiii",
  "aapPiiiii",
  "aapPiiiiii",
  "aaappPiiiii",
  "aaappPiiiiii",
  "aaappPPiiiiii",
  "aaaapppPPiiiii",
  "aaaapppPPiiiiii",
  "aaaapppPPiiiiiii",
  "aaaaapppPPiiiiiii",
  "aaaaapppPPiiiiiiii",
  "aaaaapppPPiiiiiiiii",
  "aaaaaappppPPPiiiiiii",
];

// ==================== DURÉES DES PHASES ====================

export const phaseDurations = {
  isMorning: 20_000,
  isNoon: 120_000,
  isAfternoon: 60_000,
  isNight: 15_000,
  isMidnight: 40_000,
  isDawn: 30_000,
};

/*
export const phaseDurations = {
  isMorning: 8_000,
  isNoon: 120_000,
  isAfternoon: 10_000,
  isNight: 10_000,
  isMidnight: 45_000,
  isDawn: 5_000,
};
*/

// ==================== DIMENSIONS DE LA CARTE ====================

export const MAP_HEIGHT = 1550;
export const MAP_WIDTH = 4000;
