import { Player, Position } from './player.js';
import { MatchEvent, MatchSide } from './match.js';

export interface PlayerRating {
  playerId: string;
  name: string;
  position: Position;
  rating: number;
}

const BASE_RATING = 6.0;
const GOAL_BONUS = 1.2;
const YELLOW_CARD_PENALTY = 0.3;
const RED_CARD_PENALTY = 1.5;
const CHANCE_BONUS = 0.1;
const WIN_BONUS = 0.3;
const LOSS_PENALTY = 0.3;

function clampRating(value: number): number {
  return Math.round(Math.max(0, Math.min(10, value)) * 10) / 10;
}

/**
 * A 0-10 post-match rating ("nota") per player who started the match, derived from the discrete events
 * the engine actually recorded — goals help, cards hurt, a created chance nudges it up a little, and the
 * team's final result gives everyone on it a small push either way. This isn't a play-by-play involvement
 * model (the engine doesn't track every touch a player has), but it's enough to produce a defensible,
 * explainable rating per player for the match report — the same spirit as the classic "notas" screen.
 */
export function calculateMatchRatings(
  homeLineupPlayers: Player[],
  awayLineupPlayers: Player[],
  events: MatchEvent[],
  homeGoals: number,
  awayGoals: number,
): { home: PlayerRating[]; away: PlayerRating[] } {
  function resultBonus(side: MatchSide): number {
    if (homeGoals === awayGoals) return 0;
    const won = side === 'home' ? homeGoals > awayGoals : awayGoals > homeGoals;
    return won ? WIN_BONUS : -LOSS_PENALTY;
  }

  function ratingsFor(players: Player[], side: MatchSide): PlayerRating[] {
    const opponentSide: MatchSide = side === 'home' ? 'away' : 'home';
    const goalsConceded = side === 'home' ? awayGoals : homeGoals;

    return players.map((player) => {
      let rating = BASE_RATING + resultBonus(side);
      if (player.position === 'GK') {
        // Goalkeeper baseline rating adjusted by goals conceded and saves made
        rating -= goalsConceded * 0.3;
        for (const event of events) {
          if (event.team === opponentSide && event.type === 'chance' && event.shotOutcome === 'saved') {
            rating += (event.xg && event.xg >= 0.30) ? 0.5 : 0.25;
          }
        }
      }

      for (const event of events) {
        if (event.team !== side || event.playerId !== player.id) continue;
        if (event.type === 'goal') rating += GOAL_BONUS;
        else if (event.type === 'card') rating -= event.suspensionMatches !== undefined ? RED_CARD_PENALTY : YELLOW_CARD_PENALTY;
        else if (event.type === 'chance') {
          if (event.shotOutcome === 'woodwork') rating += CHANCE_BONUS * 1.5;
          else if (event.xg && event.xg >= 0.30 && event.shotOutcome !== 'goal') rating -= 0.1;
          else rating += CHANCE_BONUS;
        }
      }
      return { playerId: player.id, name: player.name, position: player.position, rating: clampRating(rating) };
    });
  }

  return { home: ratingsFor(homeLineupPlayers, 'home'), away: ratingsFor(awayLineupPlayers, 'away') };
}

export interface ManOfTheMatch extends PlayerRating {
  side: MatchSide;
}

/** The single highest-rated player across both sides — ties go to whoever's on the winning side, then alphabetically. */
export function findManOfTheMatch(
  home: PlayerRating[],
  away: PlayerRating[],
  homeGoals: number,
  awayGoals: number,
): ManOfTheMatch | null {
  const all: ManOfTheMatch[] = [
    ...home.map((r) => ({ ...r, side: 'home' as MatchSide })),
    ...away.map((r) => ({ ...r, side: 'away' as MatchSide })),
  ];
  if (all.length === 0) return null;

  const winningSide: MatchSide | null = homeGoals === awayGoals ? null : homeGoals > awayGoals ? 'home' : 'away';
  all.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (winningSide) {
      if (a.side === winningSide && b.side !== winningSide) return -1;
      if (b.side === winningSide && a.side !== winningSide) return 1;
    }
    return a.name.localeCompare(b.name);
  });
  return all[0];
}
