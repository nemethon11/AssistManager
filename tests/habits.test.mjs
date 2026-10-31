const www = process.argv[2];
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=v} };
const St = await import(www + '/js/store.js');
const H = await import(www + '/js/habits.js');
St.load();
const t = St.today();
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) fails++; };

ok(H.streak() === 0, 'стрик в начале 0');
St.S.habits.forEach(h => H.setDone(h.id, true));
ok(!!St.S.complete[t] && H.streak() === 1, 'все отмечены -> день засчитан, стрик 1');
H.setDone(St.S.habits[0].id, false);
ok(!St.S.complete[t] && H.streak() === 0, 'снятие отметки отменяет день');
St.S.habits.forEach(h => H.setDone(h.id, true));

// 7 дней подряд -> заморозка
for (let i = 1; i <= 6; i++) St.S.complete[St.shift(t, -i)] = 1;
St.S.habits.forEach(h => H.setDone(h.id, false));
const ev = St.S.habits.map(h => H.setDone(h.id, true)).pop();
ok(H.streak() === 7 && ev.freeze && St.S.freezes === 1, 'седьмой день даёт заморозку');

// пропуск 1 дня + 1 заморозка
St.S.complete = {}; St.S.frozen = {}; St.S.freezes = 1;
St.S.complete[St.shift(t, -3)] = 1; St.S.complete[St.shift(t, -2)] = 1;
ok(H.applyFreezes() && St.S.frozen[St.shift(t, -1)] && St.S.freezes === 0, 'заморозка закрыла вчера');
ok(H.streak() === 3, 'стрик 3 с учётом заморозки');

// пропуск 2 дней при 1 заморозке -> серия рвётся
St.S.complete = {}; St.S.frozen = {}; St.S.freezes = 1;
St.S.complete[St.shift(t, -3)] = 1;
ok(!H.applyFreezes() && H.streak() === 0, 'пропуск больше заморозок -> серия сгорела');

ok(['день','дня','дней'].join() === [H.plural(1),H.plural(2),H.plural(5)].join() && H.plural(11)==='дней' && H.plural(22)==='дня', 'склонение дней');
const h = H.addHabit({ name:'Йога', minutes:15 });
ok(h.minutes === 15 && h.kind === 'check', 'таймер у обычной привычки');
const r = H.addHabit({ name:'Книга', reading:true });
ok(r.kind === 'reading' && r.minutes === 10, 'чтение по умолчанию 10 минут');
process.exit(fails ? 1 : 0);
