import { describe, expect, it } from 'vitest';
import { makeClub, makePlayer } from '../simulation/testFactories.js';
import type { Player } from './player.js';
import { DEFAULT_STAFF_DELEGATION_CONFIG } from './staffDelegationConfig.js';
import {
  applyAutomatedMedicalCare,
  calculatePlayerInjuryRisk,
  getAutomatedMedicalCareSettings,
  getSquadInjuryAlerts,
  type MedicalCareMode,
} from './medicalDepartment.js';

const resistance = (value: number) => ({
  ...makePlayer('template').detailedAttributes,
  STAMINA: value,
  AEROBIC_STAMINA: value,
  STRENGTH_STAMINA: value,
});

const staff = (rating: number) => ({
  id: `fitness-${rating}`,
  name: 'Preparador',
  role: 'FITNESS_COACH' as const,
  tier: 'OURO' as const,
  rating,
  specialty: 'Recuperação rápida',
  description: '',
  wage: 1,
  minClubVisibility: 0,
  minCareerTitles: 0,
  avatar: '⚡',
  nationality: 'BRA',
});

describe('calculatePlayerInjuryRisk', () => {
  const player = makePlayer('risk', { detailedAttributes: resistance(70) });

  it.each([
    [70, 'LOW'],
    [69, 'MODERATE'],
    [50, 'MODERATE'],
    [49, 'HIGH'],
    [30, 'HIGH'],
    [29, 'CRITICAL'],
  ] as const)('classifies condition %s as %s', (condition, level) => {
    expect(calculatePlayerInjuryRisk(player, condition).riskLevel).toBe(level);
  });

  it('averages detailed stamina resistance', () => {
    const mixed = makePlayer('mixed', {
      detailedAttributes: {
        ...resistance(50),
        STAMINA: 20,
        AEROBIC_STAMINA: 50,
        STRENGTH_STAMINA: 80,
      },
    });

    expect(calculatePlayerInjuryRisk(mixed, 60).riskPercentage).toBe(35);
  });

  it('adds exactly 12 points for rain', () => {
    const weak = makePlayer('weak', { detailedAttributes: resistance(30) });
    const dry = calculatePlayerInjuryRisk(weak, 60, false);
    const wet = calculatePlayerInjuryRisk(weak, 60, true);

    expect(wet.riskPercentage - dry.riskPercentage).toBe(12);
    expect(wet.description).toContain('chuva');
  });

  it('falls back to physical resistance for a legacy player', () => {
    const base = makePlayer('old');
    const oldSave = {
      ...base,
      attributes: { ...base.attributes, physical: 1 },
      detailedAttributes: undefined,
    } as unknown as Player;

    expect(calculatePlayerInjuryRisk(oldSave, 60).riskPercentage).toBe(49.7);
  });

  it('clamps condition and risk to 0-100', () => {
    const fragile = makePlayer('fragile', { detailedAttributes: resistance(0) });
    const resistant = makePlayer('resistant', { detailedAttributes: resistance(100) });

    expect(calculatePlayerInjuryRisk(fragile, -50, true).riskPercentage).toBe(100);
    expect(calculatePlayerInjuryRisk(resistant, 150).riskPercentage).toBe(0);
  });

  it('normalizes a non-finite condition to a finite percentage', () => {
    const result = calculatePlayerInjuryRisk(player, Number.NaN);

    expect(Number.isFinite(result.riskPercentage)).toBe(true);
    expect(result.riskPercentage).toBeGreaterThanOrEqual(0);
    expect(result.riskPercentage).toBeLessThanOrEqual(100);
  });

  it('keeps the condition category floor despite strong resistance', () => {
    const resistant = makePlayer('resistant-floor', { detailedAttributes: resistance(100) });

    expect(calculatePlayerInjuryRisk(resistant, 50).riskLevel).toBe('MODERATE');
    expect(calculatePlayerInjuryRisk(resistant, 30).riskLevel).toBe('HIGH');
    expect(calculatePlayerInjuryRisk(resistant, 10).riskLevel).toBe('CRITICAL');
  });
});

describe('getSquadInjuryAlerts', () => {
  it('uses 100 - fatigue, filters lower risks and distinguishes starters', () => {
    const starter = makePlayer('starter', { fatigue: 71, detailedAttributes: resistance(70) });
    const reserve = makePlayer('reserve', { fatigue: 60, detailedAttributes: resistance(50) });
    const moderate = makePlayer('moderate', { fatigue: 40, detailedAttributes: resistance(50) });
    const fresh = makePlayer('fresh', { fatigue: 5, detailedAttributes: resistance(70) });

    const alerts = getSquadInjuryAlerts([starter, reserve, moderate, fresh], [starter.id]);

    expect(alerts.map(({ playerId, isStarter }) => ({ playerId, isStarter }))).toEqual([
      { playerId: 'starter', isStarter: true },
      { playerId: 'reserve', isStarter: false },
    ]);
    expect(alerts[0].suggestion).toContain('Poupar');
    expect(alerts[1].suggestion).toContain('descanso');
  });
});

describe('delegated medical care', () => {
  const injuredClub = (rating = 75) => ({
    ...makeClub('medical', 'Medical FC', 70),
    players: [makePlayer('injured', { injuryWeeks: 3 })],
    staff: [staff(rating)],
  });

  it.each([
    [55, 'auto_balanced', 0],
    [65, 'auto_balanced', 0],
    [75, 'auto_balanced', 1],
    [85, 'auto_balanced', 1],
    [95, 'auto_balanced', 1],
    [55, 'auto_fastest', 1],
    [65, 'auto_fastest', 1],
    [75, 'auto_fastest', 1],
    [85, 'auto_fastest', 2],
    [95, 'auto_fastest', 2],
  ] as const)('maps coach rating %s in %s to %s week(s)', (rating, mode, reduction) => {
    const club = {
      ...injuredClub(rating),
      staffDelegationConfig: {
        ...DEFAULT_STAFF_DELEGATION_CONFIG,
        presetMode: 'custom' as const,
        injuryRehab: mode,
      },
    };
    const settings = getAutomatedMedicalCareSettings(club);

    expect(settings).toEqual({
      mode,
      chiefDoctorRating: Math.floor((rating - 50) / 10) + 1,
    });
    const result = applyAutomatedMedicalCare(
      club,
      settings!.chiefDoctorRating,
      settings!.mode,
    );
    expect(result.club.players[0].injuryWeeks).toBe(3 - reduction);
    expect(result.recoveries).toHaveLength(reduction > 0 ? 1 : 0);
  });

  it('makes manual care a no-op and does not mutate the input', () => {
    const club = injuredClub();
    const result = applyAutomatedMedicalCare(club, 5, 'manual_medical_clinic');

    expect(result.club).toBe(club);
    expect(result.recoveries).toEqual([]);
    expect(club.players[0].injuryWeeks).toBe(3);
  });

  it('caps recovery at zero and records only the actual integer reduction', () => {
    const club = {
      ...injuredClub(95),
      players: [makePlayer('one', { injuryWeeks: 1 }), makePlayer('fit')],
    };
    const originalPlayers = club.players.map((player) => ({ ...player }));

    const result = applyAutomatedMedicalCare(club, 5, 'auto_fastest');

    expect(result.club.players.map((player) => player.injuryWeeks)).toEqual([0, 0]);
    expect(result.recoveries).toEqual([{
      playerId: 'one',
      playerName: 'Player one',
      previousInjuryWeeks: 1,
      injuryWeeks: 0,
      weeksReduced: 1,
    }]);
    expect(club.players).toEqual(originalPlayers);
    expect(result.club).not.toBe(club);
  });

  it('normalizes negative and fractional legacy durations without false recoveries', () => {
    const club = {
      ...injuredClub(95),
      players: [
        makePlayer('negative', { injuryWeeks: -2 }),
        makePlayer('fractional', { injuryWeeks: 2.75 }),
      ],
    };

    const result = applyAutomatedMedicalCare(club, 1, 'auto_balanced');

    expect(result.club.players.map((player) => player.injuryWeeks)).toEqual([0, 2]);
    expect(result.recoveries).toEqual([]);
    expect(club.players.map((player) => player.injuryWeeks)).toEqual([-2, 2.75]);
  });

  it('normalizes legacy durations before recording a positive medical reduction', () => {
    const club = {
      ...injuredClub(95),
      players: [makePlayer('fractional-injured', { injuryWeeks: 2.75 })],
    };

    const result = applyAutomatedMedicalCare(club, 3, 'auto_balanced');

    expect(result.club.players[0].injuryWeeks).toBe(1);
    expect(result.recoveries).toEqual([{
      playerId: 'fractional-injured',
      playerName: 'Player fractional-injured',
      previousInjuryWeeks: 2,
      injuryWeeks: 1,
      weeksReduced: 1,
    }]);
  });

  it('treats a casual preset as auto_fastest and defaults to rating 3 without a coach', () => {
    const club = {
      ...injuredClub(),
      staff: [],
      staffDelegationConfig: {
        ...DEFAULT_STAFF_DELEGATION_CONFIG,
        injuryRehab: 'manual_medical_clinic' as const,
        presetMode: 'brasfoot_casual' as const,
      },
    };

    expect(getAutomatedMedicalCareSettings(club)).toEqual({
      mode: 'auto_fastest',
      chiefDoctorRating: 3,
    });
  });

  it('returns no automatic settings for a non-casual manual clinic', () => {
    const club = {
      ...injuredClub(),
      staffDelegationConfig: {
        ...DEFAULT_STAFF_DELEGATION_CONFIG,
        injuryRehab: 'manual_medical_clinic' as const,
        presetMode: 'custom' as const,
      },
    };

    expect(getAutomatedMedicalCareSettings(club)).toBeNull();
  });

  it('uses the default balanced mode and rating when arguments are omitted', () => {
    const result = applyAutomatedMedicalCare(injuredClub());

    expect(result.club.players[0].injuryWeeks).toBe(2);
  });

  it.each([
    [49, 1],
    [50, 1],
    [59, 1],
    [60, 2],
    [69, 2],
    [70, 3],
    [79, 3],
    [80, 4],
    [89, 4],
    [90, 5],
    [99, 5],
    [100, 5],
  ] as const)('clamps and maps staff rating %s to effectiveness %s', (rating, expected) => {
    const club = {
      ...injuredClub(rating),
      staffDelegationConfig: {
        ...DEFAULT_STAFF_DELEGATION_CONFIG,
        presetMode: 'custom' as const,
        injuryRehab: 'auto_fastest' as MedicalCareMode,
      },
    };

    expect(getAutomatedMedicalCareSettings(club)?.chiefDoctorRating).toBe(expected);
  });
});
