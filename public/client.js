const socket = new WebSocket(`ws://${location.hostname}:3000/ws`);
let canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let canvasNight = document.createElement("canvas");
const ctxNight = canvasNight.getContext("2d");

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

let isReady = false;
let rejected = false;

let cameraZoom = 1;

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
            socket.send(JSON.stringify({type: "kill", targetId: target.id}));
        }
    }
}

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
          break;
        case "mapSize":
          mapWidth = data.width;
          mapHeight = data.height;
          break;
        case "isMorning":
          isMidnight = false;
          isMorning = true;
          break;
        case "isNoon":
          isMorning = false;
          isNoon = true;
          break;
        case "isAfternoon":
          isNoon = false;
          isAfternoon = true;
          break;
        case "isNight":
          isAfternoon = false;
          isNight = true;
          break;
        case "isMidnight":
          isNight = false;
          isMidnight = true;
          break;
        case "gameStart":
          setJoueurAttributes(data.role);
          document.getElementById("popup").style.display = "none";
          document.getElementById("lobbyCount").style.display = "none";
          canvas.style.display = "block";
          break;
        case "rejected":
          document.getElementById("popup").style.display = "none";
          document.getElementById("lobbyCount").style.display = "none";
          rejected = true;
          break;
    }
};

updateZoom();

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

  document.getElementById("dayTime").innerText = getCurrentDayTime();

  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = "gray";
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  const currentPlayer = players.find((player) => player.id === localJoueur.id);
  if (!currentPlayer) return;

  const visibleWidth = viewportWidth / cameraZoom;
  const visibleHeight = viewportHeight / cameraZoom;

  const offsetX = Math.min(
    Math.max(currentPlayer.x - visibleWidth / 2, 0),
    mapWidth - visibleWidth
  );

  const offsetY = Math.min(
    Math.max(currentPlayer.y - visibleHeight / 2, 0),
    mapHeight - visibleHeight
  );

  ctx.save();

  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-offsetX, -offsetY);

  drawBorder(offsetX, offsetY);
  players.forEach((player) => {
    drawJoueur(player.x, player.y, player.type);
  });

  obstacles.forEach((obstacle) => {
    drawObstacle(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  });

  ctx.restore();

  if (isNight || isMidnight) {
    applyNightMask(ctxNight, localJoueur.x - offsetX, localJoueur.y - offsetY, 150);
    ctx.drawImage(canvasNight, 0, 0);
  }
}

//à changer en drawJoueur
function drawJoueur(x, y, type){
  ctx.save();
  ctx.translate(x, y);

  //  Draw the body of the player
  if (isMidnight){
    switch (type) {
      case "assassin":
        ctx.fillStyle = "red";
        break;  // ← sans ça, il continue et écrase avec "green"
      case "innocent":
        ctx.fillStyle = "green";
        break;
      case "petitefille":
        ctx.fillStyle = "blue";
        break;
      default:
        ctx.fillStyle = "green";
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

    if (keys.ArrowUp || joystickInput.up) localJoueur.moveUp();
    if (keys.ArrowDown || joystickInput.down) localJoueur.moveDown();
    if (keys.ArrowLeft || joystickInput.left) localJoueur.moveLeft();
    if (keys.ArrowRight || joystickInput.right) localJoueur.moveRight();

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
  if (localJoueur.type === "assassin"){
    rad *= 1.7;
  }
  else if (localJoueur.type === "petitefille"){
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
  return "Inconnu";
}

function updateZoom() {

  const isPhone =
    window.innerWidth <= 900 &&
    window.innerHeight <= 500;

  const isLandscape =
    window.innerWidth > window.innerHeight;

  if (isPhone && isLandscape) {
    cameraZoom = 0.6;
  } else {
    cameraZoom = 1;
  }
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
