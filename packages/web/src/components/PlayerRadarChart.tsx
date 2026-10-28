import React from 'react';
import type { Player } from '@tactical-arena/shared';

export interface RadarAttributes {
  vel: number;
  fin: number;
  pas: number;
  def: number;
  fis: number;
  tecOrGk: number;
}

export interface RadarAxis {
  key: keyof RadarAttributes;
  label: string;
  fullName: string;
}

export interface PlayerRadarChartProps {
  primaryPlayer: Player;
  secondaryPlayer?: Player | null;
  size?: number;
  showLegend?: boolean;
  className?: string;
}

/**
 * Extrai de forma resiliente os 6 atributos dos eixos do radar,
 * garantindo fallback seguro caso player.attributes esteja incompleto ou ausente.
 */
export function extractRadarAttributes(
  player?: Player | null,
  isGoalkeeperAxis: boolean = false,
): RadarAttributes {
  if (!player) {
    return { vel: 50, fin: 50, pas: 50, def: 50, fis: 50, tecOrGk: 50 };
  }

  const fallback = typeof player.overall === 'number' ? Math.round(player.overall) : 70;
  const attrs = player.attributes;

  const vel = Math.max(1, Math.min(99, attrs?.pace ?? fallback));
  const fin = Math.max(1, Math.min(99, attrs?.finishing ?? fallback));
  const pas = Math.max(1, Math.min(99, attrs?.passing ?? fallback));
  const def = Math.max(1, Math.min(99, attrs?.defending ?? fallback));
  const fis = Math.max(1, Math.min(99, attrs?.physical ?? fallback));

  let tecOrGk: number;
  if (isGoalkeeperAxis) {
    tecOrGk = Math.max(
      1,
      Math.min(99, attrs?.goalkeeping ?? (player.position === 'GK' ? fallback : 20)),
    );
  } else {
    // Para jogadores de linha, técnica é a média de passe e finalização
    tecOrGk = Math.max(1, Math.min(99, Math.round((pas + fin) / 2)));
  }

  return { vel, fin, pas, def, fis, tecOrGk };
}

/**
 * Radar Poligonal Hexagonal SVG de 6 Eixos:
 * 1. VEL (Pace / Velocidade)
 * 2. FIN (Finishing / Finalização)
 * 3. PAS (Passing / Passe)
 * 4. DEF (Defending / Defesa)
 * 5. FIS (Physical / Físico)
 * 6. GK / TEC (Goalkeeping para goleiros ou Técnica Geral para atletas de linha)
 */
export function PlayerRadarChart({
  primaryPlayer,
  secondaryPlayer,
  size = 260,
  showLegend = true,
  className = '',
}: PlayerRadarChartProps) {
  const isGkAxis =
    primaryPlayer.position === 'GK' &&
    (!secondaryPlayer || secondaryPlayer.position === 'GK');

  const axes: RadarAxis[] = [
    { key: 'vel', label: 'VEL', fullName: 'Velocidade' },
    { key: 'fin', label: 'FIN', fullName: 'Finalização' },
    { key: 'pas', label: 'PAS', fullName: 'Passe' },
    { key: 'def', label: 'DEF', fullName: 'Defesa' },
    { key: 'fis', label: 'FIS', fullName: 'Físico' },
    { key: 'tecOrGk', label: isGkAxis ? 'GK' : 'TEC', fullName: isGkAxis ? 'Goleiro' : 'Técnica' },
  ];

  const primaryValues = extractRadarAttributes(primaryPlayer, isGkAxis);
  const secondaryValues = secondaryPlayer
    ? extractRadarAttributes(secondaryPlayer, isGkAxis)
    : null;

  // Centro e dimensão base do viewBox 260x260
  const cx = 130;
  const cy = 130;
  const maxRadius = 78;
  const labelRadius = maxRadius + 24;

  // 6 ângulos (a cada 60 graus = Math.PI / 3), iniciando no topo (-Math.PI / 2)
  const angles = axes.map((_, i) => -Math.PI / 2 + (i * Math.PI) / 3);

  // Calcula coordenadas dos vértices de um conjunto de valores (0..100)
  function computePoints(values: RadarAttributes): { x: number; y: number }[] {
    return axes.map((axis, i) => {
      const val = Math.max(0, Math.min(100, values[axis.key]));
      const r = (val / 100) * maxRadius;
      return {
        x: cx + r * Math.cos(angles[i]),
        y: cy + r * Math.sin(angles[i]),
      };
    });
  }

  const primaryCoords = computePoints(primaryValues);
  const secondaryCoords = secondaryValues ? computePoints(secondaryValues) : null;

  const primaryPointsString = primaryCoords.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
  const secondaryPointsString = secondaryCoords
    ? secondaryCoords.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
    : '';

  // Níveis de grade concêntrica (25%, 50%, 75%, 100%)
  const gridLevels = [25, 50, 75, 100];

  return (
    <div className={`player-radar-container ${className}`} data-testid="player-radar-chart">
      <svg
        viewBox="0 0 260 260"
        width={size}
        height={size}
        className="player-radar-svg"
        aria-label={`Radar de Atributos: ${primaryPlayer.name}${secondaryPlayer ? ` vs ${secondaryPlayer.name}` : ''}`}
      >
        <defs>
          {/* Gradiente sutil para o jogador primário (Esmeralda) */}
          <radialGradient id="radar-glow-primary" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.12" />
          </radialGradient>

          {/* Gradiente sutil para o jogador secundário (Ciano) */}
          <radialGradient id="radar-glow-secondary" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.12" />
          </radialGradient>
        </defs>

        {/* Grades Concêntricas Hexagonais de Fundo */}
        <g className="radar-grid-rings" aria-hidden="true">
          {gridLevels.map((level) => {
            const r = (level / 100) * maxRadius;
            const pts = angles
              .map((angle) => {
                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ');

            return (
              <polygon
                key={`grid-${level}`}
                points={pts}
                className={`radar-grid-polygon radar-grid-level-${level}`}
                fill={level === 100 ? 'rgba(255, 255, 255, 0.02)' : 'none'}
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth={level === 100 ? '1.4' : '0.8'}
                strokeDasharray={level === 50 ? '3 3' : undefined}
              />
            );
          })}

          {/* Linhas Radiais dos 6 Eixos */}
          {angles.map((angle, i) => {
            const x2 = cx + maxRadius * Math.cos(angle);
            const y2 = cy + maxRadius * Math.sin(angle);
            return (
              <line
                key={`axis-line-${i}`}
                x1={cx}
                y1={cy}
                x2={x2}
                y2={y2}
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="1"
              />
            );
          })}
        </g>

        {/* Polígono do Jogador Secundário (B - Azul Ciano) se houver sobreposição */}
        {secondaryCoords && (
          <g className="radar-polygon-group secondary">
            <polygon
              points={secondaryPointsString}
              className="radar-polygon-secondary"
              fill="rgba(56, 189, 248, 0.28)"
              stroke="#38bdf8"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            {secondaryCoords.map((pt, i) => (
              <circle
                key={`sec-vertex-${i}`}
                cx={pt.x}
                cy={pt.y}
                r="3"
                className="radar-vertex-dot secondary"
                fill="#38bdf8"
                stroke="#0f172a"
                strokeWidth="1"
              />
            ))}
          </g>
        )}

        {/* Polígono do Jogador Primário (A - Verde Esmeralda) */}
        <g className="radar-polygon-group primary">
          <polygon
            points={primaryPointsString}
            className="radar-polygon-primary"
            fill="rgba(16, 185, 129, 0.28)"
            stroke="#10b981"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {primaryCoords.map((pt, i) => (
            <circle
              key={`prim-vertex-${i}`}
              cx={pt.x}
              cy={pt.y}
              r="3.2"
              className="radar-vertex-dot primary"
              fill="#10b981"
              stroke="#064e3b"
              strokeWidth="1"
            />
          ))}
        </g>

        {/* Rótulos e Valores dos 6 Eixos */}
        <g className="radar-axis-labels" aria-hidden="true">
          {axes.map((axis, i) => {
            const angle = angles[i];
            const lx = cx + labelRadius * Math.cos(angle);
            const ly = cy + labelRadius * Math.sin(angle);

            const pVal = primaryValues[axis.key];
            const sVal = secondaryValues ? secondaryValues[axis.key] : null;

            // Ajuste fino do alinhamento do texto dependendo do quadrante
            let textAnchor: 'middle' | 'start' | 'end' = 'middle';
            if (Math.abs(Math.cos(angle)) > 0.3) {
              textAnchor = Math.cos(angle) > 0 ? 'start' : 'end';
            }

            return (
              <g key={`axis-label-${axis.key}`} className="radar-label-group">
                <text
                  x={lx}
                  y={ly - 4}
                  textAnchor={textAnchor}
                  className="radar-axis-text"
                  fill="#e2e8f0"
                  fontSize="10"
                  fontWeight="800"
                  letterSpacing="0.04em"
                >
                  {axis.label}
                </text>
                <text
                  x={lx}
                  y={ly + 8}
                  textAnchor={textAnchor}
                  className="radar-axis-value"
                  fontSize="9.5"
                  fontWeight="700"
                >
                  <tspan fill="#10b981">{pVal}</tspan>
                  {sVal !== null && (
                    <>
                      <tspan fill="rgba(255,255,255,0.4)"> / </tspan>
                      <tspan fill="#38bdf8">{sVal}</tspan>
                    </>
                  )}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legenda dos Jogadores */}
      {showLegend && (
        <div className="player-radar-legend">
          <div className="radar-legend-item primary">
            <span className="radar-legend-swatch primary" aria-hidden="true" />
            <span className="radar-legend-name">{primaryPlayer.name}</span>
            <span className="radar-legend-ovr">({Math.round(primaryPlayer.overall)} OVR)</span>
          </div>
          {secondaryPlayer && (
            <div className="radar-legend-item secondary">
              <span className="radar-legend-swatch secondary" aria-hidden="true" />
              <span className="radar-legend-name">{secondaryPlayer.name}</span>
              <span className="radar-legend-ovr">({Math.round(secondaryPlayer.overall)} OVR)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
