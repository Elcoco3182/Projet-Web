import { canvas } from "../render/renderer.js";
import * as state from "../core/state.js";
import { socket } from "../net/socket.js";
import { AVATARS, images } from "../render/assets.js";

export function displayKilledMessage() {
    import("../net/socket.js").then(({ socket: _s }) => {});
}

export function displayGameEndMessage(result) {
    const voteOverlay = document.getElementById("voteKillOverlay");
    if (voteOverlay) { clearTimeout(parseInt(voteOverlay.dataset.timeout)); voteOverlay.remove(); }

    canvas.style.visibility = "visible";
    canvas.style.display = "none";

    const roleLabel = { assassin: "Assassin", innocent: "Innocent", petitefille: "Petite fille", parfumeuse: "Parfumeuse" };
    const roleColor = { assassin: "#ef5350", innocent: "#4fc3f7", petitefille: "#ce93d8", parfumeuse: "#e32b4a" };

    const winners = state.players.filter((p) => {
        if (result === "vicInno")  return p.type === "innocent" || p.type === "petitefille";
        if (result === "vicPsyco") return p.type === "assassin";
        return false;
    });

    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.88);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1000;font-family:Arial,sans-serif;";

    const title    = document.createElement("h1");
    const subtitle = document.createElement("p");
    title.style.cssText    = "font-size:42px;margin-bottom:8px;";
    subtitle.style.cssText = "font-size:18px;color:#ccc;margin-bottom:28px;";

    if (result === "vicInno") {
        title.style.color = "#4fc3f7"; title.textContent = "🏆 Les innocents ont gagné !";
        subtitle.textContent = "L'assassin a été éliminé.";
    } else {
        title.style.color = "#ef5350"; title.textContent = "💀 L'assassin a gagné !";
        subtitle.textContent = "Les innocents ont été éliminés.";
    }

    const winnersBox = document.createElement("div");
    winnersBox.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:32px;max-width:600px;";
    winners.forEach((p) => {
        const color = roleColor[p.type] ?? "#fff";
        const card  = document.createElement("div");
        card.style.cssText = `background:rgba(255,255,255,0.07);border:1px solid ${color}55;border-radius:10px;padding:12px 20px;text-align:center;min-width:100px;`;
        card.innerHTML = `<p style="font-size:16px;font-weight:bold;color:white;margin:0 0 4px;">${p.username ?? "?"}</p><p style="font-size:12px;color:${color};margin:0;">${roleLabel[p.type] ?? p.type}</p>`;
        winnersBox.appendChild(card);
    });

    const countdown = document.createElement("p");
    countdown.style.cssText = "font-size:14px;color:#666;";
    overlay.append(title, subtitle, winnersBox, countdown);
    document.body.appendChild(overlay);

    let secondes = 5;
    countdown.textContent = `Retour au lobby dans ${secondes}s…`;
    const timer = setInterval(() => {
        secondes--;
        if (secondes <= 0) {
            clearInterval(timer);
            overlay.remove();
            canvas.style.display    = "block";
            canvas.style.visibility = "visible";
            // La réinitialisation effective des contrôles (readyBtn, etc.)
            // est déclenchée par le message "returnToLobby" envoyé par le
            // serveur au même moment (voir socket.js) — pas de reload ici,
            // on reste connecté au même lobby.
        }
        else countdown.textContent = `Retour au lobby dans ${secondes}s…`;
    }, 1000);
}

export function displayErrorMessage(message) {
    canvas.style.display = "none";
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;font-weight:bold;color:red;";
    el.innerText = message;
    document.body.appendChild(el);
}

export async function displayUsername() {
    let res = await fetch(`https://${location.hostname}:3000/verify`, { credentials: "include" });
    if (!res.ok) {
        const refreshRes = await fetch(`https://${location.hostname}:3000/refresh`, {
            method: "POST",
            credentials: "include"
        });
        if (!refreshRes.ok) {
            window.location.href = "/login.html";
            return;
        }
        // Réessayer le verify avec le nouvel access token
        res = await fetch(`https://${location.hostname}:3000/verify`, { credentials: "include" });
        if (!res.ok) { window.location.href = "/login.html"; return; }
    }
    const data = await res.json();
    state.setPendingUsername(data.username);
    if (state.localJoueur) state.localJoueur.username = data.username;
    const label = document.createElement("div");
    label.style.cssText = "position:fixed;top:10px;left:10px;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#0c0606;background:rgba(255,255,255,0.5);padding:6px 12px;border-radius:5px;border:2px solid #0c0606;z-index:999;";
    label.textContent = `👤 ${data.username}`;
    document.body.appendChild(label);
}

export function setJoueurAttributes(localJoueurRef, role) {
    if (!localJoueurRef) return;
    localJoueurRef.type  = role;
    localJoueurRef.speed = 5;
    if (role === "assassin" && "ontouchstart" in window)
        document.getElementById("killButton").style.display = "block";
    if (role === "parfumeuse" && "ontouchstart" in window)
        document.getElementById("parfumButton").style.display = "block";
    if ("ontouchstart" in window)
        document.getElementById("joystickContainer").style.display = "block";
}

// ── Vote ──────────────────────────────────────────────────────────────────────

let selectedVote = null;

export function showVotePanel(playerList) {
    selectedVote = null;
    const list = document.getElementById("playerList");
    list.innerHTML = "";
    const btn = document.getElementById("voteBtn");
    btn.disabled = true; btn.textContent = "Envoyer"; btn.classList.remove("sent");

    playerList.forEach((p) => {
        if (p.id === state.localJoueur.id) return;
        const el = document.createElement("div");
        el.className = "player-option";
        el.innerHTML = `<div class="avatar">${(p.username ?? "?").slice(0, 2).toUpperCase()}</div><span class="p-name">${p.username ?? "?"}</span>`;
        el.addEventListener("click", () => {
            document.querySelectorAll(".player-option").forEach((o) => o.classList.remove("selected"));
            el.classList.add("selected");
            selectedVote = p.id;
            btn.disabled = false;
        });
        list.appendChild(el);
    });
    document.getElementById("votePanel").style.display = "flex";
}

export function hideVotePanel() {
    document.getElementById("votePanel").style.display = "none";
}

export function submitVote() {
    if (!selectedVote) return;
    socket.send(JSON.stringify({ type: "vote", vote: selectedVote }));
    const btn = document.getElementById("voteBtn");
    btn.textContent = "Voté ✓"; btn.classList.add("sent"); btn.disabled = true;
    document.querySelectorAll(".player-option").forEach((o) => o.style.pointerEvents = "none");
}

export function displayExeco(tabExeco) {
    const noms = tabExeco.filter((id) => id !== "")
        .map((id) => { const p = state.players.find((p) => p.id === id); return p?.username ?? "?"; })
        .join(" et ");
    canvas.style.visibility = "hidden";
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;font-family:Arial,sans-serif;background:rgba(0,0,0,0.55);";
    overlay.innerHTML = `<p style="font-size:14px;color:#ccc;margin-bottom:8px;letter-spacing:0.05em;">ÉGALITÉ</p><p style="font-size:22px;color:white;font-weight:bold;">Personne n'est éliminé</p><p style="font-size:14px;color:#aaa;margin-top:10px;">Le vote était à égalité entre <strong style="color:white">${noms}</strong></p>`;
    document.body.appendChild(overlay);
    setTimeout(() => { overlay.remove(); canvas.style.visibility = "visible"; }, 3000);
}

export function displayKilledByVoteMessage(playerId) {
    const target = state.players.find((p) => p.id === playerId);
    const nom    = target?.username ?? "?";
    const estMoi = playerId === state.localJoueur.id;
    canvas.style.visibility = "hidden";
    const overlay = document.createElement("div");
    overlay.id = "voteKillOverlay";
    overlay.style.cssText = "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;font-family:Arial,sans-serif;background:rgba(0,0,0,0.55);";
    overlay.innerHTML = estMoi
        ? `<p style="font-size:14px;color:#ccc;margin-bottom:8px;letter-spacing:0.05em;">ÉLIMINÉ PAR VOTE</p><p style="font-size:22px;color:#ef5350;font-weight:bold;">Tu as été éliminé</p><p style="font-size:14px;color:#aaa;margin-top:10px;">Le village a voté contre toi</p>`
        : `<p style="font-size:14px;color:#ccc;margin-bottom:8px;letter-spacing:0.05em;">ÉLIMINÉ PAR VOTE</p><p style="font-size:22px;color:white;font-weight:bold;">${nom} a été éliminé</p><p style="font-size:14px;color:#aaa;margin-top:10px;">Le village a tranché</p>`;
    document.body.appendChild(overlay);
    overlay.dataset.timeout = setTimeout(() => {
        overlay.remove();
        canvas.style.visibility = "visible";
        if (estMoi) displayKilledMessage();
    }, 3000);
}

export function displayAubeToMatin() {
    canvas.style.visibility = "hidden";
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:200;background:#000;overflow:hidden;";
    const cvs = document.createElement("canvas");
    cvs.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
    cvs.width = window.innerWidth; cvs.height = window.innerHeight;
    overlay.appendChild(cvs);
    const msgBox = document.createElement("div");
    msgBox.style.cssText = "position:absolute;bottom:22%;width:100%;text-align:center;font-family:Arial,sans-serif;pointer-events:none;";
    msgBox.innerHTML = `<div id="_aubeBg" style="display:inline-block;background:rgba(0,0,0,0);padding:10px 32px;border-radius:8px;"><p id="_aubeMsg1" style="font-size:13px;color:rgba(255,210,80,0);letter-spacing:0.12em;margin:0;font-weight:bold;text-shadow:0 1px 8px #000;">UN NOUVEAU JOUR SE LÈVE</p><p id="_aubeMsg2" style="font-size:24px;color:rgba(255,255,255,0);font-weight:bold;margin:6px 0 0;text-shadow:0 2px 12px rgba(0,0,0,0.9);">Bonne chance...</p></div>`;
    overlay.appendChild(msgBox);
    document.body.appendChild(overlay);

    const c = cvs.getContext("2d");
    const W = cvs.width, H = cvs.height;
    const horizonY = H * 0.62;
    const DURATION = 3500;
    let startTime = null;

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function drawBuilding(progress) {
        const scale = Math.min(W, H) / 420;
        const bx = W * 0.5 - 110 * scale;
        const by = horizonY;
        const silAlpha = 0.55 + progress * 0.25;
        const silColor = `rgba(15,12,30,${silAlpha})`;
        c.save(); c.translate(bx, by);
        c.fillStyle = silColor;
        c.fillRect(0, -90*scale, 130*scale, 90*scale);
        c.fillRect(-40*scale, -55*scale, 44*scale, 55*scale);
        c.fillRect(-4*scale, -95*scale, 138*scale, 8*scale);
        c.fillStyle = `rgba(255,220,80,${progress * 0.7})`;
        for (let i = 0; i < 4; i++) {
            c.fillRect((10+i*28)*scale, -78*scale, 18*scale, 14*scale);
            c.fillRect((10+i*28)*scale, -54*scale, 18*scale, 14*scale);
        }
        c.fillStyle = silColor;
        c.beginPath(); c.arc(175*scale, -65*scale, 42*scale, 0, Math.PI*2); c.fill();
        c.save(); c.beginPath(); c.arc(175*scale, -65*scale, 42*scale, 0, Math.PI*2); c.clip();
        c.fillStyle = `rgba(100,180,255,${progress*0.25})`;
        c.fillRect(133*scale, -107*scale, 84*scale, 85*scale);
        c.strokeStyle = `rgba(150,210,255,${progress*0.3})`; c.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo((138+i*10)*scale, -107*scale); c.lineTo((138+i*10)*scale, -22*scale); c.stroke(); }
        c.restore();
        c.fillStyle = silColor;
        c.fillRect(128*scale, -85*scale, 10*scale, 85*scale);
        c.fillRect(213*scale, -45*scale, 55*scale, 45*scale);
        c.fillRect(265*scale, -30*scale, 30*scale, 30*scale);
        c.fillStyle = `rgba(10,30,10,${silAlpha})`;
        for (let i = 0; i < 8; i++) { c.beginPath(); c.arc((i*38-10)*scale, 0, (12+Math.sin(i*1.7)*4)*scale, Math.PI, 0); c.fill(); }
        c.restore();
    }

    function drawFrame(progress) {
        c.clearRect(0, 0, W, H);
        c.fillStyle = `rgb(${Math.round(5+progress*240)},${Math.round(5+progress*145)},${Math.round(20+progress*200)})`;
        c.fillRect(0, 0, W, H);
        c.save(); c.globalAlpha = progress * 0.6;
        c.fillStyle = `rgb(255,${Math.round(120+progress*80)},50)`;
        c.fillRect(0, horizonY - H*0.18, W, H*0.18); c.restore();
        c.fillStyle = `rgb(${Math.round(8+progress*20)},${Math.round(12+progress*30)},${Math.round(8+progress*15)})`;
        c.fillRect(0, horizonY, W, H - horizonY);
        const sunR = Math.min(W, H) * 0.07;
        const sunX = W * 0.72;
        const sunY = (horizonY + sunR*1.5) + ((horizonY - sunR*0.5) - (horizonY + sunR*1.5)) * easeOut(progress);
        c.beginPath(); c.arc(sunX, sunY, sunR*(2.5+progress), 0, Math.PI*2);
        c.fillStyle = `rgba(255,170,40,${progress*0.28})`; c.fill();
        c.save(); c.translate(sunX, sunY); c.globalAlpha = progress * 0.55;
        for (let i = 0; i < 12; i++) {
            const angle = (i/12)*Math.PI*2 + progress*0.3;
            c.beginPath(); c.moveTo(Math.cos(angle)*(sunR+3), Math.sin(angle)*(sunR+3));
            c.lineTo(Math.cos(angle)*(sunR+sunR*1.5), Math.sin(angle)*(sunR+sunR*1.5));
            c.strokeStyle = "rgba(255,220,80,0.8)"; c.lineWidth = 2; c.stroke();
        }
        c.restore(); c.globalAlpha = 1;
        c.beginPath(); c.arc(sunX, sunY, sunR, 0, Math.PI*2);
        c.fillStyle = `rgb(255,${Math.round(190+progress*50)},${Math.round(40+progress*120)})`; c.fill();
        c.save(); c.beginPath(); c.rect(0, horizonY, W, H-horizonY); c.clip();
        c.beginPath(); c.arc(sunX, sunY, sunR, 0, Math.PI*2);
        c.fillStyle = `rgb(${Math.round(8+progress*20)},${Math.round(12+progress*30)},${Math.round(8+progress*15)})`; c.fill(); c.restore();
        c.strokeStyle = `rgba(255,200,80,${Math.min(1,progress*3)*0.4})`; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(0, horizonY); c.lineTo(W, horizonY); c.stroke();
        drawBuilding(progress);
        const m1 = document.getElementById("_aubeMsg1");
        const m2 = document.getElementById("_aubeMsg2");
        const bg  = document.getElementById("_aubeBg");
        if (progress > 0.35) { const a = Math.min(1,(progress-0.35)/0.3); if(m1) m1.style.color=`rgba(255,210,80,${a})`; if(bg) bg.style.background=`rgba(0,0,0,${a*0.5})`; }
        if (progress > 0.60) { const a = Math.min(1,(progress-0.60)/0.3); if(m2) m2.style.color=`rgba(255,255,255,${a})`; }
    }

    function animate(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / DURATION, 1);
        drawFrame(progress);
        if (progress < 1) requestAnimationFrame(animate);
        else setTimeout(() => { overlay.remove(); canvas.style.visibility = "visible"; }, 600);
    }
    requestAnimationFrame(animate);
}

export function displayAfternoonToNight() {
    canvas.style.visibility = "hidden";
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:200;background:#000;overflow:hidden;";
    const cvs = document.createElement("canvas");
    cvs.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
    cvs.width = window.innerWidth; cvs.height = window.innerHeight;
    overlay.appendChild(cvs);

    const msgBox = document.createElement("div");
    msgBox.style.cssText = "position:absolute;bottom:22%;width:100%;text-align:center;font-family:Arial,sans-serif;pointer-events:none;";
    msgBox.innerHTML = `<div id="_nuitBg" style="display:inline-block;background:rgba(0,0,0,0);padding:10px 32px;border-radius:8px;"><p id="_nuitMsg1" style="font-size:13px;color:rgba(180,180,255,0);letter-spacing:0.12em;margin:0;font-weight:bold;text-shadow:0 1px 8px #000;">LA NUIT TOMBE SUR LE VILLAGE</p></div>`;
    overlay.appendChild(msgBox);
    document.body.appendChild(overlay);

    const c = cvs.getContext("2d");
    const W = cvs.width, H = cvs.height;
    const horizonY = H * 0.62;
    const DURATION = 3500;
    let startTime = null;

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function drawBuilding(progress) {
        const scale = Math.min(W, H) / 420;
        const bx = W * 0.5 - 110 * scale;
        const by = horizonY;
        const silAlpha = 0.6 + progress * 0.3;
        const silColor = `rgba(8,6,20,${silAlpha})`;
        c.save(); c.translate(bx, by);
        c.fillStyle = silColor;
        c.fillRect(0, -90*scale, 130*scale, 90*scale);
        c.fillRect(-40*scale, -55*scale, 44*scale, 55*scale);
        c.fillRect(-4*scale, -95*scale, 138*scale, 8*scale);
        c.fillStyle = `rgba(255,200,80,${progress * 0.85})`;
        for (let i = 0; i < 4; i++) {
            c.fillRect((10+i*28)*scale, -78*scale, 18*scale, 14*scale);
            c.fillRect((10+i*28)*scale, -54*scale, 18*scale, 14*scale);
        }
        c.fillStyle = silColor;
        c.beginPath(); c.arc(175*scale, -65*scale, 42*scale, 0, Math.PI*2); c.fill();
        c.fillRect(128*scale, -85*scale, 10*scale, 85*scale);
        c.fillRect(213*scale, -45*scale, 55*scale, 45*scale);
        c.fillRect(265*scale, -30*scale, 30*scale, 30*scale);
        c.fillStyle = `rgba(5,18,8,${silAlpha})`;
        for (let i = 0; i < 8; i++) { c.beginPath(); c.arc((i*38-10)*scale, 0, (12+Math.sin(i*1.7)*4)*scale, Math.PI, 0); c.fill(); }
        c.restore();
    }

    function drawStars(progress) {
        const count = 60;
        for (let i = 0; i < count; i++) {
            const px = ((i * 137.508 + 42) % W);
            const py = ((i * 93.731 + 17) % (horizonY * 0.9));
            const blink = Math.abs(Math.sin(i * 2.3 + Date.now() * 0.001));
            const alpha = progress * blink * 0.9;
            if (alpha < 0.05) continue;
            c.beginPath();
            c.arc(px, py, 0.8 + (i % 3) * 0.5, 0, Math.PI * 2);
            c.fillStyle = `rgba(200,210,255,${alpha})`;
            c.fill();
        }
    }

    function drawFrame(progress) {
        c.clearRect(0, 0, W, H);
        const r = Math.round(100 - progress * 95);
        const g = Math.round(140 - progress * 130);
        const b = Math.round(200 - progress * 160);
        c.fillStyle = `rgb(${r},${g},${b})`;
        c.fillRect(0, 0, W, H);
        c.save(); c.globalAlpha = 1 - progress * 0.8;
        c.fillStyle = `rgb(${Math.round(220 - progress*200)},${Math.round(100 - progress*90)},40)`;
        c.fillRect(0, horizonY - H*0.12, W, H*0.12); c.restore();
        c.fillStyle = `rgb(${Math.round(15 - progress*5)},${Math.round(25 - progress*10)},${Math.round(12 - progress*4)})`;
        c.fillRect(0, horizonY, W, H - horizonY);
        const moonR = Math.min(W, H) * 0.055;
        const moonX = W * 0.28;
        const moonStartY = horizonY + moonR * 1.5;
        const moonEndY   = horizonY * 0.25;
        const moonY = moonStartY + (moonEndY - moonStartY) * easeOut(progress);
        c.beginPath(); c.arc(moonX, moonY, moonR * (2.5 + progress * 0.5), 0, Math.PI*2);
        c.fillStyle = `rgba(180,190,255,${progress * 0.18})`; c.fill();
        c.beginPath(); c.arc(moonX, moonY, moonR, 0, Math.PI*2);
        c.fillStyle = `rgba(230,235,255,${Math.min(1, progress * 1.5)})`; c.fill();
        c.save(); c.beginPath(); c.rect(0, horizonY, W, H - horizonY); c.clip();
        c.beginPath(); c.arc(moonX, moonY, moonR, 0, Math.PI*2);
        c.fillStyle = `rgb(${Math.round(15 - progress*5)},${Math.round(25 - progress*10)},${Math.round(12 - progress*4)})`; c.fill();
        c.restore();
        drawStars(progress);
        drawBuilding(progress);
        c.strokeStyle = `rgba(100,100,180,${Math.min(1, progress*3)*0.3})`; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(0, horizonY); c.lineTo(W, horizonY); c.stroke();
        const m1 = document.getElementById("_nuitMsg1");
        const bg  = document.getElementById("_nuitBg");
        if (progress > 0.35) { const a = Math.min(1,(progress-0.35)/0.3); if(m1) m1.style.color=`rgba(180,180,255,${a})`; if(bg) bg.style.background=`rgba(0,0,0,${a*0.5})`; }
    }

    function animate(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / DURATION, 1);
        drawFrame(progress);
        if (progress < 1) requestAnimationFrame(animate);
        else setTimeout(() => { overlay.remove(); canvas.style.visibility = "visible"; }, 600);
    }
    requestAnimationFrame(animate);
}

export function displayParfume(ctx, x, y) {
    const now = Date.now();
    const particles = [
        { offset: 0,    phase: 0   },
        { offset: 800,  phase: 2.1 },
        { offset: 1600, phase: 4.2 },
    ];
    particles.forEach(({ offset, phase }) => {
        const t = ((now + offset) % 2400) / 2400;
        const py = (y - 32) - t * 48;
        const px = x + Math.sin(t * Math.PI * 2 + phase) * 6;
        const alpha = t < 0.3 ? t / 0.3 : (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
        const radius = 10 + t * 3;
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        grad.addColorStop(0, "rgba(255, 60, 154, 1)");
        grad.addColorStop(1, "rgba(255, 100, 180, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });
}

// ── Panneau Avatar ────────────────────────────────────────────────────────────

const AVATAR_LABELS = {
    innocent:    "Default",
    policeman:   "Policier",
    parasolLady: "Dame au parasol",
    baby:        "Bébé",
    vieu:        "Vieux",
    giovanni:    "Giovanni",
    clown:       "Clown",
};

let avatarPanelIndex = 0;
let avatarPanelEl    = null;
let avatarCanvasEl   = null;

export function showAvatarPanel() {
    // Désactivé pour les admins
    if (state.isAdmin) return;
    if (avatarPanelEl) return;

    const currentIdx = AVATARS.indexOf(state.localAvatar);
    avatarPanelIndex = currentIdx >= 0 ? currentIdx : 0;

    avatarPanelEl = document.createElement("div");
    avatarPanelEl.id = "avatarPanel";
    avatarPanelEl.style.cssText = [
        "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);",
        "background:rgba(255,255,255,0.96);border-radius:14px;",
        "padding:24px 28px;display:flex;flex-direction:column;align-items:center;",
        "gap:14px;font-family:Arial,sans-serif;z-index:500;",
        "box-shadow:0 8px 32px rgba(0,0,0,0.25);min-width:220px;",
    ].join("");

    const title = document.createElement("p");
    title.textContent = "Choisir un avatar";
    title.style.cssText = "font-weight:bold;font-size:15px;margin:0;color:#222;";

    avatarCanvasEl = document.createElement("canvas");
    avatarCanvasEl.width  = 64;
    avatarCanvasEl.height = 64;
    avatarCanvasEl.style.cssText = "image-rendering:pixelated;width:96px;height:96px;border-radius:8px;background:#f0f0f0;border:2px solid #ddd;";

    const nameEl = document.createElement("p");
    nameEl.id = "avatarName";
    nameEl.style.cssText = "font-size:13px;color:#555;margin:0;";

    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:14px;";

    const btnLeft  = document.createElement("button");
    btnLeft.textContent  = "◀";
    btnLeft.style.cssText = "font-size:20px;background:none;border:none;cursor:pointer;color:#333;padding:4px 8px;margin:0;";

    const btnRight = document.createElement("button");
    btnRight.textContent = "▶";
    btnRight.style.cssText = "font-size:20px;background:none;border:none;cursor:pointer;color:#333;padding:4px 8px;margin:0;";

    btnLeft.addEventListener("click",  () => { avatarPanelIndex = (avatarPanelIndex - 1 + AVATARS.length) % AVATARS.length; renderAvatarPreview(nameEl); });
    btnRight.addEventListener("click", () => { avatarPanelIndex = (avatarPanelIndex + 1) % AVATARS.length; renderAvatarPreview(nameEl); });

    row.append(btnLeft, avatarCanvasEl, btnRight);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:10px;";

    const btnConfirm = document.createElement("button");
    btnConfirm.textContent = "Confirmer";
    btnConfirm.style.cssText = "background:#4CAF50;color:white;border:none;padding:8px 18px;border-radius:7px;cursor:pointer;font-size:14px;margin:0;";

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Annuler";
    btnCancel.style.cssText = "background:#e0e0e0;color:#333;border:none;padding:8px 18px;border-radius:7px;cursor:pointer;font-size:14px;margin:0;";

    btnConfirm.addEventListener("click", () => {
        const chosen = AVATARS[avatarPanelIndex];
        state.setLocalAvatar(chosen);
        socket.send(JSON.stringify({ type: "setAvatar", avatar: chosen }));
        closeAvatarPanel();
    });
    btnCancel.addEventListener("click", closeAvatarPanel);

    btnRow.append(btnConfirm, btnCancel);
    avatarPanelEl.append(title, row, nameEl, btnRow);
    document.body.appendChild(avatarPanelEl);
    renderAvatarPreview(nameEl);
}

function renderAvatarPreview(nameEl) {
    const key = AVATARS[avatarPanelIndex];
    nameEl.textContent = AVATAR_LABELS[key] ?? key;
    const ctx2 = avatarCanvasEl.getContext("2d");
    ctx2.clearRect(0, 0, 64, 64);
    const img = images[key];
    if (img && img.complete && img.naturalWidth > 0) {
        ctx2.drawImage(img, 0, 0, 64, 64, 0, 0, 64, 64);
    } else {
        ctx2.fillStyle = "#ccc"; ctx2.fillRect(0, 0, 64, 64);
        ctx2.fillStyle = "#888"; ctx2.font = "11px Arial";
        ctx2.textAlign = "center"; ctx2.fillText("?", 32, 36);
    }
}

function closeAvatarPanel() {
    if (avatarPanelEl) { avatarPanelEl.remove(); avatarPanelEl = null; }
}

// ── Mode Spectateur ───────────────────────────────────────────────────────────

export function displaySpectatorMessage() {
    canvas.style.visibility = "hidden";
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.82);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial,sans-serif;";
    overlay.innerHTML = `
        <p style="font-size:14px;color:#aaa;letter-spacing:0.15em;margin:0;font-weight:bold;">VOUS ÊTES MORT</p>
        <p style="font-size:36px;color:white;font-weight:bold;margin:10px 0;">👻 Mode Spectateur</p>
        <p style="font-size:16px;color:#ccc;margin:0;">Vous pouvez maintenant observer la partie librement.</p>
        <p style="font-size:13px;color:#888;margin-top:8px;">Vous êtes invisible pour les joueurs vivants.</p>
    `;
    document.body.appendChild(overlay);

    const badge = document.createElement("div");
    badge.id = "spectatorBadge";
    badge.style.cssText = "position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.65);color:#aaa;font-family:Arial,sans-serif;font-size:13px;padding:6px 14px;border-radius:20px;border:1px solid #555;z-index:999;pointer-events:none;";
    badge.textContent = "👻 Spectateur";
    document.body.appendChild(badge);

    setTimeout(() => {
        overlay.remove();
        canvas.style.visibility = "visible";
    }, 3000);
}

// ── Panneau Admin ─────────────────────────────────────────────────────────────

let adminPanelEl       = null;
let adminListEl        = null;
let adminSelectedId    = null;
let adminSelectedDead  = false;

export function showAdminPanel() {
    if (adminPanelEl) return;

    // Badge admin permanent
    const badge = document.createElement("div");
    badge.style.cssText = "position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.75);color:#ffcc00;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;padding:6px 14px;border-radius:20px;border:1px solid #ffcc0066;z-index:999;pointer-events:none;";
    badge.textContent = "👑 Admin";
    document.body.appendChild(badge);

    adminPanelEl = document.createElement("div");
    adminPanelEl.id = "adminPanel";
    adminPanelEl.style.cssText = [
        "position:fixed;left:12px;top:50%;transform:translateY(-50%);",
        "width:175px;background:rgba(255,255,255,0.95);",
        "border:1px solid rgba(0,0,0,0.15);border-radius:10px;",
        "padding:10px 8px;display:flex;flex-direction:column;gap:6px;",
        "font-family:Arial,sans-serif;z-index:500;",
        "box-shadow:0 4px 20px rgba(0,0,0,0.2);",
    ].join("");

    const header = document.createElement("p");
    header.style.cssText = "font-size:11px;color:#888;text-align:center;margin:0;font-weight:bold;letter-spacing:0.05em;";
    header.textContent = "👑 PANNEAU ADMIN";

    adminListEl = document.createElement("div");
    adminListEl.style.cssText = "display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto;";

    // Boutons d'action
    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:6px;margin-top:4px;";

    const btnKill = document.createElement("button");
    btnKill.id = "adminBtnKill";
    btnKill.textContent = "⚔️ Tuer";
    btnKill.style.cssText = "flex:1;padding:5px 0;border-radius:6px;border:1px solid #fca5a5;background:#fee2e2;color:#b91c1c;font-size:12px;cursor:pointer;margin:0;";
    btnKill.disabled = true;

    const btnKick = document.createElement("button");
    btnKick.id = "adminBtnKick";
    btnKick.textContent = "🚪 Kick";
    btnKick.style.cssText = "flex:1;padding:5px 0;border-radius:6px;border:1px solid #ccc;background:white;color:#555;font-size:12px;cursor:pointer;margin:0;";
    btnKick.disabled = true;

    btnKill.addEventListener("click", () => {
        if (!adminSelectedId || adminSelectedDead) return;
        socket.send(JSON.stringify({ type: "adminKill", targetId: adminSelectedId }));
        adminSelectedId = null;
        adminSelectedDead = false;
        btnKill.disabled = true;
        btnKick.disabled = true;
        document.querySelectorAll("#adminPanel .admin-player-option")
            .forEach((o) => o.classList.remove("selected"));
    });

    btnKick.addEventListener("click", () => {
        if (!adminSelectedId) return;
        socket.send(JSON.stringify({ type: "adminKick", targetId: adminSelectedId }));
        adminSelectedId = null;
        adminSelectedDead = false;
        btnKill.disabled = true;
        btnKick.disabled = true;
        document.querySelectorAll("#adminPanel .admin-player-option")
            .forEach((o) => o.classList.remove("selected"));
    });

    btnRow.append(btnKill, btnKick);
    adminPanelEl.append(header, adminListEl, btnRow);
    document.body.appendChild(adminPanelEl);
}

/**
 * Met à jour la liste des joueurs dans le panneau admin.
 * Appelé à chaque message "update" reçu du serveur quand isAdmin=true.
 */
export function updateAdminPanel(players) {
    if (!adminListEl) return;

    // Conserver la sélection courante
    const prevSelected = adminSelectedId;

    adminListEl.innerHTML = "";
    adminSelectedId    = null;
    adminSelectedDead  = false;

    players
        .filter((p) => {
            // Ne pas lister l'admin lui-même
            return !(state.localJoueur && p.id === state.localJoueur.id);
        })
        .sort((a, b) => {
            // Vivants d'abord, morts ensuite, admins à la fin
            if (a.isAdmin !== b.isAdmin) return a.isAdmin ? 1 : -1;
            if (a.dead !== b.dead) return a.dead ? 1 : -1;
            return (a.username ?? "").localeCompare(b.username ?? "");
        })
        .forEach((p) => {
            const el = document.createElement("div");
            el.className = "admin-player-option";

            let statusIcon = "🟢"; // vivant
            let nameColor  = "#333";
            if (p.isAdmin)  { statusIcon = "👑"; nameColor = "#b45309"; }
            else if (p.dead){ statusIcon = "👻"; nameColor = "#999"; }

            el.style.cssText = [
                "display:flex;align-items:center;gap:6px;",
                "padding:5px 7px;border-radius:6px;",
                "border:1px solid transparent;cursor:pointer;",
                `background:${p.isAdmin ? "#fefce8" : "#f5f5f5"};`,
            ].join("");

            el.innerHTML = `<span style="font-size:13px;pointer-events:none;">${statusIcon}</span><span style="font-size:12px;color:${nameColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;">${p.username ?? "?"}</span>`;

            // Un autre admin n'est pas sélectionnable
            if (!p.isAdmin) {
                el.addEventListener("click", () => {
                    document.querySelectorAll("#adminPanel .admin-player-option")
                        .forEach((o) => o.classList.remove("selected"));
                    el.classList.add("selected");
                    el.style.borderColor = "#a0c4e8";
                    el.style.background  = "#eaf3fb";

                    adminSelectedId   = p.id;
                    adminSelectedDead = p.dead;

                    const btnKill = document.getElementById("adminBtnKill");
                    const btnKick = document.getElementById("adminBtnKick");

                    // Kill désactivé si la cible est déjà morte (spectateur) ou si pas en jeu
                    btnKill.disabled = p.dead || adminSelectedId === null;
                    btnKick.disabled = false;
                });
            }

            // Restaurer la sélection précédente
            if (p.id === prevSelected && !p.isAdmin) {
                adminSelectedId   = p.id;
                adminSelectedDead = p.dead;
                el.classList.add("selected");
                el.style.borderColor = "#a0c4e8";
                el.style.background  = "#eaf3fb";
                const btnKill = document.getElementById("adminBtnKill");
                const btnKick = document.getElementById("adminBtnKick");
                if (btnKill) btnKill.disabled = p.dead;
                if (btnKick) btnKick.disabled = false;
            }

            adminListEl.appendChild(el);
        });
}