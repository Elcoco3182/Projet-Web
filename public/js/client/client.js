import * as state from "./core/state.js";
import { preloadImages } from "./render/assets.js";
import { canvas, initCanvas, updateZoom, draw, tickAnimation } from "./render/renderer.js";
import { keys, joystickInput } from "./ui/input.js";
import { socket, sendUpdate, sendReady, sendSkip, initSocketMessages } from "./net/socket.js";
import { displayUsername } from "./ui/ui.js";

// ── Initialisation ────────────────────────────────────────────────────────────

document.getElementById("dayTime").style.visibility = "hidden";
initCanvas();
displayUsername();

setInterval(tickAnimation, 500);

// ── Cycle jour/nuit (affichage) ───────────────────────────────────────────────

function getCurrentDayTime() {
    if (state.isMorning)   return "Matin";
    if (state.isNoon)      return "Midi";
    if (state.isAfternoon) return "Après-midi";
    if (state.isNight)     return "Nuit";
    if (state.isMidnight)  return "Minuit";
    if (state.isDawn)      return "Aube";
    return "Inconnu";
}

// ── Boutons globaux (appelés depuis le HTML) ──────────────────────────────────
window.sendReady  = sendReady;
window.sendSkip   = sendSkip;

// ── Boucle de jeu ─────────────────────────────────────────────────────────────

let lastTime = 0;

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    const deltaTime = lastTime === 0 ? 0 : (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (!state.localJoueur || state.localJoueur.died) return;
    if (socket.readyState !== WebSocket.OPEN) return;

    // Déplacements bloqués à midi (phase vote)
    if (!state.isNoon) {
        if (keys.ArrowUp    || joystickInput.up)    state.localJoueur.moveUp(deltaTime);
        if (keys.ArrowDown  || joystickInput.down)  state.localJoueur.moveDown(deltaTime);
        if (keys.ArrowLeft  || joystickInput.left)  state.localJoueur.moveLeft(deltaTime);
        if (keys.ArrowRight || joystickInput.right) state.localJoueur.moveRight(deltaTime);
    }

    if (keys.Spacebar || joystickInput.killBoutton) state.localJoueur.tryKill(socket);

    sendUpdate(state.localJoueur, keys, joystickInput);
    draw(getCurrentDayTime);
}

// ── Démarrage après connexion WebSocket ───────────────────────────────────────

initSocketMessages(() => {
    preloadImages(() => {
        requestAnimationFrame(gameLoop);
    });
});

// ── Resize ────────────────────────────────────────────────────────────────────

window.addEventListener("resize", () => {
    canvas.width  = window.innerWidth  - 25;
    canvas.height = window.innerHeight - 25;
    import("./render/renderer.js").then(({ canvasNight }) => {
        canvasNight.width  = canvas.width;
        canvasNight.height = canvas.height;
    });
    updateZoom();
});