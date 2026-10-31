// Общая заготовка для проверок экранов: поднимает настоящий index.html в jsdom с подставными
// холстом, аудио и (по желанию) плагинами Capacitor, затем запускает main.js.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function boot(wwwPath, { capacitor = null, startApp = true, storage = null } = {}) {
  const dom = new JSDOM(fs.readFileSync(wwwPath + '/index.html', 'utf8'), { pretendToBeVisual: true });
  const w = dom.window;

  // холст без рисования
  const noopCtx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
  w.HTMLCanvasElement.prototype.getContext = () => noopCtx;
  // звук без воспроизведения
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  w.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
    resume() { return Promise.resolve(); }
    createGain() { return { gain: param(), connect() {} }; }
    createOscillator() { return { type: '', frequency: param(), connect() {}, start() {}, stop() {} }; }
    createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: '', Q: param(), frequency: param(), connect() {} }; }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
  };
  if (capacitor) w.Capacitor = capacitor;

  const store = storage || {};
  Object.assign(globalThis, {
    document: w.document, window: w, matchMedia: () => ({ matches: true }), getSelection: () => ({ toString: () => '' }),
    requestAnimationFrame: () => 0, DOMParser: w.DOMParser, TextDecoder,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    location: { reload() { globalThis.__reloaded = true; } },
  });
  Object.defineProperty(globalThis, 'navigator', { value: { vibrate() {} }, configurable: true });
  w.matchMedia = globalThis.matchMedia; w.requestAnimationFrame = () => 0;
  globalThis.setInterval = () => 1; globalThis.clearInterval = () => {};
  const realTimeout = globalThis.setTimeout;
  // таймеры не идут сами: копим их и запускаем вручную через flush()
  const pending = [];
  globalThis.setTimeout = f => { pending.push(f); return pending.length; }; globalThis.clearTimeout = () => {};
  const flush = () => { const list = pending.splice(0); list.forEach(f => { try { f(); } catch (e) { /* как в браузере: ошибка в таймере не ломает остальное */ } }); };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get: () => 100 });
  w.HTMLElement.prototype.scrollTo = function () {};

  const url = pathToFileURL(wwwPath).href;
  const $ = id => w.document.getElementById(id);
  const sleep = () => new Promise(r => realTimeout(r, 40));
  let fails = 0;
  const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) fails++; };
  const St = await import(url + '/js/store.js');
  St.load();
  if (startApp) { await import(url + '/js/main.js'); await sleep(); }
  const done = () => process.exit(fails ? 1 : 0);
  return { w, $, url, sleep, ok, done, St, store, flush };
}
