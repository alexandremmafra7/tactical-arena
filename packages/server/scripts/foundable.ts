/** How much of the real world offers the founding mode. */
import { listFoundableCountries } from '../src/services/foundClubService.js';
import { COUNTRIES } from '@tactical-arena/shared';

const list = await listFoundableCountries();
console.log(`países onde dá para fundar um clube: ${list.length}`);
for (const c of list) {
  const name = COUNTRIES.find((x) => x.code === c.code)?.name ?? c.code;
  console.log(`  ${name.padEnd(22)} divisão de acesso ${c.accessDivision}, ${c.size} clubes`);
}
