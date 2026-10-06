const fs = require('fs');

const COMPS = [
  { id: 5361058, label: '1. hold' },
  { id: 5361157, label: '2. hold' },
  { id: 5361479, label: '3. hold' },
  { id: 5368054, label: 'Senior hold' },
];

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  let t = await r.text();
  t = t.replaceAll('!0', 'true').replaceAll('!1', 'false');
  return JSON.parse(t);
}

(async () => {
  const out = [];
  for (const comp of COMPS) {
    const rr = await get(`https://scores.golfbox.dk/Handlers/RoundRobinHandler/GetRoundRobin/CompetitionId/${comp.id}/language/1030/`);
    const classKey = Object.keys(rr.Matchplay)[0];
    const cls = rr.Matchplay[classKey];

    const teams = Object.values(cls.LeaderboardTeams);
    const hk = teams.find(t => /harek/i.test(t.Name));
    if (!hk) { console.error(`Harekær ikke fundet i ${comp.label}`); continue; }

    const standings = teams
      .map(t => ({
        name: t.Name,
        position: t.Position.Actual,
        played: t.Played,
        wins: t.Wins,
        losses: t.Losses,
        draws: t.Draws,
        teamPoints: t.TeamMatchPointsTotal,
        matchPoints: t.MatchPointsTotal,
        score: t.Score.Text,
        isHarekaer: t.TeamID === hk.TeamID,
      }))
      .sort((a, b) => a.position - b.position);

    const tms = Object.values(cls.TeamMatches)
      .filter(m => m.Home.TeamId === hk.TeamID || m.Away.TeamId === hk.TeamID)
      .sort((a, b) => a.StartTime.localeCompare(b.StartTime));

    const matches = [];
    for (const tmMeta of tms) {
      const d = await get(`https://scores.golfbox.dk/Handlers/TeamMatchHandler/GetTeamMatch/CompetitionId/${comp.id}/TeamMatchId/${tmMeta.TeamMatchID}/language/1030/`);
      const tm = d.TeamMatch;
      const isHome = tm.Home.TeamId === hk.TeamID;
      const opponent = isHome ? tm.Away.Name : tm.Home.Name;
      const hkScore = isHome ? tm.Home.Result.FinalizedValue : tm.Away.Result.FinalizedValue;
      const oppScore = isHome ? tm.Away.Result.FinalizedValue : tm.Home.Result.FinalizedValue;

      const games = Object.values(tm.Matches)
        .sort((a, b) => a.OrderNo - b.OrderNo)
        .map(m => {
          const mine = m.Teams.find(t => t.TeamID === hk.TeamID);
          const theirs = m.Teams.find(t => t.TeamID !== hk.TeamID);
          const names = mine.Entries.map(e => `${e.FirstName.trim()} ${e.LastName.trim()}`);
          const oppNames = theirs.Entries.map(e => `${e.FirstName.trim()} ${e.LastName.trim()}`);
          // Sejr = 2 point, delt = 1 point, nederlag = 0. Samme for single og foursome.
          let points, result;
          if (mine.IsLead && !theirs.IsLead) { points = 2; result = 'won'; }
          else if (theirs.IsLead && !mine.IsLead) { points = 0; result = 'lost'; }
          else { points = 1; result = 'halved'; }
          return { format: m.Format, players: names, opponents: oppNames, scoreText: m.Result, result, points };
        });

      matches.push({
        date: tm.StartTime.slice(0, 8),
        home: tm.Home.Name,
        away: tm.Away.Name,
        isHome,
        opponent,
        hkScore,
        oppScore,
        resultText: tm.Result,
        outcome: hkScore > oppScore ? 'won' : hkScore < oppScore ? 'lost' : 'halved',
        games,
      });
    }

    out.push({
      ...comp,
      poolName: rr.CompetitionData.Name,
      teamName: hk.Name,
      standings,
      matches,
    });
    console.error(`${comp.label}: ${matches.length} kampe hentet (${rr.CompetitionData.Name})`);
  }

  fs.writeFileSync('data.json', JSON.stringify(out, null, 2), 'utf8');
  console.error('Skrevet til data.json');
})();
