// Опыт (XP) и ранги. XP считается из журнала, а не копится отдельно:
// так он всегда сходится с реальностью (сняли отметку — опыт вернулся).
//   +10 за каждую выполненную привычку, +20 за день, где выполнено всё, +2 за минуту чтения.
import { S } from './store.js';

export const XP_HABIT = 10;
export const XP_DAY = 20;
export const XP_MINUTE = 2;

export const RANKS = [
  { min: 0,     name: 'Безработный интеллектуал',                  line: 'Пока вы известны лишь тем, что вас никто не ждёт.' },
  { min: 100,   name: 'Похмельный лейтенант',                      line: 'Вы проснулись. Это уже достижение.' },
  { min: 300,   name: 'Читатель с подозрительным прошлым',         line: 'Книги вас помнят. И, кажется, немного побаиваются.' },
  { min: 600,   name: 'Мастер откладывать на завтра',              line: 'Но сегодня — не тот случай. Почти.' },
  { min: 1000,  name: 'Аскет-неудачник',                           line: 'Отказались от всего, кроме привычек. И то не от всех.' },
  { min: 1600,  name: 'Знаток чужих сюжетов',                      line: 'Своего пока нет, зато чужих — на целую жизнь.' },
  { min: 2500,  name: 'Герой мелких побед',                        line: 'Эпос не складывается, зато складывается счёт.' },
  { min: 4000,  name: 'Пророк библиотечных сумерек',               line: 'Вас слушают только стеллажи, но они внимательны.' },
  { min: 6500,  name: 'Король Ревашоля',                           line: 'Королевство — одна комната, зато вся в закладках.' },
  { min: 10000, name: 'Человек эпохи, которого эпоха не заметила', line: 'Зато вы заметили всё. И записали. И прочитали.' },
];

export function totalXp() {
  let n = 0;
  for (const day of Object.values(S.log)) n += Object.keys(day).length * XP_HABIT;
  n += Object.keys(S.complete).length * XP_DAY;
  const readSec = Object.values(S.read.secs).reduce((a, b) => a + b, 0);
  n += Math.floor(readSec / 60) * XP_MINUTE;
  return n;
}

export function rankIndex(xp) {
  let i = 0;
  RANKS.forEach((r, j) => { if (xp >= r.min) i = j; });
  return i;
}

// Всё для экрана: текущий ранг, следующий, сколько осталось и доля пути.
export function rankInfo(xp = totalXp()) {
  const i = rankIndex(xp);
  const cur = RANKS[i], next = RANKS[i + 1] || null;
  return {
    i, xp, rank: cur, next,
    toNext: next ? next.min - xp : 0,
    pct: next ? Math.min(100, Math.round((xp - cur.min) / (next.min - cur.min) * 100)) : 100,
  };
}
