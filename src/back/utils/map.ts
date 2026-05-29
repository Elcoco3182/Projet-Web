import rectangles from "../../../public/assets/map/polytech.json" with {
  type: "json",
};

export type Obstacle = { x: number; y: number; width: number; height: number };

export const obstacles: Obstacle[] = rectangles.map((r) => ({
  x: r[0],
  y: r[1],
  width: r[2],
  height: r[3],
}));

export function collidesWithObstacle(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  for (const obstacle of obstacles) {
    if (
      x < obstacle.x + obstacle.width &&
      x + width > obstacle.x &&
      y < obstacle.y + obstacle.height &&
      y + height > obstacle.y
    ) {
      return true;
    }
  }
  return false;
}

function getRandomArbitrary(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function getRandomSpawnPoint(
  maxX: number,
  minX: number,
  maxY: number,
  minY: number,
): { x: number; y: number } {
  let x = 0, y = 0;
  let validSpawn = false;
  while (!validSpawn) {
    x = getRandomArbitrary(minX, maxX);
    y = getRandomArbitrary(minY, maxY);
    if (!collidesWithObstacle(x, y, 60, 50)) {
      validSpawn = true;
    }
  }
  return { x, y };
}
