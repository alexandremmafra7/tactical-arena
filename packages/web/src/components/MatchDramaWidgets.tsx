import { useState } from 'react';
import type { MatchEvent, PenaltyShootoutResult } from '@tactical-arena/shared';
import {
  buildMatchTimelineMarkers,
  computeMomentumBlocks,
  buildMatchNarrativeReplay,
  type MatchTimelineMarker,
  type MomentumBlock,
  type NarrativeReplayItem,
} from '@tactical-arena/shared';
import type { ClockFormat } from '../api/client.js';
import { GoalNetIcon, BarChartIcon } from './icons/AppIcons.js';

interface MatchTimelineBarProps {
  events: MatchEvent[];
  currentMinute?: number;
  homeName: string;
  awayName: string;
  clockFormat?: ClockFormat;
}

export function MatchTimelineBar({ events, currentMinute, homeName, awayName }: MatchTimelineBarProps) {
  const markers = buildMatchTimelineMarkers(events);
  const [hoveredMarker, setHoveredMarker] = useState<MatchTimelineMarker | null>(null);

  return (
    <div className="card" style={{ padding: '12px 16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '8px' }}>
        <span>0' (Início)</span>
        <span>45' (Intervalo)</span>
        <span>90'+ (Fim)</span>
      </div>
      <div className="timeline-visual-bar" style={{ position: 'relative', height: '36px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {currentMinute !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${Math.min(100, (currentMinute / 90) * 100)}%`,
              background: 'rgba(229, 169, 60, 0.1)',
              borderRight: '2px solid var(--accent)',
              zIndex: 1,
            }}
          />
        )}
        {markers.map((m: MatchTimelineMarker, idx: number) => {
          const pct = Math.min(100, Math.max(1, (m.minute / 90) * 100));
          const isHome = m.team === 'home';
          let icon: React.ReactNode = <GoalNetIcon size={14} color="#38bdf8" />;
          if (m.type === 'card_yellow') icon = <span style={{ display: 'inline-block', width: 8, height: 11, background: '#facc15', borderRadius: 2 }} />;
          else if (m.type === 'card_red') icon = <span style={{ display: 'inline-block', width: 8, height: 11, background: '#ef4444', borderRadius: 2 }} />;
          else if (m.type === 'injury') icon = <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.8rem' }}>+</span>;
          else if (m.type === 'sub') icon = <span style={{ color: '#22c55e', fontWeight: 800, fontSize: '0.8rem' }}>⇄</span>;
          else if (m.type === 'penalty_miss') icon = <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.8rem' }}>✕</span>;

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredMarker(m)}
              onMouseLeave={() => setHoveredMarker(null)}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                top: isHome ? '4px' : '18px',
                transform: 'translateX(-50%)',
                zIndex: 2,
                cursor: 'pointer',
                fontSize: '0.85rem',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
              }}
              title={`${m.minute}': ${m.description}`}
            >
              {icon}
            </div>
          );
        })}
      </div>
      {hoveredMarker && (
        <div style={{ fontSize: '0.78rem', color: 'var(--accent)', marginTop: '4px', textAlign: 'center' }}>
          <strong>{hoveredMarker.minute}' ({hoveredMarker.team === 'home' ? homeName : awayName}):</strong> {hoveredMarker.description}
          {hoveredMarker.scorelineAfter && ` — Placar: ${hoveredMarker.scorelineAfter}`}
        </div>
      )}
    </div>
  );
}

interface MatchMomentumWidgetProps {
  events: MatchEvent[];
  homeName: string;
  awayName: string;
}

export function MatchMomentumWidget({ events, homeName, awayName }: MatchMomentumWidgetProps) {
  const blocks = computeMomentumBlocks(events);

  return (
    <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 12px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <BarChartIcon size={16} color="#38bdf8" /> Momentum &amp; Pressão Tática por Blocos (15')
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
        {blocks.map((b: MomentumBlock, idx: number) => (
          <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px' }}>
              <span>{b.periodLabel}</span>
              <span style={{ color: b.dominantSide === 'home' ? 'var(--accent)' : b.dominantSide === 'away' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                {b.dominantSide === 'home' ? homeName.slice(0, 8) : b.dominantSide === 'away' ? awayName.slice(0, 8) : 'Equilibrado'}
              </span>
            </div>
            <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#27272a' }}>
              <div style={{ width: `${b.homeShare}%`, background: 'var(--accent)' }} title={`${homeName}: ${b.homeShare}%`} />
              <div style={{ width: `${b.awayShare}%`, background: 'var(--danger)' }} title={`${awayName}: ${b.awayShare}%`} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <span>{b.homeShare}%</span>
              <span>{b.awayShare}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PenaltyShootoutGridWidgetProps {
  shootout: PenaltyShootoutResult;
  homeName: string;
  awayName: string;
}

export function PenaltyShootoutGridWidget({ shootout, homeName, awayName }: PenaltyShootoutGridWidgetProps) {
  const homeKicks = shootout.kicks.filter((k) => k.team === 'home');
  const awayKicks = shootout.kicks.filter((k) => k.team === 'away');

  return (
    <div className="card" style={{ padding: '16px', marginBottom: '16px', borderLeft: '4px solid #3b82f6' }}>
      <h3 style={{ fontSize: '1rem', margin: '0 0 12px 0', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 8 }}>
        <GoalNetIcon size={18} color="#93c5fd" />
        Disputa de Pênaltis de Mata-Mata
      </h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '0.9rem' }}>
        <strong>{homeName}: {shootout.homeScore}</strong>
        <span className="muted">vs</span>
        <strong>{awayName}: {shootout.awayScore}</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ minWidth: '100px', fontSize: '0.85rem' }}>{homeName}:</span>
          {homeKicks.map((k, i) => (
            <div
              key={i}
              className={`penalty-grid-circle ${k.outcome === 'GOL' ? 'scored' : 'missed'}`}
              title={`Cobrança ${i + 1}: ${k.kickerName} — ${k.outcome}`}
            >
              {k.outcome === 'GOL' ? (
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
              ) : (
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ minWidth: '100px', fontSize: '0.85rem' }}>{awayName}:</span>
          {awayKicks.map((k, i) => (
            <div
              key={i}
              className={`penalty-grid-circle ${k.outcome === 'GOL' ? 'scored' : 'missed'}`}
              title={`Cobrança ${i + 1}: ${k.kickerName} — ${k.outcome}`}
            >
              {k.outcome === 'GOL' ? (
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
              ) : (
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface MatchNarrativeReplayWidgetProps {
  result: any;
  homeName: string;
  awayName: string;
}

export function MatchNarrativeReplayWidget({ result, homeName, awayName }: MatchNarrativeReplayWidgetProps) {
  const replayItems = buildMatchNarrativeReplay(result, homeName, awayName);
  if (replayItems.length === 0) return null;

  return (
    <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '1rem', margin: '0 0 12px 0', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <GoalNetIcon size={18} color="var(--accent)" />
        Replay dos Lances Capitais
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {replayItems.map((item: NarrativeReplayItem, idx: number) => (
          <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', borderLeft: `3px solid ${item.team === 'home' ? 'var(--accent)' : 'var(--danger)'}` }}>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', minWidth: '40px' }}>{item.minuteStr}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.title}</strong>
                {item.xg !== undefined && (
                  <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' }}>
                    xG: {item.xg.toFixed(2)}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
