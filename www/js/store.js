// Хранилище: всё состояние приложения лежит одним объектом в localStorage на устройстве.
// Книги (тяжёлые) будут жить отдельно, в IndexedDB — см. library.js.

const KEY = 'assistmanager.v1';

export const pad = n => String(n).padStart(2, '0');
export const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parseKey = k => { const [a, b, c] = k.split('-').map(Number); return new Date(a, b - 1, c); };
export const shift = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
export const today = () => keyOf(new Date());
export const uid = () => Math.random().toString(36).slice(2, 9);

// habit: { id, name, kind: 'check' | 'reading', minutes }   minutes > 0 — у привычки есть таймер
function fresh() {
  return {
    v: 1,
    habits: [
      { id: uid(), name: 'Английский — 5 минут', kind: 'check', minutes: 5 },
      { id: uid(), name: '10 приседаний', kind: 'check', minutes: 0 },
      { id: uid(), name: 'Чтение', kind: 'reading', minutes: 10 },
    ],
    log: {},        // log[дата][id] = 1 — привычка выполнена в этот день
    complete: {},   // complete[дата] = 1 — все привычки дня выполнены
    frozen: {},     // frozen[дата] = 1 — день спасён заморозкой
    secs: {},       // secs[дата][id] = секунды, накопленные таймером
    freezes: 0,
    best: 0,
    awarded: '',    // дата, когда выдана последняя заморозка
  };
}

export let S;

export function load() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* пустое хранилище */ }
  S = data && Array.isArray(data.habits) ? normalize(data) : fresh();
  return S;
}

// Добавляем поля, которых могло не быть в старых копиях (и в импортированных файлах).
export function normalize(d) {
  const f = fresh();
  for (const k of Object.keys(f)) if (d[k] === undefined) d[k] = f[k];
  d.habits.forEach(h => { h.kind = h.kind || 'check'; h.minutes = h.minutes || 0; });
  return d;
}

export function replaceAll(data) { S = normalize(data); save(); }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* память заполнена или недоступна */ }
}
