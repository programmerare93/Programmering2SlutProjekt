"use strict";

// TODO: Fixa databas
//import { userExists } from "./services/db.js";
import { Vector2D } from "./common/geometry.js";
import { correctXPositon, correctYPositon } from "./common/helpers.js";
import { mapSize } from "./common/constants.js";

//const db = require("../services/db");

const socket = io();

const startMenu = document.getElementById("startMenuDiv");
const loginForm = document.getElementById("loginForm");
const playerInfoDiv = document.getElementById("playerInfo");

const gameArea = document.getElementById("gameAreaDiv");
const canvas = document.getElementById("gameArea");
const canvasContext = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const movementThreshold = 0.5;

const scoreDiv = document.getElementById("score");

let globalPlayerID = undefined;

function login(event) {
  event.preventDefault();

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  switch (event.submitter.name) {
    case "create":
      socket.emit("add-user", {
        username: usernameInput.value,
        password: passwordInput.value,
      });
      break;
    case "login":
      socket.emit("login", {
        username: usernameInput.value,
        password: passwordInput.value,
      });
      break;
  }
}

socket.on("login-failed", (reason) => {
  if (loginForm.children[loginForm.children.length - 1].nodeName !== "P") {
    let errorMessage = document.createElement("p");
    errorMessage.innerHTML = reason;
    loginForm.appendChild(errorMessage);
  }
});

socket.on("login-success", (info) => {
  if (loginForm.children[loginForm.children.length - 1].nodeName === "P") {
    loginForm.removeChild(loginForm.children[loginForm.children.length - 1]);
  }

  loginForm.style.display = "none";
  const username = playerInfoDiv.children[0];
  const score = playerInfoDiv.children[1];

  const usernameEndIndex = 10;
  username.textContent =
    username.textContent.substring(0, usernameEndIndex) + info.username;

  const scoreEndIndex = 10;
  score.textContent =
    score.textContent.substring(0, scoreEndIndex) + info.score;
  playerInfoDiv.style.display = "inline";
});

function startGame() {
  startMenu.style.display = "none";
  gameArea.style.display = "inline";
  socket.emit("player-joined");
}

function quitGame() {
  startMenu.style.display = "inline";
  gameArea.style.display = "none";
  socket.emit("player-left");
}

loginForm.addEventListener("submit", login);
document.getElementById("startButton").addEventListener("click", startGame);

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

  const player = circles.get(globalPlayerID);

  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  const scaleFactor = 20 / player.radius;

  drawGrid(player, canvasContext);
  //canvasContext.scale(scaleFactor, scaleFactor);
  drawCircles(player, circles, canvasContext);
}

function updateScoreDiv(newScore) {
  const scoreEndIndex = 6;
  scoreDiv.textContent =
    scoreDiv.textContent.substring(0, scoreEndIndex) + newScore;
}

function addEntity(mapEntities, entity) {
  mapEntities.set(entity.id, entity);
}

function removeEntity(mapEntities, entity) {
  mapEntities.delete(entity.id);
}

function removeEntityByID(mapEntities, entityID) {
  mapEntities.delete(entityID);
}

function addEntities(mapEntities, newEntities) {
  newEntities.forEach((entity) => {
    addEntity(mapEntities, entity);
  });
}

function calculateMovementSpeed(mass) {
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
  let player = data.player;
  player.id = player.id;
  globalPlayerID = player.id;
  let mapEntities = new Map(JSON.parse(data.mapEntites));

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
    const playerXPosition = window.innerWidth / 2;
    const playerYPosition = window.innerHeight / 2;
    const deltaX = mousePosition.x - playerXPosition;
    const deltaY = mousePosition.y - playerYPosition;
    if (
      Math.abs(deltaX) > movementThreshold &&
      Math.abs(deltaY) > movementThreshold
    ) {
      // TODO: Varför är movement konstig
      movementDirection = new Vector2D(deltaX, deltaY).normalize();
    } else {
      movementDirection = undefined;
    }

    if (movementDirection !== undefined) {
      player.x += movementDirection.x * calculateMovementSpeed(player.mass);
      player.y += movementDirection.y * calculateMovementSpeed(player.mass);
      player.x = correctXPositon(player.x, player.radius, mapSize.width);
      player.y = correctYPositon(player.y, player.radius, mapSize.height);
    }

    addEntity(mapEntities, player);
    drawGame(mapEntities, canvasContext);

    window.requestAnimationFrame(gameLoop);
  };

  socket.on("send-tick", (updatedMapEntities) => {
    const newState = new Map(JSON.parse(updatedMapEntities));
    newState.forEach((entity) => {
      addEntity(mapEntities, entity);
    });
    socket.emit("tick", { xPos: player.x, yPos: player.y });
  });

  socket.on("state-updated", (newState) => {
    addEntities(mapEntities, new Map(JSON.parse(newState)));
    drawGame(mapEntities, canvasContext);
  });

  socket.on("entity-eaten", (data) => {
    let consumer = data.consumer;

    addEntity(mapEntities, consumer);
    removeEntityByID(mapEntities, data.consumedEntityID);

    if (data.consumedEntityID === globalPlayerID) {
      alert("You died");
      quitGame();
    } else if (consumer.id === globalPlayerID) {
      updateScoreDiv(consumer.mass);
    }

    drawGame(mapEntities, canvasContext);
  });

  socket.on("another-player-connected", (data) => {
    addEntity(mapEntities, data.newPlayer);
    drawGame(mapEntities, canvasContext);
  });

  socket.on("another-player-disconnected", (playerID) => {
    removeEntityByID(mapEntities, playerID);
    drawGame(mapEntities, canvasContext);
  });

  updateScoreDiv(player.mass);
  drawGame(mapEntities, canvasContext);
  window.requestAnimationFrame(gameLoop);
});
