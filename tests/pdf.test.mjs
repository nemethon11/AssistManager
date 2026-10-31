import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const www = process.argv[2];
globalThis.window = { pdfjsLib: require('pdfjs-dist/legacy/build/pdf.js'), pdfjsWorker: {} };
globalThis.document = { createElement() { throw new Error('не должен грузить скрипты'); } };
const P = await import(www + '/js/parsers.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) fails++; };

// Собираем настоящий PDF: заголовок крупным шрифтом, два абзаца (отступ первой строки, увеличенный интервал между абзацами)
const txt = (size, x, y, s) => `BT /F1 ${size} Tf ${x} ${y} Td (${s}) Tj ET\n`;
let c = '';
c += txt(22, 72, 740, 'Chapter One');
c += txt(12, 90, 700, 'The first paragraph starts here and it keeps going across the whole line of the');
c += txt(12, 72, 686, 'page so that the layout code sees a long line, then another long line that goes');
c += txt(12, 72, 672, 'almost to the edge, and finally a short end.');
c += txt(12, 90, 644, 'Second paragraph begins after a bigger gap and also with an indent, spanning the');
c += txt(12, 72, 630, 'full width of the text block before it ends.');
const objs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${c.length} >>\nstream\n${c}endstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];
let pdf = '%PDF-1.4\n'; const offs = [];
objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

const r = await P.parsePdf(new Uint8Array(Buffer.from(pdf, 'latin1')), () => {});
console.log(JSON.stringify(r.items.map(i => i.t + ': ' + i.s.slice(0, 40) + '… (' + i.s.length + ')')));
ok(r.items.length === 3, 'PDF разобран на 3 блока (заголовок + 2 абзаца), получено ' + r.items.length);
ok(r.items[0] && r.items[0].t === 'h' && r.items[0].s === 'Chapter One', 'крупный шрифт распознан как заголовок');
ok(r.items[1] && r.items[1].t === 'p' && r.items[1].s.startsWith('The first paragraph') && r.items[1].s.endsWith('a short end.') && r.items[1].s.includes('of the page so'), 'первый абзац склеен из 3 строк без разрывов');
ok(r.items[2] && r.items[2].s.startsWith('Second paragraph') && r.items[2].s.endsWith('before it ends.'), 'второй абзац отделён');

// PDF без текста (скан) — понятная ошибка
const empty = pdf.replace(/BT[\s\S]*?ET\n/g, '').replace(/\/Length \d+/, '/Length 0');
let err = null; try { await P.parsePdf(new Uint8Array(Buffer.from(empty, 'latin1')), () => {}); } catch (e) { err = e.message; }
ok(err !== null, 'PDF без текста или битый даёт ошибку, а не пустую книгу: «' + String(err).slice(0, 60) + '»');
process.exit(fails ? 1 : 0);
