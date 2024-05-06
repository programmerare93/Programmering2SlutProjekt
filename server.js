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

// TODO: Flytta Circle till annan fil
class Circle {
  constructor(xPos, yPos, radius, color) {
    this.id = crypto.randomUUID();
    this.x = xPos;
    this.y = yPos;
    this.radius = radius;
    this.color = color;
  }
}

function generateRandomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

let gameState = {
  circles: Map,
};
gameState.circles = new Map();

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
    playerCircle: playerCircle,
    circles: JSON.stringify(Array.from(gameState.circles)),
  });

  socket.broadcast.emit("another-player-connected", {
    newCircle: playerCircle,
  });

  socket.on("disconnect", () => {
    removeCircle(gameState.circles, playerCircle);
    socket.broadcast.emit("another-player-disconnected", {
      circle: playerCircle,
    });
  });

  socket.on("player-moved", (data) => {
    updateGameState(gameState, data.circle);
    socket.broadcast.emit("another-player-moved", data);
  });
});
