import * as state from "../core/state.js";
import { images } from "./assets.js";
import { keys, joystickInput } from "../ui/input.js";

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
    const zoomX = viewportWidth  / state.WORLD_VIEW_WIDTH;
    const zoomY = viewportHeight / state.WORLD_VIEW_HEIGHT;
    state.setCameraZoom(Math.min(zoomX, zoomY));
}

export function draw(getCurrentDayTime) {
    document.getElementById("dayTime").innerText = getCurrentDayTime();

    const renderOffsetX = (viewportWidth  - state.WORLD_VIEW_WIDTH  * state.cameraZoom) / 2;
    const renderOffsetY = (viewportHeight - state.WORLD_VIEW_HEIGHT * state.cameraZoom) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    ctx.fillStyle = "gray";
    ctx.fillRect(renderOffsetX, renderOffsetY, state.WORLD_VIEW_WIDTH * state.cameraZoom, state.WORLD_VIEW_HEIGHT * state.cameraZoom);

    const currentPlayer = state.players.find((p) => p.id === state.localJoueur.id);
    if (!currentPlayer) return;

    const offsetX = Math.min(Math.max(currentPlayer.x - state.WORLD_VIEW_WIDTH  / 2, 0), Math.max(state.mapWidth  - state.WORLD_VIEW_WIDTH,  0));
    const offsetY = Math.min(Math.max(currentPlayer.y - state.WORLD_VIEW_HEIGHT / 2, 0), Math.max(state.mapHeight - state.WORLD_VIEW_HEIGHT, 0));
    const screenX = (currentPlayer.x - offsetX) * state.cameraZoom + renderOffsetX;
    const screenY = (currentPlayer.y - offsetY) * state.cameraZoom + renderOffsetY;

    ctx.save();
    ctx.translate(renderOffsetX, renderOffsetY);
    ctx.beginPath();
    ctx.rect(0, 0, state.WORLD_VIEW_WIDTH * state.cameraZoom, state.WORLD_VIEW_HEIGHT * state.cameraZoom);
    ctx.clip();
    ctx.scale(state.cameraZoom, state.cameraZoom);
    ctx.translate(-offsetX, -offsetY);

    state.obstacles.forEach((o) => drawObstacle(o.x, o.y, o.width, o.height));
    drawMap();
    state.players.forEach((p) => drawJoueurImage(p.x, p.y, p));

    ctx.restore();
    drawBorder(renderOffsetX, renderOffsetY);

    if (state.isNight || state.isMidnight || state.isDawn) {
        applyNightMask(screenX, screenY, 150 * state.cameraZoom);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        ctx.rect(renderOffsetX, renderOffsetY, state.WORLD_VIEW_WIDTH * state.cameraZoom, state.WORLD_VIEW_HEIGHT * state.cameraZoom);
        ctx.clip();
        ctx.drawImage(canvasNight, 0, 0);
        ctx.restore();
    }
}

// ── Sous-fonctions ────────────────────────────────────────────────────────────

function misAjourSourceY() {
    if (keys.ArrowUp)    state.setSy(192);
    if (keys.ArrowLeft)  state.setSy(64);
    if (keys.ArrowRight) state.setSy(128);
    if (keys.ArrowDown)  state.setSy(0);
    if (joystickInput.up)    state.setSy(192);
    if (joystickInput.left)  state.setSy(64);
    if (joystickInput.right) state.setSy(128);
    if (joystickInput.down)  state.setSy(0);
}

function updateAnimationTime() {
    const moving = keys.ArrowDown || keys.ArrowRight || keys.ArrowLeft || keys.ArrowUp
        || joystickInput.up || joystickInput.down || joystickInput.left || joystickInput.right;
    if (moving) {
        state.setAnimationTime(state.animationTime >= 4 ? 1 : state.animationTime + 1);
    } else {
        state.setAnimationTime(1);
    }
}

function returnSourceX() {
    return (state.animationTime - 1) * 64;
}

function drawJoueurImage(x, y, player) {
    let localSx = 0;
    let localSy;

    if (state.localJoueur.id === player.id) {
        misAjourSourceY();
        if (!state.isNoon) localSx = returnSourceX(); // animation figée à midi
        localSy = state.sy;
    } else {
        const dirMap = { down: 0, left: 64, right: 128, up: 192 };
        localSy = dirMap[player.d] ?? 0;
    }

    ctx.save();

    if (state.isMidnight || state.isDawn) {
        // La nuit et à l'aube : on voit les rôles
        switch (player.type) {
            case "assassin":
                ctx.drawImage(images["assassin"],    localSx, localSy, 64, 64, x - 32, y - 32, 64, 64);
                break;
            case "petitefille":
                ctx.drawImage(images["petitefille"], localSx, localSy, 64, 64, x - 32, y - 32, 64, 64);
                break;
            default:
                ctx.drawImage(images["innocent"],    localSx, localSy, 64, 64, x - 32, y - 32, 64, 64);
        }
    } else {
        // Jour : tout le monde apparaît avec son avatar (rôle caché)
        const avatarKey = player.avatar || "innocent";
        const img = images[avatarKey] || images["innocent"];
        ctx.drawImage(img, localSx, localSy, 64, 64, x - 32, y - 32, 64, 64);
        if (!state.isNight) {
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
    const w = state.WORLD_VIEW_WIDTH  * state.cameraZoom;
    const h = state.WORLD_VIEW_HEIGHT * state.cameraZoom;
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
    // Rayon étendu uniquement pendant minuit et l'aube
    if (state.localJoueur.type === "assassin"   && (state.isMidnight || state.isDawn)) rad *= 1.7;
    if (state.localJoueur.type === "petitefille" && (state.isMidnight || state.isDawn)) rad *= 2.5;

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

export function tickAnimation() {
    updateAnimationTime();
}