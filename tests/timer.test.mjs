const www = process.argv[2];
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=v} };
globalThis.document = { hidden:false, addEventListener(){} };
globalThis.window = {};
globalThis.setInterval = () => 1; globalThis.clearInterval = () => {};
let now = 1_000_000_000_000; Date.now = () => now;
const St = await import(www + '/js/store.js');
const T = await import(www + '/js/timer.js');
St.load();
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) fails++; };
const adv = s => { for (let i = 0; i < s; i++) { now += 1000; t.tick(); } };

let goals = 0;
var t = new T.HabitTimer({ id: 'a', goalSec: 60, onGoal: () => goals++ });
ok(t.state() === 'stopped', 'до старта: stopped');
adv(10); ok(T.secsToday('a') === 0, 'без старта время не идёт');
t.start(); adv(30);
ok(Math.round(T.secsToday('a')) === 30, 'идёт 30 с');
t.setVisible(false); now += 600_000; t.tick(); t.setVisible(true);
ok(t.state() === 'running' && Math.round(T.secsToday('a')) === 30, 'свернули на 10 мин — время не прибавилось');
adv(30);
ok(goals === 1 && t.reached, 'цель достигнута, onGoal вызван один раз');
adv(15); ok(goals === 1 && Math.round(T.secsToday('a')) === 75, 'после цели время копится дальше');
t.stop(); adv(20); ok(Math.round(T.secsToday('a')) === 75, 'после stop не идёт');

// простой 2 минуты
var t = new T.HabitTimer({ id: 'r', goalSec: 600, idleSec: 120 });
t.start(); adv(60); t.activity(); adv(200);
ok(t.state() === 'idle', 'через 2 мин без действий — idle');
ok(Math.round(T.secsToday('r')) === 60 + 120, 'засчитано 60 + 120 с простоя до границы (' + Math.round(T.secsToday('r')) + ')');
t.activity(); adv(10);
ok(t.state() === 'running' && Math.round(T.secsToday('r')) === 190, 'листнули — снова идёт');
t.stop();
ok(JSON.parse(localStorage.getItem('assistmanager.v1')).secs[St.today()].r > 0, 'секунды сохранены в localStorage');
process.exit(fails ? 1 : 0);
