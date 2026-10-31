// Снимки всех экранов приложения в размере телефона (390x844). Запуск: npm run shots
// Нужен установленный Edge или Chrome (или путь в переменной BROWSER). Снимки попадают в папку screenshots/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const www = path.resolve(process.argv[2] || 'www');
const outDir = path.resolve(process.argv[3] || 'screenshots');
fs.mkdirSync(outDir, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(www, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
}).listen(0);
const port = server.address().port;

// Состояние «пользователь с историей»: 15 дней подряд, сегодня сделана 1 из 3, есть чтение и немного XP
const pad = n => String(n).padStart(2, '0');
const key = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return key(d); };
const ids = ['a1', 'b2', 'c3'];
const state = {
  v: 1,
  habits: [
    { id: 'a1', name: 'Английский — 5 минут', kind: 'check', minutes: 5 },
    { id: 'b2', name: '10 приседаний и ещё одна довольно длинная приписка для проверки переноса', kind: 'check', minutes: 0 },
    { id: 'c3', name: 'Чтение', kind: 'reading', minutes: 10 },
  ],
  log: {}, complete: {}, frozen: {}, secs: {}, freezes: 1, best: 15, awarded: '',
  reader: { current: 'sample', pos: {}, mode: 'short', fs: 19, speed: 1, marks: {}, back: {} },
  read: { secs: {}, paras: {} },
  settings: { sound: false, ambient: false, remind: { on: false, time: '18:00', evening: true, eveningTime: '21:30' } },
  rankSeen: 9, levelSeen: 9,
};
for (let i = 1; i <= 15; i++) {
  const k = ago(i);
  if (i === 6) { state.frozen[k] = 1; continue; }
  state.complete[k] = 1; state.log[k] = { a1: 1, b2: 1, c3: 1 };
  state.read.secs[k] = (i % 4 + 1) * 420; state.read.paras[k] = 20 + i;
}
state.log[ago(20)] = { a1: 1 };
state.log[key(new Date())] = { a1: 1 };
state.read.secs[key(new Date())] = 300; state.read.paras[key(new Date())] = 9;
state.secs[key(new Date())] = { a1: 180 };

const browser = await puppeteer.launch({ executablePath: process.argv[4] || process.env.BROWSER || [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => fs.existsSync(p)), headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
await page.evaluateOnNewDocument(s => { if (!localStorage.getItem('assistmanager.v1')) localStorage.setItem('assistmanager.v1', JSON.stringify(s)); }, state);
await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1200));

const shot = async name => { await new Promise(r => setTimeout(r, 450)); await page.screenshot({ path: path.join(outDir, name + '.png') }); console.log('снимок', name); };
const click = async sel => { await page.click(sel); };

await shot('01-home');
await page.screenshot({ path: path.join(outDir, '02-home-full.png'), fullPage: true });
await click('#editBtn'); await shot('03-edit-mode');
await click('.hrow .habit'); await shot('04-habit-sheet');
await click('#fCancel'); await click('#editBtn');
await click('#habits .habit:nth-child(1)'); await shot('05-timer');
await page.evaluate(() => document.getElementById('tvToggle').click()); await shot('05b-timer-running');
await click('#tvBack');
await click('#habits .habit:nth-child(3)'); await new Promise(r => setTimeout(r, 600));
for (let i = 0; i < 3; i++) await page.evaluate(() => document.getElementById('nextBtn').click());
await shot('06-reader');
await click('#setBtn'); await shot('07-reader-menu');
await click('#menuMark'); await shot('08-find-sheet');
await page.type('#findQ', 'больн'); await new Promise(r => setTimeout(r, 500)); await shot('08b-find-results');
await click('#findClose'); await click('#libBtn'); await shot('09-library');
await click('#libClose'); await click('#rClose');
await click('#histBtn'); await shot('10-history');
await click('#hiBack'); await click('#gearBtn'); await shot('11-settings');
await page.evaluate(() => document.getElementById('settingsView').scrollTo(0, 99999)); 
await page.evaluate(() => document.querySelector('#settingsView .set-body').scrollTo(0, 99999)); await shot('11b-settings-bottom');
await click('#setBack');
await page.evaluate(async () => { const m = await import('/js/timerview.js'); m.showCard({ kicker: 'Новый ранг', name: 'Человек эпохи, которого эпоха не заметила', skill: ['ВНУТРЕННЯЯ ИМПЕРИЯ', 'Зато вы заметили всё. И записали. И прочитали.'] }); });
await shot('12-card');
console.log('ОШИБКИ:', JSON.stringify(errors));
await browser.close(); server.close();
