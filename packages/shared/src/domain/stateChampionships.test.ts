import { describe, expect, it } from 'vitest';
import {
  STATE_CHAMPIONSHIPS,
  getStateChampionship,
  getRegionalTournamentForState,
} from './stateChampionships.js';
import { recordTournamentChampion, getTrophyVisualSpec, type TrophyRoomEntry } from './trophyRoom.js';

describe('State Championships (Estaduais)', () => {
  it('defines the 10 main state championships of Brazil', () => {
    expect(STATE_CHAMPIONSHIPS.length).toBe(10);
    const sp = getStateChampionship('SP');
    expect(sp).toBeDefined();
    expect(sp?.shortName).toBe('Paulistão');
    expect(sp?.prizeMoneyChampion).toBe(5_000_000);

    const rj = getStateChampionship('RJ');
    expect(rj?.shortName).toBe('Carioca');
  });

  it('maps other states to regional tournaments (Copa do Nordeste or Copa Verde)', () => {
    const baRegional = getRegionalTournamentForState('BA');
    expect(baRegional?.key).toBe('copa-nordeste');

    const paRegional = getRegionalTournamentForState('PA');
    expect(paRegional?.key).toBe('copa-verde');
  });

  it('records state championship trophies correctly in the trophy room with REGIONAL tier', () => {
    const trophy: TrophyRoomEntry = {
      id: 't-1',
      competitionType: 'STATE_CHAMPIONSHIP',
      competitionName: 'Campeonato Paulista',
      seasonYear: 2026,
      clubId: 'club-spfc',
      clubName: 'São Paulo FC',
      managerName: 'Test Manager',
      trophyIcon: '🏆',
    };

    const visual = getTrophyVisualSpec('STATE_CHAMPIONSHIP', 'Campeonato Paulista');
    expect(visual.tier).toBe('REGIONAL');
    expect(visual.trophyAsset).toBe('tr_estadual_sp.png');

    const result = recordTournamentChampion([], trophy);
    expect(result.isNewTitle).toBe(true);
    expect(result.trophies.length).toBe(1);
    expect(result.trophies[0].competitionType).toBe('STATE_CHAMPIONSHIP');
  });
});
