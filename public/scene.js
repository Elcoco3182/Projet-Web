

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

// ─── Loups ────────────────────────────────────────────────────────────────────
class Wolf {
  constructor(initX) { this.init(initX); }
  init(startX) {
    this.x      = startX ?? -(80 + Math.random() * 500);
    this.fy     = 0.68 + Math.random() * 0.07;
    this.speed  = 1.4 + Math.random() * 1.2;
    this.scale  = 0.48 + Math.random() * 0.34;
    this.phase  = Math.random() * Math.PI * 2;
    this.pSpeed = 0.10 + Math.random() * 0.07;
  }
  update() {
    this.x     += this.speed;
    this.phase += this.pSpeed;
    if (this.x > W + 200) this.init(-180);
  }
  draw(c) {
    c.save();
    c.translate(this.x, this.fy * H + Math.sin(this.phase * 2) * 1.5);
    c.scale(this.scale, this.scale);
    const t  = this.phase;
    const fc = 'rgba(12, 5, 30, 0.93)';
    c.fillStyle = fc; c.strokeStyle = fc;
    c.lineCap = 'round'; c.lineJoin = 'round';
    // Queue
    c.beginPath(); c.moveTo(-32, -4);
    c.bezierCurveTo(-44,-14+Math.sin(t*.8)*6,-54,-10+Math.sin(t*.8)*4,-52,-24+Math.cos(t*.6)*7);
    c.lineWidth = 7; c.stroke();
    // Corps
    c.beginPath(); c.moveTo(-32, 2);
    c.bezierCurveTo(-28,-17,-8,-19,8,-14);
    c.bezierCurveTo(20,-9,32,-12,40,-9);
    c.bezierCurveTo(46,-7,48,-2,45,4);
    c.bezierCurveTo(34,9,4,11,-16,9);
    c.bezierCurveTo(-26,7,-33,5,-32,2); c.fill();
    // Tête
    c.beginPath(); c.moveTo(34,-9);
    c.bezierCurveTo(42,-20,50,-23,57,-17);
    c.bezierCurveTo(64,-12,70,-5,68,1);
    c.bezierCurveTo(65,7,55,6,46,2);
    c.bezierCurveTo(38,-2,32,-5,34,-9); c.fill();
    // Museau
    c.beginPath(); c.moveTo(60,-2);
    c.bezierCurveTo(68,-4,76,-2,78,2);
    c.bezierCurveTo(79,5,75,8,68,7);
    c.bezierCurveTo(61,6,57,2,60,-2); c.fill();
    // Oreilles
    c.beginPath(); c.moveTo(50,-17); c.lineTo(45,-31); c.lineTo(60,-21); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(57,-15); c.lineTo(55,-28); c.lineTo(66,-20); c.closePath();
    c.fillStyle = 'rgba(12,5,30,0.45)'; c.fill(); c.fillStyle = fc;
    // Pattes
    const l1=Math.sin(t)*18, l2=Math.sin(t+Math.PI)*18;
    const b1=Math.abs(Math.sin(t+.4))*9, b2=Math.abs(Math.sin(t+Math.PI+.4))*9;
    c.lineWidth = 5.5;
    [[22,7,l1,b1],[14,9,l2,b2],[-14,8,l2,b2],[-20,6,l1,b1]].forEach(([ox,oy,l,b]) => {
      c.beginPath(); c.moveTo(ox,oy);
      c.lineTo(ox+l*.35, oy+9-b*.3); c.lineTo(ox+l, 27); c.stroke();
    });
    c.restore();
  }
}
const wolves = Array.from({ length: 4 }, (_, i) =>
  new Wolf(-(i * 300 + Math.random() * 120))
);

let t = 0;
function render() {
  requestAnimationFrame(render);
  t++;
  ctx.clearRect(0, 0, W, H);
  drawBackground(); //image plein écran
  drawStars(t);
  for (const bat of bats) drawBat(bat); // chauve-souris
  for (const w of wolves) { w.update(); w.draw(ctx); }// 5 — Loups
}
render();
