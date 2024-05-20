"use strict";

import { createServer } from "http";
import express from "express";
import { Server } from "socket.io";
import { Circle, circlesOverlap } from "./public/common/geometry.js";
import {
  generateRandomColor,
  correctXPositon,
  correctYPositon,
} from "./public/common/helpers.js";
import { mapSize } from "./public/common/constants.js";
import {
  getUserData,
  userExists,
  addUser,
  updateUserScore,
} from "./services/db.js";

const app = express();
const server = createServer(app);
const io = new Server(server);

const port = 5500;

const eatThreshold = 1.25;
const updateInterval = 33;

class Player extends Circle {
  constructor(xPos, yPos) {
    const mass = 10;
    const radius = calculateRadius(mass);
    const color = generateRandomColor();
    super(xPos, yPos, radius, color);
    this.mass = mass;
  }
}

class Food extends Circle {
  constructor(xPos, yPos) {
    const radius = Food.radius;
    const color = generateRandomColor();
    super(xPos, yPos, radius, color);
  }

  get mass() {
    return 1;
  }

  static get radius() {
    return 10;
  }
}

let gameState = {
  mapEntities: new Map(),
  playerIDs: new Map(),
  leaderboard: new Map(),
};

function canEat(eater, other) {
  if (eater instanceof Food && other instanceof Food) {
    return false;
  } else {
    return other instanceof Food || eater.mass > other.mass * eatThreshold;
  }
}

function removeEntityByID(state, entityID) {
  state.delete(entityID);
}

function removePlayerBySocketID(state, socketID) {
  state.mapEntities.delete(state.playerIDs.get(socketID));
}

function updateGameState(state, socketID, newEntity) {
  state.playerIDs.set(socketID, newEntity.id);
  state.mapEntities.set(newEntity.id, newEntity);
}

function updatePlayerPosition(state, socketID, playerPosition) {
  let player = state.mapEntities.get(state.playerIDs.get(socketID));
  player.x = playerPosition.xPos;
  player.y = playerPosition.yPos;
}

function updateGameStateByEntity(state, newEntityValue) {
  state.mapEntities.set(newEntityValue.id, newEntityValue);
}

function checkCollisions(circles) {
  // TODO: Mer funktionellt
  let collisions = new Map(); // Key: Den som äter, Value: Den som blir uppäten

  const collisionChecked = (circle1, circle2) => {
    return (
      collisions.get(circle1.id) === circle2.id ||
      collisions.get(circle2.id) === circle1.id
    );
  };

  circles.forEach((circle1) => {
    circles.forEach((circle2) => {
      if (circle1.id === circle2.id) {
        return;
      } else if (collisionChecked(circle1, circle2)) {
        return;
      }

      if (circlesOverlap(circle1, circle2)) {
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
    player.mass += gameState.mapEntities.get(consumedEntityID).mass;
    player.radius = calculateRadius(player.mass);

    removeEntityByID(gameState.mapEntities, consumedEntityID);

    io.emit("entity-eaten", {
      consumedEntityID: consumedEntityID,
      consumer: player,
    });

    // TODO: Flytta
    for (let i = 0; i < 10; ++i) {
      // Generera 10 för att karta är stor
      const food = generateRandomFood();
      gameState.mapEntities.set(food.id, food);
    }
  });
}

function generateRandomFood() {
  const xPos = correctXPositon(
    Math.random() * mapSize.width,
    Food.radius,
    mapSize.width
  );
  const yPos = correctYPositon(
    Math.random() * mapSize.height,
    Food.radius,
    mapSize.height
  );

  return new Food(xPos, yPos);
}

function initializeGame() {
  for (let i = 0; i < 200; ++i) {
    const food = generateRandomFood();
    gameState.mapEntities.set(food.id, food);
  }
}

app.use(express.static("public"));

server.listen(port, () => {
  initializeGame();
  console.log("Server öppnad på port " + port);
});

io.on("connection", (socket) => {
  const disconnectPlayer = () => {
    if (gameState.playerIDs.get(socket.id) !== undefined) {
      const currentScore = gameState.mapEntities.get(
        gameState.playerIDs.get(socket.id)
      ).mass;
      const topScore = gameState.leaderboard.get(socket.id).score;
      if (currentScore > topScore) {
        updateLeaderboard(currentScore, socket.id);
      }
    }

    removePlayerBySocketID(gameState, socket.id);
    socket.broadcast.emit(
      "another-player-disconnected",
      gameState.playerIDs.get(socket.id)
    );
  };

  const updateLeaderboard = (newScore, socketID) => {
    const playerInfo = gameState.leaderboard.get(socketID);
    updateUserScore(playerInfo.username, playerInfo.password, newScore);
    socket.emit("login-success", {
      username: playerInfo.username,
      score: newScore,
    });
  };

  let tickIntervalID = null;

  socket.on("player-joined", () => {
    const player = new Player(2000, 2000);
    updateGameState(gameState, socket.id, player);
    socket.emit("welcome", {
      player: player,
      mapEntites: JSON.stringify(Array.from(gameState.mapEntities)),
    });

    socket.broadcast.emit("another-player-connected", {
      newPlayer: player,
    });

    tickIntervalID = setInterval(() => {
      socket.emit(
        "send-tick",
        JSON.stringify(Array.from(gameState.mapEntities))
      );
    }, updateInterval);
  });

  socket.on("login", async (info) => {
    if (await userExists(info.username, info.password)) {
      const userData = await getUserData(info.username, info.password);
      gameState.leaderboard.set(socket.id, {
        username: userData.name,
        password: info.password,
        score: userData.score,
      });
      socket.emit("login-success", {
        username: userData.name,
        score: userData.score,
      });
    } else {
      socket.emit("login-failed", "Wrong username or password");
    }
  });

  socket.on("add-user", async (info) => {
    const result = await addUser(info.username, info.password);
    if (result === "ER_DUP_ENTRY") {
      socket.emit("login-failed", "User already exists");
      return;
    }

    gameState.leaderboard.set(socket.id, {
      username: info.username,
      password: info.password,
      score: 0,
    });
    socket.emit("login-success", {
      username: info.username,
      score: 0,
    });
  });

  socket.on("tick", (playerPosition) => {
    updatePlayerPosition(gameState, socket.id, playerPosition);
    handleCollisions(checkCollisions(gameState.mapEntities));
    socket.broadcast.emit(
      "state-updated",
      JSON.stringify(Array.from(gameState.mapEntities))
    );
  });

  socket.on("player-left", () => {
    disconnectPlayer();

    clearInterval(tickIntervalID);
    tickIntervalID = null;
  });

  socket.on("disconnect", () => {
    if (tickIntervalID !== null) {
      disconnectPlayer();
    }
  });
});
