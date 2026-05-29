import { canvas } from "../render/renderer.js";
import { localJoueur, setPendingUsername } from "../core/state.js";

export function displayKilledMessage() {
    localJoueur.died = true;
    canvas.style.display = "none";
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;font-weight:bold;color:red;";
    el.innerHTML = "You have beeeeeeen killed <br><br> <a href='javascript:void(0);' onclick='window.location.reload();'>Play again</a>";
    document.body.appendChild(el);
}

export function displayGameEndMessage(result) {
    canvas.style.display = "none";
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1000;font-family:Arial,sans-serif;";

    const title    = document.createElement("h1");
    const subtitle = document.createElement("p");
    const countdown = document.createElement("p");
    title.style.cssText    = "font-size:48px;margin-bottom:16px;";
    subtitle.style.cssText = "font-size:22px;color:#ccc;margin-bottom:32px;";
    countdown.style.cssText = "font-size:16px;color:#888;";

    if (result === "vicInno") {
        title.style.color  = "#4fc3f7";
        title.textContent  = "🏆 Les innocents ont gagné !";
        subtitle.textContent = "L'assassin a été éliminé.";
    } else {
        title.style.color  = "#ef5350";
        title.textContent  = "💀 L'assassin a gagné !";
        subtitle.textContent = "Les innocents ont été éliminés.";
    }

    overlay.append(title, subtitle, countdown);
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

    setPendingUsername(data.username);
    if (localJoueur) localJoueur.username = data.username;

    const label = document.createElement("div");
    label.style.cssText = "position:fixed;top:10px;left:10px;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#0c0606;background:rgba(255,255,255,0.5);padding:6px 12px;border-radius:5px;border:2px solid #0c0606;z-index:999;";
    label.textContent = `👤 ${data.username}`;
    document.body.appendChild(label);
}

export function setJoueurAttributes(localJoueurRef, role) {
    if (!localJoueurRef) return;
    localJoueurRef.type  = role;
    localJoueurRef.speed = 8;
    if (role === "assassin" && "ontouchstart" in window) {
        document.getElementById("killButton").style.display = "block";
    }
    if ("ontouchstart" in window) {
        document.getElementById("joystickContainer").style.display = "block";
    }
}