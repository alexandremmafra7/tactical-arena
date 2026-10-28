import React, { useState, useEffect } from 'react';
import {
  autoAssignBestRolesForPlayer,
  getPlayerTier,
  type Player,
  type PlayerFunction,
} from '@tactical-arena/shared';
import { PlayerRadarChart, extractRadarAttributes } from './PlayerRadarChart.js';
import { positionLabel } from '../lib/positionLabel.js';
import { functionLabel } from '../lib/functionLabel.js';
import { BarChartIcon, ClipboardIcon } from './icons/AppIcons.js';

export interface PlayerComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryPlayer: Player;
  secondaryPlayer?: Player | null;
  squad?: Player[];
  onSelectSecondaryPlayer?: (player: Player) => void;
}

function formatMoney(n?: number): string {
  if (typeof n !== 'number') return 'R$ 0';
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${n}`;
}

/**
 * Gera um veredito analítico contextual no padrão de scouting do Football Manager,
 * avaliando vantagens de atributos, potencial de evolução e encaixe tático.
 */
export function generateScoutVerdict(playerA: Player, playerB: Player): string {
  const isGk = playerA.position === 'GK' && playerB.position === 'GK';
  const attrsA = extractRadarAttributes(playerA, isGk);
  const attrsB = extractRadarAttributes(playerB, isGk);

  const diffOvr = Math.round(playerB.overall) - Math.round(playerA.overall);
  const diffPot = playerB.potential - playerA.potential;
  const diffAge = playerB.age - playerA.age;

  // Analisa onde o Jogador B leva vantagem expressiva (>= 3 pontos)
  const bAdvantages: string[] = [];
  if (attrsB.vel - attrsA.vel >= 3) bAdvantages.push(`+${attrsB.vel - attrsA.vel} em Velocidade`);
  if (attrsB.fin - attrsA.fin >= 3) bAdvantages.push(`+${attrsB.fin - attrsA.fin} em Finalização`);
  if (attrsB.pas - attrsA.pas >= 3) bAdvantages.push(`+${attrsB.pas - attrsA.pas} em Passe`);
  if (attrsB.def - attrsA.def >= 3) bAdvantages.push(`+${attrsB.def - attrsA.def} em Defesa`);
  if (attrsB.fis - attrsA.fis >= 3) bAdvantages.push(`+${attrsB.fis - attrsA.fis} em Físico`);
  if (attrsB.tecOrGk - attrsA.tecOrGk >= 3) {
    bAdvantages.push(`+${attrsB.tecOrGk - attrsA.tecOrGk} em ${isGk ? 'Goleiro' : 'Técnica'}`);
  }

  // Analisa onde o Jogador A mantém liderança expressiva (>= 3 pontos)
  const aAdvantages: string[] = [];
  if (attrsA.vel - attrsB.vel >= 3) aAdvantages.push(`+${attrsA.vel - attrsB.vel} em Velocidade`);
  if (attrsA.fin - attrsB.fin >= 3) aAdvantages.push(`+${attrsA.fin - attrsB.fin} em Finalização`);
  if (attrsA.pas - attrsB.pas >= 3) aAdvantages.push(`+${attrsA.pas - attrsB.pas} em Passe`);
  if (attrsA.def - attrsB.def >= 3) aAdvantages.push(`+${attrsA.def - attrsB.def} em Defesa`);
  if (attrsA.fis - attrsB.fis >= 3) aAdvantages.push(`+${attrsA.fis - attrsB.fis} em Físico`);

  // 1. Caso de Upgrade Direto de Força
  if (diffOvr >= 3 && bAdvantages.length > 0) {
    return `${playerB.name} oferece ${bAdvantages.slice(0, 2).join(' e ')}, sendo um upgrade direto (+${diffOvr} OVR) sobre ${playerA.name}.`;
  }

  // 2. Caso de Aposta de Futuro (Mais Jovem e Maior Potencial)
  if (diffAge <= -2 && diffPot >= 3) {
    const mainLead = bAdvantages[0] ? ` com destaque de ${bAdvantages[0]}` : '';
    const sacrifice = aAdvantages[0] ? `, embora ${playerA.name} ainda lidere ${aAdvantages[0]}` : '';
    return `${playerB.name} é ${Math.abs(diffAge)} anos mais jovem e tem teto maior (+${diffPot} Potencial)${mainLead}${sacrifice}. Excelente oportunidade a médio prazo.`;
  }

  // 3. Caso em que o Jogador A é superior
  if (diffOvr <= -3) {
    const lead = aAdvantages[0] ? ` (+${diffOvr * -1} OVR, ${aAdvantages[0]})` : ` (+${diffOvr * -1} OVR)`;
    return `${playerA.name} mantém superioridade técnica${lead}. A contratação de ${playerB.name} serviria prioritariamente para rotação de elenco.`;
  }

  // 4. Caso de Perfil Específico / Complementar
  if (bAdvantages.length > 0 && aAdvantages.length > 0) {
    return `Atletas de nível semelhante: ${playerB.name} se destaca em ${bAdvantages[0]}, enquanto ${playerA.name} responde com ${aAdvantages[0]}. Escolha baseada no encaixe tático desejado.`;
  }

  return `Atletas de nível muito equilibrado (${Math.round(playerA.overall)} vs ${Math.round(playerB.overall)} OVR), com pouca variação física e técnica.`;
}

export function PlayerComparisonModal({
  isOpen,
  onClose,
  primaryPlayer,
  secondaryPlayer: initialSecondary,
  squad,
  onSelectSecondaryPlayer,
}: PlayerComparisonModalProps) {
  // Permite selecionar outro atleta do elenco para comparar
  const [selectedSecondaryId, setSelectedSecondaryId] = useState<string>(
    initialSecondary?.id ?? '',
  );

  useEffect(() => {
    if (initialSecondary) {
      setSelectedSecondaryId(initialSecondary.id);
    } else if (squad && squad.length > 0) {
      // Prioriza encontrar alguém da mesma posição diferente do primaryPlayer
      const samePos = squad.find(
        (p) => p.id !== primaryPlayer.id && p.position === primaryPlayer.position,
      );
      const fallback = squad.find((p) => p.id !== primaryPlayer.id);
      setSelectedSecondaryId(samePos?.id ?? fallback?.id ?? '');
    }
  }, [initialSecondary, primaryPlayer.id, primaryPlayer.position, squad]);

  if (!isOpen) return null;

  const currentSecondary =
    squad?.find((p) => p.id === selectedSecondaryId) ?? initialSecondary ?? null;

  const isGk =
    primaryPlayer.position === 'GK' &&
    (!currentSecondary || currentSecondary.position === 'GK');

  const attrsA = extractRadarAttributes(primaryPlayer, isGk);
  const attrsB = currentSecondary ? extractRadarAttributes(currentSecondary, isGk) : null;

  const rolesA = autoAssignBestRolesForPlayer(primaryPlayer);
  const rolesB = currentSecondary ? autoAssignBestRolesForPlayer(currentSecondary) : [];

  const tierA = getPlayerTier(
    primaryPlayer.overall,
    primaryPlayer.starLevel,
    primaryPlayer.diferenciado,
    primaryPlayer.age,
    primaryPlayer.potential,
    primaryPlayer.name,
  );

  const tierB = currentSecondary
    ? getPlayerTier(
        currentSecondary.overall,
        currentSecondary.starLevel,
        currentSecondary.diferenciado,
        currentSecondary.age,
        currentSecondary.potential,
        currentSecondary.name,
      )
    : null;

  const verdict = currentSecondary
    ? generateScoutVerdict(primaryPlayer, currentSecondary)
    : 'Selecione um segundo atleta para gerar a comparação completa.';

  // Lista dos 6 atributos para as barras
  const metricsList = [
    { label: 'Velocidade (VEL)', valA: attrsA.vel, valB: attrsB?.vel ?? 50 },
    { label: 'Finalização (FIN)', valA: attrsA.fin, valB: attrsB?.fin ?? 50 },
    { label: 'Passe (PAS)', valA: attrsA.pas, valB: attrsB?.pas ?? 50 },
    { label: 'Defesa (DEF)', valA: attrsA.def, valB: attrsB?.def ?? 50 },
    { label: 'Físico (FIS)', valA: attrsA.fis, valB: attrsB?.fis ?? 50 },
    {
      label: isGk ? 'Goleiro (GK)' : 'Técnica (TEC)',
      valA: attrsA.tecOrGk,
      valB: attrsB?.tecOrGk ?? 50,
    },
  ];

  return (
    <div
      className="modal-backdrop player-comparison-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-modal-title"
      data-testid="player-comparison-modal"
    >
      <div
        className="modal-box player-comparison-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="player-comparison-header">
          <div className="comparison-header-title-row">
            <span className="comparison-header-icon" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <BarChartIcon size={20} color="#a855f7" />
            </span>
            <div>
              <h2 id="comparison-modal-title" className="comparison-modal-title">
                Comparador Tático de Atletas
              </h2>
              <p className="comparison-modal-subtitle">
                Análise poligonal de 6 eixos, balanço de atributos e recomendação técnica
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-close-comparison"
            onClick={onClose}
            aria-label="Fechar comparador de atletas"
          >
            ✕
          </button>
        </div>

        {/* Players Top Cards Grid */}
        <div className="comparison-players-grid">
          {/* Card Jogador A (Referência / Verde) */}
          <div className="comparison-player-card primary">
            <div className="comparison-player-badge-role">
              <span className="player-position-pill primary">
                {positionLabel(primaryPlayer.position)}
              </span>
              <span className="player-side-tag primary">Seu Jogador</span>
            </div>
            <h3 className="comparison-player-name">{primaryPlayer.name}</h3>
            <div className="comparison-player-stats-row">
              <span className="stat-pill ovr primary">
                <strong>{Math.round(primaryPlayer.overall)}</strong> OVR
              </span>
              <span className="stat-pill pot">
                Pot <strong>{primaryPlayer.potential}</strong>
              </span>
              <span className="stat-pill age">{primaryPlayer.age} anos</span>
              <span className="stat-pill value">{formatMoney(primaryPlayer.marketValue)}</span>
            </div>
            {rolesA.length > 0 && (
              <div className="comparison-player-role-ideal">
                <span className="role-ideal-label">Papel Tático Ideal:</span>
                <span className="role-ideal-badge">{functionLabel(rolesA[0])}</span>
              </div>
            )}
          </div>

          {/* VS Divider Badge */}
          <div className="comparison-vs-badge" aria-hidden="true">
            <span>VS</span>
          </div>

          {/* Card Jogador B (Alvo / Ciano) */}
          <div className="comparison-player-card secondary">
            <div className="comparison-player-badge-role">
              {currentSecondary ? (
                <>
                  <span className="player-position-pill secondary">
                    {positionLabel(currentSecondary.position)}
                  </span>
                  <span className="player-side-tag secondary">Comparado / Alvo</span>
                </>
              ) : (
                <span className="player-side-tag secondary">Selecione Atleta</span>
              )}
            </div>

            {/* Dropdown de Seleção de Adversário/Colega */}
            {squad && squad.length > 1 ? (
              <div className="comparison-select-group">
                <label htmlFor="select-secondary-player" className="sr-only">
                  Trocar jogador para comparação
                </label>
                <select
                  id="select-secondary-player"
                  className="comparison-player-select"
                  value={selectedSecondaryId}
                  onChange={(e) => {
                    setSelectedSecondaryId(e.target.value);
                    const found = squad.find((p) => p.id === e.target.value);
                    if (found && onSelectSecondaryPlayer) {
                      onSelectSecondaryPlayer(found);
                    }
                  }}
                >
                  {squad
                    .filter((p) => p.id !== primaryPlayer.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({positionLabel(p.position)} · {Math.round(p.overall)} OVR)
                      </option>
                    ))}
                </select>
              </div>
            ) : currentSecondary ? (
              <h3 className="comparison-player-name">{currentSecondary.name}</h3>
            ) : null}

            {currentSecondary && (
              <>
                <div className="comparison-player-stats-row">
                  <span className="stat-pill ovr secondary">
                    <strong>{Math.round(currentSecondary.overall)}</strong> OVR
                  </span>
                  <span className="stat-pill pot">
                    Pot <strong>{currentSecondary.potential}</strong>
                  </span>
                  <span className="stat-pill age">{currentSecondary.age} anos</span>
                  <span className="stat-pill value">
                    {formatMoney(currentSecondary.marketValue)}
                  </span>
                </div>
                {rolesB.length > 0 && (
                  <div className="comparison-player-role-ideal">
                    <span className="role-ideal-label">Papel Tático Ideal:</span>
                    <span className="role-ideal-badge">{functionLabel(rolesB[0])}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Center: Radar & Overview Metrics */}
        <div className="comparison-body-grid">
          {/* Radar Poligonal */}
          <div className="comparison-radar-col">
            <PlayerRadarChart
              primaryPlayer={primaryPlayer}
              secondaryPlayer={currentSecondary}
              size={250}
              showLegend={false}
            />
          </div>

          {/* Comparativo de Barras Atributo por Atributo */}
          <div className="comparison-bars-col">
            <h4 className="comparison-bars-title">Confronto Direto de Atributos</h4>
            <div className="comparison-bars-list">
              {metricsList.map((metric) => {
                const diff = metric.valB - metric.valA;
                return (
                  <div key={metric.label} className="comparison-bar-row">
                    <div className="comparison-bar-labels">
                      <span className="val-a-text">{metric.valA}</span>
                      <span className="metric-name-text">{metric.label}</span>
                      <span className="val-b-text">{metric.valB}</span>
                    </div>

                    <div className="comparison-progress-track">
                      {/* Lado A (Esquerda) */}
                      <div className="progress-half left">
                        <div
                          className="progress-fill primary"
                          style={{ width: `${Math.min(100, (metric.valA / 99) * 100)}%` }}
                        />
                      </div>
                      {/* Lado B (Direita) */}
                      <div className="progress-half right">
                        <div
                          className="progress-fill secondary"
                          style={{ width: `${Math.min(100, (metric.valB / 99) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="comparison-delta-tag">
                      {diff > 0 ? (
                        <span className="delta-b">+{diff} {currentSecondary?.name.split(' ')[0]}</span>
                      ) : diff < 0 ? (
                        <span className="delta-a">+{Math.abs(diff)} {primaryPlayer.name.split(' ')[0]}</span>
                      ) : (
                        <span className="delta-eq">Empate</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scout Summary & Verdict Box */}
        <div className="comparison-verdict-box" data-testid="comparison-verdict-box">
          <div className="verdict-icon-title">
            <span className="verdict-icon" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <ClipboardIcon size={18} color="#a855f7" />
            </span>
            <strong>Veredito do Departamento de Scouting:</strong>
          </div>
          <p className="verdict-message">{verdict}</p>
        </div>

        {/* Modal Footer */}
        <div className="player-comparison-footer">
          <button type="button" className="btn-close-bottom" onClick={onClose}>
            Fechar Comparador
          </button>
        </div>
      </div>
    </div>
  );
}
