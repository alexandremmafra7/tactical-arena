import { useState, useEffect, useRef } from 'react';
import {
  FORMATION_POSITIONS,
  FUNCTIONS_BY_POSITION,
  positionFromPitchPoint,
  positionMismatchFactor,
  calculateInMatchStamina,
  getPlayerTier,
  findCriticalPartnerships,
  calculateSquadPartnershipSynergy,
  autoAssignBestRolesForPlayer,
  PLAYER_ROLE_MODIFIERS,
  getDynamicTacticalRole,
  type Formation,
  type Player,
  type PlayerFunction,
  type PlayerRole,
  type Position,
  type DefensiveLineHeight,
  type AttackStyle,
  type PressingIntensity,
  type PartnershipPair,
  type PartnershipLevel,
  type PartnershipSector,
  type LineupSlotWithPlayer,
  defensiveLineOf,
} from '@tactical-arena/shared';
import { positionLabel } from '../lib/positionLabel.js';
import { footLabel } from '../lib/footLabel.js';
import { PlayerStatusMarks } from './PlayerStatusMarks.js';
import { TeamJersey } from './TeamJersey.js';
import {
  TacticsIcon,
  EyeIcon,
  ShieldIcon,
  LightningIcon,
  SoccerBallIcon,
  StarIcon,
  AlertTriangleIcon,
  UsersIcon,
} from './icons/AppIcons.js';

/** Native HTML5 drag-and-drop keys shared with any external drag source (e.g. a bench `PlayerChip`) that
 *  wants to be droppable onto a pitch slot — see `Tactic.tsx`/`ClubTactics.tsx`/`LiveMatch.tsx`. */
export const DND_PLAYER_ID = 'application/x-tactical-arena-player-id';
export const DND_PLAYER_POSITION = 'application/x-tactical-arena-player-position';
export const DND_SOURCE_SLOT = 'application/x-tactical-arena-source-slot';

/**
 * A real, physically-dragged native HTML5 drag (as opposed to a synthetically-dispatched `DragEvent`)
 * does NOT reliably expose `dataTransfer.getData()` VALUES during `dragover` — only `.types` (the list of
 * MIME-type keys) is guaranteed available mid-drag; reading the actual value is only reliable once `drop`
 * fires. Gating `dragover`'s `preventDefault()` on a value read from `getData()` therefore silently never
 * allows the drop in real usage, even though it works when a test dispatches DragEvents by hand. Since a
 * drag never leaves this single page, a plain module-level variable set synchronously at `dragstart` sidesteps
 * the whole problem — read directly during `dragover`, no `dataTransfer` round-trip involved. `drop` still
 * double-checks via `getData()` (always reliable there) before actually placing anyone. */
let draggedPlayerPosition: Position | null = null;
export function setDraggedPlayerPosition(position: Position | null): void {
  draggedPlayerPosition = position;
}

interface Slot {
  position: Position;
  x: number;
  y: number;
}

// Coordinates are percentages of the pitch box; y=0 is the opponent's goal line, y=100 is our own. Each
// formation's `.position` per index comes from the shared `FORMATION_POSITIONS` (the same list the
// simulation's positional-mismatch handicap keys off of — see teamStrength.ts) so the two can never drift;
// only the x/y layout is a web-only rendering concern.
const FORMATION_COORDS: Record<Formation, { x: number; y: number }[]> = {
  '4-4-2': [
    { x: 50, y: 86 }, // GK
    { x: 12, y: 66 }, // LB
    { x: 36, y: 72 }, // LCB (staggered back)
    { x: 64, y: 64 }, // RCB (staggered forward)
    { x: 88, y: 66 }, // RB
    { x: 12, y: 44 }, // LM
    { x: 36, y: 51 }, // LCM (staggered lower)
    { x: 64, y: 37 }, // RCM (staggered higher)
    { x: 88, y: 44 }, // RM
    { x: 34, y: 19 }, // LS
    { x: 66, y: 15 }, // RS (staggered)
  ],
  '4-3-3': [
    { x: 50, y: 86 },
    { x: 12, y: 66 },
    { x: 36, y: 72 },
    { x: 64, y: 64 },
    { x: 88, y: 66 },
    { x: 26, y: 45 },
    { x: 50, y: 55 },
    { x: 74, y: 45 },
    { x: 16, y: 19 },
    { x: 50, y: 14 },
    { x: 84, y: 19 },
  ],
  '3-5-2': [
    { x: 50, y: 86 },
    { x: 24, y: 68 },
    { x: 50, y: 73 },
    { x: 76, y: 68 },
    { x: 10, y: 46 },
    { x: 28, y: 53 },
    { x: 50, y: 39 },
    { x: 72, y: 53 },
    { x: 90, y: 46 },
    { x: 34, y: 19 },
    { x: 66, y: 15 },
  ],
  '5-3-2': [
    { x: 50, y: 86 },
    { x: 10, y: 63 },
    { x: 28, y: 70 },
    { x: 50, y: 74 },
    { x: 72, y: 70 },
    { x: 90, y: 63 },
    { x: 28, y: 44 },
    { x: 50, y: 52 },
    { x: 72, y: 44 },
    { x: 34, y: 19 },
    { x: 66, y: 15 },
  ],
  '4-2-3-1': [
    { x: 50, y: 86 },
    { x: 11, y: 69 },
    { x: 37, y: 72 },
    { x: 63, y: 67 },
    { x: 89, y: 69 },
    { x: 34, y: 56 },
    { x: 66, y: 52 },
    { x: 14, y: 36 },
    { x: 50, y: 33 },
    { x: 86, y: 36 },
    { x: 50, y: 13 },
  ],
  '4-1-4-1': [
    { x: 50, y: 86 },
    { x: 12, y: 68 },
    { x: 36, y: 72 },
    { x: 64, y: 66 },
    { x: 88, y: 68 },
    { x: 50, y: 57 },
    { x: 12, y: 40 },
    { x: 36, y: 46 },
    { x: 64, y: 34 },
    { x: 88, y: 40 },
    { x: 50, y: 14 },
  ],
  '3-4-3': [
    { x: 50, y: 86 },
    { x: 25, y: 68 },
    { x: 50, y: 70 },
    { x: 75, y: 68 },
    { x: 14, y: 46 },
    { x: 38, y: 48 },
    { x: 62, y: 48 },
    { x: 86, y: 46 },
    { x: 18, y: 18 },
    { x: 50, y: 14 },
    { x: 82, y: 18 },
  ],
  '4-4-1': [
    { x: 50, y: 86 },
    { x: 14, y: 66 },
    { x: 38, y: 68 },
    { x: 62, y: 68 },
    { x: 86, y: 66 },
    { x: 14, y: 44 },
    { x: 38, y: 46 },
    { x: 62, y: 46 },
    { x: 86, y: 44 },
    { x: 50, y: 16 },
  ],
  '5-3-1': [
    { x: 50, y: 86 },
    { x: 10, y: 66 },
    { x: 28, y: 68 },
    { x: 50, y: 70 },
    { x: 72, y: 68 },
    { x: 90, y: 66 },
    { x: 30, y: 46 },
    { x: 50, y: 48 },
    { x: 70, y: 46 },
    { x: 50, y: 16 },
  ],
  '4-3-2': [
    { x: 50, y: 86 },
    { x: 14, y: 66 },
    { x: 38, y: 68 },
    { x: 62, y: 68 },
    { x: 86, y: 66 },
    { x: 30, y: 46 },
    { x: 50, y: 48 },
    { x: 70, y: 46 },
    { x: 35, y: 18 },
    { x: 65, y: 18 },
  ],
  '3-4-2': [
    { x: 50, y: 86 },
    { x: 25, y: 68 },
    { x: 50, y: 70 },
    { x: 75, y: 68 },
    { x: 14, y: 46 },
    { x: 38, y: 48 },
    { x: 62, y: 48 },
    { x: 86, y: 46 },
    { x: 35, y: 18 },
    { x: 65, y: 18 },
  ],
  '4-5-0': [
    { x: 50, y: 86 },
    { x: 14, y: 68 },
    { x: 38, y: 70 },
    { x: 62, y: 70 },
    { x: 86, y: 68 },
    { x: 10, y: 42 },
    { x: 30, y: 44 },
    { x: 50, y: 46 },
    { x: 70, y: 44 },
    { x: 90, y: 42 },
  ],
};

const FORMATION_SLOTS: Record<Formation, Slot[]> = Object.fromEntries(
  (Object.keys(FORMATION_COORDS) as Formation[]).map((formation) => [
    formation,
    FORMATION_COORDS[formation].map((coord, i) => ({ ...coord, position: FORMATION_POSITIONS[formation][i] })),
  ]),
) as Record<Formation, Slot[]>;

interface FunctionMarker {
  function: PlayerFunction;
  position: Position;
  x: number;
  y: number;
}

const FUNCTION_MARKER_LABELS: Record<PlayerFunction, string> = {
  LATERAL: 'LAT',
  ALA: 'ALA',
  VOLANTE: 'VOL',
  MEIA_CRIACAO: 'MEI',
  CENTROAVANTE: 'CA',
  PONTA: 'PON',
  SEGUNDO_ATACANTE: 'SA',
  ZAGUEIRO_REBATEDOR: 'ZAG',
  ZAGUEIRO_CONSTRUTOR: 'Z.CT',
  LATERAL_CONSTRUTOR: 'L.CT',
  ALA_OFENSIVO: 'ALA+',
  VOLANTE_CAO_DE_GUARDA: 'CÃO',
  MEIA_BOX_TO_BOX: 'B2B',
  MEIA_ARMADOR: 'ARM',
  PONTA_INVERTIDO: 'P.INV',
  PONTA_LINHA_DE_FUNDO: 'P.AGU',
  CENTROAVANTE_REFERENCIA: 'PIVÔ',
  FALSO_NOVE: 'F9',
};

/**
 * Every tactical sub-role that exists in the game (see `FUNCTIONS_BY_POSITION`), laid out at a plausible
 * spot on the pitch — always rendered, always dormant (faint, non-interactive) *except* while a player is
 * being held-and-dragged, when the ones matching that player's own base position brighten up as a
 * "these are the roles this player could plausibly fill" preview. Independent of the current formation's
 * actual 11 slots (those keep their own exact coordinates below, unchanged) — this is purely the ambient
 * "every possible position" backdrop the pitch is asked to show.
 */
const FUNCTION_MARKERS: FunctionMarker[] = [
  { function: 'LATERAL', position: 'LAT', x: 8, y: 70 },
  { function: 'LATERAL', position: 'LAT', x: 92, y: 70 },
  { function: 'ALA', position: 'LAT', x: 6, y: 50 },
  { function: 'ALA', position: 'LAT', x: 94, y: 50 },
  { function: 'VOLANTE', position: 'MID', x: 38, y: 56 },
  { function: 'VOLANTE', position: 'MID', x: 62, y: 56 },
  { function: 'MEIA_CRIACAO', position: 'MID', x: 50, y: 34 },
  { function: 'PONTA', position: 'ATT', x: 10, y: 20 },
  { function: 'PONTA', position: 'ATT', x: 90, y: 20 },
  { function: 'SEGUNDO_ATACANTE', position: 'ATT', x: 38, y: 24 },
  { function: 'SEGUNDO_ATACANTE', position: 'ATT', x: 62, y: 24 },
  { function: 'CENTROAVANTE', position: 'ATT', x: 50, y: 8 },
];

/** The flank a slot's x-coordinate falls on — fed into the tactic's per-slot `side` for the foot-mismatch effect. */
export function sideFromX(x: number): 'LEFT' | 'CENTER' | 'RIGHT' {
  if (x < 40) return 'LEFT';
  if (x > 60) return 'RIGHT';
  return 'CENTER';
}

export function getFormationSlots(formation: Formation): Slot[] {
  return FORMATION_SLOTS[formation];
}

/** Same two-letter style as club crests (see clubCrest.ts) — first letter of up to the first two words. */
function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : (words[0]?.slice(0, 2) ?? '?').toUpperCase();
}

/** Last word of the name only — keeps the pitch caption compact (e.g. "Ricardo Costa" -> "Costa"),
 *  same convention shirts/broadcasts use. */
function surnameFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words[words.length - 1] ?? name;
}

/** The força this player would actually show while fielded at `slotPosition` — the same exponential
 *  handicap the simulation itself applies (see positionMismatchFactor in teamStrength.ts), rounded for
 *  display. Equal to the player's own overall when the slot matches their natural position. */
function effectiveForceInSlot(player: Player, slotPosition: Position): number {
  return Math.round(player.overall * positionMismatchFactor(player.position, slotPosition));
}

export function getStaminaColor(stamina: number): string {
  if (stamina >= 75) return '#22c55e'; // Verde - Ótimo
  if (stamina >= 50) return '#eab308'; // Amarelo - Regular
  if (stamina >= 30) return '#f97316'; // Laranja - Cansado
  return '#ef4444'; // Vermelho - Esgotado
}

/** Classic pitch markings drawn to a 200x300 viewBox — matches the `.pitch` element's 2:3 aspect ratio exactly. */
function PitchMarkings() {
  return (
    <svg className="pitch-markings" viewBox="0 0 200 300" preserveAspectRatio="none" aria-hidden="true">
      <rect x="4" y="4" width="192" height="292" />
      <line x1="4" y1="150" x2="196" y2="150" />
      <circle cx="100" cy="150" r="28" />
      <circle className="pitch-spot" cx="100" cy="150" r="1.6" />
      <rect x="45" y="4" width="110" height="45" />
      <rect x="75" y="4" width="50" height="18" />
      <circle className="pitch-spot" cx="100" cy="38" r="1.6" />
      <path d="M 74 49 A 28 28 0 0 0 126 49" />
      <rect x="45" y="251" width="110" height="45" />
      <rect x="75" y="278" width="50" height="18" />
      <circle className="pitch-spot" cx="100" cy="262" r="1.6" />
      <path d="M 74 251 A 28 28 0 0 1 126 251" />
      <path d="M 4 12 A 8 8 0 0 1 12 4" />
      <path d="M 188 4 A 8 8 0 0 1 196 12" />
      <path d="M 12 296 A 8 8 0 0 1 4 288" />
      <path d="M 196 288 A 8 8 0 0 1 188 296" />
    </svg>
  );
}

export interface PitchTacticalOverlayProps {
  defensiveLine?: DefensiveLineHeight;
  attackStyle?: AttackStyle;
  pressing?: PressingIntensity;
}

/**
 * Prancheta tática dinâmica: renderiza a altura visual da linha defensiva (alta, média ou bloco baixo),
 * a zona de compactação / vulnerabilidade nas costas da zaga e as setas de fluxo de ataque (alas, meio ou equilibrado).
 */
export function PitchTacticalOverlay({
  defensiveLine,
  attackStyle,
  pressing,
}: PitchTacticalOverlayProps) {
  const line: DefensiveLineHeight =
    defensiveLine ??
    (pressing === 'HIGH_PRESS' ? 'HIGH' : pressing === 'LOW_BLOCK' ? 'DEEP' : pressing ? 'BALANCED' : 'BALANCED');

  // Coordenadas Y no viewBox de 200x300:
  // DEEP (Bloco Baixo): y = 236 (~78.7%, encostado na grande área que inicia em 251)
  // BALANCED (Média): y = 204 (~68%, altura dos zagueiros)
  // HIGH (Alta): y = 168 (~56%, zaga adiantada pressionando perto do meio que é 150)
  const lineY = line === 'HIGH' ? 168 : line === 'DEEP' ? 236 : 204;
  const lineLabel = line === 'HIGH' ? 'LINHA ALTA' : line === 'DEEP' ? 'BLOCO BAIXO' : 'LINHA MÉDIA';
  const lineColor = line === 'HIGH' ? '#f59e0b' : line === 'DEEP' ? '#38bdf8' : '#10b981';

  return (
    <svg className="pitch-tactical-overlay" viewBox="0 0 200 300" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        {/* Marcadores de ponta de seta para estilos de ataque */}
        <marker id="tactical-arrow-wings" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="#38bdf8" />
        </marker>
        <marker id="tactical-arrow-middle" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="#f59e0b" />
        </marker>
        <marker id="tactical-arrow-balanced" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="#34d399" />
        </marker>

        {/* Hachura diagonal para representar vulnerabilidade / espaço nas costas da defesa adiantada */}
        <pattern id="space-behind-pattern" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(239, 68, 68, 0.22)" strokeWidth="1.2" />
        </pattern>
      </defs>

      {/* ZONA DE COMPACTAÇÃO DEFENSIVA & ESPAÇO NAS COSTAS */}
      {line === 'HIGH' && (
        <g className="tactical-space-behind-group">
          <rect
            x="4"
            y={lineY}
            width="192"
            height={251 - lineY}
            fill="url(#space-behind-pattern)"
            className="space-behind-zone"
          />
          <text
            x="100"
            y={(lineY + 251) / 2 + 2}
            textAnchor="middle"
            fill="rgba(252, 165, 165, 0.72)"
            fontSize="5.2"
            fontWeight="700"
            letterSpacing="0.6"
            className="tactical-overlay-text"
          >
            ESPAÇO NAS COSTAS
          </text>
        </g>
      )}

      {line === 'DEEP' && (
        <rect
          x="4"
          y="236"
          width="192"
          height="56"
          fill="rgba(56, 189, 248, 0.08)"
          className="deep-block-zone"
        />
      )}

      {/* LINHA DEFENSIVA TÁTICA (Linha de contenção + badge de status) */}
      <g className="tactical-defensive-line-group">
        <line
          x1="4"
          y1={lineY}
          x2="196"
          y2={lineY}
          stroke={lineColor}
          strokeWidth="1.8"
          strokeDasharray="5 3"
          strokeOpacity="0.85"
          className="tactical-defensive-line"
        />
        <line
          x1="4"
          y1={lineY}
          x2="196"
          y2={lineY}
          stroke={lineColor}
          strokeWidth="5"
          strokeOpacity="0.18"
          className="tactical-defensive-glow"
        />
        <rect
          x="8"
          y={lineY - 13}
          width="50"
          height="11"
          rx="3"
          fill="rgba(11, 15, 25, 0.94)"
          stroke={lineColor}
          strokeWidth="0.8"
        />
        <text
          x="33"
          y={lineY - 5.5}
          textAnchor="middle"
          fill={lineColor}
          fontSize="4.8"
          fontWeight="800"
          letterSpacing="0.4"
          className="tactical-overlay-text"
        >
          {lineLabel}
        </text>
      </g>

      {/* SETAS DE FLUXO OFENSIVO */}
      {attackStyle === 'WINGS' && (
        <g className="tactical-attack-arrows-wings">
          {/* Corredor Esquerdo */}
          <path
            d="M 20 145 L 20 62 Q 20 38 46 28"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="4 2"
            markerEnd="url(#tactical-arrow-wings)"
            strokeOpacity="0.75"
            className="tactical-animated-arrow"
          />
          {/* Corredor Direito */}
          <path
            d="M 180 145 L 180 62 Q 180 38 154 28"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="4 2"
            markerEnd="url(#tactical-arrow-wings)"
            strokeOpacity="0.75"
            className="tactical-animated-arrow"
          />
          {/* Cruzamentos em direção à área */}
          <path
            d="M 22 55 Q 60 45 88 40"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.4"
            strokeDasharray="3 2"
            markerEnd="url(#tactical-arrow-wings)"
            strokeOpacity="0.6"
          />
          <path
            d="M 178 55 Q 140 45 112 40"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.4"
            strokeDasharray="3 2"
            markerEnd="url(#tactical-arrow-wings)"
            strokeOpacity="0.6"
          />
          <text
            x="100"
            y="20"
            textAnchor="middle"
            fill="#38bdf8"
            fontSize="5.5"
            fontWeight="800"
            letterSpacing="0.6"
            className="tactical-overlay-text"
          >
            FLUXO: ALAS & PONTAS
          </text>
        </g>
      )}

      {attackStyle === 'THROUGH_MIDDLE' && (
        <g className="tactical-attack-arrows-middle">
          {/* Centro direto */}
          <path
            d="M 100 140 L 100 52"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.2"
            strokeDasharray="4 2"
            markerEnd="url(#tactical-arrow-middle)"
            strokeOpacity="0.8"
            className="tactical-animated-arrow"
          />
          {/* Infiltração Meia-Esquerda */}
          <path
            d="M 68 135 Q 78 82 96 54"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.6"
            strokeDasharray="3 2"
            markerEnd="url(#tactical-arrow-middle)"
            strokeOpacity="0.7"
          />
          {/* Infiltração Meia-Direita */}
          <path
            d="M 132 135 Q 122 82 104 54"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.6"
            strokeDasharray="3 2"
            markerEnd="url(#tactical-arrow-middle)"
            strokeOpacity="0.7"
          />
          <text
            x="100"
            y="20"
            textAnchor="middle"
            fill="#f59e0b"
            fontSize="5.5"
            fontWeight="800"
            letterSpacing="0.6"
            className="tactical-overlay-text"
          >
            FLUXO: JOGO POR DENTRO
          </text>
        </g>
      )}

      {attackStyle === 'BALANCED' && (
        <g className="tactical-attack-arrows-balanced">
          <path
            d="M 36 135 L 36 68"
            fill="none"
            stroke="#34d399"
            strokeWidth="1.6"
            strokeDasharray="4 2"
            markerEnd="url(#tactical-arrow-balanced)"
            strokeOpacity="0.7"
            className="tactical-animated-arrow"
          />
          <path
            d="M 100 135 L 100 68"
            fill="none"
            stroke="#34d399"
            strokeWidth="1.6"
            strokeDasharray="4 2"
            markerEnd="url(#tactical-arrow-balanced)"
            strokeOpacity="0.7"
            className="tactical-animated-arrow"
          />
          <path
            d="M 164 135 L 164 68"
            fill="none"
            stroke="#34d399"
            strokeWidth="1.6"
            strokeDasharray="4 2"
            markerEnd="url(#tactical-arrow-balanced)"
            strokeOpacity="0.7"
            className="tactical-animated-arrow"
          />
          <text
            x="100"
            y="20"
            textAnchor="middle"
            fill="#34d399"
            fontSize="5.5"
            fontWeight="800"
            letterSpacing="0.6"
            className="tactical-overlay-text"
          >
            FLUXO: ATAQUE EQUILIBRADO
          </text>
        </g>
      )}
    </svg>
  );
}

export interface PitchPartnershipLinesProps {
  partnerships: PartnershipPair[];
  playerCoords: Map<string, { x: number; y: number }>;
}

/**
 * Conexões Visuais de Química de Setores: Linhas SVG dinâmicas interligando os titulares
 * que formam parcerias críticas (dupla de zaga, volantes/meias e ataque) baseadas no motor squadPartnership.
 */
export function PitchPartnershipLines({
  partnerships,
  playerCoords,
}: PitchPartnershipLinesProps) {
  if (!partnerships || partnerships.length === 0) return null;

  return (
    <svg
      className="pitch-partnership-lines"
      viewBox="0 0 200 300"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* Glow neon para parcerias veteranas */}
        <filter id="partnership-glow-veteran" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {partnerships.map((pair) => {
        const c1 = playerCoords.get(pair.player1.id);
        const c2 = playerCoords.get(pair.player2.id);
        if (!c1 || !c2) return null;

        const cx = (c1.x + c2.x) / 2;
        const cy = (c1.y + c2.y) / 2;

        let strokeColor = '#38bdf8';
        let strokeWidth = '1.8';
        let strokeDasharray: string | undefined = undefined;
        let strokeOpacity = 0.75;
        let className = 'partnership-line-established';
        let filter: string | undefined = undefined;
        let badgeIcon = '';

        switch (pair.affinity.level) {
          case 'VETERAN':
            strokeColor = '#10b981';
            strokeWidth = '2.2';
            strokeOpacity = 0.8;
            className = 'partnership-line-veteran';
            filter = 'url(#partnership-glow-veteran)';
            break;
          case 'ESTABLISHED':
            strokeColor = '#38bdf8';
            strokeWidth = '1.8';
            strokeOpacity = 0.75;
            className = 'partnership-line-established';
            break;
          case 'DEVELOPING':
            strokeColor = '#f59e0b';
            strokeWidth = '1.6';
            strokeDasharray = '4 2';
            strokeOpacity = 0.7;
            className = 'partnership-line-developing';
            break;
          case 'NEW':
            strokeColor = '#ef4444';
            strokeWidth = '1.4';
            strokeDasharray = '2 3';
            strokeOpacity = 0.65;
            className = 'partnership-line-new';
            break;
        }

        const badgeText = `${pair.affinity.score}`;

        return (
          <g
            key={`${pair.player1.id}-${pair.player2.id}`}
            className={`partnership-pair-group partnership-${pair.affinity.level.toLowerCase()}`}
          >
            <line
              x1={c1.x}
              y1={c1.y}
              x2={c2.x}
              y2={c2.y}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeOpacity={strokeOpacity}
              className={`partnership-line ${className}`}
              filter={filter}
            />
            {/* Mini-badge central com score de entrosamento */}
            <g className="partnership-score-badge">
              <rect
                x={cx - 9}
                y={cy - 5.5}
                width={18}
                height={11}
                rx={3}
                fill="rgba(11, 15, 25, 0.94)"
                stroke={strokeColor}
                strokeWidth={0.8}
              />
              <text
                x={cx}
                y={cy + 2.5}
                textAnchor="middle"
                fill={strokeColor}
                fontSize={5}
                fontWeight="800"
                letterSpacing={0.3}
                className="partnership-score-text"
              >
                {badgeText}
              </text>
              <title>{`${pair.label} · Nível: ${pair.affinity.level} (${pair.affinity.score} pts)`}</title>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Obtém a especificação e os bônus de combate da função tática secundária/especializada do atleta.
 */
export function getPlayerTacticalSubRole(player: Player): {
  role: PlayerFunction | null;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  bonusSummary: string;
} | null {
  if (player.position === 'GK') {
    return null;
  }

  let primaryFn: PlayerFunction | undefined =
    player.functions && player.functions.length > 0
      ? player.functions[0]
      : undefined;

  if (!primaryFn) {
    if (player.attributes) {
      primaryFn = autoAssignBestRolesForPlayer(player)[0];
    } else {
      switch (player.position) {
        case 'LAT':
          primaryFn = 'LATERAL';
          break;
        case 'DEF':
          primaryFn = 'ZAGUEIRO_REBATEDOR';
          break;
        case 'MID':
          primaryFn = 'VOLANTE';
          break;
        case 'ATT':
          primaryFn = 'CENTROAVANTE';
          break;
      }
    }
  }

  if (!primaryFn) return null;

  const modifier = PLAYER_ROLE_MODIFIERS[primaryFn];
  if (!modifier) return null;

  let shortLabel = modifier.name;

  switch (primaryFn) {
    case 'LATERAL':
      shortLabel = 'LAT';
      break;
    case 'LATERAL_CONSTRUTOR':
      shortLabel = 'LAT. CONST';
      break;
    case 'ALA':
    case 'ALA_OFENSIVO':
      shortLabel = 'ALA';
      break;
    case 'ZAGUEIRO_REBATEDOR':
      shortLabel = 'ZAG';
      break;
    case 'ZAGUEIRO_CONSTRUTOR':
      shortLabel = 'ZAG. CONST';
      break;
    case 'VOLANTE':
    case 'VOLANTE_CAO_DE_GUARDA':
      shortLabel = 'VOL';
      break;
    case 'MEIA_ARMADOR':
      shortLabel = 'ARMADOR';
      break;
    case 'MEIA_CRIACAO':
      shortLabel = 'MEIA';
      break;
    case 'MEIA_BOX_TO_BOX':
      shortLabel = 'B2B';
      break;
    case 'CENTROAVANTE':
    case 'CENTROAVANTE_REFERENCIA':
      shortLabel = 'HOMEM-GOL';
      break;
    case 'PONTA':
    case 'PONTA_INVERTIDO':
    case 'PONTA_LINHA_DE_FUNDO':
      shortLabel = 'PONTA';
      break;
    case 'SEGUNDO_ATACANTE':
      shortLabel = '2º ATAC';
      break;
    case 'FALSO_NOVE':
      shortLabel = 'FALSO 9';
      break;
  }

  const bonuses: string[] = [];
  if (modifier.defendingMultiplier > 1) {
    bonuses.push(`Def +${Math.round((modifier.defendingMultiplier - 1) * 100)}%`);
  } else if (modifier.defendingMultiplier < 1) {
    bonuses.push(`Def -${Math.round((1 - modifier.defendingMultiplier) * 100)}%`);
  }

  if (modifier.passingMultiplier > 1) {
    bonuses.push(`Pass +${Math.round((modifier.passingMultiplier - 1) * 100)}%`);
  } else if (modifier.passingMultiplier < 1) {
    bonuses.push(`Pass -${Math.round((1 - modifier.passingMultiplier) * 100)}%`);
  }

  if (modifier.attackingMultiplier > 1) {
    bonuses.push(`Ataq +${Math.round((modifier.attackingMultiplier - 1) * 100)}%`);
  } else if (modifier.attackingMultiplier < 1) {
    bonuses.push(`Ataq -${Math.round((1 - modifier.attackingMultiplier) * 100)}%`);
  }

  if (modifier.paceMultiplier > 1) {
    bonuses.push(`Vel +${Math.round((modifier.paceMultiplier - 1) * 100)}%`);
  }

  const bonusSummary = bonuses.length > 0 ? bonuses.join(' · ') : 'Neutro';

  return {
    role: primaryFn,
    label: modifier.name,
    shortLabel,
    icon: '',
    description: modifier.description,
    bonusSummary,
  };
}

export function RoleIcon({ role, size = 12 }: { role: PlayerFunction | null; size?: number }) {
  switch (role) {
    case 'LATERAL':
    case 'ZAGUEIRO_REBATEDOR':
    case 'VOLANTE':
    case 'VOLANTE_CAO_DE_GUARDA':
      return <ShieldIcon size={size} color="currentColor" />;
    case 'ALA':
    case 'ALA_OFENSIVO':
    case 'PONTA':
    case 'PONTA_INVERTIDO':
    case 'PONTA_LINHA_DE_FUNDO':
      return <LightningIcon size={size} color="currentColor" />;
    case 'CENTROAVANTE':
    case 'CENTROAVANTE_REFERENCIA':
    case 'SEGUNDO_ATACANTE':
      return <SoccerBallIcon size={size} color="currentColor" />;
    case 'LATERAL_CONSTRUTOR':
    case 'ZAGUEIRO_CONSTRUTOR':
    case 'MEIA_ARMADOR':
    case 'MEIA_CRIACAO':
    case 'MEIA_BOX_TO_BOX':
    case 'FALSO_NOVE':
    default:
      return <TacticsIcon size={size} color="currentColor" />;
  }
}

/**
 * Pílula compacta de função tática individual do atleta no card do campinho.
 */
export function PlayerFunctionPill({ player }: { player: Player }) {
  const subRole = getPlayerTacticalSubRole(player);
  if (!subRole) return null;

  const tooltipText = `Função Tática: ${subRole.label}\n${subRole.description}\nImpacto: ${subRole.bonusSummary}`;

  return (
    <div
      className="player-function-pill"
      title={tooltipText}
      data-testid="player-function-pill"
    >
      <span className="pill-icon" aria-hidden="true">
        <RoleIcon role={subRole.role} size={11} />
      </span>
      <span className="pill-label">{subRole.shortLabel}</span>
    </div>
  );
}

/**
 * Popover / lista suspensa flutuante com dados detalhados ao passar o mouse sobre o atleta no campo.
 */
export function PitchPlayerDropdown({
  player,
  slotPosition,
  effectiveForce,
  isOutOfPosition,
  isCaptain,
  stamina,
  roles,
  booked,
  isTopHalf,
  showTacticalFunction = true,
}: {
  player: Player;
  slotPosition: Position;
  effectiveForce: number;
  isOutOfPosition: boolean;
  isCaptain: boolean;
  stamina: number;
  roles?: string[];
  booked?: boolean;
  isTopHalf?: boolean;
  showTacticalFunction?: boolean;
}) {
  const subRole = getPlayerTacticalSubRole(player);
  const tier = getPlayerTier(
    player.overall,
    player.starLevel,
    player.diferenciado,
    player.age,
    player.potential,
    player.name
  );

  return (
    <div
      className={`pitch-player-dropdown ${isTopHalf ? 'dropdown-below' : 'dropdown-above'}`}
      data-testid="pitch-player-dropdown"
    >
      <div className="pitch-dropdown-header">
        <div className="pitch-dropdown-name-wrap">
          <strong className="pitch-dropdown-name">{player.name}</strong>
          <span className="pitch-dropdown-sub">
            {player.age ? `${player.age} anos • ` : ''}{footLabel(player.preferredFoot) ?? 'Destro'}
          </span>
        </div>
        <span className="pitch-dropdown-ovr-tag">{player.overall} OVR</span>
      </div>

      <div className="pitch-dropdown-stats-row">
        <span className="pitch-dropdown-pos-pill">
          {positionLabel(player.position)}
          {isOutOfPosition && (
            <span className="pitch-dropdown-mismatch"> (em {positionLabel(slotPosition)})</span>
          )}
        </span>
        <span className={`pitch-dropdown-force ${isOutOfPosition ? 'out-of-position' : ''}`}>
          Força: <strong>{effectiveForce}</strong>
        </span>
        <span className="pitch-dropdown-stamina" style={{ color: getStaminaColor(stamina) }}>
          Fôlego: <strong>{stamina}%</strong>
        </span>
      </div>

      {showTacticalFunction && subRole && (
        <div className="pitch-dropdown-role-section">
          <PlayerFunctionPill player={player} />
          <p className="pitch-dropdown-role-desc">{subRole.description}</p>
          <span className="pitch-dropdown-role-bonus">{subRole.bonusSummary}</span>
        </div>
      )}

      {(isCaptain || (roles && roles.length > 0)) && (
        <div className="pitch-dropdown-roles-badges">
          {isCaptain && <span className="pitch-dropdown-tag captain">© Capitão</span>}
          {roles?.includes('PENALTY') && <span className="pitch-dropdown-tag penalty">P Pênaltis</span>}
          {roles?.includes('FREE_KICK') && <span className="pitch-dropdown-tag freekick">F Faltas</span>}
          {roles?.includes('CORNER') && <span className="pitch-dropdown-tag corner">E Escanteios</span>}
        </div>
      )}

      {((player.injuryWeeks ?? 0) > 0 || (player.suspensions?.length ?? 0) > 0 || booked || tier) && (
        <div className="pitch-dropdown-status-row">
          {tier && (
            <span className="pitch-dropdown-status-badge tier">
              <StarIcon size={12} color="#fbbf24" fill="#fbbf24" style={{ marginRight: 4 }} />
              {tier === 'GENIO' ? 'Craque Gênio' : tier === 'BAITA' ? 'Destaque' : 'Promessa'}
            </span>
          )}
          {booked && (
            <span className="pitch-dropdown-status-badge yellow">
              <span className="status-booked" style={{ display: 'inline-block', marginRight: 4 }} /> Cartão Amarelo
            </span>
          )}
          {(player.injuryWeeks ?? 0) > 0 && (
            <span className="pitch-dropdown-status-badge red">
              <span style={{ color: '#ef4444', fontWeight: 'bold', marginRight: 4 }}>+</span> Lesão ({player.injuryWeeks} sem)
            </span>
          )}
          {(player.suspensions?.length ?? 0) > 0 && (
            <span className="pitch-dropdown-status-badge red">
              <span className="status-suspended" style={{ display: 'inline-block', marginRight: 4 }} /> Suspenso
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mini-card de resumo de parcerias críticas dos setores do 11 titular.
 */
export function PartnershipSummaryBar({
  partnerships,
}: {
  partnerships: PartnershipPair[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (!partnerships || partnerships.length === 0) return null;

  const synergy = calculateSquadPartnershipSynergy(partnerships);

  const sectorIcon = (sector: PartnershipSector) => {
    switch (sector) {
      case 'DEFENSE': return <ShieldIcon size={12} color="currentColor" />;
      case 'MIDFIELD': return <TacticsIcon size={12} color="currentColor" />;
      case 'ATTACK': return <LightningIcon size={12} color="currentColor" />;
    }
  };

  const levelColor = (level: PartnershipLevel) => {
    switch (level) {
      case 'VETERAN': return '#10b981';
      case 'ESTABLISHED': return '#38bdf8';
      case 'DEVELOPING': return '#f59e0b';
      case 'NEW': return '#ef4444';
    }
  };

  const levelLabel = (level: PartnershipLevel) => {
    switch (level) {
      case 'VETERAN': return 'Veterana (+6% Cobertura)';
      case 'ESTABLISHED': return 'Estabelecida (+3% Passes)';
      case 'DEVELOPING': return 'Em Desenvol.';
      case 'NEW': return 'Sem Química (+10% Risco)';
    }
  };

  return (
    <div className="partnership-summary-bar" data-testid="partnership-summary-bar">
      <div
        className="partnership-summary-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <div className="partnership-summary-title">
          <UsersIcon size={15} style={{ marginRight: 6 }} />
          <span className="summary-heading">Parcerias de Setor ({partnerships.length})</span>
          <span
            className="summary-badge-score"
            style={{ color: levelColor(partnerships[0]?.affinity.level ?? 'DEVELOPING') }}
          >
            Média: {synergy.averageAffinityScore}%
          </span>
        </div>
        <button
          type="button"
          className="btn-summary-toggle"
          aria-expanded={expanded}
          aria-label={expanded ? 'Recolher detalhes de parcerias' : 'Expandir detalhes de parcerias'}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? '▲ Ocultar' : '▼ Detalhes'}
        </button>
      </div>

      <div className={`partnership-chips-container ${expanded ? 'expanded' : 'collapsed'}`}>
        {partnerships.map((pair, idx) => {
          const color = levelColor(pair.affinity.level);
          const icon = sectorIcon(pair.sector);
          const p1Surname = surnameFromName(pair.player1.name);
          const p2Surname = surnameFromName(pair.player2.name);

          return (
            <div
              key={idx}
              className={`partnership-sector-chip sector-${pair.sector.toLowerCase()} level-${pair.affinity.level.toLowerCase()}`}
              style={{ borderColor: `${color}66` }}
              title={`${pair.label}\nNível: ${pair.affinity.level} (${pair.affinity.score}%)\nJogos Juntos: ${pair.matchesTogether}`}
            >
              <span className="chip-sector-icon" aria-hidden="true">{icon}</span>
              <span className="chip-names">{p1Surname} & {p2Surname}</span>
              <span className="chip-dot" aria-hidden="true">·</span>
              <span className="chip-level" style={{ color }}>
                {levelLabel(pair.affinity.level)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/** The always-present, always-dormant "every possible position" backdrop — see `FUNCTION_MARKERS`.
 *  `highlightFunctions` (only ever set mid-drag in the editable `PitchField`) brightens the markers that
 *  match whichever player is currently being dragged. `onDropOnMarker` (omitted in the read-only
 *  `StartingXIPitch`) makes each marker a real drop target that assigns that tactical sub-role. */
function FunctionMarkersLayer({
  highlightFunctions,
  onDropOnMarker,
}: {
  highlightFunctions?: Set<PlayerFunction> | null;
  onDropOnMarker?: (playerId: string, fn: PlayerFunction) => void;
}) {
  return (
    <>
      {FUNCTION_MARKERS.map((marker, i) => {
        const active = highlightFunctions?.has(marker.function) ?? false;
        return (
          <div
            key={i}
            className={`function-marker${active ? ' active' : ''}`}
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            onDragOver={
              onDropOnMarker
                ? (e) => {
                    if (draggedPlayerPosition === marker.position) e.preventDefault();
                  }
                : undefined
            }
            onDrop={
              onDropOnMarker
                ? (e) => {
                    e.preventDefault();
                    const playerId = e.dataTransfer.getData(DND_PLAYER_ID);
                    const position = e.dataTransfer.getData(DND_PLAYER_POSITION);
                    if (playerId && position === marker.position) onDropOnMarker(playerId, marker.function);
                  }
                : undefined
            }
          >
            <img src="/icons/jersey.webp" alt="" aria-hidden="true" />
            <span className="function-marker-label">{FUNCTION_MARKER_LABELS[marker.function]}</span>
          </div>
        );
      })}
    </>
  );
}

interface PitchFieldProps {
  formation: Formation;
  squad: Player[];
  selections: (string | null)[];
  /** Called when a player dragged in from *outside* the pitch (a bench chip — no dropdown anymore, this
   *  is now the only way to fill a slot) is dropped on slot `slotIndex`. */
  onSelect: (slotIndex: number, playerId: string) => void;
  /** Dragging a starter onto another slot of the same base position swaps them (or just moves, if the
   *  target was empty) — both resolved by the same array-swap in the caller. */
  onSwap?: (fromIndex: number, toIndex: number) => void;
  /** Where the manager has parked each shirt, as pitch percentages, aligned by slot index. A null (or a
   *  missing entry) means that slot still sits wherever the formation puts it. */
  slotPoints?: ({ x: number; y: number } | null)[];
  /** Dropping a starter on open grass parks them there. The point becomes the position they actually
   *  play, so this is a tactical decision and not a cosmetic one. Omit to keep the pitch on rails. */
  onMove?: (slotIndex: number, x: number, y: number) => void;
  /** Dragging a starter onto a dormant function marker assigns that tactical sub-role to them (same
   *  mechanism already used in Squad.tsx, just triggered from the pitch instead of a checkbox). */
  onAssignFunction?: (playerId: string, fn: PlayerFunction) => void;
  /** Caps the pitch's width so it fits alongside other controls. The pitch is 2:3 and full-width by
   *  default, so in a wide column it renders over a thousand pixels tall and pushes everything below it
   *  off screen — fine on a dedicated tactics page, unusable inside a mid-match panel or a dashboard card. */
  compact?: boolean;
  /** Ids booked in the match currently being played (see `bookedPlayerIds`) — one more yellow and they walk. */
  bookedPlayerIds?: ReadonlySet<string>;
  /** Ids no longer on the pitch mid-match (sent off, or carried off awaiting a replacement). Their slot
   *  still holds their name in the lineup — that is how the engine marks which zone went unmanned — so
   *  drawing them as a normal starter would show eleven players for a side that has ten. Rendered as an
   *  empty shirt instead, which is also what makes the hole visible when reshaping after a dismissal. */
  vacatedPlayerIds?: ReadonlySet<string>;
  /** The club's shirt colour for the player discs. Falls back to the game's gold when absent — see `kitStyle`. */
  kitColor?: string | null;
  kitPattern?: any;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  /** Tactical roles mapped by player id for role badges on the pitch. */
  rolesByPlayerId?: Record<string, PlayerRole[]>;
  /** Optional live match minute (0-90+) to display real-time dynamic stamina and halftime recovery. */
  currentMatchMinute?: number;
  /** Optional club slug to load real club jersey art */
  clubSlug?: string | null;
  isAway?: boolean;
  /** How high the defensive line sits: DEEP, BALANCED, or HIGH (moves the defensive containment line visually). */
  defensiveLine?: DefensiveLineHeight;
  /** Attack progression style: WINGS, THROUGH_MIDDLE, or BALANCED (draws tactical flow arrows). */
  attackStyle?: AttackStyle;
  /** Pressing intensity: LOW_BLOCK, MEDIUM, HIGH_PRESS (infers defensive line if defensiveLine is omitted). */
  pressing?: PressingIntensity;
  /** Modo de visualização da prancheta: 'SIMPLE' (minimalista Brasfoot) ou 'TACTICAL' (análise completa FM). */
  tacticalViewMode?: 'SIMPLE' | 'TACTICAL';
  onTacticalViewModeChange?: (mode: 'SIMPLE' | 'TACTICAL') => void;
  /** Histórico opcional de jogos conjuntos entre jogadores para cálculo de química de parceria. */
  matchesHistory?: Map<string, number>;
}

interface StartingXIPitchProps {
  formation: Formation;
  lineup: { playerId: string }[];
  players: Player[];
  compact?: boolean;
  bookedPlayerIds?: ReadonlySet<string>;
  kitColor?: string | null;
  kitPattern?: any;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  rolesByPlayerId?: Record<string, PlayerRole[]>;
  currentMatchMinute?: number;
  clubSlug?: string | null;
  isAway?: boolean;
  /** How high the defensive line sits: DEEP, BALANCED, or HIGH (moves the defensive containment line visually). */
  defensiveLine?: DefensiveLineHeight;
  /** Attack progression style: WINGS, THROUGH_MIDDLE, or BALANCED (draws tactical flow arrows). */
  attackStyle?: AttackStyle;
  /** Pressing intensity: LOW_BLOCK, MEDIUM, HIGH_PRESS (infers defensive line if defensiveLine is omitted). */
  pressing?: PressingIntensity;
  /** Modo de visualização da prancheta: 'SIMPLE' (minimalista Brasfoot) ou 'TACTICAL' (análise completa FM). */
  tacticalViewMode?: 'SIMPLE' | 'TACTICAL';
  onTacticalViewModeChange?: (mode: 'SIMPLE' | 'TACTICAL') => void;
  /** Histórico opcional de jogos conjuntos entre jogadores para cálculo de química de parceria. */
  matchesHistory?: Map<string, number>;
}

/** Sets the shirt colour the discs read from. Unset leaves the CSS default in place rather than forcing a
 *  colour, so a screen that doesn't know the club (or a club with a black-and-white crest) still looks right. */
function kitStyle(kitColor?: string | null): React.CSSProperties | undefined {
  return kitColor ? ({ ['--kit-color' as string]: kitColor } as React.CSSProperties) : undefined;
}

/** Read-only pitch for an at-a-glance view of a saved lineup (e.g. the club home dashboard) — same
 *  formation slots and markings as the editable `PitchField`, but shows name/força instead of a select. */
export function PitchSlotRoles({ roles }: { roles?: PlayerRole[] }) {
  if (!roles || roles.length === 0) return null;
  const isCaptain = roles.includes('CAPTAIN');
  const isPenalty = roles.includes('PENALTY_TAKER');
  const isFreeKick = roles.includes('FREE_KICK_TAKER');
  const isCorner = roles.includes('CORNER_LEFT_TAKER') || roles.includes('CORNER_RIGHT_TAKER');
  if (!isCaptain && !isPenalty && !isFreeKick && !isCorner) return null;

  return (
    <div className="pitch-slot-roles-row" aria-hidden="true">
      {isCaptain && <span className="pitch-role-pill role-c" title="Capitão">C</span>}
      {isPenalty && <span className="pitch-role-pill role-p" title="Cobrador de Pênaltis">P</span>}
      {isFreeKick && <span className="pitch-role-pill role-f" title="Cobrador de Faltas">F</span>}
      {isCorner && <span className="pitch-role-pill role-e" title="Cobrador de Escanteios">E</span>}
    </div>
  );
}

export function StartingXIPitch({
  formation,
  lineup,
  players,
  compact,
  bookedPlayerIds,
  kitColor,
  kitPattern,
  primaryColor,
  secondaryColor,
  rolesByPlayerId,
  currentMatchMinute,
  clubSlug,
  isAway,
  defensiveLine,
  attackStyle,
  pressing,
  tacticalViewMode,
  onTacticalViewModeChange,
  matchesHistory,
}: StartingXIPitchProps) {
  const slots = FORMATION_SLOTS[formation];
  const byId = new Map(players.map((p) => [p.id, p]));
  const [viewModeState, setViewModeState] = useState<'SIMPLE' | 'TACTICAL'>(
    tacticalViewMode ?? (compact ? 'SIMPLE' : 'TACTICAL')
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const effectiveViewMode = tacticalViewMode ?? viewModeState;

  const handleViewModeChange = (mode: 'SIMPLE' | 'TACTICAL') => {
    setViewModeState(mode);
    onTacticalViewModeChange?.(mode);
  };

  const lineupForPartnership: LineupSlotWithPlayer[] = [];
  const playerCoords = new Map<string, { x: number; y: number }>();

  slots.forEach((slot, i) => {
    const player = lineup[i] ? byId.get(lineup[i].playerId) : undefined;
    if (player) {
      lineupForPartnership.push({ player, slotPosition: slot.position });
      playerCoords.set(player.id, {
        x: (slot.x / 100) * 200,
        y: (slot.y / 100) * 300,
      });
    }
  });

  const partnerships = findCriticalPartnerships(lineupForPartnership, matchesHistory);

  const hoveredPlayer = hoveredIndex !== null && lineup[hoveredIndex] ? byId.get(lineup[hoveredIndex].playerId) : undefined;
  const hoveredSlot = hoveredIndex !== null ? slots[hoveredIndex] : undefined;
  const hoveredOutOfPosition = hoveredPlayer && hoveredSlot && hoveredPlayer.position !== hoveredSlot.position;
  const hoveredCaptain = hoveredPlayer && rolesByPlayerId?.[hoveredPlayer.id]?.includes('CAPTAIN');
  const hoveredStamina = hoveredPlayer
    ? currentMatchMinute !== undefined
      ? calculateInMatchStamina(hoveredPlayer, currentMatchMinute)
      : Math.round(Math.max(0, 100 - (hoveredPlayer.fatigue ?? 0)))
    : 100;

  return (
    <div className="pitch-board-wrapper">
      <div className="pitch-inspector-header">
        {hoveredPlayer && hoveredSlot ? (
          <PitchPlayerDropdown
            player={hoveredPlayer}
            slotPosition={hoveredSlot.position}
            effectiveForce={effectiveForceInSlot(hoveredPlayer, hoveredSlot.position)}
            isOutOfPosition={!!hoveredOutOfPosition}
            isCaptain={!!hoveredCaptain}
            stamina={hoveredStamina}
            roles={rolesByPlayerId?.[hoveredPlayer.id]}
            booked={bookedPlayerIds?.has(hoveredPlayer.id)}
            showTacticalFunction={effectiveViewMode === 'TACTICAL'}
          />
        ) : (
          <div className="pitch-inspector-placeholder">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6 }} aria-hidden="true">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              Passe o mouse sobre um atleta no campo para inspecionar atributos e papel tático
            </span>
          </div>
        )}
      </div>

      {/* Toggle de Modo de Prancheta no topo (acima do gramado para não cobrir atacantes) */}
      <div className="pitch-view-mode-bar" role="toolbar" aria-label="Modo de visualização da prancheta">
        <div className="pitch-view-mode-toggle">
          <button
            type="button"
            className={`pitch-view-toggle-btn ${effectiveViewMode === 'SIMPLE' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('SIMPLE')}
            data-testid="toggle-view-simple"
            title="Visão Simples: visual limpo e direto da escalação"
          >
            <EyeIcon size={14} style={{ marginRight: 6 }} />
            Visão Simples
          </button>
          <button
            type="button"
            className={`pitch-view-toggle-btn ${effectiveViewMode === 'TACTICAL' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('TACTICAL')}
            data-testid="toggle-view-tactical"
            title="Prancheta Tática: linhas de dinâmica, sinergia e postura de campo"
          >
            <TacticsIcon size={14} style={{ marginRight: 6 }} />
            Prancheta Tática
          </button>
        </div>
      </div>

      <div className={compact ? 'pitch pitch-compact' : 'pitch'} style={kitStyle(kitColor)}>
        <PitchMarkings />
        {effectiveViewMode === 'TACTICAL' && (defensiveLine || attackStyle || pressing) && (
          <PitchTacticalOverlay
            defensiveLine={defensiveLine}
            attackStyle={attackStyle}
            pressing={pressing}
          />
        )}
        {effectiveViewMode === 'TACTICAL' && partnerships.length > 0 && (
          <PitchPartnershipLines
            partnerships={partnerships}
            playerCoords={playerCoords}
          />
        )}
        <FunctionMarkersLayer highlightFunctions={null} />
        {slots.map((slot, i) => {
          const player = lineup[i] ? byId.get(lineup[i].playerId) : undefined;
          const isOutOfPosition = !!player && player.position !== slot.position && !(player as any).secondaryPositions?.includes(slot.position);
          const isCaptain = !!player && !!rolesByPlayerId?.[player.id]?.includes('CAPTAIN');
          const stamina = player
            ? currentMatchMinute !== undefined
              ? calculateInMatchStamina(player, currentMatchMinute)
              : Math.round(Math.max(0, 100 - (player.fatigue ?? 0)))
            : 100;
          const slotTitle = player
            ? `${player.name} (${positionLabel(player.position)}) · Força: ${effectiveForceInSlot(player, slot.position)} · Fôlego: ${stamina}%`
            : undefined;

          return (
            <div
              key={i}
              className="pitch-slot"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                className={`pitch-slot-badge${player ? ' filled' : ' dormant'}${isOutOfPosition ? ' out-of-position' : ''}${slot.position === 'GK' ? ' keeper' : ''}`}
                title={slotTitle}
              >
                <TeamJersey
                  clubSlug={clubSlug}
                  kitColor={kitColor}
                  kitPattern={kitPattern}
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                  isKeeper={slot.position === 'GK'}
                  isAway={isAway}
                  className="pitch-slot-jersey"
                />
                {!player && <span className="pitch-slot-badge-label">{positionLabel(slot.position)}</span>}
                {player && (
                  <PlayerStatusMarks
                    injured={(player.injuryWeeks ?? 0) > 0}
                    suspended={(player.suspensions?.length ?? 0) > 0}
                    booked={bookedPlayerIds?.has(player.id)}
                    tier={getPlayerTier(player.overall, player.starLevel, player.diferenciado, player.age, player.potential, player.name)}
                  />
                )}
                {isOutOfPosition && (
                  <span className="pitch-slot-badge-warning" aria-hidden="true" title="Fora de posição">
                    <AlertTriangleIcon size={10} color="#f59e0b" />
                  </span>
                )}
              </div>
              {player && (
                <div className="pitch-slot-summary-card">
                  <div className="pitch-slot-summary-main">
                    <span className="pitch-slot-pos-badge">{positionLabel(slot.position)}</span>
                    <span className="pitch-slot-name-label">{surnameFromName(player.name)}</span>
                    <span className={`pitch-slot-force-label${isOutOfPosition ? ' out-of-position' : ''}`}>
                      {effectiveForceInSlot(player, slot.position)}
                    </span>
                    {isCaptain && <span className="pitch-legend-captain-tag">©</span>}
                    {isOutOfPosition && (
                      <span className="pitch-slot-badge-warning" style={{ display: 'inline-flex', alignItems: 'center' }} title="Fora de posição">
                        <AlertTriangleIcon size={9} color="#f59e0b" />
                      </span>
                    )}
                  </div>
                  {effectiveViewMode === 'TACTICAL' && (() => {
                    const dyn = getDynamicTacticalRole(slot.x, slot.y, player);
                    return <div className="pitch-slot-dynamic-role" title={`Função Dinâmica: ${dyn.label}`}>{dyn.shortLabel ?? dyn.label}</div>;
                  })()}
                  {effectiveViewMode === 'TACTICAL' && (
                    <div style={{ marginTop: 2 }}>
                      <PlayerFunctionPill player={player} />
                    </div>
                  )}
                  <div className="pitch-slot-mini-stamina">
                    <span
                      className="pitch-slot-mini-stamina-fill"
                      style={{
                        width: `${stamina}%`,
                        backgroundColor: getStaminaColor(stamina),
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {effectiveViewMode === 'TACTICAL' && partnerships.length > 0 && (
        <PartnershipSummaryBar partnerships={partnerships} />
      )}
    </div>
  );
}

export function PitchField({
  formation,
  squad,
  selections,
  slotPoints,
  onSelect,
  onSwap,
  onMove,
  onAssignFunction,
  compact,
  bookedPlayerIds,
  vacatedPlayerIds,
  kitColor,
  kitPattern,
  primaryColor,
  secondaryColor,
  rolesByPlayerId,
  currentMatchMinute,
  clubSlug,
  isAway,
  defensiveLine,
  attackStyle,
  pressing,
  tacticalViewMode,
  onTacticalViewModeChange,
  matchesHistory,
}: PitchFieldProps) {
  const formationSlots = FORMATION_SLOTS[formation];
  const byId = new Map(squad.map((p) => [p.id, p]));
  const [draggingPosition, setDraggingPosition] = useState<Position | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const pitchRectRef = useRef<DOMRect | null>(null);

  const [viewModeState, setViewModeState] = useState<'SIMPLE' | 'TACTICAL'>(
    tacticalViewMode ?? (compact ? 'SIMPLE' : 'TACTICAL')
  );

  useEffect(() => {
    if (tacticalViewMode) {
      setViewModeState(tacticalViewMode);
    }
  }, [tacticalViewMode]);

  const effectiveViewMode = tacticalViewMode ?? viewModeState;

  const handleViewModeChange = (mode: 'SIMPLE' | 'TACTICAL') => {
    setViewModeState(mode);
    onTacticalViewModeChange?.(mode);
  };

  /** Where each shirt actually stands: the manager's own placement when they dragged one, otherwise
   *  whatever the formation dictates. `position` follows the point, so the label, the out-of-position
   *  warning and the strength number all describe where the player really is. */
  const slots: Slot[] = formationSlots.map((slot, i) => {
    const custom = slotPoints?.[i];
    if (!custom) return slot;
    return { x: custom.x, y: custom.y, position: positionFromPitchPoint(custom.x, custom.y) };
  });

  // Mapear jogadores titulares elegíveis e suas coordenadas no viewBox 200x300
  const lineupForPartnership: LineupSlotWithPlayer[] = [];
  const playerCoords = new Map<string, { x: number; y: number }>();

  slots.forEach((slot, i) => {
    const selectedId = selections[i];
    const selectedPlayer = selectedId ? byId.get(selectedId) : undefined;
    const isVacated = !!selectedPlayer && !!vacatedPlayerIds?.has(selectedPlayer.id);
    if (selectedPlayer && !isVacated) {
      lineupForPartnership.push({ player: selectedPlayer, slotPosition: slot.position });
      playerCoords.set(selectedPlayer.id, {
        x: (slot.x / 100) * 200,
        y: (slot.y / 100) * 300,
      });
    }
  });

  const partnerships = findCriticalPartnerships(lineupForPartnership, matchesHistory);

  const hoveredPlayer = hoveredIndex !== null && selections[hoveredIndex] ? byId.get(selections[hoveredIndex]!) : undefined;
  const hoveredSlot = hoveredIndex !== null ? slots[hoveredIndex] : undefined;
  const hoveredIsVacated = hoveredPlayer && vacatedPlayerIds?.has(hoveredPlayer.id);
  const hoveredOutOfPosition = hoveredPlayer && !hoveredIsVacated && hoveredSlot && hoveredPlayer.position !== hoveredSlot.position;
  const hoveredCaptain = hoveredPlayer && !hoveredIsVacated && rolesByPlayerId?.[hoveredPlayer.id]?.includes('CAPTAIN');
  const hoveredStamina = hoveredPlayer
    ? currentMatchMinute !== undefined
      ? calculateInMatchStamina(hoveredPlayer, currentMatchMinute)
      : Math.round(Math.max(0, 100 - (hoveredPlayer.fatigue ?? 0)))
    : 100;

  function handleBadgeDragStart(e: React.DragEvent, index: number, player: Player) {
    e.dataTransfer.setData(DND_PLAYER_ID, player.id);
    e.dataTransfer.setData(DND_PLAYER_POSITION, player.position);
    e.dataTransfer.setData(DND_SOURCE_SLOT, String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedPlayerPosition(player.position);
    setDraggingPosition(player.position);
  }

  function handlePointerDown(e: React.PointerEvent, index: number, player: Player) {
    if (!player) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setActiveDragIndex(index);
    setDraggedPlayerPosition(player.position);
    setDraggingPosition(player.position);
    if (pitchRef.current) {
      pitchRectRef.current = pitchRef.current.getBoundingClientRect();
    }
  }

  function handlePointerMove(e: React.PointerEvent, index: number) {
    if (activeDragIndex !== index || !pitchRef.current) return;
    const rect = pitchRectRef.current || pitchRef.current.getBoundingClientRect();
    const clamp = (v: number, min = 5, max = 95) => Math.max(min, Math.min(max, v));
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    const slotPos = formationSlots[index].position;
    let x = clamp(rawX, 5, 95);
    let y = clamp(rawY, 5, 95);

    if (slotPos === 'GK') {
      x = clamp(rawX, 30, 70);
      y = clamp(rawY, 70, 98);
    }

    onMove?.(index, x, y);
  }

  function handlePointerUp(e: React.PointerEvent, index: number) {
    if (activeDragIndex !== index) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const currentPoint = slotPoints?.[index] || { x: slots[index].x, y: slots[index].y };
    const targetSlot = slotNear(currentPoint, index);
    if (targetSlot !== null) {
      onSwap?.(index, targetSlot);
    }
    setActiveDragIndex(null);
    setDraggingPosition(null);
    setDraggedPlayerPosition(null);
  }

  /** Percentage coordinates of a drop inside the pitch box, clamped so a shirt can never be parked
   *  half outside the touchline. */
  function pointFromEvent(e: React.DragEvent): { x: number; y: number } {
    const rect = pitchRef.current ? pitchRef.current.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.max(5, Math.min(95, v));
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100),
    };
  }

  /** Which shirt, if any, the manager meant to land on. Without this, dropping a player onto a
   *  team-mate would silently stack them instead of swapping. The radius is generous on purpose: the
   *  old build only accepted a drop that landed inside the badge itself, which is why placing anyone
   *  felt like it "only works sometimes". */
  function slotNear(point: { x: number; y: number }, exceptIndex: number | null): number | null {
    const HIT_RADIUS = 7;
    let bestIndex: number | null = null;
    let bestDistance = Infinity;
    for (let i = 0; i < slots.length; i += 1) {
      if (i === exceptIndex) continue;
      const distance = Math.hypot(slots[i].x - point.x, slots[i].y - point.y);
      if (distance <= HIT_RADIUS && distance < bestDistance) {
        bestIndex = i;
        bestDistance = distance;
      }
    }
    return bestIndex;
  }

  /** Any player can go in any slot — the manager might genuinely want an ATT-labeled forward playing as
   *  an auxiliary midfielder, or just be reshaping a formation on the fly. The slot's `position` is a
   *  layout hint, not a hard requirement (only the function markers below stay position-gated, since
   *  those represent an actual tactical sub-role a player either can or can't plausibly fill). */
  function handleSlotDragOver(e: React.DragEvent) {
    if (draggedPlayerPosition) e.preventDefault();
  }

  function handleSlotDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    // The pitch behind this badge is a drop target too; without this the same drop would be handled
    // twice, swapping and then immediately moving.
    e.stopPropagation();
    setDraggingPosition(null);
    const playerId = e.dataTransfer.getData(DND_PLAYER_ID);
    if (!playerId) return;

    const sourceSlotRaw = e.dataTransfer.getData(DND_SOURCE_SLOT);
    if (sourceSlotRaw) {
      const fromIndex = Number(sourceSlotRaw);
      if (fromIndex !== index) onSwap?.(fromIndex, index);
    } else {
      onSelect(index, playerId);
    }
  }

  /**
   * Anywhere on the grass is a valid destination.
   *
   * Landing on (or near) a team-mate still swaps the two, which is the familiar behaviour. Landing on
   * open space parks the player exactly there — including in a zone the formation never asked for,
   * which the simulation then honours (see `effectiveSlotPositions`). A bench player dropped on open
   * space takes the nearest empty shirt, or the nearest occupied one if the eleven is already full.
   */
  function handlePitchDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingPosition(null);
    setDraggedPlayerPosition(null);

    const playerId = e.dataTransfer.getData(DND_PLAYER_ID);
    if (!playerId) return;
    const point = pointFromEvent(e);

    const sourceSlotRaw = e.dataTransfer.getData(DND_SOURCE_SLOT);
    if (sourceSlotRaw) {
      const fromIndex = Number(sourceSlotRaw);
      const target = slotNear(point, fromIndex);
      if (target !== null) onSwap?.(fromIndex, target);
      else onMove?.(fromIndex, point.x, point.y);
      return;
    }

    // From the bench.
    const onTeammate = slotNear(point, null);
    if (onTeammate !== null) {
      onSelect(onTeammate, playerId);
      return;
    }
    const emptyIndex = selections.findIndex((id) => !id);
    let targetIndex = emptyIndex;
    if (targetIndex < 0) {
      let nearest = 0;
      let nearestDistance = Infinity;
      for (let i = 0; i < slots.length; i += 1) {
        const distance = Math.hypot(slots[i].x - point.x, slots[i].y - point.y);
        if (distance < nearestDistance) {
          nearest = i;
          nearestDistance = distance;
        }
      }
      targetIndex = nearest;
    }
    onSelect(targetIndex, playerId);
    onMove?.(targetIndex, point.x, point.y);
  }

  function handleAssignFromMarker(playerId: string, fn: PlayerFunction) {
    onAssignFunction?.(playerId, fn);
    setDraggedPlayerPosition(null);
    setDraggingPosition(null);
  }

  /** A drag originating OUTSIDE this component (a bench `PlayerChip`) already set the module-level
   *  `draggedPlayerPosition` at its own dragstart — this just picks it up into local state so the pitch's
   *  own eligible-slot/eligible-function glow reacts to it too, the same as a pitch-internal drag does. */
  function handlePitchDragEnter() {
    if (draggedPlayerPosition) setDraggingPosition(draggedPlayerPosition);
  }

  function handlePitchDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDraggingPosition(null);
  }

  const highlightFunctions = draggingPosition ? new Set(FUNCTIONS_BY_POSITION[draggingPosition]) : null;

  return (
    <div className="pitch-board-wrapper">
      <div className="pitch-inspector-header">
        {hoveredPlayer && !hoveredIsVacated && hoveredSlot ? (
          <PitchPlayerDropdown
            player={hoveredPlayer}
            slotPosition={hoveredSlot.position}
            effectiveForce={effectiveForceInSlot(hoveredPlayer, hoveredSlot.position)}
            isOutOfPosition={!!hoveredOutOfPosition}
            isCaptain={!!hoveredCaptain}
            stamina={hoveredStamina}
            roles={rolesByPlayerId?.[hoveredPlayer.id]}
            booked={bookedPlayerIds?.has(hoveredPlayer.id)}
            showTacticalFunction={effectiveViewMode === 'TACTICAL'}
          />
        ) : (
          <div className="pitch-inspector-placeholder">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6 }} aria-hidden="true">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              Passe o mouse sobre um atleta no campo para inspecionar atributos e papel tático
            </span>
          </div>
        )}
      </div>

      {/* Toggle de Modo de Prancheta no topo (acima do gramado para não cobrir atacantes) */}
      <div className="pitch-view-mode-bar" role="toolbar" aria-label="Modo de visualização da prancheta">
        <div className="pitch-view-mode-toggle">
          <button
            type="button"
            className={`pitch-view-toggle-btn ${effectiveViewMode === 'SIMPLE' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('SIMPLE')}
            data-testid="toggle-view-simple"
            title="Visão Simples: visual limpo e direto da escalação"
          >
            <EyeIcon size={14} style={{ marginRight: 6 }} />
            Visão Simples
          </button>
          <button
            type="button"
            className={`pitch-view-toggle-btn ${effectiveViewMode === 'TACTICAL' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('TACTICAL')}
            data-testid="toggle-view-tactical"
            title="Prancheta Tática: linhas de dinâmica, sinergia e postura de campo"
          >
            <TacticsIcon size={14} style={{ marginRight: 6 }} />
            Prancheta Tática
          </button>
        </div>
      </div>

      <div
        ref={pitchRef}
        className={compact ? 'pitch pitch-compact' : 'pitch'}
        style={kitStyle(kitColor)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handlePitchDrop}
        onDragEnter={handlePitchDragEnter}
        onDragLeave={handlePitchDragLeave}
      >
        <PitchMarkings />
        {effectiveViewMode === 'TACTICAL' && (defensiveLine || attackStyle || pressing) && (
          <PitchTacticalOverlay
            defensiveLine={defensiveLine}
            attackStyle={attackStyle}
            pressing={pressing}
          />
        )}
        {effectiveViewMode === 'TACTICAL' && partnerships.length > 0 && (
          <PitchPartnershipLines
            partnerships={partnerships}
            playerCoords={playerCoords}
          />
        )}
        <FunctionMarkersLayer
          highlightFunctions={highlightFunctions}
          onDropOnMarker={onAssignFunction ? handleAssignFromMarker : undefined}
        />
      {slots.map((slot, i) => {
        const selectedId = selections[i];
        const selectedPlayer = selectedId ? byId.get(selectedId) : undefined;
        const isVacated = !!selectedPlayer && !!vacatedPlayerIds?.has(selectedPlayer.id);
        const isOutOfPosition = !!selectedPlayer && !isVacated && selectedPlayer.position !== slot.position && !selectedPlayer.secondaryPositions?.includes(slot.position);
        const stamina = selectedPlayer
          ? currentMatchMinute !== undefined
            ? calculateInMatchStamina(selectedPlayer, currentMatchMinute)
            : Math.round(Math.max(0, 100 - (selectedPlayer.fatigue ?? 0)))
          : 100;
        const badgeClass = `pitch-slot-badge${selectedPlayer ? ' filled' : ' dormant'}${
          isVacated ? ' vacated' : ''
        }${isOutOfPosition ? ' out-of-position' : ''}${slot.position === 'GK' ? ' keeper' : ''}${
          activeDragIndex === i ? ' is-dragging' : ''
        }`;
        const badgeTitle = isVacated
          ? `${selectedPlayer!.name} deixou o campo, esta posição está vaga`
          : selectedPlayer && isOutOfPosition
            ? `${selectedPlayer.name} • Fora de posição (${positionLabel(selectedPlayer.position)} jogando de ${positionLabel(slot.position)}), força reduzida em ${Math.round((1 - positionMismatchFactor(selectedPlayer.position, slot.position)) * 100)}% · Fôlego: ${stamina}%`
            : selectedPlayer
              ? `${selectedPlayer.name} (${positionLabel(selectedPlayer.position)}) · Força: ${effectiveForceInSlot(selectedPlayer, slot.position)} · Fôlego: ${stamina}%`
              : undefined;
        const isCaptain = !!selectedPlayer && !isVacated && !!rolesByPlayerId?.[selectedPlayer.id]?.includes('CAPTAIN');
        return (
          <div
            key={i}
            className="pitch-slot"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div
              className={badgeClass}
              title={badgeTitle}
              draggable={!!selectedPlayer}
              onDragStart={selectedPlayer ? (e) => handleBadgeDragStart(e, i, selectedPlayer) : undefined}
              onDragEnd={() => {
                setDraggedPlayerPosition(null);
                setDraggingPosition(null);
                setActiveDragIndex(null);
              }}
              onPointerDown={selectedPlayer && !isVacated ? (e) => handlePointerDown(e, i, selectedPlayer) : undefined}
              onPointerMove={selectedPlayer && !isVacated ? (e) => handlePointerMove(e, i) : undefined}
              onPointerUp={selectedPlayer && !isVacated ? (e) => handlePointerUp(e, i) : undefined}
              onPointerCancel={selectedPlayer && !isVacated ? (e) => handlePointerUp(e, i) : undefined}
              onDragOver={handleSlotDragOver}
              onDrop={(e) => handleSlotDrop(e, i)}
            >
              <TeamJersey
                clubSlug={clubSlug}
                kitColor={kitColor}
                kitPattern={kitPattern}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                isKeeper={slot.position === 'GK'}
                isAway={isAway}
                className="pitch-slot-jersey"
              />
              <span className="pitch-slot-badge-label">
                {selectedPlayer && !isVacated ? null : positionLabel(slot.position)}
              </span>
              {isVacated && (
                <span className="pitch-slot-vacated-icon" aria-hidden="true" title="Expulso">
                  <span className="status-suspended" style={{ display: 'inline-block', width: 9, height: 13 }} />
                </span>
              )}
              {selectedPlayer && !isVacated && (
                <PlayerStatusMarks
                  injured={(selectedPlayer.injuryWeeks ?? 0) > 0}
                  suspended={(selectedPlayer.suspensions?.length ?? 0) > 0}
                  booked={bookedPlayerIds?.has(selectedPlayer.id)}
                  tier={getPlayerTier(selectedPlayer.overall, selectedPlayer.starLevel, selectedPlayer.diferenciado, selectedPlayer.age, selectedPlayer.potential, selectedPlayer.name)}
                />
              )}
              {isOutOfPosition && (
                <span className="pitch-slot-badge-warning" aria-hidden="true" title="Fora de posição">
                  <AlertTriangleIcon size={10} color="#f59e0b" />
                </span>
              )}
            </div>
            {selectedPlayer && !isVacated && (
              <div className="pitch-slot-summary-card">
                <div className="pitch-slot-summary-main">
                  <span className="pitch-slot-pos-badge">{positionLabel(slot.position)}</span>
                  <span className="pitch-slot-name-label">{surnameFromName(selectedPlayer.name)}</span>
                  <span className={`pitch-slot-force-tag${isOutOfPosition ? ' out-of-position' : ''}`}>
                    {effectiveForceInSlot(selectedPlayer, slot.position)}
                  </span>
                  {isCaptain && <span className="pitch-legend-captain-tag">©</span>}
                  {isOutOfPosition && (
                    <span className="pitch-slot-badge-warning" style={{ display: 'inline-flex', alignItems: 'center' }} title="Fora de posição">
                      <AlertTriangleIcon size={9} color="#f59e0b" />
                    </span>
                  )}
                </div>
                {effectiveViewMode === 'TACTICAL' && (() => {
                  const dyn = getDynamicTacticalRole(slot.x, slot.y, selectedPlayer);
                  return <div className="pitch-slot-dynamic-role" title={`Função Dinâmica: ${dyn.label}`}>{dyn.shortLabel ?? dyn.label}</div>;
                })()}
                {effectiveViewMode === 'TACTICAL' && (
                  <div style={{ marginTop: 2 }}>
                    <PlayerFunctionPill player={selectedPlayer} />
                  </div>
                )}
                <div className="pitch-slot-mini-stamina">
                  <span
                    className="pitch-slot-mini-stamina-fill"
                    style={{
                      width: `${stamina}%`,
                      backgroundColor: getStaminaColor(stamina),
                    }}
                  />
                </div>
              </div>
            )}
            {isVacated && (
              <div className="pitch-slot-caption">
                <span className="pitch-slot-name pitch-slot-vacated">
                  <span className="status-suspended" style={{ display: 'inline-block', width: 7, height: 10, marginRight: 4 }} />
                  Expulso
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
    {effectiveViewMode === 'TACTICAL' && partnerships.length > 0 && (
      <PartnershipSummaryBar partnerships={partnerships} />
    )}
  </div>
  );
}
