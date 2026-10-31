// Отправка свежих цифр виджету на рабочем столе (нативный плагин WidgetBridge, написан на Kotlin).
// Вне телефона (в браузере) ничего не делает.
import { S, today } from './store.js';
import * as H from './habits.js';

export const supported = () => {
  const cap = window.Capacitor;
  return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
};

export function snapshot() {
  const t = today();
  return {
    date: t,                          // на какой день верны цифры
    streak: H.streak(),               // серия, как на главном экране
    left: H.leftCount(),              // сколько привычек осталось
    total: S.habits.length,
    doneToday: !!S.complete[t],       // закрыт ли день целиком
  };
}

export function syncWidget() {
  if (!supported()) return Promise.resolve(false);
  try {
    return window.Capacitor.registerPlugin('WidgetBridge').update(snapshot()).then(() => true, () => false);
  } catch (e) {
    return Promise.resolve(false);
  }
}
