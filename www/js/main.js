// Запуск приложения и главный экран.
import { S, load, today } from './store.js';
import * as H from './habits.js';

const $ = id => document.getElementById(id);
const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="#0f1213" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
const FLAME_ICON = '<svg viewBox="0 0 24 24"><path fill="#d0573e" d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/></svg>';
const SNOW_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#7cc4ff" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9"/></svg>';
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

let editing = false;
let editId = null;      // id правимой привычки; null — создаём новую

/* ---------- сообщения ---------- */
let toastT;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2800);
}

/* ---------- отрисовка ---------- */
function subtitle(h) {
  const parts = [];
  if (h.kind === 'reading') parts.push('читалка');
  if (h.minutes) parts.push(h.minutes + ' мин');
  const hs = H.habitStreak(h.id);
  parts.push(hs ? 'серия ' + hs + ' ' + H.plural(hs) : 'ещё не начата');
  return parts.join(' · ');
}

function renderHabits() {
  const box = $('habits');
  box.textContent = '';
  if (!S.habits.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Список пуст. Добавь первую привычку — огонёк ждёт.';
    box.append(p);
  }
  S.habits.forEach(h => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'habit' + (H.isDone(h.id) ? ' done' : '');
    b.setAttribute('aria-pressed', H.isDone(h.id));
    b.innerHTML = '<span class="ic">' + CHECK + '</span><span class="txt"><div class="name"></div><div class="sub"></div></span>';
    b.querySelector('.name').textContent = h.name;
    b.querySelector('.sub').textContent = subtitle(h);
    if (editing) {
      const go = document.createElement('span');
      go.className = 'go';
      go.textContent = 'Править';
      b.append(go);
    }
    b.onclick = () => (editing ? openSheet(h.id) : tapHabit(h));
    box.append(b);
  });
}

function renderTop() {
  const s = H.streak();
  $('count').textContent = s;
  $('unit').textContent = H.plural(s) + ' подряд';
  $('best').textContent = Math.max(S.best, s);
  $('frz').textContent = S.freezes;
  $('lvl').textContent = '';
  let next = '';
  if (S.habits.length && !S.complete[today()]) {
    next = (s ? 'Не дай огню погаснуть: ' : 'Зажги огонь: ') + 'осталось ' + H.leftCount() + ' из ' + S.habits.length;
  }
  $('next').textContent = next;
}

function renderWeek() {
  const w = H.weekDays();
  const box = $('week');
  box.textContent = '';
  w.days.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'day' + (d.ok ? ' ok' : d.frozen ? ' fz' : '') + (d.today ? ' today' : '');
    el.innerHTML = '<div class="dot">' + (d.ok ? FLAME_ICON : d.frozen ? SNOW_ICON : '') + '</div><span>' + DAY_NAMES[i] + '</span>';
    box.append(el);
  });
  $('weekNote').textContent = w.done + ' из ' + w.of;
}

function render() {
  renderTop();
  renderHabits();
  renderWeek();
}

/* ---------- действия ---------- */
function showEvents(ev) {
  if (ev.dayDone) toast('День засчитан');
  if (ev.freeze) setTimeout(() => toast('+1 заморозка за неделю огня'), 1600);
}

function tapHabit(h) {
  // Пока таймер и читалка не подключены, привычка с таймером отмечается как обычная.
  const ev = H.toggle(h.id);
  try { navigator.vibrate && navigator.vibrate(ev.on ? 12 : 6); } catch (e) { /* без вибрации */ }
  render();
  showEvents(ev);
}

/* ---------- окно правки ---------- */
function openSheet(id) {
  editId = id || null;
  const h = id ? S.habits.find(x => x.id === id) : null;
  $('sheetTitle').textContent = h ? 'Правка привычки' : 'Новая привычка';
  $('fName').value = h ? h.name : '';
  $('fTimer').checked = h ? h.minutes > 0 : false;
  $('fMin').value = h && h.minutes ? h.minutes : 10;
  $('fReading').checked = h ? h.kind === 'reading' : false;
  syncTimerRow();
  $('fDelete').hidden = !h;
  $('sheet').hidden = false;
  $('fName').focus();
}
function closeSheet() { $('sheet').hidden = true; }
function syncTimerRow() {
  // Привычка «Чтение» всегда с таймером.
  if ($('fReading').checked) $('fTimer').checked = true;
  $('fTimer').disabled = $('fReading').checked;
  $('minutesRow').hidden = !$('fTimer').checked;
}

$('fTimer').onchange = syncTimerRow;
$('fReading').onchange = syncTimerRow;
$('fCancel').onclick = closeSheet;
$('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); });
$('habitForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('fName').value.trim();
  if (!name) return;
  const reading = $('fReading').checked;
  const minutes = $('fTimer').checked ? Math.max(1, Math.min(600, parseInt($('fMin').value, 10) || 10)) : 0;
  if (editId) H.updateHabit(editId, { name, minutes, reading });
  else H.addHabit({ name, minutes, reading });
  closeSheet();
  H.recompute();
  render();
});
let delArm = false;
$('fDelete').onclick = () => {
  if (!delArm) {
    delArm = true;
    $('fDelete').textContent = 'Точно удалить?';
    setTimeout(() => { delArm = false; $('fDelete').textContent = 'Удалить привычку'; }, 3000);
    return;
  }
  delArm = false;
  $('fDelete').textContent = 'Удалить привычку';
  H.removeHabit(editId);
  closeSheet();
  render();
};

$('editBtn').onclick = () => {
  editing = !editing;
  $('editor').hidden = !editing;
  $('editBtn').textContent = editing ? 'Готово' : 'Изменить';
  renderHabits();
};
$('addBtn').onclick = () => openSheet(null);

/* ---------- старт ---------- */
load();
if (H.applyFreezes()) setTimeout(() => toast('Заморозка спасла серию'), 600);
H.recompute();
render();
// Вернулись в приложение (возможно, на следующий день) — пересчитать.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    if (H.applyFreezes()) toast('Заморозка спасла серию');
    H.recompute();
    render();
  }
});
