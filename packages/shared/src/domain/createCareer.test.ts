import { describe, expect, it } from 'vitest';
import { CREST_SPEC } from './crestSpec.js';
import { validateCreateCareerInput } from './createCareer.js';

const takeover = {
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  saveName: ' Aurora ',
  manager: {
    firstName: ' Alex ',
    lastName: ' Ribeiro ',
    nationality: 'BRA',
    style: 'Estrategista',
    avatar: ' 👔 ',
    clockFormat: 'HALF_45',
  },
  gameMode: 'STANDARD',
  club: { kind: 'TAKE_OVER', clubId: ' club-a ' },
};

const foundation = {
  ...takeover,
  gameMode: 'HARDCORE',
  club: {
    kind: 'FOUND',
    countryCode: 'BRA',
    name: ' Aurora FC ',
    city: ' Curitiba ',
    citySize: 'MEDIUM',
    kitPattern: 'STRIPES_VERTICAL',
    primaryColor: '#112233',
    secondaryColor: '#aabbcc',
    crest: { crestBase64: 'data:image/png;base64,iVBORw==' },
  },
};

function expectInvalid(input: unknown, field: string) {
  expect(validateCreateCareerInput(input)).toMatchObject({
    ok: false,
    error: { code: 'VALIDATION_ERROR', field },
  });
}

describe('validateCreateCareerInput', () => {
  it('returns a trimmed takeover payload without dropping fields', () => {
    expect(validateCreateCareerInput(takeover)).toEqual({
      ok: true,
      value: {
        ...takeover,
        saveName: 'Aurora',
        manager: {
          ...takeover.manager,
          firstName: 'Alex',
          lastName: 'Ribeiro',
          avatar: '👔',
        },
        club: { kind: 'TAKE_OVER', clubId: 'club-a' },
      },
    });
  });

  it('retains every persisted foundation field', () => {
    expect(validateCreateCareerInput(foundation)).toEqual({
      ok: true,
      value: {
        ...foundation,
        saveName: 'Aurora',
        manager: {
          ...foundation.manager,
          firstName: 'Alex',
          lastName: 'Ribeiro',
          avatar: '👔',
        },
        club: {
          ...foundation.club,
          name: 'Aurora FC',
          city: 'Curitiba',
          awayKitPattern: null,
          awayPrimaryColor: null,
          awaySecondaryColor: null,
          supplierName: null,
          masterSponsorName: null,
          optionalSponsorName: null,
          showOptionalSponsor: false,
        },
      },
    });
  });

  it.each([
    [{ ...takeover, idempotencyKey: ' ' }, 'idempotencyKey'],
    [{ ...takeover, saveName: '' }, 'saveName'],
    [{ ...takeover, manager: { ...takeover.manager, firstName: '' } }, 'manager.firstName'],
    [{ ...takeover, manager: { ...takeover.manager, lastName: '' } }, 'manager.lastName'],
    [{ ...takeover, manager: { ...takeover.manager, nationality: '' } }, 'manager.nationality'],
    [{ ...takeover, manager: { ...takeover.manager, nationality: 'ZZZ' } }, 'manager.nationality'],
    [{ ...takeover, manager: { ...takeover.manager, avatar: '' } }, 'manager.avatar'],
    [{ ...takeover, manager: { ...takeover.manager, style: 'Unknown' } }, 'manager.style'],
    [{ ...takeover, manager: { ...takeover.manager, clockFormat: 'TWENTY_FOUR' } }, 'manager.clockFormat'],
    [{ ...takeover, gameMode: 'ACADEMY' }, 'gameMode'],
    [{ ...takeover, club: { kind: 'TAKE_OVER', clubId: ' ' } }, 'club.clubId'],
  ])('rejects invalid takeover field %#', (input, field) => {
    expectInvalid(input, field);
  });

  it.each([
    [{ ...foundation, club: { ...foundation.club, name: '' } }, 'club.name'],
    [{ ...foundation, club: { ...foundation.club, countryCode: '' } }, 'club.countryCode'],
    [{ ...foundation, club: { ...foundation.club, countryCode: 'ZZZ' } }, 'club.countryCode'],
    [{ ...foundation, club: { ...foundation.club, city: '' } }, 'club.city'],
    [{ ...foundation, club: { ...foundation.club, citySize: 'HUGE' } }, 'club.citySize'],
    [{ ...foundation, club: { ...foundation.club, kitPattern: 'DOTS' } }, 'club.kitPattern'],
    [{ ...foundation, club: { ...foundation.club, primaryColor: 'red' } }, 'club.primaryColor'],
    [{ ...foundation, club: { ...foundation.club, secondaryColor: '#1234' } }, 'club.secondaryColor'],
    [{ ...foundation, club: { ...foundation.club, crest: { crestBase64: 'not-base64!' } } }, 'club.crest.crestBase64'],
  ])('rejects invalid foundation field %#', (input, field) => {
    expectInvalid(input, field);
  });

  it('accepts null as the procedural crest fallback', () => {
    const input = {
      ...foundation,
      club: { ...foundation.club, crest: { crestBase64: null } },
    };
    expect(validateCreateCareerInput(input)).toMatchObject({ ok: true });
  });

  it('rejects a decoded crest larger than the shared limit', () => {
    const oversized = 'AAAA'.repeat(Math.ceil((CREST_SPEC.maxBytes + 1) / 3));
    expectInvalid(
      {
        ...foundation,
        club: {
          ...foundation.club,
          crest: { crestBase64: `data:image/png;base64,${oversized}` },
        },
      },
      'club.crest.crestBase64',
    );
  });
});
