// Напоминания как в Duolingo: уведомление в выбранное время, если привычки не сделаны, и вечернее предупреждение,
// что серия сгорит. Работают при закрытом приложении: уведомления ставятся заранее в системный планировщик Android.
//
// Как это устроено: при каждом изменении (запуск, отметка, смена настроек, уход в фон) мы стираем старые
// напоминания и ставим новые на ближайшие 7 дней. Выполнил всё сегодня — сегодняшние напоминания не придут.
import { S, today, shift, parseKey } from './store.js';
import * as H from './habits.js';

const DAYS_AHEAD = 7;
const ID_DAY = 100;        // 100..106 — дневные напоминания
const ID_EVE = 200;        // 200..201 — вечерние предупреждения
const CHANNEL = 'habits';

// Реплики «навыков»: [навык, текст]. Для будущих дней — без цифр, потому что их мы заранее не знаем.
export const DAY_QUIPS = [
  ['ВОЛЯ', 'Огонь гаснет. Ты это допустишь?'],
  ['ЭЛЕКТРОХИМИЯ', 'Одна маленькая привычка. Всего одна. Никто не узнает… кроме огня.'],
  ['ЛОГИКА', 'Привычки сами себя не сделают. Проверено наукой и бездельем.'],
  ['ВЫНОСЛИВОСТЬ', 'Ещё не вечер. Но уже почти.'],
  ['ДРАМА', 'Огонёк смотрит на тебя. Молча. С укором.'],
  ['ВНУТРЕННЯЯ ИМПЕРИЯ', 'Слышишь? Это тишина невыполненных дел.'],
  ['ЭСПРИ-ДЕ-КОР', 'Остальные огоньки, между прочим, уже горят.'],
];
export const EVENING_QUIPS = [
  ['ВОЛЯ', 'До полуночи — рукой подать. Не подведи огонь.'],
  ['ИНЕРЦИЯ', 'Диван сильнее? Докажи обратное. Хотя бы одной привычкой.'],
  ['ЛОГИКА', 'Цифры не лгут: час сейчас — позднее, чем кажется.'],
];

const parseHM = s => { const [h, m] = String(s || '').split(':').map(Number); return (h >= 0 && h < 24 && m >= 0 && m < 60) ? [h, m] : null; };
const atTime = (key, hm) => { const d = parseKey(key); d.setHours(hm[0], hm[1], 0, 0); return d; };
const plural = H.plural;

/**
 * Что показать и когда. Чистая функция: всё берёт из переданного состояния, ничего не планирует сама.
 * @returns {{id:number, at:Date, title:string, body:string}[]}
 */
export function plan(now = new Date(), st = S) {
  const r = st.settings && st.settings.remind;
  if (!r || !r.on || !st.habits.length) return [];
  const out = [];
  const t0 = today();
  const todayDone = !!st.complete[t0];
  const streakNow = H.streak();
  const left = H.leftCount();
  const total = st.habits.length;
  const dayIdx = Math.floor(now.getTime() / 86400000);
  const dayHM = parseHM(r.time);
  const eveHM = parseHM(r.eveningTime);

  for (let d = 0; d < DAYS_AHEAD; d++) {
    const key = shift(t0, d);
    // Дневное напоминание. Сегодня — только если день ещё не закрыт.
    if (dayHM && !(d === 0 && todayDone)) {
      const at = atTime(key, dayHM);
      if (at > now) {
        const [title, text] = DAY_QUIPS[(dayIdx + d) % DAY_QUIPS.length];
        const body = d === 0 && left < total ? text + ' Осталось: ' + left + ' из ' + total + '.' : text;
        out.push({ id: ID_DAY + d, at, title, body });
      }
    }
    // Вечернее «серия сгорит»: сегодня (если есть что терять и день не закрыт)
    // и завтра (если сегодня закрыт — тогда серия доживёт до завтрашнего вечера).
    if (r.evening && eveHM && (d === 0 || d === 1)) {
      const atStake = d === 0 ? (!todayDone && streakNow > 0) : (todayDone && streakNow > 0);
      const at = atTime(key, eveHM);
      if (atStake && at > now) {
        const [title, text] = EVENING_QUIPS[(dayIdx + d) % EVENING_QUIPS.length];
        const head = 'Серия в ' + streakNow + ' ' + plural(streakNow) + ' сгорит в полночь.';
        out.push({ id: ID_EVE + d, at, title, body: head + (d === 0 && left ? ' Осталось: ' + left + ' из ' + total + '. ' : ' ') + text });
      }
    }
  }
  return out;
}

/* ---------- связь с Android ---------- */
function plugin() {
  const cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
  return cap.registerPlugin('LocalNotifications');
}

export const supported = () => !!plugin();

// Попросить разрешение показывать уведомления (Android 13+ спрашивает). Возвращает true, если разрешено.
export async function ensurePermission() {
  const p = plugin();
  if (!p) return false;
  let r = await p.checkPermissions();
  if (r.display !== 'granted') r = await p.requestPermissions();
  return r.display === 'granted';
}

let channelReady = false;
async function ensureChannel(p) {
  if (channelReady) return;
  try {
    await p.createChannel({ id: CHANNEL, name: 'Напоминания о привычках', description: 'Реплики внутреннего голоса, пока огонь не погас', importance: 4, visibility: 1 });
  } catch (e) { /* канал уже есть или не нужен */ }
  channelReady = true;
}

// Стереть старые и поставить свежие напоминания.
let busy = null;
export function reschedule() {
  busy = (busy || Promise.resolve()).then(doReschedule).catch(() => {});
  return busy;
}
async function doReschedule() {
  const p = plugin();
  if (!p) return;
  const ids = [];
  for (let d = 0; d < DAYS_AHEAD; d++) ids.push({ id: ID_DAY + d });
  ids.push({ id: ID_EVE }, { id: ID_EVE + 1 });
  try { await p.cancel({ notifications: ids }); } catch (e) { /* нечего отменять */ }
  const items = plan();
  if (!items.length) return;
  if ((await p.checkPermissions()).display !== 'granted') return;
  await ensureChannel(p);
  await p.schedule({
    notifications: items.map(n => ({
      id: n.id, title: n.title, body: n.body, channelId: CHANNEL,
      schedule: { at: n.at, allowWhileIdle: true },
    })),
  });
}

// Пробное уведомление через несколько секунд — чтобы убедиться, что всё работает.
export async function sendTest() {
  const p = plugin();
  if (!p) throw new Error('Уведомления работают только в установленном приложении.');
  if (!(await ensurePermission())) throw new Error('Разреши уведомления для AssistManager в настройках Android.');
  await ensureChannel(p);
  const [title, text] = DAY_QUIPS[0];
  await p.schedule({ notifications: [{ id: 999, title, body: text, channelId: CHANNEL, schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
}
