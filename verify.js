// Headless smoke test: kører app.js mod en minimal DOM-shim og tjekker output.
const fs = require('fs');
const vm = require('vm');

const els = {};
function makeEl(id) {
  return {
    id,
    innerHTML: '',
    textContent: '',
    closest: () => null,
    querySelector: () => null,
  };
}
for (const id of ['heroStats', 'tabs', 'main', 'updated']) els[id] = makeEl(id);

const sandbox = {
  console,
  Date,
  Number,
  Math,
  Map,
  Set,
  Array,
  String,
  window: {},
  document: {
    getElementById: id => els[id] || makeEl(id),
    addEventListener: () => {},
  },
};
sandbox.window.scrollTo = () => {};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('data.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), sandbox);

const checks = [];
function check(name, cond, extra) {
  checks.push({ name, ok: !!cond, extra });
}

const main = els.main.innerHTML;
const hero = els.heroStats.innerHTML;
const tabs = els.tabs.innerHTML;

check('hero rendered', hero.length > 200);
check('tabs rendered: 5 faner', (tabs.match(/data-tab=/g) || []).length === 5,
  (tabs.match(/data-tab=/g) || []).length);
check('overblik rendered', main.includes('Pointoversigt'));
check('holdkort til stede', (main.match(/data-goto=/g) || []).length === 4,
  (main.match(/data-goto=/g) || []).length);
check('ingen undefined i output', !main.includes('undefined') && !hero.includes('undefined'));
check('ingen NaN i output', !main.includes('NaN') && !hero.includes('NaN'));
check('updated sat', els.updated.textContent.length > 4, els.updated.textContent);

// Verificer pointmatematik mod rådata
const data = sandbox.window.HAREKAER_DATA;
let totalPoints = 0, totalMax = 0, games = 0;
const perPlayer = new Map();
for (const t of data) {
  for (const m of t.matches) {
    for (const g of m.games) {
      games++;
      const max = 2;
      const expected = g.result === 'won' ? 2 : g.result === 'lost' ? 0 : 1;
      if (g.points !== expected) {
        check(`pointregel ${t.label} ${g.players.join('/')}`, false, `${g.points} != ${expected}`);
      }
      totalMax += max;
      for (const p of g.players) {
        totalPoints += g.points;
        perPlayer.set(p, (perPlayer.get(p) || 0) + g.points);
      }
    }
  }
}
check('24 holdkampe', data.reduce((n, t) => n + t.matches.length, 0) === 24);
// 1.-3. hold: 5 matcher pr. kamp (3 single + 2 foursome). Senior: 6 (5 single + 1 foursome).
check('126 individuelle matcher', games === 126, games);
check('hver holdkamp har matcher', data.every(t => t.matches.every(m => m.games.length >= 5)));
check('alle hold har standings', data.every(t => t.standings.length >= 3));

// Topscorer skal optræde i overblikstabellen
const top = [...perPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
check(`topscorer "${top[0]}" vises`, main.includes(top[0].split(' ')[0]));

// Tiebreak: ved lige point skal højest udbytte rangere først i overblikstabellen
const order = [];
const rowRe = /<td class="player">([^<]+)<\/td>[\s\S]*?class="num pts">([^<]+)<[\s\S]*?class="num">(\d+)%</g;
let mm;
while ((mm = rowRe.exec(main)) !== null) {
  order.push({ name: mm[1], points: parseFloat(mm[2].replace(',', '.')), pct: parseInt(mm[3], 10) });
}
check('tabelrækker parset', order.length >= 30, order.length);

let tiebreakOk = true, offender = '';
for (let i = 1; i < order.length; i++) {
  const prev = order[i - 1], cur = order[i];
  if (prev.points < cur.points) { tiebreakOk = false; offender = `${prev.name} før ${cur.name} (point)`; break; }
  if (prev.points === cur.points && prev.pct < cur.pct) {
    tiebreakOk = false;
    offender = `${prev.name} (${prev.pct}%) før ${cur.name} (${cur.pct}%) ved ${cur.points} point`;
    break;
  }
}
check('lige point afgøres på udbytte', tiebreakOk, offender);

const tied = order.filter((r, i) => order.some((o, j) => j !== i && o.points === r.points));
check('der findes pointlige spillere at teste på', tied.length > 0, `${tied.length} spillere`);

let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.extra !== undefined ? ' -> ' + c.extra : ''}`);
}
console.log(`\n${checks.length - failed}/${checks.length} checks bestået`);
console.log(`Topscorer: ${top[0]} med ${top[1]} point`);
console.log(`Spillere i alt: ${perPlayer.size}`);
process.exit(failed ? 1 : 0);
