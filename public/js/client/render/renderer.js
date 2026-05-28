import {
    WORLD_VIEW_WIDTH, WORLD_VIEW_HEIGHT,
    players, obstacles, localJoueur,
    mapWidth, mapHeight,
    cameraZoom, setCameraZoom,
    animationTime, setAnimationTime,
    sy, setSy,
    isMidnight, isNight, isAfternoon,
} from "../core/state.js";
import { images } from "./assets.js";
import { keys } from "../ui/input.js";

export const canvas      = document.getElementById("gameCanvas");
export const ctx         = canvas.getContext("2d");
export const canvasNight = document.createElement("canvas");
export const ctxNight    = canvasNight.getContext("2d");

export let viewportWidth  = 0;
export let viewportHeight = 0;

export function initCanvas() {
    canvas.width  = window.innerWidth  - 30;
    canvas.height = window.innerHeight - 30;
    canvasNight.width  = canvas.width;
    canvasNight.height = canvas.height;
    viewportWidth  = canvas.width;
    viewportHeight = canvas.height;
    updateZoom();
}

export function updateZoom() {
    const zoomX = viewportWidth  / WORLD_VIEW_WIDTH;
    const zoomY = viewportHeight / WORLD_VIEW_HEIGHT;
    setCameraZoom(Math.min(zoomX, zoomY));
}

// ── Boucle de rendu principale ────────────────────────────────────────────────

export function draw(getCurrentDayTime) {
    document.getElementById("dayTime").innerText = getCurrentDayTime();

    const renderOffsetX = (viewportWidth  - WORLD_VIEW_WIDTH  * cameraZoom) / 2;
    const renderOffsetY = (viewportHeight - WORLD_VIEW_HEIGHT * cameraZoom) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    ctx.fillStyle = "gray";
    ctx.fillRect(renderOffsetX, renderOffsetY, WORLD_VIEW_WIDTH * cameraZoom, WORLD_VIEW_HEIGHT * cameraZoom);

    const currentPlayer = players.find((p) => p.id === localJoueur.id);
    if (!currentPlayer) return;

    const offsetX = Math.min(Math.max(currentPlayer.x - WORLD_VIEW_WIDTH  / 2, 0), Math.max(mapWidth  - WORLD_VIEW_WIDTH,  0));
    const offsetY = Math.min(Math.max(currentPlayer.y - WORLD_VIEW_HEIGHT / 2, 0), Math.max(mapHeight - WORLD_VIEW_HEIGHT, 0));
    const screenX = (currentPlayer.x - offsetX) * cameraZoom + renderOffsetX;
    const screenY = (currentPlayer.y - offsetY) * cameraZoom + renderOffsetY;

    ctx.save();
    ctx.translate(renderOffsetX, renderOffsetY);
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_VIEW_WIDTH * cameraZoom, WORLD_VIEW_HEIGHT * cameraZoom);
    ctx.clip();
    ctx.scale(cameraZoom, cameraZoom);
    ctx.translate(-offsetX, -offsetY);

    obstacles.forEach((o) => drawObstacle(o.x, o.y, o.width, o.height));
    drawMap();
    players.forEach((p) => drawJoueurImage(p.x, p.y, p));

    ctx.restore();
    drawBorder(renderOffsetX, renderOffsetY);

    if (isNight || isMidnight) {
        applyNightMask(screenX, screenY, 150 * cameraZoom);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        ctx.rect(renderOffsetX, renderOffsetY, WORLD_VIEW_WIDTH * cameraZoom, WORLD_VIEW_HEIGHT * cameraZoom);
        ctx.clip();
        ctx.drawImage(canvasNight, 0, 0);
        ctx.restore();
    }
}

// ── Sous-fonctions de rendu ───────────────────────────────────────────────────

function misAjourSourceY() {
    if (keys.ArrowUp)    setSy(192);
    if (keys.ArrowLeft)  setSy(64);
    if (keys.ArrowRight) setSy(128);
    if (keys.ArrowDown)  setSy(0);
}

function updateAnimationTime() {
    const moving = keys.ArrowDown || keys.ArrowRight || keys.ArrowLeft || keys.ArrowUp;
    if (moving) {
        setAnimationTime(animationTime >= 4 ? 1 : animationTime + 1);
    } else {
        setAnimationTime(1);
    }
}

function returnSourceX() {
    return (animationTime - 1) * 64;
}

function drawJoueurImage(x, y, player) {
    let localSx = 0;
    let localSy = 0;

    if (localJoueur.id === player.id) {
        misAjourSourceY();
        localSx = returnSourceX();
        localSy = sy;
    } else {
        const dirMap = { down: 0, left: 64, right: 128, up: 192 };
        localSy = dirMap[player.d] ?? 0;
    }

    ctx.save();
    if (isMidnight) {
        const sprite = images[player.type] ?? images["innocent"];
        ctx.drawImage(sprite, localSx, localSy, 64, 64, x - 32, y - 32, 64, 64);
    } else {
        ctx.drawImage(images["innocent"], localSx, localSy, 64, 64, x - 32, y - 32, 64, 64);
        if (!isNight) {
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = "white";
            ctx.fillText(player.username ?? "?", x, y + 42);
            ctx.fillStyle = "black";
            ctx.fillText(player.username ?? "?", x + 1, y + 43);
        }
    }
    ctx.restore();
}

function drawMap() {
    ctx.save();
    ctx.drawImage(images["mapImage"], 0, 0, 4000, 1550, 0, 0, 4000, 1550);
    ctx.restore();
}

function drawObstacle(x, y, width, height) {
    ctx.fillStyle = "brown";
    ctx.fillRect(x, y, width, height);
}

function drawBorder(renderOffsetX, renderOffsetY) {
    const w = WORLD_VIEW_WIDTH  * cameraZoom;
    const h = WORLD_VIEW_HEIGHT * cameraZoom;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "black";
    ctx.fillRect(renderOffsetX,         renderOffsetY,         w, 5);
    ctx.fillRect(renderOffsetX,         renderOffsetY + h - 5, w, 5);
    ctx.fillRect(renderOffsetX + w - 5, renderOffsetY,         5, h);
    ctx.fillRect(renderOffsetX,         renderOffsetY,         5, h);
    ctx.restore();
}

function applyNightMask(px, py, radius) {
    let rad = radius;
    if (localJoueur.type === "assassin")   rad *= 1.7;
    else if (localJoueur.type === "petitefille") rad *= 2.5;

    ctxNight.save();
    ctxNight.clearRect(0, 0, canvasNight.width, canvasNight.height);
    ctxNight.fillStyle = "rgba(0, 0, 0, 0.95)";
    ctxNight.fillRect(0, 0, canvas.width, canvas.height);
    ctxNight.globalCompositeOperation = "destination-out";
    const gradient = ctxNight.createRadialGradient(px, py, rad * 0.6, px, py, rad);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctxNight.fillStyle = gradient;
    ctxNight.beginPath();
    ctxNight.arc(px, py, rad, 0, Math.PI * 2);
    ctxNight.fill();
    ctxNight.restore();
}

// ── Animation tick (appelé via setInterval) ───────────────────────────────────
export function tickAnimation() {
    updateAnimationTime();
}