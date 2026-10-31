// Экран настроек: звук и резервная копия.
import { S, save } from './store.js';
import * as Snd from './sound.js';
import { exportBackup, parseBackup, parseLegacyCode, restore } from './backup.js';
import * as Rem from './reminders.js';

const $ = id => document.getElementById(id);
let pending = null;     // разобранная копия, ждущая подтверждения

function say(text, bad) {
  $('setMsg').textContent = text;
  $('setMsg').classList.toggle('bad', !!bad);
}

function paint() {
  $('optSound').checked = S.settings.sound;
  $('optAmbient').checked = S.settings.ambient;
  $('optAmbient').disabled = !S.settings.sound;
  const r = S.settings.remind;
  $('optRemind').checked = r.on;
  $('remindBox').hidden = !r.on;
  $('remTime').value = r.time;
  $('optEvening').checked = r.evening;
  $('eveTime').value = r.eveningTime;
  $('eveTime').disabled = !r.evening;
}

function remSay(text, bad) {
  $('remMsg').textContent = text;
  $('remMsg').classList.toggle('bad', !!bad);
}

function initReminders() {
  const r = () => S.settings.remind;
  const changed = () => { save(); paint(); Rem.reschedule(); };

  $('optRemind').onchange = async e => {
    remSay('');
    if (!e.target.checked) { r().on = false; changed(); return; }
    if (!Rem.supported()) {
      // В браузере уведомления не работают — сохраняем выбор, но честно говорим об этом.
      r().on = true; changed();
      remSay('Настройка сохранена, но уведомления приходят только в установленном приложении.');
      return;
    }
    let ok = false;
    try { ok = await Rem.ensurePermission(); } catch (err) { /* считаем отказом */ }
    if (!ok) {
      r().on = false; changed();
      remSay('Android не дал разрешение. Включи уведомления для AssistManager в настройках телефона и попробуй снова.', true);
      return;
    }
    r().on = true; changed();
  };
  $('remTime').onchange = e => { if (e.target.value) { r().time = e.target.value; changed(); } };
  $('optEvening').onchange = e => { r().evening = e.target.checked; changed(); };
  $('eveTime').onchange = e => { if (e.target.value) { r().eveningTime = e.target.value; changed(); } };
  $('remTest').onclick = async () => {
    try { await Rem.sendTest(); remSay('Пробное уведомление придёт через 5 секунд — можно свернуть приложение.'); }
    catch (err) { remSay(err.message || String(err), true); }
  };
}

function askRestore(parsed) {
  pending = parsed;
  $('restoreInfo').textContent = 'В копии: привычек — ' + parsed.state.habits.length +
    (parsed.books.length ? ', книг — ' + parsed.books.length : '') + '. Текущий прогресс будет заменён.';
  $('restoreBox').hidden = false;
}

export function initSettings() {
  initReminders();
  $('gearBtn').onclick = () => { paint(); say(''); remSay(''); $('restoreBox').hidden = true; $('settingsView').hidden = false; };
  $('setBack').onclick = () => { $('settingsView').hidden = true; };

  $('optSound').onchange = e => { S.settings.sound = e.target.checked; save(); paint(); if (e.target.checked) { Snd.unlock(); Snd.check(); } };
  $('optAmbient').onchange = e => { S.settings.ambient = e.target.checked; save(); if (e.target.checked) { Snd.unlock(); Snd.crackle(4); } };

  $('bkExport').onclick = async () => {
    say('Готовлю копию…');
    try {
      const r = await exportBackup($('optBooks').checked);
      say('Копия готова: ' + r.name + ' (' + r.kb + ' КБ' + (r.books ? ', книг: ' + r.books : '') + ').');
    } catch (e) {
      // Закрыли окно «Поделиться» — это не ошибка.
      say(/cancel/i.test(String(e && (e.message || e))) ? '' : 'Не получилось сохранить: ' + (e.message || e), true);
    }
  };

  $('bkImport').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { askRestore(parseBackup(await f.text())); say(''); }
    catch (err) { say(err.message, true); }
  };

  $('legacyBtn').onclick = () => {
    try { askRestore(parseLegacyCode($('legacyCode').value)); say(''); }
    catch (err) { say(err.message, true); }
  };

  $('restoreYes').onclick = async () => {
    if (!pending) return;
    try {
      await restore(pending);
      pending = null;
      location.reload();     // самый надёжный способ перечитать всё состояние
    } catch (err) { say('Не получилось восстановить: ' + (err.message || err), true); }
  };
  $('restoreNo').onclick = () => { pending = null; $('restoreBox').hidden = true; };
}
