// История: календарь месяца, график чтения, итоги.
import { boot } from './helpers/boot.mjs';

const { $, w, ok, done, St, url, sleep } = await boot(process.argv[2]);
const Hi = await import(url + '/js/history.js');
const H = await import(url + '/js/habits.js');
const t = St.today();
const d = k => St.shift(t, k);

// ---- сетка месяца ----
const feb = Hi.monthGrid(2026, 1);   // февраль 2026: 1-е — воскресенье, 28 дней
ok(feb.slice(0, 6).every(c => c === null) && feb[6].day === 1 && feb.length === 6 + 28, 'февраль 2026: 6 пустых клеток перед 1-м (воскресенье), 28 дней');
const oct = Hi.monthGrid(2026, 9);   // октябрь 2026: 1-е — четверг, 31 день
ok(oct.slice(0, 3).every(c => c === null) && oct[3].day === 1 && oct.length === 3 + 31, 'октябрь 2026: 3 пустых клетки (четверг), 31 день');
const leap = Hi.monthGrid(2028, 1);
ok(leap.filter(Boolean).length === 29, 'февраль 2028 — високосный, 29 дней');

// ---- состояния дней ----
const [a, b, c] = St.S.habits;
St.S.complete[d(-1)] = 1; St.S.log[d(-1)] = { [a.id]: 1, [b.id]: 1, [c.id]: 1 };
St.S.frozen[d(-2)] = 1;
St.S.log[d(-3)] = { [a.id]: 1 };
ok(Hi.dayState(d(-1)) === 'full', 'вчера: день закрыт');
ok(Hi.dayState(d(-2)) === 'frozen', 'позавчера: заморозка');
ok(Hi.dayState(d(-3)) === 'partial', '3 дня назад: частично');
ok(Hi.dayState(d(-4)) === 'empty', '4 дня назад: пусто');
ok(Hi.dayState(d(1)) === 'future', 'завтра: ещё не наступил');

// ---- подробности дня ----
St.S.read.secs[d(-1)] = 725; St.S.read.paras[d(-1)] = 42;
St.S.log[d(-5)] = { 'нет-такой': 1 };
const det = Hi.dayDetail(d(-1));
ok(det.names.length === 3 && det.names[0] === a.name && det.readMin === 12 && det.paras === 42, 'подробности: 3 привычки, 12 мин чтения, 42 абзаца');
ok(Hi.dayDetail(d(-5)).names[0] === 'удалённая привычка', 'удалённая привычка не ломает подробности');
ok(/^\d+ (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)$/.test(det.title), 'заголовок дня «31 октября»: ' + det.title);

// ---- график чтения ----
const bars = Hi.readingBars(14);
ok(bars.length === 14 && bars[13].today && bars[13].key === t && bars[12].key === d(-1) && bars[12].min === 12, 'график: 14 столбиков, последний — сегодня, вчера = 12 мин');

// ---- итоги ----
const now = St.parseKey(t);
const s = Hi.summary(now.getFullYear(), now.getMonth());
ok(s.daysTotal === Object.keys(St.S.complete).length && s.habitsTotal === 5 && s.best >= 1, 'итоги: дней закрыто ' + s.daysTotal + ', привычек выполнено ' + s.habitsTotal);
ok(s.monthElapsed === now.getDate() && s.monthPct === Math.round(s.monthFull / s.monthElapsed * 100), 'доля месяца считается от прошедших дней');
const past = Hi.summary(2020, 0);
ok(past.monthElapsed === 31 && past.monthFull === 0, 'прошлый месяц считается целиком');
const fut = Hi.summary(now.getFullYear() + 1, 0);
ok(fut.monthElapsed === 0 && fut.monthPct === 0, 'будущий месяц: 0 прошедших дней, без деления на ноль');

// ---- экран ----
St.save();
$('histBtn').click();
ok(!$('historyView').hidden && document.body.classList.contains('covered'), 'экран истории открыт, главный экран «закрыт»');
ok($('calTitle').textContent.endsWith(String(now.getFullYear())), 'заголовок месяца: ' + $('calTitle').textContent);
ok($('cal').querySelectorAll('.cd:not(.blank)').length === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), 'в календаре все дни месяца');
ok($('cal').querySelectorAll('.cd.today').length === 1 && $('cal').querySelectorAll('.cd.future').length === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate(), 'сегодня выделен, будущие дни приглушены');
ok($('calNext').disabled, 'дальше текущего месяца листать нельзя');
ok($('bars').children.length === 14 && $('bars').querySelector('.bar.today'), 'график чтения нарисован (14 столбиков)');
ok(/дней закрыто всего/.test($('histStats').textContent), 'итоги нарисованы');

// выбор дня
const yesterdayCell = [...$('cal').querySelectorAll('.cd:not(.blank)')].find(e => +e.textContent === St.parseKey(d(-1)).getDate());
if (St.parseKey(d(-1)).getMonth() === now.getMonth()) {
  yesterdayCell.click();
  ok($('calDetail').textContent.includes('День закрыт') && $('calDetail').textContent.includes('Чтение: 12 мин, абзацев: 42'), 'нажали на вчера: «День закрыт… Чтение: 12 мин, абзацев: 42»');
} else ok(true, '(вчера в прошлом месяце — проверка нажатия на день пропущена)');

// навигация: назад есть, когда данные в прошлых месяцах
St.S.complete['2026-01-15'] = 1; St.S.log['2026-01-15'] = { [a.id]: 1 };
$('hiBack').click(); $('histBtn').click();
ok(!$('calPrev').disabled, 'есть данные в прошлом — кнопка «◂» доступна');
const before = $('calTitle').textContent;
$('calPrev').click();
ok($('calTitle').textContent !== before && !$('calNext').disabled, 'листаем назад: месяц сменился, «▸» стала доступна');
for (let i = 0; i < 200 && !$('calPrev').disabled; i++) $('calPrev').click();
ok($('calPrev').disabled && /январь 2026/.test($('calTitle').textContent), 'дальше самого раннего месяца с данными не листается (январь 2026)');
$('cal').querySelectorAll('.cd:not(.blank)')[14].click();
ok($('calDetail').textContent.startsWith('15 января') && $('calDetail').textContent.includes('День закрыт'), 'январь: 15-е — день закрыт');

// закрытие
$('hiBack').click();
ok($('historyView').hidden && !document.body.classList.contains('covered'), 'закрыли — главный экран снова «открыт»');

// кнопка «Назад» закрывает историю
const BK = await import(url + '/js/back.js');
$('histBtn').click();
ok(BK.goBack(() => {}, () => false, () => {}) === true && $('historyView').hidden, '«Назад» закрывает историю');
done();
