import * as state from "../core/state.js";
import { Joueur } from "../core/player.js";
import {
    displayKilledMessage, displayGameEndMessage, displayErrorMessage,
    setJoueurAttributes, showVotePanel, hideVotePanel,
    displayExeco, displayKilledByVoteMessage, displayAubeToMatin,
    displayAfternoonToNight,
} from "../ui/ui.js";
import { setLocalAvatar } from "../core/state.js";

export const socket = new WebSocket(`wss://${location.hostname}:3000/ws`);

export function sendUpdate(localJoueur, keys, joystickInput) {
    let direction;
    if (keys.ArrowDown  || joystickInput.down)  direction = "down";
    if (keys.ArrowUp    || joystickInput.up)    direction = "up";
    if (keys.ArrowRight || joystickInput.right) direction = "right";
    if (keys.ArrowLeft  || joystickInput.left)  direction = "left";
    socket.send(JSON.stringify({ type: "update", x: localJoueur.x, y: localJoueur.y, d: direction }));
}

export function sendReady() {
    socket.send(JSON.stringify({ type: "setReady" }));
}

export function sendSkip() {
    socket.send(JSON.stringify({ type: "skip" }));
}

export function initSocketMessages(onOpen) {
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case "update":
                state.setPlayers(data.players);
                break;
            case "lobbyUpdate":
                document.getElementById("lobbyCount").innerText =
                    `${data.nbReady}/${data.total} joueurs prêts (min. 3)`;
                break;
            case "killed":
                if (data.playerId === state.localJoueur.id) displayKilledMessage();
                break;
            case "playerId": {
                const j = new Joueur(data.startX, data.startY);
                j.id = data.playerId;
                if (state.pendingUsername) j.username = state.pendingUsername;
                state.setLocalJoueur(j);
                break;
            }
            case "mapSize":
                state.setMapSize(data.width, data.height);
                break;
            case "isMorning":
                displayAubeToMatin();
                state.setDayTime("isMorning");
                break;
            case "morningSpawn":
                state.localJoueur.x = data.x;
                state.localJoueur.y = data.y;
                break;
            case "isNoon":
                state.setDayTime("isNoon");
                document.getElementById("skipBtn").style.display = "block";
                showVotePanel(state.players);
                break;
            case "noonSpawn":
                state.localJoueur.x = data.x;
                state.localJoueur.y = data.y;
                break;
            case "isAfternoon":
                state.setDayTime("isAfternoon");
                document.getElementById("skipBtn").style.display = "none";
                hideVotePanel();
                break;
            case "isNight":
                displayAfternoonToNight();
                state.setDayTime("isNight");
                break;
            case "nightSpawn":
                state.localJoueur.x = data.x;
                state.localJoueur.y = data.y;
                break;
            case "isMidnight":
                state.setDayTime("isMidnight");
                break;
            case "isDawn":
                state.setDayTime("isDawn");
                break;
            case "gameStart":
                setJoueurAttributes(state.localJoueur, data.role);
                if (data.startX !== undefined) {
                    state.localJoueur.x = data.startX;
                    state.localJoueur.y = data.startY;
                }
                document.getElementById("readyBtn").style.display = "none";
                document.getElementById("lobbyCount").style.display = "none";
                document.getElementById("dayTime").style.visibility = "visible";
                document.getElementById("avatarBtn").style.display = "none";
                break;
            case "rejected":
                document.getElementById("popup").style.display = "none";
                document.getElementById("lobbyCount").style.display = "none";
                state.setRejected(true);
                break;
            case "gameEnd":
                displayGameEndMessage(data.result);
                break;
            case "vote":
                if (data.draw) displayExeco(data.tabExeco);
                else           displayKilledByVoteMessage(data.player);
                break;
            case "obstacles":
                state.setObstacles(data.obstacles);
                break;
            case "avatarUpdate": {
                // Mettre à jour l'avatar du joueur dans la liste locale
                const p = state.players.find((pl) => pl.id === data.playerId);
                if (p) p.avatar = data.avatar;
                // Si c'est notre propre joueur, sync localAvatar aussi
                if (state.localJoueur && data.playerId === state.localJoueur.id) {
                    setLocalAvatar(data.avatar);
                }
                break;
            }
        }
    };

    socket.onerror  = (error) => displayErrorMessage("WebSocket error: " + error.message);

    socket.onclose  = (event) => {
        // code 1006 = connexion refusée / échec réseau (403 avant upgrade)
        if (event.code === 1006) {
            displayErrorMessage("Partie pleine ou déjà en cours.");
            return;
        }
        import("../core/state.js").then(({ rejected }) => {
            if (rejected)            displayErrorMessage("Partie déjà en cours, vous avez été rejeté");
            else if (event.wasClean) displayErrorMessage("WebSocket connection closed");
            else                     displayErrorMessage("WebSocket connection closed unexpectedly");
        });
    };

    socket.onopen = onOpen;
}