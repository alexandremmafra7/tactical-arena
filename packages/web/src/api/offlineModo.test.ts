import { describe, expect, it, beforeEach } from 'vitest';
import {
  localCreateNewSave,
  localListSaves,
  loadLocalGameState,
  resetInMemoryGameState,
  saveLocalGameState,
} from './localEngine.js';

/**
 * O modo de carreira sobrevive offline.
 *
 * Não é o teto de divisão — esse não se aplica sem servidor, porque o mundo local tem três países e só um
 * com segunda divisão. É o modo em si: ele tem de ser guardado e devolvido, senão a tela de partida não sabe
 * quais velocidades liberar e o painel não sabe o que esconder, e a escolha do jogador não vale nada.
 */
describe('o modo de carreira, offline', () => {
  beforeEach(() => {
    localStorage.clear();
    resetInMemoryGameState();
  });

  it('guarda o modo escolhido no mundo local e o devolve ao perfil', async () => {
    await localCreateNewSave({ name: 'Premium', gameMode: 'PREMIUM' });

    expect(loadLocalGameState().gameMode).toBe('PREMIUM');
    const saves = await localListSaves();
    // A tela de partida lê daqui para decidir as velocidades: se não voltar, o premium não recebe o que pagou.
    expect(saves.currentManager?.gameMode).toBe('PREMIUM');
    expect(saves.saves[0].gameMode).toBe('PREMIUM');
  });

  it('trata uma carreira sem modo como padrão, e não como a mais permissiva', async () => {
    // Save antigo, feito antes de os modos existirem. Cair no premium daria de graça o que se vende.
    await localCreateNewSave({ name: 'Antiga' });
    expect(loadLocalGameState().gameMode).toBe('STANDARD');
    expect((await localListSaves()).currentManager?.gameMode).toBe('STANDARD');
  });

  it('devolve o contexto real da carreira para a central offline', async () => {
    const state = loadLocalGameState();
    const club = state.clubs[0];
    club.ownerId = state.userId;
    state.gameDate = { year: 2026, month: 4, day: 5 };

    const league = state.leagues.find((candidate) => candidate.clubIds.includes(club.id));
    expect(league).toBeDefined();
    const clubFixtures = league!.fixtures.filter(
      (fixture) => fixture.homeClubId === club.id || fixture.awayClubId === club.id,
    );
    const nextFixture = clubFixtures[0];
    expect(nextFixture).toBeDefined();
    for (const fixture of clubFixtures) {
      fixture.date = fixture === nextFixture ? '2026-04-05' : '2026-04-12';
      fixture.matchId = null;
      fixture.result = null;
    }

    const opponentId = nextFixture!.homeClubId === club.id ? nextFixture!.awayClubId : nextFixture!.homeClubId;
    const opponent = state.clubs.find((candidate) => candidate.id === opponentId);
    saveLocalGameState(state);

    expect((await localListSaves()).saves[0]).toMatchObject({
      clubSlug: club.slug,
      currentDate: '2026-04-05',
      leaguePosition: expect.any(Number),
      nextOpponentName: opponent?.name,
      nextOpponentSlug: opponent?.slug,
      nextMatchDate: '2026-04-05',
      seasonPhase: 'IN_SEASON',
      transferWindowOpen: false,
    });
  });
});
