// Огонь на canvas и 10 уровней по стрику (перенесено из reference/ogonek.html).

export const LEVELS = [
  { min: 0,   name: 'Уголёк',       c: ['#5a2a1c', '#8a3a1e', '#c4572a'], h: .30, sparks: 0 },
  { min: 1,   name: 'Искра',        c: ['#d9481a', '#ff8a1f', '#ffd27a'], h: .42, sparks: 2 },
  { min: 3,   name: 'Огонёк',       c: ['#e2501b', '#ff9a24', '#ffe08f'], h: .52, sparks: 4 },
  { min: 7,   name: 'Костёр',       c: ['#e8441a', '#ffa22a', '#fff0b0'], h: .62, sparks: 8 },
  { min: 14,  name: 'Пламя',        c: ['#ff3d24', '#ffb02e', '#fff6cf'], h: .70, sparks: 12 },
  { min: 30,  name: 'Горнило',      c: ['#ff5a1f', '#ffc244', '#bfe6ff'], h: .76, sparks: 16 },
  { min: 60,  name: 'Синее пламя',  c: ['#2f6bff', '#5fb2ff', '#e6f6ff'], h: .80, sparks: 20 },
  { min: 100, name: 'Плазма',       c: ['#7a2cff', '#c35bff', '#ffe1ff'], h: .84, sparks: 24, ring: 1 },
  { min: 200, name: 'Звёздный жар', c: ['#ff9d2e', '#ffe27a', '#ffffff'], h: .88, sparks: 30, ring: 1 },
  { min: 365, name: 'Солнце',       c: ['#ffb02e', '#fff0a0', '#ffffff'], h: .92, sparks: 38, ring: 2 },
];

export const levelOf = n => {
  let i = 0;
  LEVELS.forEach((l, j) => { if (n >= l.min) i = j; });
  return i;
};

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';

/**
 * Создаёт огонь на переданном canvas. Возвращает управление:
 *  setLevel(i) — плавно перейти к уровню, burst() — вспышка, poke() — раздуть от нажатия.
 */
export function createFlame(cv, startLevel = 0) {
  const cx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1;
  let target = startLevel;
  let boost = 0;
  const sparks = [];
  const L0 = LEVELS[startLevel];
  const cur = { c: L0.c.map(hex), h: L0.h, sp: L0.sparks, ring: L0.ring || 0 };

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', size);

  function spawn(big) {
    const base = H * .86;
    sparks.push({
      x: W / 2 + (Math.random() - .5) * W * (big ? .35 : .18),
      y: base - Math.random() * H * .2,
      vx: (Math.random() - .5) * (big ? 2.4 : .6),
      vy: -(1 + Math.random() * (big ? 4 : 1.8)),
      life: 1,
      r: 1 + Math.random() * (big ? 2.6 : 1.6),
    });
  }

  // Один «язык» пламени: контур строится по точкам и качается во времени.
  function tongue(t, baseY, w, h, phase, layer) {
    const N = 26, pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      let hw = w * Math.sqrt(u) * Math.pow(1 - u, 1.3) / 0.345;
      hw *= 1 + .09 * Math.sin(t * 7 + u * 11 + phase) + .05 * Math.sin(t * 13 + u * 23 + layer);
      const sway = (Math.sin(t * 2.1 + phase) * .5 + Math.sin(t * 3.7 + u * 4) * .5) * w * .28 * u * u;
      pts.push([sway, hw, baseY - u * h]);
    }
    cx.beginPath();
    cx.moveTo(W / 2 + pts[0][0], pts[0][2]);
    for (let i = 1; i <= N; i++) cx.lineTo(W / 2 + pts[i][0] - pts[i][1], pts[i][2]);
    for (let i = N; i >= 0; i--) cx.lineTo(W / 2 + pts[i][0] + pts[i][1], pts[i][2]);
    cx.closePath();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    // Не рисуем, если огня не видно: экран скрыт, холст спрятан или главный экран закрыт читалкой/таймером.
    if (document.hidden || cv.offsetWidth === 0 || (document.body.classList.contains('covered') && cv.closest('#home'))) {
      requestAnimationFrame(frame);
      return;
    }
    if (!W || !H) size();   // холст создали скрытым — размер узнаём, когда он появился
    const t = now / 1000;
    const L = LEVELS[target];
    const k = 1 - Math.pow(.02, dt);
    L.c.forEach((h, i) => { const c = hex(h); for (let j = 0; j < 3; j++) cur.c[i][j] += (c[j] - cur.c[i][j]) * k; });
    cur.h += (L.h - cur.h) * k;
    cur.sp += (L.sparks - cur.sp) * k;
    cur.ring += ((L.ring || 0) - cur.ring) * k;
    boost = Math.max(0, boost - dt * .9);

    cx.clearRect(0, 0, W, H);
    const baseY = H * .88, fh = H * cur.h * (1 + boost * .25), fw = W * .2 * (.7 + cur.h * .6) * (1 + boost * .2);

    // Свечение. Радиус не больше расстояния до краёв холста — иначе на краю остаётся резкая светлая рамка.
    const gx = W / 2, gy = baseY - fh * .35;
    const gr = Math.max(1, Math.min(fh * .95, gy, H - gy, W / 2));
    const g = cx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, rgba(cur.c[1], .34 + boost * .25));
    g.addColorStop(.55, rgba(cur.c[1], .12 + boost * .1));
    g.addColorStop(1, rgba(cur.c[0], 0));
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);

    // кольца на высоких уровнях
    if (cur.ring > .02) {
      cx.save(); cx.translate(W / 2, baseY - fh * .42);
      for (let r = 0; r < 2; r++) {
        const a = cur.ring - r;
        if (a <= 0) continue;
        cx.rotate(t * (r ? -.25 : .35));
        cx.strokeStyle = rgba(cur.c[2], .18 * Math.min(1, a));
        cx.lineWidth = 1.5; cx.setLineDash([3, 9 + r * 6]);
        cx.beginPath(); cx.arc(0, 0, fh * (.62 + r * .14), 0, Math.PI * 2); cx.stroke();
      }
      cx.restore();
    }

    // уголь в основании
    const cg = cx.createRadialGradient(W / 2, baseY, 0, W / 2, baseY, fw * 1.3);
    cg.addColorStop(0, rgba(cur.c[1], .55)); cg.addColorStop(1, rgba(cur.c[0], 0));
    cx.fillStyle = cg; cx.beginPath(); cx.ellipse(W / 2, baseY, fw * 1.3, fw * .35, 0, 0, Math.PI * 2); cx.fill();

    // три слоя пламени
    cx.globalCompositeOperation = 'lighter';
    const layers = [[1, 1, 0, .85], [.68, .78, 1.7, .9], [.38, .52, 3.1, 1]];
    layers.forEach((ly, i) => {
      tongue(t, baseY, fw * ly[0], fh * ly[1], ly[2], i);
      const lg = cx.createLinearGradient(0, baseY, 0, baseY - fh * ly[1]);
      const c = cur.c[i];
      lg.addColorStop(0, rgba(c, ly[3])); lg.addColorStop(.7, rgba(c, ly[3] * .75)); lg.addColorStop(1, rgba(c, 0));
      cx.fillStyle = lg; cx.fill();
    });

    // боковые языки у больших огней
    if (cur.h > .55) {
      [-1, 1].forEach((s, i) => {
        cx.save(); cx.translate(s * fw * .42, 0);
        tongue(t * 1.3, baseY - fh * .02, fw * .38, fh * .5 * (cur.h - .3), i * 2 + 5, i);
        const lg = cx.createLinearGradient(0, baseY, 0, baseY - fh * .4);
        lg.addColorStop(0, rgba(cur.c[1], .6)); lg.addColorStop(1, rgba(cur.c[0], 0));
        cx.fillStyle = lg; cx.fill(); cx.restore();
      });
    }

    // искры
    if (!reduce && Math.random() < cur.sp * dt * 1.4) spawn(false);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx + Math.sin(t * 3 + i) * .3; p.y += p.vy; p.vy *= .995; p.life -= dt * .8;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      cx.fillStyle = rgba(cur.c[2], p.life);
      cx.beginPath(); cx.arc(p.x, p.y, p.r * p.life + .3, 0, Math.PI * 2); cx.fill();
    }
    cx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(frame);
  }

  size();
  requestAnimationFrame(frame);

  return {
    setLevel(i) { target = i; },
    burst() { boost = 1; for (let i = 0; i < 60; i++) spawn(true); },
    poke() { boost = Math.max(boost, .55); for (let i = 0; i < 14; i++) spawn(true); },
    resize: size,
  };
}
