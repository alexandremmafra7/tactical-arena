import React, { useState } from 'react';
import type { Club, ExpiringContractItem, PlayerTier } from '@tactical-arena/shared';
import { identifyExpiringContracts, renewalCost } from '@tactical-arena/shared';
import { positionLabel } from '../lib/positionLabel.js';
import { SpecialPlayerBadge } from './SpecialPlayerIcon.js';
import { CountryFlag } from './CountryFlag.js';
import {
  ContractsIcon,
  StaffIcon,
  LightningIcon,
  CrossIcon,
  RefreshIcon,
} from './icons/AppIcons.js';

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export interface BatchRenewModalProps {
  club: Club;
  currentSeason?: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBatchRenew: (playerIds: string[], yearsMap: Record<string, number>) => Promise<void>;
}

export function BatchRenewModal({
  club,
  currentSeason = 2026,
  isOpen,
  onClose,
  onConfirmBatchRenew,
}: BatchRenewModalProps) {
  const footballDirector = club.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const analysis = identifyExpiringContracts(club, 10, currentSeason);

  // Default selected: all key players and squad players (excluding surplus)
  const initialSelected = new Set(analysis.recommendedBatchPlayerIds);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelected);
  const [yearsByPlayer, setYearsByPlayer] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getYearsFor = (playerId: string) => yearsByPlayer[playerId] ?? 2;

  const toggleSelect = (playerId: string) => {
    const next = new Set(selectedIds);
    if (next.has(playerId)) {
      next.delete(playerId);
    } else {
      next.add(playerId);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(analysis.allExpiring.map((i) => i.player.id)));
  };

  const handleSelectNone = () => {
    setSelectedIds(new Set());
  };

  const handleSelectRecommendedOnly = () => {
    setSelectedIds(new Set(analysis.recommendedBatchPlayerIds));
  };

  const handleSetGlobalYears = (years: number) => {
    const next: Record<string, number> = {};
    for (const item of analysis.allExpiring) {
      next[item.player.id] = years;
    }
    setYearsByPlayer(next);
  };

  // Calculate dynamic total cost for currently selected players
  const totalCost = analysis.allExpiring
    .filter((item) => selectedIds.has(item.player.id))
    .reduce((sum, item) => {
      const years = getYearsFor(item.player.id);
      return sum + renewalCost(item.player, currentSeason, years, footballDirector);
    }, 0);

  const budgetAfter = club.budget - totalCost;
  const isBudgetInsufficient = totalCost > club.budget;
  const isZeroSelected = selectedIds.size === 0;

  async function handleConfirm() {
    if (isZeroSelected || isBudgetInsufficient || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const selectedList = Array.from(selectedIds);
      await onConfirmBatchRenew(selectedList, yearsByPlayer);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const getCategoryBadge = (item: ExpiringContractItem) => {
    if (item.category === 'KEY_PLAYER') {
      return (
        <span
          style={{
            background: 'rgba(234, 179, 8, 0.2)',
            color: '#facc15',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            padding: '2px 6px',
            borderRadius: 6,
            fontSize: '0.72rem',
            fontWeight: 700,
          }}
        >
          ⭐ Craque / Pilar
        </span>
      );
    }
    if (item.category === 'SURPLUS') {
      return (
        <span
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '2px 6px',
            borderRadius: 6,
            fontSize: '0.72rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <CrossIcon size={12} color="#f87171" />
          Excedente
        </span>
      );
    }
    return (
      <span
        style={{
          background: 'rgba(59, 130, 246, 0.2)',
          color: '#60a5fa',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          padding: '2px 6px',
          borderRadius: 6,
          fontSize: '0.72rem',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <RefreshIcon size={12} color="#60a5fa" />
        Rotação
      </span>
    );
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          background: '#13111c',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: 14,
          maxWidth: 950,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, #1e1b2e 0%, #161424 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(168, 85, 247, 0.45)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ContractsIcon size={22} color="#c084fc" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>
                Gestão e Renovações em Lote
              </h2>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                {footballDirector ? (
                  <>
                    <StaffIcon size={14} color="#c084fc" />
                    <span>
                      Avaliação de <strong>{footballDirector.name}</strong> ({footballDirector.rating} OVR)
                    </span>
                  </>
                ) : (
                  <>Relatório da Diretoria de Futebol</>
                )}
                {' • '}
                {analysis.allExpiring.length} contratos a vencer nesta temporada ou na próxima
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '4px 10px', fontSize: '0.9rem' }}
          >
            ✕
          </button>
        </div>

        {/* Action toolbar & quick presets */}
        <div
          style={{
            padding: '10px 20px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              onClick={handleSelectRecommendedOnly}
            >
              <LightningIcon size={13} fill="#fbbf24" color="#fbbf24" />
              <span>Selecionar Recomendados ({analysis.recommendedBatchPlayerIds.length})</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              onClick={handleSelectAll}
            >
              Marcar Todos ({analysis.allExpiring.length})
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              onClick={handleSelectNone}
            >
              Desmarcar Todos
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
            <span className="muted">Duração padrão:</span>
            {[1, 2, 3, 4, 5].map((y) => (
              <button
                key={y}
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '2px 7px' }}
                onClick={() => handleSetGlobalYears(y)}
              >
                +{y} {y === 1 ? 'ano' : 'anos'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ margin: '10px 20px 0', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 6, color: '#fca5a5', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Table list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px', width: 36 }}></th>
                <th style={{ padding: '8px 6px' }}>Atleta</th>
                <th style={{ padding: '8px 6px' }}>Pos.</th>
                <th style={{ padding: '8px 6px' }}>Idade</th>
                <th style={{ padding: '8px 6px' }}>Força</th>
                <th style={{ padding: '8px 6px' }}>Categoria</th>
                <th style={{ padding: '8px 6px' }}>Prazo</th>
                <th style={{ padding: '8px 6px' }}>Salário Novo</th>
                <th style={{ padding: '8px 6px' }}>Duração</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Custo Total</th>
              </tr>
            </thead>
            <tbody>
              {analysis.allExpiring.map((item) => {
                const isSelected = selectedIds.has(item.player.id);
                const years = getYearsFor(item.player.id);
                const itemCost = renewalCost(item.player, currentSeason, years, footballDirector);

                return (
                  <tr
                    key={item.player.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '8px 6px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.player.id)}
                        style={{ cursor: 'pointer' }}
                        aria-label={`Selecionar ${item.player.name}`}
                      />
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CountryFlag code={item.player.nationality} title={item.player.nationality} />
                        <strong>{item.player.name}</strong>
                        {item.tier && <SpecialPlayerBadge tier={item.tier} />}
                      </div>
                      <div className="muted" style={{ fontSize: '0.72rem', marginTop: 2 }}>
                        {item.directorRecommendation}
                      </div>
                    </td>
                    <td style={{ padding: '8px 6px' }}>{positionLabel(item.player.position)}</td>
                    <td style={{ padding: '8px 6px' }}>{item.player.age}</td>
                    <td style={{ padding: '8px 6px', fontWeight: 700 }}>{Math.round(item.player.overall)}</td>
                    <td style={{ padding: '8px 6px' }}>{getCategoryBadge(item)}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <span
                        style={{
                          color: item.seasonsRemaining <= 0 ? '#f87171' : item.seasonsRemaining === 1 ? '#facc15' : '#4ade80',
                          fontWeight: 600,
                        }}
                      >
                        {item.seasonsRemaining <= 0 ? 'Vence agora' : item.seasonsRemaining === 1 ? 'Último ano' : `${item.seasonsRemaining} temporadas`}
                      </span>
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      {formatMoney(item.recommendedWage)}/sem
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <select
                        value={years}
                        onChange={(e) =>
                          setYearsByPlayer((prev) => ({
                            ...prev,
                            [item.player.id]: Number(e.target.value),
                          }))
                        }
                        style={{
                          background: '#1a1829',
                          color: '#fff',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: '0.78rem',
                        }}
                        disabled={!isSelected}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            +{n} {n === 1 ? 'ano' : 'anos'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: isSelected ? '#c084fc' : '#64748b' }}>
                      {formatMoney(itemCost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer with summaries and action buttons */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(90deg, #181528 0%, #12101e 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', fontSize: '0.85rem' }}>
            <div>
              <span className="muted">Selecionados: </span>
              <strong>{selectedIds.size} de {analysis.allExpiring.length}</strong>
            </div>
            <div>
              <span className="muted">Custo Total: </span>
              <strong style={{ color: isBudgetInsufficient ? '#ef4444' : '#c084fc', fontSize: '1rem' }}>
                {formatMoney(totalCost)}
              </strong>
            </div>
            <div>
              <span className="muted">Caixa Restante: </span>
              <strong style={{ color: budgetAfter < 0 ? '#ef4444' : '#4ade80' }}>
                {formatMoney(budgetAfter)}
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{
                background: isBudgetInsufficient ? '#475569' : 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                borderColor: '#c084fc',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              disabled={isZeroSelected || isBudgetInsufficient || isSubmitting}
              onClick={handleConfirm}
            >
              {isSubmitting ? (
                'Processando Renovações...'
              ) : isBudgetInsufficient ? (
                'Saldo Insuficiente'
              ) : (
                <>
                  <LightningIcon size={14} fill="#fbbf24" color="#fbbf24" />
                  <span>Confirmar {selectedIds.size} Renovações ({formatMoney(totalCost)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
