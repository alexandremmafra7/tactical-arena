import { describe, expect, it } from 'vitest';
import {
  NATIONAL_CUPS,
  NATIONAL_SUPER_CUPS,
  getNationalCupConfig,
  getNationalCupsForCountry,
  getSuperCupForCountry,
  stageNameForNationalCup,
  trophyAssetForCompetitionName,
} from './nationalCups.js';

describe('National Cups & Supercups Domain', () => {
  it('defines national cups for all elite football countries', () => {
    expect(NATIONAL_CUPS.length).toBeGreaterThanOrEqual(11);

    const faCup = getNationalCupConfig('FA Cup');
    expect(faCup?.countryCode).toBe('ENG');
    expect(faCup?.trophyAsset).toBe('tr_copa_ING.png');
    expect(faCup?.continentalReward).toBe('EUROPA_LEAGUE');

    const copaBrasil = getNationalCupConfig('Copa do Brasil');
    expect(copaBrasil?.countryCode).toBe('BRA');
    expect(copaBrasil?.trophyAsset).toBe('tr_copa_BRA.png');
    expect(copaBrasil?.continentalReward).toBe('LIBERTADORES');
    expect(copaBrasil?.format).toBe('MIXED_COPA_DO_BRASIL');

    const copaRey = getNationalCupConfig('Copa del Rey');
    expect(copaRey?.countryCode).toBe('ESP');
    expect(copaRey?.trophyAsset).toBe('tr_copa_ESP.png');

    const coppaItalia = getNationalCupConfig('Coppa Italia');
    expect(coppaItalia?.countryCode).toBe('ITA');
    expect(coppaItalia?.trophyAsset).toBe('tr_copa_ITA.png');

    const dfbPokal = getNationalCupConfig('DFB-Pokal');
    expect(dfbPokal?.countryCode).toBe('GER');
    expect(dfbPokal?.trophyAsset).toBe('tr_copa_ALE.png');

    const coupeFrance = getNationalCupConfig('Coupe de France');
    expect(coupeFrance?.countryCode).toBe('FRA');
    expect(coupeFrance?.trophyAsset).toBe('tr_copa_FRA.png');

    const tacaPortugal = getNationalCupConfig('Taça de Portugal');
    expect(tacaPortugal?.countryCode).toBe('POR');
    expect(tacaPortugal?.trophyAsset).toBe('tr_copa_POR.png');

    const knvbBeker = getNationalCupConfig('KNVB Beker');
    expect(knvbBeker?.countryCode).toBe('NED');
    expect(knvbBeker?.trophyAsset).toBe('tr_copa_HOL.png');

    const copaArgentina = getNationalCupConfig('Copa Argentina');
    expect(copaArgentina?.countryCode).toBe('ARG');
    expect(copaArgentina?.trophyAsset).toBe('tr_copa_ARG.png');

    const kingsCup = getNationalCupConfig("King's Cup");
    expect(kingsCup?.countryCode).toBe('KSA');
    expect(kingsCup?.trophyAsset).toBe('tr_copa_ARS.png');
    expect(kingsCup?.continentalReward).toBe('AFC_CHAMPIONS_LEAGUE');
  });

  it('lists multiple cups for England (FA Cup and EFL Cup)', () => {
    const engCups = getNationalCupsForCountry('ENG');
    expect(engCups).toHaveLength(2);
    expect(engCups.map((c) => c.shortName)).toContain('FA Cup');
    expect(engCups.map((c) => c.shortName)).toContain('EFL Cup');
  });

  it('maps supercups with official trophy assets', () => {
    expect(NATIONAL_SUPER_CUPS.length).toBeGreaterThanOrEqual(9);

    const braSuper = getSuperCupForCountry('BRA');
    expect(braSuper?.name).toBe('Supercopa do Brasil');
    expect(braSuper?.trophyAsset).toBe('tr_supercopa_BRA.png');

    const gerSuper = getSuperCupForCountry('GER');
    expect(gerSuper?.name).toBe('DFL-Supercup');
    expect(gerSuper?.trophyAsset).toBe('tr_supercopa_ALE.png');

    const espSuper = getSuperCupForCountry('ESP');
    expect(espSuper?.name).toBe('Supercopa de España');
    expect(espSuper?.trophyAsset).toBe('tr_supercopa_ESP.png');

    const ksaSuper = getSuperCupForCountry('KSA');
    expect(ksaSuper?.name).toBe('Saudi Super Cup');
    expect(ksaSuper?.trophyAsset).toBe('tr_supercopa_ARS.png');
  });

  it('resolves stage names accurately with legs', () => {
    expect(stageNameForNationalCup('FA Cup', 16)).toBe('Oitavas de Final');
    expect(stageNameForNationalCup('FA Cup', 8)).toBe('Quartas de Final');
    expect(stageNameForNationalCup('FA Cup', 4)).toBe('Semifinal');
    expect(stageNameForNationalCup('FA Cup', 2)).toBe('Final');

    // Two-legged ties
    expect(stageNameForNationalCup('Copa do Brasil', 8, 1)).toBe('Quartas de Final (Ida)');
    expect(stageNameForNationalCup('Copa do Brasil', 8, 2)).toBe('Quartas de Final (Volta)');
  });

  it('resolves trophy assets by competition name', () => {
    expect(trophyAssetForCompetitionName('FA Cup')).toBe('tr_copa_ING.png');
    expect(trophyAssetForCompetitionName('Copa do Brasil')).toBe('tr_copa_BRA.png');
    expect(trophyAssetForCompetitionName('DFL-Supercup')).toBe('tr_supercopa_ALE.png');
    expect(trophyAssetForCompetitionName('Supercopa do Brasil')).toBe('tr_supercopa_BRA.png');
    expect(trophyAssetForCompetitionName('Competição Fantasma')).toBeNull();
  });
});
