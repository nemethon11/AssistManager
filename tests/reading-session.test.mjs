import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
const wwwPath = process.argv[2];
const html = fs.readFileSync(wwwPath + '/index.html', 'utf8');
const dom = new JSDOM(html, { pretendToBeVisual: true });
const w = dom.window;
const noopCtx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
w.HTMLCanvasElement.prototype.getContext = () => noopCtx;
Object.assign(globalThis, { document: w.document, window: w, matchMedia: () => ({ matches: true }), getSelection: () => ({ toString: () => '' }), requestAnimationFrame: () => 0, DOMParser: w.DOMParser, TextDecoder, localStorage: { _d: {}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=v} } });
Object.defineProperty(globalThis, 'navigator', { value: { vibrate() {} }, configurable: true });
w.matchMedia = globalThis.matchMedia; w.requestAnimationFrame = () => 0;
globalThis.setInterval = () => 1; globalThis.clearInterval = () => {};
let now = 1_800_000_000_000; Date.now = () => now;
Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get: () => 100 });
w.HTMLElement.prototype.scrollTo = function () {};

const url = pathToFileURL(wwwPath).href;
const St = await import(url + '/js/store.js');
const H = await import(url + '/js/habits.js');
const RS = await import(url + '/js/readsession.js');
const Stats = await import(url + '/js/stats.js');
const T = await import(url + '/js/timer.js');
St.load();
const $ = id => document.getElementById(id);
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) fails++; };
const sleep = () => new Promise(r => setTimeout(r, 30));

const reading = St.S.habits.find(h => h.kind === 'reading');
reading.minutes = 1;                                   // цель 1 минута для скорости теста
let changes = [];
const timer = RS.startReading(reading, { onChange: ev => changes.push(ev) });
await sleep();
ok(!$('readerView').hidden, 'читалка открыта');
ok($('rHud').querySelector('.rh-clock').textContent === '1:00', 'в шапке обратный отсчёт 1:00');
ok(document.body.classList.contains('covered'), 'главный экран помечен закрытым');
ok($('feedIn').querySelectorAll('.chunk,.chapter').length > 0, 'книга показана (первый кусок выдан сам)');
const adv = s => { for (let i = 0; i < s; i++) { now += 1000; timer.tick(); } };

adv(20);
ok($('rHud').querySelector('.rh-clock').textContent === '0:40', 'через 20 с осталось 0:40');
// листаем: абзацы считаются
const before = Stats.readStats().parasTotal;
$('nextBtn').click(); await sleep();
ok(Stats.readStats().parasTotal > before, 'листание увеличило счётчик абзацев');

// 2 минуты без листания -> пауза
timer.stop(); timer.start();                            // чистый старт отсчёта простоя
timer.lastAct = now;
adv(10);
const secsBefore = T.secsToday(reading.id);
now += 130_000; timer.tick();
ok(timer.state() === 'idle' && $('rHud').classList.contains('paused'), 'после 2 минут без листания — пауза, шапка потускнела');
const idleSecs = T.secsToday(reading.id);
now += 60_000; timer.tick();
ok(T.secsToday(reading.id) === idleSecs, 'в паузе время не копится');
$('nextBtn').click(); await sleep();
ok(timer.state() === 'running' && !$('rHud').classList.contains('paused'), 'листнул — снова идёт');

// сворачивание
timer.setVisible(false); const s1 = T.secsToday(reading.id); now += 90_000; timer.tick();
ok(T.secsToday(reading.id) === s1 && $('rHud').querySelector('.rh-st').textContent === 'пауза', 'свёрнуто — стоит, подпись «пауза»');
timer.setVisible(true);

// достижение цели
adv(60);
ok(H.isDone(reading.id), 'цель достигнута — привычка отмечена сама');
ok(!$('doneCard').hidden && $('doneName').textContent === reading.name, 'карточка «Привычка выполнена» показана');
ok(changes.some(c => c.dayDone === undefined || true) && changes.length >= 1, 'главный экран получил уведомление');
adv(5);
ok($('rHud').querySelector('.rh-clock').textContent.startsWith('+'), 'после цели показывается «+…» и время идёт дальше');

$('rClose').click(); await sleep();
ok($('readerView').hidden && $('rHud').innerHTML === '' && !document.body.classList.contains('covered'), 'закрытие: читалка скрыта, шапка очищена');
const st = Stats.readStats();
ok(st.todaySec > 60 && st.totalSec === st.todaySec && st.weekSec === st.todaySec, 'статистика: минуты сегодня/неделя/всего (' + Math.round(st.todaySec) + ' с)');
ok(Stats.fmtDur(4000) === '1 ч 6 мин' && Stats.fmtDur(95) === '1 мин', 'формат времени');

// чтение без привычки
const t2 = RS.startReading(null, {}); await sleep();
ok($('rHud').querySelector('.rh-clock').textContent === '0:00', 'без привычки: счёт вперёд с 0:00');
$('rClose').click();
process.exit(fails ? 1 : 0);
