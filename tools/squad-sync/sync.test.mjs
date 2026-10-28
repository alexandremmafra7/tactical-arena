import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPosition, ratingFromValue, sameClub, parseCsv, slugify } from './sync.mjs';

test('posições só usam o vocabulário canônico do domínio', () => {
  const subs = ['Goalkeeper', 'Centre-Back', 'Left-Back', 'Right-Back', 'Defensive Midfield', 'Central Midfield',
    'Attacking Midfield', 'Left Midfield', 'Right Midfield', 'Left Winger', 'Right Winger', 'Second Striker', 'Centre-Forward'];
  for (const s of subs) assert.ok(['GK', 'DEF', 'LAT', 'MID', 'ATT'].includes(mapPosition(s, '')), s);
  assert.equal(mapPosition('Left-Back', 'Defender'), 'LAT');
  assert.equal(mapPosition('', 'Attack'), 'ATT');
  assert.equal(mapPosition('', ''), null);
});

test('nota cresce com o valor e fica dentro de 40–92', () => {
  assert.equal(ratingFromValue(0), 60);
  assert.ok(ratingFromValue(1e6) < ratingFromValue(1e7));
  assert.ok(ratingFromValue(1e10) <= 92 && ratingFromValue(1) >= 40);
});

test('deduplicação de clubes por tokens', () => {
  assert.ok(sameClub('Boca Juniors', 'Club Atlético Boca Juniors'));
  assert.ok(sameClub('Bayern de Munique', 'Bayern Munich'));
  assert.ok(!sameClub('Santos', 'Palmeiras'));
});

test('CSV com aspas e vírgulas', () => {
  assert.deepEqual(parseCsv('a,"b,c","d ""x"""\n1,2,3\n'), [['a', 'b,c', 'd "x"'], ['1', '2', '3']]);
  assert.equal(slugify('Sociedade Esportiva Palmeiras'), 'sociedade-esportiva-palmeiras');
});
