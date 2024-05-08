const path = require("path");
const http = require("http");
const express = require("express");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const port = 5500;

app.use(express.static("public"));

server.listen(port, () => {
  console.log("Server öppnad på port " + port);
});

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

function aabbIntersects(AABB1, AABB2) {
  return (
    AABB1.maxX <= AABB2.minX ||
    AABB2.maxX <= AABB1.minX ||
    AABB1.maxY <= AABB2.minY ||
    AABB2.maxY <= AABB1.minY
  );
}

// TODO: Flytta Circle till annan fil
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

function generateRandomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

let gameState = {
  circles: new Map(),
};

function checkCollisions(circles) {
  let potentialCollisions = [];
  // TODO: Mer funktionellt
  console.log(circles)
  circles.forEach((circle1) => {
    circles.forEach((circle2) => {
      if (circle1.id === circle2.id) {
        return;
      }

      circle1.updateBoundingBox();
      circle2.updateBoundingBox();

      /*console.log(circle1.AABB)
      console.log(circle2.AABB)
      console.log("\n")*/

      if (aabbIntersects(circle1.AABB, circle2.AABB)) {
        potentialCollisions.push([circle1, circle2]);
      }
    });
  });

  potentialCollisions.forEach((potentialCollision) => {
    const circle1 = potentialCollision[0];
    const circle2 = potentialCollision[1];
    const distance = circle1.position.distanceTo(circle2.position);
    if (distance <= Math.abs(circle1.radius - circle2.radius)) {
      console.log("YES");
    }
  });
}

function removeCircle(circles, circleToRemove) {
  circles.delete(circleToRemove.id);
}

function updateGameState(gameState, newCircle) {
  gameState.circles.set(newCircle.id, newCircle);
}

function addRandomCircle(gameState) {
  gameState.circles.push(
    Circle(
      crypto.randomInt(400),
      crypto.randomInt(400),
      10,
      "#" + Math.floor(Math.random() * 16777215).toString(16)
    )
  );
}

io.on("connection", (socket) => {
  /*const type = socket.handshake.query.type;
  switch (type) {

  }*/

  const playerCircle = new Circle(
    2000,
    2000,
    10,
    generateRandomColor(),
    crypto.randomUUID()
  );

  updateGameState(gameState, playerCircle);

  socket.emit("welcome", {
    playerCircle: JSON.stringify(playerCircle),
    circles: JSON.stringify(Array.from(gameState.circles)),
  });

  socket.broadcast.emit("another-player-connected", {
    newCircle: playerCircle,
  });

  setInterval(() => {
    socket.emit("send-tick");
  }, 33); // TODO: Magiskt nummer

  socket.on("tick", (data) => {
    //JSON.parse(data.circle)
    updateGameState(gameState, data.circle);
    checkCollisions(gameState.circles);
    socket.broadcast.emit(
      "state-updated",
      JSON.stringify(Array.from(gameState.circles))
    );
  });

  socket.on("disconnect", () => {
    removeCircle(gameState.circles, playerCircle);
    socket.broadcast.emit("another-player-disconnected", {
      circle: playerCircle,
    });
  });

  /*socket.on("player-moved", (data) => {
    updateGameState(gameState, data.circle);
    checkCollisions(gameState.circles);
    socket.broadcast.emit("another-player-moved", data);
  });*/
});
