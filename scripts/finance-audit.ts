/**
 * Do the numbers add up?
 *
 * Every figure comes from the shipped club database and the game's own formulas — nothing invented.
 *
 * players.csv carries two different column orders under one header (see the format sniffing below), so
 * this reads both. The importer only understands the first, which is a separate problem.
 */
import fs from 'node:fs';
import {
  STARTING_BUDGET,
  TV_MONEY_TOP_DIVISION,
  calculateMaintenanceCost,
  calculateMarketValue,
  calculateStadiumRevenue,
  calculateWage,
  calculatePrizeMoney,
  buildSponsorBoard,
  computeClubPrestige,
  STADIUM_LEVELS,
} from '../packages/shared/src/index.js';
import { createRng } from '../packages/shared/src/index.js';

const split = (line: string) => {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
};

const lines = (file: string) =>
  fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).slice(1).filter((l) => l.trim()).map(split);

const squads = new Map<string, { age: number; rating: number }[]>();
for (const p of lines('content/players.csv')) {
  // Format A: slug,name,position,age,nationality,rating   Format B: slug,name,age,position,rating
  const numeric = (v: string) => /^\d+$/.test((v ?? '').trim());
  const [age, rating] = numeric(p[3]) ? [Number(p[3]), Number(p[5])] : [Number(p[2]), Number(p[4])];
  if (!Number.isFinite(age) || !Number.isFinite(rating) || rating < 1 || rating > 99) continue;
  const list = squads.get(p[0]) ?? [];
  list.push({ age, rating });
  squads.set(p[0], list);
}

const SEASON_WEEKS = 36;
const stadiumLevelFor = (capacity: number) => {
  const index = STADIUM_LEVELS.findIndex((l) => l.capacity >= capacity);
  return index === -1 ? STADIUM_LEVELS.length : STADIUM_LEVELS[index].level;
};

const rows: { name: string; capacity: number; wages: number; revenue: number; sponsors: number; deals: number; net: number; annual: number }[] = [];
for (const c of lines('content/clubs.csv')) {
  const squad = squads.get(c[0]);
  if (!squad || squad.length < 11) continue;
  const capacity = Number(c[4]) || 2000;
  const wages = squad.reduce((s, p) => s + calculateWage(calculateMarketValue(p.age, p.rating, p.rating, 'NONE')), 0);
  const revenue = calculateStadiumRevenue(capacity);
  const prestige = {
    avgSquadOverall: squad.reduce((s, p) => s + p.rating, 0) / squad.length,
    stadiumLevel: stadiumLevelFor(capacity),
    division: Number(c[3]) || 1,
    leaguePosition: null,
    totalClubsInLeague: 20,
    titlesWon: 0,
  };
  const board = buildSponsorBoard(createRng(c[0]), prestige);
  const sponsors = board.reduce((s, d) => s + d.weeklyAmount, 0);
  const net = revenue + sponsors - wages - calculateMaintenanceCost(revenue, wages);
  rows.push({
    name: c[1], capacity, wages, revenue, sponsors, deals: board.length, net,
    annual: net * SEASON_WEEKS + TV_MONEY_TOP_DIVISION / (Number(c[3]) || 1),
  });
}

const money = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(n)).toLocaleString('pt-BR');
const pct = (n: number) => (n * 100).toFixed(0) + '%';

console.log(`ORÇAMENTO INICIAL ${money(STARTING_BUDGET)}  |  COTA DE TV/ano ${money(TV_MONEY_TOP_DIVISION)}  |  título ${money(calculatePrizeMoney(1))}\n`);

const byWages = [...rows].sort((a, b) => b.wages - a.wages);
const at = (q: number) => byWages[Math.floor((byWages.length - 1) * q)];
console.log('clube               capacidade   folha/sem      bilheteria/sem   patrocinio/sem   saldo/sem        ano (c/ TV)');
for (const [label, q] of [['maior folha', 0], ['P75', 0.25], ['MEDIANA', 0.5], ['P25', 0.75], ['menor folha', 1]] as const) {
  const r = at(q);
  console.log(
    `${label.padEnd(12)}${r.name.slice(0, 16).padEnd(17)}${String(r.capacity).padStart(7)}` +
      `${money(r.wages).padStart(14)}${money(r.revenue).padStart(16)}${(money(r.sponsors) + ' (' + r.deals + ')').padStart(17)}${money(r.net).padStart(16)}${money(r.annual).padStart(18)}`,
  );
}

const solvent = rows.filter((r) => r.annual >= 0).length;
const med = at(0.5);
console.log(`\nclubes analisados: ${rows.length}`);
console.log(`fecham o ano no azul: ${solvent} (${pct(solvent / rows.length)})`);
console.log(`clube mediano: folha ${money(med.wages * 52)}/ano contra receita ${money((med.revenue + med.sponsors) * 52 + TV_MONEY_TOP_DIVISION)}/ano`);
console.log(`  folha = ${pct((med.wages * 52) / ((med.revenue + med.sponsors) * 52 + TV_MONEY_TOP_DIVISION))} da receita (futebol real: 50 a 70%)`);
console.log(med.net >= 0 ? '  o clube mediano se paga' : `  o orçamento inicial cobre ${(STARTING_BUDGET / -med.net).toFixed(0)} semanas de uma temporada de ${SEASON_WEEKS}`);

const need = -med.net * SEASON_WEEKS;
console.log(`\npara o mediano fechar no zero faltam ${money(need - TV_MONEY_TOP_DIVISION)}/ano além da cota de TV atual`);

// O gradiente: um clube grande tem de ser mais rico que um pequeno, não o contrário.
const byScale = [...rows].sort((a, b) => a.wages - b.wages);
console.log('\ndecil por folha    folha/sem       patroc/sem    bilheteria/sem   lucro/ano      folha/receita');
for (let d = 0; d < 10; d += 1) {
  const slice = byScale.slice(Math.floor((byScale.length * d) / 10), Math.floor((byScale.length * (d + 1)) / 10));
  const avg = (f: (r: (typeof rows)[number]) => number) => slice.reduce((s, r) => s + f(r), 0) / slice.length;
  const w = avg((r) => r.wages);
  const rev = avg((r) => r.revenue) + avg((r) => r.sponsors) + TV_MONEY_TOP_DIVISION / 52;
  console.log(
    `  ${String(d + 1).padStart(2)}º${money(w).padStart(18)}${money(avg((r) => r.sponsors)).padStart(15)}` +
      `${money(avg((r) => r.revenue)).padStart(17)}${money(avg((r) => r.annual)).padStart(16)}${pct(w / rev).padStart(12)}`,
  );
}

console.log('\ndecil por ESTÁDIO  capacidade    folha/sem      patroc/sem   bilheteria/sem   lucro/ano');
const byGround = [...rows].sort((a, b) => a.capacity - b.capacity);
for (let d = 0; d < 10; d += 1) {
  const slice = byGround.slice(Math.floor((byGround.length * d) / 10), Math.floor((byGround.length * (d + 1)) / 10));
  const avg = (f: (r: (typeof rows)[number]) => number) => slice.reduce((s, r) => s + f(r), 0) / slice.length;
  console.log(
    `  ${String(d + 1).padStart(2)}º${Math.round(avg((r) => r.capacity)).toLocaleString('pt-BR').padStart(12)}` +
      `${money(avg((r) => r.wages)).padStart(15)}${money(avg((r) => r.sponsors)).padStart(15)}` +
      `${money(avg((r) => r.revenue)).padStart(17)}${money(avg((r) => r.annual)).padStart(16)}`,
  );
}
