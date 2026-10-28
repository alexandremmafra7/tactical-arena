# Tactical Engine Phase 2 Design

**Date:** 2026-09-10
**Status:** Approved
**Scope:** Post-loss transitions and rest-defence structures in the shared match engine

## Objective

Add explicit, persistent tactical choices for defensive transition and preventive defensive structure without replacing the match engine's calibrated per-minute probability model with a possession state machine.

The implementation must provide observable differences between counterpressing and recomposition, model the one-turn cost of a failed counterpress, distinguish the central stability of a 3+2 from the territorial control and flank exposure of a 2+3, preserve deterministic and resumable simulation, and remain compatible with old saved tactics.

## Constraints

- `simulateMatchSegment` currently resolves independent per-minute sequences rather than tracking a single ball owner.
- The deterministic RNG stream must remain reproducible across one-shot and segmented simulations.
- Free placement must override formation slot positions through `effectiveSlotPositions`.
- Players no longer on the pitch must not contribute to rest defence or collective transition attributes.
- Existing saved tactics lack the new fields and must continue to load with meaningful defaults.
- Existing match tactics are stored as JSON, while saved `TacticPreset` records use explicit Prisma columns.
- Phase 2 must not introduce a full possession state machine, new player attributes, or Phase 3 squad-chemistry persistence.

## Domain Model

### Transition style

```ts
export type TransitionStyle = 'COUNTERPRESS' | 'RECOMPOSE';
```

`Tactic` and `TacticPreset` receive an optional `transitionStyle` field. `transitionStyleOf(tactic)` provides backward compatibility:

- explicit value wins;
- otherwise `HIGH_PRESS` combined with attacking mentality resolves to `COUNTERPRESS`;
- all other old tactics resolve to `RECOMPOSE`.

This preserves the requested "COUNTERPRESS (or HIGH_PRESS with aggressive style)" behavior without making all high pressing teams counterpress automatically.

### Rest-defence shape

```ts
export type RestDefenceShape = '3+2' | '2+3';
```

`Tactic` and `TacticPreset` receive an optional `restDefenceShape` field. `restDefenceShapeOf(tactic)` defaults old tactics to `3+2`, the safer and least surprising defensive structure.

Both fields are added to canonical presets where the intended identity is clear, and to tactic creation/preset persistence paths. Match tactic JSON needs no database migration. Saved presets require Prisma schema, self-healing DDL, write mapping and read fallback updates.

## Collective Attribute Model

No new raw player attributes are added.

- **Teamwork:** derived from player commitment, with small adjustments for `LEADER` and `UNDISCIPLINED` traits.
- **Anticipation:** existing `DetailedAttribute.ANTICIPATION`.
- **First touch:** existing `DetailedAttribute.BALL_CONTROL`, whose current meaning already includes receiving and protecting the ball under pressure.
- **Composure:** derived from morale, fatigue and personality traits, following the existing derived-stat precedent used by penalty resolution.

Only active on-pitch players are averaged. Values are normalized to the same 1–99 range before comparison.

## Rest-Defence Compatibility

`teamStrength.ts` exposes a pure calculation over effective on-pitch entries. It returns both tactical modifiers and a compatibility score so tests and future UI can explain the result.

### 3+2

The compatible structure requires:

- at least three base defenders, where `DEF` counts directly and a `LAT` can supply the third base defender; and
- at least two midfield protectors, recognized by `VOLANTE` function or sufficient defending/positioning attributes.

Effects at full compatibility:

- strongest reduction to central counterattack exposure;
- neutral territorial retention;
- modest general transition stability.

Partial structures interpolate toward neutral rather than failing validation.

### 2+3

The compatible structure requires:

- at least two `DEF` base defenders; and
- at least three containment players drawn from midfield protectors and laterals positioned to support midfield containment.

Effects at full compatibility:

- improved territorial retention/chance creation;
- neutral-to-good central resistance;
- explicit vulnerability multiplier against fast flank transitions.

Partial structures again interpolate toward neutral. Neither selection makes a lineup illegal.

`TeamStrength` carries the resulting rest-defence modifiers so `engine.ts` can apply them to the correct event context rather than baking every effect into raw attack or defense.

## Per-Turn Post-Loss Transition

The existing per-minute loop remains intact. Each side's offensive sequence is treated as a possession sequence whose end opens the five-second post-loss window.

For each side and minute:

1. The attacking sequence is resolved using the existing chance probability.
2. The losing side's transition style is resolved.
3. `RECOMPOSE` returns to the base block without a counterpress roll or disorganization risk.
4. `COUNTERPRESS` makes one deterministic RNG roll comparing:
   - pressing team's teamwork + anticipation;
   - receiving team's first touch + composure;
   - current fatigue and rest-defence compatibility as bounded adjustments.
5. A success records an advanced recovery and resolves one immediate rapid chance with a small xG/conversion bonus.
6. A failure marks the pressing team as disorganized for exactly the opponent's next offensive sequence.
7. That next sequence receives a bounded counterattack chance bonus. The marker is then consumed, whether or not a chance is produced.

To preserve deterministic RNG ordering, transition resolution consumes a fixed number of RNG draws per side per minute. Non-counterpress branches discard the corresponding roll rather than conditionally shortening the RNG stream.

## Temporary State and Resumability

Unlike red-card settling, the one-turn disorganization state cannot be reliably reconstructed from only a minute number when segment boundaries split the match. It is therefore explicit segment state.

`SimulateMatchSegmentInput` and `MatchSegmentResult` carry:

- pending home/away disorganization flags;
- home/away advanced counterpress recovery totals;
- home/away failed counterpress totals.

`simulateMatch` threads these values through first half, stoppage time, second half and final stoppage exactly as it already threads scores, cards, fatigue and pressing recoveries.

The public match result remains backward-compatible unless an existing statistics structure already has an appropriate place for the new counters. Phase 4 owns causal post-match reporting, so Phase 2 does not add UI-facing report fields solely for future use.

## Probability Bounds and Calibration

The counterpress success probability is a bounded normalized comparison centered around 50% for equal collective attributes. Initial limits:

- minimum: 15%;
- maximum: 75%;
- equal teams: approximately 45–50%, before fatigue/rest-defence adjustments.

The rapid chance and disorganization multipliers remain deliberately modest so they create tactical identity without invalidating the engine's realism floor:

- advanced-recovery rapid chance: small additive/bounded chance with a modest xG bonus;
- one-turn disorganization: bounded increase to the opponent's counterattack chance;
- 3+2 reduces central transition exposure;
- 2+3 improves territorial chance generation but increases flank-transition exposure.

Exact constants are implementation calibration values and must be asserted behaviorally rather than by duplicating formulas in statistical tests.

## Error Handling and Backward Compatibility

- Unknown/missing transition style resolves through `transitionStyleOf`.
- Unknown/missing rest-defence shape resolves through `restDefenceShapeOf`.
- Missing detailed attributes use the project's existing detailed-attribute defaults.
- Empty on-pitch groups produce neutral modifiers instead of `NaN` or division by zero.
- New preset columns use defaults in both Prisma schema and `ensureSchema` migrations.
- Existing serialized match tactics continue to work because the fields are optional.

## Testing Strategy

### `teamStrength.test.ts`

- full and partial 3+2 compatibility;
- full and partial 2+3 compatibility;
- free placement overrides formation;
- off-pitch players stop contributing;
- 3+2 yields stronger central transition protection;
- 2+3 yields stronger territorial retention and greater flank vulnerability;
- missing fields use backward-compatible defaults.

### `engine.test.ts`

- controlled RNG forces a Counterpress success and produces advanced recovery/rapid chance behavior;
- controlled RNG forces failure and applies vulnerability to exactly one subsequent opponent turn;
- recomposition never creates disorganization;
- equal strong collective attributes outperform weak ones over deterministic batches;
- HIGH_PRESS + attacking fallback activates Counterpress for old tactics;
- segmented simulation is identical to uninterrupted simulation, including pending disorganization and transition counters;
- fixed seed remains deterministic.

### Persistence tests

Because the controls are explicitly persistent, existing server preset tests must verify save/read/default behavior and migration defaults. These are required even though the user's minimum validation command targets `packages/shared`.

## Validation

Required gates:

```text
npm run test:shared
npm run build -w packages/shared
```

Because persistence files are part of the approved model, focused server preset/schema tests and the server TypeScript build must also pass before completion. A full monorepo run is optional unless changes propagate failures outside those scopes.

## Out of Scope

- Full ball-possession state machine or sub-minute simulation.
- New raw `TEAMWORK`, `FIRST_TOUCH` or `COMPOSURE` player attributes.
- Phase 3 chemistry persistence or active detailed player roles.
- Phase 4 post-match causal cards and visual controls.
- Recalibration of all global goal/card targets beyond regression protection for the new mechanics.
