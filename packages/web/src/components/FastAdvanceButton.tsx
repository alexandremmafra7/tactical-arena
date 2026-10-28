import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FastAdvanceResult } from '@tactical-arena/shared';
import { formatFastAdvanceSummary } from '@tactical-arena/shared';
import { fastAdvanceToNextMatch } from '../api/client.js';

interface FastAdvanceButtonProps {
  clubId: string;
  className?: string;
  onAdvanceComplete?: (result: FastAdvanceResult) => void;
}

export function FastAdvanceButton({ clubId, className, onAdvanceComplete }: FastAdvanceButtonProps) {
  const [busy, setBusy] = useState(false);
  const [resultModal, setResultModal] = useState<FastAdvanceResult | null>(null);
  const navigate = useNavigate();

  async function handleFastAdvance() {
    setBusy(true);
    try {
      const outcome = await fastAdvanceToNextMatch(clubId);
      setResultModal(outcome);
      if (onAdvanceComplete) {
        onAdvanceComplete(outcome);
      }
    } catch (err) {
      alert(`Erro ao avançar calendário: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function handleGoToMatch() {
    if (resultModal?.nextMatch?.matchId) {
      navigate(`/match/${resultModal.nextMatch.matchId}/live`);
    } else {
      window.location.reload();
    }
  }

  return (
    <>
      <button
        type="button"
        className={className ?? 'btn-secondary'}
        onClick={handleFastAdvance}
        disabled={busy}
        title="Simula as rodadas intermediárias e avança direto até o dia do próximo jogo"
      >
        {busy ? 'Simulando semanas...' : 'Pular até o Jogo'}
      </button>

      {resultModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 480, width: '90%', padding: '24px', border: '1px solid var(--accent)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {resultModal.interrupted ? 'Avanço Interrompido' : 'Chegamos ao Dia do Jogo!'}
            </h3>

            <p style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
              {formatFastAdvanceSummary(resultModal)}
            </p>

            {resultModal.interruptionReason && (
              <div style={{ background: 'rgba(255, 107, 107, 0.12)', borderLeft: '4px solid var(--error)', padding: '10px 14px', borderRadius: 4, margin: '12px 0' }}>
                <strong style={{ color: 'var(--error)' }}>{resultModal.interruptionReason.title}</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>{resultModal.interruptionReason.description}</p>
              </div>
            )}

            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: 8, margin: '14px 0', fontSize: '0.88rem' }}>
              <div><strong>Data Atual:</strong> {resultModal.finalDate}</div>
              <div><strong>Recuperação:</strong> Elenco descansado e pronto</div>
              {resultModal.nextMatch && (
                <div style={{ marginTop: 6, fontWeight: 'bold', color: 'var(--accent)' }}>
                  Próximo: vs {resultModal.nextMatch.opponentName} ({resultModal.nextMatch.isHome ? 'Casa' : 'Fora'}) · {resultModal.nextMatch.round}ª Rodada
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setResultModal(null);
                  window.location.reload();
                }}
              >
                Permanecer no Menu
              </button>
              {resultModal.nextMatch?.matchId ? (
                <button type="button" className="btn-primary" onClick={handleGoToMatch}>
                  Ir para a Partida
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setResultModal(null);
                    window.location.reload();
                  }}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
