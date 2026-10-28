import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { quickOpponentScout } from './ClubHome.js';

it('derives a stable quick scout without mutating the opponent squad', () => {
  const players = [
    { id: 'a', name: 'A', position: 'ST', overall: 81 },
    { id: 'b', name: 'B', position: 'GK', overall: 75 },
  ];
  const order = players.map((player) => player.id);
  const scout = quickOpponentScout(
    { players } as never,
    { clubId: 'opp', played: 10, wins: 6, draws: 2, losses: 2, points: 20 },
  );
  expect(scout).toEqual({
    averageOverall: 78,
    standout: players[0],
    record: '6V · 2E · 2D',
  });
  expect(players.map((player) => player.id)).toEqual(order);
});

it('renders the scout as an actionable command-room widget', () => {
  const source = readFileSync(new URL('./ClubHome.tsx', import.meta.url), 'utf8');
  expect(source).toContain('Olheiro rápido');
  expect(source).toContain('Força média');
  expect(source).toContain('Destaque');
  expect(source).toContain('Preparar plano de jogo');
  expect(source).toContain("to={`/clubs/${club.id}/tactics`}");
});

describe('Stadium Night dashboard color contract', () => {
  const source = readFileSync(new URL('./ClubHome.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  it('keeps neutral dashboard metrics out of gold success and danger colors', () => {
    expect(styles).toMatch(/\.club-home \.mini-standing strong \{\s*color: var\(--text-primary\);/);
    expect(styles).toMatch(/\.matchday-compact-pos \{[^}]*color: var\(--text-secondary\);/s);
    expect(source).not.toContain("(meetingContext?.expiringContracts ?? 0) > 0 ? '#fbbf24'");
  });

  it('uses semantic tones only for real dashboard states', () => {
    expect(source).toContain("briefing.weeklyNet > 0 ? 'metric-success' : briefing.weeklyNet < 0 ? 'metric-danger' : ''");
    expect(source).toContain("unavailablePlayerCount > 0 ? 'metric-danger' : ''");
    expect(source).toContain("avgStamina >= 80 ? 'metric-success' : ''");
    expect(source).toContain("avgMorale >= 60 ? 'metric-success' : ''");
    expect(styles).toContain('.club-home .metric-success {');
    expect(styles).toContain('.club-home .metric-danger {');
  });

  it('reserves gold in the match strip for its primary action', () => {
    const matchStrip = styles.slice(
      styles.indexOf('.matchday-hero-compact'),
      styles.indexOf('.matchday-compact-cta'),
    );
    expect(matchStrip).not.toMatch(/var\(--accent\)|#ffd700|#d4af37|212, 175, 55/);
  });
});