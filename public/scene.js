

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


// étoiles scintillantes dans le fond
const stars = Array.from({ length: 60 }, () => ({
  fx:    Math.random(),
  fy:    Math.random() * 0.42,
  size:  0.4 + Math.random() * 1.6,
  phase: Math.random() * Math.PI * 2,
  speed: 0.4 + Math.random() * 1.4,
}));

function drawStars(t) {
  for (const s of stars) {
    const bri = 0.3 + 0.7 * Math.abs(Math.sin(s.phase + t * s.speed * 0.007));
    ctx.beginPath();
    ctx.arc(s.fx * W, s.fy * H, s.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${bri})`;
    ctx.fill();
  }
}

let t = 0;
function render() {
  requestAnimationFrame(render);
  t++;
  ctx.clearRect(0, 0, W, H);
  drawBackground(); //image plein écran
  drawStars(t);
}
render();
