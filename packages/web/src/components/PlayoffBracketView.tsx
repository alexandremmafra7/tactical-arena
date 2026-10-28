import React from 'react';
import { ClubCrest } from './ClubCrest.js';
import { TrophyIcon } from './icons/AppIcons.js';
import type { CupFixture, Match } from '@tactical-arena/shared';

interface ClubInfo {
  name: string;
  slug?: string | null;
  crestBase64?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

interface PlayoffBracketViewProps {
  title?: string;
  fixtures: CupFixture[];
  clubInfo: Record<string, ClubInfo>;
  matches?: Record<string, Match>;
  championClubId?: string | null;
}

export function PlayoffBracketView({
  title = 'Mata-Mata / Playoffs',
  fixtures,
  clubInfo,
  matches = {},
  championClubId,
}: PlayoffBracketViewProps) {
  const roundsMap = new Map<number, CupFixture[]>();
  for (const f of fixtures) {
    const list = roundsMap.get(f.round) ?? [];
    list.push(f);
    roundsMap.set(f.round, list);
  }

  const rounds = [...roundsMap.entries()].sort((a, b) => a[0] - b[0]);

  if (fixtures.length === 0) {
    return (
      <div className="card" style={{ padding: 20, textAlign: 'center' }}>
        <h3>{title}</h3>
        <p className="muted">O mata-mata ainda não foi iniciado (será gerado ao término da fase regular).</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <TrophyIcon size={20} color="var(--accent, #f59e0b)" />
        {title}
      </h3>
      {championClubId && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid var(--success)', padding: 12, borderRadius: 8, margin: '12px 0', textAlign: 'center', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <TrophyIcon size={18} color="var(--success, #22c55e)" />
          Campeão: {clubInfo[championClubId]?.name ?? championClubId}
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, overflowX: 'auto', paddingBottom: 12, marginTop: 16 }}>
        {rounds.map(([roundNum, roundFixtures]) => {
          const stageName = roundFixtures[0]?.stageName ?? `Rodada ${roundNum}`;
          return (
            <div key={roundNum} style={{ minWidth: 240, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ textAlign: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 6, color: 'var(--accent)' }}>
                {stageName}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {roundFixtures.map((fix, idx) => {
                  const home = clubInfo[fix.homeClubId];
                  const away = clubInfo[fix.awayClubId];
                  const matchRes = fix.matchId ? matches[fix.matchId]?.result : null;
                  const isPlayed = fix.winnerClubId != null || matchRes != null;
                  const homeGoals = matchRes?.homeGoals ?? fix.aggregateScore?.home;
                  const awayGoals = matchRes?.awayGoals ?? fix.aggregateScore?.away;

                  return (
                    <div
                      key={fix.matchId ?? idx}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: 10,
                        fontSize: '0.9rem',
                      }}
                    >
                      {fix.leg && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center' }}>
                          Jogo {fix.leg}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <ClubCrest club={{ id: fix.homeClubId, name: home?.name ?? fix.homeClubId, slug: home?.slug, crestBase64: home?.crestBase64, primaryColor: home?.primaryColor, secondaryColor: home?.secondaryColor }} size={20} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: fix.winnerClubId === fix.homeClubId ? 700 : 400 }}>
                            {home?.name ?? fix.homeClubId}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'right' }}>
                          {isPlayed && homeGoals !== undefined ? homeGoals : '-'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <ClubCrest club={{ id: fix.awayClubId, name: away?.name ?? fix.awayClubId, slug: away?.slug, crestBase64: away?.crestBase64, primaryColor: away?.primaryColor, secondaryColor: away?.secondaryColor }} size={20} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: fix.winnerClubId === fix.awayClubId ? 700 : 400 }}>
                            {away?.name ?? fix.awayClubId}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'right' }}>
                          {isPlayed && awayGoals !== undefined ? awayGoals : '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
