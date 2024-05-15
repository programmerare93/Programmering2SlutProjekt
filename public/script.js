"use strict";

const db = require("../services/db");

const socket = io();

const startMenu = document.getElementById("startMenuDiv");
const startButton = document.getElementById("startButton");

const gameArea = document.getElementById("gameAreaDiv");
const canvas = document.getElementById("gameArea");
const canvasContext = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const movementThreshold = 0.5;

// TODO: Egen fil "constants.js"
const mapSize = { width: 14142 / 2, height: 14142 / 2 }; // Hälften av agar.io kartan

const scoreDiv = document.getElementById("score");

let globalPlayerID = undefined;

function login(event) {
  event.preventDefault();

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  if (db.userExists(usernameInput, passwordInput)) {
    console.log("YES");
  } else {
    console.log("NO");
  }
}
document.getElementById("loginForm").addEventListener("submit", login);

startButton.addEventListener("click", () => {
  startMenu.style.display = "none";
  gameArea.style.display = "inline";
  socket.emit("player-joined");
});

function quitGame() {
  startMenu.style.display = "inline";
  gameArea.style.display = "none";
}

function drawGrid(player, canvasContext) {
  // TODO: Magisk nummer från 720/10
  // TODO: Mer funktionellt, ingen loop
  for (let x = -player.x; x < window.innerWidth; x += 72) {
    canvasContext.moveTo(x, 0);
    canvasContext.lineTo(x, window.innerHeight);
  }

  for (let y = -player.y; y < window.innerHeight; y += 72) {
    canvasContext.moveTo(0, y);
    canvasContext.lineTo(window.innerWidth, y);
  }

  canvasContext.stroke();
  //canvasContext.globalAlpha = 1;
}

function drawCircles(player, circles, canvasContext) {
  // TODO: Varför negativt
  const cameraX = -player.x + canvas.width / 2;
  const cameraY = -player.y + canvas.height / 2;

  canvasContext.translate(cameraX, cameraY);
  circles.forEach((circle) => {
    canvasContext.beginPath();
    canvasContext.fillStyle = circle.color;
    canvasContext.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
    canvasContext.fill();
    canvasContext.stroke();
  });
}

function drawGame(circles, canvasContext) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  canvasContext.clearRect(0, 0, canvas.width, canvas.height);

  const player = circles.get(globalPlayerID);
  drawGrid(player, canvasContext);
  drawCircles(player, circles, canvasContext);
}

class Vector2D {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  #calculateMagnitude() {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  get magnitude() {
    return this.#calculateMagnitude();
  }

  normalize() {
    const magnitude = this.#calculateMagnitude();
    if (this.magnitude > 0) {
      return new Vector2D(this.x / magnitude, this.y / magnitude);
    } else {
      return undefined;
    }
  }

  distanceTo(other) {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }
}

function updateScoreDiv(newScore) {
  const scoreEndIndex = 7;
  scoreDiv.textContent =
    scoreDiv.textContent.substring(0, scoreEndIndex) + newScore;
}

function addCircle(circles, newCircle) {
  circles.set(newCircle.id, newCircle);
}

function removeCircle(circles, circleToRemove) {
  circles.delete(circleToRemove.id);
}

function removeCircleByID(circles, circleToRemoveID) {
  circles.delete(circleToRemoveID);
}

function addCircles(circles, newCircles) {
  newCircles.forEach((circle) => {
    addCircle(circles, circle);
  });
}

function calculateMovementSpeed(mass) {
  //return (mass / (mass + 1.44)) * 4; // Från agar.io
  const maxSpeed = 3.0;
  const minSpeed = 0.6;
  const massDecayRate = 0.002;

  let speed = maxSpeed - (maxSpeed - minSpeed) * (mass / 100.0);
  speed *= 1.0 - massDecayRate;
  if (speed < minSpeed) {
    speed = minSpeed;
  }

  return speed;
}

socket.on("welcome", (data) => {
  let playerCircle = data.playerCircle;
  playerCircle.id = playerCircle.id;
  globalPlayerID = playerCircle.id;
  let circles = new Map(JSON.parse(data.circles));

  let mousePosition = new Vector2D(
    window.innerWidth / 2,
    window.innerHeight / 2
  );
  let movementDirection = new Vector2D(0, 0);

  document.onmousemove = (event) => {
    mousePosition.x = event.clientX;
    mousePosition.y = event.clientY;
  };

  const gameLoop = () => {
    //TODO: Varför window.inner* / 2 (vi utgår från mitten av skärmed för där är alltid karaktären)
    const deltaX = mousePosition.x - window.innerWidth / 2;
    const deltaY = mousePosition.y - window.innerHeight / 2;
    if (
      Math.abs(deltaX) > movementThreshold &&
      Math.abs(deltaY) > movementThreshold
    ) {
      movementDirection = new Vector2D(deltaX, deltaY).normalize();
    } else {
      movementDirection = undefined;
    }

    if (movementDirection != undefined) {
      playerCircle.x +=
        movementDirection.x * calculateMovementSpeed(playerCircle.mass);
      playerCircle.y +=
        movementDirection.y * calculateMovementSpeed(playerCircle.mass);

      //socket.emit("player-moved", { circle: playerCircle });
    }

    addCircle(circles, playerCircle);
    drawGame(circles, canvasContext);

    window.requestAnimationFrame(gameLoop);
  };

  socket.on("send-tick", (mapEntities) => {
    const state = new Map(JSON.parse(mapEntities));
    state.forEach((circle) => {
      addCircle(circles, circle);
    });
    socket.emit("tick", { circle: playerCircle });
  });

  socket.on("state-updated", (newState) => {
    addCircles(circles, new Map(JSON.parse(newState)));
    drawGame(circles, canvasContext);
  });

  socket.on("entity-eaten", (data) => {
    let player = circles.get(data.consumer.id);
    player = data.consumer;
    //player.mass = data.consumer.mass;
    //xplayer.radius = data.consumer.radius;

    if (data.consumedID === globalPlayerID) {
      alert("You died");
      quitGame();
    } else if (data.consumer.id === globalPlayerID) {
      console.log("Here");
      console.log(data);
      updateScoreDiv(player.mass);
    }

    removeCircleByID(circles, data.consumedID);
    drawGame(circles, canvasContext);
  });

  socket.on("another-player-connected", (data) => {
    addCircle(circles, data.newCircle);
    drawGame(circles, canvasContext);
  });

  socket.on("another-player-disconnected", (playerID) => {
    removeCircleByID(circles, playerID);
    drawGame(circles, canvasContext);
  });

  updateScoreDiv(playerCircle.mass);
  drawGame(circles, canvasContext);
  window.requestAnimationFrame(gameLoop);
});
