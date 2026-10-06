(function () {
  'use strict';

  const DATA = window.HAREKAER_DATA || [];
  const TEAM_CLASS = { '1. hold': 't1', '2. hold': 't2', '3. hold': 't3', 'Senior hold': 't4' };

  const fmtNum = n => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
  const fmtPct = n => Math.round(n) + '%';

  function fmtDate(s) {
    const d = `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`;
    return d;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Aggregation ----------

  function blankStat(name) {
    return {
      name, points: 0, max: 0, matches: 0,
      won: 0, halved: 0, lost: 0,
      singles: 0, foursomes: 0,
      teams: new Set(),
    };
  }

  /** Aggregates player stats across the given teams. */
  function aggregate(teams) {
    const map = new Map();
    for (const team of teams) {
      for (const match of team.matches) {
        for (const game of match.games) {
          const max = 2;
          for (const name of game.players) {
            if (!map.has(name)) map.set(name, blankStat(name));
            const s = map.get(name);
            s.points += game.points;
            s.max += max;
            s.matches++;
            s[game.result === 'won' ? 'won' : game.result === 'lost' ? 'lost' : 'halved']++;
            s[game.format === 'single' ? 'singles' : 'foursomes']++;
            s.teams.add(team.label);
          }
        }
      }
    }
    return [...map.values()].map(s => ({
      ...s,
      teams: [...s.teams],
      pct: s.max ? (s.points / s.max) * 100 : 0,
    }));
  }

  function sortPlayers(rows, key, dir) {
    const mul = dir === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const d = key === 'name'
        ? a.name.localeCompare(b.name, 'da')
        : (a[key] || 0) - (b[key] || 0);
      if (d !== 0) return d * mul;
      // Ved pointlighed afgør størst procentvis udbytte. Tiebreaks vendes ikke
      // af sorteringsretningen, så rangeringen er konsistent.
      if (key !== 'points' && a.points !== b.points) return b.points - a.points;
      if (a.pct !== b.pct) return b.pct - a.pct;
      return a.name.localeCompare(b.name, 'da');
    });
  }

  // ---------- Components ----------

  function recordBar(s) {
    const total = s.matches || 1;
    const w = (s.won / total) * 100;
    const h = (s.halved / total) * 100;
    const l = (s.lost / total) * 100;
    return `<div class="record">
      <div class="bar" role="img" aria-label="${s.won} vundet, ${s.halved} delt, ${s.lost} tabt">
        <span class="w" style="width:${w}%"></span><span class="h" style="width:${h}%"></span><span class="l" style="width:${l}%"></span>
      </div>
      <span class="record-text">${s.won}&ndash;${s.halved}&ndash;${s.lost}</span>
    </div>`;
  }

  const COLS = [
    { key: 'rank', label: '#', sortable: false },
    { key: 'name', label: 'Spiller', sortable: true },
    { key: 'points', label: 'Point', sortable: true, num: true },
    { key: 'matches', label: 'Kampe', sortable: true, num: true },
    { key: 'record', label: 'V&ndash;D&ndash;T', sortable: false },
    { key: 'pct', label: 'Udbytte', sortable: true, num: true },
    { key: 'singles', label: 'Single', sortable: true, num: true },
    { key: 'foursomes', label: 'Foursome', sortable: true, num: true },
  ];

  function playerTable(rows, opts) {
    const showTeams = opts && opts.showTeams;
    const sortKey = (opts && opts.sortKey) || 'points';
    const sortDir = (opts && opts.sortDir) || 'desc';
    const sorted = sortPlayers(rows, sortKey, sortDir);

    const cols = COLS.slice();
    if (showTeams) cols.splice(2, 0, { key: 'teamcount', label: 'Hold', sortable: false });

    const head = cols.map(c => {
      const isSorted = c.key === sortKey;
      const cls = [c.num ? 'num' : '', c.sortable ? 'sortable' : '', isSorted ? 'sorted' : ''].filter(Boolean).join(' ');
      const arrow = isSorted ? `<span class="arrow">${sortDir === 'desc' ? '\u25bc' : '\u25b2'}</span>` : '';
      const attr = c.sortable ? ` data-sort="${c.key}" tabindex="0" role="button"` : '';
      return `<th class="${cls}"${attr}>${c.label}${arrow}</th>`;
    }).join('');

    const body = sorted.map((s, i) => {
      const rankCls = sortKey === 'points' && sortDir === 'desc' && i < 3 ? ` top${i + 1}` : '';
      const teamCell = showTeams
        ? `<td><div class="teamtags">${s.teams.map(t => `<span class="tag ${TEAM_CLASS[t] || ''}">${esc(t)}</span>`).join('')}</div></td>`
        : '';
      return `<tr>
        <td><span class="rank${rankCls}">${i + 1}</span></td>
        <td class="player">${esc(s.name)}</td>
        ${teamCell}
        <td class="num pts">${fmtNum(s.points)}</td>
        <td class="num">${s.matches}</td>
        <td>${recordBar(s)}</td>
        <td class="num">${fmtPct(s.pct)}</td>
        <td class="num">${s.singles}</td>
        <td class="num">${s.foursomes}</td>
      </tr>`;
    }).join('');

    if (!sorted.length) return `<div class="card"><div class="empty">Ingen spillerdata.</div></div>`;

    return `<div class="card"><div class="table-wrap"><table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table></div></div>`;
  }

  function standingsTable(team) {
    const rows = team.standings.map(t => `
      <tr class="${t.isHarekaer ? 'is-hk' : ''}">
        <td><span class="rank${t.position === 1 ? ' top1' : ''}">${t.position}</span></td>
        <td class="player">${esc(t.name)}</td>
        <td class="num">${t.played}</td>
        <td class="num">${t.wins}</td>
        <td class="num">${t.draws}</td>
        <td class="num">${t.losses}</td>
        <td class="num">${fmtNum(t.teamPoints)}</td>
        <td class="num nowrap">${esc(t.score)}</td>
      </tr>`).join('');

    return `<div class="card"><div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Klub</th><th class="num">Kampe</th>
        <th class="num">V</th><th class="num">U</th><th class="num">T</th>
        <th class="num">Matchpoint</th><th class="num">Score</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div></div>`;
  }

  function matchList(team) {
    return team.matches.map((m, idx) => {
      const sign = m.outcome === 'won' ? 'V' : m.outcome === 'lost' ? 'T' : 'U';
      const place = m.isHome ? 'Hjemme' : 'Ude';
      const games = m.games.map(g => `
        <tr>
          <td><span class="fmt ${g.format}">${g.format === 'single' ? 'Single' : 'Foursome'}</span></td>
          <td class="player">${esc(g.players.join(' / '))}</td>
          <td class="vs">mod ${esc(g.opponents.join(' / '))}</td>
          <td class="num nowrap">${esc(g.scoreText)}</td>
          <td class="res ${g.result}">${g.result === 'won' ? 'Vundet' : g.result === 'lost' ? 'Tabt' : 'Delt'}</td>
          <td class="num pts">${fmtNum(g.points)}</td>
        </tr>`).join('');

      return `<details class="match"${idx === 0 ? ' open' : ''}>
        <summary class="match-head">
          <span class="outcome-pill ${m.outcome}">${sign}</span>
          <span class="match-title">
            <span class="line1">${esc(m.home)} &ndash; ${esc(m.away)}</span>
            <span class="line2">${fmtDate(m.date)} &middot; ${place} mod ${esc(m.opponent)}</span>
          </span>
          <span class="match-score">${fmtNum(m.hkScore)}&ndash;${fmtNum(m.oppScore)}</span>
          <span class="chev">&#9660;</span>
        </summary>
        <div class="match-body"><div class="table-wrap"><table>
          <thead><tr>
            <th>Format</th><th>Harekær</th><th>Modstander</th>
            <th class="num">Resultat</th><th>Udfald</th><th class="num">Point</th>
          </tr></thead>
          <tbody>${games}</tbody>
        </table></div></div>
      </details>`;
    }).join('');
  }

  // ---------- Views ----------

  const state = { tab: 'alle', sortKey: 'points', sortDir: 'desc' };

  function totalsFor(teams) {
    let games = 0, won = 0, halved = 0, lost = 0, points = 0, max = 0;
    for (const t of teams) {
      for (const m of t.matches) {
        for (const g of m.games) {
          games++;
          points += g.points;
          max += 2;
          if (g.result === 'won') won++;
          else if (g.result === 'lost') lost++;
          else halved++;
        }
      }
    }
    return { games, won, halved, lost, points, max };
  }

  function renderHero() {
    const t = totalsFor(DATA);
    const players = aggregate(DATA).length;
    const teamMatches = DATA.reduce((n, x) => n + x.matches.length, 0);
    const el = document.getElementById('heroStats');
    el.innerHTML = `
      <div class="hstat"><div class="label">Hold</div><div class="value">${DATA.length}</div><div class="note">${teamMatches} holdkampe spillet</div></div>
      <div class="hstat"><div class="label">Spillere</div><div class="value">${players}</div><div class="note">i aktion på tværs af holdene</div></div>
      <div class="hstat"><div class="label">Point i alt</div><div class="value">${fmtNum(t.points)}</div><div class="note">af ${fmtNum(t.max)} mulige</div></div>
      <div class="hstat"><div class="label">Matcher</div><div class="value">${t.won}&ndash;${t.halved}&ndash;${t.lost}</div><div class="note">vundet &ndash; delt &ndash; tabt af ${t.games}</div></div>`;
  }

  function renderTabs() {
    const items = [{ id: 'alle', label: 'Samlet overblik' }]
      .concat(DATA.map(t => ({ id: t.label, label: t.label })));
    document.getElementById('tabs').innerHTML =
      `<div class="tabs-inner" role="tablist">` +
      items.map(i => `<button class="tab" role="tab" data-tab="${esc(i.id)}" aria-selected="${state.tab === i.id}">${esc(i.label)}</button>`).join('') +
      `</div>`;
  }

  function overviewView() {
    const rows = aggregate(DATA);
    const cards = DATA.map(t => {
      const st = t.standings.find(s => s.isHarekaer);
      const tot = totalsFor([t]);
      return `<button class="team-card" data-goto="${esc(t.label)}">
        <h3>${esc(t.label)}</h3>
        <div class="pool">${esc(t.poolName)} &middot; ${t.standings.length} klubber</div>
        <span class="placering${st.position === 1 ? ' gold' : ''}">${st.position}. plads${st.position === 1 ? ' \u2014 puljevinder' : ''}</span>
        <div class="row"><span>Holdkampe</span><b>${st.wins} V &middot; ${st.draws} U &middot; ${st.losses} T</b></div>
        <div class="row"><span>Spillerpoint</span><b>${fmtNum(tot.points)} / ${fmtNum(tot.max)}</b></div>
        <div class="row"><span>Matchscore</span><b>${esc(st.score)}</b></div>
      </button>`;
    }).join('');

    const multi = rows.filter(r => r.teams.length > 1)
      .sort((a, b) => b.points - a.points);

    const multiSection = multi.length ? `
      <section class="section">
        <div class="section-head">
          <h2>Spillere på flere hold</h2>
          <span class="section-note">${multi.length} spillere har repræsenteret mere end ét hold</span>
        </div>
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Spiller</th><th>Hold</th><th class="num">Point</th><th class="num">Kampe</th></tr></thead>
          <tbody>${multi.map(r => `<tr>
            <td class="player">${esc(r.name)}</td>
            <td><div class="teamtags">${r.teams.map(t => `<span class="tag ${TEAM_CLASS[t] || ''}">${esc(t)}</span>`).join('')}</div></td>
            <td class="num pts">${fmtNum(r.points)}</td>
            <td class="num">${r.matches}</td>
          </tr>`).join('')}</tbody>
        </table></div></div>
      </section>` : '';

    return `
      <section class="section">
        <div class="section-head"><h2>Holdene</h2><span class="section-note">Klik på et hold for detaljer</span></div>
        <div class="team-grid">${cards}</div>
      </section>
      <section class="section">
        <div class="section-head">
          <h2>Pointoversigt &ndash; alle spillere</h2>
          <span class="section-note">Lige point afgøres på udbytte &middot; klik på en kolonne for at sortere</span>
        </div>
        ${playerTable(rows, { showTeams: true, sortKey: state.sortKey, sortDir: state.sortDir })}
      </section>
      ${multiSection}`;
  }

  function teamView(team) {
    const rows = aggregate([team]);
    const st = team.standings.find(s => s.isHarekaer);
    const tot = totalsFor([team]);

    return `
      <section class="section">
        <div class="section-head">
          <h2>${esc(team.label)} &middot; ${esc(team.poolName)}</h2>
          <span class="section-note">${st.position}. plads af ${team.standings.length} &middot; ${fmtNum(tot.points)} spillerpoint af ${fmtNum(tot.max)} mulige</span>
        </div>
        ${standingsTable(team)}
      </section>
      <section class="section">
        <div class="section-head">
          <h2>Pointoversigt</h2>
          <span class="section-note">Lige point afgøres på udbytte &middot; klik på en kolonne for at sortere</span>
        </div>
        ${playerTable(rows, { sortKey: state.sortKey, sortDir: state.sortDir })}
      </section>
      <section class="section">
        <div class="section-head">
          <h2>Kampe</h2>
          <span class="section-note">${team.matches.length} holdkampe &middot; klik for at folde ud</span>
        </div>
        ${matchList(team)}
      </section>`;
  }

  function render() {
    renderTabs();
    const main = document.getElementById('main');
    if (state.tab === 'alle') {
      main.innerHTML = overviewView();
    } else {
      const team = DATA.find(t => t.label === state.tab);
      main.innerHTML = team ? teamView(team) : `<div class="card"><div class="empty">Hold ikke fundet.</div></div>`;
    }
  }

  function setTab(tab) {
    if (state.tab === tab) return;
    state.tab = tab;
    state.sortKey = 'points';
    state.sortDir = 'desc';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Events ----------

  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) return setTab(tab.dataset.tab);

    const goto = e.target.closest('[data-goto]');
    if (goto) return setTab(goto.dataset.goto);

    const sort = e.target.closest('[data-sort]');
    if (sort) {
      const key = sort.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        state.sortKey = key;
        state.sortDir = key === 'name' ? 'asc' : 'desc';
      }
      render();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const sort = e.target.closest('[data-sort]');
    if (sort) { e.preventDefault(); sort.click(); }
  });

  // ---------- Init ----------

  const updated = window.HAREKAER_UPDATED ? new Date(window.HAREKAER_UPDATED) : null;
  document.getElementById('updated').textContent = updated
    ? updated.toLocaleString('da-DK', { dateStyle: 'long', timeStyle: 'short' })
    : 'ukendt';

  renderHero();
  render();
})();
