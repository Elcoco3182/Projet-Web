const serverPort = location.port || 8080;
const socket = new WebSocket(`ws://${location.hostname}:${serverPort}/ws`);
let canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let canvasNight = document.createElement("canvas");
const ctxNight = canvasNight.getContext("2d");

let mapWidth, mapHeight;

let players = [];
let obstacles = [];
let localJoueur = null;
let isNight = false;

canvas.width = window.innerWidth - 30;
canvas.height = window.innerHeight - 30;

canvasNight.width = canvas.width;
canvasNight.height = canvas.height;

let viewportWidth = canvas.width;
let viewportHeight = canvas.height;

canvas.style.display = "none";

class Joueur {
    constructor(x, y) {
        this.id = 0;
        this.x = x;
        this.y = y;
        this.died = false;
        this.speed = 1; 
    }

    moveUp() {
        const newY = this.y - this.speed;
        if (!collidesWithObstacle(this.x, newY, 40, 20) &&
            newY >= 20) {
            this.y = newY;
        }
    }

    moveDown() {
        const newY = this.y + this.speed;
        if (!collidesWithObstacle(this.x, newY, 40, 20) &&
            newY <= mapHeight - 20) {
            this.y = newY;
        }
    }

    moveLeft() {
        const newX = this.x - this.speed;
        if (!collidesWithObstacle(newX, this.y, 40, 20) &&
            newX >= 20) {
            this.x = newX;
        }
    }

    moveRight() {
        const newX = this.x + this.speed;
        if (!collidesWithObstacle(newX, this.y, 40, 20) &&
            newX <= mapWidth - 20) {
            this.x = newX;
        }
    }

// regarde si c la nuit
    canKill() {
        return isNight && (localJoueur.type=="assassin");
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
            socket.send(JSON.stringify({ type: "kill", targetId: target.id }));
        }
    }
}

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

  if (e.key === "n") {
    socket.send(JSON.stringify({ type: "toggleNight"}));
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
  let data = JSON.parse(event.data);
  switch (data.type) {
    case "update":
      players = data.players;
      obstacles = data.obstacles;
      isNight = data.isNight;
      break;
    case "killed":
      if (data.playerId === localJoueur.id) {
        displayKilledMessage();
      }
      break;
    case "playerId":
      localJoueur = new Joueur(data.startX, data.startY);
      localJoueur.id = data.playerId;
      break;
    case "mapSize":
      mapWidth = data.width;
      mapHeight = data.height;
      break;
  }
};

socket.onopen = () => {
  gameLoop();
};

function update() {
  let data = {
    type: "update",
    x: localJoueur.x,
    y: localJoueur.y,
  };
  socket.send(JSON.stringify(data));
}

function draw() {
  ctx.fillStyle = "gray";
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  const currentPlayer = players.find((player) => player.id === localJoueur.id);
  if (!currentPlayer) return;

  const offsetX = Math.min(Math.max(currentPlayer.x - viewportWidth / 2, 0), mapWidth - viewportWidth);
  const offsetY = Math.min(Math.max(currentPlayer.y - viewportHeight / 2, 0), mapHeight - viewportHeight);

  ctx.save();

  ctx.translate(-offsetX, -offsetY);
  drawBorder(offsetX, offsetY);
  players.forEach((player) => {
    drawJoueur(player.x, player.y, player.type);
  });

  obstacles.forEach((obstacle) => {
    drawObstacle(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  });

  ctx.restore();

  if (isNight) {
    applyNightMask(ctxNight, localJoueur.x - offsetX, localJoueur.y - offsetY, 150);
    ctx.drawImage(canvasNight, 0, 0);
  }
}

//à changer en drawJoueur
function drawJoueur(x, y, type){
  ctx.save();
  ctx.translate(x, y);

  //  Draw the body of the player
  if (isNight){
    switch (type) {
      case "assassin":
        ctx.fillStyle = "red";
        break;  // ← sans ça, il continue et écrase avec "green"
      case "innocent":
        ctx.fillStyle = "green";
        break;
      case "petiteFille":
        ctx.fillStyle = "blue";
        break;
    }
  }
  else {
    ctx.fillStyle = "green";
  }
  ctx.fillRect(-20, -10, 40, 20);

  ctx.restore();
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
      y + height / 2 > obstacle.y + 6 &&
      y - height / 2 < obstacle.y + obstacle.height - 6
    ) {
      return true;
    }
  }
  return false;
}   

function drawBorder(offsetX, offsetY) {
  ctx.save();

  // Limit the drawing area
  ctx.beginPath();
  ctx.rect(offsetX, offsetY, viewportWidth, viewportHeight);
  ctx.clip();

  // Draw the borders
  ctx.fillStyle = "black";
  ctx.fillRect(offsetX, offsetY, viewportWidth, 5); // Top border
  ctx.fillRect(offsetX, offsetY + viewportHeight - 5, viewportWidth, 5); // Bottom border
  ctx.fillRect(offsetX + viewportWidth - 5, offsetY, 5, viewportHeight); // Right border
  ctx.fillRect(offsetX, offsetY, 5, viewportHeight); // Left border

  ctx.restore();
}

function gameLoop() {
    requestAnimationFrame(gameLoop);
    if (localJoueur == null) return;
    if (localJoueur.died) return;
    if (socket.readyState !== WebSocket.OPEN) return;

    if (keys.ArrowUp) localJoueur.moveUp();
    if (keys.ArrowDown) localJoueur.moveDown();
    if (keys.ArrowLeft) localJoueur.moveLeft();
    if (keys.ArrowRight) localJoueur.moveRight();

    if (keys.Spacebar) localJoueur.tryKill();

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
});

function setJoueurAttributes(JoueurRole) {
  if (localJoueur == null) return;
  localJoueur.type = JoueurRole;
  switch (JoueurRole) {
    case "assassin":
      localJoueur.speed = 8;
      break;
    case "innocent":
      localJoueur.speed = 8;
      break;
    case "petiteFille":
      localJoueur.speed = 8;
      break;
    default:
      localJoueur.speed = 8;
      break;
  }
};

// à changer pour recup le rôle du joueur
document.getElementById("joueurTypeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const joueurType = document.getElementById("joueurType").value;
  setJoueurAttributes(joueurType);
  document.getElementById("popup").style.display = "none";
  canvas.style.display = "block";

  const data = {
    type: "activatePlayer",
    joueurType: joueurType,
  };
  socket.send(JSON.stringify(data));
});

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
  if (localJoueur.type == "assassin"){
    rad *= 1.7;
  }
  else if (localJoueur.type == "petiteFille"){
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

socket.onerror = (error) => {
  displayErrorMessage("WebSocket error: " + error.message);
};

socket.onclose = (event) => {
  if (event.wasClean) {
    displayErrorMessage("WebSocket connection closed");
  } else {
    displayErrorMessage("WebSocket connection closed unexpectedly");
  }
};
