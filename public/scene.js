

const canvas = document.getElementById('scene');
const ctx    = canvas.getContext('2d');
let W, H;

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

//affichage image de fond
const bg = new Image();
bg.src   = 'polytech_night.jpg';

function drawBackground() {
  if (!bg.complete || bg.naturalWidth === 0) {
    ctx.fillStyle = '#0d0825';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const imgR = bg.naturalWidth / bg.naturalHeight;
  const scrR = W / H;
  let dw, dh, dx, dy;
  if (scrR > imgR) {
    dw = W; dh = W / imgR; dx = 0; dy = (H - dh) / 2;
  } else {
    dh = H; dw = H * imgR; dy = 0; dx = (W - dw) / 2;
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(bg, dx, dy, dw, dh);
}

function render() {
  requestAnimationFrame(render);
  ctx.clearRect(0, 0, W, H);
  drawBackground(); //image plein écran
}
render();