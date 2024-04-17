const path = require("path")
const http = require("http")
const express = require("express")
const socketIO = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = socketIO(server)

const port = 5500;

app.use(express.static("public"))

server.listen(port, () => {
  console.log("Server öppnad på port " + port);
});

class Circle {
  constructor(xPos, yPos, radius, color) {
    this.id = crypto.randomUUID();
    this.x = xPos;
    this.y = yPos;
    this.radius = radius;
    this.color = color;
  }
}

let gameState = {
  circles: Array,
  socketCircle: Map
};
gameState.circles = new Array;
gameState.socketCircle = new Map;

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

function updateGameState(gameState, newCircle) {
  gameState.circles.forEach((circle, index) => {
    if (circle.id === newCircle.id) {
      gameState.circles[index] = newCircle;
    }
  });
}

function addRandomCircle(gameState) {
  gameState.circles.push(Circle(crypto.randomInt(400),
                         crypto.randomInt(400),
                         10,
                         "#" + Math.floor(Math.random() * 16777215).toString(16)));
}

io.on("connection", (socket) => {
  const type = socket.handshake.query.type;
  switch (type) {

  }

  socket.on("player-connected", (data) => {
    socket.emit("welcome", gameState);
    gameState.circles.push(data.circle)
    gameState.socketCircle.set(socket.id, data.circle);
    socket.broadcast.emit("another-player-connected", data);
  });

  socket.on("disconnect", () => {
    let circle = gameState.socketCircle.get(socket.id);
    removeCircle(gameState.circles, circle);
    socket.broadcast.emit("another-player-disconnected", {circle: circle});
  });

  socket.on("circle-given", (data) => {
    socket.broadcast.emit("another-player-disconnected", data);
    removeCircle(gameState.circles, data.circle);
  });

  socket.on("player-moved", (data) => {
    updateGameState(gameState, data.circle);
    socket.broadcast.emit("another-player-moved", data);
  })
});
