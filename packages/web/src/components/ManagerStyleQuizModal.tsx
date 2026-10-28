import { useEffect, useRef, useState } from 'react';
import { type StaffDelegationConfig } from '@tactical-arena/shared';
import { trapFocus } from './focusUtils.js';

export type ManagerStyleQuizAnswer = 'A' | 'B';
export type ManagerStyleQuizPreset = Exclude<StaffDelegationConfig['presetMode'], 'custom'>;

export interface ManagerStyleQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyProfile: (preset: ManagerStyleQuizPreset) => void;
}

interface Question {
  id: number;
  topic: string;
  question: string;
  optionA: {
    label: string;
    description: string;
  };
  optionB: {
    label: string;
    description: string;
  };
}

export const QUIZ_QUESTIONS: Question[] = [
  {
    id: 1,
    topic: 'Dia do Jogo • Substituições e Ritmo',
    question: 'Seu camisa 9 titular sentiu uma lesão aos 30 minutos do primeiro tempo. Como você reage no banco?',
    optionA: {
      label: 'Substituição Automática Ágil',
      description: 'Meu auxiliar coloca o melhor reserva da posição imediatamente e o jogo continua sem travar.',
    },
    optionB: {
      label: 'Parada Tática Total',
      description: 'Pauso a partida, abro a prancheta tática e analiso a melhor adaptação nos mínimos detalhes.',
    },
  },
  {
    id: 2,
    topic: 'Mercado da Bola • Contratações',
    question: 'A janela de transferências abriu e a diretoria liberou verba para reforços. Qual é o seu método?',
    optionA: {
      label: 'Oportunidades Prontas do Diretor',
      description: 'Quero uma lista de alvos recomendados para comprar ou negociar rápido em 1 clique.',
    },
    optionB: {
      label: 'Relatórios Profundos de Olheiro',
      description: 'Prefiro enviar olheiros para monitorar atletas, analisar relatórios de personalidade e estatísticas.',
    },
  },
  {
    id: 3,
    topic: 'Vestiário & Contratos • Burocracia',
    question: 'Três jogadores reservas estão entrando nas últimas semanas de contrato. O que você decide?',
    optionA: {
      label: 'Diretoria Assume as Rotinas',
      description: 'O Diretor renova automaticamente quem cabe no orçamento; só me chame se for uma estrela.',
    },
    optionB: {
      label: 'Negociação Contratual Manual',
      description: 'Quero analisar salário por salário e negociar cada cláusula de renovação pessoalmente.',
    },
  },
  {
    id: 4,
    topic: 'Rotina de Treinamento • Físico & Tático',
    question: 'Como será a rotina de treinos da sua equipe ao longo da temporada?',
    optionA: {
      label: 'Treino Coletivo Direto ao Ponto',
      description: 'Regime geral para manter o time voando fisicamente e foco máximo no próximo jogo.',
    },
    optionB: {
      label: 'Treino Individualizado por Atributo',
      description: 'Plano de desenvolvimento sob medida para cada jovem lapidar seus pontos fracos.',
    },
  },
];

export function classifyManagerStyleQuiz(answers: readonly ManagerStyleQuizAnswer[]): ManagerStyleQuizPreset {
  if (answers.length !== QUIZ_QUESTIONS.length) {
    throw new Error(`O quiz exige exatamente ${QUIZ_QUESTIONS.length} respostas.`);
  }

  const countA = answers.filter((answer) => answer === 'A').length;
  if (countA >= 3) return 'brasfoot_casual';
  if (countA <= 1) return 'football_manager_hardcore';
  return 'balanced';
}

export function answerManagerStyleQuiz(
  answers: readonly ManagerStyleQuizAnswer[],
  choice: ManagerStyleQuizAnswer,
): {
  answers: readonly ManagerStyleQuizAnswer[];
  resultProfile: ManagerStyleQuizPreset | null;
} {
  if (answers.length >= QUIZ_QUESTIONS.length) {
    throw new Error('O quiz já foi concluído.');
  }

  const nextAnswers = [...answers, choice];
  return {
    answers: nextAnswers,
    resultProfile:
      nextAnswers.length === QUIZ_QUESTIONS.length
        ? classifyManagerStyleQuiz(nextAnswers)
        : null,
  };
}

export function ManagerStyleQuizModal({ isOpen, onClose, onApplyProfile }: ManagerStyleQuizModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<ManagerStyleQuizAnswer[]>([]);
  const [resultProfile, setResultProfile] = useState<ManagerStyleQuizPreset | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    return trapFocus(dialogRef.current);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        // Stop propagation so that parent dialogs don't also close
        e.stopPropagation();
      }
    }
    dialogRef.current.addEventListener('keydown', onKey);
    return () => dialogRef.current?.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  function handleAnswer(choice: ManagerStyleQuizAnswer) {
    const progress = answerManagerStyleQuiz(answers, choice);
    setAnswers([...progress.answers]);

    if (progress.resultProfile) {
      setResultProfile(progress.resultProfile);
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  }

  function handleReset() {
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setResultProfile(null);
  }

  function handleConfirm() {
    if (resultProfile) {
      onApplyProfile(resultProfile);
      onClose();
    }
  }

  const currentQ = QUIZ_QUESTIONS[currentQuestionIndex];

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div
        ref={dialogRef}
        className="card modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-style-quiz-title"
        style={{ maxWidth: 620, width: '100%', background: 'linear-gradient(145deg, #18161a 0%, #100e12 100%)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 16, padding: '24px 28px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}
      >
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14, marginBottom: 18 }}>
          <div>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffd700', fontWeight: 700 }}>
              Entrevista da Diretoria
            </span>
            <h2 id="manager-style-quiz-title" style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>
              Qual é o seu Estilo de Treinador?
            </h2>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose} aria-label="Fechar quiz" style={{ padding: '4px 10px', fontSize: '0.85rem' }}>
            ✕
          </button>
        </div>

        {/* QUIZ IN PROGRESS */}
        {!resultProfile && currentQ && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.82rem', color: '#ffd700', fontWeight: 600 }}>
                {currentQ.topic}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#9a9488', fontWeight: 600 }}>
                Pergunta {currentQuestionIndex + 1} de {QUIZ_QUESTIONS.length}
              </span>
            </div>

            {/* PROGRESS BAR */}
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ width: `${((currentQuestionIndex + 1) / QUIZ_QUESTIONS.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #ffd700, #ff9900)', transition: 'width 0.3s ease' }} />
            </div>

            <p style={{ fontSize: '1.05rem', lineHeight: 1.5, color: '#f3f4f6', fontWeight: 500, marginBottom: 20 }}>
              {currentQ.question}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* OPTION A */}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleAnswer('A')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  background: 'rgba(255, 215, 0, 0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <strong style={{ fontSize: '0.95rem', color: '#ffd700', marginBottom: 4 }}>
                  {currentQ.optionA.label}
                </strong>
                <span style={{ fontSize: '0.84rem', color: '#c4c1ca', lineHeight: 1.4 }}>
                  {currentQ.optionA.description}
                </span>
              </button>

              {/* OPTION B */}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleAnswer('B')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(147, 197, 253, 0.2)',
                  background: 'rgba(147, 197, 253, 0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <strong style={{ fontSize: '0.95rem', color: '#93c5fd', marginBottom: 4 }}>
                  {currentQ.optionB.label}
                </strong>
                <span style={{ fontSize: '0.84rem', color: '#c4c1ca', lineHeight: 1.4 }}>
                  {currentQ.optionB.description}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* QUIZ RESULT */}
        {resultProfile && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '2.8rem', marginBottom: 8 }}>
              ''
            </div>

            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffd700', fontWeight: 700 }}>
              Perfil Identificado
            </span>
            <h3 style={{ fontSize: '1.4rem', color: '#fff', margin: '4px 0 12px' }}>
              {resultProfile === 'brasfoot_casual' && 'O Estrategista Prático (Estilo Ágil)'}
              {resultProfile === 'balanced' && 'O Gestor Moderno (Estilo Equilibrado)'}
              {resultProfile === 'football_manager_hardcore' && 'O Mestre Tático (Estilo Avançado)'}
            </h3>

            <p style={{ fontSize: '0.88rem', color: '#d1d5db', lineHeight: 1.5, maxWidth: 500, margin: '0 auto 20px' }}>
              {resultProfile === 'brasfoot_casual' &&
                'Você prioriza a velocidade e a emoção do futebol! A Comissão Técnica cuidará de substituições em lesões, escalação em 1 clique e renovações rotineiras para você focar no jogo.'}
              {resultProfile === 'balanced' &&
                'Você equilibra agilidade com inteligência tática! A Diretoria assume as tarefas burocráticas enquanto você comanda as decisões estratégicas e o mercado.'}
              {resultProfile === 'football_manager_hardcore' &&
                'Você quer o controle absoluto de cada detalhe! Prancheta manual nas substituições, treinos específicos e microgestão profunda do elenco e contratos.'}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button type="button" className="btn-secondary" onClick={handleReset} style={{ padding: '10px 18px' }}>
                Refazer Quiz
              </button>
              <button type="button" className="btn-primary" onClick={handleConfirm} style={{ padding: '10px 22px', fontWeight: 700, background: 'linear-gradient(135deg, #ffd700, #d4af37)', color: '#1a1400' }}>
                ✓ Aplicar Este Perfil
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
