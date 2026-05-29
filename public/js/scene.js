

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
bg.src   = '../assets/images/polytech_night.jpg';

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


// ─── Villageois ───────────────────────────────────────────────────────────────
class Villager {
  constructor(startX) { this.particles = []; this.init(startX); }
  init(startX) {
    this.x      = startX ?? W + 60 + Math.random() * 280;
    this.fy     = 0.79 + Math.random() * 0.04;
    this.speed  = -(0.38 + Math.random() * 0.30);
    this.scale  = 0.52 + Math.random() * 0.22;
    this.phase  = Math.random() * Math.PI * 2;
    this.pSpeed = 0.060 + Math.random() * 0.025;
  }
  update() {
    this.x += this.speed; this.phase += this.pSpeed;
    if (this.x < -120) this.init(W + 120);
    if (Math.random() < 0.38) {
      this.particles.push({
        x:    this.x - (10 + Math.sin(this.phase)*2.5)*this.scale,
        y:    this.fy*H - 54*this.scale,
        vx:   (Math.random()-.5)*.52, vy:-(0.60+Math.random()*.55),
        life: 1, decay: .033+Math.random()*.028, size: 2.0+Math.random()*2.5,
      });
    }
    this.particles = this.particles
      .map(p => ({...p,x:p.x+p.vx,y:p.y+p.vy,life:p.life-p.decay}))
      .filter(p => p.life > 0);
  }
  drawParticles(c) {
    for (const p of this.particles) {
      c.beginPath(); c.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);
      c.fillStyle = `rgba(255,${Math.floor(125*p.life)},8,${p.life*.8})`; c.fill();
    }
  }
  draw(c) {
    c.save();
    c.translate(this.x, this.fy*H); c.scale(this.scale,this.scale); c.scale(-1,1);
    const t=this.phase, leg=Math.sin(t)*11, arm=Math.sin(t+Math.PI)*5;
    c.fillStyle='#0a0520'; c.strokeStyle='#0a0520'; c.lineCap='round';
    // Tête
    c.beginPath(); c.arc(0,-46,9,0,Math.PI*2); c.fill();
    // Cape
    c.beginPath(); c.moveTo(-11,-38);
    c.bezierCurveTo(-15,-14,-13,0,-10,16); c.lineTo(10,16);
    c.bezierCurveTo(13,0,15,-14,11,-38); c.closePath(); c.fill();
    // Bras + bâton
    c.lineWidth=3.5; c.beginPath(); c.moveTo(10,-28);
    c.lineTo(13+arm*.3,-16); c.lineTo(11+arm*.5,-4); c.stroke();
    c.lineWidth=3; c.beginPath(); c.moveTo(11+arm*.5,-4);
    c.lineTo(13+arm*.5,-32); c.stroke();
    // Flamme
    const fx=13+arm*.5, fl=Math.sin(t*7)*.28;
    c.beginPath(); c.ellipse(fx,-41,5+fl*2,9+fl,0,0,Math.PI*2);
    c.fillStyle=`rgba(255,115,15,${.78+fl})`; c.fill();
    c.beginPath(); c.ellipse(fx,-43,3,6,0,0,Math.PI*2);
    c.fillStyle=`rgba(255,215,65,${.88+fl*.5})`; c.fill();
    // Halo flambeau
    c.save();
    const gl=c.createRadialGradient(fx,-40,0,fx,-40,30);
    gl.addColorStop(0,'rgba(255,145,35,0.22)'); gl.addColorStop(1,'transparent');
    c.fillStyle=gl; c.beginPath(); c.arc(fx,-40,30,0,Math.PI*2); c.fill();
    c.restore();
    // Jambes
    c.strokeStyle='#0a0520'; c.lineWidth=5;
    c.beginPath(); c.moveTo(-3,13); c.lineTo(-5+leg,23); c.lineTo(-4+leg,30); c.stroke();
    c.beginPath(); c.moveTo( 3,13); c.lineTo( 5-leg,23); c.lineTo( 4-leg,30); c.stroke();
    c.restore();
  }
}
const villagers = Array.from({ length: 6 }, (_,i) =>
  new Villager(W + 80 + i*100 + Math.random()*40)
);

// ─── Lucioles ─────────────────────────────────────────────────────────────────
const fireflies = Array.from({ length: 28 }, () => ({
  x:Math.random(), fy:.55+Math.random()*.38,
  vx:(Math.random()-.5)*.0002, vy:(Math.random()-.5)*.00014,
  phase:Math.random()*Math.PI*2, speed:.022+Math.random()*.038, r:1.2+Math.random()*1.2,
}));

function drawFirefly(ff) {
  ff.phase += ff.speed*.01;
  ff.x = ((ff.x+ff.vx+Math.sin(ff.phase)*.0003)+1)%1;
  ff.fy += ff.vy+Math.cos(ff.phase*.7)*.0001;
  ff.fy = Math.max(.52,Math.min(.92,ff.fy));
  const blink = Math.abs(Math.sin(ff.phase*1.7));
  if (blink < .22) return;
  const x=ff.x*W, y=ff.fy*H;
  const g=ctx.createRadialGradient(x,y,0,x,y,ff.r*5);
  g.addColorStop(0,`rgba(130,255,80,${blink*.85})`);
  g.addColorStop(.4,`rgba(60,195,35,${blink*.32})`);
  g.addColorStop(1,'transparent');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,ff.r*5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,ff.r,0,Math.PI*2);
  ctx.fillStyle=`rgba(195,255,130,${blink})`; ctx.fill();
}

// ─── Brume légère au sol ──────────────────────────────────────────────────────
function drawMist(t) {
  for (let i = 0; i < 2; i++) {
    const drift = Math.sin(t*.00016 + i*1.5)*W*.05;
    const gr = ctx.createRadialGradient(W*.5+drift, H*.92, 0, W*.5+drift, H*.92, W*(.5-i*.06));
    gr.addColorStop(0, `rgba(80,45,140,${[.09,.06][i]})`);
    gr.addColorStop(1, 'transparent');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(W*.5+drift, H*(.93+i*.02), W*(.60-i*.07), H*.055, 0, 0, Math.PI*2);
    ctx.fill();
  }
}


//la boucle principale
let t = 0;
function render() {
  requestAnimationFrame(render);
  t++;
  ctx.clearRect(0, 0, W, H);
  drawBackground(); //image plein écran
  drawStars(t);
  for (const bat of bats) drawBat(bat); // chauve-souris
  for (const v of villagers) v.drawParticles(ctx); //Particules feu
  for (const w of wolves) { w.update(); w.draw(ctx); }//Loups
  for (const v of villagers) { v.update(); v.draw(ctx); } // Villageois
  drawMist(t);// 7 — Brume
  for (const ff of fireflies) drawFirefly(ff);// 8 — Lucioles

}
render();


// ─── Effet 3D carte ───
const card  = document.querySelector('.card');
const shine = document.querySelector('.card-shine');
document.addEventListener('mousemove', (e) => {
  const rect = card.getBoundingClientRect();
  const dx   = (e.clientX - rect.left - rect.width/2)  / (window.innerWidth  * .45);
  const dy   = (e.clientY - rect.top  - rect.height/2) / (window.innerHeight * .45);
  const rx   = Math.max(-12, Math.min(12, -dy * 11));
  const ry   = Math.max(-12, Math.min(12,  dx * 11));
  card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  const px = ((e.clientX-rect.left)/rect.width*100).toFixed(1);
  const py = ((e.clientY-rect.top)/rect.height*100).toFixed(1);
  shine.style.background =
    `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.06) 0%, transparent 52%)`;
});
document.addEventListener('mouseleave', () => {
  card.style.transform = 'rotateX(0deg) rotateY(0deg)';
  shine.style.background = 'none';
});