// Сеанс чтения: соединяет читалку, таймер привычки, огонёк в шапке и статистику.
//  - привычка «Чтение» -> таймер идёт к цели (обратный отсчёт), по цели привычка отмечается сама;
//  - без привычки (кнопка «Читать» на главной) -> просто копим время чтения.
// Таймер идёт, только пока приложение открыто и листают (2 минуты без листания = пауза).
import * as H from './habits.js';
import { HabitTimer } from './timer.js';
import { openReader } from './reader.js';
import { createFlame, levelOf } from './flame.js';
import { showDone, fmt } from './timerview.js';
import { addReadSecs, addParas } from './stats.js';

const IDLE_SEC = 120;
const FREE_ID = '_free';          // «свободное» чтение без привычки

export function startReading(habit, { onChange } = {}) {
  const hud = document.getElementById('rHud');
  hud.innerHTML = '<canvas class="rh-flame" aria-hidden="true"></canvas>' +
    '<div class="rh-t"><div class="rh-clock"></div><div class="rh-st"></div></div>';
  const clockEl = hud.querySelector('.rh-clock');
  const stEl = hud.querySelector('.rh-st');
  document.body.classList.add('covered');

  let flame = null;
  const goal = habit ? habit.minutes * 60 : Infinity;
  const id = habit ? habit.id : FREE_ID;

  const timer = new HabitTimer({
    id,
    goalSec: goal,
    idleSec: IDLE_SEC,
    onAdd: addReadSecs,
    onTick: paint,
    onGoal: () => {
      // Время вышло: отмечаем привычку, вспыхиваем, поздравляем. Читать можно дальше — время копится.
      const ev = habit && !H.isDone(habit.id) ? H.setDone(habit.id, true) : {};
      if (flame) flame.burst();
      try { navigator.vibrate && navigator.vibrate([30, 40, 60]); } catch (e) { /* без вибрации */ }
      if (habit) showDone(habit);
      if (onChange) onChange(ev);
    },
  });

  function paint(secs, st) {
    const over = secs >= goal;
    clockEl.textContent = habit ? (over ? '+' + fmt(secs - goal) : fmt(goal - secs)) : fmt(secs);
    clockEl.classList.toggle('over', over);
    hud.classList.toggle('paused', st !== 'running');
    stEl.textContent = st === 'idle' ? 'нет листания' : st === 'away' ? 'пауза' : '';
  }

  openReader({
    onActivity: () => timer.activity(),
    onAdvance: paras => addParas(paras),
    onClose: () => {
      timer.destroy();
      hud.innerHTML = '';
      document.body.classList.remove('covered');
      if (onChange) onChange({});
    },
  });

  // Огонёк в шапке — после того как читалка показана (нужен размер холста).
  flame = createFlame(hud.querySelector('.rh-flame'), levelOf(H.streak()));
  timer.start();
  paint(timer.secs(), timer.state());
  return timer;
}
