import * as state from "../core/state.js";
import { Joueur } from "../core/player.js";
import {
    displayGameEndMessage, displayErrorMessage,
    setJoueurAttributes, showVotePanel, hideVotePanel,
    displayExeco, displayKilledByVoteMessage, displayAubeToMatin,
    displayAfternoonToNight, displaySpectatorMessage,
    showAdminPanel, updateAdminPanel,
} from "../ui/ui.js";
import { setLocalAvatar, setIsSpectator, setIsAdmin } from "../core/state.js";

// La socket n'est plus créée au chargement du module : on ne se connecte
// qu'une fois qu'un lobby a été choisi (voir connectToLobby ci-dessous).
export let socket = null;

/** true une fois que le serveur a confirmé le join (message "playerId" reçu).
 *  Tant que c'est false, un close/error de la socket = échec de connexion
 *  (mauvais mdp, lobby plein, etc.), pas une déconnexion en cours de partie. */
let joinConfirmed = false;

/**
 * Ouvre la connexion websocket vers un lobby précis.
 * @param {string} lobbyId
 * @param {string} [password] mot de passe du lobby s'il est privé
 * @returns {WebSocket}
 */
export function connectToLobby(lobbyId, password) {
    joinConfirmed = false;
    const params = new URLSearchParams({ lobbyId });
    if (password) params.set("password", password);
    socket = new WebSocket(`wss://${location.hostname}:3000/ws?${params.toString()}`);
    return socket;
}

export function sendUpdate(localJoueur, keys, joystickInput) {
    let direction;
    if (keys.ArrowDown  || joystickInput.down)  direction = "down";
    if (keys.ArrowUp    || joystickInput.up)    direction = "up";
    if (keys.ArrowRight || joystickInput.right) direction = "right";
    if (keys.ArrowLeft  || joystickInput.left)  direction = "left";
    socket.send(JSON.stringify({ type: "update", x: localJoueur.x, y: localJoueur.y, d: direction }));
}

export function sendReady() {
    if (state.isAdmin) return; // un admin ne peut pas se mettre ready
    socket.send(JSON.stringify({ type: "setReady" }));
}

export function sendSkip() {
    if (state.isSpectator || state.isAdmin) return;
    socket.send(JSON.stringify({ type: "skip" }));
}

/** Ferme proprement la connexion courante (bouton "Quitter le lobby"). */
export function leaveLobby() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "Le joueur a quitté le lobby");
    }
    socket = null;
}

/**
 * @param {() => void} onReady appelé une fois le join confirmé (message "playerId" reçu)
 * @param {(reason: string) => void} [onJoinFailed] appelé si la connexion échoue
 *        AVANT confirmation du join (mauvais mdp, lobby plein/en cours...)
 */
export function initSocketMessages(onReady, onJoinFailed) {
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case "update":
                state.setPlayers(data.players);
                break;
            case "lobbyUpdate":
                if (!state.isAdmin) {
                    document.getElementById("lobbyCount").innerText =
                        `${data.nbReady}/${data.total} joueurs prêts (min. 3)`;
                }
                break;
            case "killed":
                if (data.playerId === state.localJoueur.id) {
                    if (!state.isAdmin) enterSpectatorMode();
                    // Un admin ne peut pas être tué
                }
                break;
            case "kicked":
                // Ce client a été expulsé par un admin
                displayErrorMessage("Vous avez été expulsé par un administrateur.");
                break;
            case "playerId": {
                const j = new Joueur(data.startX, data.startY);
                j.id = data.playerId;
                if (state.pendingUsername) j.username = state.pendingUsername;
                state.setLocalJoueur(j);

                // Appliquer le statut admin dès la connexion
                if (data.isAdmin) {
                    setIsAdmin(true);
                    setIsSpectator(true); // admin = toujours spectateur
                    j.isAdmin = true;
                    j.dead    = true;
                    // Forcer l'avatar admin côté local
                    setLocalAvatar("admin");
                    j.avatar = "admin";
                    // Masquer les contrôles joueur, afficher le panneau admin
                    document.getElementById("readyBtn").style.display   = "none";
                    document.getElementById("skipBtn").style.display    = "none";
                    document.getElementById("avatarBtn").style.display  = "none";
                    document.getElementById("lobbyCount").style.display = "none";
                    showAdminPanel();
                }

                // Le join est officiellement confirmé par le serveur : on peut
                // révéler l'interface de jeu (voir onReady dans client.js).
                joinConfirmed = true;
                if (onReady) onReady();
                break;
            }
            case "mapSize":
                state.setMapSize(data.width, data.height);
                break;
            case "isMorning":
                socket.send(JSON.stringify({ type: "unParfume" }));
                displayAubeToMatin();
                state.setDayTime("isMorning");
                break;
            case "morningSpawn":
                if (!state.isSpectator && !state.isAdmin) {
                    state.localJoueur.x = data.x;
                    state.localJoueur.y = data.y;
                }
                break;
            case "isNoon":
                state.setDayTime("isNoon");
                if (!state.isSpectator && !state.isAdmin) {
                    document.getElementById("skipBtn").style.display = "block";
                    showVotePanel(state.players.filter(p => !p.dead && !p.isAdmin));
                }
                break;
            case "noonSpawn":
                if (!state.isSpectator && !state.isAdmin) {
                    state.localJoueur.x = data.x;
                    state.localJoueur.y = data.y;
                }
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
                if (!state.isSpectator && !state.isAdmin) {
                    state.localJoueur.x = data.x;
                    state.localJoueur.y = data.y;
                }
                break;
            case "isMidnight":
                state.setDayTime("isMidnight");
                break;
            case "isDawn":
                state.setDayTime("isDawn");
                break;
            case "gameStart":
                if (!state.isAdmin) {
                    setJoueurAttributes(state.localJoueur, data.role);
                    if (data.startX !== undefined) {
                        state.localJoueur.x = data.startX;
                        state.localJoueur.y = data.startY;
                    }
                    document.getElementById("readyBtn").style.display  = "none";
                    document.getElementById("lobbyCount").style.display = "none";
                    document.getElementById("dayTime").style.visibility = "visible";
                    document.getElementById("avatarBtn").style.display  = "none";
                }
                break;
            case "adminGameStart":
                // La partie démarre pour l'admin (afficher dayTime, cacher le reste)
                document.getElementById("dayTime").style.visibility = "visible";
                break;
            case "adminInit":
                // Reçu à la connexion de l'admin — mise à jour initiale du panneau
                updateAdminPanel(data.players);
                break;
            case "rejected":
                document.getElementById("popup").style.display     = "none";
                document.getElementById("lobbyCount").style.display = "none";
                state.setRejected(true);
                break;
            case "gameEnd":
                displayGameEndMessage(data.result);
                break;
            case "returnToLobby":
                handleReturnToLobby();
                break;
            case "vote":
                if (data.draw) displayExeco(data.tabExeco);
                else           displayKilledByVoteMessage(data.player);
                break;
            case "obstacles":
                state.setObstacles(data.obstacles);
                break;
            case "avatarUpdate": {
                const p = state.players.find((pl) => pl.id === data.playerId);
                if (p) p.avatar = data.avatar;
                if (state.localJoueur && data.playerId === state.localJoueur.id && !state.isAdmin) {
                    setLocalAvatar(data.avatar);
                }
                break;
            }
        }
    };

    socket.onerror = () => {
        // Une erreur avant confirmation du join est traitée dans onclose
        // (qui suit toujours onerror), pas ici, pour éviter un double traitement.
        if (joinConfirmed) displayErrorMessage("Erreur de connexion au serveur.");
    };

    socket.onclose = (event) => {
        if (!joinConfirmed) {
            // Échec de connexion avant même d'avoir rejoint la partie :
            // mauvais mot de passe, lobby plein/en cours, lobby supprimé entre-temps...
            // On ne montre jamais l'écran de jeu dans ce cas — on prévient l'appelant
            // pour qu'il puisse renvoyer le joueur vers l'écran de sélection.
            if (onJoinFailed) {
                const reason = event.code === 1006
                    ? "Connexion refusée : mot de passe incorrect, lobby plein, en cours de partie ou introuvable."
                    : "Impossible de rejoindre ce lobby.";
                onJoinFailed(reason);
            }
            return;
        }

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
}

// ── Retour à l'écran d'attente (même lobby, sans reconnexion) ────────────────

function handleReturnToLobby() {
    // Réinitialiser les indicateurs locaux du round précédent.
    // Un admin reste spectateur en permanence (dead=true) d'un round à l'autre.
    if (state.localJoueur) {
        state.localJoueur.dead = state.isAdmin;
        state.localJoueur.type = undefined;
    }

    hideVotePanel();
    document.getElementById("dayTime").style.visibility = "hidden";

    if (!state.isAdmin) {
        setIsSpectator(false);
        document.getElementById("killButton").style.display   = "none";
        document.getElementById("parfumButton").style.display = "none";
        document.getElementById("skipBtn").style.display      = "none";
        document.getElementById("readyBtn").style.display     = "block";
        document.getElementById("avatarBtn").style.display    = "block";
        document.getElementById("lobbyCount").style.display   = "block";
    }
}

// ── Passage en mode spectateur ────────────────────────────────────────────────

function enterSpectatorMode() {
    setIsSpectator(true);
    if (state.localJoueur) state.localJoueur.dead = true;
    document.getElementById("killButton").style.display   = "none";
    document.getElementById("parfumButton").style.display = "none";
    document.getElementById("skipBtn").style.display      = "none";
    hideVotePanel();
    displaySpectatorMessage();
}