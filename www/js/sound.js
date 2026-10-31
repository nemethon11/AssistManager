// Звуки приложения. Все синтезируются на лету через Web Audio — готовых файлов нет, ничего из игр не использовано.
// Выключаются в настройках (S.settings.sound); фоновый треск огня — отдельно (S.settings.ambient).
import { S } from './store.js';

let ctx = null, master = null, noiseBuf = null, ambT = null;

const on = () => !!(S && S.settings && S.settings.sound);

function ac() {
  if (!on()) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = .55;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Браузер разрешает звук только после касания — вызывается при первом касании экрана.
export function unlock() { ac(); }

function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

// Огибающая громкости: быстрый подъём и плавное затухание.
function env(g, t, attack, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

// Один тон. freq2 — к какой частоте плавно скользит звук.
function tone(c, { type = 'sine', freq, freq2, t = 0, attack = .005, dur = .3, gain = .3, lp }) {
  const t0 = c.currentTime + t;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, t0 + dur);
  env(g, t0, attack, gain, dur);
  let out = o;
  if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); out = f; }
  out.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + .05);
}

// Всплеск шума через фильтр: шорох, треск, свист.
function hiss(c, { t = 0, dur = .1, gain = .1, type = 'bandpass', f = 2000, f2, q = 1, attack = .005 }) {
  const t0 = c.currentTime + t;
  const s = c.createBufferSource();
  s.buffer = noise(c);
  const fl = c.createBiquadFilter(), g = c.createGain();
  fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t0);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  env(g, t0, attack, gain, dur);
  s.connect(fl); fl.connect(g); g.connect(master);
  s.start(t0, Math.random() * .5); s.stop(t0 + dur + .05);
}

/* ---------- события ---------- */

// Отметка привычки: сухой деревянный «тук».
export function check() {
  const c = ac(); if (!c) return;
  tone(c, { freq: 240, freq2: 120, dur: .12, gain: .35 });
  hiss(c, { dur: .04, gain: .12, f: 1800, q: 2 });
}
export function uncheck() {
  const c = ac(); if (!c) return;
  tone(c, { freq: 160, freq2: 80, dur: .14, gain: .22 });
}

// Вспышка огня при выполнении: взлетающий шорох и мерцающий перебор нот.
export function flash() {
  const c = ac(); if (!c) return;
  hiss(c, { dur: .7, gain: .16, type: 'bandpass', f: 400, f2: 5000, q: .7, attack: .15 });
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, { type: 'triangle', freq: f, t: .05 + i * .08, dur: .6, gain: .12 }));
}

// Колокол: набор негармоничных обертонов с разным затуханием.
export function bell() {
  const c = ac(); if (!c) return;
  [[1, .3, 2.2], [2.76, .16, 1.5], [5.4, .09, 1.0], [8.93, .05, .6]].forEach(([k, gn, d]) => {
    tone(c, { freq: 660 * k, dur: d, gain: gn });
  });
}
// Сигнал конца таймера: колокол, потом вспышка.
export function timerEnd() { bell(); setTimeout(flash, 350); }

// Новый уровень огня: восходящая медная фанфара.
export function levelUp() {
  const c = ac(); if (!c) return;
  [392, 493.88, 587.33, 783.99].forEach((f, i) => tone(c, { type: 'sawtooth', freq: f, t: i * .13, dur: i === 3 ? .9 : .3, gain: .12, lp: 1400 }));
  hiss(c, { t: .3, dur: .8, gain: .08, f: 600, f2: 4000, q: .8, attack: .2 });
}

// Новый ранг: низкий торжественный аккорд, медленно нарастающий, и колокол.
export function rankUp() {
  const c = ac(); if (!c) return;
  [130.81, 196, 261.63, 329.63, 392].forEach(f => tone(c, { type: 'sawtooth', freq: f, attack: .5, dur: 2.2, gain: .09, lp: 900 }));
  setTimeout(bell, 600);
}

// Листание абзаца: мягкий шорох бумаги.
export function page() {
  const c = ac(); if (!c) return;
  hiss(c, { dur: .1, gain: .07, f: 3200, f2: 1800, q: .6, attack: .01 });
  hiss(c, { t: .03, dur: .07, gain: .04, type: 'highpass', f: 5000 });
}

// Несколько хлопков — когда трогаешь огонь.
export function crackle(n = 5) {
  const c = ac(); if (!c) return;
  for (let i = 0; i < n; i++) pop(c, i * (.04 + Math.random() * .09), .12);
}

function pop(c, t, vol) {
  hiss(c, { t, dur: .008 + Math.random() * .03, gain: vol * (.3 + Math.random() * .7), type: 'highpass', f: 1800 + Math.random() * 4500, attack: .002 });
}

/* ---------- фоновый треск на главном экране ---------- */
// isActive() — можно ли сейчас играть (главный экран виден); getLevel() — уровень огня: чем выше, тем чаще треск.
export function startAmbient(isActive, getLevel) {
  stopAmbient();
  const loop = () => {
    const lvl = getLevel() || 0;
    ambT = setTimeout(() => {
      if (on() && S.settings.ambient && ctx && ctx.state === 'running' && isActive()) pop(ctx, 0, .05);
      loop();
    }, (150 + Math.random() * 900) / (1 + lvl * .35));
  };
  loop();
}
export function stopAmbient() { clearTimeout(ambT); ambT = null; }
