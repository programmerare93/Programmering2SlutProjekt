"use strict";

const socket = io();
let canvas = document.getElementById("GameArea");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const canvasContext = canvas.getContext("2d");

const movementSpeed = 1.25;
const movementThreshold = 1;

const mapSize = { width: 14142, height: 14142 }; // Samma storlek som i agario

let playerId = undefined;

function drawGrid(player, canvasContext) {
  // TODO: Magisk nummer från 720/10
  // TODO: Mer funktionellt, ingen loop
  for (let x = -player.position.x; x < window.innerWidth; x += 72) {
    canvasContext.moveTo(x, 0);
    canvasContext.lineTo(x, window.innerHeight);
  }

  for (let y = -player.position.y; y < window.innerHeight; y += 72) {
    canvasContext.moveTo(0, y);
    canvasContext.lineTo(window.innerWidth, y);
  }

  canvasContext.stroke();
  //canvasContext.globalAlpha = 1;
}

function drawCircles(player, circles, canvasContext) {
  // TODO: Varför negativt
  const cameraX = -player.position.x + canvas.width / 2;
  const cameraY = -player.position.y + canvas.height / 2;

  canvasContext.translate(cameraX, cameraY);
  circles.forEach((circle) => {
    canvasContext.beginPath();
    canvasContext.fillStyle = circle.color;
    canvasContext.arc(
      circle.position.x,
      circle.position.y,
      circle.radius,
      0,
      2 * Math.PI
    );
    canvasContext.fill();
    canvasContext.stroke();
  });
}

function drawGame(circles, canvasContext) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  canvasContext.clearRect(0, 0, canvas.width, canvas.height);

  const player = circles.get(playerId);
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

function addCircle(circles, newCircle) {
  circles.set(newCircle.id, newCircle);
}

function removeCircle(circles, circleToRemove) {
  circles.delete(circleToRemove.id);
}

function addCircles(circles, newCircles) {
  newCircles.forEach((circle) => {
    addCircle(circles, circle);
  });
}

class AABB {
  constructor(minX, minY, maxX, maxY) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    this.height = maxY - minY;
    this.width = maxX - minX;
  }
}

class Circle {
  constructor(xPos, yPos, radius, color) {
    this.id = crypto.randomUUID();
    this.position = new Vector2D(xPos, yPos);
    this.radius = radius;
    this.color = color;
    this.AABB = this.updateBoundingBox();
  }

  updateBoundingBox() {
    const minX = this.position.x - this.radius;
    const minY = this.position.y - this.radius;
    const maxX = this.position.x + this.radius;
    const maxY = this.position.y + this.radius;

    return new AABB(minX, minY, maxX, maxY);
  }
}

socket.on("welcome", (data) => {
  console.log(data)
  let playerCircle = new Circle(JSON.parse(data.playerCircle));
  console.log(playerCircle)
  let circles = new Map(JSON.parse(data.circles));
  playerId = playerCircle.id;

  let mousePosition = new Vector2D(
    window.innerWidth/2,
    window.innerHeight/2
  );
  let movementDirection = new Vector2D(0, 0);

  document.onmousemove = (event) => {
    mousePosition.x = event.clientX;
    mousePosition.y = event.clientY;
  };

  const gameLoop = () => {
    //TODO: Varför window.inner* / 2
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
      playerCircle.position.x += movementDirection.x * movementSpeed;
      playerCircle.position.y += movementDirection.y * movementSpeed;

      //socket.emit("player-moved", { circle: playerCircle });
    }

    addCircle(circles, playerCircle);
    drawGame(circles, canvasContext);

    window.requestAnimationFrame(gameLoop);
  };

  socket.on("send-tick", () => {
    socket.emit("tick", { circle: playerCircle });
  });

  socket.on("state-updated", (newState) => {
    addCircles(circles, newState.circles);
    drawGame(circles, canvasContext);
  })

  // TODO: Flytta all socket setup till egen funktion/helper
  /*socket.on("another-player-moved", (data) => {
    addCircle(circles, data.circle);
    drawGame(circles, canvasContext);
  });*/

  socket.on("another-player-connected", (data) => {
    addCircle(circles, data.newCircle);
    drawGame(circles, canvasContext);
  });

  socket.on("another-player-disconnected", (data) => {
    removeCircle(circles, data.circle);
    drawGame(circles, canvasContext);
  });

  drawGame(circles, canvasContext);
  window.requestAnimationFrame(gameLoop);
});
