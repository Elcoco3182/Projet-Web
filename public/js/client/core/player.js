import * as state from "./state.js";
import { collidesWithObstacle } from "./collision.js";

export class Joueur {
    constructor(x, y) {
        this.id    = 0;
        this.x     = x;
        this.y     = y;
        this.died  = false;
        this.dead  = false; // synchronisé avec le serveur
        this.speed = 4;
        this.isParfume = false;
    }

    moveUp(dt) {
        const newY = this.y - this.speed * dt * 60;
        // Les fantômes traversent les obstacles et les bords
        if (state.isSpectator) { this.y = newY; return; }
        if (!collidesWithObstacle(this.x, newY, 40, 40) && newY >= 20) this.y = newY;
    }

    moveDown(dt) {
        const newY = this.y + this.speed * dt * 60;
        if (state.isSpectator) { this.y = newY; return; }
        if (!collidesWithObstacle(this.x, newY, 40, 40) && newY <= state.mapHeight - 20) this.y = newY;
    }

    moveLeft(dt) {
        const newX = this.x - this.speed * dt * 60;
        if (state.isSpectator) { this.x = newX; return; }
        if (!collidesWithObstacle(newX, this.y, 40, 40) && newX >= 20) this.x = newX;
    }

    moveRight(dt) {
        const newX = this.x + this.speed * dt * 60;
        if (state.isSpectator) { this.x = newX; return; }
        if (!collidesWithObstacle(newX, this.y, 40, 40) && newX <= state.mapWidth - 20) this.x = newX;
    }

    canKill() {
        // Un fantôme ne peut pas tuer
        if (state.isSpectator) return false;
        return state.isMidnight && state.localJoueur.type === "assassin";
    }

    canParfume() {
        // Un fantôme ne peut pas parfumer
        if (state.isSpectator) return false;
        return !state.players.some((player) => player.isParfume);
    }

    tryKill(socket) {
        if (state.isSpectator) return;
        const target = state.players.find((p) => {
            if (p.id === state.localJoueur.id) return false;
            if (p.dead) return false; // ne peut pas cibler un fantôme
            const dx = p.x - state.localJoueur.x;
            const dy = p.y - state.localJoueur.y;
            return Math.sqrt(dx * dx + dy * dy) < 80;
        });
        if (target && this.canKill()) {
            socket.send(JSON.stringify({ type: "killFromAssassin", targetId: target.id }));
        }
    }

    tryParfume(socket) {
        if (state.isSpectator) return;
        const target = state.players.find((p) => {
            if (p.id === state.localJoueur.id) return false;
            if (p.dead) return false; // ne peut pas parfumer un fantôme
            const dx = p.x - state.localJoueur.x;
            const dy = p.y - state.localJoueur.y;
            return Math.sqrt(dx * dx + dy * dy) < 60;
        });
        if (target && this.canParfume()) {
            socket.send(JSON.stringify({ type: "parfume", targetId: target.id }));
        }
    }
}
