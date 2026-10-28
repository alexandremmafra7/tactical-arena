# 2D Live Match Pitch Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate an interactive 2D top-down pitch visualizer component (`PitchVisualizer.tsx`) that reflects live match flow, momentum, and discrete match events (shots, goals, saves, fouls, woodwork) with responsive vector rendering and synchronized WebAudio sound effects in `LiveMatch.tsx`.

**Architecture:** SVG-based pitch with layered rendering (grass & line markings, 3 territorial pressure zones, 22 formation-anchored player nodes, dynamic ball with trajectory & bounce elevation, and VFX overlays). State is driven by current match minute, momentum score, and active/recent `MatchEvent` items, linked with zero-latency SFX triggers.

**Tech Stack:** React 18, TypeScript, SVG/CSS hardware acceleration, Vitest + React DOM Server, Web Audio API (`soundEffects.ts`).

**Spec:** Passo 6 architectural design approved by user.

## Global Constraints

- Absolute paths for file operations.
- Always communicate in PT-BR in descriptions and UI labels.
- Zero external runtime heavy game engines (no Phaser/Pixi). Lightweight SVG + CSS.
- Full compatibility with all 4 speed settings (`slow`, `normal`, `fast`, `superfast`).

---

### Task 1: Create `PitchVisualizer.tsx` Component Core

**Files:**
- Create: `D:\Code\elifoot-reforged\packages\web\src\components\PitchVisualizer.tsx`
- Test: `D:\Code\elifoot-reforged\packages\web\src\components\PitchVisualizer.test.tsx`

**Interfaces:**
- Consumes:
  - `MatchEvent`, `MatchSide`, `Tactic`, `Club` from `@tactical-arena/shared`
  - `soundFx` from `../lib/soundEffects.js`
- Produces:
  - `PitchVisualizer` component accepting props:
    ```typescript
    export interface PitchVisualizerProps {
      homeClub: { id: string; name: string; slug?: string | null };
      awayClub: { id: string; name: string; slug?: string | null };
      homeTactic?: Tactic | null;
      awayTactic?: Tactic | null;
      mySide?: MatchSide | null;
      events: MatchEvent[];
      currentMinute: number;
      momentum: number; // 0 to 100 (Home momentum)
      isPaused: boolean;
      speedKey?: 'slow' | 'normal' | 'fast' | 'superfast';
      homeGoals: number;
      awayGoals: number;
    }
    ```

- [x] **Step 1: Write the failing test**
Create `packages/web/src/components/PitchVisualizer.test.tsx` testing basic rendering, territory zone highlights, event visual translation, and ball positioning.

- [x] **Step 2: Run test to verify it fails**
Run: `npx vitest run packages/web/src/components/PitchVisualizer.test.tsx`
Expected: FAIL due to missing component.

- [x] **Step 3: Implement `PitchVisualizer.tsx`**
Implement the component with SVG layers (turf, lines, 3 zones, team dots based on formations, ball movement calculation, and action banner).

- [x] **Step 4: Run test to verify it passes**
Run: `npx vitest run packages/web/src/components/PitchVisualizer.test.tsx`
Expected: PASS.

---

### Task 2: Add CSS Styles for 2D Pitch Visualizer in `styles.css`

**Files:**
- Modify: `D:\Code\elifoot-reforged\packages\web\src\styles.css`

**Interfaces:**
- Produces CSS classes: `.pitch-visualizer-container`, `.pitch-visualizer-svg`, `.pitch-vfx-flash`, `.pitch-zone-active`, `.pitch-ball-node`, `.pitch-player-node`, `.pitch-visualizer-badge`.

- [x] **Step 1: Write CSS classes in `styles.css`**
Add scoped styling for smooth ball trajectory transitions, turf lighting, goal pulse effects, and radar territory indicators.

- [x] **Step 2: Verify CSS validity and build**
Run: `npm run build -w packages/web` or test render.

---

### Task 3: Integrate `PitchVisualizer` into `LiveMatch.tsx` with Sound Triggers

**Files:**
- Modify: `D:\Code\elifoot-reforged\packages\web\src\pages\LiveMatch.tsx`

**Interfaces:**
- Replace the legacy static radar block with `<PitchVisualizer />`
- Connect event sound triggers (`playBallKick`, `playGoalCheer`, `playWhistle`) directly to visualizer state changes.

- [x] **Step 1: Update `LiveMatch.tsx` to render `PitchVisualizer`**
Mount `PitchVisualizer` in the main match view column.

- [x] **Step 2: Run all web package tests**
Run: `npm test -w packages/web`
Expected: All tests pass.

---
