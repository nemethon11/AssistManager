// Кнопка «Назад» на Android: закрывает самый верхний экран; на главном экране сворачивает приложение
// (а не закрывает его — серия и таймеры остаются в порядке).
import { appPlugin } from './timer.js';

const $ = id => document.getElementById(id);
const open = id => $(id) && !$(id).hidden;

// Закрыть верхний открытый экран. Вернёт true, если что-то закрыли.
export function goBack(closeHabitSheet, isEditing, stopEditing) {
  if (open('doneCard')) { $('doneOk').click(); return true; }
  if (open('sheet')) { closeHabitSheet(); return true; }
  if (open('settingsView')) { $('setBack').click(); return true; }
  if (open('historyView')) { $('hiBack').click(); return true; }
  if (open('readerView')) {
    if (open('lib')) { $('libClose').click(); return true; }
    if (open('set')) { $('setClose').click(); return true; }
    $('rClose').click();
    return true;
  }
  if (open('timerView')) { $('tvBack').click(); return true; }
  if (isEditing()) { stopEditing(); return true; }
  return false;
}

export function initBack(closeHabitSheet, isEditing, stopEditing) {
  const App = appPlugin();
  if (!App || !App.addListener) return;
  App.addListener('backButton', () => {
    if (goBack(closeHabitSheet, isEditing, stopEditing)) return;
    if (App.minimizeApp) App.minimizeApp(); else if (App.exitApp) App.exitApp();
  });
}
