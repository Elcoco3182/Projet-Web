import * as state from "../core/state.js";

export const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, Spacebar: false,
};

export const joystickInput = {
    up: false, down: false, left: false, right: false, killBoutton: false, parfumButton: false,
};

document.addEventListener("keydown", (e) => {
    if (!state.localJoueur) return;
    if (Object.hasOwn(keys, e.key)) keys[e.key] = true;
    if (e.key === " ") keys.Spacebar = true;
});

document.addEventListener("keyup", (e) => {
    if (Object.hasOwn(keys, e.key)) keys[e.key] = false;
    if (e.key === " ") keys.Spacebar = false;
});

// ── Joystick tactile ──────────────────────────────────────────────────────────

const joystickContainer = document.getElementById("joystickContainer");
const joystick          = document.getElementById("joystick");
const killButton        = document.getElementById("killButton");
const parfumButton      = document.getElementById("parfumButton");

let touchStartX = 0, touchStartY = 0, isTouching = false;

joystickContainer.addEventListener("touchstart", (event) => {
    event.preventDefault();
    isTouching = true;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
});

joystickContainer.addEventListener("touchmove", (event) => {
    event.preventDefault();
    if (!isTouching) return;
    const deltaX = event.touches[0].clientX - touchStartX;
    const deltaY = event.touches[0].clientY - touchStartY;
    joystick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;

    const len = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY / len, deltaX / len) * (180 / Math.PI);

    joystickInput.up = joystickInput.down = joystickInput.left = joystickInput.right = false;
    if      (angle >= -45  && angle <=  45)  joystickInput.right = true;
    else if (angle >   45  && angle <  135)  joystickInput.down  = true;
    else if (angle >=  135 || angle <= -135) joystickInput.left  = true;
    else if (angle <  -45  && angle >  -135) joystickInput.up    = true;
});

joystickContainer.addEventListener("touchend", () => {
    joystickInput.up = joystickInput.down = joystickInput.left = joystickInput.right = false;
    isTouching = false;
    joystick.style.transform = "translate(-50%, -50%)";
});

killButton.addEventListener("touchstart", (e) => { joystickInput.killBoutton = true;  e.preventDefault(); });
killButton.addEventListener("touchend",   (e) => { joystickInput.killBoutton = false; e.preventDefault(); });

parfumButton.addEventListener("touchstart", (e) => { joystickInput.parfumButton = true;  e.preventDefault(); });
parfumButton.addEventListener("touchend",   (e) => { joystickInput.parfumButton = false; e.preventDefault(); });