// Запускает все проверки из папки tests и печатает итог. Запуск: npm test
// Проверки работают без телефона: на настоящей разметке приложения (jsdom), с подставными плагинами Android.
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'www');
const wwwUrl = pathToFileURL(www).href;

// какому тесту что передавать: путь к папке www или её адрес file://
const tests = [
  ['habits.test.mjs', wwwUrl, 'привычки, стрик, заморозки'],
  ['timer.test.mjs', wwwUrl, 'таймер: пауза, простой, цель'],
  ['parsers.test.mjs', wwwUrl, 'TXT, FB2, EPUB'],
  ['pdf.test.mjs', wwwUrl, 'PDF (настоящий pdf.js)'],
  ['reminders.test.mjs', wwwUrl, 'напоминания'],
  ['widget.test.mjs', wwwUrl, 'данные для виджета'],
  ['reading-session.test.mjs', www, 'чтение как привычка'],
  ['app.test.mjs', www, 'запуск, XP, ранги, звуки, копия'],
  ['back-button.test.mjs', www, 'кнопка «Назад», отступы'],
  ['reorder.test.mjs', www, 'порядок привычек'],
  ['history.test.mjs', www, 'история: календарь, график, итоги'],
  ['book-search.test.mjs', www, 'поиск и закладки в читалке'],
];

let total = 0, failed = 0;
for (const [file, arg, title] of tests) {
  const r = spawnSync(process.execPath, ['--no-warnings', path.join(root, 'tests', file), arg], { encoding: 'utf8', cwd: root });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = (out.match(/^OK /gm) || []).length;
  const bad = (out.match(/^FAIL/gm) || []).length;
  const crashed = r.status !== 0 && bad === 0;
  console.log(`${bad || crashed ? '✗' : '✓'} ${file.padEnd(28)} ${String(ok).padStart(3)} проверок  — ${title}`);
  if (bad || crashed || ok === 0) {
    failed++;
    console.log(out.split('\n').filter(l => /^FAIL|Error|at /.test(l)).slice(0, 12).join('\n'));
  }
  total += ok;
}
console.log(`\nИтого: ${total} проверок, неудачных файлов: ${failed}`);
process.exit(failed ? 1 : 0);