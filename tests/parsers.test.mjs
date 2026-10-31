import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
const www = process.argv[2];
globalThis.DOMParser = new JSDOM().window.DOMParser;
globalThis.window = { JSZip };
const P = await import(www + '/js/parsers.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) fails++; };

// TXT: пустые строки как разделители, заголовок «Глава 1»
let it = P.parseTxt('Глава 1\n\nПервый абзац.\n\nВторой абзац.\r\n\n');
ok(it.length === 3 && it[0].t === 'h' && it[1].s === 'Первый абзац.', 'TXT: заголовок + 2 абзаца');
// TXT без пустых строк: каждая строка — абзац
it = P.parseTxt('Строка один.\nСтрока два.\nСтрока три.');
ok(it.length === 3 && it.every(x => x.t === 'p'), 'TXT: построчно');
// windows-1251
const cp = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, 0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, 0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
ok(P.decodeText(cp).startsWith('Привет'), 'TXT: кодировка windows-1251');

// FB2
const fb2 = '<?xml version="1.0" encoding="utf-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Тест</book-title></title-info></description><body><section><title><p>Глава первая</p></title><p>Абзац <emphasis>раз</emphasis>.</p><p>Абзац два.</p></section></body><body name="notes"><section><p>Сноска</p></section></body></FictionBook>';
let r = P.parseFb2(new TextEncoder().encode(fb2));
ok(r.title === 'Тест' && r.items.length === 3 && r.items[0].t === 'h' && r.items[1].s === 'Абзац раз.', 'FB2: название, заголовок, абзацы без сносок');

// EPUB
const z = new JSZip();
z.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>');
z.file('OEBPS/content.opf', '<package><metadata><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Книга</dc:title></metadata><manifest><item id="c1" href="ch1.xhtml"/><item id="c2" href="text/ch2.xhtml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>');
z.file('OEBPS/ch1.xhtml', '<html><body><h1>Первая</h1><p>Раз.</p><p>Два.</p></body></html>');
z.file('OEBPS/text/ch2.xhtml', '<html><body><h2>Вторая</h2><p>Три.</p></body></html>');
r = await P.parseEpub(await z.generateAsync({ type: 'uint8array' }));
ok(r.title === 'Книга' && r.items.map(x => x.t + ':' + x.s).join('|') === 'h:Первая|p:Раз.|p:Два.|h:Вторая|p:Три.', 'EPUB: название и порядок глав (' + r.items.length + ' блоков)');
process.exit(fails ? 1 : 0);
