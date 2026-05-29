import { obstacles } from "./state.js";

export function collidesWithObstacle(x, y, width, height) {
    for (const obstacle of obstacles) {
        if (
            x + width  / 2 > obstacle.x + 6 &&
            x - width  / 2 < obstacle.x + obstacle.width  - 6 &&
            y + height / 2 > obstacle.y - 6 &&
            y - height / 2 < obstacle.y + obstacle.height - 18
        ) {
            return true;
        }
    }
    return false;
}