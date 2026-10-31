// «Масляная» подложка из мазков на canvas (перенесено из reference/reader.html).
export function paint(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  cv.width = w * dpr; cv.height = h * dpr;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const sky = g.createLinearGradient(0, 0, w * .4, h);
  sky.addColorStop(0, '#1d1528'); sky.addColorStop(.55, '#120e19'); sky.addColorStop(1, '#1a1222');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);

  const cols = ['#3a2a52', '#2a1f3d', '#4b3668', '#231a31', '#563f73', '#1b1526', '#33264a', '#2f2240', '#47345e'];
  const n = Math.round(w * h / 900);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h;
    rnd();   // «теплота» из прототипа не используется, но сдвигает последовательность — оставлено ради того же узора
    const c = cols[Math.floor(rnd() * cols.length)];
    g.save(); g.translate(x, y); g.rotate(-.9 + rnd() * .5 + (rnd() < .2 ? 1.4 : 0));
    g.globalAlpha = .05 + rnd() * .12; g.fillStyle = c;
    const L = 20 + rnd() * 90, T = 3 + rnd() * 9;
    g.beginPath(); g.ellipse(0, 0, L, T, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha *= .6; g.fillRect(-L * .8, -T * .3, L * 1.6, T * .25);
    g.restore();
  }
  const vig = g.createRadialGradient(w * .35, h * .45, h * .1, w * .35, h * .45, Math.max(w, h) * .8);
  vig.addColorStop(0, 'rgba(6,4,10,.35)'); vig.addColorStop(1, 'rgba(6,4,10,.75)');
  g.globalAlpha = 1; g.fillStyle = vig; g.fillRect(0, 0, w, h);
}
