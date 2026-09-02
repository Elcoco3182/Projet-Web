import * as state from "./core/state.js";
import { preloadImages } from "./render/assets.js";
import { canvas, initCanvas, updateZoom, draw, tickAnimation } from "./render/renderer.js";
import { keys, joystickInput } from "./ui/input.js";
import { connectToLobby, sendUpdate, sendReady, sendSkip, initSocketMessages, leaveLobby } from "./net/socket.js";
import { socket } from "./net/socket.js";
import { displayUsername, submitVote, showAvatarPanel } from "./ui/ui.js";
import { showLobbyBrowser } from "./ui/lobby.js";
import { showLobbyBadge } from "./ui/lobbyBadge.js";

// ── État initial : le jeu reste caché tant qu'aucun lobby n'est rejoint ───────
document.getElementById("dayTime").style.visibility = "hidden";
canvas.style.display = "none";
document.getElementById("popup").style.display = "none";

// ── Boutons globaux (appelés depuis le HTML) ──────────────────────────────────
window.sendReady  = sendReady;
window.sendSkip   = sendSkip;
window.clientSubmitVote = submitVote;
window.openAvatarPanel  = showAvatarPanel;
window.leaveLobby       = leaveLobby;

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

// ── Boucle de jeu ─────────────────────────────────────────────────────────────

let lastTime = 0;

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    const deltaTime = lastTime === 0 ? 0 : (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (!state.localJoueur) return;

    // `socket` est importé en liaison "live" ES module : cette lecture
    // reflète toujours la socket courante, même réassignée par connectToLobby().
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

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

// ── Démarrage : auth puis choix du lobby puis jeu ─────────────────────────────

async function boot() {
    // Vérifie l'authentification, redirige vers /login.html sinon,
    // affiche le pseudo une fois confirmé.
    await displayUsername();
    showLobbyBrowser(onLobbyJoined);
}

let animationIntervalId = null;

function onLobbyJoined(lobbyId, password) {
    initCanvas(); // le canvas reste display:none tant que le join n'est pas confirmé

    connectToLobby(lobbyId, password);

    initSocketMessages(
        // ── Succès : le serveur a confirmé le join (message "playerId") ──────
        () => {
            canvas.style.display = "block";
            document.getElementById("popup").style.display = "block";
            showLobbyBadge(lobbyId);

            if (animationIntervalId) clearInterval(animationIntervalId);
            animationIntervalId = setInterval(() => {
                tickAnimation();
                if (state.isAdmin) {
                    import("./ui/ui.js").then(({ updateAdminPanel }) => {
                        updateAdminPanel(state.players);
                    });
                }
            }, 250);

            preloadImages(() => {
                requestAnimationFrame(gameLoop);
            });
        },
        // ── Échec avant confirmation : mauvais mdp, lobby plein/supprimé... ──
        (reason) => {
            alert(reason);
            showLobbyBrowser(onLobbyJoined);
        },
    );
}

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

boot();