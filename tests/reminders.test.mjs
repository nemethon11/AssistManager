const www = process.argv[2];
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=v} };
const calls = [];
let perm = 'granted';
const mock = {
  checkPermissions: async () => ({ display: perm }),
  requestPermissions: async () => ({ display: perm }),
  createChannel: async o => { calls.push(['channel', o]); },
  cancel: async o => { calls.push(['cancel', o]); },
  schedule: async o => { calls.push(['schedule', o]); },
};
globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: n => (n === 'LocalNotifications' ? mock : null) } };
globalThis.document = { hidden: false, addEventListener() {} };
const St = await import(www + '/js/store.js');
const R = await import(www + '/js/reminders.js');
St.load();
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) fails++; };
const t = St.today();
const at = (h, m = 0) => { const d = St.parseKey(t); d.setHours(h, m, 0, 0); return d; };
const reset = () => { St.S.log = {}; St.S.complete = {}; St.S.frozen = {}; St.S.settings.remind = { on: true, time: '18:00', evening: true, eveningTime: '21:30' }; };

reset(); St.S.settings.remind.on = false;
ok(R.plan(at(10)).length === 0, 'напоминания выключены — ничего не планируется');

reset();
let p = R.plan(at(10));
ok(p.length === 7 && p.every((n, i) => n.id === 100 + i), '10:00, серии нет: 7 дневных напоминаний (ids 100..106)');
ok(p.every(n => n.at.getHours() === 18 && n.at.getMinutes() === 0), 'все в 18:00');
ok(p[0].at.toDateString() === at(18).toDateString(), 'первое — сегодня');
ok(new Set(p.map(n => n.id)).size === p.length && p.every((n, i) => i === 0 || n.at > p[i - 1].at), 'id уникальны, время по возрастанию');
ok(!p.some(n => n.id >= 200), 'серии нет — вечерних предупреждений нет');
ok(p[0].body.includes('Осталось') === false, 'при 0 выполненных счёт «осталось» не добавляется');

p = R.plan(at(19));
ok(p.length === 6 && p[0].id === 101, '19:00: сегодняшнее время прошло — остаётся 6, начиная с завтра');

// серия есть, сегодня ничего не сделано
reset(); St.S.complete[St.shift(t, -1)] = 1;
p = R.plan(at(19));
const eve = p.find(n => n.id === 200);
ok(!!eve && eve.body.startsWith('Серия в 1 день сгорит в полночь.') && eve.body.includes('Осталось: 3 из 3'), 'вечером сегодня: «Серия в 1 день сгорит в полночь. Осталось: 3 из 3»');
ok(eve.at.getHours() === 21 && eve.at.getMinutes() === 30, 'вечернее в 21:30');
ok(!p.some(n => n.id === 201), 'завтрашнее вечернее не ставим, пока сегодня не закрыт');

// часть выполнена -> текст с остатком
St.S.log[t] = { [St.S.habits[0].id]: 1 };
p = R.plan(at(10));
ok(p[0].body.endsWith('Осталось: 2 из 3.'), 'днём с частью выполненного: «Осталось: 2 из 3.»');

// всё сделано сегодня
St.S.habits.forEach(h => { St.S.log[t] = St.S.log[t] || {}; St.S.log[t][h.id] = 1; }); St.S.complete[t] = 1;
p = R.plan(at(10));
ok(!p.some(n => n.id === 100) && !p.some(n => n.id === 200), 'всё сделано: сегодняшних напоминаний нет');
ok(p.some(n => n.id === 101) && p.some(n => n.id === 201), 'завтра придут дневное и вечернее (серия в безопасности до завтра)');
ok(p.find(n => n.id === 201).body.startsWith('Серия в 2 дня'), 'завтрашнее: серия в 2 дня (вчера + сегодня)');

// вечернее выключено, свои времена
St.S.settings.remind.evening = false; St.S.settings.remind.time = '07:05';
p = R.plan(at(5));
ok(!p.some(n => n.id >= 200) && p[0].at.getHours() === 7 && p[0].at.getMinutes() === 5, 'вечернее выключено; своё время 07:05');
St.S.settings.remind.time = 'мусор';
ok(R.plan(at(5)).filter(n => n.id < 200).length === 0, 'неверное время не ломает планировщик');

// quips
ok(R.DAY_QUIPS.length >= 7 && R.DAY_QUIPS.every(q => q[0] && q[1]) && R.EVENING_QUIPS.length >= 3, 'реплик достаточно');

// ---- обмен с плагином ----
reset(); calls.length = 0;
await R.reschedule();
const kinds = calls.map(c => c[0]).join(',');
ok(kinds === 'cancel,channel,schedule', 'перепланирование: cancel -> канал -> schedule (' + kinds + ')');
ok(calls[0][1].notifications.length === 9, 'отменяются все 9 возможных id');
const sch = calls.find(c => c[0] === 'schedule')[1].notifications;
ok(sch.length > 0 && sch.every(n => n.schedule.at instanceof Date && n.schedule.allowWhileIdle && n.channelId === 'habits' && n.title && n.body), 'уведомления: Date, allowWhileIdle, канал, заголовок и текст');

perm = 'denied'; calls.length = 0;
await R.reschedule();
ok(!calls.some(c => c[0] === 'schedule'), 'разрешения нет — ничего не планируется');
ok((await R.ensurePermission()) === false, 'ensurePermission: отказ');
perm = 'granted';
ok((await R.ensurePermission()) === true, 'ensurePermission: разрешено');

calls.length = 0; await R.sendTest();
const tn = calls.find(c => c[0] === 'schedule')[1].notifications[0];
ok(tn.id === 999 && tn.schedule.at.getTime() - Date.now() < 6000 && tn.schedule.at.getTime() - Date.now() > 3000, 'пробное уведомление — через ~5 секунд');

// в браузере (без Capacitor) — тихо ничего не делает
globalThis.window = {};
ok(R.supported() === false, 'в браузере уведомления «не поддерживаются»');
await R.reschedule();
let thrown = null; try { await R.sendTest(); } catch (e) { thrown = e.message; }
ok(/только в установленном/.test(thrown), 'в браузере пробное даёт понятную ошибку');

// старое хранилище без настроек напоминаний
localStorage._d = {}; localStorage.setItem('assistmanager.v1', JSON.stringify({ habits: [{ id: 'a', name: 'x' }], settings: { sound: false } }));
St.load();
ok(St.S.settings.sound === false && St.S.settings.remind.on === false && St.S.settings.remind.time === '18:00', 'старые данные дополняются настройками напоминаний');
process.exit(fails ? 1 : 0);
