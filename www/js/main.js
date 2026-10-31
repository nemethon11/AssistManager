// Запуск приложения и главный экран.
import { S, load, save, today } from './store.js';
import * as H from './habits.js';
import { LEVELS, levelOf, createFlame } from './flame.js';
import { secsToday } from './timer.js';
import { initTimerView, openTimer, showCard, skillHtml } from './timerview.js';
import { paint } from './paint.js';
import { rankInfo, RANKS } from './xp.js';
import { initSettings } from './settings.js';
import * as Snd from './sound.js';
import * as Rem from './reminders.js';
import { syncWidget } from './widget.js';
import { initBack } from './back.js';
import { initHistory } from './history.js';
import { currentBookInfo } from './reader.js';
import { startReading } from './readsession.js';
import { readStats, fmtDur } from './stats.js';

const $ = id => document.getElementById(id);
const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="#0f1213" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
const FLAME_ICON = '<svg viewBox="0 0 24 24"><path fill="#d0573e" d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/></svg>';
const SNOW_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#7cc4ff" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9"/></svg>';
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

let flame = null;
let preview = null;     // уровень, который смотрим в предпросмотре (null — настоящий)
let previewT;
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
  if (h.minutes) parts.push(Math.floor(secsToday(h.id) / 60) + ' / ' + h.minutes + ' мин');
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
  S.habits.forEach((h, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'habit' + (H.isDone(h.id) ? ' done' : '');
    b.setAttribute('aria-pressed', H.isDone(h.id));
    b.innerHTML = '<span class="ic">' + CHECK + '</span><span class="txt"><div class="name"></div><div class="sub"></div></span>';
    // Привычки — как нумерованные «варианты реплик» в диалоге.
    const nameEl = b.querySelector('.name');
    nameEl.innerHTML = '<span class="hn"></span><span class="nm"></span>';
    nameEl.querySelector('.hn').textContent = (i + 1) + '.';
    nameEl.querySelector('.nm').textContent = h.name;
    b.querySelector('.sub').textContent = subtitle(h);
    if (editing) {
      const go = document.createElement('span');
      go.className = 'go';
      go.textContent = '›';
      go.setAttribute('aria-label', 'Править');
      b.append(go);
    }
    b.onclick = () => (editing ? openSheet(h.id) : tapHabit(h));
    if (!editing) { box.append(b); return; }

    // В режиме правки рядом со строкой — кнопки «вверх / вниз» для смены порядка.
    const row = document.createElement('div');
    row.className = 'hrow';
    const mv = document.createElement('div');
    mv.className = 'mv';
    [['▲', -1, 'Выше'], ['▼', 1, 'Ниже']].forEach(([sym, d, label]) => {
      const m = document.createElement('button');
      m.type = 'button';
      m.textContent = sym;
      m.setAttribute('aria-label', label + ': ' + h.name);
      m.disabled = (d < 0 && i === 0) || (d > 0 && i === S.habits.length - 1);
      m.onclick = () => { if (H.moveHabit(h.id, d)) renderHabits(); };
      mv.append(m);
    });
    row.append(b, mv);
    box.append(row);
  });
}

function renderTop() {
  const s = H.streak();
  $('count').textContent = s;
  $('unit').textContent = H.plural(s) + ' подряд';
  $('best').textContent = Math.max(S.best, s);
  $('frz').textContent = S.freezes;
  const li = levelOf(s);
  const L = LEVELS[li];
  $('lvl').textContent = L.name;
  $('lvl').style.color = L.c[1];
  $('count').style.color = s ? L.c[2] : 'var(--muted)';
  const nl = LEVELS[li + 1];
  let next = nl ? 'до «' + nl.name + '» — ' + (nl.min - s) + ' ' + H.plural(nl.min - s) : 'максимальный уровень';
  if (S.habits.length && !S.complete[today()]) {
    next = (s ? 'Не дай огню погаснуть: ' : 'Зажги огонь: ') + 'осталось ' + H.leftCount() + ' из ' + S.habits.length;
  }
  $('next').textContent = next;
  $('skillLine').innerHTML = skillHtml(pickSkill(s));
  if (flame) flame.setLevel(preview != null ? preview : li);
}

// Внутренний голос: реплика «навыка» под состояние дня. Вариант зависит от даты, чтобы не мигал при каждой перерисовке.
const SKILLS = {
  empty: [['ВОЛЯ', 'Список пуст. Пустота — тоже выбор, но скучный.']],
  none0: [['ЭЛЕКТРОХИМИЯ', 'Одна маленькая привычка. Всего одна. Давай.'], ['ВОЛЯ', 'Огонь сам себя не зажжёт. Увы.']],
  noneStreak: [['ВОЛЯ', 'Огонь гаснет. Ты это допустишь?'], ['ЛОГИКА', 'Серия есть. Серии нужно кормление. Привычками.']],
  some: [['ВЫНОСЛИВОСТЬ', 'Ты уже начал. Бросать на полпути — для слабаков и поэтов.'], ['ВОЛЯ', 'Ещё чуть-чуть. Ты можешь.']],
  all: [['ЭСПРИ-ДЕ-КОР', 'Сегодня ты молодец. Завтра — снова.'], ['ВНУТРЕННЯЯ ИМПЕРИЯ', 'Огонь доволен. Он тоже умеет быть благодарным.']],
};
function pickSkill(streak) {
  const left = H.leftCount(), total = S.habits.length;
  const kind = !total ? 'empty' : !left ? 'all' : left === total ? (streak ? 'noneStreak' : 'none0') : 'some';
  const list = SKILLS[kind];
  const day = Math.floor(Date.now() / 86400000);
  return list[(day + left) % list.length];
}

function renderLevels() {
  const li = levelOf(H.streak());
  const box = $('levels');
  box.textContent = '';
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (i === li ? ' cur' : '') + (i > li ? ' locked' : '');
    b.innerHTML = '<i style="background:radial-gradient(circle at 50% 70%,' + L.c[2] + ',' + L.c[1] + ' 45%,' + L.c[0] + ')"></i>' + L.name + ' <em>' + L.min + '+</em>';
    b.onclick = () => {
      preview = i;
      flame.setLevel(i);
      toast(i > li ? 'Предпросмотр: «' + L.name + '»' : '«' + L.name + '»');
      clearTimeout(previewT);
      previewT = setTimeout(() => { preview = null; renderTop(); }, 3500);
    };
    box.append(b);
  });
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

function renderRank() {
  const r = rankInfo();
  $('xpTotal').textContent = r.xp + ' XP';
  $('rankName').textContent = r.rank.name;
  $('rankLine').textContent = r.rank.line;
  $('xpFill').style.width = r.pct + '%';
  $('rankNext').textContent = r.next ? 'до «' + r.next.name + '» — ' + r.toNext + ' XP' : 'высший ранг — выше только забвение';
  const box = $('ranks');
  box.textContent = '';
  RANKS.forEach((k, i) => {
    const row = document.createElement('div');
    row.className = 'rk' + (i < r.i ? ' got' : i === r.i ? ' cur' : '');
    row.innerHTML = '<span></span><em></em>';
    row.firstChild.textContent = k.name;
    row.lastChild.textContent = k.min + ' XP';
    box.append(row);
  });
}

// Новый уровень огня или ранг: объявляем карточкой и звуком. Уровень «запоминаем» в обе стороны, ранг — только вверх.
function checkMilestones() {
  const li = levelOf(H.streak());
  if (li > S.levelSeen) {
    showCard({ kicker: 'Новый уровень огня', name: LEVELS[li].name, skill: ['ЭСПРИ-ДЕ-КОР', 'Огонь разгорелся. Вокруг даже стало теплее.'] });
    setTimeout(Snd.levelUp, 700);
  }
  S.levelSeen = li;
  const r = rankInfo();
  if (r.i > S.rankSeen) {
    showCard({ kicker: 'Новый ранг', name: r.rank.name, skill: ['ВНУТРЕННЯЯ ИМПЕРИЯ', r.rank.line] });
    setTimeout(Snd.rankUp, 700);
    S.rankSeen = r.i;
  }
  save();
}

function render() {
  renderTop();
  renderHabits();
  renderWeek();
  renderLevels();
  renderRank();
  checkMilestones();
  scheduleSoon();
}

// Напоминания пересчитываем после любых изменений, но не на каждый чих.
let remT;
function scheduleSoon() {
  clearTimeout(remT);
  remT = setTimeout(() => { Rem.reschedule(); syncWidget(); }, 1500);
}

async function renderBook() {
  const info = await currentBookInfo();
  $('bookTitle').textContent = info.title;
  $('bookPct').textContent = 'прочитано ' + info.pct + '%';
  renderStats();
}

function renderStats() {
  const s = readStats();
  $('stToday').textContent = fmtDur(s.todaySec);
  $('stWeek').textContent = fmtDur(s.weekSec);
  $('stTotal').textContent = fmtDur(s.totalSec);
  $('stParas').textContent = s.parasToday;
  $('stParasL').textContent = 'абзацев сегодня (всего ' + s.parasTotal + ')';
}

// Чтение закрыли или привычка выполнилась: обновить всё и показать праздничные сообщения.
function onReadChange(ev) { render(); renderBook(); showEvents(ev || {}); }

/* ---------- действия ---------- */
function showEvents(ev) {
  if (ev.dayDone) {
    flame.burst();
    Snd.flash();
    const c = $('count');
    c.classList.add('bump');
    setTimeout(() => c.classList.remove('bump'), 420);
    toast('День засчитан');
  }
  if (ev.freeze) setTimeout(() => toast('+1 заморозка за неделю огня'), 1600);
}

function tapHabit(h) {
  // «Чтение» открывает читалку с таймером; другая привычка с таймером — экран таймера.
  if (h.kind === 'reading') { startReading(h, { onChange: onReadChange }); return; }
  if (h.minutes > 0) { openTimer(h); return; }
  const ev = H.toggle(h.id);
  ev.on ? Snd.check() : Snd.uncheck();
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
paint($('bg'));
let bgT;
window.addEventListener('resize', () => { clearTimeout(bgT); bgT = setTimeout(() => paint($('bg')), 200); });
flame = createFlame($('flame'), levelOf(H.streak()));
$('flame').addEventListener('click', () => { flame.poke(); Snd.crackle(6); });
// Звук в браузере разрешён только после первого касания.
document.addEventListener('pointerdown', Snd.unlock, { passive: true });
// Тихий треск огня — пока виден главный экран; чем выше уровень, тем чаще.
Snd.startAmbient(
  () => !document.hidden && !document.body.classList.contains('covered') && $('sheet').hidden && $('settingsView').hidden,
  () => levelOf(H.streak()),
);
initSettings();
initHistory();
initBack(closeSheet, () => editing, () => $('editBtn').click());
$('readBtn').onclick = () => startReading(null, { onChange: onReadChange });
renderBook();
initTimerView({
  toast,
  onChange: ev => { render(); showEvents(ev || {}); },
});
if (H.applyFreezes()) setTimeout(() => toast('Заморозка спасла серию'), 600);
H.recompute();
render();
// Если приложение открыто в полночь, новый день должен начаться сам, без перезапуска.
let dayShown = today();
setInterval(() => {
  if (today() === dayShown) return;
  dayShown = today();
  if (H.applyFreezes()) toast('Заморозка спасла серию');
  H.recompute();
  render();
  renderBook();
}, 30000);

// Вернулись в приложение (возможно, на следующий день) — пересчитать.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Rem.reschedule(); syncWidget(); return; }   // уходим в фон — свежие напоминания и виджет
  {
    if (H.applyFreezes()) toast('Заморозка спасла серию');
    H.recompute();
    render();
  }
});
