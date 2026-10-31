// Логика привычек, стрика и заморозок (перенесена из reference/ogonek.html).
import { S, save, today, shift, parseKey, uid } from './store.js';

export function plural(n) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'день';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'дня';
  return 'дней';
}

// День «горит», если он засчитан или спасён заморозкой.
const has = k => !!(S.complete[k] || S.frozen[k]);

// Текущий стрик. Если сегодня ещё не закрыт, считаем со вчерашнего дня — серия не обрывается до полуночи.
export function streak() {
  let d = today();
  if (!has(d)) d = shift(d, -1);
  let n = 0;
  while (has(d)) { n++; d = shift(d, -1); }
  return n;
}

export function habitStreak(id) {
  const done = k => S.log[k] && S.log[k][id];
  let d = today();
  if (!done(d)) d = shift(d, -1);
  let n = 0;
  while (done(d)) { n++; d = shift(d, -1); }
  return n;
}

export const isDone = id => !!(S.log[today()] || {})[id];
export const doneCount = () => S.habits.filter(h => isDone(h.id)).length;
export const leftCount = () => S.habits.length - doneCount();

// Если пропущены дни и заморозок хватает на все — закрываем ими пропуск. Возвращает true, если заморозки потратились.
export function applyFreezes() {
  const keys = Object.keys(S.complete).concat(Object.keys(S.frozen)).filter(k => k < today()).sort();
  if (!keys.length) return false;
  const last = keys[keys.length - 1];
  const y = shift(today(), -1);
  if (last >= y) return false;
  const gap = [];
  let d = shift(last, 1);
  while (d <= y) { gap.push(d); d = shift(d, 1); }
  if (gap.length <= S.freezes) {
    gap.forEach(k => { S.frozen[k] = 1; });
    S.freezes -= gap.length;
    save();
    return true;
  }
  return false;
}

// Пересчёт «день засчитан». Возвращает события, чтобы экран мог показать огонь и сообщения.
export function recompute() {
  const t = today();
  const log = S.log[t] || {};
  const all = S.habits.length > 0 && S.habits.every(h => log[h.id]);
  const was = !!S.complete[t];
  const ev = { dayDone: false, freeze: false };
  if (all && !was) {
    S.complete[t] = 1;
    const s = streak();
    if (s > S.best) S.best = s;
    if (s % 7 === 0 && S.awarded !== t && S.freezes < 2) { S.freezes++; S.awarded = t; ev.freeze = true; }
    ev.dayDone = true;
  } else if (!all && was) {
    delete S.complete[t];
  }
  save();
  return ev;
}

// Отметить / снять отметку. Возвращает { on, ...события }.
export function setDone(id, on) {
  const t = today();
  S.log[t] = S.log[t] || {};
  if (on) S.log[t][id] = 1; else delete S.log[t][id];
  const ev = recompute();
  return { on, ...ev };
}
export const toggle = id => setDone(id, !isDone(id));

// ---- Управление списком привычек ----
export function addHabit({ name, minutes = 0, reading = false }) {
  const h = { id: uid(), name: name.trim(), kind: reading ? 'reading' : 'check', minutes: reading && !minutes ? 10 : minutes };
  S.habits.push(h);
  recompute();
  return h;
}
export function updateHabit(id, { name, minutes, reading }) {
  const h = S.habits.find(x => x.id === id);
  if (!h) return;
  if (name !== undefined) h.name = name.trim();
  if (reading !== undefined) h.kind = reading ? 'reading' : 'check';
  if (minutes !== undefined) h.minutes = minutes;
  if (h.kind === 'reading' && !h.minutes) h.minutes = 10;
  save();
}
export function removeHabit(id) {
  S.habits = S.habits.filter(h => h.id !== id);
  recompute();
}

// Дни текущей недели (Пн–Вс) для полоски на главном экране.
export function weekDays() {
  const t = today();
  const dow = (parseKey(t).getDay() + 6) % 7;
  const start = shift(t, -dow);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const k = shift(start, i);
    days.push({ key: k, ok: !!S.complete[k], frozen: !!S.frozen[k], today: k === t });
  }
  const done = days.filter(d => d.ok && d.key <= t).length;
  return { days, done, of: dow + 1 };
}
