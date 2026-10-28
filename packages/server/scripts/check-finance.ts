import { PrismaClient } from '@prisma/client';
import { calculateMaintenanceCost, calculateStadiumRevenue } from '@tactical-arena/shared';

const prisma = new PrismaClient();
const clubs = await prisma.club.findMany({
  select: { name: true, stadiumCapacity: true, stadiumLevel: true, weeklyWageBill: true, academyWageBill: true, sponsorshipsJson: true, playersJson: true },
});

const money = (n: number) => (n < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(n)).toLocaleString('pt-BR');
const rows = clubs.map((c) => {
  const sponsors = (JSON.parse(c.sponsorshipsJson) as { weeklyAmount: number }[]);
  const wages = c.weeklyWageBill + c.academyWageBill;
  const gate = calculateStadiumRevenue(c.stadiumCapacity);
  const income = sponsors.reduce((s, d) => s + d.weeklyAmount, 0);
  return {
    name: c.name, level: c.stadiumLevel, deals: sponsors.length, wages, gate, income,
    net: gate + income - wages - calculateMaintenanceCost(gate, wages),
    squad: (JSON.parse(c.playersJson) as unknown[]).length,
  };
});

console.log(`clubes: ${rows.length}   elenco médio: ${(rows.reduce((s, r) => s + r.squad, 0) / rows.length).toFixed(1)} jogadores`);
console.log(`sem patrocínio: ${rows.filter((r) => r.deals === 0).length}`);
const q = (p: number) => [...rows].sort((a, b) => a.net - b.net)[Math.floor((rows.length - 1) * p)];
console.log('\nsaldo semanal      clube                 nível  contratos     folha       patrocínio        saldo');
for (const [label, p] of [['pior', 0], ['P25', .25], ['mediana', .5], ['P75', .75], ['melhor', 1]] as const) {
  const r = q(p);
  console.log(`  ${label.padEnd(9)}${r.name.slice(0, 22).padEnd(24)}${r.level}${String(r.deals).padStart(10)}${money(r.wages).padStart(14)}${money(r.income).padStart(16)}${money(r.net).padStart(14)}`);
}
const red = rows.filter((r) => r.net * 36 + 3_000_000 < 0).length;
console.log(`\nno vermelho no ano (com cota de TV): ${red} (${((red / rows.length) * 100).toFixed(0)}%)`);
await prisma.$disconnect();
