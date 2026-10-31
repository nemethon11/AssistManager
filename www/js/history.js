// История: календарь месяца, график чтения за две недели, итоги.
// Вся логика (без разметки) вынесена в чистые функции, поэтому её можно проверять тестами.
import { S, today, shift, parseKey, pad } from './store.js';
import * as H from './habits.js';

export const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// full — закрыт весь день, frozen — спасён заморозкой, partial — что-то сделано, empty — ничего, future — ещё не наступил
export function dayState(key) {
  if (key > today()) return 'future';
  if (S.complete[key]) return 'full';
  if (S.frozen[key]) return 'frozen';
  if (S.log[key] && Object.keys(S.log[key]).length) return 'partial';
  return 'empty';
}

// Сетка месяца: недели начинаются с понедельника, пустые клетки (null) выравнивают первое число.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const key = year + '-' + pad(month + 1) + '-' + pad(d);
    cells.push({ key, day: d, state: dayState(key), today: key === today() });
  }
  return cells;
}

// Что было в этот день: какие привычки, сколько минут читал, сколько абзацев.
export function dayDetail(key) {
  const log = S.log[key] || {};
  const names = Object.keys(log).map(id => {
    const h = S.habits.find(x => x.id === id);
    return h ? h.name : 'удалённая привычка';
  });
  const d = parseKey(key);
  return {
    key,
    title: d.getDate() + ' ' + MONTHS_GEN[d.getMonth()],
    state: dayState(key),
    names,
    readMin: Math.floor((S.read.secs[key] || 0) / 60),
    paras: S.read.paras[key] || 0,
  };
}

// Минуты чтения за последние n дней (последний столбик — сегодня).
export function readingBars(n = 14) {
  const t = today();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = shift(t, -i);
    out.push({ key, day: parseKey(key).getDate(), min: Math.floor((S.read.secs[key] || 0) / 60), today: i === 0 });
  }
  return out;
}

// Самый ранний день с данными — дальше назад листать месяцы нет смысла.
export function firstMonth() {
  const keys = [...Object.keys(S.log), ...Object.keys(S.complete), ...Object.keys(S.frozen), ...Object.keys(S.read.secs)].sort();
  const d = parseKey(keys.length ? keys[0] : today());
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function summary(year, month) {
  const t = today();
  const prefix = year + '-' + pad(month + 1) + '-';
  const inMonth = k => k.startsWith(prefix) && k <= t;
  const elapsed = (() => {
    const last = new Date(year, month + 1, 0).getDate();
    const cur = parseKey(t);
    return cur.getFullYear() === year && cur.getMonth() === month ? cur.getDate() : (prefix + '01' > t ? 0 : last);
  })();
  const full = Object.keys(S.complete).filter(inMonth).length;
  return {
    daysTotal: Object.keys(S.complete).length,
    best: Math.max(S.best, H.streak()),
    habitsTotal: Object.values(S.log).reduce((a, d) => a + Object.keys(d).length, 0),
    monthFull: full,
    monthElapsed: elapsed,
    monthPct: elapsed ? Math.round(full / elapsed * 100) : 0,
  };
}

/* ---------- разметка ---------- */
const $ = id => document.getElementById(id);
let view = null;      // { year, month }
let picked = null;    // выбранный день

export function initHistory() {
  $('histBtn').onclick = openHistory;
  $('hiBack').onclick = () => { $('historyView').hidden = true; document.body.classList.remove('covered'); };
  $('calPrev').onclick = () => step(-1);
  $('calNext').onclick = () => step(1);
}

export function openHistory() {
  const d = parseKey(today());
  view = { year: d.getFullYear(), month: d.getMonth() };
  picked = today();
  $('historyView').hidden = false;
  document.body.classList.add('covered');
  paint();
}

function step(delta) {
  const m = view.month + delta;
  const next = { year: view.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
  const now = parseKey(today()), lo = firstMonth();
  const idx = v => v.year * 12 + v.month;
  if (idx(next) > idx({ year: now.getFullYear(), month: now.getMonth() }) || idx(next) < idx(lo)) return;
  view = next;
  picked = null;
  paint();
}

function paint() {
  $('calTitle').textContent = MONTHS[view.month] + ' ' + view.year;
  const now = parseKey(today()), lo = firstMonth();
  const idx = v => v.year * 12 + v.month;
  $('calPrev').disabled = idx(view) <= idx(lo);
  $('calNext').disabled = idx(view) >= idx({ year: now.getFullYear(), month: now.getMonth() });

  const cal = $('cal');
  cal.textContent = '';
  monthGrid(view.year, view.month).forEach(c => {
    const el = document.createElement(c ? 'button' : 'div');
    if (!c) { el.className = 'cd blank'; cal.append(el); return; }
    el.type = 'button';
    el.className = 'cd ' + c.state + (c.today ? ' today' : '') + (picked === c.key ? ' sel' : '');
    el.textContent = c.day;
    el.setAttribute('aria-label', c.day + ' ' + MONTHS_GEN[view.month] + ', ' + stateWord(c.state));
    el.disabled = c.state === 'future';
    el.onclick = () => { picked = c.key; paint(); };
    cal.append(el);
  });
  paintDetail();

  const bars = $('bars');
  bars.textContent = '';
  const data = readingBars(14);
  const max = Math.max(10, ...data.map(b => b.min));
  data.forEach(b => {
    const col = document.createElement('div');
    col.className = 'bar' + (b.today ? ' today' : '');
    col.innerHTML = '<em></em><div class="bf"><i></i></div><span></span>';
    col.querySelector('em').textContent = b.min ? b.min : '';
    col.querySelector('i').style.height = (b.min / max * 100) + '%';
    col.querySelector('span').textContent = b.day;
    bars.append(col);
  });

  const s = summary(view.year, view.month);
  $('histStats').innerHTML =
    '<div><b>' + s.daysTotal + '</b><span>дней закрыто всего</span></div>' +
    '<div><b>' + s.best + '</b><span>рекорд серии</span></div>' +
    '<div><b>' + s.monthFull + ' / ' + s.monthElapsed + '</b><span>дней в этом месяце</span></div>' +
    '<div><b>' + s.habitsTotal + '</b><span>привычек выполнено</span></div>';
}

const stateWord = st => ({ full: 'день закрыт', frozen: 'спасён заморозкой', partial: 'частично', empty: 'пусто', future: 'ещё не наступил' }[st]);

function paintDetail() {
  const box = $('calDetail');
  if (!picked) { box.textContent = 'Выбери день.'; return; }
  const d = dayDetail(picked);
  const parts = [];
  if (d.state === 'full') parts.push('День закрыт.');
  else if (d.state === 'frozen') parts.push('Серию спасла заморозка.');
  else if (d.state === 'empty') parts.push('В этот день ничего не отмечено.');
  if (d.names.length) parts.push('Сделано: ' + d.names.join(', ') + '.');
  if (d.readMin || d.paras) parts.push('Чтение: ' + d.readMin + ' мин, абзацев: ' + d.paras + '.');
  box.textContent = '';
  const h = document.createElement('b');
  h.textContent = d.title;
  box.append(h, document.createTextNode(' — ' + parts.join(' ')));
}
