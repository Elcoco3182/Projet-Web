const socket = new WebSocket(`wss://${location.hostname}:3000/ws`);
let canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let canvasNight = document.createElement("canvas");
const ctxNight = canvasNight.getContext("2d");

const WORLD_VIEW_WIDTH = 800;   // tous les joueurs voient toujours 800px de carte
const WORLD_VIEW_HEIGHT = 600;  // et 600px de carte, peu importe l'écran

let mapWidth, mapHeight;

let players = [];
let obstacles = [];
let localJoueur = null;

// des booleans pour savoir à quel moment du cycle jour nuit on est
let isMorning = false;
let isNoon = false;
let isAfternoon = false;
let isNight = false;
let isMidnight = false;
let isDawn = false;

let isReady = false;
let rejected = false;

let cameraZoom = 1;

let lastTime = 0;
let animationTime = 1;

let sy = 0;

canvas.width = window.innerWidth - 30;
canvas.height = window.innerHeight - 30;

canvasNight.width = canvas.width;
canvasNight.height = canvas.height;

let viewportWidth = canvas.width;
let viewportHeight = canvas.height;

let images = {};

let pendingUsername = null;
document.getElementById("dayTime").style.visibility = "hidden";

// Affiche que la connexion (ws) est en train de se faire
const submitBtn = document.querySelector("#joueurTypeForm button");
if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Connexion...";
}

class Joueur {
    constructor(x, y) {
        this.id = 0;
        this.x = x;
        this.y = y;
        this.died = false;
        this.speed = 8; 
    }

    moveUp(dt) {
        const newY = this.y - this.speed * dt * 60;
        if (!collidesWithObstacle(this.x, newY, 40, 40) &&
            newY >= 20) {
            this.y = newY;
        }
    }

    moveDown(dt) {
        const newY = this.y + this.speed * dt * 60;
        if (!collidesWithObstacle(this.x, newY, 40, 40) &&
            newY <= mapHeight - 20) {
            this.y = newY;
        }
    }

    moveLeft(dt) {
        const newX = this.x - this.speed * dt * 60;
        if (!collidesWithObstacle(newX, this.y, 40, 40) &&
            newX >= 20) {
            this.x = newX;
        }
    }

    moveRight(dt) {
        const newX = this.x + this.speed * dt * 60;
        if (!collidesWithObstacle(newX, this.y, 40, 40) &&
            newX <= mapWidth - 20) {
            this.x = newX;
        }
    }

// regarde si c la nuit
    canKill() {
        return isMidnight && (localJoueur.type==="assassin");
    }
    tryKill() {
        // Cherche un joueur proche dans la liste reçue du serveur
        const target = players.find(p => {
            if (p.id === localJoueur.id) return false;
            const dx = p.x - localJoueur.x;
            const dy = p.y - localJoueur.y;
            return (Math.sqrt(dx*dx + dy*dy) < 80); // portée de 50px
        });

        if (target && this.canKill()) {
            socket.send(JSON.stringify({type: "killFromAssassin", targetId: target.id}));
        }
    }
}

setInterval (() => {
  misAjourAnimationTime();
}, 500)

displayUsername();

// Input joystick
let joystickInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  killBoutton: false,
};

// Input handling
let keys = {
    ArrowUp: false,
    ArrowRight: false,
    ArrowLeft: false,
    ArrowDown: false,
    Spacebar: false,
};

document.addEventListener("keydown", (e) => {
  if (!localJoueur) return;

  if (keys.hasOwnProperty(e.key)) {
    keys[e.key] = true;
  }

  if (e.key === " ") {
    keys["Spacebar"] = true;
  }
});

document.addEventListener("keyup", (e) => {
  if (keys.hasOwnProperty(e.key)) {
    keys[e.key] = false;
  }

  if (e.key === " ") {
    keys["Spacebar"] = false;
  }
});

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
        case "update":
          players = data.players;
          obstacles = data.obstacles;
          break;
        case "lobbyUpdate":
          document.getElementById("lobbyCount").innerText =
            `${data.nbReady}/${data.total} joueurs prêts (min. 3)`;
          break;
        case "killed":
          if (data.playerId === localJoueur.id) {
            displayKilledMessage();
          }
          break;
        case "playerId":
          localJoueur = new Joueur(data.startX, data.startY);
          localJoueur.id = data.playerId;
          if (pendingUsername) localJoueur.username = pendingUsername;
          break;
        case "mapSize":
          mapWidth = data.width;
          mapHeight = data.height;
          break;
        case "isMorning":
          isDawn = false;
          isMorning = true;
          break;
        case "isNoon":
          isMorning = false;
          isNoon = true;
          document.getElementById("skipBtn").style.display = "block";
          showVotePanel(players);
          break;
        case "noonSpawn":
          localJoueur.x = data.x;
          localJoueur.y = data.y;
          break;
        case "isAfternoon":
          isNoon = false;
          document.getElementById("skipBtn").style.display = "none";
          isAfternoon = true;
          hideVotePanel();
          break;
        case "isNight":
          isAfternoon = false;
          isNight = true;
          break;
        case "isMidnight":
          isNight = false;
          isMidnight = true;
          break;
        case "isDawn":
          isMidnight = false;
          isDawn = true;
          break;
        case "gameStart":
          setJoueurAttributes(data.role);
          if (data.startX !== undefined && data.startY !== undefined) {
            localJoueur.x = data.startX;
            localJoueur.y = data.startY;
          }
          document.getElementById("readyBtn").style.display = "none";
          document.getElementById("lobbyCount").style.display = "none";
          document.getElementById("dayTime").style.visibility = "visible";
          break;
        case "rejected":
          document.getElementById("popup").style.display = "none";
          document.getElementById("lobbyCount").style.display = "none";
          rejected = true;
          break;
        case "gameEnd":
          displayGameEndMessage(data.result);
          break;
        case "vote":
          if (data.draw) {
            displayExeco(data.tabExeco);
          } else {
            displayKilledByVoteMessage(data.player);
          }
          break;
    }
};

updateZoom();

socket.onopen = () => {
    preloadImages(() => {
      gameLoop();
  });
};

function update() {
    let direction;
    if (keys.ArrowDown === true) direction = "down";
    if (keys.ArrowUp === true) direction = "up";
    if (keys.ArrowRight === true) direction = "right";
    if (keys.ArrowLeft === true) direction = "left";
    let data = {
        type: "update",
        x: localJoueur.x,
        y: localJoueur.y,
        d: direction,
    };
    socket.send(JSON.stringify(data));
}

function draw() {
  document.getElementById("dayTime").innerText = getCurrentDayTime();

  // Calcul du centrage (nécessaire partout dans draw)
  const renderOffsetX = (viewportWidth - WORLD_VIEW_WIDTH * cameraZoom) / 2;
  const renderOffsetY = (viewportHeight - WORLD_VIEW_HEIGHT * cameraZoom) / 2;

  // Reset transform
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  // Fond gris uniquement dans la zone de jeu
  ctx.fillStyle = "gray";
  ctx.fillRect(renderOffsetX, renderOffsetY, WORLD_VIEW_WIDTH * cameraZoom, WORLD_VIEW_HEIGHT * cameraZoom);

  const currentPlayer = players.find((player) => player.id === localJoueur.id);
  if (!currentPlayer) return;

  const offsetX = Math.min(
    Math.max(currentPlayer.x - WORLD_VIEW_WIDTH / 2, 0),
    Math.max(mapWidth - WORLD_VIEW_WIDTH, 0)
  );
  const offsetY = Math.min(
    Math.max(currentPlayer.y - WORLD_VIEW_HEIGHT / 2, 0),
    Math.max(mapHeight - WORLD_VIEW_HEIGHT, 0)
  );

  const screenX = (currentPlayer.x - offsetX) * cameraZoom + renderOffsetX;
  const screenY = (currentPlayer.y - offsetY) * cameraZoom + renderOffsetY;

  ctx.save();
  ctx.translate(renderOffsetX, renderOffsetY);
  ctx.beginPath();
  ctx.rect(0, 0, WORLD_VIEW_WIDTH * cameraZoom, WORLD_VIEW_HEIGHT * cameraZoom);
  ctx.clip();
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-offsetX, -offsetY);



  obstacles.forEach((obstacle) => {
    drawObstacle(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  });
  drawMap();
  players.forEach((player) => {
    drawJoueurImage(player.x, player.y, player);
  });

  ctx.restore();

  drawBorder();

  if (isNight || isMidnight || isDawn) {
    applyNightMask(ctxNight, screenX, screenY, 150 * cameraZoom);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clip sur la zone de jeu uniquement
    ctx.beginPath();
    ctx.rect(renderOffsetX, renderOffsetY, WORLD_VIEW_WIDTH * cameraZoom, WORLD_VIEW_HEIGHT * cameraZoom);
    ctx.clip();

    ctx.drawImage(canvasNight, 0, 0);
    ctx.restore();
  }
}

function preloadImages(callback) {
    const toLoad = ["assassin", "innocent", "petitefille", "mapImage"];
    let loaded = 0;

    toLoad.forEach(name => {
        images[name] = new Image();
        images[name].src = `/assets/images/${name}.png`;
        images[name].onload = () => {
            loaded++;
            if (loaded === toLoad.length) callback();
        };
    });
}


function drawJoueurImage(x, y, player) {
    let localSx = 0;
    let localSy = 0;

    if (localJoueur.id === player.id) {
      misAjourSourceY();       // met à jour sy global (direction)
      if (!isNoon) localSx = returnSourceX(); // frame d'animation
      localSy = sy;              // direction courante
    }
    else {
      switch (player.d){
        case "down":
          localSy = 0;
          break;
        case "right":
          localSy = 128;
          break;
        case "left":
          localSy = 64;
          break;
        case "up":
          localSy = 192;
          break;
      }
    }


    ctx.save();

    if (isMidnight){
        switch (player.type) {
        case "assassin":
            ctx.drawImage(images["assassin"],localSx, localSy, 64, 64, x-32, y-32, 64, 64);
            break;
        case "petitefille":
            ctx.drawImage(images["petitefille"],localSx, localSy, 64, 64, x-32, y-32, 64, 64);
            break;
        default:
            ctx.drawImage(images["innocent"],localSx, localSy, 64, 64, x-32, y-32, 64, 64);
        }
    } else if (isDawn) {
        // pour l'instant pas de difference avec isMidnight car on a pas encore de rôle non actif à l'aube
        switch (player.type) {
        case "assassin":
            ctx.drawImage(images["assassin"],localSx, localSy, 64, 64, x-32, y-32, 64, 64);
            break;
        case "petitefille":
            ctx.drawImage(images["petitefille"],localSx, localSy, 64, 64, x-32, y-32, 64, 64);
            break;
        default:
            ctx.drawImage(images["innocent"],localSx, localSy, 64, 64, x-32, y-32, 64, 64);
        }
    } else {

      ctx.drawImage(images["innocent"],localSx, localSy, 64, 64, x-32, y-32, 64, 64);

      if (!isNight) {
        // ← Affichage du nom sous le joueur
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.fillText(player.username ?? "?", x, y + 42);
        ctx.fillStyle = "black";
        ctx.fillText(player.username ?? "?", x + 1, y + 43); // ombre portée pour lisibilité
      }
    }

    ctx.restore();
}

function drawMap() {
  ctx.save();
  ctx.drawImage(images["mapImage"],0, 0, 4000, 1550, 0, 0, 4000, 1550);
  ctx.restore();
}

function displayGameEndMessage(result) {
  const voteOverlay = document.getElementById("voteKillOverlay");
  if (voteOverlay) {
    clearTimeout(parseInt(voteOverlay.dataset.timeout));
    voteOverlay.remove();
  }

  canvas.style.visibility = "visible"; // remet visible avant de faire display:none
  canvas.style.display = "none";

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.85);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 1000; font-family: Arial, sans-serif;
  `;

  const title = document.createElement("h1");
  title.style.cssText = "font-size: 48px; margin-bottom: 16px;";

  const subtitle = document.createElement("p");
  subtitle.style.cssText = "font-size: 22px; color: #ccc; margin-bottom: 32px;";

  const countdown = document.createElement("p");
  countdown.style.cssText = "font-size: 16px; color: #888;";

  if (result === "vicInno") {
    title.style.color = "#4fc3f7";
    title.textContent = "🏆 Les innocents ont gagné !";
    subtitle.textContent = "L'assassin a été éliminé.";
  } else {
    title.style.color = "#ef5350";
    title.textContent = "💀 L'assassin a gagné !";
    subtitle.textContent = "Les innocents ont été éliminés.";
  }

  overlay.appendChild(title);
  overlay.appendChild(subtitle);
  overlay.appendChild(countdown);
  document.body.appendChild(overlay);

  // Compte à rebours de 5s puis retour au lobby
  let secondes = 5;
  countdown.textContent = `Retour au lobby dans ${secondes}s…`;
  const timer = setInterval(() => {
    secondes--;
    if (secondes <= 0) {
      clearInterval(timer);
      window.location.reload();
    } else {
      countdown.textContent = `Retour au lobby dans ${secondes}s…`;
    }
  }, 1000);
}

function displayExeco(tabExeco) {
  // Récupère les usernames depuis la liste players
  const noms = tabExeco
    .filter(id => id !== "")
    .map(id => {
      const p = players.find(p => p.id === id);
      return p?.username ?? "?";
    })
    .join(" et ");

  canvas.style.visibility = "hidden";

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 200; font-family: Arial, sans-serif;
    background: rgba(0,0,0,0.55);
  `;

  overlay.innerHTML = `
    <p style="font-size:14px; color:#ccc; margin-bottom:8px; letter-spacing:0.05em;">ÉGALITÉ</p>
    <p style="font-size:22px; color:white; font-weight:bold;">Personne n'est éliminé</p>
    <p style="font-size:14px; color:#aaa; margin-top:10px;">Le vote était à égalité entre <strong style="color:white">${noms}</strong></p>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.remove();
    canvas.style.visibility = "visible";
  }, 3000);
}

function displayKilledByVoteMessage(playerId) {
  const target = players.find(p => p.id === playerId);
  const nom = target?.username ?? "?";
  const estMoi = playerId === localJoueur.id;

  canvas.style.visibility = "hidden";

  const overlay = document.createElement("div");
  overlay.id = "voteKillOverlay";
  overlay.style.cssText = `
    position: fixed; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 200; font-family: Arial, sans-serif;
    background: rgba(0,0,0,0.55);
  `;

  if (estMoi) {
    overlay.innerHTML = `
      <p style="font-size:14px; color:#ccc; margin-bottom:8px; letter-spacing:0.05em;">ÉLIMINÉ PAR VOTE</p>
      <p style="font-size:22px; color:#ef5350; font-weight:bold;">Tu as été éliminé</p>
      <p style="font-size:14px; color:#aaa; margin-top:10px;">Le village a voté contre toi</p>
    `;
  } else {
    overlay.innerHTML = `
      <p style="font-size:14px; color:#ccc; margin-bottom:8px; letter-spacing:0.05em;">ÉLIMINÉ PAR VOTE</p>
      <p style="font-size:22px; color:white; font-weight:bold;">${nom} a été éliminé</p>
      <p style="font-size:14px; color:#aaa; margin-top:10px;">Le village a tranché</p>
    `;
  }

  document.body.appendChild(overlay);

  const timeout = setTimeout(() => {
    overlay.remove();
    canvas.style.visibility = "visible";
    if (estMoi) displayKilledMessage();
  }, 3000);

  // Stocke le timeout pour pouvoir l'annuler si gameEnd arrive avant
  overlay.dataset.timeout = timeout;
}

function misAjourSourceY() {
    if (keys.ArrowUp === true) sy = 192;
    if (keys.ArrowLeft === true) sy = 64;
    if (keys.ArrowRight === true) sy = 128;
    if (keys.ArrowDown === true) sy = 0;
}

function misAjourAnimationTime() {
  if (keys.ArrowDown === true || keys.ArrowRight === true || keys.ArrowLeft === true || keys.ArrowUp === true) {
    animationTime += 1;
    if (animationTime > 4) {
      animationTime = 1;
    }
  }
  else {
    animationTime = 1;
  }
}

function returnSourceX() {
  if (animationTime === 1) return 0;
  if (animationTime === 2) return 64;
  if (animationTime === 3) return 128;
  if (animationTime === 4) return 192;
}

function drawObstacle(x, y, width, height) {
  ctx.fillStyle = "brown";
  ctx.fillRect(x, y, width, height);
}

function collidesWithObstacle(x, y, width, height) {
  for (const obstacle of obstacles) {
    if (
      x + width / 2 > obstacle.x + 6 &&
      x - width / 2 < obstacle.x + obstacle.width - 6 &&
      y + height / 2 > obstacle.y - 6 &&
      y - height / 2 < obstacle.y + obstacle.height - 18
    ) {
      return true;
    }
  }
  return false;
}   

function drawBorder() {
  const renderOffsetX = (viewportWidth - WORLD_VIEW_WIDTH * cameraZoom) / 2;
  const renderOffsetY = (viewportHeight - WORLD_VIEW_HEIGHT * cameraZoom) / 2;
  const w = WORLD_VIEW_WIDTH * cameraZoom;
  const h = WORLD_VIEW_HEIGHT * cameraZoom;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "black";
  ctx.fillRect(renderOffsetX, renderOffsetY, w, 5);               // haut
  ctx.fillRect(renderOffsetX, renderOffsetY + h - 5, w, 5);       // bas
  ctx.fillRect(renderOffsetX + w - 5, renderOffsetY, 5, h);       // droite
  ctx.fillRect(renderOffsetX, renderOffsetY, 5, h);               // gauche
  ctx.restore();
}

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    const deltaTime = lastTime === 0 ? 0 : (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (localJoueur == null) return;
    if (localJoueur.died) return;
    if (socket.readyState !== WebSocket.OPEN) return;

    if (!isNoon) {
      if (keys.ArrowUp    || joystickInput.up)          localJoueur.moveUp(deltaTime);
      if (keys.ArrowDown  || joystickInput.down)        localJoueur.moveDown(deltaTime);
      if (keys.ArrowLeft  || joystickInput.left)        localJoueur.moveLeft(deltaTime);
      if (keys.ArrowRight || joystickInput.right)       localJoueur.moveRight(deltaTime);
    }
    if (keys.Spacebar || joystickInput.killBoutton) localJoueur.tryKill();

    update();
    draw();
}

window.addEventListener('resize', function() {
  canvas.width = window.innerWidth - 25;
  canvas.height = window.innerHeight - 25;

  canvasNight.width = canvas.width;
  canvasNight.height = canvas.height;

  viewportWidth = canvas.width;
  viewportHeight = canvas.height;

  updateZoom();
});

function setJoueurAttributes(JoueurRole) {
  if (localJoueur == null) return;
  localJoueur.type = JoueurRole;
  localJoueur.speed = 8;

  if (JoueurRole === "assassin" && 'ontouchstart' in window) {
    document.getElementById("killButton").style.display = "block";
}

if ('ontouchstart' in window) {
    document.getElementById("joystickContainer").style.display = "block";
}
}

function sendReady() {
  isReady = true;
  socket.send(JSON.stringify({type: "setReady"}));
}

function sendSkip() {
  wantSkip = true;
  socket.send(JSON.stringify({type: "skip"}));
}

let selectedVote = null;

function showVotePanel(playerList) {
  selectedVote = null;
  const list = document.getElementById('playerList');
  list.innerHTML = '';
  const btn = document.getElementById('voteBtn');
  btn.disabled = true;
  btn.textContent = 'Envoyer';
  btn.classList.remove('sent');

  playerList.forEach(p => {
    if (p.id === localJoueur.id) return; // on ne vote pas pour soi-même
    const el = document.createElement('div');
    el.className = 'player-option';
    el.innerHTML = `<div class="avatar">${(p.username ?? '?').slice(0,2).toUpperCase()}</div>
                    <span class="p-name">${p.username ?? '?'}</span>`;
    el.addEventListener('click', () => {
      document.querySelectorAll('.player-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      selectedVote = p.id;
      btn.disabled = false;
    });
    list.appendChild(el);
  });

  document.getElementById('votePanel').style.display = 'flex';
}

function hideVotePanel() {
  document.getElementById('votePanel').style.display = 'none';
}

function submitVote() {
  if (!selectedVote) return;
  sendVote(selectedVote);
  document.getElementById('voteBtn').textContent = 'Voté ✓';
  document.getElementById('voteBtn').classList.add('sent');
  document.getElementById('voteBtn').disabled = true;
  document.querySelectorAll('.player-option').forEach(o => o.style.pointerEvents = 'none');
}

function sendVote(targetId) {
  socket.send(JSON.stringify({ type: "vote", vote: targetId }));
}

function displayKilledMessage() {
  localJoueur.died = true;
  canvas.style.display = "none";
  const messageElement = document.createElement("div");
  messageElement.style.position = "fixed";
  messageElement.style.top = "50%";
  messageElement.style.left = "50%";
  messageElement.style.transform = "translate(-50%, -50%)";
  messageElement.style.fontSize = "24px";
  messageElement.style.fontWeight = "bold";
  messageElement.style.color = "red";
  messageElement.innerHTML = "You have beeeeeeen killed <br> <br> <a href='javascript:void(0);' onclick='window.location.reload();'>Play again</a>";

  document.body.appendChild(messageElement);
}

function displayErrorMessage(message) {
  canvas.style.display = "none";
  const messageElement = document.createElement("div");
  messageElement.style.position = "fixed";
  messageElement.style.top = "50%";
  messageElement.style.left = "50%";
  messageElement.style.transform = "translate(-50%, -50%)";
  messageElement.style.fontSize = "24px";
  messageElement.style.fontWeight = "bold";
  messageElement.style.color = "red";
  messageElement.innerText = message;

  document.body.appendChild(messageElement);
}

function applyNightMask(ctxNight, px, py, radius) {
  var rad = radius;
  if (localJoueur.type === "assassin" && (isMidnight || isDawn)){
    rad *= 1.7;
  }
  else if (localJoueur.type === "petitefille" && (isMidnight || isDawn)){
    rad *= 2.5;
  }
  ctxNight.save();

  ctxNight.clearRect(0, 0, canvasNight.width, canvasNight.height);

  // Couche noire totale
  ctxNight.fillStyle = 'rgba(0, 0, 0, 0.95)';
  ctxNight.fillRect(0, 0, canvas.width, canvas.height);

  // Trou circulaire avec dégradé
  ctxNight.globalCompositeOperation = 'destination-out';
  const gradient = ctxNight.createRadialGradient(px, py, rad * 0.6, px, py, rad);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctxNight.fillStyle = gradient;
  ctxNight.beginPath();
  ctxNight.arc(px, py, rad, 0, Math.PI * 2);
  ctxNight.fill();

  ctxNight.restore();
}

function getCurrentDayTime() {
  if (isMorning) return "Matin";
  if (isNoon) return "Midi";
  if (isAfternoon) return "Après-midi";
  if (isNight) return "Nuit";
  if (isMidnight) return "Minuit";
  if (isDawn) return "Aube";
  return "Inconnu";
}

function updateZoom() {
  // On veut que WORLD_VIEW_WIDTH x WORLD_VIEW_HEIGHT rentre dans le canvas
  const zoomX = viewportWidth / WORLD_VIEW_WIDTH;
  const zoomY = viewportHeight / WORLD_VIEW_HEIGHT;
  cameraZoom = Math.min(zoomX, zoomY);
}

// Affiche le nom du joueur connecté en haut à gauche
async function displayUsername() {
  const res = await fetch(`https://${location.hostname}:3000/verify`, {
    credentials: "include"
  });
  if (!res.ok) {
    window.location.href = "/login.html"; // redirige si pas connecté
    return;
  }
  const data = await res.json();

  pendingUsername = data.username;
  if (localJoueur) localJoueur.username = data.username;

  const label = document.createElement("div");
  label.style.position = "fixed";
  label.style.top = "10px";
  label.style.left = "10px";
  label.style.fontFamily = "Arial, sans-serif";
  label.style.fontSize = "16px";
  label.style.fontWeight = "bold";
  label.style.color = "#0c0606";
  label.style.background = "rgba(255,255,255,0.5)";
  label.style.padding = "6px 12px";
  label.style.borderRadius = "5px";
  label.style.border = "2px solid #0c0606";
  label.style.zIndex = "999";
  label.textContent = `👤 ${data.username}`;

  document.body.appendChild(label);
}

socket.onerror = (error) => {
  displayErrorMessage("WebSocket error: " + error.message);
};

socket.onclose = (event) => {
  if (rejected) {
    displayErrorMessage("Partie déjà en cours, vous avez été rejeté");
  }
  else if (event.wasClean) {
    displayErrorMessage("WebSocket connection closed");
  } else {
    displayErrorMessage("WebSocket connection closed unexpectedly");
  }
};


const joystickContainer = document.getElementById('joystickContainer');
const joystick = document.getElementById('joystick');
const killButton = document.getElementById('killButton');

let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;

joystickContainer.addEventListener('touchstart', (event) => {
    event.preventDefault();
    isTouching = true;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
});

joystickContainer.addEventListener("touchmove", (event) => {
  event.preventDefault();
  if (isTouching) {
    const deltaX = event.touches[0].clientX - touchStartX;
    const deltaY = event.touches[0].clientY - touchStartY;

    // Move the joystick based on touch position
    joystick.style.transform =
  `translate(calc(-50% + ${deltaX}px),
             calc(-50% + ${deltaY}px))`;

    // Calculate direction vector and normalize it
    const directionX = deltaX / Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const directionY = deltaY / Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Calculate the angle in radians and convert it to degrees
    const angle = Math.atan2(directionY, directionX) * (180 / Math.PI);

    // Call the appropriate functions based on the angle
    joystickInput.up = false;
    joystickInput.down = false;
    joystickInput.left = false;
    joystickInput.right = false;

    if (angle >= -45 && angle <= 45) {
      joystickInput.right = true;

    } else if (angle > 45 && angle < 135) {
      joystickInput.down = true;

    } else if (angle >= 135 || angle <= -135) {
      joystickInput.left = true;

    } else if (angle < -45 && angle > -135) {
      joystickInput.up = true;
    }
  }
});

joystickContainer.addEventListener('touchend', () => {

  joystickInput.up = false;
  joystickInput.down = false;
  joystickInput.left = false;
  joystickInput.right = false;

  isTouching = false;
  joystick.style.transform = 'translate(-50%, -50%)'; // Reset the joystick position
});

killButton.addEventListener('touchstart', (event) => {
  joystickInput.killBoutton = true;
  event.preventDefault();
});

killButton.addEventListener('touchend', (event) => {
  joystickInput.killBoutton = false;
  event.preventDefault();
});
