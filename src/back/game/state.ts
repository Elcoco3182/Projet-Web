// ==================== CONSTANTES ET TYPES PARTAGÉS ====================
// Depuis le passage multi-lobby, cet état n'est plus un singleton global :
// chaque partie vit dans un objet Lobby (voir lobby.ts). Ce fichier ne
// contient plus que ce qui est vraiment partagé entre tous les lobbies.

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
  dead: boolean; // true = fantôme spectateur
  isAdmin: boolean; // true = compte admin, toujours hors jeu
};

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
  isAfternoon: 30_000,
  isNight: 15_000,
  isMidnight: 40_000,
  isDawn: 30_000,
};

// ==================== DIMENSIONS DE LA CARTE ====================

export const MAP_HEIGHT = 1550;
export const MAP_WIDTH = 4000;
