export function generateRandomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

export function correctXPositon(xPos, radius, mapWidth) {
  if (xPos < radius) {
    return radius;
  } else if (xPos > mapWidth - radius) {
    return mapWidth - radius;
  } else {
    return xPos;
  }
}

export function correctYPositon(yPos, radius, mapHeight) {
  if (yPos < radius) {
    return radius;
  } else if (yPos > mapHeight - radius) {
    return mapHeight - radius;
  } else {
    return yPos;
  }
}
