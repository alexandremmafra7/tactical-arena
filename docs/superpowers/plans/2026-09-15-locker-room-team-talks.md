# Vestiário Vivo e Preleções Táticas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar hierarquia social, coesão, apoio ao treinador, insatisfação por minutos e preleções pré-jogo/intervalo com paridade entre servidor e offline.

**Architecture:** Toda matemática vive em `@tactical-arena/shared`; servidor e offline somente materializam o estado, aplicam os mesmos deltas de moral e persistem. O motor já consome moral ao recalcular a força a cada segmento, então preleções afetam o jogo sem um segundo multiplicador. A UI usa um card único em pré-jogo e intervalo e uma página de vestiário integrada à navegação existente.

**Tech Stack:** TypeScript 5.8, React 18, Express, Prisma 5/SQLite, Vitest 2, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-15-locker-room-team-talks-design.md`

## Global Constraints

- Preservar as seis assinaturas aprovadas do domínio puro.
- Aplicar exatamente os pesos de liderança, thresholds de hierarquia, coesão, apoio e preleções aprovados.
- Adicionar `DETERMINED` a `PersonalityTrait`; usar `commitment` como apoio/determinação disponível no modelo atual.
- Não adicionar dependências nem um segundo multiplicador ao motor de partidas.
- Server e offline devem compartilhar payloads, respostas e regras.
- Toda mutação online valida posse do clube; leitura exige autenticação.
- Saves antigos recebem defaults por `ensureSchema` e healing offline.
- Seguir TDD por tarefa e não testar apenas strings/imports quando comportamento renderizado ou API real puder ser testado.

## File Map

- Create `packages/shared/src/domain/lockerRoom.ts`: tipos, hierarquia, coesão, apoio, opções, preleções e happiness tick.
- Create `packages/shared/src/domain/lockerRoom.test.ts`: regras determinísticas do domínio.
- Modify `packages/shared/src/domain/player.ts`: traço `DETERMINED`.
- Modify `packages/shared/src/index.ts`: barrel público.
- Modify `packages/server/prisma/schema.prisma`: `Club.lockerRoomJson`.
- Modify `packages/server/src/db/ensureSchema.ts`: migração de saves antigos.
- Create `packages/server/src/services/lockerRoomService.ts`: leitura, aplicação e resolução de preocupação.
- Modify `packages/server/src/routes/clubs.ts`: GET de vestiário e POST de preleção.
- Create `packages/server/src/lockerRoomFlow.test.ts`: persistência, autorização e efeitos.
- Modify `packages/web/src/api/localEngine.ts`: mapa persistido e operações offline.
- Modify `packages/web/src/api/client.ts`: fachada online/offline.
- Modify `packages/web/src/api/localEngine.test.ts`: paridade e reload.
- Create `packages/web/src/components/TeamTalkCard.tsx`: seleção e feedback acessível.
- Create `packages/web/src/components/TeamTalkCard.test.tsx`: comportamento do card.
- Create `packages/web/src/pages/LockerRoom.tsx`: dashboard Stadium Night.
- Create `packages/web/src/pages/LockerRoom.test.tsx`: medidores e hierarquia.
- Modify `packages/web/src/pages/MatchBriefing.tsx`: preleção antes do kickoff.
- Modify `packages/web/src/components/LiveTacticalModal.tsx`: slot de preleção no intervalo.
- Modify `packages/web/src/pages/LiveMatch.tsx`: contexto e aplicação no intervalo.
- Modify `packages/web/src/App.tsx`: rota.
- Modify `packages/web/src/lib/clubNavigation.ts`: destino/aba de vestiário.
- Modify `packages/web/src/lib/clubNavigation.test.ts`: rotas desktop/mobile.
- Modify `packages/web/src/styles.css`: estilos Stadium Night e responsivos.

---

### Task 1: Domínio puro de hierarquia, coesão e preleções

**Files:**
- Create: `packages/shared/src/domain/lockerRoom.test.ts`
- Create: `packages/shared/src/domain/lockerRoom.ts`
- Modify: `packages/shared/src/domain/player.ts:7`
- Modify: `packages/shared/src/index.ts:18-22`

**Interfaces:**
- Consumes: `Player`, `PersonalityTrait`.
- Produces: `HierarchyTier`, `SocialGroup`, `TeamTalkTone`, `TeamTalkContext`, `PlayerHierarchyEntry`, `LockerRoomState`, `TeamTalkOption`, `TeamTalkResult`, `computeLeadershipScore`, `computeLockerRoomHierarchy`, `calculateSquadCohesion`, `getAvailableTeamTalks`, `applyTeamTalk`, `evaluateSquadHappinessTick`.

- [ ] **Step 1: Escrever testes RED para liderança e pirâmide**

Use `makePlayer` e fixtures pequenas:

```ts
import { describe, expect, it } from 'vitest';
import { makePlayer } from '../simulation/testFactories.js';
import {
  applyTeamTalk,
  calculateSquadCohesion,
  computeLeadershipScore,
  computeLockerRoomHierarchy,
  evaluateSquadHappinessTick,
  getAvailableTeamTalks,
} from './lockerRoom.js';

const player = (id: string, overrides = {}) => makePlayer(id, {
  age: 24,
  overall: 60,
  morale: 70,
  commitment: 70,
  nationality: 'BRA',
  traits: [],
  ...overrides,
});

describe('computeLeadershipScore', () => {
  it('applies tenure, overall, age, personality and captain weights exactly', () => {
    const captain = player('captain', { age: 30, overall: 80, traits: ['LEADER'] });
    expect(computeLeadershipScore(captain, 20, true)).toBe(102);
  });
  it('supports DETERMINED and the 25-year age band', () => {
    expect(computeLeadershipScore(player('d', { age: 25, overall: 70, traits: ['DETERMINED'] }), 8, false)).toBe(50);
  });
});

describe('computeLockerRoomHierarchy', () => {
  it('assigns at most two leaders and positions 3-5 as highly influential', () => {
    const squad = [
      player('a', { age: 31, overall: 85, traits: ['LEADER'] }),
      player('b', { age: 30, overall: 84, traits: ['LEADER'] }),
      player('c', { overall: 80 }), player('d', { overall: 79 }), player('e', { overall: 78 }),
      player('f', { overall: 60 }), player('g', { age: 18, overall: 40 }),
    ];
    const state = computeLockerRoomHierarchy(squad, { a: 120, b: 100 }, 'a');
    expect(state.hierarchy.map(({ playerId, tier }) => [playerId, tier])).toEqual([
      ['a', 'TEAM_LEADER'], ['b', 'TEAM_LEADER'],
      ['c', 'HIGHLY_INFLUENTIAL'], ['d', 'HIGHLY_INFLUENTIAL'], ['e', 'HIGHLY_INFLUENTIAL'],
      ['f', 'INFLUENTIAL'], ['g', 'GENERAL_SQUAD'],
    ]);
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar RED**

Run:

```sh
npm test -w packages/shared -- src/domain/lockerRoom.test.ts
```

Expected: FAIL porque `lockerRoom.js` não existe.

- [ ] **Step 3: Implementar tipos, score, grupos e hierarquia mínimos**

Add `'DETERMINED'` to `PersonalityTrait`. In `lockerRoom.ts`, implement `clamp`, modal nationality with lexical tie-break, score rounded with `Math.round(score * 10) / 10`, stable sorting, the approved tier rules, happiness as rounded `(morale + commitment) / 2`, and social groups in the order documented by the spec. Return cohesion/support/atmosphere from shared private helpers; initialize incidents from hierarchy concerns.

- [ ] **Step 4: Confirmar GREEN para liderança**

Run the command from Step 2. Expected: leadership/hierarchy tests PASS.

- [ ] **Step 5: Acrescentar testes RED para coesão e apoio**

```ts
describe('calculateSquadCohesion', () => {
  it('uses only five recent results and clamps to 10-100', () => {
    const squad = [player('leader', { age: 31, overall: 90, morale: 30, commitment: 30, traits: ['LEADER'] })];
    expect(calculateSquadCohesion(squad, ['W', 'W', 'L', 'D', 'W', 'W'], 1)).toBe(67);
    expect(calculateSquadCohesion(squad, Array(30).fill('L') as ('L')[], 30)).toBe(10);
  });
});

it('weights manager support 45/35/20 and derives atmosphere', () => {
  const state = computeLockerRoomHierarchy([
    player('leader', { age: 31, overall: 90, morale: 100, commitment: 100, traits: ['LEADER'] }),
    player('high', { overall: 80, morale: 50, commitment: 50 }),
    player('rest', { overall: 50, morale: 0, commitment: 0 }),
  ], { leader: 100 }, 'leader');
  expect(state.managerSupport).toBeGreaterThanOrEqual(60);
  expect(['GOOD', 'NORMAL']).toContain(state.atmosphere);
});
```

- [ ] **Step 6: Implementar coesão, apoio e atmosfera**

Use the approved weights. Empty hierarchy returns neutral support 50. Missing weighted bands fall back to the whole-squad happiness mean. Round final percentages and clamp.

- [ ] **Step 7: Acrescentar testes RED para opções e efeitos de preleção**

```ts
describe('team talks', () => {
  const squad = [
    player('leader', { age: 30, morale: 70, commitment: 70, traits: ['LEADER'] }),
    player('young', { age: 20, morale: 40 }),
    player('plain'),
  ];

  it('returns stable options for every context', () => {
    expect(getAvailableTeamTalks('HALF_TIME', -1, true).map((o) => o.id)).toEqual([
      'HALF_TIME:CALM', 'HALF_TIME:PASSIONATE', 'HALF_TIME:DEMANDING', 'HALF_TIME:ENCOURAGING',
    ]);
  });

  it.each([
    ['PASSIONATE', { leader: 8, young: 4, plain: 4 }],
    ['CALM', { leader: 2, young: 6, plain: 2 }],
    ['ENCOURAGING', { leader: 8, young: 8, plain: 8 }],
  ] as const)('applies %s exactly', (tone, expected) => {
    const option = getAvailableTeamTalks('HALF_TIME', -1, false).find((o) => o.tone === tone)!;
    expect(applyTeamTalk(squad, option, 'HALF_TIME', -1, () => 0).moraleModifiers).toEqual(expected);
  });

  it('makes demanding rebound when support is below 50', () => {
    const lowSupport = squad.map((p) => ({ ...p, commitment: 30 }));
    const option = getAvailableTeamTalks('PRE_MATCH', 1, false).find((o) => o.tone === 'DEMANDING')!;
    expect(new Set(Object.values(applyTeamTalk(lowSupport, option, 'PRE_MATCH', 1, () => 0.9).moraleModifiers))).toEqual(new Set([-6]));
  });
});
```

- [ ] **Step 8: Implementar opções, efeitos e reação determinística**

Validate that `selectedOption.id === `${context}:${selectedOption.tone}``; otherwise throw `Error('Preleção inválida para este contexto')`. Keep option order fixed. Consume exactly one RNG value per call for reaction. Return Portuguese messages keyed by reaction.

- [ ] **Step 9: Testar e implementar happiness tick sem mutação**

```ts
it('penalizes missing appearances, emits elite concern and keeps input immutable', () => {
  const squad = [player('star', { overall: 82, morale: 52, commitment: 52 }), player('used')];
  const result = evaluateSquadHappinessTick(squad, { star: 0, used: 2 });
  expect(result.updatedSquad[0]).toEqual(expect.objectContaining({ morale: 46, commitment: 46 }));
  expect(result.incidents[0]).toContain('Player star');
  expect(squad[0].morale).toBe(52);
});
```

Implement deltas 0 appearances `-6`, 1 `-3`, >=2 `0`; clamp morale/commitment; incidents only for overall >=78 and final commitment <50.

- [ ] **Step 10: Exportar e validar shared**

Add `export * from './domain/lockerRoom.js';` to `index.ts`, then run:

```sh
npm test -w packages/shared
npm run build -w packages/shared
```

Expected: all PASS.

---

### Task 2: Persistência e serviço do servidor

**Files:**
- Modify: `packages/server/prisma/schema.prisma:17-74`
- Modify: `packages/server/src/db/ensureSchema.ts:112-165`
- Create: `packages/server/src/services/lockerRoomService.ts`
- Create: `packages/server/src/lockerRoomFlow.test.ts`

**Interfaces:**
- Consumes: shared locker-room functions/types, `prisma`, `getClub`, `createRng`.
- Produces:

```ts
getClubLockerRoom(clubId: string): Promise<LockerRoomState>
applyClubTeamTalk(clubId: string, requestingUserId: string, talkId: string, context: TeamTalkContext, scoreDiff?: number): Promise<TeamTalkResult>
resolvePlayerConcern(clubId: string, requestingUserId: string, playerId: string): Promise<LockerRoomState>
```

- [ ] **Step 1: Escrever teste RED da migração**

Extend `ensureSchema.test.ts` or add to `lockerRoomFlow.test.ts`: create/inspect a legacy Club table without `lockerRoomJson`, call `ensureSchema`, and assert `PRAGMA table_info('Club')` contains it with default `'{}'`.

- [ ] **Step 2: Adicionar schema e ensureSchema**

Add:

```prisma
lockerRoomJson String @default("{}")
```

and:

```ts
{ name: 'lockerRoomJson', ddl: `"lockerRoomJson" TEXT NOT NULL DEFAULT '{}'` },
```

Run:

```sh
npm run prisma:generate -w packages/server
npm test -w packages/server -- src/db/ensureSchema.test.ts
```

- [ ] **Step 3: Escrever testes RED do serviço e rotas**

Create a user and club via the established Supertest helpers. Assert:

```ts
const room = await request(app).get(`/clubs/${club.id}/locker-room`).set('Authorization', `Bearer ${token}`);
expect(room.status).toBe(200);
expect(room.body.hierarchy).toHaveLength(club.players.length);

const talkId = 'PRE_MATCH:PASSIONATE';
const talk = await request(app).post(`/clubs/${club.id}/team-talk`).set('Authorization', `Bearer ${token}`)
  .send({ talkId, context: 'PRE_MATCH', scoreDifferential: 0 });
expect(talk.status).toBe(200);
expect(talk.body.moraleModifiers[club.players[0].id]).toBeTypeOf('number');

const forbidden = await request(app).post(`/clubs/${club.id}/team-talk`).set('Authorization', `Bearer ${otherToken}`)
  .send({ talkId, context: 'PRE_MATCH', scoreDifferential: 0 });
expect(forbidden.status).toBe(400);
```

Also reload the club and assert each morale equals `clamp(before + modifier, 0, 100)` and `lockerRoomJson` is non-empty.

- [ ] **Step 4: Implementar parsing, materialização e persistência**

In `lockerRoomService.ts`:

```ts
function parseStoredState(raw: string): Partial<LockerRoomState> {
  try { return JSON.parse(raw) as Partial<LockerRoomState>; } catch { return {}; }
}
```

`getClubLockerRoom` reads Prisma Club, parses `playersJson`, calls `computeLockerRoomHierarchy(players, undefined, captainPlayerId ?? undefined)`, preserves at most 10 stored incidents, and writes healed JSON only when raw state is empty/invalid. `applyClubTeamTalk` validates owner, finds the option from `getAvailableTeamTalks`, seeds `createRng(`${clubId}:${context}:${talkId}:${scoreDiff}`)`, applies/clamps morale, recalculates state and updates `playersJson` plus `lockerRoomJson` in one Prisma update. `resolvePlayerConcern` raises morale/commitment by 8, clamps, removes matching incidents, recalculates and persists.

- [ ] **Step 5: Implementar rotas com validação de trust boundary**

Add to `clubs.ts` after `requireAuth`:

```ts
clubsRouter.get('/:id/locker-room', async (req: AuthedRequest, res) => { /* 200 or 404 */ });
clubsRouter.post('/:id/team-talk', async (req: AuthedRequest, res) => {
  const { talkId, context, scoreDifferential = 0 } = req.body ?? {};
  if (typeof talkId !== 'string' || !['PRE_MATCH', 'HALF_TIME', 'POST_MATCH'].includes(context) || typeof scoreDifferential !== 'number') {
    res.status(400).json({ error: 'Preleção inválida' }); return;
  }
  /* call service with req.userId */
});
```

Map service errors to 400 and missing clubs to 404 following current route patterns.

- [ ] **Step 6: Validar servidor**

```sh
npm test -w packages/server -- src/lockerRoomFlow.test.ts src/db/ensureSchema.test.ts
npm test -w packages/server
npm run build -w packages/server
```

Expected: all PASS.

---

### Task 3: Persistência offline e fachada de API

**Files:**
- Modify: `packages/web/src/api/localEngine.test.ts`
- Modify: `packages/web/src/api/localEngine.ts`
- Modify: `packages/web/src/api/client.ts`

**Interfaces:**
- Consumes: shared domain from Task 1.
- Produces:

```ts
localGetLockerRoom(clubId: string): Promise<LockerRoomState>
localApplyTeamTalk(clubId: string, talkId: string, context: TeamTalkContext, scoreDifferential?: number): Promise<TeamTalkResult>
getLockerRoom(clubId: string): Promise<LockerRoomState>
applyTeamTalk(clubId: string, talkId: string, context: TeamTalkContext, scoreDifferential?: number): Promise<TeamTalkResult>
```

- [ ] **Step 1: Escrever testes RED de healing e leitura**

```ts
it('heals old saves with a locker-room map and derives the club room', async () => {
  const state = loadLocalGameState();
  delete state.lockerRoomStates;
  saveLocalGameState(state);
  await new Promise((resolve) => setTimeout(resolve, 150));
  resetInMemoryGameState();
  const room = await localGetLockerRoom(state.clubs[0].id);
  expect(room.hierarchy).toHaveLength(state.clubs[0].players.length);
  expect(loadLocalGameState().lockerRoomStates?.[state.clubs[0].id]).toBeDefined();
});
```

- [ ] **Step 2: Adicionar estado e healing**

Add optional `lockerRoomStates?: Record<string, LockerRoomState>` to `LocalGameState`, initialize `{}` in new worlds, and set `{}` with `updated = true` in `loadLocalGameState` when absent.

- [ ] **Step 3: Escrever teste RED de preleção e reload**

Generate options through shared `getAvailableTeamTalks`, apply `PASSIONATE`, assert exact deltas, wait for save, reset in-memory state, and assert both player morale and room state survived reload. Also assert a non-owned club rejects with `Error('Você não administra este clube')`.

- [ ] **Step 4: Implementar operações offline**

`localGetLockerRoom` must locate the club or throw, derive from current players/captain, preserve stored incidents and save only when the serialized state changed. `localApplyTeamTalk` validates `ownerId === LOCAL_USER_ID`, finds the shared option, uses `createRng(`${clubId}:${context}:${talkId}:${scoreDifferential}`)`, applies clamped morale, recalculates the room, saves once, and returns the result.

- [ ] **Step 5: Expor API com o mesmo contrato**

In `client.ts`:

```ts
export function getLockerRoom(clubId: string) {
  if (isOfflineMode()) return localEngine.localGetLockerRoom(clubId);
  return request<LockerRoomState>(`/clubs/${clubId}/locker-room`);
}

export function applyTeamTalk(clubId: string, talkId: string, context: TeamTalkContext, scoreDifferential = 0) {
  if (isOfflineMode()) return localEngine.localApplyTeamTalk(clubId, talkId, context, scoreDifferential);
  return request<TeamTalkResult>(`/clubs/${clubId}/team-talk`, {
    method: 'POST', body: JSON.stringify({ talkId, context, scoreDifferential }),
  });
}
```

Do not silently fall back from online mutation to offline.

- [ ] **Step 6: Validar offline**

```sh
npm test -w packages/web -- src/api/localEngine.test.ts
```

Expected: all PASS.

---

### Task 4: Página de vestiário e navegação

**Files:**
- Create: `packages/web/src/pages/LockerRoom.test.tsx`
- Create: `packages/web/src/pages/LockerRoom.tsx`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/lib/clubNavigation.ts`
- Modify: `packages/web/src/lib/clubNavigation.test.ts`
- Modify: `packages/web/src/styles.css`

**Interfaces:**
- Consumes: `getClub`, `getLockerRoom`, `ClubNav`, `HubSubnav`, `LockerRoomState`.
- Produces: `LockerRoomPage`, route `/clubs/:clubId/locker-room`, destination/tab `lockerRoom`.

- [ ] **Step 1: Escrever testes RED de navegação e página**

Extend navigation tests to assert `clubPath('c1', 'lockerRoom') === '/clubs/c1/locker-room'` and that team hub contains label `Vestiário`. For the page, use `renderToStaticMarkup`:

```tsx
const html = renderToStaticMarkup(<LockerRoomView club={club} state={state} />);
expect(html).toContain('Coesão do Elenco');
expect(html).toContain('Apoio ao Técnico');
expect(html).toContain('Líderes de Equipe');
expect(html).toContain('Insatisfeito com poucos minutos');
expect(html).toContain('role="progressbar"');
```

- [ ] **Step 2: Implementar destino, rota e carregamento**

Add `'lockerRoom'` to `ClubDestination` and `ClubTab`; add it to the desktop squad matches, mobile drawer and `HUB_SUBNAV_ITEMS.team`. Register in `App.tsx` under `RequireAuth`. Page loads club and room in one `Promise.all`, renders loading/error states, and passes `active="lockerRoom"`.

- [ ] **Step 3: Implementar Stadium Night responsivo**

Use semantic sections and CSS classes prefixed `locker-room-`. Render two `role="progressbar"` meters with `aria-valuenow`, atmosphere badge, four tier sections, four social group chips, concern banner, and last 10 incidents. Gold glow only for leaders, blue glow for highly influential. Add `@media (max-width: 768px)` and `prefers-reduced-motion` if any animation is used.

- [ ] **Step 4: Validar página e navegação**

```sh
npm test -w packages/web -- src/pages/LockerRoom.test.tsx src/lib/clubNavigation.test.ts
```

Expected: all PASS.

---

### Task 5: Card de preleção no pré-jogo e intervalo

**Files:**
- Create: `packages/web/src/components/TeamTalkCard.test.tsx`
- Create: `packages/web/src/components/TeamTalkCard.tsx`
- Modify: `packages/web/src/pages/MatchBriefing.tsx`
- Modify: `packages/web/src/components/LiveTacticalModal.tsx`
- Modify: `packages/web/src/pages/LiveMatch.tsx`
- Modify: `packages/web/src/styles.css`

**Interfaces:**
- Consumes: shared `getAvailableTeamTalks`, client `applyTeamTalk`, `TeamTalkContext`, `TeamTalkResult`.
- Produces:

```ts
interface TeamTalkCardProps {
  clubId: string;
  context: TeamTalkContext;
  scoreDifferential: number;
  isDerbyOrFinal?: boolean;
  onApplied?: (result: TeamTalkResult) => void;
}
```

- [ ] **Step 1: Escrever teste RED do card**

Render with an optional injected `submitTalk = applyTeamTalk` prop for tests. Assert four labeled buttons, one API call with exact payload, buttons disabled while submitting/after success, and `aria-live="polite"` feedback containing the reaction.

- [ ] **Step 2: Implementar card reutilizável**

Render options from shared `getAvailableTeamTalks`. Keep selected/busy/result/error local. Button click calls client `applyTeamTalk`; after success render Portuguese labels for `INSPIRED`, `FOCUSED`, `INDIFFERENT`, `PRESSURE_OVERWHELMED` and invoke `onApplied`. Do not expose raw enum labels as primary copy.

- [ ] **Step 3: Integrar pré-jogo**

In `MatchBriefing`, render `TeamTalkCard` once club/opponent/entry exist, with context `PRE_MATCH`, differential `0`, and `isDerbyOrFinal` derived from `entry.stageName` containing `Final` (case-insensitive). The kickoff remains available; preleção is optional.

- [ ] **Step 4: Integrar intervalo antes da retomada**

Add optional `halftimeTeamTalk?: ReactNode` to `LiveTacticalModalProps` and render it only when `mode === 'halftime'`. In `LiveMatch`, construct:

```tsx
<TeamTalkCard
  clubId={myClub.id}
  context="HALF_TIME"
  scoreDifferential={mySide === 'home' ? match.live.homeGoals - match.live.awayGoals : match.live.awayGoals - match.live.homeGoals}
/>
```

Pass it to the modal. The next `advanceLiveMatch` reloads clubs server-side/offline state and therefore consumes updated morale in the second-half strength calculation.

- [ ] **Step 5: Validar integrações**

```sh
npm test -w packages/web -- src/components/TeamTalkCard.test.tsx src/pages/LockerRoom.test.tsx
```

Expected: all PASS.

---

### Task 6: Revisão e homologação global

**Files:**
- Review all files from Tasks 1–5.

**Interfaces:**
- Consumes: completed shared/server/web implementation.
- Produces: verified Passo 4.

- [ ] **Step 1: Revisar TypeScript, React e segurança**

Check: no unsafe parsing without fallback; mutators validate ownership; online mutations do not fall back offline; no mutation of pure-domain input; no duplicate match-strength multiplier; loading/error states and accessible controls exist.

- [ ] **Step 2: Rodar validação solicitada**

```sh
npm test -w packages/shared
npm test -w packages/server
npm test -w packages/web
npm run build -w packages/web
```

Expected: exit 0 for every command.

- [ ] **Step 3: Rodar suíte global**

```sh
npm test
```

Expected: exit 0, zero failures.

- [ ] **Step 4: Registrar limitações deliberadas**

Report: social groups use deterministic heuristics because the approved hierarchy signature lacks club country/academy provenance; appearance dissatisfaction consumes a caller-provided window because no career-wide appearance ledger exists; post-match talk is domain/API-ready but UI is scoped to pre-match and halftime as requested.
