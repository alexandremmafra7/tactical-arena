/** One finished season/tournament's record — a row in the História screens. */
export interface CompetitionHistoryEntry {
  /** In-game "year" (see League.season/Cup.season). */
  season: number;
  name: string;
  /** Only set for league entries — cups don't have divisions. */
  division?: number;
  championClubId: string;
  championClubName: string;
  /** The champion club owner's display name — "CPU" for bot-owned clubs. */
  managerName: string;
  topScorerName: string | null;
  topScorerGoals: number | null;
  topScorerClubName: string | null;
}

export interface CountryHistory {
  countryCode: string;
  countryName: string;
  leagues: CompetitionHistoryEntry[];
  cups: CompetitionHistoryEntry[];
}
