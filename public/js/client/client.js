import { localJoueur, isMorning, isNoon, isAfternoon, isNight, isMidnight } from "./core/state.js";
import { preloadImages } from "./render/assets.js";
import { canvas, initCanvas, updateZoom, draw, tickAnimation } from "./render/renderer.js";
import { keys, joystickInput } from "./ui/input.js";
import { socket, sendUpdate, sendReady, initSocketMessages } from "./net/socket.js";
import { displayUsername } from "./ui/ui.js";

// ── Initialisation ────────────────────────────────────────────────────────────

document.getElementById("dayTime").style.visibility = "hidden";
initCanvas();
displayUsername();

setInterval(tickAnimation, 500);

// ── Cycle jour/nuit (affichage) ───────────────────────────────────────────────

function getCurrentDayTime() {
    if (isMorning)   return "Matin";
    if (isNoon)      return "Midi";
    if (isAfternoon) return "Après-midi";
    if (isNight)     return "Nuit";
    if (isMidnight)  return "Minuit";
    return "Inconnu";
}

// ── Bouton Ready ──────────────────────────────────────────────────────────────
// Exposé globalement car appelé depuis le HTML (onclick="sendReady()")
window.sendReady = sendReady;

// ── Boucle de jeu ─────────────────────────────────────────────────────────────

let lastTime = 0;

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    const deltaTime = lastTime === 0 ? 0 : (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (!localJoueur || localJoueur.died) return;
    if (socket.readyState !== WebSocket.OPEN) return;

    if (keys.ArrowUp    || joystickInput.up)          localJoueur.moveUp(deltaTime);
    if (keys.ArrowDown  || joystickInput.down)        localJoueur.moveDown(deltaTime);
    if (keys.ArrowLeft  || joystickInput.left)        localJoueur.moveLeft(deltaTime);
    if (keys.ArrowRight || joystickInput.right)       localJoueur.moveRight(deltaTime);
    if (keys.Spacebar   || joystickInput.killBoutton) localJoueur.tryKill(socket);

    sendUpdate(localJoueur, keys);
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