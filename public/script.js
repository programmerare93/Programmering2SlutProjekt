"use strict";

const socket = io();
let canvas = document.getElementById("GameArea");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const canvasContext = canvas.getContext("2d");

const movementSpeed = 1.25;
const movementThreshold = 0.4;

const mapSize = { width: 14142, height: 14142 }; // Samma storlek som i agario

let playerId = undefined;

function drawCircles(circles, canvasContext) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const playerCircle = circles.get(playerId);
  const cameraX = - playerCircle.x + canvas.width / 2;
  const cameraY = - playerCircle.y + canvas.height / 2;

  canvasContext.setTransform(1, 0, 0, 1, 0, 0); // Identitetsmatrisen
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.translate(cameraX, cameraY);

  circles.forEach((circle) => {
    canvasContext.beginPath();
    canvasContext.fillStyle = circle.color;
    canvasContext.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
    canvasContext.fill();
    canvasContext.stroke();
  });
}

class Vector2D {
  #x;
  #y;
  #magnitude;

  constructor(x, y) {
    this.#x = x;
    this.#y = y;
    this.#magnitude = this.#calculateMagnitude();
  }

  #calculateMagnitude() {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  get magnitude() {
    return this.#magnitude;
  }

  get x() {
    return this.#x;
  }

  get y() {
    return this.#y;
  }

  normalize() {
    if (this.magnitude > 0) {
      return new Vector2D(this.x / this.magnitude, this.y / this.magnitude);
    } else {
      return undefined;
    }
  }

  distanceTo(other) {
    // TODO: Gör om så att det är tydligt att magnituden beräknas
    // t.ex använd magnitud metod
    return ((this.x - other.x) ** 2 + (this.y - other.y) ** 2) ** 0.5;
  }

  /*
  def get_distance_to(self, other) -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5
  */
}

function addCircle(circles, newCircle) {
  circles.set(newCircle.id, newCircle);
}

function removeCircle(circles, circleToRemove) {
  circles.delete(circleToRemove.id);
}

function addCircles(circles, newCircles) {
  circles.forEach((value) => {
    addCircle(circles, value);
  });
}

socket.on("welcome", (data) => {
  let playerCircle = data.playerCircle;
  let circles = new Map(JSON.parse(data.circles));
  playerId = playerCircle.id;

  // TODO: Bättre namn/eventuellt struktur
  let newXPosition = playerCircle.x;
  let newYPosition = playerCircle.y;

  let movementDirection = new Vector2D(0, 0);

  document.addEventListener("mousemove", (event) => {
    newXPosition = event.clientX;
    newYPosition = event.clientY;
  });

  const gameLoop = () => {
    const deltaX = newXPosition - playerCircle.x;
    const deltaY = newYPosition - playerCircle.y;
    if (
      Math.abs(deltaX) > movementThreshold &&
      Math.abs(deltaY) > movementThreshold
    ) {
      movementDirection = new Vector2D(deltaX, deltaY).normalize();
    } else {
      movementDirection = undefined;
    }

    if (movementDirection != undefined) {
      playerCircle.x += movementDirection.x * movementSpeed;
      playerCircle.y += movementDirection.y * movementSpeed;

      socket.emit("player-moved", { circle: playerCircle });
    }

    addCircle(circles, playerCircle);
    drawCircles(circles, canvasContext);

    window.requestAnimationFrame(gameLoop);
  };

  // TODO: Flytta all socket setup till egen funktion/helper
  socket.on("another-player-moved", (data) => {
    addCircle(circles, data.circle);
    drawCircles(circles, canvasContext);
  });

  socket.on("another-player-connected", (data) => {
    addCircle(circles, data.newCircle);
    drawCircles(circles, canvasContext);
  });

  socket.on("another-player-disconnected", (data) => {
    removeCircle(circles, data.circle);
    drawCircles(circles, canvasContext);
  });

  drawCircles(circles, canvasContext);
  window.requestAnimationFrame(gameLoop);
});
