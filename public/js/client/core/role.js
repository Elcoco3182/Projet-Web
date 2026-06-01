import { players } from "../core/state.js";

export function removeParfume(){
    players.forEach((player) => {
        player.isParfume = false;
    })
}