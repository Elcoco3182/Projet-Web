export const AVATARS = ["innocent", "policeman", "parasolLady", "baby", "vieu", "giovanni"];

export const images = {};

export function preloadImages(callback) {
    const toLoad = ["assassin", "innocent", "petitefille", "mapImage", "policeman", "parasolLady", "baby", "vieu", "giovanni"];
    let loaded = 0;
    toLoad.forEach((name) => {
        images[name] = new Image();
        images[name].src = `/assets/images/${name}.png`;
        images[name].onload = () => { if (++loaded === toLoad.length) callback(); };
        images[name].onerror = () => { if (++loaded === toLoad.length) callback(); }; // ne pas bloquer si image manquante
    });
}