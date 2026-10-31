// Библиотека книг. Тексты книг тяжёлые, поэтому лежат в IndexedDB; место в книге — в общем состоянии (S.reader.pos).
import { S, save } from './store.js';

/* ---------- IndexedDB (если недоступна — книги живут в памяти до закрытия) ---------- */
const mem = new Map();
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('assistmanager-books', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('books', { keyPath: 'id' });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  }
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('books', mode);
    const r = fn(t.objectStore('books'));
    t.oncomplete = () => res(r && r.result);
    t.onerror = () => rej(t.error);
  });
}

export const Books = {
  async all() { try { return await tx('readonly', s => s.getAll()); } catch (e) { return [...mem.values()]; } },
  async put(b) { mem.set(b.id, b); try { await tx('readwrite', s => s.put(b)); } catch (e) { /* останется в памяти */ } },
  async del(id) { mem.delete(id); try { await tx('readwrite', s => s.delete(id)); } catch (e) { /* уже нет */ } },
};

// Книга-пример (общественное достояние: Достоевский, «Записки из подполья», 1864).
export const SAMPLE = {
  id: 'sample', title: 'Записки из подполья (пример)', added: 0,
  items: [
    { t: 'h', s: 'Часть первая. Подполье' },
    { t: 'h', s: 'I' },
    { t: 'p', s: 'Я человек больной… Я злой человек. Непривлекательный я человек. Я думаю, что у меня болит печень. Впрочем, я ни шиша не смыслю в моей болезни и не знаю наверно, что у меня болит.' },
    { t: 'p', s: 'Я не лечусь и никогда не лечился, хотя медицину и докторов уважаю. К тому же я еще и суеверен до крайности; ну, хоть настолько, чтоб уважать медицину. (Я достаточно образован, чтоб не быть суеверным, но я суеверен.) Нет-с, я не хочу лечиться со злости. Вот этого вы, наверно, не изволите понимать. Ну-с, а я понимаю.' },
    { t: 'p', s: 'Я, конечно, не сумею вам объяснить, кому именно я насолю в этом случае моей злостью; я отлично хорошо знаю, что и докторам я никак не смогу «нагадить» тем, что у них не лечусь; я лучше всех знаю, что всем этим я единственно только себе поврежу и никому другому.' },
    { t: 'p', s: 'Но все-таки, если я не лечусь, так это со злости. Печенка болит, так вот пускай же ее еще крепче болит!' },
    { t: 'p', s: 'Это пример, чтобы показать, как работает читалка. Нажми «Книги» вверху и загрузи свою: EPUB, FB2, PDF или TXT.' },
  ],
};

export async function listBooks() {
  const all = (await Books.all()).sort((a, b) => (b.added || 0) - (a.added || 0));
  return [...all, SAMPLE];
}

export async function getBook(id) {
  if (!id || id === 'sample') return SAMPLE;
  const all = await Books.all();
  return all.find(b => b.id === id) || SAMPLE;
}

export async function addBook(title, items) {
  const b = { id: 'b' + Date.now().toString(36), title: title || 'Без названия', items, added: Date.now() };
  await Books.put(b);
  return b;
}

export async function removeBook(id) {
  await Books.del(id);
  delete S.reader.pos[id];
  delete S.reader.marks[id];
  delete S.reader.back[id];
  if (S.reader.current === id) S.reader.current = 'sample';
  save();
}

// Место в книге — индекс первого ещё не показанного исходного абзаца.
export const getPos = id => S.reader.pos[id] || 0;
export function setPos(id, v) { S.reader.pos[id] = v; save(); }
/* ---------- закладки и «вернуться назад» ---------- */
export const getMarks = id => (S.reader.marks[id] || []).slice().sort((a, b) => a.src - b.src);

// Добавить закладку на абзац src. Возвращает false, если такая уже есть.
export function addMark(id, src, text) {
  const list = S.reader.marks[id] || (S.reader.marks[id] = []);
  if (list.some(m => m.src === src)) return false;
  list.push({ src, text, ts: Date.now() });
  save();
  return true;
}
export function removeMark(id, ts) {
  S.reader.marks[id] = (S.reader.marks[id] || []).filter(m => m.ts !== ts);
  save();
}
export const getBack = id => (id in S.reader.back ? S.reader.back[id] : null);
export function setBack(id, rawPos) { S.reader.back[id] = rawPos; save(); }
export function clearBack(id) { delete S.reader.back[id]; save(); }

export const progressPct = b => Math.min(100, Math.round(getPos(b.id) / (b.items.length || 1) * 100));
