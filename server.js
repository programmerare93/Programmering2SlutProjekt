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
// TODO: Egen fil "constants.js"
const mapSize = { width: 14142 / 2, height: 14142 / 2 }; // Hälften av agar.io kartan

app.use(express.static("public"));

server.listen(port, () => {
  console.log("Server öppnad på port " + port);
});

class Player extends geometry.Circle {
  constructor(xPos, yPos, color, mass = 10, radius = calculateRadius(mass)) {
    super(xPos, yPos, radius, color);
    this.mass = mass;
  }
}

class Food extends geometry.Circle {
  constructor(xPos, yPos) {
    super(xPos, yPos, 10, generateRandomColor());
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
        collisions.get(circle1.id) === circle2.id ||
        collisions.get(circle2.id) === circle1.id
      ) {
        return;
      }

      if (geometry.circlesOverlap(circle1, circle2)) {
        if (canEat(circle1, circle2)) {
          collisions.set(circle1.id, circle2.id);
        } else if (canEat(circle2, circle1)) {
          collisions.set(circle2.id, circle1.id);
        }
      }
    });
  });

  return collisions;
}

function calculateRadius(mass) {
  return 4 + Math.sqrt(mass) * 6; // Från agar.io
}

function handleCollisions(collisions) {
  collisions.forEach((consumedEntityID, playerID) => {
    let player = gameState.mapEntities.get(playerID);
    // TODO: det finns något fel här där massan inte uppdateras ibland
    player.mass += gameState.mapEntities.get(consumedEntityID).mass;
    player.radius = calculateRadius(player.mass);
    //updateCircleByID(gameState.mapEntities, playerID);
    removeCircleByID(gameState.mapEntities, consumedEntityID);
    global.io.emit("entity-eaten", {
      consumedID: consumedEntityID,
      consumer: player,
    });
    // TODO: Ta bort
    for (let i = 0; i < 10; ++i) {
      // Generera 10 för att karta är stor
      const food = generateRandomFood();
      gameState.mapEntities.set(food.id, food);
    }
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

function generateRandomFood() {
  // TODO: Hantera kartans gräns t.ex om (x,y) = (0,0) så hamnar del av maten utanför
  const xPos = Math.random() * mapSize.width;
  const yPos = Math.random() * mapSize.height;

  return new Food(xPos, yPos);
}

for (let i = 0; i < 200; ++i) {
  const food = generateRandomFood();
  gameState.mapEntities.set(food.id, food);
}

io.on("connection", (socket) => {
  /*const type = socket.handshake.query.type;
  switch (type) {

  }*/

  socket.on("player-joined", () => {
    const playerCircle = new Player(2000, 2000, generateRandomColor());
    updateGameState(gameState, playerCircle);
    socket.emit("welcome", {
      playerCircle: playerCircle,
      circles: JSON.stringify(Array.from(gameState.mapEntities)),
    });
  
    socket.broadcast.emit("another-player-connected", {
      newCircle: playerCircle,
    });
  });

  setInterval(() => {
    socket.emit("send-tick", JSON.stringify(Array.from(gameState.mapEntities)));
  }, updateInterval); // TODO: Magiskt nummer

  socket.on("tick", (data) => {
    //JSON.parse(data.circle)
    //const food = generateRandomFood();
    updateGameState(gameState, data.circle);
    //checkCollisions(gameState.circles);
    handleCollisions(checkCollisions(gameState.mapEntities));
    socket.broadcast.emit(
      "state-updated",
      JSON.stringify(Array.from(gameState.mapEntities))
    );
  });

  // TODO: FLytta från disconnect
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
