export class Vector2D {
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

export class Circle {
  constructor(xPos, yPos, radius, color) {
    this.id = crypto.randomUUID();
    this.x = xPos;
    this.y = yPos;
    this.radius = radius;
    this.color = color;
  }
}

export function circlesOverlap(circle1, circle2) {
  return (
    Math.sqrt((circle2.x - circle1.x) ** 2 + (circle2.y - circle1.y) ** 2) <=
    circle2.radius
  );
}

//module.exports = { Vector2D, Circle, circlesOverlap };
