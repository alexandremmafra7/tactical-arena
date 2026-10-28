import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { InterviewResponse } from '@tactical-arena/shared';
import { getPressConferenceById, submitPressConferenceAnswers } from '../api/client.js';
import { StaffIcon } from '../components/icons/AppIcons.js';

type DelegacaoDaTela = 'ASSISTANT';

export type ToneOption = 'CALM' | 'PASSIONATE' | 'DEFIANT' | 'DEFENSIVE';

export interface PressConferenceViewProps {
  pc: any;
  currentQuestionIndex: number;
  answers: Record<string, { answerId: string; tone?: ToneOption }>;
  selectedTone: ToneOption;
  submitting: boolean;
  completedImpact: any | null;
  onSelectTone: (tone: ToneOption) => void;
  onSelectAnswer: (answerId: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: (delegation?: DelegacaoDaTela) => void;
  onContinue: () => void;
}

export function PressConferenceView({
  pc,
  currentQuestionIndex,
  answers,
  selectedTone,
  submitting,
  completedImpact,
  onSelectTone,
  onSelectAnswer,
  onNext,
  onPrev,
  onSubmit,
  onContinue,
}: PressConferenceViewProps) {
  // If completed, show summary impact in Stadium Night
  if (completedImpact || pc.status === 'SUBMITTED' || pc.status === 'DELEGATED') {
    const impact = completedImpact || pc.impact || { boardConfidenceDelta: 0, squadCohesionDelta: 0, fanPressureDelta: 0 };
    const isDelegated = pc.status === 'DELEGATED';

    return (
      <div className="card press-conference-card pc-summary-card" data-testid="pc-summary-view">
        <div className="pc-header">
          <div className="pc-badge-pill">
            <StaffIcon size={14} color="#fbbf24" style={{ marginRight: 4 }} />
            <span>{isDelegated ? 'Coletiva Delegada' : 'Coletiva Concluída'}</span>
          </div>
          <h1 className="pc-headline">Impacto na Opinião Pública</h1>
          <p className="pc-subtitle">
            {pc.context?.clubName} vs {pc.context?.opponentName ?? pc.context?.opponent}
          </p>
        </div>

        {isDelegated && (
          <div className="pc-delegation-notice">
            
            <span>
              O <strong>Auxiliar Técnico</strong> atendeu à imprensa com neutralidade diplomática, protegendo o vestiário e mantendo o foco integral nos próximos treinamentos.
            </span>
          </div>
        )}

        <div className="pc-pillars-grid">
          {/* Diretoria */}
          <div className="pc-pillar-box">
            <span className="pc-pillar-label">Diretoria</span>
            <span
              className={`pc-pillar-val ${
                impact.boardConfidenceDelta >= 0 ? 'pillar-positive' : 'pillar-negative'
              }`}
            >
              {impact.boardConfidenceDelta > 0 ? `+${impact.boardConfidenceDelta}` : impact.boardConfidenceDelta}%
            </span>
            <span className="pc-pillar-desc">
              {impact.boardConfidenceDelta >= 0 ? 'Confiança fortalecida' : 'Atenção aos objetivos'}
            </span>
          </div>

          {/* Vestiário */}
          <div className="pc-pillar-box">
            <span className="pc-pillar-label">Vestiário</span>
            <span
              className={`pc-pillar-val ${
                impact.squadCohesionDelta >= 0 ? 'pillar-positive' : 'pillar-negative'
              }`}
            >
              {impact.squadCohesionDelta > 0 ? `+${impact.squadCohesionDelta}` : impact.squadCohesionDelta}%
            </span>
            <span className="pc-pillar-desc">
              {impact.squadCohesionDelta >= 0 ? 'Grupo fechado e unido' : 'Inquietação nas cobranças'}
            </span>
          </div>

          {/* Torcida */}
          <div className="pc-pillar-box">
            <span className="pc-pillar-label">Torcida</span>
            <span
              className={`pc-pillar-val ${
                impact.fanPressureDelta <= 0 ? 'pillar-positive' : 'pillar-negative'
              }`}
            >
              {impact.fanPressureDelta > 0 ? `+${impact.fanPressureDelta}` : impact.fanPressureDelta}%
            </span>
            <span className="pc-pillar-desc">
              {impact.fanPressureDelta <= 0 ? 'Ambiente sereno' : 'Cobrança da massa'}
            </span>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="btn-primary-action pc-btn-continue"
        >
          Continuar
        </button>
      </div>
    );
  }

  const questions = pc.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const allAnswered = questions.length > 0 && questions.every((q: any) => answers[q.id]);

  const defaultOptions = [
    { id: 'opt_positive', label: 'Blindar o Elenco', text: 'Tivemos uma postura exemplar e o resultado é fruto do nosso trabalho diário.' },
    { id: 'opt_neutral', label: 'Exaltar a Tática', text: 'Foi uma partida equilibrada. Há pontos táticos a evoluir, mas seguimos focados na estratégia.' },
    { id: 'opt_critical', label: 'Assumir a Culpa', text: 'Não estivemos no nível esperado. Como comandante, assumo a responsabilidade.' },
  ];

  const availableAnswers = currentQuestion?.answers && currentQuestion.answers.length > 0
    ? currentQuestion.answers
    : defaultOptions;

  return (
    <div className="card press-conference-card" data-testid="press-conference-view">
      {/* Top Header */}
      <div className="pc-header">
        <div className="pc-header-titles">
          <div className="pc-badge-pill">
            <StaffIcon size={14} color="#fbbf24" style={{ marginRight: 4 }} />
            <span>Sala de Imprensa</span>
          </div>
          <h1 className="pc-headline">{pc.context?.clubName} — Coletiva Pós-Jogo</h1>
          <p className="pc-subtitle">
            Entrevista coletiva credenciada • Veículos de mídia e repórteres setoristas
          </p>
        </div>

        {/* 1-Click Delegation Button */}
        <button
          type="button"
          onClick={() => onSubmit('ASSISTANT')}
          disabled={submitting}
          className="pc-delegate-btn"
          title="O auxiliar técnico atende à imprensa de forma neutra sem interromper seu gameplay"
        >
          
          <span>Delegar ao Auxiliar</span>
        </button>
      </div>

      {/* Tone Selector */}
      <div className="pc-tone-section">
        <label className="pc-tone-label">Tom da Resposta</label>
        <div className="pc-tone-grid">
          {(['CALM', 'PASSIONATE', 'DEFIANT', 'DEFENSIVE'] as ToneOption[]).map((tone) => (
            <button
              key={tone}
              type="button"
              onClick={() => onSelectTone(tone)}
              className={`pc-tone-btn ${selectedTone === tone ? 'active' : ''}`}
            >
              {tone === 'CALM' && 'Calmo'}
              {tone === 'PASSIONATE' && 'Apaixonado'}
              {tone === 'DEFIANT' && 'Desafiador'}
              {tone === 'DEFENSIVE' && 'Defensivo'}
            </button>
          ))}
        </div>
      </div>

      {/* Question Card */}
      {currentQuestion && (
        <div className="pc-question-box">
          <div className="pc-question-meta">
            <div className="pc-reporter-info">
              {currentQuestion.outletBadge && <span className="pc-outlet-badge">{currentQuestion.outletBadge}</span>}
              <strong className="pc-outlet-name">{currentQuestion.mediaOutlet ?? 'Mídia Credenciada'}</strong>
              {currentQuestion.reporterName && (
                <span className="pc-reporter-name">• {currentQuestion.reporterName}</span>
              )}
            </div>
            <div className="pc-question-counter">
              <span>Pergunta {currentQuestionIndex + 1} de {questions.length}</span>
              {currentQuestion.category && (
                <span className="pc-category-tag">{currentQuestion.category}</span>
              )}
            </div>
          </div>

          <p className="pc-question-text">{currentQuestion.text ?? currentQuestion.question}</p>

          {/* Stance Answer Options Grid */}
          <div className="pc-answers-list">
            {availableAnswers.map((opt: any) => {
              const isSelected = answers[currentQuestion.id]?.answerId === opt.id;
              const hasImpact = opt.impact;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectAnswer(opt.id)}
                  className={`pc-answer-option-btn ${isSelected ? 'selected' : ''}`}
                >
                  <div className="pc-answer-head">
                    <span className="pc-answer-label">{opt.label ?? opt.stance ?? 'Declaração'}</span>
                    {hasImpact && (
                      <div className="pc-preview-impacts">
                        <span
                          className={`pc-impact-pill ${
                            opt.impact.boardConfidenceDelta >= 0 ? 'pill-pos' : 'pill-neg'
                          }`}
                          title="Impacto na Confiança da Diretoria"
                        >
                          Dir: {opt.impact.boardConfidenceDelta > 0 ? `+${opt.impact.boardConfidenceDelta}` : opt.impact.boardConfidenceDelta}
                        </span>
                        <span
                          className={`pc-impact-pill ${
                            opt.impact.squadCohesionDelta >= 0 ? 'pill-pos' : 'pill-neg'
                          }`}
                          title="Impacto na Coesão do Elenco"
                        >
                          Vest: {opt.impact.squadCohesionDelta > 0 ? `+${opt.impact.squadCohesionDelta}` : opt.impact.squadCohesionDelta}
                        </span>
                        <span
                          className={`pc-impact-pill ${
                            opt.impact.fanPressureDelta <= 0 ? 'pill-pos' : 'pill-neg'
                          }`}
                          title="Impacto na Pressão da Torcida"
                        >
                          Torc: {opt.impact.fanPressureDelta > 0 ? `+${opt.impact.fanPressureDelta}` : opt.impact.fanPressureDelta}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="pc-answer-text">{opt.text}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="pc-footer-nav">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentQuestionIndex === 0}
          className="pc-nav-btn pc-btn-prev"
        >
          Anterior
        </button>

        {currentQuestionIndex < questions.length - 1 ? (
          <button
            type="button"
            onClick={onNext}
            className="pc-nav-btn pc-btn-next"
          >
            Próxima
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSubmit()}
            disabled={!allAnswered || submitting}
            className="pc-nav-btn pc-btn-submit"
          >
            {submitting ? 'Enviando...' : 'Finalizar Coletiva'}
          </button>
        )}
      </div>
    </div>
  );
}

export function PressConferencePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pc, setPc] = useState<any | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { answerId: string; tone?: ToneOption }>>({});
  const [selectedTone, setSelectedTone] = useState<ToneOption>('CALM');
  const [submitting, setSubmitting] = useState(false);
  const [completedImpact, setCompletedImpact] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getPressConferenceById(id)
      .then((data: any) => {
        setPc(data);
        if (data.status === 'SUBMITTED' || data.status === 'DELEGATED') {
          setCompletedImpact(data.impact);
        }
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="page pc-loading-state">
        <div className="spinner" />
        <p>Carregando entrevista coletiva...</p>
      </div>
    );
  }

  if (error || !pc) {
    return (
      <div className="page">
        <div className="card pc-error-card">
          <h2>Erro</h2>
          <p>{error || 'Coletiva não encontrada'}</p>
          <button onClick={() => navigate(-1)} className="btn-primary-action">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const questions = pc.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  const handleSelectAnswer = (answerId: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: { answerId, tone: selectedTone },
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async (delegation?: DelegacaoDaTela) => {
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      const formattedResponses: InterviewResponse[] = Object.entries(answers).map(
        ([questionId, val]) => ({
          questionId,
          optionId: val.answerId,
          toneAdjustment: val.tone,
        }),
      );
      const result = await submitPressConferenceAnswers(id, formattedResponses, delegation as any);
      setCompletedImpact(result.impact);
      setPc(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar respostas');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page press-conference-page">
      <PressConferenceView
        pc={pc}
        currentQuestionIndex={currentQuestionIndex}
        answers={answers}
        selectedTone={selectedTone}
        submitting={submitting}
        completedImpact={completedImpact}
        onSelectTone={setSelectedTone}
        onSelectAnswer={handleSelectAnswer}
        onNext={handleNext}
        onPrev={handlePrev}
        onSubmit={handleSubmit}
        onContinue={() => navigate(-1)}
      />
    </div>
  );
}
