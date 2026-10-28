import { describe, it, expect } from 'vitest';
import { fixtureWeatherKey, weatherFor } from '@tactical-arena/shared';
import type { CalendarEntry } from '../api/client.js';
import { weatherOfEntry } from './matchWeather.js';

/**
 * A preleção não pode mentir.
 *
 * Ela anuncia o tempo antes de a partida existir, calculando pela chave do confronto; o motor aplica o
 * tempo depois, calculando pela mesma chave. Se as duas pontas montarem a chave de formas diferentes — e a
 * inversão de mandante e visitante é a maneira óbvia de errar isso — a tela continua mostrando um tempo
 * perfeitamente válido, só que outro. Nada quebra, nada avisa, e o jogador é informado errado.
 *
 * O teste fixa a única coisa que impede isso: casa antes, visitante depois, e o clima é o do país de quem
 * joga em casa.
 */
describe('o tempo que a preleção promete', () => {
  const base: CalendarEntry = {
    round: 1,
    date: '2026-01-18',
    opponentClubId: 'visitante',
    opponentName: 'Visitante',
    isHome: true,
    competitionName: 'Brasileirão Série A',
  } as unknown as CalendarEntry;

  it('bate com o que o motor vai aplicar quando eu jogo em casa', () => {
    const esperado = weatherFor('2026-01-18', 'SOUTH_AMERICA', fixtureWeatherKey('meu-clube', 'visitante'));
    expect(weatherOfEntry(base, 'meu-clube', 'BRA')).toBe(esperado);
  });

  it('inverte a ordem quando eu jogo fora, porque a chave é sempre casa e depois visitante', () => {
    const fora = { ...base, isHome: false };
    const esperado = weatherFor('2026-01-18', 'SOUTH_AMERICA', fixtureWeatherKey('mandante', 'meu-clube'));
    expect(weatherOfEntry(fora, 'meu-clube', 'BRA')).toBe(esperado);
  });

  it('usa o clima do país do mandante, que é onde a partida acontece', () => {
    // Mesmo confronto, mesma data: só muda o país da casa, e o hemisfério com ele.
    const noBrasil = weatherOfEntry(base, 'meu-clube', 'BRA');
    const naInglaterra = weatherOfEntry(base, 'meu-clube', 'ENG');
    // Não precisam diferir sempre, mas precisam ser calculados a partir de continentes diferentes.
    expect(naInglaterra).toBe(weatherFor('2026-01-18', 'EUROPE', fixtureWeatherKey('meu-clube', 'visitante')));
    expect(noBrasil).toBe(weatherFor('2026-01-18', 'SOUTH_AMERICA', fixtureWeatherKey('meu-clube', 'visitante')));
  });

  it('não inventa tempo quando não sabe de onde é o mandante nem quando não há jogo', () => {
    expect(weatherOfEntry(base, 'meu-clube', null)).toBe('DRY');
    expect(weatherOfEntry(base, 'meu-clube', 'PAIS-QUE-NAO-EXISTE')).toBe('DRY');
    expect(weatherOfEntry(null, 'meu-clube', 'BRA')).toBe('DRY');
  });
});
