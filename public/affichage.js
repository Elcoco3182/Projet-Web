function preloadImages(callback,images) {
    const toLoad = ["tank", "grass"];
    let loaded = 0;

    toLoad.forEach(name => {
        images[name] = new Image();
        images[name].src = `/assets/images/${name}.png`;
        images[name].onload = () => {
            loaded++;
            if (loaded === toLoad.length) callback();
        };
    });
}

function drawJoueurImage(x, y, type, images) {
    ctx.save();
    ctx.translate(x, y);

    //  Draw the body of the player
    if (isMidnight){
        switch (type) {
        case "assassin":
            ctx.drawImage(
                img,        // l'image source
                sx, sy,     // position dans la spritesheet (source X, source Y)
                w, h,     // taille de la zone à découper dans la source
                x, y,     // position sur le canvas (destination)
                w, h      // taille à laquelle l'afficher (peut être différente de sw/sh)
            );
            break;
        case "innocent":
            ctx.fillStyle = "green";
            break;
        case "petitefille":
            ctx.fillStyle = "blue";
            break;
        default:
            ctx.fillStyle = "green";
            break;
        }
    }
    else {
        ctx.fillStyle = "green";
    }
    ctx.fillRect(-20, -10, 40, 20);

    ctx.restore();
}