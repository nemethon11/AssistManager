// Статистика чтения: минуты за сегодня / неделю / всего и прочитанные абзацы.
import { S, save, today, shift, parseKey } from './store.js';

export function addReadSecs(sec) {
  const t = today();
  S.read.secs[t] = Math.round(((S.read.secs[t] || 0) + sec) * 10) / 10;
}

export function addParas(n) {
  if (!n) return;
  const t = today();
  S.read.paras[t] = (S.read.paras[t] || 0) + n;
  save();
}

const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

export function readStats() {
  const t = today();
  // Неделя — с понедельника по сегодня, как полоска недели на главном экране.
  const start = shift(t, -((parseKey(t).getDay() + 6) % 7));
  const inWeek = o => Object.keys(o).filter(k => k >= start && k <= t).reduce((a, k) => a + o[k], 0);
  return {
    todaySec: S.read.secs[t] || 0,
    weekSec: inWeek(S.read.secs),
    totalSec: sum(S.read.secs),
    parasToday: S.read.paras[t] || 0,
    parasTotal: sum(S.read.paras),
  };
}

// 95 -> «1 мин», 4000 -> «1 ч 6 мин»
export function fmtDur(sec) {
  const m = Math.floor(sec / 60);
  if (m < 60) return m + ' мин';
  return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин';
}
