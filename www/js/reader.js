// Читалка «Абзац за абзацем» (перенесено из reference/reader.html).
// Текст выдаётся по одному куску; следующий не виден заранее. Снаружи читалку можно «подцепить» через openReader({...}).
import { S, save } from './store.js';
import * as Lib from './library.js';
import { parseFile, parseTxt, norm } from './parsers.js';
import { paint } from './paint.js';
import { findInItems } from './booksearch.js';

const $ = id => document.getElementById(id);
const WINDOW = 30;                       // сколько кусков держим на экране
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let book = null, chunks = [], pos = 0;
let auto = false, autoT = null, wake = null;
let hooks = {};                          // onAdvance(), onBack(), onActivity(), onClose() — их задаёт тот, кто открыл читалку
let started = false;

const R = () => S.reader;
const feed = () => $('feed'), feedIn = () => $('feedIn');

/* ---------- порции текста ---------- */
function chunkify(items, mode) {
  const out = [];
  items.forEach((it, i) => {
    if (it.t === 'h' || mode === 'para' || it.s.length <= 380) { out.push({ t: it.t, s: it.s, src: i }); return; }
    const sents = it.s.split(/(?<=[.!?…])\s+(?=[—–«"„(A-ZА-ЯЁ0-9])/);
    let buf = '', first = true;
    const flush = () => { out.push({ t: 'p', s: buf, src: i, cont: !first }); first = false; };
    for (const s of sents) {
      if (buf && buf.length + s.length > 300) { flush(); buf = s; }
      else buf = buf ? buf + ' ' + s : s;
    }
    if (buf) flush();
  });
  return out;
}

/* ---------- отрисовка ---------- */
function el(c) {
  const d = document.createElement('div');
  if (c.t === 'h') { d.className = 'chapter'; d.textContent = c.s; return d; }
  const line = /^[—–-]\s/.test(c.s);
  d.className = 'chunk' + (c.cont ? ' cont' : '') + (line ? ' line' : '');
  if (!c.cont) {
    const w = document.createElement('span');
    w.className = 'who';
    w.innerHTML = line ? 'Реплика <em>[в книге]</em> <i>–</i> ' : 'Рассказчик <i>–</i> ';
    d.append(w);
  }
  d.append(document.createTextNode(line ? c.s.replace(/^[—–-]\s*/, '') : c.s));
  return d;
}

function render() {
  const fi = feedIn();
  fi.textContent = '';
  const from = Math.max(0, pos - WINDOW);
  const m = document.createElement('div');
  m.className = 'mark';
  m.textContent = from > 0 ? 'Ранее прочитанное скрыто' : 'Начало';
  fi.append(m);
  for (let i = from; i < pos; i++) fi.append(el(chunks[i]));
  markNow(); endMark(); stats();
  requestAnimationFrame(() => { feed().scrollTop = feed().scrollHeight; });
}

function markNow() {
  const fi = feedIn();
  fi.querySelectorAll('.now').forEach(e => e.classList.remove('now'));
  const kids = [...fi.querySelectorAll('.chunk,.chapter')];
  let k = kids.length - 1;
  if (k < 0) return;
  kids[k].classList.add('now');
  while (--k >= 0 && kids[k].classList.contains('chapter')) kids[k].classList.add('now');   // заголовки над последним куском
}

function endMark() {
  const fi = feedIn();
  const old = fi.querySelector('.end');
  if (old) old.remove();
  if (pos >= chunks.length && chunks.length) {
    const e = document.createElement('div');
    e.className = 'end';
    e.textContent = 'Конец';
    fi.append(e);
  }
  $('nextBtn').disabled = pos >= chunks.length;
  $('nextTxt').textContent = pos >= chunks.length ? '«Это конец книги.»' : '«Дальше.»';
}

function fmtTime(min) {
  if (min < 1) return 'меньше минуты';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? h + ' ч ' + m + ' мин' : m + ' мин';
}

function stats() {
  const total = chunks.length || 1;
  let left = 0;
  for (let i = pos; i < chunks.length; i++) left += chunks[i].s.length;
  const pct = Math.floor(pos / total * 100);
  $('progBar').style.top = (12 + pos / total * 76) + '%';
  $('stat').textContent = pos >= chunks.length
    ? chunks.length + ' из ' + chunks.length + ' · дочитано'
    : pos + ' из ' + chunks.length + ' · ' + pct + '% · осталось ≈ ' + fmtTime(left / 1100);
}

// Сохраняем индекс первого ещё не показанного исходного абзаца.
function savePos() {
  if (book && chunks.length) Lib.setPos(book.id, pos >= chunks.length ? book.items.length : chunks[pos].src);
}

/* ---------- листание ---------- */
function next(silent) {
  if (!book || pos >= chunks.length) { stopAuto(); return; }
  // Заголовок показываем вместе с текстом сразу за ним.
  let n = 1;
  while (pos + n < chunks.length && chunks[pos + n - 1].t === 'h') n++;
  let paras = 0;
  const fi = feedIn();
  for (let k = 0; k < n; k++) {
    const e = el(chunks[pos]);
    if (!reduce) e.classList.add('enter');
    if (chunks[pos].t === 'p') paras++;
    fi.insertBefore(e, fi.querySelector('.end'));
    pos++;
  }
  const kids = fi.querySelectorAll('.chunk,.chapter');
  for (let k = 0; k < kids.length - WINDOW; k++) kids[k].remove();
  markNow(); endMark(); stats(); savePos();
  feed().scrollTo({ top: feed().scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  if (!silent) {
    if (hooks.onActivity) hooks.onActivity();
    if (hooks.onAdvance) hooks.onAdvance(paras);
  }
  if (auto) schedule();
}

function back() {
  if (pos <= 0) return;
  pos--;
  while (pos > 0 && chunks[pos - 1].t === 'h') pos--;
  savePos(); render();
  if (hooks.onActivity) hooks.onActivity();
  if (hooks.onBack) hooks.onBack();
}

/* ---------- авточтение ---------- */
function schedule() {
  clearTimeout(autoT);
  if (pos >= chunks.length) { stopAuto(); return; }
  const len = (chunks[pos - 1] || { s: '' }).s.length;
  autoT = setTimeout(() => next(), Math.max(2200, len * 55) / R().speed);
}
function stopAuto() { auto = false; clearTimeout(autoT); $('autoBtn').classList.remove('on'); }

/* ---------- открытие книги ---------- */
async function openBook(b) {
  stopAuto();
  book = b;
  R().current = b.id; save();
  chunks = chunkify(b.items, R().mode);
  const src = Lib.getPos(b.id);
  pos = chunks.findIndex(c => c.src >= src);
  if (pos < 0) pos = chunks.length;
  $('btitle').textContent = b.title || 'Без названия';
  render();
  if (pos === 0) next(true);
  requestWake();
}

async function requestWake() {
  try {
    if ('wakeLock' in navigator && !wake && !document.hidden) {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => { wake = null; });
    }
  } catch (e) { /* экран может гаснуть */ }
}

/* ---------- библиотека ---------- */
async function renderBooks() {
  const list = await Lib.listBooks();
  const wrap = $('books');
  wrap.textContent = '';
  for (const b of list) {
    const row = document.createElement('div');
    row.className = 'book' + (book && book.id === b.id ? ' cur' : '');
    const open = document.createElement('button');
    open.className = 'open';
    open.innerHTML = '<div class="n"></div><div class="p"></div>';
    open.querySelector('.n').textContent = b.title || 'Без названия';
    open.querySelector('.p').textContent = b.items.length + ' абзацев · прочитано ' + Lib.progressPct(b) + '%';
    open.onclick = () => { openBook(b); closeSheet('lib'); };
    row.append(open);
    if (b.id !== 'sample') {
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = 'Удалить';
      del.onclick = async () => {
        if (!del.classList.contains('arm')) {
          del.classList.add('arm'); del.textContent = 'Точно?';
          setTimeout(() => { del.classList.remove('arm'); del.textContent = 'Удалить'; }, 3000);
          return;
        }
        const wasCurrent = book && book.id === b.id;
        await Lib.removeBook(b.id);
        if (wasCurrent) await openBook(Lib.SAMPLE);
        renderBooks();
      };
      row.append(del);
    }
    wrap.append(row);
  }
}

async function addAndOpen(title, items) {
  if (!items.length) throw new Error('В файле не нашлось текста.');
  const b = await Lib.addBook(title, items);
  await openBook(b);
  closeSheet('lib');
}

async function onFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const msg = $('libMsg');
  msg.textContent = 'Открываю «' + f.name + '»…';
  try {
    const r = await parseFile(f, (i, n) => { msg.textContent = 'Читаю PDF: страница ' + i + ' из ' + n + '…'; });
    await addAndOpen(r.title || f.name.replace(/\.[^.]+$/, ''), r.items);
    msg.textContent = '';
  } catch (err) {
    msg.textContent = 'Не получилось открыть файл: ' + (err.message || err);
  }
  e.target.value = '';
}

/* ---------- поиск, закладки, переходы ---------- */
// Номер абзаца, который показан последним (то, что читаешь сейчас).
const currentSrc = () => (pos > 0 && chunks[pos - 1] ? chunks[pos - 1].src : -1);

function markHere() {
  const src = currentSrc();
  if (!book || src < 0) return 'Сначала прочитай хотя бы абзац.';
  const text = norm(book.items[src].s).slice(0, 100);
  return Lib.addMark(book.id, src, text) ? 'Закладка поставлена.' : 'Здесь закладка уже есть.';
}

// Перейти к месту: rawPos — индекс первого ещё не показанного абзаца. Прежнее место запоминаем, чтобы можно было вернуться.
async function jump(rawPos, remember = true) {
  if (!book) return;
  if (remember) Lib.setBack(book.id, Lib.getPos(book.id));
  Lib.setPos(book.id, Math.max(0, Math.min(rawPos, book.items.length)));
  closeSheet('find'); closeSheet('set');
  await openBook(book);
  if (hooks.onActivity) hooks.onActivity();
}

function renderFind(message) {
  $('findMsg').textContent = message || '';
  const q = $('findQ').value;
  const box = $('finds');
  box.textContent = '';
  if (q.trim().length >= 2 && book) {
    const res = findInItems(book.items, q);
    if (!res.length) box.textContent = 'Ничего не нашлось.';
    res.forEach(r => {
      const b = document.createElement('button');
      b.className = 'found';
      b.type = 'button';
      const mk = document.createElement('mark');
      mk.textContent = r.match;
      b.append(document.createTextNode(r.before), mk, document.createTextNode(r.after));
      b.onclick = () => jump(r.src + 1);
      box.append(b);
    });
    if (res.more) { const n = document.createElement('div'); n.className = 'note'; n.textContent = 'Показаны первые ' + res.length + '. Уточни запрос.'; box.append(n); }
  }

  const marks = $('marks');
  marks.textContent = '';
  const list = book ? Lib.getMarks(book.id) : [];
  if (!list.length) marks.innerHTML = '<div class="note">Закладок пока нет. Пункт «Поставить закладку здесь» в меню «Аа».</div>';
  list.forEach(m => {
    const row = document.createElement('div');
    row.className = 'mark-row';
    const go = document.createElement('button');
    go.type = 'button'; go.className = 'found';
    go.textContent = '★ ' + m.text;
    go.onclick = () => jump(m.src + 1);
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'del'; del.textContent = '×';
    del.setAttribute('aria-label', 'Удалить закладку');
    del.onclick = () => { Lib.removeMark(book.id, m.ts); renderFind(); };
    row.append(go, del);
    marks.append(row);
  });

  $('backRow').hidden = !(book && Lib.getBack(book.id) !== null);
}

/* ---------- листы: книги и настройки ---------- */
function openSheet(id) {
  stopAuto();
  $(id).hidden = false;
  if (id === 'lib') renderBooks();
  if (id === 'find') renderFind();
}
function closeSheet(id) { $(id).hidden = true; }

function applyPrefs() {
  document.documentElement.style.setProperty('--fs', R().fs + 'px');
  $('fsVal').textContent = R().fs + ' px';
  document.querySelectorAll('#modeRow .pill').forEach(p => p.classList.toggle('on', p.dataset.mode === R().mode));
  document.querySelectorAll('#speedRow .pill').forEach(p => p.classList.toggle('on', +p.dataset.speed === R().speed));
}

/* ---------- один раз при первом открытии: подписки на кнопки ---------- */
function wire() {
  $('nextBtn').onclick = () => { if (auto) schedule(); next(); };
  $('backBtn').onclick = () => { stopAuto(); back(); };
  $('autoBtn').onclick = () => {
    auto = !auto;
    $('autoBtn').classList.toggle('on', auto);
    if (auto) { if (pos === 0) next(); else schedule(); } else stopAuto();
    if (hooks.onActivity) hooks.onActivity();
  };
  feed().addEventListener('click', () => { if (getSelection().toString()) return; next(); });
  document.addEventListener('keydown', e => {
    if ($('readerView').hidden || !$('lib').hidden || !$('set').hidden || !$('find').hidden || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if ([' ', 'ArrowRight', 'Enter', 'ArrowDown'].includes(e.key)) { e.preventDefault(); next(); }
    if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); back(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') requestWake(); });

  $('libBtn').onclick = () => openSheet('lib');
  $('libClose').onclick = () => closeSheet('lib');
  $('setBtn').onclick = () => openSheet('set');
  $('setClose').onclick = () => closeSheet('set');
  $('rClose').onclick = closeReader;

  // меню «Аа»: поиск, закладки
  $('menuFind').onclick = () => { closeSheet('set'); openSheet('find'); };
  $('menuMark').onclick = () => { const msg = markHere(); closeSheet('set'); openSheet('find'); renderFind(msg); };
  $('findClose').onclick = () => closeSheet('find');
  let findT;
  $('findQ').oninput = () => { clearTimeout(findT); findT = setTimeout(() => renderFind(), 250); };
  $('retBtn').onclick = () => {
    const raw = Lib.getBack(book.id);
    if (raw === null) return;
    Lib.clearBack(book.id);
    jump(raw, false);
  };

  $('file').onchange = onFile;
  $('pasteAdd').onclick = async () => {
    const t = $('pasteText').value;
    const items = parseTxt(t);
    if (!items.length) { $('libMsg').textContent = 'Сначала вставь текст в поле.'; return; }
    await addAndOpen(norm($('pasteTitle').value) || norm(t).slice(0, 40), items);
    $('pasteText').value = ''; $('pasteTitle').value = '';
  };

  $('fsDown').onclick = () => { R().fs = Math.max(14, R().fs - 1); save(); applyPrefs(); };
  $('fsUp').onclick = () => { R().fs = Math.min(30, R().fs + 1); save(); applyPrefs(); };
  document.querySelectorAll('#modeRow .pill').forEach(p => {
    p.onclick = () => { R().mode = p.dataset.mode; save(); applyPrefs(); if (book) openBook(book); };
  });
  document.querySelectorAll('#speedRow .pill').forEach(p => {
    p.onclick = () => { R().speed = +p.dataset.speed; save(); applyPrefs(); };
  });

  let paintT;
  window.addEventListener('resize', () => { clearTimeout(paintT); paintT = setTimeout(() => paint($('paint')), 200); });
}

/* ---------- публичный интерфейс ---------- */
/**
 * Открыть читалку на текущей книге, на месте, где остановились.
 * opts: { onAdvance(paras), onBack(), onActivity(), onClose() } — все необязательные.
 */
export async function openReader(opts = {}) {
  hooks = opts;
  if (!started) { started = true; wire(); }
  $('readerView').hidden = false;
  paint($('paint'));
  applyPrefs();
  await openBook(await Lib.getBook(R().current));
}

export function closeReader() {
  stopAuto();
  $('lib').hidden = true; $('set').hidden = true; $('find').hidden = true;
  $('readerView').hidden = true;
  if (wake) { try { wake.release(); } catch (e) { /* уже отпущен */ } wake = null; }
  const h = hooks; hooks = {};
  if (h.onClose) h.onClose();
}

// Название и процент текущей книги — для главного экрана.
export async function currentBookInfo() {
  const b = await Lib.getBook(R().current);
  return { title: b.title || 'Без названия', pct: Lib.progressPct(b) };
}

// Подсказка читалке, что идёт пауза/простой, и место для таймера в шапке.
export const hud = () => $('rHud');
