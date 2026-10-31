// Поиск по тексту книги. «ё» и «е» считаются одной буквой, регистр не важен.
export const fold = s => String(s || '').toLowerCase().replace(/ё/g, 'е');

/**
 * Найти запрос в абзацах книги.
 * @param {{t:string,s:string}[]} items абзацы книги
 * @param {string} query запрос (от 2 символов)
 * @param {number} limit сколько результатов вернуть максимум
 * @returns {{src:number, before:string, match:string, after:string, more:boolean}[]}
 *   src — номер абзаца, before/match/after — кусок текста вокруг совпадения (match — само совпадение).
 */
export function findInItems(items, query, limit = 40) {
  const q = fold(String(query || '').trim().replace(/\s+/g, ' '));
  if (q.length < 2) return [];
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const s = items[i].s;
    const at = fold(s).indexOf(q);          // fold не меняет длину строки, поэтому индексы совпадают с исходным текстом
    if (at < 0) continue;
    const from = Math.max(0, at - 30);
    const to = Math.min(s.length, at + q.length + 60);
    out.push({
      src: i,
      before: (from > 0 ? '…' : '') + s.slice(from, at),
      match: s.slice(at, at + q.length),
      after: s.slice(at + q.length, to) + (to < s.length ? '…' : ''),
    });
    if (out.length > limit) { out.pop(); out.more = true; break; }
  }
  return out;
}
