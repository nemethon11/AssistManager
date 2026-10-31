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

// ---- XP ----
const St = await import(url + '/js/store.js');
const X = await import(url + '/js/xp.js');
St.load();
ok(X.totalXp() === 0 && X.rankInfo().rank.name === 'Безработный интеллектуал', 'новый пользователь: 0 XP, первый ранг');
const t = St.today();
St.S.log[t] = { a: 1, b: 1, c: 1 }; St.S.complete[t] = 1; St.S.read.secs[t] = 600;
ok(X.totalXp() === 30 + 20 + 20, 'XP: 3 привычки (30) + день (20) + 10 мин чтения (20) = ' + X.totalXp());
ok(X.rankIndex(99) === 0 && X.rankIndex(100) === 1 && X.rankIndex(10000) === 9 && X.RANKS.length === 10, '10 рангов, пороги работают');
const ri = X.rankInfo(450);
ok(ri.i === 2 && ri.toNext === 150 && ri.pct === 50, 'прогресс до следующего ранга (450 XP -> ещё 150, 50%)');
St.load(); // сброс на чистое хранилище
localStorage._d = {}; St.load();

// ---- холодный запуск всего приложения ----
await import(url + '/js/main.js');
await sleep();
ok($('habits').children.length === 3, 'приложение запустилось: 3 привычки');
ok($('rankName').textContent === 'Безработный интеллектуал' && $('ranks').children.length === 10, 'блок ранга нарисован (10 строк)');

// отметка обычной привычки -> звук, XP растёт
const before = created.osc;
document.dispatchEvent(new w.Event('pointerdown'));   // разблокировка звука
$('habits').children[1].click();
ok(created.osc > before, 'отметка привычки сыграла звук (создано осцилляторов: ' + (created.osc - before) + ')');
ok($('xpTotal').textContent === '10 XP', 'XP после одной отметки: ' + $('xpTotal').textContent);

// выключение звука
$('gearBtn').click();
ok(!$('settingsView').hidden && $('optSound').checked, 'настройки открылись, звук включён');
$('optSound').checked = false; $('optSound').dispatchEvent(new w.Event('change'));
const mid = created.osc;
$('habits').children[1].click(); $('habits').children[1].click();
ok(created.osc === mid, 'звук выключен — новых звуков нет');
$('optSound').checked = true; $('optSound').dispatchEvent(new w.Event('change'));

// все привычки -> ранг 2 (3*10 + 20 = 50 < 100, поэтому ранг не растёт), проверим карточку уровня огня «Искра»
St.S.habits.forEach(h => { if (!$('habits').querySelector('.done')) {} });
const rows = [...$('habits').children];
rows.forEach((r, i) => { if (!r.classList.contains('done') && !St.S.habits[i].minutes) r.click(); });
// привычки с таймером откроют экран таймера; отметим их напрямую через тот же путь, что и «без таймера»
for (const h of St.S.habits) { const H = await import(url + '/js/habits.js'); if (!H.isDone(h.id)) H.setDone(h.id, true); }
document.dispatchEvent(new w.Event('visibilitychange'));
await sleep();
ok(St.S.complete[t] === 1, 'день засчитан');
ok(St.S.levelSeen >= 1, 'уровень огня Искра зафиксирован (levelSeen=' + St.S.levelSeen + ')');
ok($('doneCard') && !$('doneCard').hidden && $('doneK').textContent === 'Новый уровень огня', 'карточка «Новый уровень огня» показана');
$('doneOk').click();

// форсируем ранг: добавляем XP
St.S.read.secs[t] = 3000;   // +100 XP
(await import(url + '/js/habits.js')).recompute();
document.dispatchEvent(new w.Event('visibilitychange'));
ok(!$('doneCard').hidden && $('doneK').textContent === 'Новый ранг' && $('doneName').textContent === 'Похмельный лейтенант', 'карточка «Новый ранг: Похмельный лейтенант»');
$('doneOk').click();

// ---- резервная копия ----
const B = await import(url + '/js/backup.js');
const L = await import(url + '/js/library.js');
await L.Books.put({ id: 'bk1', title: 'Тест-книга', items: [{ t: 'p', s: 'Привет.' }], added: 1 });
const fullText = JSON.stringify(await B.buildBackup(true)); const full = JSON.parse(fullText);
ok(full.app === 'AssistManager' && full.books.some(b => b.id === 'bk1') && full.state.habits.length === 3, 'копия содержит состояние и книги');
const light = await B.buildBackup(false);
ok(!light.books, 'копия без книг не содержит книг');
await B.exportBackup(true);
ok(clicked.length === 1 && /AssistManager-\d{4}-\d\d-\d\d-с-книгами\.json/.test(clicked[0]), 'экспорт в браузере скачал файл: ' + clicked[0]);

let bad = null; try { B.parseBackup('{"x":1}'); } catch (e) { bad = e.message; }
ok(bad === 'Это не копия AssistManager.', 'чужой JSON отклонён');
bad = null; try { B.parseBackup('не json'); } catch (e) { bad = e.message; }
ok(/не читается/.test(bad), 'не-JSON отклонён');

const snapshot = JSON.parse(JSON.stringify(St.S));
St.S.habits = []; St.S.log = {}; St.save();
await L.Books.del('bk1');
await B.restore(B.parseBackup(fullText));
ok(St.S.habits.length === 3 && Object.keys(St.S.log).length === Object.keys(snapshot.log).length && (await L.Books.all()).some(b => b.id === 'bk1'), 'восстановление вернуло привычки, журнал и книги');

// старый код «Огонька»
const legacy = Buffer.from(unescape(encodeURIComponent(JSON.stringify({ habits: [{ id: 'z', name: 'Старая' }], log: {}, complete: { '2026-10-01': 1 }, frozen: {}, freezes: 1, best: 5, awarded: '' }))), 'latin1').toString('base64');
const lp = B.parseLegacyCode(legacy);
await B.restore(lp);
ok(St.S.habits[0].name === 'Старая' && St.S.habits[0].kind === 'check' && St.S.best === 5 && St.S.reader.current === 'sample', 'код из старого «Огонька» подхватился и дополнен новыми полями');
bad = null; try { B.parseLegacyCode('!!!'); } catch (e) { bad = e.message; }
ok(!!bad, 'мусорный код отклонён');

// ---- звуки по отдельности ----
const Snd = await import(url + '/js/sound.js');
St.S.settings.sound = true;
let err = null;
try { for (const f of ['check', 'uncheck', 'flash', 'bell', 'timerEnd', 'levelUp', 'rankUp', 'page']) Snd[f](); Snd.crackle(8); } catch (e) { err = e; }
ok(!err, 'все 9 звуков создаются без ошибок' + (err ? ': ' + err.message : ''));
process.exit(fails ? 1 : 0);
