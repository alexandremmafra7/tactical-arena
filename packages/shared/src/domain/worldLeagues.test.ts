import { describe, expect, it } from 'vitest';
import {
  WORLD_LEAGUE_COUNTRIES,
  WORLD_LEAGUES,
  getWorldLeagueCountry,
  getWorldLeagueDivision,
  isWorldLeagueCountry,
  qualifyLeagueTopFour,
  qualifyNationalCupWinner,
  mergeContinentalQualifications,
  inferWorldCompetitionCountry,
} from './worldLeagues.js';

describe('World Leagues Domain', () => {
  it('contains exactly the 10 elite football nations', () => {
    const expectedCodes = ['BRA', 'ENG', 'ESP', 'ITA', 'GER', 'FRA', 'POR', 'NED', 'ARG', 'KSA'];
    expect(WORLD_LEAGUE_COUNTRIES).toHaveLength(10);
    for (const code of expectedCodes) {
      expect(isWorldLeagueCountry(code), `País ${code} deve existir`).toBe(true);
      expect(getWorldLeagueCountry(code)?.code).toBe(code);
    }
  });

  it('configures official divisions for England, Spain, Italy, Germany and France', () => {
    const eng = getWorldLeagueCountry('ENG');
    expect(eng?.divisions).toHaveLength(2);
    expect(eng?.divisions[0].name).toBe('Premier League');
    expect(eng?.divisions[0].trophyAsset).toBe('tr_nacional_ING.png');
    expect(eng?.divisions[1].name).toBe('EFL Championship');

    const esp = getWorldLeagueCountry('ESP');
    expect(esp?.divisions).toHaveLength(2);
    expect(esp?.divisions[0].name).toBe('La Liga');
    expect(esp?.divisions[0].trophyAsset).toBe('tr_nacional_ESP.png');
    expect(esp?.divisions[1].name).toBe('La Liga 2');
    expect(esp?.divisions[1].trophyAsset).toBe('tr_nacional_ESP_d2.png');

    const ger = getWorldLeagueCountry('GER');
    expect(ger?.divisions).toHaveLength(2);
    expect(ger?.divisions[0].name).toBe('Bundesliga');
    expect(ger?.divisions[1].name).toBe('2. Bundesliga');

    const ita = getWorldLeagueCountry('ITA');
    expect(ita?.divisions).toHaveLength(2);
    expect(ita?.divisions[0].name).toBe('Serie A');
    expect(ita?.divisions[1].name).toBe('Serie B');
  });

  it('assigns correct continental slots for league top 4', () => {
    const mockStandings = [
      { clubId: 'club-1', position: 1 },
      { clubId: 'club-2', position: 2 },
      { clubId: 'club-3', position: 3 },
      { clubId: 'club-4', position: 4 },
      { clubId: 'club-5', position: 5 },
    ];

    // UEFA (England) -> Champions League
    const engSlots = qualifyLeagueTopFour('ENG', mockStandings);
    expect(engSlots).toHaveLength(4);
    expect(engSlots.every((s) => s.competition === 'CHAMPIONS_LEAGUE')).toBe(true);
    expect(engSlots[0].clubId).toBe('club-1');
    expect(engSlots[3].clubId).toBe('club-4');

    // CONMEBOL (Brazil) -> Libertadores
    const braSlots = qualifyLeagueTopFour('BRA', mockStandings);
    expect(braSlots).toHaveLength(4);
    expect(braSlots.every((s) => s.competition === 'LIBERTADORES')).toBe(true);

    // AFC (Saudi Arabia) -> AFC Champions League
    const ksaSlots = qualifyLeagueTopFour('KSA', mockStandings);
    expect(ksaSlots).toHaveLength(4);
    expect(ksaSlots.every((s) => s.competition === 'AFC_CHAMPIONS_LEAGUE')).toBe(true);
  });

  it('merges cup and league qualifications without duplicate entries', () => {
    const leagueSlots = qualifyLeagueTopFour('ENG', [
      { clubId: 'arsenal', position: 1 },
      { clubId: 'man-city', position: 2 },
      { clubId: 'liverpool', position: 3 },
      { clubId: 'chelsea', position: 4 },
    ]);

    // Arsenal also wins FA Cup
    const cupSlots = qualifyNationalCupWinner('ENG_NATIONAL_CUP', 'arsenal');
    expect(cupSlots).toHaveLength(1);
    expect(cupSlots[0].competition).toBe('EUROPA_LEAGUE');

    const merged = mergeContinentalQualifications(leagueSlots, cupSlots);
    // Arsenal is present in both competitions without key collision
    expect(merged.some((m) => m.clubId === 'arsenal' && m.competition === 'EUROPA_LEAGUE')).toBe(true);
    expect(merged.some((m) => m.clubId === 'arsenal' && m.competition === 'CHAMPIONS_LEAGUE')).toBe(true);

    // Duplicate exact qualification test
    const duplicateLeagueSlots = qualifyLeagueTopFour('ENG', [{ clubId: 'arsenal', position: 1 }]);
    const mergedDuplicates = mergeContinentalQualifications(duplicateLeagueSlots, duplicateLeagueSlots);
    expect(mergedDuplicates.filter((m) => m.clubId === 'arsenal' && m.competition === 'CHAMPIONS_LEAGUE')).toHaveLength(1);
  });

  it('infers world competition country by competition name', () => {
    expect(inferWorldCompetitionCountry('Premier League')).toBe('ENG');
    expect(inferWorldCompetitionCountry('La Liga')).toBe('ESP');
    expect(inferWorldCompetitionCountry('Bundesliga')).toBe('GER');
    expect(inferWorldCompetitionCountry('Serie A')).toBe('ITA');
    expect(inferWorldCompetitionCountry('Brasileirão Série A')).toBe('BRA');
    expect(inferWorldCompetitionCountry('Saudi Pro League')).toBe('KSA');
    expect(inferWorldCompetitionCountry('Copa do Brasil')).toBe('BRA');
    expect(inferWorldCompetitionCountry('FA Cup')).toBe('ENG');
    expect(inferWorldCompetitionCountry('Torneio Inexistente')).toBeNull();
  });
});
