import { useState } from 'react';
import type { TeamTalkContext, TeamTalkOption, TeamTalkResult, TeamTalkTone } from '@tactical-arena/shared';
import { getAvailableTeamTalks, getRecommendedTeamTalk } from '@tactical-arena/shared';
import { applyTeamTalk } from '../api/client.js';
import { StaffIcon, TacticsIcon } from './icons/AppIcons.js';

export interface TeamTalkCardProps {
  clubId: string;
  context: TeamTalkContext; // 'PRE_MATCH' | 'HALF_TIME' | 'POST_MATCH'
  scoreDifferential: number;
  isDerbyOrFinal?: boolean;
  onApplied?: (result: TeamTalkResult) => void;
  submitTalk?: typeof applyTeamTalk; // Permite injeção em testes unitários
}

export interface TeamTalkCardViewProps {
  clubId: string;
  context: TeamTalkContext;
  scoreDifferential: number;
  isDerbyOrFinal?: boolean;
  selectedOptionId: string | null;
  recommendedOption: TeamTalkOption;
  busy: boolean;
  error: string | null;
  appliedResult: TeamTalkResult | null;
  onSelectOption: (optionId: string) => void;
  onSubmit: () => void;
  onAssistantSubmit: () => void;
}

const CONTEXT_TITLES: Record<TeamTalkContext, string> = {
  PRE_MATCH: 'Preleção Pré-Jogo',
  HALF_TIME: 'Preleção no Intervalo',
  POST_MATCH: 'Preleção Pós-Jogo',
};

const CONTEXT_SUBTITLES: Record<TeamTalkContext, string> = {
  PRE_MATCH: 'Defina o tom da sua mensagem para o grupo ou deixe o auxiliar conduzir.',
  HALF_TIME: 'Ajuste a postura do time para a etapa final.',
  POST_MATCH: 'Avalie o desempenho e mantenha o clima do vestiário sob controle.',
};

const TONE_BADGES: Record<TeamTalkTone, { label: string }> = {
  CALM: { label: 'Calmo' },
  PASSIONATE: { label: 'Apaixonado' },
  DEMANDING: { label: 'Cobrança' },
  ENCOURAGING: { label: 'Encorajador' },
};

const REACTION_CONFIG: Record<
  TeamTalkResult['overallReaction'],
  { label: string; className: string }
> = {
  INSPIRED: { label: 'Inspirado', className: 'reaction-inspired' },
  FOCUSED: { label: 'Focado', className: 'reaction-focused' },
  INDIFFERENT: { label: 'Indiferente', className: 'reaction-indifferent' },
  PRESSURE_OVERWHELMED: { label: 'Pressionado', className: 'reaction-overwhelmed' },
};

export function TeamTalkCardView({
  context,
  scoreDifferential,
  isDerbyOrFinal = false,
  selectedOptionId,
  recommendedOption,
  busy,
  error,
  appliedResult,
  onSelectOption,
  onSubmit,
  onAssistantSubmit,
}: TeamTalkCardViewProps) {
  const options = getAvailableTeamTalks(context, scoreDifferential, isDerbyOrFinal);

  return (
    <section className="card team-talk-card">
      <div className="team-talk-card-header">
        <div className="team-talk-title-row">
          <TacticsIcon size={20} color="#38bdf8" />
          <h3 className="team-talk-title">{CONTEXT_TITLES[context]}</h3>
        </div>
        <p className="team-talk-subtitle muted">{CONTEXT_SUBTITLES[context]}</p>
      </div>

      {error && <div className="team-talk-alert error">{error}</div>}

      {appliedResult ? (
        <div className="team-talk-applied-banner">
          <div className="applied-banner-head">
            <span className="applied-badge-tag">Preleção Realizada</span>
            <span className={`reaction-tag ${REACTION_CONFIG[appliedResult.overallReaction]?.className ?? ''}`}>
              {REACTION_CONFIG[appliedResult.overallReaction]?.label} ({appliedResult.overallReaction})
            </span>
          </div>
          <p className="applied-message">"{appliedResult.message}"</p>
        </div>
      ) : (
        <>
          {/* Quick Assistant Action Button */}
          <div className="team-talk-assistant-quick-box" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="btn-secondary team-talk-assistant-btn"
              onClick={onAssistantSubmit}
              disabled={busy}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                background: 'rgba(56, 189, 248, 0.08)',
                color: '#e0f2fe',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StaffIcon size={20} color="#38bdf8" />
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ display: 'block', fontSize: '0.85rem', color: '#38bdf8' }}>
                    Deixar Auxiliar falar (Recomendado)
                  </strong>
                  <span className="muted" style={{ fontSize: '0.74rem' }}>
                    Tom {TONE_BADGES[recommendedOption.tone].label}: {recommendedOption.label}
                  </span>
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>
                {busy ? 'Falando...' : 'Aplicar'}
              </span>
            </button>
          </div>

          {/* Quick Tone Radios */}
          <div className="team-talk-options-grid" role="radiogroup" aria-label="Opções de preleção">
            {options.map((option: TeamTalkOption) => {
              const isSelected = selectedOptionId === option.id;
              const toneMeta = TONE_BADGES[option.tone];
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`team-talk-option ${isSelected ? 'selected' : ''} ${option.tone.toLowerCase()}`}
                  onClick={() => onSelectOption(option.id)}
                  disabled={busy}
                >
                  <div className="option-top">
                    <span className="option-tone-tag">
                      {toneMeta.label}
                    </span>
                    <strong className="option-label-text">{option.label}</strong>
                  </div>
                  <p className="option-desc">{option.expectedImpact}</p>
                </button>
              );
            })}
          </div>

          <div className="team-talk-action-row">
            <button
              type="button"
              className="btn-primary team-talk-submit-btn"
              onClick={onSubmit}
              disabled={!selectedOptionId || busy}
            >
              {busy ? 'Transmitindo mensagem...' : 'Transmitir Preleção ao Grupo'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function TeamTalkCard({
  clubId,
  context,
  scoreDifferential,
  isDerbyOrFinal = false,
  onApplied,
  submitTalk = applyTeamTalk,
}: TeamTalkCardProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedResult, setAppliedResult] = useState<TeamTalkResult | null>(null);

  const recommendedOption = getRecommendedTeamTalk(context, scoreDifferential, isDerbyOrFinal);

  async function executeTalk(optionId: string) {
    if (busy || appliedResult) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitTalk(clubId, optionId, context, scoreDifferential);
      setAppliedResult(result);
      if (onApplied) onApplied(result);
    } catch (err) {
      setError((err as Error).message || 'Erro ao aplicar preleção');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!selectedOptionId) return;
    await executeTalk(selectedOptionId);
  }

  async function handleAssistantSubmit() {
    await executeTalk(recommendedOption.id);
  }

  return (
    <TeamTalkCardView
      clubId={clubId}
      context={context}
      scoreDifferential={scoreDifferential}
      isDerbyOrFinal={isDerbyOrFinal}
      selectedOptionId={selectedOptionId}
      recommendedOption={recommendedOption}
      busy={busy}
      error={error}
      appliedResult={appliedResult}
      onSelectOption={setSelectedOptionId}
      onSubmit={handleSubmit}
      onAssistantSubmit={handleAssistantSubmit}
    />
  );
}
