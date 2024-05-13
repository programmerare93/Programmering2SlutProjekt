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

class Circle {
  constructor(xPos, yPos, radius, color) {
    this.id = crypto.randomUUID();
    this.x = xPos;
    this.y = yPos;
    this.radius = radius;
    this.color = color;
  }
}

function circlesOverlap(circle1, circle2) {
  return (
    (circle1.x - circle2.x) ** 2 + (circle1.y - circle2.y) ** 2 <=
    (circle1.radius / 2 + circle2.radius / 2) ** 2
  );
}

module.exports = { Vector2D, Circle, circlesOverlap };
