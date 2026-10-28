import { describe, expect, it } from 'vitest';
import { makePlayer } from './testFactories.js';
import {
  autoAssignBestRolesForPlayer,
  autoAssignSquadRoles,
  getPlayerRoleModifiers,
  PLAYER_ROLE_MODIFIERS,
} from './playerRoleModifiers.js';

describe('Player Role Modifiers', () => {
  it('defines modifiers for all player functions with sensible values', () => {
    const roles = Object.keys(PLAYER_ROLE_MODIFIERS);
    expect(roles.length).toBeGreaterThanOrEqual(18);

    const cao = PLAYER_ROLE_MODIFIERS['VOLANTE_CAO_DE_GUARDA'];
    expect(cao.defendingMultiplier).toBeGreaterThan(1.15);
    expect(cao.passingMultiplier).toBeLessThan(1.0);

    const f9 = PLAYER_ROLE_MODIFIERS['FALSO_NOVE'];
    expect(f9.passingMultiplier).toBeGreaterThan(1.15);
  });

  it('calculates stacked role modifiers correctly', () => {
    const neutral = getPlayerRoleModifiers([]);
    expect(neutral.defendingMultiplier).toBe(1.0);
    expect(neutral.passingMultiplier).toBe(1.0);

    const mod = getPlayerRoleModifiers(['VOLANTE_CAO_DE_GUARDA']);
    expect(mod.defendingMultiplier).toBe(1.22);
    expect(mod.foulMultiplier).toBe(1.25);
  });

  describe('autoAssignBestRolesForPlayer (Assistant Manager)', () => {
    it('returns empty array for Goalkeepers', () => {
      const gk = makePlayer('gk1', { position: 'GK' });
      expect(autoAssignBestRolesForPlayer(gk)).toEqual([]);
    });

    it('recommends ZAGUEIRO_CONSTRUTOR for defenders with good passing', () => {
      const ballPlayingDef = makePlayer('d1', {
        position: 'DEF',
        attributes: { pace: 70, finishing: 40, passing: 72, defending: 80, physical: 78, goalkeeping: 10 },
      });
      expect(autoAssignBestRolesForPlayer(ballPlayingDef)).toEqual(['ZAGUEIRO_CONSTRUTOR']);

      const stopper = makePlayer('d2', {
        position: 'DEF',
        attributes: { pace: 65, finishing: 30, passing: 55, defending: 84, physical: 85, goalkeeping: 10 },
      });
      expect(autoAssignBestRolesForPlayer(stopper)).toEqual(['ZAGUEIRO_REBATEDOR']);
    });

    it('recommends VOLANTE_CAO_DE_GUARDA for defensive destroyers and MEIA_ARMADOR for playmakers', () => {
      const destroyer = makePlayer('m1', {
        position: 'MID',
        attributes: { pace: 70, finishing: 45, passing: 68, defending: 82, physical: 80, goalkeeping: 10 },
      });
      expect(autoAssignBestRolesForPlayer(destroyer)).toEqual(['VOLANTE_CAO_DE_GUARDA']);

      const playmaker = makePlayer('m2', {
        position: 'MID',
        attributes: { pace: 72, finishing: 65, passing: 86, defending: 55, physical: 68, goalkeeping: 10 },
      });
      expect(autoAssignBestRolesForPlayer(playmaker)).toEqual(['MEIA_ARMADOR']);
    });

    it('recommends wingers or strikers based on pace and passing profiles', () => {
      const speedyWinger = makePlayer('a1', {
        position: 'ATT',
        attributes: { pace: 88, finishing: 78, passing: 70, defending: 35, physical: 70, goalkeeping: 10 },
      });
      expect(autoAssignBestRolesForPlayer(speedyWinger)).toEqual(['PONTA_INVERTIDO']);

      const targetMan = makePlayer('a2', {
        position: 'ATT',
        attributes: { pace: 68, finishing: 84, passing: 60, defending: 35, physical: 88, goalkeeping: 10 },
      });
      expect(autoAssignBestRolesForPlayer(targetMan)).toEqual(['CENTROAVANTE_REFERENCIA']);
    });
  });

  describe('autoAssignSquadRoles (1-Click Delegation)', () => {
    it('assigns roles to a list of outfield players efficiently', () => {
      const squad = [
        makePlayer('gk', { position: 'GK' }),
        makePlayer('d1', { position: 'DEF', attributes: { pace: 65, finishing: 30, passing: 55, defending: 84, physical: 85, goalkeeping: 10 } }),
        makePlayer('m1', { position: 'MID', attributes: { pace: 70, finishing: 45, passing: 68, defending: 82, physical: 80, goalkeeping: 10 } }),
        makePlayer('a1', { position: 'ATT', attributes: { pace: 88, finishing: 78, passing: 70, defending: 35, physical: 70, goalkeeping: 10 } }),
      ];

      const roles = autoAssignSquadRoles(['gk', 'd1', 'm1', 'a1'], squad);
      expect(roles['gk']).toBeUndefined(); // GKs are skipped
      expect(roles['d1']).toEqual(['ZAGUEIRO_REBATEDOR']);
      expect(roles['m1']).toEqual(['VOLANTE_CAO_DE_GUARDA']);
      expect(roles['a1']).toEqual(['PONTA_INVERTIDO']);
    });
  });
});
