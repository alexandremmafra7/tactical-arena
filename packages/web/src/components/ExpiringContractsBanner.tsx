import React, { useState } from 'react';
import type { Club } from '@tactical-arena/shared';
import { identifyExpiringContracts } from '@tactical-arena/shared';
import { BatchRenewModal } from './BatchRenewModal.js';
import {
  AlertTriangleIcon,
  StaffIcon,
  LightningIcon,
  ChecklistIcon,
  StarIcon,
  CheckIcon,
} from './icons/AppIcons.js';

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export interface ExpiringContractsBannerProps {
  club: Club;
  currentSeason?: number;
  onBatchRenewConfirmed?: (playerIds: string[], yearsMap: Record<string, number>) => Promise<void>;
  onDirectRenewRecommended?: () => Promise<void>;
  isCompact?: boolean;
}

export function ExpiringContractsBanner({
  club,
  currentSeason = 2026,
  onBatchRenewConfirmed,
  onDirectRenewRecommended,
  isCompact = false,
}: ExpiringContractsBannerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickRenewing, setIsQuickRenewing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const footballDirector = club.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const analysis = identifyExpiringContracts(club, 10, currentSeason);

  if (analysis.allExpiring.length === 0) {
    return null;
  }

  const hasKeyPlayers = analysis.keyPlayers.length > 0;
  const recommendedCount = analysis.recommendedBatchPlayerIds.length;
  const canAffordBatch = club.budget >= analysis.totalBatchCost;

  async function handleQuickRenewClick() {
    if (recommendedCount === 0 || !canAffordBatch || isQuickRenewing) return;
    setIsQuickRenewing(true);
    setFeedbackMessage(null);
    try {
      if (onDirectRenewRecommended) {
        await onDirectRenewRecommended();
      } else if (onBatchRenewConfirmed) {
        await onBatchRenewConfirmed(analysis.recommendedBatchPlayerIds, {});
      }
      setFeedbackMessage(`${recommendedCount} contratos renovados com sucesso pelo Diretor!`);
    } catch (err) {
      setFeedbackMessage(`Erro ao renovar: ${(err as Error).message}`);
    } finally {
      setIsQuickRenewing(false);
    }
  }

  async function handleModalConfirm(playerIds: string[], yearsMap: Record<string, number>) {
    if (onBatchRenewConfirmed) {
      await onBatchRenewConfirmed(playerIds, yearsMap);
      setFeedbackMessage(`${playerIds.length} contratos renovados com sucesso!`);
    }
  }

  return (
    <>
      <div
        className="card expiring-contracts-banner"
        style={{
          background: hasKeyPlayers
            ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(30, 27, 46, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(20, 18, 32, 0.95) 100%)',
          border: hasKeyPlayers
            ? '1.5px solid rgba(234, 179, 8, 0.45)'
            : '1.5px solid rgba(168, 85, 247, 0.35)',
          borderRadius: 12,
          padding: isCompact ? '12px 14px' : '16px 20px',
          marginBottom: 16,
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: hasKeyPlayers ? 'rgba(234, 179, 8, 0.18)' : 'rgba(168, 85, 247, 0.18)',
                border: hasKeyPlayers ? '1px solid rgba(234, 179, 8, 0.45)' : '1px solid rgba(168, 85, 247, 0.45)',
                color: hasKeyPlayers ? '#fbbf24' : '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangleIcon size={22} color={hasKeyPlayers ? '#fbbf24' : '#c084fc'} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: isCompact ? '0.98rem' : '1.1rem', color: '#fff' }}>
                  Contratos a Expirar ({analysis.allExpiring.length})
                </h4>
                {hasKeyPlayers && (
                  <span
                    style={{
                      background: 'rgba(234, 179, 8, 0.25)',
                      color: '#fde047',
                      border: '1px solid rgba(234, 179, 8, 0.5)',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 12,
                      textTransform: 'uppercase',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <AlertTriangleIcon size={12} color="#fde047" />
                    {analysis.keyPlayers.length} Craque(s) em Risco
                  </span>
                )}
              </div>
              <p className="muted" style={{ margin: '3px 0 0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                {footballDirector ? (
                  <>
                    <StaffIcon size={14} color="#c084fc" />
                    <span>
                      <strong>{footballDirector.name}</strong> avaliou {recommendedCount} atletas prioritários para renovação e {analysis.surplusPlayers.length} dispensáveis.
                    </span>
                  </>
                ) : (
                  <>
                    {analysis.allExpiring.length} atletas têm contrato no fim. Renove antes que saiam de graça no mercado.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {recommendedCount > 0 && (
              <button
                type="button"
                className="btn-primary"
                style={{
                  background: !canAffordBatch ? '#475569' : 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  borderColor: '#c084fc',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  padding: '6px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                disabled={!canAffordBatch || isQuickRenewing}
                onClick={handleQuickRenewClick}
                title={canAffordBatch ? `Renovar ${recommendedCount} atletas recomendados` : 'Saldo insuficiente para pacote'}
              >
                <LightningIcon size={14} fill={canAffordBatch ? '#fbbf24' : '#94a3b8'} color={canAffordBatch ? '#fbbf24' : '#94a3b8'} />
                <span>
                  {isQuickRenewing
                    ? 'Renovando...'
                    : !canAffordBatch
                    ? `Saldo Insuficiente (${formatMoney(analysis.totalBatchCost)})`
                    : `Renovar Todos Recomendados (${formatMoney(analysis.totalBatchCost)})`}
                </span>
              </button>
            )}

            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setIsModalOpen(true)}
            >
              <ChecklistIcon size={14} />
              <span>Gerenciar em Lote</span>
            </button>
          </div>
        </div>

        {/* Highlight key players names if any */}
        {hasKeyPlayers && (
          <div
            style={{
              padding: '6px 12px',
              background: 'rgba(234, 179, 8, 0.08)',
              borderLeft: '3px solid #eab308',
              borderRadius: '0 6px 6px 0',
              fontSize: '0.78rem',
              color: '#fef08a',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <StarIcon size={14} fill="#eab308" color="#eab308" />
            <strong>Craques / Pilares com contrato no fim:</strong>{' '}
            {analysis.keyPlayers.map((k) => `${k.player.name} (${k.player.position}, ${Math.round(k.player.overall)} OVR)`).join(', ')}
          </div>
        )}

        {feedbackMessage && (
          <div
            style={{
              padding: '6px 12px',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid #22c55e',
              borderRadius: 6,
              fontSize: '0.8rem',
              color: '#86efac',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CheckIcon size={14} color="#86efac" />
            <span>{feedbackMessage}</span>
          </div>
        )}
      </div>

      <BatchRenewModal
        club={club}
        currentSeason={currentSeason}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirmBatchRenew={handleModalConfirm}
      />
    </>
  );
}
