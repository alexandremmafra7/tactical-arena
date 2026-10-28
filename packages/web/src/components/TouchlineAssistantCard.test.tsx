import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Club, Player, Tactic } from '@tactical-arena/shared';
import {
  TouchlineAssistantCard,
  generateTouchlineAlerts,
  findBestSubstitute,
} from './TouchlineAssistantCard.js';

describe('TouchlineAssistantCard Component & Live Tactical Alerts', () => {
  const dummySquad: Player[] = [
    {
      id: 'p-gk',
      name: 'Goleiro Seguro',
      position: 'GK',
      overall: 80,
      age: 26,
      value: 1000000,
      salary: 20000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-def-1',
      name: 'Zagueiro Titular 1',
      position: 'DEF',
      overall: 82,
      age: 27,
      value: 1200000,
      salary: 22000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-def-2',
      name: 'Zagueiro Titular 2',
      position: 'DEF',
      overall: 79,
      age: 25,
      value: 900000,
      salary: 18000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-lat-1',
      name: 'Lateral Esquerdo',
      position: 'LAT',
      overall: 78,
      age: 24,
      value: 800000,
      salary: 17000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-lat-2',
      name: 'Lateral Direito',
      position: 'LAT',
      overall: 77,
      age: 23,
      value: 750000,
      salary: 16000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-mid-1',
      name: 'Volante Titular',
      position: 'MID',
      overall: 84,
      age: 28,
      value: 1500000,
      salary: 25000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-mid-2',
      name: 'Meia Construtor',
      position: 'MID',
      overall: 83,
      age: 26,
      value: 1400000,
      salary: 24000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-mid-3',
      name: 'Meia Cansado',
      position: 'MID',
      overall: 80,
      age: 29,
      value: 1100000,
      salary: 21000,
      clubId: 'club-test',
      fatigue: 65, // fadiga alta gera fôlego < 50%
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-mid-4',
      name: 'Meia Lateral',
      position: 'MID',
      overall: 78,
      age: 22,
      value: 800000,
      salary: 17000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-att-1',
      name: 'Atacante 1',
      position: 'ATT',
      overall: 85,
      age: 25,
      value: 1800000,
      salary: 28000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-att-2',
      name: 'Atacante 2',
      position: 'ATT',
      overall: 81,
      age: 24,
      value: 1200000,
      salary: 22000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    // Reservas disponíveis
    {
      id: 'p-res-def',
      name: 'Zagueiro Reserva',
      position: 'DEF',
      overall: 76,
      age: 21,
      value: 600000,
      salary: 14000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-res-mid',
      name: 'Meia Reserva',
      position: 'MID',
      overall: 79,
      age: 23,
      value: 900000,
      salary: 18000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
    {
      id: 'p-res-att',
      name: 'Atacante Reserva',
      position: 'ATT',
      overall: 78,
      age: 22,
      salary: 17000,
      clubId: 'club-test',
      fatigue: 0,
      injuryWeeks: 0,
      suspensions: [],
    },
  ] as unknown as Player[];

  const dummyClub: Club = {
    id: 'club-test',
    name: 'Tactical FC',
    slug: 'tactical-fc',
    reputation: 75,
    players: dummySquad,
    division: 1,
  } as unknown as Club;

  const dummyTactic: Tactic = {
    clubId: 'club-test',
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'BALANCED',
    markingStyle: 'BALANCED',
    attackApproach: 'BALANCED',
    pressing: 'MEDIUM',
    defensiveLine: 'BALANCED',
    lineup: [
      { playerId: 'p-gk' },
      { playerId: 'p-lat-1' },
      { playerId: 'p-def-1' },
      { playerId: 'p-def-2' },
      { playerId: 'p-lat-2' },
      { playerId: 'p-mid-1' },
      { playerId: 'p-mid-2' },
      { playerId: 'p-mid-3' },
      { playerId: 'p-mid-4' },
      { playerId: 'p-att-1' },
      { playerId: 'p-att-2' },
    ],
    substitutes: [{ playerId: 'p-res-def' }, { playerId: 'p-res-mid' }, { playerId: 'p-res-att' }],
    plannedSubstitutions: [],
  };

  it('1. Dispara alerta de jogador pendurado quando titular tiver amarelo e divididas pesadas', () => {
    const aggressiveTactic: Tactic = {
      ...dummyTactic,
      markingStyle: 'HEAVY',
      pressing: 'HIGH_PRESS',
    };

    const bookedIds = new Set(['p-def-1']);

    const alerts = generateTouchlineAlerts({
      myClub: dummyClub,
      myTactic: aggressiveTactic,
      mySide: 'home',
      currentMinute: 30,
      bookedPlayerIds: bookedIds,
    });

    const yellowAlert = alerts.find((a) => a.type === 'yellow_card_risk');
    expect(yellowAlert).toBeDefined();
    expect(yellowAlert?.message).toContain('Zagueiro Titular 1 pendurado — risco de expulsão em divididas fortes');
    expect(yellowAlert?.actionLabel).toContain('Poupar / Substituir');

    // Valida renderização no componente
    const html = renderToStaticMarkup(
      <TouchlineAssistantCard
        myClub={dummyClub}
        myTactic={aggressiveTactic}
        mySide="home"
        currentMinute={30}
        bookedPlayerIds={bookedIds}
      />
    );

    expect(html).toContain('Risco de Expulsão');
    expect(html).toContain('Zagueiro Titular 1 pendurado — risco de expulsão em divididas fortes');
    expect(html).toContain('Poupar / Substituir');
  });

  it('2. Dispara recomendação de substituição por fadiga quando estamina < 50%', () => {
    // p-mid-3 tem fatigue: 65, portanto seu fôlego já inicia < 50%
    const alerts = generateTouchlineAlerts({
      myClub: dummyClub,
      myTactic: dummyTactic,
      mySide: 'home',
      currentMinute: 65,
    });

    const fatigueAlert = alerts.find((a) => a.type === 'fatigue_warning' && a.targetPlayerId === 'p-mid-3');
    expect(fatigueAlert).toBeDefined();
    expect(fatigueAlert?.message).toContain('Meia Cansado sem fôlego');
    expect(fatigueAlert?.message).toContain('rendimento em queda');
    expect(fatigueAlert?.actionLabel).toContain('Substituir por Meia Reserva');

    // Valida renderização no componente
    const html = renderToStaticMarkup(
      <TouchlineAssistantCard
        myClub={dummyClub}
        myTactic={dummyTactic}
        mySide="home"
        currentMinute={65}
      />
    );

    expect(html).toContain('Esgotamento Físico');
    expect(html).toContain('Meia Cansado sem fôlego');
    expect(html).toContain('Substituir por Meia Reserva');
  });

  it('3. Dispara contramedida tática quando a linha defensiva estiver vulnerável', () => {
    const highLineTactic: Tactic = {
      ...dummyTactic,
      defensiveLine: 'HIGH',
      pressing: 'HIGH_PRESS',
    };

    // Adversário (away) acumulou chutes perigosos e xG alto
    const alerts = generateTouchlineAlerts({
      myClub: dummyClub,
      myTactic: highLineTactic,
      mySide: 'home',
      currentMinute: 55,
      awayShots: 6,
      awayXg: 1.4,
    });

    const vulnAlert = alerts.find((a) => a.type === 'tactical_vulnerability');
    expect(vulnAlert).toBeDefined();
    expect(vulnAlert?.message).toContain('Adversário explorando bolas nas costas da zaga');
    expect(vulnAlert?.actionLabel).toContain('Recuar Linha para Média');

    // Valida renderização no componente
    const html = renderToStaticMarkup(
      <TouchlineAssistantCard
        myClub={dummyClub}
        myTactic={highLineTactic}
        mySide="home"
        currentMinute={55}
        awayShots={6}
        awayXg={1.4}
      />
    );

    expect(html).toContain('Vulnerabilidade Tática');
    expect(html).toContain('Adversário explorando bolas nas costas da zaga');
    expect(html).toContain('Recuar Linha para Média');
  });

  it('4. Executa callback de intervenção em 1 clique corretamente para substituição e tática', () => {
    const onApplySubstitution = vi.fn();
    const onApplyTacticalChange = vi.fn();

    const highLineTactic: Tactic = {
      ...dummyTactic,
      defensiveLine: 'HIGH',
      pressing: 'HIGH_PRESS',
      markingStyle: 'HEAVY',
    };

    const bookedIds = new Set(['p-def-1']);

    const alerts = generateTouchlineAlerts({
      myClub: dummyClub,
      myTactic: highLineTactic,
      mySide: 'home',
      currentMinute: 70,
      bookedPlayerIds: bookedIds,
      awayShots: 5,
      awayXg: 1.2,
      onApplySubstitution,
      onApplyTacticalChange,
    });

    // 1. Testa execução do alerta de cartão amarelo (substituição do titular pendurado)
    const yellowAlert = alerts.find((a) => a.type === 'yellow_card_risk');
    expect(yellowAlert).toBeDefined();
    yellowAlert?.execute();
    expect(onApplySubstitution).toHaveBeenCalledWith('p-def-1', 'p-res-def');

    // 2. Testa execução do alerta de fadiga (substituição do titular esgotado)
    const fatigueAlert = alerts.find((a) => a.type === 'fatigue_warning' && a.targetPlayerId === 'p-mid-3');
    expect(fatigueAlert).toBeDefined();
    fatigueAlert?.execute();
    expect(onApplySubstitution).toHaveBeenCalledWith('p-mid-3', 'p-res-mid');

    // 3. Testa execução da vulnerabilidade tática (recuar linha defensiva)
    const vulnAlert = alerts.find((a) => a.type === 'tactical_vulnerability');
    expect(vulnAlert).toBeDefined();
    vulnAlert?.execute();
    expect(onApplyTacticalChange).toHaveBeenCalledWith({
      defensiveLine: 'BALANCED',
      pressing: 'MEDIUM',
    });
  });

  it('5. Encontra corretamente o melhor reserva da mesma posição', () => {
    const targetDefender = dummySquad.find((p) => p.id === 'p-def-1')!;
    const bestSub = findBestSubstitute(dummyClub.players, dummyTactic, targetDefender);
    expect(bestSub?.id).toBe('p-res-def');
    expect(bestSub?.position).toBe('DEF');
  });

  it('6. Apresenta resumo de comissão técnica no intervalo (45 minutos)', () => {
    const alerts = generateTouchlineAlerts({
      myClub: dummyClub,
      myTactic: dummyTactic,
      mySide: 'home',
      currentMinute: 45,
      isHalftime: true,
      homeShots: 4,
      awayShots: 2,
    });

    const halftimeAlert = alerts.find((a) => a.type === 'halftime_advice');
    expect(halftimeAlert).toBeDefined();
    expect(halftimeAlert?.title).toBe('Estratégia do 2º Tempo');
  });
});
