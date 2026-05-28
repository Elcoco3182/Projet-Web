import { mapWidth, mapHeight, players, localJoueur, isMidnight } from "./state.js";
import { collidesWithObstacle } from "./collision.js";

export class Joueur {
    constructor(x, y) {
        this.id    = 0;
        this.x     = x;
        this.y     = y;
        this.died  = false;
        this.speed = 8;
    }

    moveUp(dt) {
        const newY = this.y - this.speed * dt * 60;
        if (!collidesWithObstacle(this.x, newY, 40, 40) && newY >= 20)
            this.y = newY;
    }

    moveDown(dt) {
        const newY = this.y + this.speed * dt * 60;
        if (!collidesWithObstacle(this.x, newY, 40, 40) && newY <= mapHeight - 20)
            this.y = newY;
    }

    moveLeft(dt) {
        const newX = this.x - this.speed * dt * 60;
        if (!collidesWithObstacle(newX, this.y, 40, 40) && newX >= 20)
            this.x = newX;
    }

    moveRight(dt) {
        const newX = this.x + this.speed * dt * 60;
        if (!collidesWithObstacle(newX, this.y, 40, 40) && newX <= mapWidth - 20)
            this.x = newX;
    }

    canKill() {
        return isMidnight && localJoueur.type === "assassin";
    }

    tryKill(socket) {
        const target = players.find((p) => {
            if (p.id === localJoueur.id) return false;
            const dx = p.x - localJoueur.x;
            const dy = p.y - localJoueur.y;
            return Math.sqrt(dx * dx + dy * dy) < 80;
        });
        if (target && this.canKill()) {
            socket.send(JSON.stringify({ type: "kill", targetId: target.id }));
        }
    }
}