import {
    localJoueur, setLocalJoueur, pendingUsername, setRejected,
    setPlayers, setObstacles, setMapSize, setDayTime,
} from "../core/state.js";
import { Joueur } from "../core/player.js";
import {
    displayKilledMessage, displayGameEndMessage,
    displayErrorMessage, setJoueurAttributes,
} from "../ui/ui.js";

export const socket = new WebSocket(`wss://${location.hostname}:3000/ws`);

export function sendUpdate(localJoueur, keys) {
    let direction;
    if (keys.ArrowDown)  direction = "down";
    if (keys.ArrowUp)    direction = "up";
    if (keys.ArrowRight) direction = "right";
    if (keys.ArrowLeft)  direction = "left";
    socket.send(JSON.stringify({ type: "update", x: localJoueur.x, y: localJoueur.y, d: direction }));
}

export function sendReady() {
    socket.send(JSON.stringify({ type: "setReady" }));
}

// ── onmessage ─────────────────────────────────────────────────────────────────

export function initSocketMessages(onOpen) {
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case "update":
                setPlayers(data.players);
                setObstacles(data.obstacles);
                break;
            case "lobbyUpdate":
                document.getElementById("lobbyCount").innerText =
                    `${data.nbReady}/${data.total} joueurs prêts (min. 3)`;
                break;
            case "killed":
                if (data.playerId === localJoueur.id) displayKilledMessage();
                break;
            case "playerId": {
                const j = new Joueur(data.startX, data.startY);
                j.id = data.playerId;
                if (pendingUsername) j.username = pendingUsername;
                setLocalJoueur(j);
                break;
            }
            case "mapSize":
                setMapSize(data.width, data.height);
                break;
            case "isMorning":
            case "isNoon":
            case "isAfternoon":
            case "isNight":
            case "isMidnight":
                setDayTime(data.type);
                break;
            case "gameStart":
                setJoueurAttributes(localJoueur, data.role);
                if (data.startX !== undefined) { localJoueur.x = data.startX; localJoueur.y = data.startY; }
                document.getElementById("popup").style.display = "none";
                document.getElementById("lobbyCount").style.display = "none";
                document.getElementById("dayTime").style.visibility = "visible";
                break;
            case "rejected":
                document.getElementById("popup").style.display = "none";
                document.getElementById("lobbyCount").style.display = "none";
                setRejected(true);
                break;
            case "gameEnd":
                displayGameEndMessage(data.result);
                break;
        }
    };

    socket.onerror = (error) => displayErrorMessage("WebSocket error: " + error.message);

    socket.onclose = (event) => {
        import("../core/state.js").then(({ rejected }) => {
            if (rejected)            displayErrorMessage("Partie déjà en cours, vous avez été rejeté");
            else if (event.wasClean) displayErrorMessage("WebSocket connection closed");
            else                     displayErrorMessage("WebSocket connection closed unexpectedly");
        });
    };

    socket.onopen = onOpen;
}