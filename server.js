"use strict";

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

class Food extends geometry.Circle {
  constructor(xPos, yPos, radius, color) {
    super(xPos, yPos, radius, color);
  }

  get mass() {
    return 1;
  }
}

function generateRandomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

let gameState = {
  mapEntities: new Map(),
};

function canEat(player, other) {
  return other instanceof Food || player.mass > other.mass * eatThreshold;
}

function checkCollisions(circles) {
  // TODO: Mer funktionellt
  let collisions = new Map();

  circles.forEach((circle1) => {
    circles.forEach((circle2) => {
      if (circle1.id === circle2.id) {
        return;
      } else if (
        collisions.get(circle1.id) !== undefined ||
        collisions.get(circle2.id) !== undefined
      ) {
        return;
      }

      if (geometry.circlesOverlap(circle1, circle2)) {
        if (canEat(circle1, circle2)) {
          collisions.set(circle1.id, circle2.id);
        } else if (canEat(circle2, circle1)) {
          collisions.set(circle2.id, circle1.id);
        }
        /*
        let eatOther = false;
        let beEaten = false;
        switch (canEat(circle1, circle2)) {
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
        */
      }
    });
  });

  return collisions;
}

function handleCollisions(collisions) {
  collisions.forEach((consumedEntityID) => {
    removeCircleByID(gameState.mapEntities, consumedEntityID);
    global.io.emit("player-eaten", consumedEntityID);
  });
}

function removeCircleByID(circles, circleToRemoveID) {
  circles.delete(circleToRemoveID);
}

function removeCircle(circles, circleToRemove) {
  circles.delete(circleToRemove.id);
}

function updateGameState(gameState, newCircle) {
  gameState.mapEntities.set(newCircle.id, newCircle);
}

function generateRandomFood() {}

io.on("connection", (socket) => {
  /*const type = socket.handshake.query.type;
  switch (type) {

  }*/

  const playerCircle = new Player(
    2000,
    2000,
    10,
    generateRandomColor()
  );

  updateGameState(gameState, playerCircle);

  socket.emit("welcome", {
    playerCircle: JSON.stringify(playerCircle),
    circles: JSON.stringify(Array.from(gameState.mapEntities)),
  });

  socket.broadcast.emit("another-player-connected", {
    newCircle: playerCircle,
  });

  setInterval(() => {
    socket.emit("send-tick");
  }, updateInterval); // TODO: Magiskt nummer

  socket.on("tick", (data) => {
    //JSON.parse(data.circle)
    const food = generateRandomFood();
    updateGameState(gameState, data.circle);
    //checkCollisions(gameState.circles);
    handleCollisions(checkCollisions(gameState.mapEntities));
    socket.broadcast.emit(
      "state-updated",
      JSON.stringify(Array.from(gameState.mapEntities))
    );
  });

  socket.on("disconnect", () => {
    removeCircle(gameState.mapEntities, playerCircle);
    socket.broadcast.emit("another-player-disconnected", playerCircle.id);
  });

  /*socket.on("player-moved", (data) => {
    updateGameState(gameState, data.circle);
    checkCollisions(gameState.circles);
    socket.broadcast.emit("another-player-moved", data);
  });*/
});
