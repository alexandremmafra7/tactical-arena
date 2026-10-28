import { describe, expect, it } from 'vitest';
import {
  SAVE_SLOT_SCHEMA_VERSION,
  normalizeSaveSlot,
  type LegacySaveEvidence,
  type SaveSlot,
} from './saveSlot.js';

const now = '2026-09-09T10:00:00.000Z';

function currentSlot(overrides: Partial<SaveSlot> = {}): SaveSlot {
  return {
    schemaVersion: SAVE_SLOT_SCHEMA_VERSION,
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Aurora',
    fileName: 'aurora.db',
    managerFirstName: 'Alex',
    managerLastName: 'Ribeiro',
    managerName: 'Alex Ribeiro',
    managerNationality: 'BRA',
    managerStyle: 'Estrategista',
    managerAvatar: '👔',
    clockFormat: 'HALF_45',
    gameMode: 'STANDARD',
    managerUserId: '22222222-2222-4222-8222-222222222222',
    clubId: '33333333-3333-4333-8333-333333333333',
    clubName: 'Clube Aurora',
    clubCountry: 'BRA',
    division: 2,
    season: 2026,
    round: 1,
    budget: 5_000_000,
    titlesWon: 0,
    createdAt: now,
    updatedAt: now,
    isCurrent: true,
    ...overrides,
  };
}

function evidence(): LegacySaveEvidence {
  return {
    users: [{ id: 'user-a' }],
    clubs: [
      {
        id: 'club-a',
        name: 'Aurora',
        country: 'BRA',
        ownerId: 'user-a',
        division: 3,
        budget: 4_000_000,
        titlesWon: 2,
      },
    ],
    managers: [
      {
        id: 'manager-a',
        name: 'Alex Ribeiro',
        nationality: 'BRA',
        userId: 'user-a',
        clubId: 'club-a',
      },
    ],
    openTenures: [{ userId: 'user-a', clubId: 'club-a' }],
    season: 2026,
    round: 4,
  };
}

describe('normalizeSaveSlot', () => {
  it('passes a complete current slot through without migration', () => {
    expect(normalizeSaveSlot(currentSlot())).toEqual({
      ok: true,
      slot: currentSlot(),
      migrated: false,
    });
  });

  it('preserves additive career-hub context on a current slot', () => {
    const slot = currentSlot({
      clubSlug: 'clube-aurora',
      crestBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      primaryColor: '#1e40af',
      secondaryColor: '#ffffff',
      currentDate: '2026-09-12',
      leaguePosition: 4,
      nextOpponentName: 'Boreal FC',
      nextOpponentSlug: 'boreal-fc',
      nextMatchDate: '2026-09-12',
      seasonPhase: 'IN_SEASON',
      transferWindowOpen: false,
    });

    expect(normalizeSaveSlot(slot)).toEqual({
      ok: true,
      slot,
      migrated: false,
    });
  });

  it.each([
    { currentDate: '12/09/2026' },
    { leaguePosition: 0 },
    { nextMatchDate: 'tomorrow' },
    { seasonPhase: 'TRANSFER_WINDOW' },
    { transferWindowOpen: 'yes' },
  ])('rejects malformed career-hub context %#', (patch) => {
    expect(normalizeSaveSlot({ ...currentSlot(), ...patch })).toEqual({
      ok: false,
      code: 'INVALID_LEGACY_SAVE',
      saveId: currentSlot().id,
    });
  });

  it.each([
    { managerUserId: '' },
    { clubId: '' },
    { division: 0 },
    { division: 1.5 },
    { managerStyle: 'Unknown' },
    { gameMode: 'ACADEMY' },
    { clockFormat: 'TWENTY_FOUR' },
    { createdAt: 'yesterday' },
  ])('rejects an invalid current field %#', (patch) => {
    expect(normalizeSaveSlot(currentSlot(patch as Partial<SaveSlot>))).toEqual({
      ok: false,
      code: 'INVALID_LEGACY_SAVE',
      saveId: currentSlot().id,
    });
  });

  it('migrates only an ownership tuple proven by all relationships', () => {
    const raw = {
      id: 'save-a',
      name: 'Carreira Aurora',
      fileName: 'aurora.db',
      createdAt: now,
      updatedAt: now,
      managerToken: 'must-disappear',
      claimedClubId: 'club-a',
    };
    const result = normalizeSaveSlot(raw, evidence());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(true);
    expect(result.slot).toMatchObject({
      managerUserId: 'user-a',
      clubId: 'club-a',
      clubName: 'Aurora',
      division: 3,
      season: 2026,
      round: 4,
      budget: 4_000_000,
      titlesWon: 2,
      gameMode: 'STANDARD',
      managerStyle: 'Estrategista',
      managerAvatar: '👔',
      clockFormat: 'HALF_45',
    });
    expect(result.slot).not.toHaveProperty('managerToken');
    expect(result.slot).not.toHaveProperty('claimedClubId');
  });

  it('does not let legacy ids override contradictory evidence', () => {
    expect(
      normalizeSaveSlot(
        {
          id: 'save-a',
          name: 'Carreira',
          fileName: 'save.db',
          managerUserId: 'other-user',
          createdAt: now,
          updatedAt: now,
        },
        evidence(),
      ),
    ).toEqual({
      ok: false,
      code: 'INVALID_LEGACY_SAVE',
      saveId: 'save-a',
    });
  });

  it('rejects zero proven ownership tuples', () => {
    const invalid = evidence();
    invalid.openTenures = [];
    expect(
      normalizeSaveSlot(
        {
          id: 'save-a',
          name: 'Carreira',
          fileName: 'save.db',
          createdAt: now,
          updatedAt: now,
        },
        invalid,
      ),
    ).toEqual({
      ok: false,
      code: 'INVALID_LEGACY_SAVE',
      saveId: 'save-a',
    });
  });

  it('rejects multiple proven ownership tuples without choosing one', () => {
    const ambiguous = evidence();
    ambiguous.users = [...ambiguous.users, { id: 'user-b' }];
    ambiguous.clubs = [
      ...ambiguous.clubs,
      {
        id: 'club-b',
        name: 'Boreal',
        country: 'ARG',
        ownerId: 'user-b',
        division: 2,
        budget: 1,
        titlesWon: 0,
      },
    ];
    ambiguous.managers = [
      ...ambiguous.managers,
      {
        id: 'manager-b',
        name: 'Bia',
        nationality: 'ARG',
        userId: 'user-b',
        clubId: 'club-b',
      },
    ];
    ambiguous.openTenures = [
      ...ambiguous.openTenures,
      { userId: 'user-b', clubId: 'club-b' },
    ];

    expect(
      normalizeSaveSlot(
        {
          id: 'save-a',
          name: 'Carreira',
          fileName: 'save.db',
          createdAt: now,
          updatedAt: now,
        },
        ambiguous,
      ),
    ).toEqual({
      ok: false,
      code: 'AMBIGUOUS_OWNERSHIP',
      saveId: 'save-a',
    });
  });
});
