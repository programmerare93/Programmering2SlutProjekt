const path = require("path");
const http = require("http");
const express = require("express");
const socketIO = require("socket.io");

const geometry = require("./common/geometry");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
global.io = io;

const port = 5500;

const eatThreshold = 1.25;
const updateInterval = 33;

app.use(express.static("public"));

server.listen(port, () => {
  console.log("Server öppnad på port " + port);
});

class Player extends geometry.Circle {
  constructor(xPos, yPos, radius, color, mass = 10) {
    super(xPos, yPos, radius, color);
    this.mass = mass;
  }
}

class Virus extends geometry.Circle {
  constructor(xPos, yPos, radius, color) {
    super(xPos, yPos, radius, color);
  }
}

function generateRandomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

let gameState = {
  circles: new Map(),
};

function shouldEat(player1, player2) {
  if (player1.mass > player2.mass * eatThreshold) {
    console.log("YES")
    return 1;
  } else if (player2.mass > player1.mass * eatThreshold) {
    console.log("YES")
    return -1;
  } else {
    return 0;
  }
}

function checkCollisions(circles) {
  // TODO: Mer funktionellt
  let collisions = new Map();

  circles.forEach((circle1) => {
    circles.forEach((circle2) => {
      if (circle1.id === circle2.id) {
        return;
      } else if (collisions.get(circle1.id) !== undefined) {
        if (collisions.get(circle1.id).otherPlayer === circle2.id) {
          return;
        }
      }

      if (geometry.circlesOverlap(circle1, circle2)) {
        let eatOther = false;
        let beEaten = false;
        switch (shouldEat(circle1, circle2)) {
          case 1:
            eatOther = true;
            break;
          case -1:
            beEaten = true;
            break;
          default:
            break;
        }
        collisions.set(circle2.id, {
          otherPlayer: circle1.id,
          eatOther: eatOther,
          beEaten: beEaten,
        });
      }
    });
  });

  return collisions;
}

function handleCollisions(collisions) {
  collisions.forEach((collisionInfo, mainCircle) => {
    const eatenIndex = null;
    if (collisionInfo.eatOther) {
      global.io.emit("player-eaten", collisionInfo.otherPlayer);
      removeCircleByID(gameState.circles, collisionInfo.otherPlayer);
    } else if (collisionInfo.beEaten) {
      global.io.emit("player-eaten", mainCircle);
      removeCircleByID(gameState.circles, mainCircle);
    }
    //global.io.emit("player-eaten", {})
  });
}

function removeCircleByID(circles, circleToRemoveID) {
  circles.delete(circles.get(circleToRemoveID));
}

function removeCircle(circles, circleToRemove) {
  circles.delete(circleToRemove.id);
}

function updateGameState(gameState, newCircle) {
  gameState.circles.set(newCircle.id, newCircle);
}

let gMass = 10;

io.on("connection", (socket) => {
  /*const type = socket.handshake.query.type;
  switch (type) {

  }*/

  const playerCircle = new Player(
    2000,
    2000,
    10,
    generateRandomColor(),
    (mass = gMass)
  );
  gMass *= 2;

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
  }, updateInterval); // TODO: Magiskt nummer

  socket.on("tick", (data) => {
    //JSON.parse(data.circle)
    updateGameState(gameState, data.circle);
    //checkCollisions(gameState.circles);
    handleCollisions(checkCollisions(gameState.circles));
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
