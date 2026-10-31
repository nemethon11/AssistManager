// Таймер привычки. Считает только «живое» время:
//  - ставится на паузу, когда приложение свернули (visibilitychange + событие Capacitor App);
//  - если задан idleSec, ставится на паузу, когда долго не было действий (для читалки — 2 минуты).
// Секунды копятся за день в S.secs[дата][id], так что время не теряется между запусками.
import { S, save, today } from './store.js';

export const secsToday = id => ((S.secs[today()] || {})[id]) || 0;

/* ---------- сворачивание приложения ---------- */
const appListeners = new Set();
let appHooked = false;
function hookApp() {
  if (appHooked) return;
  appHooked = true;
  const emit = active => appListeners.forEach(f => f(active));
  document.addEventListener('visibilitychange', () => emit(!document.hidden));
  try {
    // Плагин App из Capacitor; в браузере его нет — тогда хватает visibilitychange.
    const App = window.Capacitor && window.Capacitor.registerPlugin && window.Capacitor.registerPlugin('App');
    if (App && App.addListener) App.addListener('appStateChange', s => emit(!!s.isActive));
  } catch (e) { /* без плагина */ }
}
// Подписка на «приложение стало активным / ушло в фон». Возвращает функцию отписки.
export function onAppActive(cb) {
  hookApp();
  appListeners.add(cb);
  return () => appListeners.delete(cb);
}

/* ---------- таймер ---------- */
export class HabitTimer {
  /**
   * @param {{id:string, goalSec:number, idleSec?:number,
   *          onTick?:Function, onGoal?:Function, onState?:Function}} o
   */
  constructor(o) {
    this.id = o.id;
    this.goalSec = o.goalSec;
    this.idleSec = o.idleSec || 0;
    this.onTick = o.onTick || (() => {});
    this.onGoal = o.onGoal || (() => {});
    this.onState = o.onState || (() => {});
    this.onAdd = o.onAdd || (() => {});     // вызывается с каждой порцией засчитанных секунд
    this.want = false;                       // пользователь хочет, чтобы время шло
    this.visible = !document.hidden;
    this.lastAct = Date.now();
    this.last = Date.now();
    this.reached = this.secs() >= this.goalSec;
    this.unsub = onAppActive(v => this.setVisible(v));
    this.iv = null;
    this.unsaved = 0;
  }

  secs() { return secsToday(this.id); }

  // stopped — не запущен, away — приложение свёрнуто, idle — долго не было действий, running — идёт
  state() {
    if (!this.want) return 'stopped';
    if (!this.visible) return 'away';
    if (this.idleSec && Date.now() - this.lastAct >= this.idleSec * 1000) return 'idle';
    return 'running';
  }

  start() {
    if (this.want) return;
    this.want = true;
    this.lastAct = Date.now();
    this.last = Date.now();
    this.iv = setInterval(() => this.tick(), 1000);
    this.emit();
  }

  stop() {
    this.tick();
    this.want = false;
    clearInterval(this.iv);
    this.iv = null;
    this._flush();
    this.emit();
  }

  destroy() { this.stop(); this.unsub(); }

  // Действие пользователя (листание, касание) — сбрасывает «простой».
  activity() {
    const was = this.state();
    if (was === 'idle') this.last = Date.now();
    else this.tick();
    this.lastAct = Date.now();
    if (was !== this.state()) this.emit();
  }

  setVisible(v) {
    if (v === this.visible) return;
    if (!v) { this.tick(); this._flush(); }   // уходим в фон: дописать время и сохранить
    this.visible = v;
    this.last = Date.now();
    this.emit();
  }

  // Прибавить прошедшее время, если таймер реально идёт.
  tick() {
    const now = Date.now();
    if (this.want && this.visible) {
      let until = now;
      // Время простоя до границы засчитывается, дальше — нет.
      if (this.idleSec) until = Math.min(now, this.lastAct + this.idleSec * 1000);
      const d = Math.min(until - this.last, 5000);
      if (d > 0) this._add(d / 1000);
    }
    this.last = now;
    this.emit();
  }

  _add(sec) {
    const t = today();
    S.secs[t] = S.secs[t] || {};
    S.secs[t][this.id] = Math.round(((S.secs[t][this.id] || 0) + sec) * 10) / 10;
    this.unsaved += sec;
    this.onAdd(sec);
    if (!this.reached && this.secs() >= this.goalSec) {
      this.reached = true;
      this._flush();
      this.onGoal();
    } else if (this.unsaved >= 5) {
      this._flush();
    }
  }

  _flush() { if (this.unsaved) { this.unsaved = 0; save(); } }

  emit() {
    const st = this.state();
    this.onTick(this.secs(), st);
    this.onState(st);
  }
}
