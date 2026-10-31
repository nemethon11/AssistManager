// Поиск по книге и закладки в читалке.
import { boot } from './helpers/boot.mjs';

const { $, w, ok, done, St, url, sleep, flush } = await boot(process.argv[2]);
const S = await import(url + '/js/booksearch.js');
const Lib = await import(url + '/js/library.js');

// ---- чистый поиск ----
const items = [
  { t: 'p', s: 'Зеркало висело в прихожей и молчало.' },
  { t: 'p', s: 'Ёжик спрятался под столом, а за ним тянулась тень.' },
  { t: 'h', s: 'Глава про ЗЕРКАЛО' },
  { t: 'p', s: 'Ничего интересного.' },
];
let r = S.findInItems(items, 'зеркало');
ok(r.length === 2 && r[0].src === 0 && r[1].src === 2, 'регистр не важен: найдено 2 (абзац и заголовок)');
ok(r[0].match === 'Зеркало' && r[0].before === '' && r[0].after.startsWith(' висело'), 'совпадение сохраняет исходный регистр, вокруг — текст');
r = S.findInItems(items, 'ежик');
ok(r.length === 1 && r[0].src === 1 && r[0].match === 'Ёжик', '«е» находит «ё»: «ежик» -> «Ёжик»');
ok(S.findInItems(items, 'ёжик').length === 1, '«ё» находит «ё»');
ok(S.findInItems(items, 'з').length === 0 && S.findInItems(items, '').length === 0 && S.findInItems(items, '   ').length === 0, 'запрос короче 2 символов или пустой — пусто');
ok(S.findInItems(items, 'нет такого').length === 0, 'ничего не нашлось — пустой список');
const long = [{ t: 'p', s: 'a'.repeat(100) + 'СЛОВО' + 'b'.repeat(200) }];
r = S.findInItems(long, 'слово');
ok(r[0].before.startsWith('…') && r[0].before.length === 31 && r[0].after.endsWith('…') && r[0].after.length === 61, 'длинный абзац: кусок вокруг обрезан с многоточиями');
const many = Array.from({ length: 100 }, (_, i) => ({ t: 'p', s: 'слово номер ' + i }));
r = S.findInItems(many, 'слово', 40);
ok(r.length === 40 && r.more === true, 'результатов не больше лимита, есть признак «ещё есть»');
ok(S.findInItems(items, 'зеркало  ').length === 2 && S.findInItems([{ t: 'p', s: 'а б в' }], 'а    б').length === 1, 'лишние пробелы в запросе не мешают');

// ---- в читалке ----
const paras = Array.from({ length: 40 }, (_, i) => ({ t: 'p', s: 'Абзац номер ' + i + '. Обычный текст без особых слов, просто чтобы был.' }));
paras[7] = { t: 'p', s: 'Зеркало висело в прихожей, и в нём отражалось всё лишнее.' };
paras[22] = { t: 'p', s: 'Ёжик спрятался, а ЗЕРКАЛО отражало ежа.' };
const book = await Lib.addBook('Тестовая книга', paras);
St.S.reader.current = book.id; St.S.reader.mode = 'para';
$('readBtn').click(); await sleep();
ok(!$('readerView').hidden && $('btitle').textContent === 'Тестовая книга', 'читалка открыла тестовую книгу');
for (let i = 0; i < 9; i++) $('nextBtn').click();
const shownLast = () => { const k = $('feedIn').querySelectorAll('.chunk'); return k[k.length - 1].textContent; };
ok(shownLast().includes('Абзац номер 9'), 'прочитано до абзаца №9 (последний показан: ' + shownLast().slice(0, 30) + '…)');
const posBefore = Lib.getPos(book.id);

// закладка через меню
$('setBtn').click(); ok(!$('set').hidden && !!$('menuFind') && !!$('menuMark'), 'меню «Аа» с пунктами поиска и закладки');
$('menuMark').click();
ok($('set').hidden && !$('find').hidden && $('findMsg').textContent === 'Закладка поставлена.', 'пункт 2: закладка поставлена, открыт лист поиска');
ok($('marks').querySelectorAll('.mark-row').length === 1 && $('marks').textContent.includes('Абзац номер 9'), 'закладка в списке с началом текста');
$('findClose').click(); $('setBtn').click(); $('menuMark').click();
ok($('findMsg').textContent === 'Здесь закладка уже есть.' && Lib.getMarks(book.id).length === 1, 'повторная закладка на том же месте не дублируется');

// поиск
$('findQ').value = 'зеркало'; $('findQ').dispatchEvent(new w.Event('input')); flush();
const found = $('finds').querySelectorAll('.found');
ok(found.length === 2 && found[0].querySelector('mark').textContent === 'Зеркало', 'поиск «зеркало»: 2 результата, совпадение подсвечено');
$('findQ').value = 'ёж'; $('findQ').dispatchEvent(new w.Event('input')); flush();
ok($('finds').querySelectorAll('.found').length === 1, 'поиск «ёж» находит «Ёжик»');
$('findQ').value = 'нетутнеттакого'; $('findQ').dispatchEvent(new w.Event('input')); flush();
ok($('finds').textContent === 'Ничего не нашлось.', 'сообщение, когда ничего не нашлось');

// переход к результату
$('findQ').value = 'зеркало'; $('findQ').dispatchEvent(new w.Event('input')); flush();
$('finds').querySelectorAll('.found')[1].click(); await sleep();
ok($('find').hidden && shownLast().includes('ЗЕРКАЛО отражало ежа'), 'нажали второй результат: читалка показывает абзац №22 последним');
ok(Lib.getPos(book.id) === 23, 'место сохранено: следующий абзац — №23');
ok(Lib.getBack(book.id) === posBefore, 'прежнее место запомнено для возврата (' + posBefore + ')');

// вернуться
$('setBtn').click(); $('menuFind').click();
ok(!$('backRow').hidden, 'в листе поиска появилась кнопка «Туда, где я читал»');
$('retBtn').click(); await sleep();
ok(shownLast().includes('Абзац номер 9') && Lib.getPos(book.id) === posBefore && Lib.getBack(book.id) === null, 'вернулись на абзац №9, точка возврата сброшена');
$('setBtn').click(); $('menuFind').click();
ok($('backRow').hidden, 'после возврата кнопки «вернуться» нет');

// переход по закладке
$('finds').textContent = ''; $('findQ').value = '';
$('findQ').dispatchEvent(new w.Event('input')); flush();
Lib.addMark(book.id, 30, 'Абзац номер 30. Обычный текст…');
$('findClose').click(); $('setBtn').click(); $('menuFind').click();
const rows = $('marks').querySelectorAll('.mark-row');
ok(rows.length === 2 && rows[1].textContent.includes('номер 30'), 'закладки отсортированы по порядку в книге');
rows[1].querySelector('.found').click(); await sleep();
ok(shownLast().includes('Абзац номер 30'), 'переход по закладке открыл абзац №30');

// удаление закладки
$('setBtn').click(); $('menuFind').click();
$('marks').querySelectorAll('.del')[0].click();
ok(Lib.getMarks(book.id).length === 1 && Lib.getMarks(book.id)[0].src === 30, 'удалили закладку — осталась одна');

// «Назад» закрывает лист поиска, потом читалку
const BK = await import(url + '/js/back.js');
ok(BK.goBack(() => {}, () => false, () => {}) === true && $('find').hidden && !$('readerView').hidden, '«Назад» закрыл лист поиска, читалка осталась');
ok(BK.goBack(() => {}, () => false, () => {}) === true && $('readerView').hidden, 'второе «Назад» закрыло читалку');

// удаление книги убирает её закладки
Lib.addMark(book.id, 3, 'x'); Lib.setBack(book.id, 5);
await Lib.removeBook(book.id);
ok(!(book.id in St.S.reader.marks) && !(book.id in St.S.reader.back) && !(book.id in St.S.reader.pos), 'удаление книги чистит закладки, точку возврата и место');
done();
