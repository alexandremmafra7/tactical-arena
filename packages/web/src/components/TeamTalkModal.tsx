import { useState } from 'react';
import type { Club } from '@tactical-arena/shared';
import { getAvailableTeamTalks, type TeamTalkContext, type TeamTalkOption } from '@tactical-arena/shared';

interface TeamTalkModalProps {
  isOpen: boolean;
  club: Club | null;
  context: TeamTalkContext;
  onSelectTalk: (option: TeamTalkOption) => void;
  onClose: () => void;
}

export function TeamTalkModal({ isOpen, club, context, onSelectTalk, onClose }: TeamTalkModalProps) {
  if (!isOpen || !club) return null;

  const availableTalks = getAvailableTeamTalks(context, 0, false); // scoreDifferential=0, isDerbyOrFinal=false

  const handleSelect = (option: TeamTalkOption) => {
    onSelectTalk(option);
    onClose();
  };

  return (
    <div className="options-modal-backdrop" role="dialog" aria-modal="true">
      <div className="options-modal-card">
        <div className="options-modal-header">
          <h2 className="options-modal-title">
            {context === 'PRE_MATCH' && 'Preleção Antes do Jogo'}
            {context === 'HALF_TIME' && 'Preleção no Intervalo'}
            {context === 'POST_MATCH' && 'Preleção Depois do Jogo'}
          </h2>
          <p className="options-modal-subtitle">
            Escolha o tom da sua mensagem para o elenco.
          </p>
          <button
            type="button"
            className="options-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="options-modal-body">
          {availableTalks.map((talk) => (
            <button
              key={talk.id}
              type="button"
              className={`options-modal-option ${talk.tone.toLowerCase()}`}
              onClick={() => handleSelect(talk)}
            >
              <div className="option-header">
                <span className="option-label">{talk.label}</span>
                <span className="option-tone">{talk.tone}</span>
              </div>
              <p className="option-impact">{talk.expectedImpact}</p>
            </button>
          ))}
        </div>

        <div className="options-modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}