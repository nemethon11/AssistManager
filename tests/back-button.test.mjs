import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
const wwwPath = process.argv[2];
const dom = new JSDOM(fs.readFileSync(wwwPath + '/index.html', 'utf8'), { pretendToBeVisual: true });
const w = dom.window;
const noopCtx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
w.HTMLCanvasElement.prototype.getContext = () => noopCtx;

// Подставной аудио-движок: считает созданные узлы и ловит ошибки в цепочках
const created = { osc: 0, src: 0 };
const node = () => new Proxy(function () {}, {
  get: (t, k) => k === 'value' ? 0 : k === 'currentTime' ? 0 : k === 'sampleRate' ? 44100 : (k === 'getChannelData' ? () => new Float32Array(44100) : () => node()),
  set: () => true, apply: () => node(),
});
class FakeAC {
  constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = node(); }
  resume() { return Promise.resolve(); }
  createGain() { return gainNode(); }
  createOscillator() { created.osc++; return osc(); }
  createBufferSource() { created.src++; return bufSrc(); }
  createBiquadFilter() { return filt(); }
  createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
}
const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
const gainNode = () => ({ gain: param(), connect() {} });
const osc = () => ({ type: '', frequency: param(), connect() {}, start() {}, stop() {} });
const bufSrc = () => ({ buffer: null, connect() {}, start() {}, stop() {} });
const filt = () => ({ type: '', Q: param(), frequency: param(), connect() {} });
w.AudioContext = FakeAC;

Object.assign(globalThis, { document: w.document, window: w, matchMedia: () => ({ matches: true }), getSelection: () => ({ toString: () => '' }), requestAnimationFrame: () => 0, DOMParser: w.DOMParser, TextDecoder,
  localStorage: { _d: {}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=v} }, location: { reload() { globalThis.__reloaded = true; } } });
Object.defineProperty(globalThis, 'navigator', { value: { vibrate() {} }, configurable: true });
w.matchMedia = globalThis.matchMedia; w.requestAnimationFrame = () => 0;
let timers = []; globalThis.setInterval = () => 1; globalThis.clearInterval = () => {};
const realST = globalThis.setTimeout; globalThis.setTimeout = (f, ms) => { timers.push(f); return timers.length; }; globalThis.clearTimeout = () => {};
Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get: () => 100 });
w.HTMLElement.prototype.scrollTo = function () {};
let clicked = [];
w.HTMLAnchorElement.prototype.click = function () { clicked.push(this.download); };
w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {}; globalThis.URL = w.URL;
w.Blob = globalThis.Blob;
globalThis.Blob = w.Blob;

const url = pathToFileURL(wwwPath).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) fails++; };
const $ = id => document.getElementById(id);
const sleep = () => new Promise(r => realST(r, 40));

// ---- кнопка «Назад» ----
let backCb = null, minimized = 0;
const AppMock = { addListener: (n, cb) => { if (n === 'backButton') backCb = cb; return Promise.resolve({ remove() {} }); }, minimizeApp: () => { minimized++; } };
const generic = new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : async () => ({ display: 'granted' })) });
w.Capacitor = { isNativePlatform: () => true, registerPlugin: n => (n === 'App' ? AppMock : generic) };

const St = await import(url + '/js/store.js');
localStorage._d = {}; St.load();
await import(url + '/js/main.js');
await sleep();
ok(typeof backCb === 'function', 'приложение подписалось на кнопку «Назад»');
const back = () => backCb();
const hid = id => $(id).hidden;

back(); ok(minimized === 1, 'на главном экране «Назад» сворачивает приложение, а не закрывает');

$('editBtn').click(); ok(!hid('editor'), 'включили режим правки');
back(); ok(hid('editor') && minimized === 1, '«Назад» выходит из режима правки, приложение не сворачивается');

// окно правки привычки
$('editBtn').click(); $('habits').children[0].click();
ok(!hid('sheet'), 'открыто окно правки привычки');
back(); ok(hid('sheet') && !hid('editor') && minimized === 1, '«Назад» закрывает окно привычки, режим правки остаётся');
back(); ok(hid('editor'), 'ещё «Назад» — выход из правки');

// настройки
$('gearBtn').click(); ok(!hid('settingsView'), 'настройки открыты');
back(); ok(hid('settingsView') && minimized === 1, '«Назад» закрывает настройки');

// таймер (у «Английский — 5 минут» есть таймер)
$('habits').children[0].click(); ok(!hid('timerView') && document.body.classList.contains('covered'), 'таймер открыт');
back(); ok(hid('timerView') && !document.body.classList.contains('covered'), '«Назад» закрывает таймер и снимает «закрытость» главного экрана');

// читалка + лист «Книги»
$('readBtn').click(); await sleep();
ok(!hid('readerView'), 'читалка открыта');
$('libBtn').click(); ok(!hid('lib'), 'лист «Книги» открыт');
back(); ok(hid('lib') && !hid('readerView'), '«Назад» закрывает лист «Книги», читалка остаётся');
$('setBtn').click(); back(); ok(hid('set') && !hid('readerView'), '«Назад» закрывает лист настроек чтения');
back(); ok(hid('readerView') && document.body.classList.contains('covered') === false, '«Назад» закрывает читалку');
ok(minimized === 1, 'за всё это время приложение ни разу не свернулось лишний раз');

// карточка поверх всего
const TV = await import(url + '/js/timerview.js');
TV.showCard({ kicker: 'Тест', name: 'Карточка', skill: ['ВОЛЯ', 'х'] });
$('gearBtn').click();
ok(!hid('doneCard') && !hid('settingsView'), 'карточка поверх настроек');
back(); ok(hid('doneCard') && !hid('settingsView') === true, '«Назад» сначала закрывает карточку');
back(); ok(hid('settingsView'), 'потом настройки');
back(); ok(minimized === 2, 'и только потом сворачивает');

// отступы: нигде не осталось «голых» env(safe-area…) вне определения переменных
const css = ['base', 'home', 'timer', 'reader'].map(f => fs.readFileSync(wwwPath + '/css/' + f + '.css', 'utf8')).join('\n');
const raw = css.split('\n').filter(l => /env\(safe-area/.test(l) && !/^\s*--sa[tblr]:/.test(l));
ok(raw.length === 0, 'все отступы идут через --sat/--sab/--sal/--sar (голых env() осталось: ' + raw.length + ')');
process.exit(fails ? 1 : 0);