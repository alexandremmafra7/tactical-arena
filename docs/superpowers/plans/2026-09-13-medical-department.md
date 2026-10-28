# Medical Department Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar cálculo preditivo de risco, reabilitação delegada com notificações e proteção pré-jogo dos titulares em risco.

**Architecture:** `medicalDepartment.ts` concentra regras puras e resolve a configuração médica a partir do clube. Servidor e motor local continuam responsáveis por persistência e notícias; a troca da escalação fica em um helper puro da web e é acionada por `ClubTacticsPage`.

**Tech Stack:** TypeScript 5.8, React 18, Vitest 2, Prisma 5, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-13-medical-department-design.md`

## Global Constraints

- Preservar exatamente `calculatePlayerInjuryRisk(player, matchStamina = 100, isRain = false)`, `getSquadInjuryAlerts(squad, startingLineupIds)` e `applyAutomatedMedicalCare(club, chiefDoctorRating = 3, mode)`.
- Reutilizar `FITNESS_COACH`; não criar `CHIEF_DOCTOR`, clínica, schema, migração ou dependência.
- `injuryWeeks` permanece inteiro, limitado a zero, e o clube de entrada não pode ser mutado.
- `brasfoot_casual` força `auto_fastest`; configuração ausente usa `DEFAULT_STAFF_DELEGATION_CONFIG`.
- O tick em lote dos bots não pode ler ou gravar elencos.
- Notícias usam `NewsItem.category === 'INJURY'` e a cópia `🏥 Fisioterapia: {nome} teve a recuperação reduzida em X semana(s).`
- O alerta usa literalmente `🏥 Alerta do Médico Chefe: X titulares estão com alto risco de lesão por fadiga acumulada.` e o botão `⚡ Poupar Atletas em Risco`.
- Animação crítica deve desaparecer em `prefers-reduced-motion: reduce`; o indicador estático permanece.
- Seguir TDD em cada tarefa; não adicionar testes que apenas verifiquem imports.

## File Map

- Create `packages/shared/src/domain/medicalDepartment.ts`: risco, alertas, configuração delegada e cuidado puro.
- Create `packages/shared/src/domain/medicalDepartment.test.ts`: contrato completo do domínio.
- Modify `packages/shared/src/index.ts`: API pública.
- Modify `packages/server/src/services/newsService.ts`: publicação de recuperações.
- Modify `packages/server/src/services/matchService.ts`: cuidado pós-partida humano antes da gravação única dos elencos.
- Modify `packages/server/src/services/weeklyTickService.ts`: caminho lento somente para clubes humanos.
- Modify `packages/server/src/newsFlow.test.ts`: integração pós-partida e notícia.
- Modify `packages/server/src/weeklyTickFlow.test.ts`: integração semanal e preservação do caminho bot.
- Create `packages/web/src/lib/protectAtRiskStarters.ts`: troca pura, posicional e determinística.
- Create `packages/web/src/lib/protectAtRiskStarters.test.ts`: cobertura da troca.
- Modify `packages/web/src/api/localEngine.ts`: materialização da lesão e cuidado no encerramento local.
- Modify `packages/web/src/api/offlineAoVivo.test.ts`: persistência e notícia offline.
- Modify `packages/web/src/pages/ClubTactics.tsx`: alerta e ação.
- Modify `packages/web/src/components/PitchField.tsx`: indicador crítico opcional ao lado do fôlego.
- Modify `packages/web/src/styles.css`: alerta e pulso acessível.

---

### Task 1: Implementar o domínio médico compartilhado

**Files:**
- Create: `packages/shared/src/domain/medicalDepartment.test.ts`
- Create: `packages/shared/src/domain/medicalDepartment.ts`
- Modify: `packages/shared/src/index.ts:59-62`

**Interfaces:**
- Consumes: `Player`, `Club`, `StaffDelegationConfig`, `DEFAULT_STAFF_DELEGATION_CONFIG`.
- Produces: `InjuryRiskLevel`, `InjuryRiskResult`, `SquadInjuryAlert`, `MedicalCareMode`, `MedicalRecovery`, `MedicalCareResult`, `MedicalCareSettings`, the three required functions, and `getAutomatedMedicalCareSettings(club)`.

- [ ] **Step 1: Escrever fixtures e testes de risco que falham**

Use `makePlayer` from `../simulation/testFactories.js`; override only relevant fields. Start `medicalDepartment.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { makeClub, makePlayer } from '../simulation/testFactories.js';
import {
  applyAutomatedMedicalCare,
  calculatePlayerInjuryRisk,
  getAutomatedMedicalCareSettings,
  getSquadInjuryAlerts,
} from './medicalDepartment.js';

const resistance = (value: number) => ({
  ...makePlayer('template').detailedAttributes,
  STAMINA: value,
  AEROBIC_STAMINA: value,
  STRENGTH_STAMINA: value,
});

describe('calculatePlayerInjuryRisk', () => {
  const player = makePlayer('risk', { detailedAttributes: resistance(70) });

  it.each([
    [70, 'LOW'],
    [69, 'MODERATE'],
    [50, 'MODERATE'],
    [49, 'HIGH'],
    [30, 'HIGH'],
    [29, 'CRITICAL'],
  ] as const)('classifies stamina %s as %s', (stamina, level) => {
    expect(calculatePlayerInjuryRisk(player, stamina).riskLevel).toBe(level);
  });

  it('uses detailed stamina resistance and adds exactly 12 points for rain', () => {
    const weak = makePlayer('weak', { detailedAttributes: resistance(30) });
    const dry = calculatePlayerInjuryRisk(weak, 60, false);
    const wet = calculatePlayerInjuryRisk(weak, 60, true);
    expect(wet.riskPercentage - dry.riskPercentage).toBe(12);
  });

  it('falls back to general physical resistance for an old save and clamps 0-100', () => {
    const oldSave = makePlayer('old', {
      attributes: { ...player.attributes, physical: 1 },
      detailedAttributes: undefined as never,
    });
    expect(calculatePlayerInjuryRisk(oldSave, -50, true).riskPercentage).toBe(100);
    expect(calculatePlayerInjuryRisk(player, 150).riskPercentage).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar RED**

Run:

```sh
npm test --workspace=@tactical-arena/shared -- src/domain/medicalDepartment.test.ts
```

Expected: FAIL because `medicalDepartment.js` does not exist.

- [ ] **Step 3: Implementar tipos, resistência e risco mínimos**

Create `medicalDepartment.ts` with type-only imports and these rules:

```ts
import type { Club } from './club.js';
import type { Player } from './player.js';
import { DEFAULT_STAFF_DELEGATION_CONFIG } from './staffDelegationConfig.js';

export type InjuryRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type MedicalCareMode = 'auto_fastest' | 'auto_balanced' | 'manual_medical_clinic';

export interface InjuryRiskResult {
  riskPercentage: number;
  riskLevel: InjuryRiskLevel;
  description: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function physicalResistance(player: Player): number {
  const detailed = player.detailedAttributes as Partial<Player['detailedAttributes']> | undefined;
  const values = [detailed?.STAMINA, detailed?.AEROBIC_STAMINA, detailed?.STRENGTH_STAMINA]
    .filter((value): value is number => Number.isFinite(value));
  return clamp(values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : player.attributes.physical, 0, 100);
}
```

Implement the approved table with base risks `10/35/60/85`, adjustment `(50 - resistance) * 0.3`, rain `+12`, 0–100 clamping, and the stamina bucket as the minimum risk level. Keep the Portuguese description factual and deterministic.

- [ ] **Step 4: Executar os testes de risco e confirmar GREEN**

Run the command from Step 2. Expected: risk tests PASS.

- [ ] **Step 5: Acrescentar testes de alertas e cuidado que falham**

Add:

```ts
describe('getSquadInjuryAlerts', () => {
  it('uses 100 - fatigue and distinguishes starters from reserves', () => {
    const starter = makePlayer('starter', { fatigue: 71, detailedAttributes: resistance(70) });
    const reserve = makePlayer('reserve', { fatigue: 60, detailedAttributes: resistance(50) });
    const fresh = makePlayer('fresh', { fatigue: 5, detailedAttributes: resistance(70) });
    const alerts = getSquadInjuryAlerts([starter, reserve, fresh], [starter.id]);
    expect(alerts.map(({ playerId, isStarter }) => ({ playerId, isStarter }))).toEqual([
      { playerId: 'starter', isStarter: true },
      { playerId: 'reserve', isStarter: false },
    ]);
    expect(alerts[0].suggestion).toContain('Poupar');
    expect(alerts[1].suggestion).toContain('descanso');
  });
});

describe('delegated medical care', () => {
  const injuredClub = (rating = 75) => ({
    ...makeClub('medical', 'Medical FC', 70),
    players: [makePlayer('injured', { injuryWeeks: 3 })],
    staff: [{
      id: 'fitness', name: 'Preparador', role: 'FITNESS_COACH' as const,
      tier: 'OURO' as const, rating, specialty: 'Recuperação rápida',
      description: '', wage: 1, minClubVisibility: 0, minCareerTitles: 0,
      avatar: '⚡', nationality: 'BRA',
    }],
  });

  it.each([
    [55, 'auto_balanced', 0], [65, 'auto_balanced', 0], [75, 'auto_balanced', 1],
    [85, 'auto_balanced', 1], [95, 'auto_balanced', 1],
    [55, 'auto_fastest', 1], [65, 'auto_fastest', 1], [75, 'auto_fastest', 1],
    [85, 'auto_fastest', 2], [95, 'auto_fastest', 2],
  ] as const)('maps rating %s in %s to %s week(s)', (rating, mode, reduction) => {
    const club = injuredClub(rating);
    const settings = getAutomatedMedicalCareSettings({
      ...club,
      staffDelegationConfig: { ...DEFAULT_STAFF_DELEGATION_CONFIG, presetMode: 'custom', injuryRehab: mode },
    });
    expect(settings).toEqual({ mode, chiefDoctorRating: Math.floor((rating - 50) / 10) + 1 });
    const result = applyAutomatedMedicalCare(club, settings!.chiefDoctorRating, settings!.mode);
    expect(result.club.players[0].injuryWeeks).toBe(3 - reduction);
  });

  it('makes manual care a no-op and does not mutate the input', () => {
    const club = injuredClub();
    const result = applyAutomatedMedicalCare(club, 5, 'manual_medical_clinic');
    expect(result.club).toBe(club);
    expect(result.recoveries).toEqual([]);
    expect(club.players[0].injuryWeeks).toBe(3);
  });

  it('caps recovery at zero and records only actual integer reductions', () => {
    const club = { ...injuredClub(95), players: [makePlayer('one', { injuryWeeks: 1 }), makePlayer('fit')] };
    const result = applyAutomatedMedicalCare(club, 5, 'auto_fastest');
    expect(result.club.players.map((p) => p.injuryWeeks)).toEqual([0, 0]);
    expect(result.recoveries).toEqual([{ playerId: 'one', playerName: 'Player one', previousInjuryWeeks: 1, injuryWeeks: 0, weeksReduced: 1 }]);
  });

  it('treats a casual preset as auto_fastest and uses rating 3 without a coach', () => {
    const club = { ...injuredClub(), staff: [], staffDelegationConfig: { ...DEFAULT_STAFF_DELEGATION_CONFIG, injuryRehab: 'manual_medical_clinic', presetMode: 'brasfoot_casual' as const } };
    expect(getAutomatedMedicalCareSettings(club)).toEqual({ mode: 'auto_fastest', chiefDoctorRating: 3 });
  });
});
```

Import `DEFAULT_STAFF_DELEGATION_CONFIG` from `./staffDelegationConfig.js` in the test.

- [ ] **Step 6: Implementar alertas, configuração e cuidado mínimos**

Add exact public shapes:

```ts
export interface SquadInjuryAlert extends InjuryRiskResult {
  playerId: string;
  playerName: string;
  isStarter: boolean;
  suggestion: string;
}
export interface MedicalRecovery {
  playerId: string;
  playerName: string;
  previousInjuryWeeks: number;
  injuryWeeks: number;
  weeksReduced: number;
}
export interface MedicalCareResult { club: Club; recoveries: MedicalRecovery[] }
export interface MedicalCareSettings { mode: Exclude<MedicalCareMode, 'manual_medical_clinic'>; chiefDoctorRating: number }
```

Implement:

```ts
export function getAutomatedMedicalCareSettings(club: Club): MedicalCareSettings | null {
  const config = { ...DEFAULT_STAFF_DELEGATION_CONFIG, ...club.staffDelegationConfig };
  const mode = config.presetMode === 'brasfoot_casual' ? 'auto_fastest' : config.injuryRehab;
  if (mode === 'manual_medical_clinic') return null;
  const coach = club.staff?.find((member) => member.role === 'FITNESS_COACH');
  const chiefDoctorRating = coach ? clamp(Math.floor((coach.rating - 50) / 10) + 1, 1, 5) : 3;
  return { mode, chiefDoctorRating };
}
```

`getSquadInjuryAlerts` must call the risk function with `100 - player.fatigue`. `applyAutomatedMedicalCare` uses reduction `0/1` for balanced at ratings `1-2/3-5`, `1/2` for fastest at ratings `1-3/4-5`, maps players immutably, and returns `{ club: { ...club, players }, recoveries }` only when reduction is positive.

- [ ] **Step 7: Exportar e executar os testes compartilhados**

Add to `packages/shared/src/index.ts`:

```ts
export * from './domain/medicalDepartment.js';
```

Run:

```sh
npm test --workspace=@tactical-arena/shared -- src/domain/medicalDepartment.test.ts
npm run build --workspace=@tactical-arena/shared
```

Expected: PASS and successful TypeScript build.

- [ ] **Step 8: Commit**

```sh
git add packages/shared/src/domain/medicalDepartment.ts packages/shared/src/domain/medicalDepartment.test.ts packages/shared/src/index.ts
git commit -m "feat: add medical risk and rehabilitation domain"
```

---

### Task 2: Integrar cuidado pós-partida e notícias no servidor

**Files:**
- Modify: `packages/server/src/services/newsService.ts:1-18,106`
- Modify: `packages/server/src/services/matchService.ts:1-55,188-209,727-767`
- Modify: `packages/server/src/newsFlow.test.ts:1-73`

**Interfaces:**
- Consumes: `getAutomatedMedicalCareSettings`, `applyAutomatedMedicalCare`, `MedicalRecovery` from Task 1.
- Produces: `generateMedicalRecoveryNews(clubId, recoveries)` and `applyPostMatchRosterUpdates(...): Promise<{ homeRecoveries; awayRecoveries }>`.

- [ ] **Step 1: Escrever teste de integração pós-partida que falha**

Extend `newsFlow.test.ts`. After creating a human club, update one non-lineup player to `injuryWeeks: 4` and store a rating-95 fitness coach plus custom `auto_fastest` config in the existing `staffJson` envelope:

```ts
const stored = await prisma.club.findUniqueOrThrow({ where: { id: clubA.id } });
const players = JSON.parse(stored.playersJson);
const patient = players[players.length - 1];
patient.injuryWeeks = 4;
await prisma.club.update({
  where: { id: clubA.id },
  data: {
    playersJson: JSON.stringify(players),
    staffJson: JSON.stringify({
      staff: [{ id: 'doctor', name: 'Fisiologista', role: 'FITNESS_COACH', tier: 'OURO', rating: 95,
        specialty: 'Recuperação rápida', description: '', wage: 1, minClubVisibility: 0,
        minCareerTitles: 0, avatar: '⚡', nationality: 'BRA' }],
      delegationConfig: { presetMode: 'custom', injuryRehab: 'auto_fastest' },
    }),
  },
});
```

Build the XI from the first 11 fit players, finish the match, then assert the patient fell from 4 to 1: one normal match decrement plus two automatic weeks. Filter headlines beginning `🏥 Fisioterapia:` and assert exactly one includes the patient's name and `2 semanas`.

Import `prisma` from `./db/prisma.js`.

- [ ] **Step 2: Executar o teste e confirmar RED**

```sh
npm test --workspace=@tactical-arena/server -- src/newsFlow.test.ts
```

Expected: FAIL because no post-match physiotherapy news exists and recovery is only the normal one-week decrement.

- [ ] **Step 3: Adicionar o publicador de notícias médicas**

In `newsService.ts`, import `MedicalRecovery` as a type and add:

```ts
export async function generateMedicalRecoveryNews(clubId: string, recoveries: MedicalRecovery[]): Promise<void> {
  await Promise.all(recoveries.map((recovery) =>
    recordNews(
      clubId,
      'INJURY',
      `🏥 Fisioterapia: ${recovery.playerName} teve a recuperação reduzida em ${recovery.weeksReduced} semana${recovery.weeksReduced === 1 ? '' : 's'}.`,
    ),
  ));
}
```

- [ ] **Step 4: Aplicar cuidado sem duplicar gravações de elenco**

In `matchService.ts`, import the two domain functions and `MedicalRecovery`; import `generateMedicalRecoveryNews`. Change `applyPostMatchRosterUpdates` to:

1. Compute both rosters once.
2. Form `{ ...homeClub, players: homePlayers }` and `{ ...awayClub, players: awayPlayers }`.
3. For each human club (`ownerId !== BOT_OWNER_ID`), resolve settings and apply care; bots retain the computed roster unchanged.
4. Persist each final roster exactly once.
5. Return both recovery arrays.

Use this return shape:

```ts
Promise<{ homeRecoveries: MedicalRecovery[]; awayRecoveries: MedicalRecovery[] }>
```

At line 727 capture the result, then after `generateMatchNews` publish both medical arrays best-effort:

```ts
await Promise.all([
  generateMedicalRecoveryNews(homeClub.id, medical.homeRecoveries),
  generateMedicalRecoveryNews(awayClub.id, medical.awayRecoveries),
]).catch((err) => console.error('generateMedicalRecoveryNews failed:', err));
```

Do not change `computePostMatchRosters` or `simulateFixtureResultOnly`; the latter serves bot-only background rounds.

- [ ] **Step 5: Executar teste focal e suite do servidor**

```sh
npm test --workspace=@tactical-arena/server -- src/newsFlow.test.ts
npm test --workspace=@tactical-arena/server
```

Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add packages/server/src/services/newsService.ts packages/server/src/services/matchService.ts packages/server/src/newsFlow.test.ts
git commit -m "feat: automate post-match physiotherapy"
```

---

### Task 3: Integrar fisioterapia no tick semanal humano

**Files:**
- Modify: `packages/server/src/services/weeklyTickService.ts:1-20,241-281,412-418`
- Modify: `packages/server/src/weeklyTickFlow.test.ts:1-143`

**Interfaces:**
- Consumes: Task 1 care/settings; Task 2 `generateMedicalRecoveryNews`; existing `getClub`/`toDomainClub`.
- Produces: private `applyDelegatedWeeklyMedicalCare(clubId): Promise<void>` used by both weekly entry points.

- [ ] **Step 1: Escrever testes semanais que falham**

Add two human-club cases to `weeklyTickFlow.test.ts`:

1. `auto_fastest`, rating 95, patient at 4 weeks: after `processWeeklyTickForClub`, expect `injuryWeeks === 1` (one owed weekly decrement + two medical) and exactly one `INJURY` row beginning `🏥 Fisioterapia:`.
2. `manual_medical_clinic`, rating 95, patient at 4 weeks: after the tick, reading via `getClub` returns 3 and the medical headline count is zero.

Write delegation and staff using the `staffJson: JSON.stringify({ staff, delegationConfig })` envelope. Query `prisma.newsItem.findMany({ where: { clubId, category: 'INJURY' } })` directly. Keep the existing `never touches a roster` bot test unchanged.

- [ ] **Step 2: Executar e confirmar RED**

```sh
npm test --workspace=@tactical-arena/server -- src/weeklyTickFlow.test.ts
```

Expected: automatic human case FAIL at recovery/news.

- [ ] **Step 3: Implementar um único caminho lento humano**

Add:

```ts
async function applyDelegatedWeeklyMedicalCare(clubId: string): Promise<void> {
  const club = await getClub(clubId);
  if (club.ownerId === BOT_OWNER_ID) return;
  const settings = getAutomatedMedicalCareSettings(club);
  if (!settings) return;
  const result = applyAutomatedMedicalCare(club, settings.chiefDoctorRating, settings.mode);
  if (result.recoveries.length === 0) return;
  await prisma.club.update({ where: { id: clubId }, data: { playersJson: JSON.stringify(result.club.players) } });
  await generateMedicalRecoveryNews(clubId, result.recoveries).catch((err) =>
    console.error('generateMedicalRecoveryNews weekly failed:', err),
  );
}
```

Import `getClub` beside `toDomainClub`. Call it after the financial update in `processWeeklyTickForClub`. In the whole-world tick, call it in the existing `humanClubs` loop before delegated renewals.

The helper reads the club only after `pendingRestWeeks` is incremented, so `getClub` materializes normal recovery first. A `playersJson` write happens only when additional care occurred and the Prisma extension resets `pendingRestWeeks`. Do not add roster columns to `WEEKLY_COLUMNS` and do not modify `writeWeekInBulk`.

- [ ] **Step 4: Executar testes focal e completo**

```sh
npm test --workspace=@tactical-arena/server -- src/weeklyTickFlow.test.ts
npm test --workspace=@tactical-arena/server
```

Expected: PASS, including byte-for-byte bot roster preservation.

- [ ] **Step 5: Commit**

```sh
git add packages/server/src/services/weeklyTickService.ts packages/server/src/weeklyTickFlow.test.ts
git commit -m "feat: apply delegated weekly rehabilitation"
```

---

### Task 4: Integrar cuidado e notícia no encerramento offline

**Files:**
- Modify: `packages/web/src/api/localEngine.ts:1-55,1452-1689`
- Modify: `packages/web/src/api/offlineAoVivo.test.ts:20-205`

**Interfaces:**
- Consumes: Task 1 settings/care and `MatchEvent.injuryWeeks`.
- Produces: private `applyLocalPostMatchMedicalCare(state, club, events, side): Club`, updating `state.news` once.

- [ ] **Step 1: Escrever teste offline que falha**

In `offlineAoVivo.test.ts`, after `irParaAPartida`, mutate the claimed club in `loadLocalGameState()`:

- Set its last player (outside the default XI) to `injuryWeeks: 4`.
- Add rating-95 `FITNESS_COACH` and custom `auto_fastest` delegation.
- Call `saveLocalGameState(state)`.
- Finish the match through the same loop used by the existing full-time test.
- Assert the saved player's `injuryWeeks === 1` and one `state.news` item starts with `🏥 Fisioterapia:` and includes `2 semanas`.
- Call `localAdvanceLiveMatch(id, 120)` once more and assert the medical headline count remains one.

This tests both treatment and idempotence of repeated reads after the final whistle.

- [ ] **Step 2: Executar e confirmar RED**

```sh
npm test --workspace=@tactical-arena/web -- src/api/offlineAoVivo.test.ts
```

Expected: FAIL because the local engine does not persist injury recovery or medical news.

- [ ] **Step 3: Implementar atualização local mínima**

In `localEngine.ts`, import the Task 1 functions. Add a private helper that:

1. Builds a map from injury events for the given side where `injuryWeeks` is positive.
2. Applies the normal post-match countdown to every existing injury, with fresh event duration taking precedence (same behavior as server `updateInjuries`).
3. Creates `{ ...club, players }` and resolves delegated medical settings.
4. Applies medical care once.
5. Pushes one synthetic `NewsItem` per recovery using deterministic local IDs such as `medical_${matchId}_${playerId}` and `createdAt` from the current game date formatted `YYYY-MM-DDT00:00:00.000Z`.
6. Returns the updated club.

Call it only inside `if (acabou)`, before `fix.result`/`state.liveMatch = null`, for the claimed side. Replace the corresponding entry in `state.clubs`. The existing `if (fix.result) return` guard guarantees a second call cannot repeat treatment. Do not create a local weekly clock.

- [ ] **Step 4: Executar testes focal e completo da web**

```sh
npm test --workspace=@tactical-arena/web -- src/api/offlineAoVivo.test.ts
npm test --workspace=@tactical-arena/web
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add packages/web/src/api/localEngine.ts packages/web/src/api/offlineAoVivo.test.ts
git commit -m "feat: persist offline physiotherapy"
```

---

### Task 5: Implementar a troca pura dos titulares em risco

**Files:**
- Create: `packages/web/src/lib/protectAtRiskStarters.test.ts`
- Create: `packages/web/src/lib/protectAtRiskStarters.ts`

**Interfaces:**
- Consumes: `Player`, slot `Position[]`, starter IDs, bench IDs, `calculatePlayerInjuryRisk`, `isPlayerAvailable`, `pickPlayersForSlots`.
- Produces:

```ts
export interface ProtectedLineup {
  selections: (string | null)[];
  substituteIds: string[];
  replacedCount: number;
}
export function protectAtRiskStarters(
  players: Player[],
  slotPositions: Position[],
  selections: (string | null)[],
  substituteIds: string[],
): ProtectedLineup;
```

- [ ] **Step 1: Escrever testes da troca que falham**

Use `makePlayer` from `@tactical-arena/shared/dist/simulation/testFactories.js` only if the web test resolver permits internal dist paths; otherwise define a local `player(id, position, fatigue, overall)` by spreading one valid player from an offline state. Prefer a small local fixture over `as any`.

Cover:

```ts
it('replaces CRITICAL before HIGH, prefers natural position, then freshness and overall', () => {
  // two risky starters and three fit bench players; assert exact resulting IDs and replacedCount === 2
});

it('keeps the outgoing starter in the incoming player bench index', () => {
  // assert substituteIds length/order and exact swap
});

it('skips a slot with no valid replacement and protects the remaining slots', () => {
  // injured/suspended candidates cannot enter; one other safe swap still occurs
});

it('does not mutate input arrays', () => {
  // snapshot selections/substituteIds, call helper, compare originals
});
```

- [ ] **Step 2: Executar e confirmar RED**

```sh
npm test --workspace=@tactical-arena/web -- src/lib/protectAtRiskStarters.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implementar o helper mínimo**

Algorithm:

1. Compute each selected player's risk from `100 - fatigue`.
2. Sort risky slot indexes by `CRITICAL` before `HIGH`, retaining slot order for ties.
3. For each slot, form remaining available bench players.
4. Use `pickPlayersForSlots(candidates, [slotPosition], 'stamina')[0]`; this reuses the existing natural-position and fallback hierarchy.
5. For candidates with equal fatigue, ensure higher `overall` wins by pre-sorting or a deterministic secondary comparison before selection.
6. Replace the selected ID and replace the incoming ID at the same bench index with the outgoing ID.
7. Return copies and count; never mutate inputs.

- [ ] **Step 4: Executar teste focal**

```sh
npm test --workspace=@tactical-arena/web -- src/lib/protectAtRiskStarters.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add packages/web/src/lib/protectAtRiskStarters.ts packages/web/src/lib/protectAtRiskStarters.test.ts
git commit -m "feat: protect injury-risk starters"
```

---

### Task 6: Adicionar alerta, ação e indicador crítico à tática

**Files:**
- Modify: `packages/web/src/pages/ClubTactics.tsx:1-38,139-162,347-390,492-519`
- Modify: `packages/web/src/components/PitchField.tsx:382-403,701-800`
- Modify: `packages/web/src/styles.css:6137-6143`
- Test: `packages/web/src/lib/protectAtRiskStarters.test.ts`

**Interfaces:**
- Consumes: Task 1 risk/alerts and Task 5 helper.
- Produces: optional `criticalRiskPlayerIds?: ReadonlySet<string>` prop on `PitchField` and visible pre-match controls.

- [ ] **Step 1: Derivar alertas e conectar a ação**

In `ClubTactics.tsx` import `calculatePlayerInjuryRisk`, `getSquadInjuryAlerts`, `FORMATION_POSITIONS`, and `protectAtRiskStarters`.

After `starterPlayers`, derive:

```ts
const injuryAlerts = getSquadInjuryAlerts(club.players, starterIds);
const starterInjuryAlerts = injuryAlerts.filter((alert) => alert.isStarter);
const criticalRiskPlayerIds = new Set(
  starterInjuryAlerts.filter((alert) => alert.riskLevel === 'CRITICAL').map((alert) => alert.playerId),
);
const protectedPreview = protectAtRiskStarters(
  club.players,
  FORMATION_POSITIONS[formation],
  selections,
  substituteIds,
);
```

Add a handler that uses `protectedPreview`, sets both state arrays, and reports `"X titular(es) poupado(s) pelo departamento médico."`. Disable the action when `replacedCount === 0`.

- [ ] **Step 2: Renderizar o alerta com semântica acessível**

Place it after existing error/success alerts and before the zero-scroll container:

```tsx
{starterInjuryAlerts.length > 0 && (
  <div className="medical-risk-alert" role="alert">
    <span>🏥 Alerta do Médico Chefe: {starterInjuryAlerts.length} titulares estão com alto risco de lesão por fadiga acumulada.</span>
    <button type="button" onClick={handleProtectAtRiskPlayers} disabled={protectedPreview.replacedCount === 0}>
      ⚡ Poupar Atletas em Risco
    </button>
  </div>
)}
```

If disabled, set `title="Nenhum reserva apto pode substituir os titulares em risco."`.

- [ ] **Step 3: Mostrar criticidade junto ao fôlego no campo**

Add `criticalRiskPlayerIds` to `PitchFieldProps`, pass it from `ClubTactics`, and change the pitch legend stamina span to append:

```tsx
{criticalRiskPlayerIds?.has(selectedPlayer.id) && (
  <span className="medical-critical-badge" aria-label="Risco crítico de lesão" title="Risco crítico de lesão">!</span>
)}
```

Keep the percentage visible. Do not make `PitchField` recalculate medical risk.

- [ ] **Step 4: Adicionar CSS responsivo e movimento reduzido**

Add styles in `styles.css` using existing tokens/colors. Required rules:

```css
.medical-risk-alert { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.medical-critical-badge { display: inline-grid; place-items: center; animation: medical-danger-pulse 1.5s ease-in-out infinite; }
@keyframes medical-danger-pulse { 50% { opacity: .55; box-shadow: 0 0 0 .25rem rgba(239,68,68,.18); } }
@media (prefers-reduced-motion: reduce) { .medical-critical-badge { animation: none; } }
@media (max-width: 700px) { .medical-risk-alert { align-items: stretch; flex-direction: column; } }
```

Fill visual properties with the existing warning palette; ensure focus-visible styling is inherited or explicitly visible.

- [ ] **Step 5: Executar testes e build da web**

```sh
npm test --workspace=@tactical-arena/web -- src/lib/protectAtRiskStarters.test.ts
npm run build --workspace=@tactical-arena/web
```

Expected: PASS and successful Vite build.

- [ ] **Step 6: Commit**

```sh
git add packages/web/src/pages/ClubTactics.tsx packages/web/src/components/PitchField.tsx packages/web/src/styles.css
git commit -m "feat: warn and rest injury-risk starters"
```

---

### Task 7: Verificação e revisões obrigatórias

**Files:**
- Modify only files required by verified review findings.

**Interfaces:**
- Consumes: complete feature.
- Produces: green monorepo and reviewed TypeScript/React implementation.

- [ ] **Step 1: Executar a verificação requerida pelo pedido**

```sh
npm test
npm run build --workspace=@tactical-arena/web
```

Expected: all shared, web, and server tests PASS; web build succeeds. Record exact failures rather than masking them.

- [ ] **Step 2: Resolver build React somente se necessário**

If the React build fails, invoke the mandatory React build resolver, apply only verified minimal fixes, then rerun both commands from Step 1.

- [ ] **Step 3: Fazer as revisões obrigatórias**

Run the mandatory TypeScript, React, and general code reviewers against the changed files. Verify every finding against current source before editing. Pay special attention to:

- treatment applied exactly once per transition;
- no bot roster materialization during world ticks;
- stale React closures/state ordering in the one-click swap;
- reduced-motion and alert semantics;
- integer and immutable recovery behavior;
- duplicate or misleading medical news.

- [ ] **Step 4: Aplicar achados confirmados e reverificar**

For each confirmed finding, add or adjust the smallest regression test first, observe failure, apply the fix, and rerun:

```sh
npm test
npm run build --workspace=@tactical-arena/web
```

Expected: PASS.

- [ ] **Step 5: Commit final de correções, se houver**

```sh
git add packages/shared packages/server packages/web
git commit -m "fix: address medical department review findings"
```

Skip this commit when no file changed. Do not create an empty verification commit.
