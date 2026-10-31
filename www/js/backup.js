// Резервная копия: всё состояние (привычки, журнал, XP, место в книгах) + по желанию сами книги — одним JSON-файлом.
import { S, replaceAll, today } from './store.js';
import { Books } from './library.js';

const APP = 'AssistManager';

export async function buildBackup(withBooks) {
  const out = { app: APP, version: 1, exported: new Date().toISOString(), state: S };
  if (withBooks) out.books = await Books.all();
  return out;
}

// Сохранить копию: на телефоне — через системное окно «Поделиться» (Диск, Файлы, мессенджер), в браузере — скачиванием.
export async function exportBackup(withBooks) {
  const data = await buildBackup(withBooks);
  const json = JSON.stringify(data);
  const name = APP + '-' + today() + (withBooks ? '-с-книгами' : '') + '.json';
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
    const FS = cap.registerPlugin('Filesystem');
    const Share = cap.registerPlugin('Share');
    const r = await FS.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' });
    await Share.share({ title: 'Резервная копия ' + APP, url: r.uri, dialogTitle: 'Куда сохранить копию' });
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  return { name, kb: Math.round(json.length / 1024), books: withBooks ? data.books.length : 0 };
}

// Разбор файла копии. Бросает ошибку с понятным текстом, если файл не подходит.
export function parseBackup(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { throw new Error('Это не файл копии (не читается как JSON).'); }
  if (!o || o.app !== APP || !o.state || !Array.isArray(o.state.habits)) throw new Error('Это не копия AssistManager.');
  return { state: o.state, books: Array.isArray(o.books) ? o.books : [] };
}

// Подставляем копию на место текущих данных.
export async function restore(parsed) {
  replaceAll(parsed.state);
  for (const b of parsed.books) await Books.put(b);
}

// Старый код из прототипа «Огонёк» (base64 от JSON).
export function parseLegacyCode(code) {
  let o;
  try { o = JSON.parse(decodeURIComponent(escape(atob(code.trim())))); } catch (e) { throw new Error('Код не подходит — вставь его целиком.'); }
  if (!o || !Array.isArray(o.habits)) throw new Error('В коде нет привычек.');
  return { state: o, books: [] };
}
