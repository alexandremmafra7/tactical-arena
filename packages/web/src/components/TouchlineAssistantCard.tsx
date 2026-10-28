import React from 'react';
import {
  calculateInMatchStamina,
  defensiveLineOf,
  type Club,
  type Match,
  type MatchEvent,
  type MatchSide,
  type Player,
  type Tactic,
} from '@tactical-arena/shared';
import { TacticsIcon, AlertTriangleIcon, CheckIcon } from './icons/AppIcons.js';

export interface TouchlineAlert {
  id: string;
  type: 'yellow_card_risk' | 'fatigue_warning' | 'tactical_vulnerability' | 'halftime_advice';
  severity: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  actionLabel: string;
  execute: () => void;
  targetPlayerId?: string;
  suggestedPlayerId?: string;
}

export interface TouchlineAssistantCardProps {
  myClub?: Club | null;
  myTactic?: Tactic | null;
  mySide?: MatchSide | null;
  match?: Match | null;
  currentMinute: number;
  bookedPlayerIds?: ReadonlySet<string>;
  vacatedPlayerIds?: ReadonlySet<string>;
  events?: MatchEvent[];
  homeShots?: number;
  awayShots?: number;
  homeXg?: number;
  awayXg?: number;
  isHalftime?: boolean;
  onApplySubstitution?: (outPlayerId: string, inPlayerId: string) => void;
  onApplyTacticalChange?: (changes: Partial<Tactic>) => void;
  /** Permite injetar alertas manuais ou mockados para testes / regras externas */
  customAlerts?: TouchlineAlert[];
}

/**
 * Encontra o melhor jogador reserva disponível para substituir o titular indicado.
 * Prioriza mesma posição, maior overall e menor fadiga, respeitando suspensões e lesões.
 */
export function findBestSubstitute(
  squad: Player[],
  tactic: Tactic,
  targetPlayer: Player,
  subbedOutIds: ReadonlySet<string> = new Set(),
): Player | null {
  const starterIds = new Set(tactic.lineup.map((s) => s.playerId));
  const availableBench = squad.filter(
    (p) =>
      !starterIds.has(p.id) &&
      !subbedOutIds.has(p.id) &&
      (p.injuryWeeks ?? 0) === 0 &&
      (p.suspensions?.length ?? 0) === 0,
  );

  if (availableBench.length === 0) return null;

  // 1. Tenta encontrar um reserva da mesma posição
  const samePosition = availableBench.filter((p) => p.position === targetPlayer.position);
  if (samePosition.length > 0) {
    samePosition.sort((a, b) => b.overall - a.overall || (a.fatigue ?? 0) - (b.fatigue ?? 0));
    return samePosition[0];
  }

  // 2. Fallback: melhor jogador geral do banco
  availableBench.sort((a, b) => b.overall - a.overall || (a.fatigue ?? 0) - (b.fatigue ?? 0));
  return availableBench[0];
}

/**
 * Analisa o contexto causal do jogo e gera os alertas e recomendações de beira de campo.
 */
export function generateTouchlineAlerts({
  myClub,
  myTactic,
  mySide,
  match,
  currentMinute,
  bookedPlayerIds = new Set(),
  vacatedPlayerIds = new Set(),
  events = [],
  homeShots = 0,
  awayShots = 0,
  homeXg = 0,
  awayXg = 0,
  isHalftime = false,
  onApplySubstitution,
  onApplyTacticalChange,
}: {
  myClub?: Club | null;
  myTactic?: Tactic | null;
  mySide?: MatchSide | null;
  match?: Match | null;
  currentMinute: number;
  bookedPlayerIds?: ReadonlySet<string>;
  vacatedPlayerIds?: ReadonlySet<string>;
  events?: MatchEvent[];
  homeShots?: number;
  awayShots?: number;
  homeXg?: number;
  awayXg?: number;
  isHalftime?: boolean;
  onApplySubstitution?: (outPlayerId: string, inPlayerId: string) => void;
  onApplyTacticalChange?: (changes: Partial<Tactic>) => void;
}): TouchlineAlert[] {
  const alerts: TouchlineAlert[] = [];
  if (!myClub || !myTactic) return alerts;

  const playerById = new Map(myClub.players.map((p) => [p.id, p]));
  const starters = myTactic.lineup
    .map((slot) => playerById.get(slot.playerId))
    .filter((p): p is Player => p !== undefined && !vacatedPlayerIds.has(p.id));

  // Coleta jogadores que já foram substituídos para não sugerir trocas inválidas
  const subbedOutIds = new Set<string>();
  for (const ev of events) {
    if (ev.type === 'substitution' && ev.team === mySide && ev.playerId) {
      subbedOutIds.add(ev.playerId);
    }
  }

  // Identifica postura pesada de divididas / marcação
  const hasAggressiveMarking =
    myTactic.markingStyle === 'HEAVY' ||
    (myTactic.markingStyle as string) === 'AGGRESSIVE' ||
    myTactic.pressing === 'HIGH_PRESS' ||
    (myTactic as any).tackling === 'HEAVY';

  // 1. Risco de Segundo Amarelo
  if (hasAggressiveMarking) {
    for (const player of starters) {
      if (bookedPlayerIds.has(player.id)) {
        const bestSub = findBestSubstitute(myClub.players, myTactic, player, subbedOutIds);
        alerts.push({
          id: `yellow-risk-${player.id}`,
          type: 'yellow_card_risk',
          severity: 'critical',
          title: 'Risco de Expulsão',
          message: `${player.name} pendurado — risco de expulsão em divididas fortes`,
          actionLabel: bestSub ? `Poupar / Substituir` : 'Abrandar Marcação',
          targetPlayerId: player.id,
          suggestedPlayerId: bestSub?.id,
          execute: () => {
            if (bestSub && onApplySubstitution) {
              onApplySubstitution(player.id, bestSub.id);
            } else if (onApplyTacticalChange) {
              onApplyTacticalChange({ markingStyle: 'BALANCED' });
            }
          },
        });
      }
    }
  }

  // 2. Esgotamento Físico (< 50% fôlego)
  for (const player of starters) {
    const stamina = calculateInMatchStamina(player, currentMinute);
    if (stamina < 50) {
      const bestSub = findBestSubstitute(myClub.players, myTactic, player, subbedOutIds);
      const actionText = bestSub ? `Substituir por ${bestSub.name}` : 'Trocar Jogador Esgotado';
      alerts.push({
        id: `fatigue-${player.id}`,
        type: 'fatigue_warning',
        severity: 'warning',
        title: 'Esgotamento Físico',
        message: `${player.name} sem fôlego (${Math.round(stamina)}%) — rendimento em queda`,
        actionLabel: actionText,
        targetPlayerId: player.id,
        suggestedPlayerId: bestSub?.id,
        execute: () => {
          if (bestSub && onApplySubstitution) {
            onApplySubstitution(player.id, bestSub.id);
          }
        },
      });
    }
  }

  // 3. Vulnerabilidade Tática: Linha Alta com adversário explorando bolas nas costas
  const defLine = defensiveLineOf(myTactic);
  const isHighLine = defLine === 'HIGH' || myTactic.defensiveLine === 'HIGH' || myTactic.pressing === 'HIGH_PRESS';

  const opponentShots = mySide === 'home' ? awayShots : homeShots;
  const opponentXg = mySide === 'home' ? awayXg : homeXg;

  // Finalizações recentes do rival nos últimos 15 minutos
  const recentOpponentThreats = events.filter((ev) => {
    const isOpponent = mySide === 'home' ? ev.team === 'away' : ev.team === 'home';
    const isRecent = currentMinute - ev.minute >= 0 && currentMinute - ev.minute <= 15;
    return isOpponent && isRecent && (ev.type === 'goal' || ev.shotOutcome !== undefined || ev.isPenalty);
  }).length;

  if (isHighLine && (opponentShots >= 3 || opponentXg >= 0.8 || recentOpponentThreats >= 2)) {
    alerts.push({
      id: 'vulnerability-high-line',
      type: 'tactical_vulnerability',
      severity: 'critical',
      title: 'Vulnerabilidade Tática',
      message: 'Adversário explorando bolas nas costas da zaga',
      actionLabel: 'Recuar Linha para Média',
      execute: () => {
        if (onApplyTacticalChange) {
          onApplyTacticalChange({
            defensiveLine: 'BALANCED',
            pressing: 'MEDIUM',
          });
        }
      },
    });
  }

  // 4. Pausas Táticas Rápidas no Intervalo (45')
  if (isHalftime || currentMinute === 45) {
    const myGoals = match?.live
      ? mySide === 'home'
        ? match.live.homeGoals
        : match.live.awayGoals
      : 0;
    const oppGoals = match?.live
      ? mySide === 'home'
        ? match.live.awayGoals
        : match.live.homeGoals
      : 0;

    if (myGoals > oppGoals) {
      alerts.push({
        id: 'halftime-preserve-lead',
        type: 'halftime_advice',
        severity: 'info',
        title: 'Estratégia do 2º Tempo',
        message: 'Vantagem no placar: proteger a defesa e punir em contra-ataques rápidos.',
        actionLabel: 'Mudar para Contra-Ataque',
        execute: () => {
          if (onApplyTacticalChange) {
            onApplyTacticalChange({
              attackApproach: 'COUNTER_ATTACK',
              mentality: 'defensive',
            });
          }
        },
      });
    } else {
      alerts.push({
        id: 'halftime-push-attack',
        type: 'halftime_advice',
        severity: 'info',
        title: 'Estratégia do 2º Tempo',
        message: 'Equipe precisa de volume ofensivo para furar o bloqueio adversário.',
        actionLabel: 'Pressionar Saída Rival',
        execute: () => {
          if (onApplyTacticalChange) {
            onApplyTacticalChange({
              mentality: 'attacking',
              pressing: 'HIGH_PRESS',
            });
          }
        },
      });
    }

    // Se houver jogador com fôlego abaixo de 65%, recomenda oxigenar time
    const tiredStarter = starters.find((p) => calculateInMatchStamina(p, 45) < 65);
    if (tiredStarter) {
      const bestSub = findBestSubstitute(myClub.players, myTactic, tiredStarter, subbedOutIds);
      if (bestSub) {
        alerts.push({
          id: `halftime-sub-${tiredStarter.id}`,
          type: 'halftime_advice',
          severity: 'warning',
          title: 'Oxigenação de Meio/Ataque',
          message: `Desgaste no 1º tempo: ${tiredStarter.name} com pernas pesadas para a etapa final.`,
          actionLabel: `Substituir por ${bestSub.name}`,
          targetPlayerId: tiredStarter.id,
          suggestedPlayerId: bestSub.id,
          execute: () => {
            if (onApplySubstitution) {
              onApplySubstitution(tiredStarter.id, bestSub.id);
            }
          },
        });
      }
    }
  }

  return alerts;
}

export function TouchlineAssistantCard({
  myClub,
  myTactic,
  mySide,
  match,
  currentMinute,
  bookedPlayerIds = new Set(),
  vacatedPlayerIds = new Set(),
  events = [],
  homeShots = 0,
  awayShots = 0,
  homeXg = 0,
  awayXg = 0,
  isHalftime = false,
  onApplySubstitution,
  onApplyTacticalChange,
  customAlerts,
}: TouchlineAssistantCardProps) {
  const activeAlerts =
    customAlerts ??
    generateTouchlineAlerts({
      myClub,
      myTactic,
      mySide,
      match,
      currentMinute,
      bookedPlayerIds,
      vacatedPlayerIds,
      events,
      homeShots,
      awayShots,
      homeXg,
      awayXg,
      isHalftime,
      onApplySubstitution,
      onApplyTacticalChange,
    });

  return (
    <div className="card touchline-assistant-card" data-testid="touchline-assistant-card">
      <div className="touchline-assistant-header">
        <div className="touchline-assistant-title-group">
          <div className="touchline-assistant-icon-box" aria-hidden="true">
            <TacticsIcon size={20} color="#10b981" />
          </div>
          <div>
            <h3 className="touchline-assistant-title">Auxiliar Tático de Beira de Campo</h3>
            <p className="touchline-assistant-subtitle">
              Leitura tática contínua e recomendações em 1 clique
            </p>
          </div>
        </div>
        <div className="touchline-assistant-badge-group">
          {activeAlerts.length > 0 ? (
            <span
              className={`touchline-badge ${
                activeAlerts.some((a) => a.severity === 'critical')
                  ? 'touchline-badge-critical'
                  : 'touchline-badge-warning'
              }`}
            >
              <AlertTriangleIcon size={13} style={{ marginRight: 5, verticalAlign: '-1px' }} />
              {activeAlerts.length} {activeAlerts.length === 1 ? 'Alerta' : 'Alertas'}
            </span>
          ) : (
            <span className="touchline-badge touchline-badge-stable">
              <CheckIcon size={13} style={{ marginRight: 5, verticalAlign: '-1px' }} />
              Tática Estável
            </span>
          )}
        </div>
      </div>

      <div className="touchline-assistant-body">
        {activeAlerts.length === 0 ? (
          <div className="touchline-empty-state">
            <span className="touchline-empty-icon" aria-hidden="true">
              <CheckIcon size={18} color="#10b981" />
            </span>
            <p className="touchline-empty-text">
              A equipe está bem postada e executando o plano tático sem vulnerabilidades críticas.
            </p>
          </div>
        ) : (
          <div className="touchline-alerts-list">
            {activeAlerts.map((alert) => {
              const severityClass = `touchline-alert-${alert.severity}`;
              return (
                <div
                  key={alert.id}
                  className={`touchline-alert-item ${severityClass}`}
                  data-testid={`touchline-alert-${alert.type}`}
                >
                  <div className="touchline-alert-content">
                    <span className="touchline-alert-heading">{alert.title}</span>
                    <p className="touchline-alert-message">{alert.message}</p>
                  </div>
                  <div className="touchline-alert-actions">
                    <button
                      type="button"
                      className="btn-touchline-action"
                      onClick={() => alert.execute()}
                      title={`Aplicar recomendação: ${alert.actionLabel}`}
                    >
                      {alert.actionLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
