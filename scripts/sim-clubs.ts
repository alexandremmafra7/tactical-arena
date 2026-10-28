import { makeClub, makePlayer } from '../packages/shared/src/simulation/testFactories.js';
import { Player } from '../packages/shared/src/domain/player.js';
import { Club } from '../packages/shared/src/domain/club.js';

/**
 * Time "estrela": um elenco forte com alguns craques mundiais (starLevel NATURAL, overall 95+),
 * talentos (DEVELOPED, overall 85-90) e o resto em bom nível (75-80) — não os 11 igualmente lendários,
 * como um super clube de verdade.
 */
export function buildStarClub(): Club {
  const base = makeClub('star-fc', 'Galacticos FC', 78);

  const overrides: Record<string, Partial<Player>> = {
    'star-fc-p0': { name: 'Igor Salvatti (GK)', overall: 88, potential: 88, starLevel: 'DEVELOPED' },
    'star-fc-p1': { name: 'Bruno Kessler (ZAG)', overall: 84, potential: 84, starLevel: 'DEVELOPED' },
    'star-fc-p2': { name: 'Diego Ferraro (ZAG)', overall: 82, potential: 84 },
    'star-fc-p3': { name: 'Kwame Osei (LAT)', overall: 83, potential: 86, starLevel: 'DEVELOPED' },
    'star-fc-p4': { name: 'Rafael Toledo (LAT)', overall: 80, potential: 82 },
    'star-fc-p5': { name: 'Erik Solheim (MEI)', overall: 96, potential: 97, starLevel: 'NATURAL' },
    'star-fc-p6': { name: 'Yusuke Amano (MEI)', overall: 86, potential: 90, starLevel: 'DEVELOPED' },
    'star-fc-p7': { name: 'Théo Marchetti (MEI)', overall: 81, potential: 83 },
    'star-fc-p8': { name: 'Kaique Ribas (MEI)', overall: 79, potential: 81 },
    'star-fc-p9': { name: 'Adrián Molina (ATA)', overall: 97, potential: 98, starLevel: 'NATURAL' },
    'star-fc-p10': { name: 'Marko Ilic (ATA)', overall: 89, potential: 92, starLevel: 'DEVELOPED' },
  };

  const players = base.players.map((p) => {
    const o = overrides[p.id];
    if (!o) return p;
    return makePlayer(p.id, { ...p, ...o });
  });

  return { ...base, players };
}

/** Time "normal": nível médio, sem estrelas, para servir de referência. */
export function buildNormalClub(): Club {
  return makeClub('normal-fc', 'Vila Operária EC', 62);
}

export function avgOverall(players: Player[]): string {
  return (players.reduce((s, p) => s + p.overall, 0) / players.length).toFixed(1);
}
