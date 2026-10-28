/**
 * How much of the world actually moves each year.
 *
 * A rule that reads well and touches nothing is not a pyramid either. This counts the adjacent division
 * pairs in the shipped world and how many clubs the exchange would carry across them in one season.
 */
import { PrismaClient } from '@prisma/client';
import { promotionSlots } from '../src/services/promotionService.js';

const prisma = new PrismaClient();
const leagues = await prisma.league.findMany({ select: { countryCode: true, division: true, clubIdsJson: true } });

const byCountry = new Map<string, { division: number; size: number }[]>();
for (const l of leagues) {
  const entry = { division: l.division, size: (JSON.parse(l.clubIdsJson) as string[]).length };
  byCountry.set(l.countryCode, [...(byCountry.get(l.countryCode) ?? []), entry]);
}

let pairs = 0, frozen = 0, clubsMoving = 0;
const frozenCountries: string[] = [];

for (const [country, tiers] of byCountry) {
  const ladder = [...tiers].sort((a, b) => a.division - b.division);
  for (let i = 0; i < ladder.length - 1; i += 1) {
    if (ladder[i + 1].division !== ladder[i].division + 1) continue;
    pairs += 1;
    const slots = promotionSlots(ladder[i].size, ladder[i + 1].size);
    if (slots === 0) {
      frozen += 1;
      frozenCountries.push(`${country} (${ladder[i].size}/${ladder[i + 1].size})`);
    } else {
      clubsMoving += slots * 2;
    }
  }
}

console.log(`países com liga: ${byCountry.size}`);
console.log(`pares de divisões vizinhas: ${pairs}`);
console.log(`  com troca: ${pairs - frozen}`);
console.log(`  congelados por tamanho: ${frozen}${frozen ? '  → ' + frozenCountries.slice(0, 6).join(', ') : ''}`);
console.log(`\nclubes trocando de divisão por temporada: ${clubsMoving}`);
await prisma.$disconnect();
