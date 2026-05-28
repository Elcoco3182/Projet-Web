import { localJoueur } from "../core/state.js";

export const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, Spacebar: false,
};

export const joystickInput = {
    up: false, down: false, left: false, right: false, killBoutton: false,
};

document.addEventListener("keydown", (e) => {
    if (!localJoueur) return;
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

let touchStartX = 0;
let touchStartY = 0;
let isTouching  = false;

joystickContainer.addEventListener("touchstart", (event) => {
    event.preventDefault();
    isTouching  = true;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
});

joystickContainer.addEventListener("touchmove", (event) => {
    event.preventDefault();
    if (!isTouching) return;

    const deltaX = event.touches[0].clientX - touchStartX;
    const deltaY = event.touches[0].clientY - touchStartY;

    joystick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;

    const angle = Math.atan2(
        deltaY / Math.sqrt(deltaX * deltaX + deltaY * deltaY),
        deltaX / Math.sqrt(deltaX * deltaX + deltaY * deltaY),
    ) * (180 / Math.PI);

    joystickInput.up    = false;
    joystickInput.down  = false;
    joystickInput.left  = false;
    joystickInput.right = false;

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

killButton.addEventListener("touchstart", (event) => { joystickInput.killBoutton = true;  event.preventDefault(); });
killButton.addEventListener("touchend",   (event) => { joystickInput.killBoutton = false; event.preventDefault(); });