export const AVATARS = ["innocent", "policeman", "parasolLady", "baby", "vieu", "giovanni", "clown"];

export const images = {};

export function preloadImages(callback) {
    const toLoad = [
        "assassin", "innocent", "petitefille", "parfumeuse",
        "mapImage", "policeman", "parasolLady", "baby", "vieu",
        "giovanni", "clown", "fantome", "admin",
    ];
    let loaded = 0;
    toLoad.forEach((name) => {
        images[name] = new Image();
        images[name].src = `/assets/images/${name}.png`;
        images[name].onload  = () => { if (++loaded === toLoad.length) callback(); };
        images[name].onerror = () => { if (++loaded === toLoad.length) callback(); };
    });
}