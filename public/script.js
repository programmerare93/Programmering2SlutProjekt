"use strict";
const socket = io();
const canvas = document.getElementById("GameArea");
const canvasContext = canvas.getContext("2d");

class Circle {
  constructor(xPos, yPos, radius, color) {
    this.id = crypto.randomUUID();
    this.x = xPos;
    this.y = yPos;
    this.radius = radius;
    this.color = color;
    // TODO: Flytta speed från circle till spelar classen
    this.speed = 1.25;
  }
}

function generateRandomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

function drawCircles(circles, canvasContext) {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  for (const circle of circles) {
    canvasContext.beginPath();
    canvasContext.arc(
      circle.x - circle.radius,
      circle.y - circle.radius,
      circle.radius,
      0,
      2 * Math.PI
    );
    canvasContext.fillStyle = circle.color;
    canvasContext.fill();
    canvasContext.stroke();
  }
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
  //const circleIndex = circles.indexOf(newCircle);
  let circleIndex = 0;
  for (; circleIndex < circles.length; ++circleIndex) {
    if (circles[circleIndex].id == newCircle.id) {
      break;
    }
  }

  if (circleIndex < circles.length) {
    circles[circleIndex] = newCircle;
  } else {
    circles.push(newCircle);
  }
}

function removeCircle(circles, circleToRemove) {
  let circleIndex = 0;
  for (; circleIndex < circles.length; ++circleIndex) {
    if (circles[circleIndex].id == circleToRemove.id) {
      break;
    }
  }

  if (circleIndex < circles.length) {
    circles.splice(circleIndex, 1);
  }
}

function addCircles(circles, newCircles) {
  for (const newCircle of newCircles) {
    addCircle(circles, newCircle);
  }
}

function main() {
  let circles = [new Circle(20, 20, 10, generateRandomColor())];
  let playerCircle = circles[0];

  // TODO: Flytta all socket setup till egen funktion/helper
  socket.on("another-player-moved", (data) => {
    addCircle(circles, data.circle);
    drawCircles(circles, canvasContext);
  });

  socket.on("another-player-connected", (data) => {
    addCircle(circles, data.circle);
    drawCircles(circles, canvasContext);
  });

  socket.on("another-player-disconnected", (data) => {
    removeCircle(circles, data.circle);
    drawCircles(circles, canvasContext);
  });

  socket.on("connect", () => {
    socket.emit("player-connected", { circle: playerCircle });
  });

  socket.on("welcome", (gameState) => {
    addCircles(circles, gameState.circles);
    drawCircles(circles, canvasContext);
  });

  let newXPosition = playerCircle.x;
  let newYPosition = playerCircle.y;

  let movementDirection = new Vector2D(
    newXPosition - playerCircle.x,
    newYPosition - playerCircle.y
  ).normalize();

  document.onmousemove = (event) => {
    newXPosition = event.clientX;
    newYPosition = event.clientY;
  };

  const gameLoop = () => {
    if (
      // TODO: Inga magisk nummer
      Math.abs(newXPosition - playerCircle.x) > 0.4 &&
      Math.abs(newYPosition - playerCircle.y) > 0.4
    ) {
      movementDirection = new Vector2D(
        newXPosition - playerCircle.x,
        newYPosition - playerCircle.y
      ).normalize();
    } else {
      movementDirection = undefined;
    }

    if (movementDirection != undefined) {
      playerCircle.x += movementDirection.x * playerCircle.speed;
      playerCircle.y += movementDirection.y * playerCircle.speed;

      socket.emit("player-moved", { circle: playerCircle });
    }

    drawCircles(circles, canvasContext);

    window.requestAnimationFrame(gameLoop);
  };

  window.requestAnimationFrame(gameLoop);
}

main();
