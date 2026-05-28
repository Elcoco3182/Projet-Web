// ==================== ÉTAT GLOBAL CLIENT ====================
// Toutes les variables mutables partagées entre les modules.

export const WORLD_VIEW_WIDTH  = 800;
export const WORLD_VIEW_HEIGHT = 600;

// Données reçues du serveur
export let players   = [];
export let obstacles = [];
export let mapWidth  = 0;
export let mapHeight = 0;

export function setPlayers(p)   { players   = p; }
export function setObstacles(o) { obstacles = o; }
export function setMapSize(w, h){ mapWidth  = w; mapHeight = h; }

// Joueur local
export let localJoueur    = null;
export let pendingUsername = null;
export let rejected        = false;

export function setLocalJoueur(j)      { localJoueur     = j; }
export function setPendingUsername(u)  { pendingUsername  = u; }
export function setRejected(v)         { rejected         = v; }

// Cycle jour/nuit
export let isMorning  = false;
export let isNoon     = false;
export let isAfternoon = false;
export let isNight    = false;
export let isMidnight = false;

export function setDayTime(type) {
    isMorning  = false;
    isNoon     = false;
    isAfternoon = false;
    isNight    = false;
    isMidnight = false;
    if (type === "isMorning")   isMorning   = true;
    if (type === "isNoon")      isNoon      = true;
    if (type === "isAfternoon") isAfternoon = true;
    if (type === "isNight")     isNight     = true;
    if (type === "isMidnight")  isMidnight  = true;
}

// Rendu
export let cameraZoom = 1;
export function setCameraZoom(z) { cameraZoom = z; }

export let lastTime     = 0;
export let animationTime = 1;
export let sy            = 0;

export function setLastTime(t)      { lastTime      = t; }
export function setAnimationTime(t) { animationTime = t; }
export function setSy(v)            { sy             = v; }