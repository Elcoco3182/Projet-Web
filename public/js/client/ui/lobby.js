// ui/lobby.js
// Écran affiché après connexion et avant d'entrer en jeu : permet de créer
// un lobby (public ou privé), de rechercher/rejoindre un lobby public dans
// la liste, ou de rejoindre directement par id (utile pour un lobby privé).

import * as state from "../core/state.js";

const API_BASE = `https://${location.hostname}:3000`;

let overlayEl   = null;
let onJoinCb    = null;

/**
 * Affiche l'écran de sélection de lobby.
 * @param {(lobbyId: string, password?: string) => void} onJoin appelé une
 *        fois qu'une connexion websocket doit être tentée sur ce lobby.
 */
export function showLobbyBrowser(onJoin) {
    onJoinCb = onJoin;
    if (overlayEl) return;

    overlayEl = document.createElement("div");
    overlayEl.id = "lobbyBrowser";
    overlayEl.style.cssText = [
        "position:fixed;inset:0;z-index:600;",
        "background:rgba(10,10,15,0.92);",
        "display:flex;align-items:center;justify-content:center;",
        "font-family:Arial,sans-serif;",
    ].join("");

    const panel = document.createElement("div");
    panel.style.cssText = [
        "background:#fff;border-radius:14px;padding:24px 28px;",
        "width:500px;max-width:92vw;max-height:86vh;overflow-y:auto;",
        "box-shadow:0 12px 40px rgba(0,0,0,0.35);",
    ].join("");

    panel.innerHTML = `
        <h2 style="margin:0 0 4px;font-size:20px;color:#222;">Rejoindre une partie</h2>
        <p style="margin:0 0 18px;font-size:13px;color:#777;">PolyQuerBlo — choisis ou crée un lobby</p>

        <div style="display:flex;gap:8px;margin-bottom:14px;">
            <input id="lobbySearch" type="text" placeholder="Rechercher un lobby public..."
                style="flex:1;padding:9px 12px;border-radius:8px;border:1px solid #ddd;font-size:14px;">
            <button id="lobbyRefreshBtn" title="Actualiser"
                style="padding:9px 14px;border-radius:8px;border:1px solid #ddd;background:#f5f5f5;cursor:pointer;">↻</button>
        </div>

        <div id="lobbyList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;min-height:60px;">
            <p style="color:#999;font-size:13px;text-align:center;">Chargement…</p>
        </div>

        <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
            <p style="margin:0;font-size:13px;font-weight:bold;color:#444;">Rejoindre par ID</p>
            <div style="display:flex;gap:8px;">
                <input id="joinByIdInput" type="text" maxlength="6" placeholder="ex: A1B2C3"
                    style="flex:1;padding:9px 12px;border-radius:8px;border:1px solid #ddd;font-size:14px;text-transform:uppercase;">
                <input id="joinByIdPassword" type="password" placeholder="Mot de passe (si privé)"
                    style="flex:1;padding:9px 12px;border-radius:8px;border:1px solid #ddd;font-size:14px;">
                <button id="joinByIdBtn"
                    style="padding:9px 16px;border-radius:8px;border:none;background:#2196F3;color:white;cursor:pointer;font-size:14px;">Rejoindre</button>
            </div>
            <p id="joinByIdError" style="display:none;color:#c0392b;font-size:12px;margin:0;"></p>
        </div>

        <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">

        <button id="showCreateFormBtn"
            style="width:100%;padding:10px;border-radius:8px;border:none;background:#4CAF50;color:white;font-size:14px;font-weight:bold;cursor:pointer;">
            + Créer un lobby
        </button>

        <div id="createLobbyForm" style="display:none;flex-direction:column;gap:8px;margin-top:14px;">
            <input id="newLobbyName" type="text" maxlength="40" placeholder="Nom du lobby (optionnel)"
                style="padding:9px 12px;border-radius:8px;border:1px solid #ddd;font-size:14px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#444;">
                <input id="newLobbyPrivate" type="checkbox">
                Lobby privé (protégé par mot de passe)
            </label>
            <input id="newLobbyPassword" type="password" placeholder="Mot de passe" disabled
                style="padding:9px 12px;border-radius:8px;border:1px solid #ddd;font-size:14px;background:#f2f2f2;">
            <p id="createLobbyError" style="display:none;color:#c0392b;font-size:12px;margin:0;"></p>
            <button id="createLobbyBtn"
                style="padding:9px;border-radius:8px;border:none;background:#4CAF50;color:white;font-size:14px;cursor:pointer;">
                Créer et rejoindre
            </button>
        </div>
    `;

    overlayEl.appendChild(panel);
    document.body.appendChild(overlayEl);

    wireEvents();
    refreshLobbyList();
}

export function hideLobbyBrowser() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
}

// ── Câblage des événements ────────────────────────────────────────────────────

function wireEvents() {
    const searchInput   = document.getElementById("lobbySearch");
    const refreshBtn     = document.getElementById("lobbyRefreshBtn");
    const joinByIdBtn    = document.getElementById("joinByIdBtn");
    const showCreateBtn  = document.getElementById("showCreateFormBtn");
    const privateCheckbox = document.getElementById("newLobbyPrivate");
    const createBtn      = document.getElementById("createLobbyBtn");

    let searchTimeout = null;
    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => refreshLobbyList(searchInput.value), 300);
    });

    refreshBtn.addEventListener("click", () => refreshLobbyList(searchInput.value));

    joinByIdBtn.addEventListener("click", () => {
        const id = document.getElementById("joinByIdInput").value.trim().toUpperCase();
        const password = document.getElementById("joinByIdPassword").value;
        if (!id) return;
        attemptJoin(id, password, "joinByIdError");
    });

    showCreateBtn.addEventListener("click", () => {
        const form = document.getElementById("createLobbyForm");
        form.style.display = form.style.display === "none" ? "flex" : "none";
    });

    privateCheckbox.addEventListener("change", () => {
        document.getElementById("newLobbyPassword").disabled = !privateCheckbox.checked;
        document.getElementById("newLobbyPassword").style.background =
            privateCheckbox.checked ? "white" : "#f2f2f2";
    });

    createBtn.addEventListener("click", createLobby);
}

// ── Appels API ─────────────────────────────────────────────────────────────────

async function refreshLobbyList(search = "") {
    const listEl = document.getElementById("lobbyList");
    if (!listEl) return;
    listEl.innerHTML = `<p style="color:#999;font-size:13px;text-align:center;">Chargement…</p>`;

    try {
        const res = await fetch(`${API_BASE}/lobbies?search=${encodeURIComponent(search)}`, {
            credentials: "include",
        });
        if (!res.ok) throw new Error();
        const lobbies = await res.json();
        renderLobbyList(lobbies);
    } catch {
        listEl.innerHTML = `<p style="color:#c0392b;font-size:13px;text-align:center;">Impossible de charger les lobbies.</p>`;
    }
}

function renderLobbyList(lobbies) {
    const listEl = document.getElementById("lobbyList");
    if (!listEl) return;

    if (lobbies.length === 0) {
        listEl.innerHTML = `<p style="color:#999;font-size:13px;text-align:center;">Aucun lobby public pour l'instant. Crées-en un !</p>`;
        return;
    }

    listEl.innerHTML = "";
    lobbies.forEach((lobby) => {
        const row = document.createElement("div");
        row.style.cssText = [
            "display:flex;align-items:center;justify-content:space-between;",
            "padding:10px 12px;border:1px solid #eee;border-radius:8px;",
            "background:#fafafa;",
        ].join("");

        const statusLabel = lobby.gameState === "playing" ? "En cours" : "En attente";
        const statusColor = lobby.gameState === "playing" ? "#e67e22" : "#4CAF50";

        row.innerHTML = `
            <div>
                <p style="margin:0;font-size:14px;font-weight:bold;color:#222;">${escapeHtml(lobby.name)}</p>
                <p style="margin:2px 0 0;font-size:12px;color:#888;">
                    ID: ${lobby.id} · ${lobby.playerCount} joueur${lobby.playerCount > 1 ? "s" : ""} ·
                    <span style="color:${statusColor};">${statusLabel}</span>
                </p>
            </div>
        `;

        const joinBtn = document.createElement("button");
        joinBtn.textContent = "Rejoindre";
        joinBtn.style.cssText = "padding:7px 14px;border-radius:7px;border:none;background:#2196F3;color:white;font-size:13px;cursor:pointer;";
        joinBtn.addEventListener("click", () => attemptJoin(lobby.id, "", null));

        row.appendChild(joinBtn);
        listEl.appendChild(row);
    });
}

async function createLobby() {
    const name = document.getElementById("newLobbyName").value.trim();
    const isPrivate = document.getElementById("newLobbyPrivate").checked;
    const password = document.getElementById("newLobbyPassword").value;
    const errorEl = document.getElementById("createLobbyError");
    errorEl.style.display = "none";

    if (isPrivate && !password) {
        showFormError(errorEl, "Un mot de passe est requis pour un lobby privé.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/lobbies`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, password: isPrivate ? password : undefined }),
        });
        const data = await res.json();
        if (!res.ok) {
            showFormError(errorEl, data.error ?? "Erreur lors de la création du lobby.");
            return;
        }
        joinAndClose(data.id, isPrivate ? password : "");
    } catch {
        showFormError(errorEl, "Impossible de contacter le serveur.");
    }
}

async function attemptJoin(lobbyId, password, errorElId) {
    const errorEl = errorElId ? document.getElementById(errorElId) : null;
    if (errorEl) errorEl.style.display = "none";

    try {
        const res = await fetch(`${API_BASE}/lobbies/${encodeURIComponent(lobbyId)}`, {
            credentials: "include",
        });
        if (!res.ok) {
            if (errorEl) showFormError(errorEl, "Ce lobby n'existe pas.");
            return;
        }
        const info = await res.json();
        if (info.isPrivate && !password) {
            if (errorEl) showFormError(errorEl, "Ce lobby est privé, entre le mot de passe.");
            return;
        }
        joinAndClose(lobbyId, password);
    } catch {
        if (errorEl) showFormError(errorEl, "Impossible de contacter le serveur.");
    }
}

function joinAndClose(lobbyId, password) {
    state.setCurrentLobbyId(lobbyId);
    hideLobbyBrowser();
    if (onJoinCb) onJoinCb(lobbyId, password);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function showFormError(el, message) {
    el.textContent = message;
    el.style.display = "block";
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}