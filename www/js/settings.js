// Экран настроек: звук и резервная копия.
import { S, save } from './store.js';
import * as Snd from './sound.js';
import { exportBackup, parseBackup, parseLegacyCode, restore } from './backup.js';

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
}

function askRestore(parsed) {
  pending = parsed;
  $('restoreInfo').textContent = 'В копии: привычек — ' + parsed.state.habits.length +
    (parsed.books.length ? ', книг — ' + parsed.books.length : '') + '. Текущий прогресс будет заменён.';
  $('restoreBox').hidden = false;
}

export function initSettings() {
  $('gearBtn').onclick = () => { paint(); say(''); $('restoreBox').hidden = true; $('settingsView').hidden = false; };
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
