// Экран таймера привычки (для привычек с таймером, не считая читалки) и карточка «Привычка выполнена».
import * as H from './habits.js';
import { HabitTimer, secsToday } from './timer.js';
import { createFlame, levelOf } from './flame.js';

const $ = id => document.getElementById(id);

export const fmt = sec => {
  sec = Math.max(0, Math.ceil(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
};

// Реплики «навыков» для каждого состояния таймера.
const SKILL = {
  stopped: ['ВОЛЯ', 'Начни. Остальное приложится.'],
  running: ['ВЫНОСЛИВОСТЬ', 'Тик-так. Мир подождёт, а ты — нет.'],
  away: ['ЭНЦИКЛОПЕДИЯ', 'Ты сбежал. Время честно стоит и ждёт.'],
  idle: ['ЭЛЕКТРОХИМИЯ', 'Ты там уснул? Время — тоже.'],
};
const DONE_LINES = [
  ['ВОЛЯ', 'Сделано. Только не привыкай к похвале.'],
  ['ЭСПРИ-ДЕ-КОР', 'Маленькая победа. Из таких и строятся империи.'],
  ['ЛОГИКА', 'Факт: ты сделал то, что собирался. Редкое явление.'],
];

export const skillHtml = ([name, text]) => '<b>' + name + ':</b> ' + text;

let cb = { onChange() {}, toast() {} };
let flame = null;
let timer = null;
let habit = null;

export function initTimerView(callbacks) {
  cb = callbacks;
  $('tvBack').onclick = closeTimer;
  $('tvToggle').onclick = () => {
    if (!timer) return;
    if (timer.state() === 'stopped') timer.start(); else timer.stop();
  };
  $('tvManual').onclick = () => {
    if (!habit) return;
    const ev = H.toggle(habit.id);
    cb.onChange(ev);
    paint();
  };
  $('doneOk').onclick = () => { $('doneCard').hidden = true; };
}

export function openTimer(h) {
  habit = h;
  $('tvName').textContent = h.name;
  $('timerView').hidden = false;
  if (!flame) flame = createFlame($('tvFlame'), levelOf(H.streak()));
  else { flame.resize(); flame.setLevel(levelOf(H.streak())); }

  timer = new HabitTimer({
    id: h.id,
    goalSec: h.minutes * 60,
    onTick: paint,
    onGoal: () => goalReached(h),
  });
  paint();
}

export function closeTimer() {
  if (timer) { timer.destroy(); timer = null; }
  habit = null;
  $('timerView').hidden = true;
  cb.onChange({});
}

function goalReached(h) {
  // Отмечаем автоматически и празднуем. Время при этом продолжает идти.
  const ev = H.isDone(h.id) ? {} : H.setDone(h.id, true);
  flame.burst();
  try { navigator.vibrate && navigator.vibrate([30, 40, 60]); } catch (e) { /* без вибрации */ }
  showDone(h);
  cb.onChange(ev);
}

// Красивое уведомление «Привычка выполнена».
export function showDone(h) {
  $('doneName').textContent = h.name;
  $('doneSkill').innerHTML = skillHtml(DONE_LINES[Math.floor(Math.random() * DONE_LINES.length)]);
  $('doneCard').hidden = false;
}

function paint() {
  if (!habit) return;
  const goal = habit.minutes * 60;
  const secs = secsToday(habit.id);
  const st = timer ? timer.state() : 'stopped';
  const over = secs >= goal;

  $('tvClock').textContent = fmt(goal - secs);
  $('tvClock').classList.toggle('over', over);
  $('tvFill').style.width = Math.min(100, secs / goal * 100) + '%';
  $('tvState').textContent = over
    ? 'Сверх нормы: +' + fmt(secs - goal)
    : { stopped: 'Пауза', running: 'Идёт', away: 'Свёрнуто — время стоит', idle: 'Нет действий — время стоит' }[st];
  $('tvSkill').innerHTML = skillHtml(SKILL[st]);
  $('tvToggleT').textContent = st === 'stopped' ? '«Начать.»' : '«Пауза.»';
  $('tvManualT').textContent = H.isDone(habit.id) ? '«Снять отметку.»' : '«Отметить без таймера.»';
}
