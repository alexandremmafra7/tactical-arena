/**
 * Sistema de entrevistas coletivas & mídia pós-jogo (Passo 5)
 *
 * Sistema que gera entrevistas coletivas causais e reativas após jogos,
 * com impactos matemáticos diretos em:
 * 1. Board Confidence (Humor da Diretoria: -10 a +15)
 * 2. Squad Cohesion (Coesão do Elenco: -8 a +12)
 * 3. Fan Pressure (Pressão da Torcida: -15 a +20)
 *
 * Suporta 4 posturas do treinador:
 * - Blindar o Elenco (SHIELD_TEAM)
 * - Exaltar a Tática (PRAISE_TACTIC)
 * - Assumir a Culpa / Responsabilidade (TAKE_RESPONSIBILITY)
 * - Cobrar Maior Empenho (DEMAND_EFFORT)
 *
 * O sistema permite delegação em 1 clique ao Auxiliar Técnico (perfil Brasfoot),
 * onde o auxiliar responde com neutralidade sem interromper o gameplay.
 */

import type { Player } from './player.js';
import type { Match, MatchSide, MatchSideStats } from './match.js';
import type { Club } from './club.js';
import type { Tactic } from './tactic.js';
import type { TacticalMatchReport } from '../simulation/tacticalReport.js';

/**
 * Tipos de entrevista: Principal (depois de jogos importantes),
 * Pré-temporada (comportamento e objetivos), e Regular (piques da mídia).
 */
export type InterviewType =
  | 'POST_MATCH_CLASICO'    // Após clássicos
  | 'POST_MATCH_FINAL'      // Após finais de competição
  | 'POST_MATCH_3_LOSSES'   // Após 3 derrotas seguidas
  | 'PRE_SEASON'            // Pré-temporada
  | 'REGULAR';              // Piques regulares pós-jogo

/**
 * As 4 posturas fundamentais do treinador perante a imprensa.
 */
export type ManagerStance =
  | 'SHIELD_TEAM'          // Blindar o Elenco
  | 'PRAISE_TACTIC'        // Exaltar a Tática
  | 'TAKE_RESPONSIBILITY'  // Assumir a Responsabilidade
  | 'DEMAND_EFFORT';       // Cobrar Maior Empenho

/**
 * O contexto do jogo que gera a entrevista (quando ela acontece).
 */
export type InterviewTriggerContext = {
  isClassic?: boolean;
  isFinal?: boolean;
  isThreeLossesStreak?: boolean;
  matchResult: 'W' | 'D' | 'L';
  opponent: string;
  position: number | null;
};

/**
 * Uma opção de resposta com postura declarada e impactos previstos.
 */
export interface CausalAnswerOption {
  id: string;
  stance: ManagerStance;
  label: string;
  text: string;
  impact: {
    boardConfidenceDelta: number;
    squadCohesionDelta: number;
    fanPressureDelta: number;
  };
  explanation?: string;
}

/**
 * Uma pergunta feita pela imprensa na entrevista.
 */
export interface InterviewQuestion {
  id: string;
  question: string;
  reason: string;
  importance: number;
  category?:
    | 'PRESSING'
    | 'DEFENSIVE_LINE'
    | 'WINGS_SYNERGY'
    | 'SUBSTITUTION'
    | 'DISCIPLINE_PENALTY'
    | 'GENERAL'
    | string;
  reporterName?: string;
  mediaOutlet?: string;
  outletBadge?: string;
  answers?: CausalAnswerOption[];
}

/**
 * Uma opção de resposta genérica para compatibilidade.
 */
export interface InterviewAnswerOption {
  id: string;
  label: string;
  expectedFeedback: string;
  fullResponse: string;
}

/**
 * As opções de resposta para uma pergunta específica.
 */
export interface InterviewResponse {
  questionId: string;
  optionId: string;
  stance?: ManagerStance;
  toneAdjustment?: 'CALM' | 'PASSIONATE' | 'DEFIANT' | 'DEFENSIVE';
  customQuestion?: {
    text: string;
    explanation: string;
  };
}

/**
 * Resultado de uma entrevista coletiva incluindo os impactos matemáticos.
 */
export interface PressConferenceResult {
  questionsAnswered: number;
  responses: InterviewResponse[];
  globalPRReward?: number;
  impact: PressConferenceImpact;
}

/**
 * Impactos de uma entrevista em cada um dos três pilares.
 */
export interface PressConferenceImpact {
  /** Board Confidence: -10 a +15 pontos */
  boardConfidenceDelta: number;
  /** Squad Cohesion: -8 a +12 pontos */
  squadCohesionDelta: number;
  /** Fan Pressure: -15 a +20 pontos */
  fanPressureDelta: number;
  breakdown: {
    boardConfidence: string;
    squadCohesion: string;
    fanPressure: string;
  };
}

/**
 * Contexto da entrevista sendo gerada.
 */
export interface PressConferenceContext {
  type: InterviewType;
  trigger: InterviewTriggerContext;
  totalQuestions: number;
  mandatoryQuestionCount: number;
  customQuestionsReplaced: number;
  selectedQuestions: string[];
  baseTone?: 'CALM' | 'PASSIONATE' | 'DEFIANT' | 'DEFENSIVE';
  clubName?: string;
  opponentName?: string;
}

/**
 * Opção de delegação (perfil "Brasfooter" do técnico).
 */
export type DelegationOption =
  | { type: 'NONE' }
  | { type: 'ASSISTANT'; assistantName: string; moveTime: number }
  | { type: 'MOSCOW'; moveTime: number }
  | { type: 'FAVORITE'; moveTime: number }
  | { type: 'KEEPITTIGHT'; initialState: 'QUICK_BREAK' }
  | { type: 'MILKYWAY'; initialState: 'QUICK_BREAK' };

/**
 * Configuração do jogo para entrevistas.
 */
export interface PressConferenceConfig {
  daysUntilNextMatch: number;
  currentWeek: number;
  defaultTone: 'CALM' | 'PASSIONATE' | 'DEFIANT' | 'DEFENSIVE';
  delegationOption: DelegationOption;
  formerPlayers: string[];
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Gera as 4 opções clássicas de postura com seus respectivos textos e impactos matemáticos.
 */
export function buildStanceAnswers(
  questionId: string,
  texts: {
    shield: string;
    tactic: string;
    responsibility: string;
    demand: string;
  },
  customImpacts?: {
    shield?: { board: number; cohesion: number; fan: number };
    tactic?: { board: number; cohesion: number; fan: number };
    responsibility?: { board: number; cohesion: number; fan: number };
    demand?: { board: number; cohesion: number; fan: number };
  },
): CausalAnswerOption[] {
  return [
    {
      id: `${questionId}_SHIELD_TEAM`,
      stance: 'SHIELD_TEAM',
      label: 'Blindar o Elenco',
      text: texts.shield,
      impact: {
        boardConfidenceDelta: customImpacts?.shield?.board ?? 4,
        squadCohesionDelta: customImpacts?.shield?.cohesion ?? 8,
        fanPressureDelta: customImpacts?.shield?.fan ?? -6,
      },
      explanation: 'Protege a confiança dos atletas e fortalece a coesão do vestiário.',
    },
    {
      id: `${questionId}_PRAISE_TACTIC`,
      stance: 'PRAISE_TACTIC',
      label: '🧠 Exaltar a Tática',
      text: texts.tactic,
      impact: {
        boardConfidenceDelta: customImpacts?.tactic?.board ?? 8,
        squadCohesionDelta: customImpacts?.tactic?.cohesion ?? 4,
        fanPressureDelta: customImpacts?.tactic?.fan ?? -8,
      },
      explanation: 'Valoriza o planejamento estratégico e agrada a diretoria e analistas.',
    },
    {
      id: `${questionId}_TAKE_RESPONSIBILITY`,
      stance: 'TAKE_RESPONSIBILITY',
      label: 'Assumir a Culpa',
      text: texts.responsibility,
      impact: {
        boardConfidenceDelta: customImpacts?.responsibility?.board ?? 5,
        squadCohesionDelta: customImpacts?.responsibility?.cohesion ?? 6,
        fanPressureDelta: customImpacts?.responsibility?.fan ?? -5,
      },
      explanation: 'Atrai os holofotes para si, aliviando o peso psicológico do elenco.',
    },
    {
      id: `${questionId}_DEMAND_EFFORT`,
      stance: 'DEMAND_EFFORT',
      label: 'Cobrar Empenho',
      text: texts.demand,
      impact: {
        boardConfidenceDelta: customImpacts?.demand?.board ?? 3,
        squadCohesionDelta: customImpacts?.demand?.cohesion ?? -5,
        fanPressureDelta: customImpacts?.demand?.fan ?? 6,
      },
      explanation: 'Cobra competitividade pública, mas pode gerar desconforto no grupo.',
    },
  ];
}

/**
 * Gera perguntas causais pós-jogo baseadas em fatos reais da partida:
 * - Pressão Alta (>= 5 recuperações ou gols da pressão)
 * - Linha Alta & Bolas nas Costas (contra-ataques sofridos)
 * - Sinergia pelas Pontas / WINGS (cruzamentos e escanteios)
 * - Dedo do Treinador (gol/assistência de substituto)
 * - Disciplina & Pênaltis (expulsões, pênaltis, disputa de pênaltis)
 * - Pergunta Geral sobre o Resultado
 */
export function generateCausalPressConferenceQuestions(
  match: Match,
  userClub: Club,
  opponentClub: Club,
  userTactic?: Tactic,
  tacticalReport?: TacticalMatchReport | null,
): InterviewQuestion[] {
  const result = match.result;
  const events = result?.events ?? [];

  const isHome = match.homeClubId === userClub.id;
  const userSide: MatchSide = isHome ? 'home' : 'away';
  const oppSide: MatchSide = isHome ? 'away' : 'home';

  const userGoals = result ? (isHome ? result.homeGoals : result.awayGoals) : 0;
  const oppGoals = result ? (isHome ? result.awayGoals : result.homeGoals) : 0;

  const userStats: MatchSideStats = (isHome ? result?.stats?.home : result?.stats?.away) ?? {
    shots: 0,
    shotsOnTarget: 0,
    possession: 50,
    corners: 0,
    fouls: 0,
    pressRecoveries: 0,
    goalsFromPressRecovery: 0,
    xg: 0,
    bigChances: 0,
    saves: 0,
    woodwork: 0,
    blockedShots: 0,
  };

  const oppStats: MatchSideStats = (isHome ? result?.stats?.away : result?.stats?.home) ?? {
    shots: 0,
    shotsOnTarget: 0,
    possession: 50,
    corners: 0,
    fouls: 0,
    pressRecoveries: 0,
    goalsFromPressRecovery: 0,
    xg: 0,
    bigChances: 0,
    saves: 0,
    woodwork: 0,
    blockedShots: 0,
  };

  const userEvents = events.filter((e) => e.team === userSide);
  const oppEvents = events.filter((e) => e.team === oppSide);

  const starterIds = new Set(userTactic?.lineup.map((s) => s.playerId) ?? []);
  const subGoalOrAssist = userEvents.find(
    (e) =>
      e.type === 'goal' &&
      ((e.playerId && !starterIds.has(e.playerId)) ||
        (e.assistPlayerId && !starterIds.has(e.assistPlayerId))),
  );

  const candidateQuestions: InterviewQuestion[] = [];

  // 1. GATILHO: Pressão Alta
  const pressRecoveries = userStats.pressRecoveries ?? 0;
  const goalsFromPress = userStats.goalsFromPressRecovery ?? 0;
  if (pressRecoveries >= 5 || goalsFromPress >= 1 || (userTactic?.pressing === 'HIGH_PRESS' && pressRecoveries >= 4)) {
    const qId = 'q_pressing_causal';
    candidateQuestions.push({
      id: qId,
      question: `Vimos uma postura de pressão sufocante hoje, com ${pressRecoveries} recuperações no ataque${goalsFromPress > 0 ? ` e gol gerado diretamente da marcação` : ''}. Essa intensidade alta no campo rival foi a chave da nossa estratégia?`,
      reason: `Time recuperou ${pressRecoveries} bolas no campo ofensivo.`,
      importance: 90,
      category: 'PRESSING',
      reporterName: 'Mauro Naves',
      mediaOutlet: 'ESPN Brasil',
      outletBadge: '📺',
      answers: buildStanceAnswers(qId, {
        shield: 'O mérito é todo do sacrifício e da entrega física dos jogadores em campo. Eles compraram a ideia e correram até a última gota de suor na marcação.',
        tactic: 'Identificamos a fragilidade na saída de bola do rival nos treinos e executamos o plano de pressão com perfeição cirúrgica.',
        responsibility: 'Eu cobro intensidade no limite todos os dias. Assumo a responsabilidade por exigir essa postura agressiva do primeiro ao último minuto.',
        demand: 'Pressionamos bem, mas poderíamos ter sido mais letais ao recuperar a bola no terço final. Ainda há muito a evoluir na pontaria.',
      }),
    });
  }

  // 2. GATILHO: Linha Alta & Exposição (Bolas nas Costas)
  const oppOneOnOnes = oppEvents.filter((e) => e.shotType === 'ONE_ON_ONE').length;
  const isHighLine = userTactic?.defensiveLine === 'HIGH';
  if (isHighLine && (oppOneOnOnes > 0 || oppGoals >= 2)) {
    const qId = 'q_def_line_causal';
    candidateQuestions.push({
      id: qId,
      question: `A linha de zaga jogou muito adiantada e a equipe cedeu bolas longas perigosas nas costas dos defensores (${oppOneOnOnes} cara-a-cara). Não foi um risco excessivo jogar tão exposto?`,
      reason: `Zaga adiantada cedeu ${oppOneOnOnes} infiltrações perigosas nas costas.`,
      importance: 85,
      category: 'DEFENSIVE_LINE',
      reporterName: 'Eric Faria',
      mediaOutlet: 'Globo Esporte',
      outletBadge: '🌐',
      answers: buildStanceAnswers(qId, {
        shield: 'Confio cegamente nos meus zagueiros e na capacidade de cobertura deles. Erros acontecem e defenderemos nossa equipe sempre.',
        tactic: 'Para ter o domínio do jogo e compactar as linhas é mandatório subir a zaga. O risco de tomar a bola nas costas faz parte da nossa proposta protagonista.',
        responsibility: 'A instrução de subir a linha foi minha e eu assumo qualquer falha de posicionamento. Vamos corrigir isso na prancheta.',
        demand: 'Houve desatenção imperdoável na recomposição. Em jogos de alto nível, vacilar nas costas da zaga custa muito caro.',
      }),
    });
  }

  // 3. GATILHO: Sinergia pelas Pontas (WINGS)
  const corners = userStats.corners ?? 0;
  const aerialAttempts = userEvents.filter((e) => e.shotType === 'HEADER').length;
  if (userTactic?.attackStyle === 'WINGS' || corners >= 6 || aerialAttempts >= 2) {
    const qId = 'q_wings_causal';
    candidateQuestions.push({
      id: qId,
      question: `A equipe explorou intensamente os corredores laterais com grande insistência, gerando ${corners} escanteios e jogadas aéreas frequentes. Essa sobrecarga nas pontas foi o plano principal?`,
      reason: `Exploração forte das alas com ${corners} escanteios e volume pelos lados.`,
      importance: 80,
      category: 'WINGS_SYNERGY',
      reporterName: 'Danilo Lavieri',
      mediaOutlet: 'UOL Esporte',
      outletBadge: '📰',
      answers: buildStanceAnswers(qId, {
        shield: 'Nossos alas e pontas fizeram um esforço hercúleo nos corredores. O empenho deles pelas beiradas foi espetacular.',
        tactic: 'Apostamos em alargar o campo e criar superioridade numérica nos flancos para dobrar a marcação adversária. O plano funcionou.',
        responsibility: 'Desenhei os treinos para focar nas transições de ala e assumo a cobrança pela precisão nos cruzamentos.',
        demand: 'Cruzamos muito, mas a presença e a disputa dentro da área poderiam ter sido muito melhores. Desperdiçamos cruzamentos limpos.',
      }),
    });
  }

  // 4. GATILHO: Dedo do Treinador (Substituto Decisivo)
  if (subGoalOrAssist) {
    const subPlayer = userClub.players.find((p) => p.id === subGoalOrAssist.playerId);
    const subPlayerName = subPlayer?.name ?? subGoalOrAssist.assistPlayerName ?? 'o substituto';
    const qId = 'q_sub_causal';
    candidateQuestions.push({
      id: qId,
      question: `A entrada de ${subPlayerName} mudou o panorama da partida e resultou em lance decisivo no segundo tempo. Podemos dizer que foi uma vitória com o dedo do treinador nas alterações?`,
      reason: `Jogador que saiu do banco participou diretamente de gol da equipe.`,
      importance: 88,
      category: 'SUBSTITUTION',
      reporterName: 'Monique Danello',
      mediaOutlet: 'TNT Sports',
      outletBadge: '📺',
      answers: buildStanceAnswers(qId, {
        shield: `A estrela é toda de ${subPlayerName}. Ele treina forte todos os dias, esperou a oportunidade com humildade e entrou iluminado para resolver.`,
        tactic: 'Identificamos o desgaste do marcador rival naquele setor e colocamos velocidade para explorar o espaço. A leitura de jogo foi cirúrgica.',
        responsibility: 'Como treinador, é meu dever enxergar o que a partida pede e tomar decisões difíceis no momento certo.',
        demand: 'Ele entrou bem, mas todos que começam jogando precisam manter o mesmo nível de fome para não precisarmos correr atrás no final.',
      }),
    });
  }

  // 5. GATILHO: Disciplina & Pênaltis
  const hasRedCard = events.some((e) => e.type === 'card' && e.suspensionMatches);
  const hasShootout = !!result?.penaltyShootout;
  const hasPenaltyShot = events.some((e) => e.isPenalty);

  if (hasShootout || hasRedCard || hasPenaltyShot) {
    const qId = 'q_discipline_penalty_causal';
    let questionText = 'Tivemos momentos de forte tensão emocional e disciplina em campo hoje. Como a equipe manteve os ânimos sob controle?';
    let reasonText = 'Jogo com momentos críticos de disciplina ou pênaltis.';

    if (hasShootout) {
      questionText = 'A partida foi decidida na dramática loteria dos pênaltis. Como foi a preparação psicológica e técnica dos batedores para este momento decisivo?';
      reasonText = 'Decisão nos pênaltis.';
    } else if (hasRedCard) {
      questionText = 'A equipe teve que lidar com expulsão que alterou a dinâmica do jogo. Como trabalhar o controle emocional dos atletas em clássicos e jogos decisivos?';
      reasonText = 'Cartão vermelho exibido durante a partida.';
    } else if (hasPenaltyShot) {
      questionText = 'Tivemos pênalti crucial marcado durante os 90 minutos. Como a equipe manteve a frieza para lidar com a pressão da arbitragem e da torcida?';
      reasonText = 'Pênalti marcado no tempo regulamentar.';
    }

    candidateQuestions.push({
      id: qId,
      question: questionText,
      reason: reasonText,
      importance: 84,
      category: 'DISCIPLINE_PENALTY',
      reporterName: 'Elia Júnior',
      mediaOutlet: 'BandSports',
      outletBadge: '🎙️',
      answers: buildStanceAnswers(qId, {
        shield: 'Nenhum atleta entra em campo para cometer erros propositais. Estamos 100% fechados com o grupo na vitória e nos momentos adversos.',
        tactic: 'Treinamos situações de adversidade extrema e bolas paradas exaustivamente. A nossa organização mental e tática foi o diferencial.',
        responsibility: 'A gestão emocional da equipe parte da liderança do treinador. Assumo a responsabilidade de manter todos focados e calmos.',
        demand: 'Não podemos aceitar infantilidade ou falta de maturidade em momentos capitais. Cobranças duras serão feitas internamente.',
      }),
    });
  }

  // 6. GATILHO GERAL: Contexto do Resultado
  const qGeneralId = 'q_general_result';
  let generalQuestion = '';
  let generalReason = '';

  if (userGoals > oppGoals) {
    generalQuestion = `Vitória maiúscula diante do ${opponentClub.name} (${userGoals} x ${oppGoals}). Qual é o recado que essa atuação consistente passa para o campeonato?`;
    generalReason = `Vitória sobre o adversário (${userGoals} x ${oppGoals}).`;
  } else if (userGoals === oppGoals) {
    generalQuestion = `Um empate disputado contra o ${opponentClub.name} (${userGoals} x ${oppGoals}). A sensação final é de um ponto ganho ou de dois pontos deixados para trás?`;
    generalReason = `Empate em ${userGoals} x ${oppGoals}.`;
  } else {
    generalQuestion = `Uma derrota amarga hoje para o ${opponentClub.name} (${userGoals} x ${oppGoals}). O que faltou para o time e qual a resposta imediata que a torcida pode esperar?`;
    generalReason = `Derrota sofrida (${userGoals} x ${oppGoals}).`;
  }

  candidateQuestions.push({
    id: qGeneralId,
    question: generalQuestion,
    reason: generalReason,
    importance: 70,
    category: 'GENERAL',
    reporterName: 'Roberto Lioi',
    mediaOutlet: 'Rádio Transamérica',
    outletBadge: '📻',
    answers: buildStanceAnswers(qGeneralId, {
      shield: `O grupo lutou bravamente do início ao fim. Temos plena convicção no caráter e na qualidade técnica dos nossos atletas.`,
      tactic: `Construímos uma ideia de jogo clara. Seja na vitória ou no revés, nosso modelo de jogo é sólido e não vamos oscilar.`,
      responsibility: `O comandante é quem responde pelo placar final. Vou trabalhar em dobro para colocar o ${userClub.name} no lugar onde merece.`,
      demand: `Vestir a camisa do ${userClub.name} exige brio e inconformismo. Quem não estiver pronto para dar a vida pelo clube terá que repensar sua postura.`,
    }),
  });

  // Ordena por importância decrescente e seleciona entre 2 e 4 perguntas
  candidateQuestions.sort((a, b) => b.importance - a.importance);
  return candidateQuestions.slice(0, 3);
}

/**
 * Calcula o delta de Board Confidence de uma resposta.
 */
export function calculateBoardConfidenceDelta(
  optionId: string,
  responseTone: string,
  hasReferencedPlayers: boolean,
  isFirstResponse: boolean,
  hasBlamedJudges: boolean,
): number {
  if (optionId.includes('SHIELD_TEAM')) return 4;
  if (optionId.includes('PRAISE_TACTIC')) return 8;
  if (optionId.includes('TAKE_RESPONSIBILITY') || optionId.includes('UNITE_COACH')) return 5;
  if (optionId.includes('DEMAND_EFFORT') || optionId.includes('BLAME_PLAYERS')) return 3;

  const BASE_BONUS = 0;
  const BLAME_JUDGE_BONUS = hasBlamedJudges ? 3 : 0;
  const DEFENSIVE_TONE_PENALTY = responseTone === 'DEFENSIVE' ? -2 : 0;
  const FIRST_RESPONSE_BONUS = isFirstResponse ? 2 : 0;
  const HIGHLIGHT_TONE_BONUS = ['PASSIONATE', 'DEFIANT'].includes(responseTone) ? 4 : 0;
  const IRRITATING_TONE_PENALTY = responseTone === 'DEFENSIVE' ? -5 : 0;
  const SHIELD_PLAYER_BONUS = hasReferencedPlayers ? 5 : 0;
  const BLAME_PLAYER_PENALTY = optionId.includes('BLAME_PLAYERS') ? -2 : 0;

  switch (optionId) {
    case 'BLAME_PLAYERS':
      return clamp(BASE_BONUS + BLAME_PLAYER_PENALTY + BLAME_JUDGE_BONUS + FIRST_RESPONSE_BONUS, -10, 10);
    case 'BLAME_JUDGES':
      return clamp(BASE_BONUS + BLAME_JUDGE_BONUS + DEFENSIVE_TONE_PENALTY + FIRST_RESPONSE_BONUS, -8, 8);
    case 'SHIELD_TEAM':
      return clamp(BASE_BONUS + SHIELD_PLAYER_BONUS + HIGHLIGHT_TONE_BONUS + FIRST_RESPONSE_BONUS, -5, 15);
    case 'UNITE_COACH':
      return clamp(BASE_BONUS + HIGHLIGHT_TONE_BONUS + FIRST_RESPONSE_BONUS, -5, 10);
    case 'PROMISE_IMPROVE':
      return clamp(BASE_BONUS + HIGHLIGHT_TONE_BONUS + FIRST_RESPONSE_BONUS, -5, 12);
    default:
      return clamp(
        BASE_BONUS + BLAME_JUDGE_BONUS + DEFENSIVE_TONE_PENALTY + FIRST_RESPONSE_BONUS + HIGHLIGHT_TONE_BONUS + IRRITATING_TONE_PENALTY,
        -10,
        15,
      );
  }
}

/**
 * Calcula o delta de Squad Cohesion de uma resposta.
 */
export function calculateSquadCohesionDelta(
  optionId: string,
  tone: string,
  hasCriticizedPlayers: boolean,
): number {
  if (optionId.includes('SHIELD_TEAM')) return 8;
  if (optionId.includes('PRAISE_TACTIC')) return 4;
  if (optionId.includes('TAKE_RESPONSIBILITY')) return 6;
  if (optionId.includes('DEMAND_EFFORT') || optionId.includes('BLAME_PLAYERS')) return -5;

  const TEAM_SHIELD_BONUS = 5;
  const JUDGE_BLAME_PENALTY = -3;
  const COACH_UNITE_PENALTY = -2;
  const DEFENSIVE_TONE_PENALTY = tone === 'DEFENSIVE' ? -3 : 0;
  const CRITICIZE_PLAYERS_PENALTY = hasCriticizedPlayers ? -4 : 0;
  const PRAISE_TEAM_BONUS = optionId.includes('PRAISE_TEAM') ? 3 : 0;

  switch (optionId) {
    case 'BLAME_PLAYERS':
      return clamp(JUDGE_BLAME_PENALTY + CRITICIZE_PLAYERS_PENALTY + DEFENSIVE_TONE_PENALTY, -8, 5);
    case 'BLAME_JUDGES':
      return clamp(JUDGE_BLAME_PENALTY + DEFENSIVE_TONE_PENALTY, -8, 2);
    case 'SHIELD_TEAM':
      return clamp(TEAM_SHIELD_BONUS + DEFENSIVE_TONE_PENALTY, 0, 12);
    case 'UNITE_COACH':
      return clamp(COACH_UNITE_PENALTY + DEFENSIVE_TONE_PENALTY, -5, 2);
    case 'PRAISE_TEAM':
      return clamp(PRAISE_TEAM_BONUS + DEFENSIVE_TONE_PENALTY, -2, 8);
    default:
      return clamp(DEFENSIVE_TONE_PENALTY, -8, 12);
  }
}

/**
 * Calcula o delta de Fan Pressure.
 */
export function calculateFanPressureDelta(
  optionId: string,
  isFirstResponse: boolean,
  hasTextBoost: boolean,
  hasCustomQuestion: boolean,
  tone: string,
): number {
  if (optionId.includes('SHIELD_TEAM')) return -6;
  if (optionId.includes('PRAISE_TACTIC')) return -8;
  if (optionId.includes('TAKE_RESPONSIBILITY')) return -5;
  if (optionId.includes('DEMAND_EFFORT') || optionId.includes('BLAME_PLAYERS')) return 6;

  const BASE_BONUS = 0;
  const FIRST_RESPONSE_BONUS = isFirstResponse ? 2 : 0;
  const TEXT_BOOST = hasTextBoost ? 3 : 0;
  const CUSTOM_QUESTION_PENALTY = hasCustomQuestion ? -2 : 0;
  const HIGHLIGHT_TONE_BONUS = ['PASSIONATE', 'DEFIANT'].includes(tone) ? 3 : 0;
  const SHIELD_TEAM_BOOST = optionId.includes('SHIELD_TEAM') ? 4 : 0;
  const BLAME_JUDGE_BOOST = optionId.includes('BLAME_JUDGES') ? 2 : 0;
  const PRAISE_TEAM_BOOST = optionId.includes('PRAISE_TEAM') ? 1 : 0;

  switch (optionId) {
    case 'BLAME_PLAYERS':
      return clamp(BASE_BONUS + FIRST_RESPONSE_BONUS + TEXT_BOOST + CUSTOM_QUESTION_PENALTY, -8, 10);
    case 'BLAME_JUDGES':
      return clamp(BASE_BONUS + FIRST_RESPONSE_BONUS + TEXT_BOOST + BLAME_JUDGE_BOOST + CUSTOM_QUESTION_PENALTY, -5, 12);
    case 'SHIELD_TEAM':
      return clamp(BASE_BONUS + FIRST_RESPONSE_BONUS + SHIELD_TEAM_BOOST + TEXT_BOOST + HIGHLIGHT_TONE_BONUS + CUSTOM_QUESTION_PENALTY, -15, 20);
    case 'UNITE_COACH':
      return clamp(BASE_BONUS + FIRST_RESPONSE_BONUS + PRAISE_TEAM_BOOST + TEXT_BOOST + HIGHLIGHT_TONE_BONUS + CUSTOM_QUESTION_PENALTY, -5, 15);
    case 'PRAISE_TEAM':
      return clamp(BASE_BONUS + FIRST_RESPONSE_BONUS + PRAISE_TEAM_BOOST + TEXT_BOOST + HIGHLIGHT_TONE_BONUS + CUSTOM_QUESTION_PENALTY, -8, 12);
    default:
      return clamp(BASE_BONUS + FIRST_RESPONSE_BONUS + TEXT_BOOST + HIGHLIGHT_TONE_BONUS + CUSTOM_QUESTION_PENALTY, -15, 20);
  }
}

/**
 * Calcula o impacto total de uma entrevista baseado nas respostas ou delegação.
 */
export function calculatePressConferenceImpact(
  responses: InterviewResponse[],
  context: PressConferenceContext,
  delegationOption?: DelegationOption,
): PressConferenceImpact {
  if (delegationOption && delegationOption.type !== 'NONE') {
    return applyDelegatedResponse(delegationOption, context, {
      boardConfidenceDelta: 0,
      squadCohesionDelta: 0,
      fanPressureDelta: 0,
      breakdown: {
        boardConfidence: '',
        squadCohesion: '',
        fanPressure: '',
      },
    });
  }

  if (responses.length === 0) {
    return {
      boardConfidenceDelta: 0,
      squadCohesionDelta: 0,
      fanPressureDelta: 0,
      breakdown: {
        boardConfidence: 'Nenhuma resposta fornecida',
        squadCohesion: 'Nenhuma resposta fornecida',
        fanPressure: 'Nenhuma resposta fornecida',
      },
    };
  }

  let boardConfidenceTotal = 0;
  let squadCohesionTotal = 0;
  let fanPressureTotal = 0;
  const breakdowns = {
    boardConfidence: [] as string[],
    squadCohesion: [] as string[],
    fanPressure: [] as string[],
  };

  responses.forEach((response, index) => {
    const isFirstResponse = index === 0;
    const optionId = response.optionId;
    const hasReferencedPlayers = optionId.includes('SHIELD') || optionId.includes('UNITE');
    const hasCriticizedPlayers = optionId.includes('BLAME_PLAYERS') || optionId.includes('DEMAND_EFFORT');
    const hasBlamedJudges = optionId.includes('BLAME_JUDGES');
    const hasTextBoost = optionId.length > 20;
    const hasCustomQuestion = !!response.customQuestion;
    const tone = response.toneAdjustment ?? context.baseTone ?? 'CALM';

    const boardDelta = calculateBoardConfidenceDelta(
      optionId,
      tone,
      hasReferencedPlayers,
      isFirstResponse,
      hasBlamedJudges,
    );
    const cohesionDelta = calculateSquadCohesionDelta(
      optionId,
      tone,
      hasCriticizedPlayers,
    );
    const fanDelta = calculateFanPressureDelta(
      optionId,
      isFirstResponse,
      hasTextBoost,
      hasCustomQuestion,
      tone,
    );

    boardConfidenceTotal += boardDelta;
    squadCohesionTotal += cohesionDelta;
    fanPressureTotal += fanDelta;

    breakdowns.boardConfidence.push(`${optionId}: ${boardDelta}`);
    breakdowns.squadCohesion.push(`${optionId}: ${cohesionDelta}`);
    breakdowns.fanPressure.push(`${optionId}: ${fanDelta}`);
  });

  return {
    boardConfidenceDelta: clamp(Math.round(boardConfidenceTotal), -10, 15),
    squadCohesionDelta: clamp(Math.round(squadCohesionTotal), -8, 12),
    fanPressureDelta: clamp(Math.round(fanPressureTotal), -15, 20),
    breakdown: {
      boardConfidence: breakdowns.boardConfidence.join('; '),
      squadCohesion: breakdowns.squadCohesion.join('; '),
      fanPressure: breakdowns.fanPressure.join('; '),
    },
  };
}

/**
 * Aplica efeito de delegação baseado no perfil escolhido.
 */
function applyDelegatedResponse(
  delegationOption: DelegationOption,
  context: PressConferenceContext,
  baseImpact: PressConferenceImpact,
): PressConferenceImpact {
  switch (delegationOption.type) {
    case 'NONE':
      return baseImpact;

    case 'ASSISTANT':
      return {
        boardConfidenceDelta: 2,
        squadCohesionDelta: 1,
        fanPressureDelta: -2,
        breakdown: {
          boardConfidence: 'Auxiliar técnico gerenciou a coletiva com postura neutra e institucional.',
          squadCohesion: 'Elenco preservado de declarações polêmicas.',
          fanPressure: 'Torcida serena com a condução profissional do auxiliar.',
        },
      };

    default:
      return {
        boardConfidenceDelta: 1,
        squadCohesionDelta: 1,
        fanPressureDelta: -1,
        breakdown: {
          boardConfidence: 'Coletiva conduzida sem polêmicas pela assessoria.',
          squadCohesion: 'Vestiário mantido estável.',
          fanPressure: 'Ambiente controlado perante a mídia.',
        },
      };
  }
}
