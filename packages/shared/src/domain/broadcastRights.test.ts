import { describe, it, expect } from 'vitest';
import {
  ALL_BROADCASTER_CHANNELS,
  ALL_MEDIA_CONGLOMERATES,
  COMPETITION_BROADCAST_RIGHTS,
  resolveMatchBroadcaster,
  calculateMatchBroadcastPayout,
  generateSeasonBroadcastTargets,
  evaluateBroadcastTargets,
} from './broadcastRights.js';

describe('broadcastRights domain model', () => {
  it('defines 7 distinct fictional media conglomerates with channels', () => {
    expect(ALL_MEDIA_CONGLOMERATES.length).toBe(7);
    expect(Object.keys(ALL_BROADCASTER_CHANNELS).length).toBe(7);

    // Verify properties of OmniSports
    const omni = ALL_BROADCASTER_CHANNELS.omnisports;
    expect(omni.name).toBe('OmniSports HD');
    expect(omni.tier).toBe('FREE_TO_AIR');
    expect(omni.facilityFeeBonus).toBeGreaterThan(0);

    // Verify properties of SkyLine Sports
    const sky = ALL_BROADCASTER_CHANNELS.skyline_sports;
    expect(sky.name).toBe('SkyLine Sports 1');
    expect(sky.tier).toBe('PAY_TV');
  });

  it('assigns flagship primary broadcaster for decisive finals and high-profile matches', () => {
    const finalBroadcaster = resolveMatchBroadcaster('BRA', 14, 14, false);
    expect(finalBroadcaster.id).toBe(ALL_BROADCASTER_CHANNELS.omnisports.id);

    const engFinal = resolveMatchBroadcaster('ENG', 14, 14, false);
    expect(engFinal.id).toBe(ALL_BROADCASTER_CHANNELS.skyline_sports.id);

    const uclFinal = resolveMatchBroadcaster('champions', 7, 7, false);
    expect(uclFinal.id).toBe(ALL_BROADCASTER_CHANNELS.vertex_arena.id);

    const highProfileMatch = resolveMatchBroadcaster('BRA', 4, 14, true);
    expect(highProfileMatch.id).toBe(ALL_BROADCASTER_CHANNELS.omnisports.id);
  });

  it('distributes regular round matches among secondary/PPV broadcasters in a deterministic fashion', () => {
    const channelA = resolveMatchBroadcaster('BRA', 2, 14, false, 'match-1');
    const channelB = resolveMatchBroadcaster('BRA', 2, 14, false, 'match-2');

    expect(channelA).toBeDefined();
    expect(channelB).toBeDefined();
  });

  it('calculates facility fee share based on channel tier and home/away status', () => {
    const omni = ALL_BROADCASTER_CHANNELS.omnisports; // 60,000, FREE_TO_AIR
    expect(calculateMatchBroadcastPayout(omni, true)).toBe(39_000); // 65%
    expect(calculateMatchBroadcastPayout(omni, false)).toBe(21_000); // 35%

    const zenith = ALL_BROADCASTER_CHANNELS.zenith_premiere; // 30,000, PPV
    expect(calculateMatchBroadcastPayout(zenith, true)).toBe(15_000); // 50%
    expect(calculateMatchBroadcastPayout(zenith, false)).toBe(15_000); // 50%
  });

  it('evaluates broadcast targets correctly on season completion', () => {
    const targets = generateSeasonBroadcastTargets(50, 1);
    expect(targets.length).toBe(3);

    // Test finishing top 4
    const resTop4 = evaluateBroadcastTargets(targets, { leaguePosition: 2 });
    const top4Target = resTop4.updatedTargets.find((t) => t.id === 'target-top4');
    expect(top4Target?.isCompleted).toBe(true);
    expect(resTop4.totalRewardEarned).toBeGreaterThanOrEqual(500_000);

    // Test winning open broadcast matches
    const resWins = evaluateBroadcastTargets(targets, { openBroadcastWins: 5 });
    const winsTarget = resWins.updatedTargets.find((t) => t.id === 'target-open-wins');
    expect(winsTarget?.isCompleted).toBe(true);

    // Test cup finalist
    const resCup = evaluateBroadcastTargets(targets, { isCupFinalist: true });
    const cupTarget = resCup.updatedTargets.find((t) => t.id === 'target-cup-run');
    expect(cupTarget?.isCompleted).toBe(true);
  });
});

