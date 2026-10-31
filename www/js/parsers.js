// Разбор книг: TXT, FB2, EPUB, PDF -> список блоков { t: 'h' | 'p', s: текст }.
// Перенесено из reference/reader.html. JSZip и pdf.js лежат в www/vendor и грузятся по требованию (офлайн).

export const norm = s => (s || '').replace(/\s+/g, ' ').trim();

export function decodeText(buf, hint) {
  if (hint) { try { return new TextDecoder(hint).decode(buf); } catch (e) { /* неизвестная кодировка */ } }
  let t = new TextDecoder('utf-8').decode(buf);
  // Много «ромбиков» — скорее всего, старая кодировка Windows-1251.
  if ((t.match(/�/g) || []).length > 5) { try { t = new TextDecoder('windows-1251').decode(buf); } catch (e) { /* оставляем utf-8 */ } }
  return t;
}

// \b в JS не понимает кириллицу, поэтому конец слова проверяем через (?![буквы]).
const headRe = /^(глава|часть|книга|пролог|эпилог|chapter|part|prologue|epilogue)(?![a-zа-яё])/i;
function isHead(l) {
  if (l.length > 70) return false;
  if (headRe.test(l)) return true;
  if (/^[IVXLC]+\.?$/.test(l) || /^\d{1,3}\.?$/.test(l)) return true;
  return l.length > 3 && l === l.toUpperCase() && /[A-ZА-ЯЁ]/.test(l) && !/[.,;:!?…]$/.test(l);
}

export function parseTxt(text) {
  text = text.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const blanks = lines.filter(l => !l.trim()).length;
  const blocks = blanks > lines.length / 6 ? text.split(/\n\s*\n/) : lines;
  const items = [];
  for (const b of blocks) {
    const s = norm(b);
    if (!s) continue;
    items.push({ t: isHead(s) ? 'h' : 'p', s });
  }
  return items;
}

export function parseFb2(buf) {
  const head = new TextDecoder('latin1').decode(buf.slice(0, 300));
  const enc = (head.match(/encoding=["']([\w-]+)["']/i) || [])[1];
  const xml = new DOMParser().parseFromString(decodeText(buf, enc), 'application/xml');
  const title = norm((xml.getElementsByTagName('book-title')[0] || {}).textContent) || '';
  const items = [];
  const walk = el => {
    for (const c of el.children) {
      const n = c.localName;
      if (n === 'title' || n === 'subtitle') { const s = norm(c.textContent); if (s) items.push({ t: 'h', s }); }
      else if (n === 'p' || n === 'v' || n === 'text-author') { const s = norm(c.textContent); if (s) items.push({ t: 'p', s }); }
      else if (['section', 'epigraph', 'cite', 'poem', 'stanza'].includes(n)) walk(c);
    }
  };
  for (const body of xml.getElementsByTagName('body')) {
    if (body.getAttribute('name') === 'notes') continue;
    walk(body);
  }
  return { title, items };
}

function resolve(base, href) {
  const out = [];
  for (const p of (base + href).split('/')) {
    if (p === '..') out.pop(); else if (p !== '.') out.push(p);
  }
  return out.join('/');
}

export async function parseEpub(buf) {
  await loadScript('vendor/jszip.min.js', () => window.JSZip);
  const zip = await window.JSZip.loadAsync(buf);
  const cont = await zip.file('META-INF/container.xml').async('string');
  const opfPath = new DOMParser().parseFromString(cont, 'application/xml').getElementsByTagName('rootfile')[0].getAttribute('full-path');
  const opf = new DOMParser().parseFromString(await zip.file(opfPath).async('string'), 'application/xml');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const title = norm((opf.getElementsByTagName('dc:title')[0] || opf.getElementsByTagName('title')[0] || {}).textContent);
  const man = {};
  for (const it of opf.getElementsByTagName('item')) man[it.getAttribute('id')] = it.getAttribute('href');
  const items = [];
  for (const ref of opf.getElementsByTagName('itemref')) {
    const href = man[ref.getAttribute('idref')];
    if (!href) continue;
    const f = zip.file(resolve(base, decodeURIComponent(href)));
    if (!f) continue;
    const doc = new DOMParser().parseFromString(await f.async('string'), 'text/html');
    const sel = 'h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,dt,dd';
    const els = [...doc.body.querySelectorAll(sel)].filter(e => !e.parentElement.closest(sel));
    if (!els.length) { parseTxt(doc.body.innerText || doc.body.textContent || '').forEach(x => items.push(x)); continue; }
    for (const e of els) {
      const s = norm(e.textContent);
      if (s) items.push({ t: /^h\d$/i.test(e.tagName) ? 'h' : 'p', s });
    }
  }
  return { title, items };
}

// Собираем абзацы из позиционированных кусков текста страниц PDF.
function pdfLayout(pages) {
  const lines = [];
  for (const items of pages) {
    const pl = [];
    for (const it of items) {
      if (!it.str) continue;
      const y = Math.round(it.y), last = pl[pl.length - 1];
      if (last && Math.abs(last.y - y) <= Math.max(2, it.h * .4)) last.parts.push(it);
      else pl.push({ y, h: it.h, parts: [it] });
    }
    for (const l of pl) {
      l.parts.sort((a, b) => a.x - b.x);
      let t = '', end = null;
      for (const p of l.parts) {
        if (end != null && p.x - end > p.h * .15 && !/\s$/.test(t) && !/^\s/.test(p.str)) t += ' ';
        t += p.str;
        end = p.x + p.w;
      }
      l.text = norm(t); l.x = l.parts[0].x; l.right = end;
      if (!l.text || /^[\divxlc]{1,4}$/i.test(l.text)) continue;   // пустое и номера страниц
      lines.push(l);
    }
    if (lines.length) lines[lines.length - 1].pageEnd = true;
  }
  if (!lines.length) return [];
  const sorted = a => a.slice().sort((p, q) => p - q);
  const med = a => (a.length ? sorted(a)[Math.floor(a.length / 2)] : 0);
  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y;
    if (g > 0 && !lines[i - 1].pageEnd) gaps.push(g);
  }
  const gap = med(gaps) || 14;
  const left = med(lines.map(l => Math.round(l.x)));
  const right = sorted(lines.map(l => l.right))[Math.floor(lines.length * .9)];
  const hMed = med(lines.map(l => l.h));
  const items = [];
  let cur = '';
  const push = () => { const s = norm(cur); if (s) items.push({ t: 'p', s }); cur = ''; };
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    let brk = !prev;
    if (prev) {
      const g = prev.y - l.y;
      const indent = l.x - left > hMed * .8;
      const prevShort = prev.right < right - hMed * 2.5;
      if (!prev.pageEnd && g > gap * 1.45) brk = true;
      if (indent) brk = true;
      if (prevShort && /[.!?…:»"]$/.test(prev.text)) brk = true;
      if (l.h > hMed * 1.25 || prev.h > hMed * 1.25) brk = true;
    }
    if (brk) push();
    if (cur && /[A-Za-zА-Яа-яЁё]-$/.test(cur) && /^[a-zа-яё]/.test(l.text)) cur = cur.slice(0, -1) + l.text;   // перенос слова
    else cur = cur ? cur + ' ' + l.text : l.text;
    if (l.h > hMed * 1.25 && cur.length < 120) { const s = norm(cur); if (s) items.push({ t: 'h', s }); cur = ''; }
  });
  push();
  return items;
}

const loaded = {};
function loadScript(src, ready) {
  if (ready && ready()) return Promise.resolve();
  if (loaded[src]) return loaded[src];
  loaded[src] = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = src;
    sc.onload = res;
    sc.onerror = () => rej(new Error('Не загрузилась встроенная библиотека (' + src + ').'));
    document.head.append(sc);
  });
  return loaded[src];
}

export async function parsePdf(buf, onProgress) {
  await loadScript('vendor/pdf.min.js', () => window.pdfjsLib);
  // Скрипт воркера сам регистрирует window.pdfjsWorker — так pdf.js работает без отдельного потока.
  await loadScript('vendor/pdf.worker.min.js', () => window.pdfjsWorker);
  const lib = window.pdfjsLib;
  const doc = await lib.getDocument({ data: buf, isEvalSupported: false }).promise;
  let title = '';
  try { title = norm((await doc.getMetadata()).info.Title); } catch (e) { /* без названия */ }
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push(tc.items.map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || it.height })));
    if (i % 5 === 0) onProgress(i, doc.numPages);
  }
  const items = pdfLayout(pages).map(it => (it.t === 'p' && it.s.length < 70 && headRe.test(it.s)) ? { t: 'h', s: it.s } : it);
  if (!items.length) throw new Error('В этом PDF нет текста, только картинки страниц (скан).');
  return { title, items };
}

// Определяем формат по содержимому и имени файла.
export async function parseFile(file, onProgress = () => {}) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  const isPdf = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
  if (isPdf || name.endsWith('.pdf')) return parsePdf(buf, onProgress);
  if (name.endsWith('.epub')) return parseEpub(buf);
  if (name.endsWith('.fb2')) return parseFb2(buf);
  return { title: '', items: parseTxt(decodeText(buf)) };
}
