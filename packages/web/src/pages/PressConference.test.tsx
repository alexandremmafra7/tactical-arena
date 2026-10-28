import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, beforeEach } from 'vitest';
import { calculatePressConferenceImpact, type PressConferenceImpact } from '@tactical-arena/shared';
import { PressConferenceView, type ToneOption } from './PressConference.js';
import {
  localCreatePressConference,
  localSubmitPressConferenceAnswers,
  localGetPressConferenceById,
  localGetPressConferenceHistory,
  resetInMemoryGameState,
  loadLocalGameState,
} from '../api/localEngine.js';

describe('PressConference Component & Views', () => {
  const mockPc = {
    id: 'pc-123',
    clubId: 'club_BRA_1',
    week: 5,
    type: 'REGULAR',
    trigger: 'NORMAL',
    status: 'OPEN',
    context: {
      clubName: 'Flamengo',
      managerName: 'Treinador Teste',
      opponent: 'Vasco',
      matchResult: 'W',
      position: 1,
      isClassic: true,
      isFinal: false,
      isThreeLossesStreak: false,
    },
    questions: [
      { id: 'q1', text: 'Como você avalia a vitória no clássico?', category: 'REGULAR' },
      { id: 'q2', text: 'O que achou da atuação defensiva?', category: 'TACTICAL' },
    ],
  };

  it('renders questions, navigation and tone options in interactive mode', () => {
    const html = renderToStaticMarkup(
      <PressConferenceView
        pc={mockPc}
        currentQuestionIndex={0}
        answers={{}}
        selectedTone="CALM"
        submitting={false}
        completedImpact={null}
        onSelectTone={() => {}}
        onSelectAnswer={() => {}}
        onNext={() => {}}
        onPrev={() => {}}
        onSubmit={() => {}}
        onContinue={() => {}}
      />
    );

    expect(html).toContain('Sala de Imprensa');
    expect(html).toContain('Flamengo — Coletiva Pós-Jogo');
    expect(html).toContain('Delegar ao Auxiliar');
    expect(html).toContain('Tom da Resposta');
    expect(html).toContain('Calmo');
    expect(html).toContain('Apaixonado');
    expect(html).toContain('Desafiador');
    expect(html).toContain('Defensivo');
    expect(html).toContain('Pergunta 1 de 2');
    expect(html).toContain('Como você avalia a vitória no clássico?');
    expect(html).toContain('Próxima');
  });

  it('renders the delegated completion screen with 3-pillar impact deltas', () => {
    const delegatedPc = {
      ...mockPc,
      status: 'DELEGATED' as const,
      impact: {
        boardConfidenceDelta: 1,
        squadCohesionDelta: 1,
        fanPressureDelta: -1,
        breakdown: {
          boardConfidence: 'resposta comedida',
          squadCohesion: 'elenco poupado',
          fanPressure: 'torcida dividida',
        },
      } satisfies PressConferenceImpact,
    };

    const html = renderToStaticMarkup(
      <PressConferenceView
        pc={delegatedPc}
        currentQuestionIndex={0}
        answers={{}}
        selectedTone="CALM"
        submitting={false}
        completedImpact={delegatedPc.impact}
        onSelectTone={() => {}}
        onSelectAnswer={() => {}}
        onNext={() => {}}
        onPrev={() => {}}
        onSubmit={() => {}}
        onContinue={() => {}}
      />
    );

    expect(html).toContain('Coletiva Delegada');
    expect(html).toContain('Impacto na Opinião Pública');
    expect(html).toContain('Diretoria');
    expect(html).toContain('+1%');
    expect(html).toContain('Vestiário');
    expect(html).toContain('+1%');
    expect(html).toContain('Torcida');
    expect(html).toContain('-1%');
    expect(html).toContain('Continuar');
  });

  it('renders completed interactive submission impact with negative deltas highlighted', () => {
    const submittedPc = {
      ...mockPc,
      status: 'SUBMITTED' as const,
      impact: {
        boardConfidenceDelta: -3,
        squadCohesionDelta: -2,
        fanPressureDelta: 5,
        breakdown: {
          boardConfidence: 'declaração mal recebida',
          squadCohesion: 'elenco exposto',
          fanPressure: 'torcida cobrou',
        },
      } satisfies PressConferenceImpact,
    };

    const html = renderToStaticMarkup(
      <PressConferenceView
        pc={submittedPc}
        currentQuestionIndex={0}
        answers={{}}
        selectedTone="DEFENSIVE"
        submitting={false}
        completedImpact={submittedPc.impact}
        onSelectTone={() => {}}
        onSelectAnswer={() => {}}
        onNext={() => {}}
        onPrev={() => {}}
        onSubmit={() => {}}
        onContinue={() => {}}
      />
    );

    expect(html).toContain('Coletiva Concluída');
    expect(html).toContain('-3%');
    expect(html).toContain('-2%');
    expect(html).toContain('+5%');
  });

  it('renders causal question with 4 manager stances, reporter outlet badge and preview impacts', () => {
    const causalPc = {
      id: 'pc-causal-1',
      clubId: 'club_BRA_1',
      week: 8,
      type: 'REGULAR',
      trigger: 'NORMAL',
      status: 'OPEN',
      context: {
        clubName: 'Flamengo',
        managerName: 'Técnico Causal',
        opponent: 'Palmeiras',
        matchResult: 'W',
        position: 1,
      },
      questions: [
        {
          id: 'q_press',
          text: 'Vimos uma postura de pressão sufocante hoje, com 6 recuperações no ataque. Essa intensidade foi a chave?',
          category: 'PRESSING',
          reporterName: 'Mauro Naves',
          mediaOutlet: 'ESPN Brasil',
          outletBadge: '📺',
          answers: [
            {
              id: 'q_press_SHIELD_TEAM',
              stance: 'SHIELD_TEAM',
              label: 'Blindar o Elenco',
              text: 'O mérito é todo do sacrifício e da entrega física dos jogadores em campo.',
              impact: { boardConfidenceDelta: 4, squadCohesionDelta: 8, fanPressureDelta: -6 },
            },
            {
              id: 'q_press_PRAISE_TACTIC',
              stance: 'PRAISE_TACTIC',
              label: '🧠 Exaltar a Tática',
              text: 'Executamos o plano de pressão com perfeição cirúrgica.',
              impact: { boardConfidenceDelta: 8, squadCohesionDelta: 4, fanPressureDelta: -8 },
            },
            {
              id: 'q_press_TAKE_RESPONSIBILITY',
              stance: 'TAKE_RESPONSIBILITY',
              label: 'Assumir a Culpa',
              text: 'Eu cobro intensidade no limite todos os dias.',
              impact: { boardConfidenceDelta: 5, squadCohesionDelta: 6, fanPressureDelta: -5 },
            },
            {
              id: 'q_press_DEMAND_EFFORT',
              stance: 'DEMAND_EFFORT',
              label: 'Cobrar Empenho',
              text: 'Pressionamos bem, mas faltou ser mais letal nas conclusões.',
              impact: { boardConfidenceDelta: 3, squadCohesionDelta: -5, fanPressureDelta: 6 },
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(
      <PressConferenceView
        pc={causalPc}
        currentQuestionIndex={0}
        answers={{}}
        selectedTone="CALM"
        submitting={false}
        completedImpact={null}
        onSelectTone={() => {}}
        onSelectAnswer={() => {}}
        onNext={() => {}}
        onPrev={() => {}}
        onSubmit={() => {}}
        onContinue={() => {}}
      />,
    );

    expect(html).toContain('ESPN Brasil');
    expect(html).toContain('Mauro Naves');
    expect(html).toContain('PRESSING');
    expect(html).toContain('Blindar o Elenco');
    expect(html).toContain('🧠 Exaltar a Tática');
    expect(html).toContain('Assumir a Culpa');
    expect(html).toContain('Cobrar Empenho');
    expect(html).toContain('Dir: +4');
    expect(html).toContain('Vest: +8');
    expect(html).toContain('Torc: -6');
  });
});

describe('Offline LocalEngine Press Conference Integration', () => {
  beforeEach(async () => {
    localStorage.clear();
    resetInMemoryGameState();
    // O dono do mundo offline é a constante LOCAL_USER_ID do motor, e não um campo do estado.
    await loadLocalGameState();
  });

  it('creates an open press conference when staff delegation is manual', async () => {
    const saveState = await loadLocalGameState();
    const club = saveState.clubs.find((c) => c.id === 'club_BRA_1')!;
    club.staffDelegationConfig = {
      ...(club.staffDelegationConfig as any),
      pressConferences: 'manual',
    };

    const triggerContext = {
      opponent: 'Corinthians',
      matchResult: 'W' as const,
      position: 2,
      isClassic: true,
      isFinal: false,
      isThreeLossesStreak: false,
    };

    const pc = await localCreatePressConference('club_BRA_1', 'local_manager_1', 'REGULAR', triggerContext);

    expect(pc).toBeDefined();
    expect(pc.id).toMatch(/^pc_/);
    expect(pc.status).toBe('OPEN');
    expect(pc.questions.length).toBeGreaterThan(0);
    expect(pc.context.opponentName).toBe('Corinthians');

    const fetched = await localGetPressConferenceById(pc.id);
    expect(fetched).toEqual(pc);
  });

  it('applies automatic background delegation (Regra Brasfooter) when delegated in staff config', async () => {
    const saveState = await loadLocalGameState();
    const club = saveState.clubs.find((c) => c.id === 'club_BRA_1')!;
    club.staffDelegationConfig = {
      ...(club.staffDelegationConfig as any),
      pressConferences: 'delegated',
    };

    const triggerContext = {
      opponent: 'Palmeiras',
      matchResult: 'W' as const,
      position: 1,
      isClassic: true,
      isFinal: false,
      isThreeLossesStreak: false,
    };

    const pc = await localCreatePressConference('club_BRA_1', 'local_manager_1', 'REGULAR', triggerContext);

    expect(pc).toBeDefined();
    expect(pc.status).toBe('DELEGATED');
    expect(pc.impact).toBeDefined();
    expect(typeof pc.impact?.boardConfidenceDelta).toBe('number');
    expect(typeof pc.impact?.squadCohesionDelta).toBe('number');
    expect(typeof pc.impact?.fanPressureDelta).toBe('number');
  });

  it('submits interactive answers and calculates impact offline', async () => {
    const saveState = await loadLocalGameState();
    const club = saveState.clubs.find((c) => c.id === 'club_BRA_1')!;
    club.staffDelegationConfig = {
      ...(club.staffDelegationConfig as any),
      pressConferences: 'manual',
    };

    const triggerContext = {
      opponent: 'Grêmio',
      matchResult: 'W' as const,
      position: 3,
      isClassic: false,
      isFinal: false,
      isThreeLossesStreak: false,
    };

    const pc = await localCreatePressConference('club_BRA_1', 'local_manager_1', 'REGULAR', triggerContext);

    const responses = pc.questions.map((q) => ({
      questionId: q.id,
      optionId: 'opt_positive',
      toneAdjustment: 'CALM' as ToneOption,
    }));

    const submitted = await localSubmitPressConferenceAnswers(pc.id, 'local_manager_1', responses);

    expect(submitted.status).toBe('SUBMITTED');
    expect(submitted.responses).toEqual(responses);
    expect(submitted.impact).toBeDefined();
    expect(submitted.impact!.squadCohesionDelta).toBeGreaterThanOrEqual(0);

    const history = await localGetPressConferenceHistory('club_BRA_1', 5);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history.find((h) => h.id === pc.id)?.status).toBe('SUBMITTED');
  });

  it('supports assistant delegation via submit endpoint', async () => {
    const saveState = await loadLocalGameState();
    const club = saveState.clubs.find((c) => c.id === 'club_BRA_1')!;
    club.staffDelegationConfig = {
      ...(club.staffDelegationConfig as any),
      pressConferences: 'manual',
    };

    const triggerContext = {
      opponent: 'Santos',
      matchResult: 'L' as const,
      position: 10,
      isClassic: false,
      isFinal: false,
      isThreeLossesStreak: true,
    };

    const pc = await localCreatePressConference('club_BRA_1', 'local_manager_1', 'REGULAR', triggerContext);

    const submitted = await localSubmitPressConferenceAnswers(pc.id, 'local_manager_1', [], { type: 'ASSISTANT', assistantName: 'Auxiliar Técnico', moveTime: 0 });

    expect(submitted.status).toBe('DELEGATED');
    expect(submitted.impact).toBeDefined();
  });
});
