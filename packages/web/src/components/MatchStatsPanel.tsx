interface StatsSide {
  shots: number;
  shotsOnTarget: number;
  possession: number;
  corners: number;
  fouls: number;
  xg?: number;
  bigChances?: number;
  saves?: number;
}

interface MatchStatsPanelProps {
  home: StatsSide;
  away: StatsSide;
}

/** The modern statistical breakdown — includes xG (Expected Goals), big chances and keeper saves. */
export function MatchStatsPanel({ home, away }: MatchStatsPanelProps) {
  const rows = [
    { label: 'Posse de bola', home: home.possession, away: away.possession, unit: '%', isDecimal: false },
    ...(home.xg !== undefined && away.xg !== undefined
      ? [{ label: 'Gols Esperados (xG)', home: home.xg, away: away.xg, unit: '', isDecimal: true }]
      : []),
    { label: 'Finalizações', home: home.shots, away: away.shots, isDecimal: false },
    { label: 'No gol', home: home.shotsOnTarget, away: away.shotsOnTarget, isDecimal: false },
    ...(home.bigChances !== undefined && away.bigChances !== undefined && (home.bigChances > 0 || away.bigChances > 0)
      ? [{ label: 'Grandes Chances', home: home.bigChances, away: away.bigChances, isDecimal: false }]
      : []),
    ...(home.saves !== undefined && away.saves !== undefined && (home.saves > 0 || away.saves > 0)
      ? [{ label: 'Defesas do Goleiro', home: home.saves, away: away.saves, isDecimal: false }]
      : []),
    { label: 'Escanteios', home: home.corners, away: away.corners, isDecimal: false },
    { label: 'Faltas', home: home.fouls, away: away.fouls, isDecimal: false },
  ];

  return (
    <div className="match-live-stats">
      {rows.map((row) => {
        const total = row.home + row.away;
        const homePct = total > 0 ? (row.home / total) * 100 : 50;
        const homeVal = row.isDecimal ? row.home.toFixed(2) : row.home;
        const awayVal = row.isDecimal ? row.away.toFixed(2) : row.away;

        return (
          <div className="stat-row" key={row.label}>
            <div className="stat-row-numbers">
              <span>
                {homeVal}
                {row.unit ?? ''}
              </span>
              <span className="stat-row-label">{row.label}</span>
              <span>
                {awayVal}
                {row.unit ?? ''}
              </span>
            </div>
            <div className="stat-row-bar">
              <span className="stat-row-bar-home" style={{ width: `${homePct}%` }} />
              <span className="stat-row-bar-away" style={{ width: `${100 - homePct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
