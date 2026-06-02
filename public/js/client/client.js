import * as state from "./core/state.js";
import { preloadImages } from "./render/assets.js";
import { canvas, initCanvas, updateZoom, draw, tickAnimation } from "./render/renderer.js";
import { keys, joystickInput } from "./ui/input.js";
import { socket, sendUpdate, sendReady, sendSkip, initSocketMessages } from "./net/socket.js";
import { displayUsername, submitVote, showAvatarPanel } from "./ui/ui.js";

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
window.clientSubmitVote = submitVote;
window.openAvatarPanel  = showAvatarPanel;

// ── Boucle de jeu ─────────────────────────────────────────────────────────────

let lastTime = 0;

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    const deltaTime = lastTime === 0 ? 0 : (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (!state.localJoueur) return;
    if (socket.readyState !== WebSocket.OPEN) return;

    // Un fantôme peut se déplacer librement (sans restriction de phase)
    // Un joueur vivant ne peut pas bouger à midi
    const canMove = state.isSpectator || !state.isNoon;

    if (canMove) {
        if (keys.ArrowUp    || joystickInput.up)    state.localJoueur.moveUp(deltaTime);
        if (keys.ArrowDown  || joystickInput.down)  state.localJoueur.moveDown(deltaTime);
        if (keys.ArrowLeft  || joystickInput.left)  state.localJoueur.moveLeft(deltaTime);
        if (keys.ArrowRight || joystickInput.right) state.localJoueur.moveRight(deltaTime);
    }

    // Les spectateurs ne peuvent pas attaquer/parfumer
    if (!state.isSpectator) {
        switch(state.localJoueur.type) {
            case "assassin":
                if (keys.Spacebar || joystickInput.killBoutton) state.localJoueur.tryKill(socket);
                break;
            case "parfumeuse":
                if (keys.Spacebar || joystickInput.parfumButton)
                    state.localJoueur.tryParfume(socket);
                break;
        }
    }

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
    // Si spectateur, ne pas écraser le zoom étendu
    if (!state.isSpectator) updateZoom();
});
