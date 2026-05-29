import { canvas } from "../render/renderer.js";
import * as state from "../core/state.js";
import { socket } from "../net/socket.js";

export function displayKilledMessage() {
    state.localJoueur.died = true;
    canvas.style.display = "none";
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;font-weight:bold;color:red;";
    el.innerHTML = "You have beeeeeeen killed <br><br> <a href='javascript:void(0);' onclick='window.location.reload();'>Play again</a>";
    document.body.appendChild(el);
}

export function displayGameEndMessage(result) {
    const voteOverlay = document.getElementById("voteKillOverlay");
    if (voteOverlay) { clearTimeout(parseInt(voteOverlay.dataset.timeout)); voteOverlay.remove(); }

    canvas.style.visibility = "visible";
    canvas.style.display = "none";

    const roleLabel = { assassin: "Assassin", innocent: "Innocent", petitefille: "Petite fille" };
    const roleColor = { assassin: "#ef5350", innocent: "#4fc3f7", petitefille: "#ce93d8" };

    const winners = state.players.filter((p) => {
        if (result === "vicInno")   return p.type === "innocent" || p.type === "petitefille";
        if (result === "vicPsyco")  return p.type === "assassin";
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
        if (secondes <= 0) { clearInterval(timer); window.location.reload(); }
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
    const res = await fetch(`https://${location.hostname}:3000/verify`, { credentials: "include" });
    if (!res.ok) { window.location.href = "/login.html"; return; }
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