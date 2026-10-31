// Порядок привычек: кнопки ▲▼ в режиме правки.
import { boot } from './helpers/boot.mjs';

const { $, w, ok, done, St, url, sleep, store } = await boot(process.argv[2]);
const H = await import(url + '/js/habits.js');
const names = () => [...$('habits').querySelectorAll('.nm')].map(e => e.textContent);
const initial = St.S.habits.map(h => h.name);

ok(names().join('|') === initial.join('|') && !$('habits').querySelector('.mv'), 'вне режима правки кнопок перемещения нет');
$('editBtn').click();
const rows = $('habits').querySelectorAll('.hrow');
ok(rows.length === 3 && $('habits').querySelectorAll('.mv button').length === 6, 'в режиме правки у каждой строки по две кнопки (6 всего)');
ok(rows[0].querySelector('.mv button:first-child').disabled && !rows[0].querySelector('.mv button:last-child').disabled, 'у первой привычки «вверх» недоступна');
ok(rows[2].querySelector('.mv button:last-child').disabled && !rows[2].querySelector('.mv button:first-child').disabled, 'у последней «вниз» недоступна');

// вторая привычка вверх
$('habits').querySelectorAll('.hrow')[1].querySelector('.mv button:first-child').click();
ok(names().join('|') === [initial[1], initial[0], initial[2]].join('|'), 'вторая поднялась на первое место');
ok(names().map((n, i) => n).length === 3 && [...$('habits').querySelectorAll('.hn')].map(e => e.textContent).join(' ') === '1. 2. 3.', 'номера «1. 2. 3.» пересчитались');
// первая (бывшая вторая) вниз и ещё раз вниз
$('habits').querySelectorAll('.hrow')[0].querySelector('.mv button:last-child').click();
$('habits').querySelectorAll('.hrow')[1].querySelector('.mv button:last-child').click();
ok(names().join('|') === [initial[0], initial[2], initial[1]].join('|'), 'после двух сдвигов вниз порядок: ' + names().join(' / '));

// порядок хранится
ok(JSON.parse(store['assistmanager.v1']).habits.map(h => h.name).join('|') === names().join('|'), 'порядок сохранён в данных');
// выход из правки — обычный список, тот же порядок
$('editBtn').click();
ok(names().join('|') === [initial[0], initial[2], initial[1]].join('|') && !$('habits').querySelector('.mv'), 'после «Готово» порядок остался, кнопки скрылись');

// логика на краях
ok(H.moveHabit(St.S.habits[0].id, -1) === false && H.moveHabit('нет-такой', 1) === false, 'сдвиг за край или несуществующей привычки ничего не делает');
// выполненные отметки не теряются при перестановке
const id = St.S.habits[1].id; H.setDone(id, true); H.moveHabit(id, -1);
ok(H.isDone(id), 'отметка «выполнено» осталась у привычки после перестановки');
done();
