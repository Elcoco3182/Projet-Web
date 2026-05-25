

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



//chauves-souris qui vole dans le fond
const bats = Array.from({ length: 6 }, () => ({
  cx: 0.08 + Math.random() * 0.84, cy: 0.04 + Math.random() * 0.25,
  rx: 0.05 + Math.random() * 0.08, ry: 0.015 + Math.random() * 0.030,
  phase: Math.random() * Math.PI * 2, orbitSpd: 0.010 + Math.random() * 0.016,
  wingPhase: Math.random() * Math.PI * 2, wingSpd: 0.13 + Math.random() * 0.10,
}));

function drawBat(bat) {
  bat.phase += bat.orbitSpd; bat.wingPhase += bat.wingSpd;
  const x    = (bat.cx + Math.cos(bat.phase) * bat.rx) * W;
  const y    = (bat.cy + Math.sin(bat.phase * 0.65) * bat.ry) * H;
  const wing = Math.sin(bat.wingPhase);
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(15,5,40,0.90)';
  ctx.beginPath(); ctx.ellipse(0,0,5,3,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-2,0);
  ctx.bezierCurveTo(-9,-16*wing,-20,-11*wing,-22,0);
  ctx.bezierCurveTo(-16,6*Math.abs(wing),-9,9*Math.abs(wing),-2,2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2,0);
  ctx.bezierCurveTo(9,-16*wing,20,-11*wing,22,0);
  ctx.bezierCurveTo(16,6*Math.abs(wing),9,9*Math.abs(wing),2,2); ctx.fill();
  ctx.restore();
}

let t = 0;
function render() {
  requestAnimationFrame(render);
  t++;
  ctx.clearRect(0, 0, W, H);
  drawBackground(); //image plein écran
  drawStars(t);
  for (const bat of bats) drawBat(bat); // chauve-souris
}
render();
