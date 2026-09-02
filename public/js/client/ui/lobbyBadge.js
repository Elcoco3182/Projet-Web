// ui/lobbyBadge.js
// Petit badge affiché en jeu avec l'id du lobby, pour pouvoir le partager
// facilement à des amis. Un bouton œil permet de le masquer (utile en stream
// ou simplement par préférence) sans jamais perdre l'info : elle reste
// récupérable en re-cliquant.

let badgeEl = null;
let hidden  = false;

export function showLobbyBadge(lobbyId) {
    if (badgeEl) removeLobbyBadge();

    badgeEl = document.createElement("div");
    badgeEl.id = "lobbyIdBadge";
    badgeEl.style.cssText = [
        "position:fixed;bottom:10px;left:10px;",
        "font-family:Arial,sans-serif;font-size:13px;font-weight:bold;",
        "color:#0c0606;background:rgba(255,255,255,0.5);",
        "padding:6px 10px;border-radius:5px;border:2px solid #0c0606;",
        "z-index:999;display:flex;align-items:center;gap:8px;",
    ].join("");

    const label = document.createElement("span");
    label.id = "lobbyIdLabel";
    label.textContent = `🔑 ${lobbyId}`;

    const toggleBtn = document.createElement("button");
    toggleBtn.id = "lobbyIdToggle";
    toggleBtn.textContent = "👁";
    toggleBtn.title = "Masquer/afficher l'id du lobby";
    toggleBtn.style.cssText = [
        "border:none;background:none;cursor:pointer;",
        "font-size:13px;padding:0;line-height:1;",
    ].join("");

    toggleBtn.addEventListener("click", () => {
        hidden = !hidden;
        label.textContent = hidden ? "🔑 ••••••" : `🔑 ${lobbyId}`;
        toggleBtn.textContent = hidden ? "🙈" : "👁";
    });

    badgeEl.append(label, toggleBtn);
    document.body.appendChild(badgeEl);
}

export function removeLobbyBadge() {
    if (badgeEl) { badgeEl.remove(); badgeEl = null; }
    hidden = false;
}