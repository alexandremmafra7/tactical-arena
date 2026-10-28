import { describe, it, expect } from 'vitest';
import { MAX_SPONSORSHIPS } from './finance.js';
import { budgetRunwayWeeks, clubAdvice, clubAlerts, seasonObjective, tiredPlayers } from './clubBriefing.js';
import type { BriefingContext } from './clubBriefing.js';
import { makeClub, makePlayer } from '../simulation/testFactories.js';
import type { StaffMember } from './staff.js';

function staff(role: StaffMember['role'], rating: number, name: string): StaffMember {
  return {
    id: `${role}-${rating}`, name, role, tier: 'OURO', rating, specialty: 'teste', description: '',
    wage: 10_000, minClubVisibility: 0, minCareerTitles: 0, avatar: '', nationality: 'BRA',
  };
}

const fitnessCoach = (rating: number, name: string) => staff('FITNESS_COACH', rating, name);
const financialDirector = () => staff('FINANCIAL_DIRECTOR', 80, 'Marco Delgado');

const healthy: BriefingContext = { incomingProposals: 0, hasLineup: true, weeklyNet: 50_000 };

/**
 * Um clube em ordem tem a prancha de patrocínios cheia.
 *
 * `makeClub` cria o clube sem contrato nenhum, o que no jogo de verdade não acontece: todo clube nasce com o
 * quadro que `buildSponsorBoard` monta. Sem isto, "nada a fazer" incluía cinco vagas de patrocínio abertas,
 * que é exatamente algo a fazer.
 */
function clubWith(overrides: Partial<ReturnType<typeof makeClub>> = {}) {
  const cheio = Array.from({ length: MAX_SPONSORSHIPS }, (_, i) => ({ id: `s${i}` })) as never;
  return { ...makeClub('brief', 'Briefing FC', 70), sponsorships: cheio, ...overrides };
}

describe('budget runway', () => {
  it('is unbounded while the club is not losing money', () => {
    expect(budgetRunwayWeeks(1000, 0)).toBe(Infinity);
    expect(budgetRunwayWeeks(1000, 500)).toBe(Infinity);
  });

  it('counts whole weeks of survival at the current burn rate', () => {
    expect(budgetRunwayWeeks(1000, -300)).toBe(3);
  });
});

describe('clubAlerts', () => {
  it('says nothing when there is nothing to act on', () => {
    expect(clubAlerts(clubWith(), healthy)).toEqual([]);
  });

  it('leads with a missing lineup, the one thing that silently costs you a match', () => {
    const alerts = clubAlerts(clubWith(), { ...healthy, hasLineup: false });
    expect(alerts[0].message).toContain('escalação');
    expect(alerts[0].severity).toBe('urgent');
    expect(alerts[0].actionPath).toBe('tactics');
  });

  it('names a single injured player but counts a crowd of them', () => {
    const one = clubWith({ players: [makePlayer('a', { name: 'Zé', injuryWeeks: 2 }), makePlayer('b')] });
    expect(clubAlerts(one, healthy)[0].message).toBe('Zé está lesionado');

    const many = clubWith({
      players: [makePlayer('a', { injuryWeeks: 1 }), makePlayer('b', { injuryWeeks: 3 }), makePlayer('c')],
    });
    expect(clubAlerts(many, healthy)[0].message).toBe('2 jogadores lesionados');
  });

  it('raises incoming proposals so they cannot be missed', () => {
    const alerts = clubAlerts(clubWith(), { ...healthy, incomingProposals: 3 });
    expect(alerts.some((a) => a.message.includes('3 propostas'))).toBe(true);
  });

  it('escalates the budget warning as the runway shortens', () => {
    const soon = clubAlerts(clubWith({ budget: 400 }), { ...healthy, weeklyNet: -100 });
    const dire = clubAlerts(clubWith({ budget: 100 }), { ...healthy, weeklyNet: -100 });
    expect(soon.find((a) => a.message.includes('Saldo'))?.severity).toBe('warning');
    expect(dire.find((a) => a.message.includes('Saldo'))?.severity).toBe('urgent');
  });

  it('stays quiet about money while the club is profitable', () => {
    expect(clubAlerts(clubWith({ budget: 1 }), healthy).some((a) => a.message.includes('Saldo'))).toBe(false);
  });
});

describe('clubAdvice', () => {
  it('flags the most drained player by name', () => {
    const club = clubWith({
      players: [makePlayer('a', { name: 'Cansado', fatigue: 90 }), ...Array.from({ length: 20 }, (_, i) => makePlayer(`p${i}`))],
    });
    const advice = clubAdvice(club, healthy);
    expect(advice.some((a) => a.message.includes('Cansado') && a.message.includes('10%'))).toBe(true);
  });

  it('warns when the squad is too thin to rotate', () => {
    const club = clubWith({ players: Array.from({ length: 12 }, (_, i) => makePlayer(`p${i}`)) });
    expect(clubAdvice(club, healthy).some((a) => a.message.includes('elenco está curto'))).toBe(true);
  });

  it('mentions the captaincy only while nobody wears the armband', () => {
    const without = clubAdvice(clubWith({ captainPlayerId: null }), healthy);
    const withCaptain = clubAdvice(clubWith({ captainPlayerId: 'brief-p0' }), healthy);
    expect(without.some((a) => a.message.includes('capitão'))).toBe(true);
    expect(withCaptain.some((a) => a.message.includes('capitão'))).toBe(false);
  });

  it('sorts tired players worst first', () => {
    const players = [makePlayer('a', { fatigue: 75 }), makePlayer('b', { fatigue: 95 }), makePlayer('c', { fatigue: 10 })];
    expect(tiredPlayers(players).map((p) => p.id)).toEqual(['b', 'a']);
  });

  /**
   * Whose job each line is.
   *
   * The advice used to arrive unsigned, as though the game itself were talking, while the five people the
   * club pays for lived on a screen of their own applying multipliers nobody ever saw. A manager could run a
   * season without once noticing what the comissao was for.
   */
  it('puts a name on the advice when the club employs somebody to give it', () => {
    const tired = [makePlayer('a', { name: 'Cansado', fatigue: 90 }), ...Array.from({ length: 20 }, (_, i) => makePlayer(`p${i}`))];

    const withCoach = clubAdvice(clubWith({ players: tired, staff: [fitnessCoach(80, 'Zeca Moretti')] }), healthy);
    const alone = clubAdvice(clubWith({ players: tired }), healthy);

    const signed = withCoach.find((a) => a.message.includes('Cansado'));
    const unsigned = alone.find((a) => a.message.includes('Cansado'));

    expect(signed?.role).toBe('FITNESS_COACH');
    expect(signed?.staffName).toBe('Zeca Moretti');
    // A vacant post still speaks, it just has nobody behind it. That is what the empty chair looks like.
    expect(unsigned?.role).toBe('FITNESS_COACH');
    expect(unsigned?.staffName).toBeNull();
  });

  it('makes a better fitness coach spot a tiring player sooner', () => {
    // 63 is nowhere near the 70 an empty dugout waits for, and well inside what a good coach watches for.
    const players = [makePlayer('a', { name: 'Meio Cansado', fatigue: 63 }), ...Array.from({ length: 20 }, (_, i) => makePlayer(`p${i}`))];

    const alone = clubAdvice(clubWith({ players }), healthy);
    const coached = clubAdvice(clubWith({ players, staff: [fitnessCoach(95, 'Elite')] }), healthy);

    expect(alone.some((a) => a.message.includes('Meio Cansado'))).toBe(false);
    expect(coached.some((a) => a.message.includes('Meio Cansado'))).toBe(true);
  });

  it('has the financial director watch for a sponsorship about to run out', () => {
    const expiring = {
      id: 's1', type: 'MASTER' as const, sponsorName: 'Banco Meridian', weeklyAmount: 40_000,
      weeksRemaining: 3, contractLength: 'LONGO' as const, titleBonus: 0, cupBonus: 0,
    };

    const withDirector = clubAdvice(clubWith({ sponsorships: [expiring], staff: [financialDirector()] }), healthy);
    const alone = clubAdvice(clubWith({ sponsorships: [expiring] }), healthy);

    // Money that simply stops arriving one week is the one thing here nobody notices without being told.
    expect(withDirector.some((a) => a.message.includes('Banco Meridian'))).toBe(true);
    expect(alone.some((a) => a.message.includes('Banco Meridian'))).toBe(false);
  });
});

describe('seasonObjective', () => {
  it('asks the strongest squad in the division to win it', () => {
    expect(seasonObjective(1, 20, 1).targetPosition).toBe(1);
    expect(seasonObjective(1, 20, 1).label).toContain('Ganhar');
  });

  it('only asks the weakest squads to survive', () => {
    const obj = seasonObjective(20, 20, 18);
    expect(obj.label).toContain('rebaixamento');
    expect(obj.targetPosition).toBeGreaterThan(10);
  });

  it('scales the ask with squad strength, never asking a minnow to win the league', () => {
    const strong = seasonObjective(2, 20, 10).targetPosition;
    const middling = seasonObjective(10, 20, 10).targetPosition;
    const weak = seasonObjective(19, 20, 10).targetPosition;
    expect(strong).toBeLessThan(middling);
    expect(middling).toBeLessThan(weak);
  });

  it('reports the objective as met once the club is at or above target', () => {
    expect(seasonObjective(1, 20, 1).met).toBe(true);
    expect(seasonObjective(1, 20, 5).met).toBe(false);
  });

  it('shows no progress before the season has a table', () => {
    const obj = seasonObjective(5, 20, null);
    expect(obj.progress).toBe(0);
    expect(obj.met).toBe(false);
  });

  it('gives partial credit for closing in on the target', () => {
    const far = seasonObjective(1, 20, 18).progress;
    const close = seasonObjective(1, 20, 3).progress;
    expect(close).toBeGreaterThan(far);
    expect(close).toBeLessThan(1);
  });
});

/**
 * A meta da temporada só é cumprida quando a temporada acaba.
 *
 * `met` era `isFinal ? onTrack : onTrack`, um ternário cujos dois ramos são iguais, então valia `onTrack`
 * puro. Na primeira rodada o clube está em 1º numa tabela de zeros, logo `onTrack` é verdadeiro, logo a tela
 * anunciava "0% ✓ Concluído": a única meta da temporada dada como cumprida antes de a bola rolar.
 */
describe('seasonObjective sabe quando a meta foi cumprida', () => {
  const RODADAS = 38;

  it('não dá a meta por cumprida na primeira rodada', () => {
    const inicio = seasonObjective(1, 20, 1, 0, RODADAS);

    expect(inicio.label).toBe('Ganhar o campeonato');
    expect(inicio.met, 'ninguém ganha o campeonato antes de jogar').toBe(false);
    expect(inicio.progress).toBe(0);

    // Liderar sem ter jogado é estar no caminho, que é o que a outra etiqueta diz.
    expect(inicio.onTrack).toBe(true);
  });

  it('continua sem dar por cumprida no meio da temporada', () => {
    expect(seasonObjective(1, 20, 1, 19, RODADAS).met).toBe(false);
  });

  it('dá por cumprida quando a temporada acaba no lugar pedido', () => {
    expect(seasonObjective(1, 20, 1, RODADAS, RODADAS).met).toBe(true);
  });

  it('não dá por cumprida quando a temporada acaba fora do lugar pedido', () => {
    const falhou = seasonObjective(1, 20, 7, RODADAS, RODADAS);
    expect(falhou.met).toBe(false);
    expect(falhou.onTrack).toBe(false);
  });

  it('avisa quando há vaga de patrocínio parada', () => {
    /**
     * O quadro de patrocínios é a única receita que o técnico negocia, e vivia dois níveis fundo: Finanças,
     * depois a aba. Uma vaga vazia é dinheiro que podia estar entrando toda semana, e ninguém ia lá ver.
     */
    const comVaga = clubAlerts(clubWith({ sponsorships: [{ id: 'a' }, { id: 'b' }] as never }), healthy);
    const aviso = comVaga.find((a) => a.message.includes('patrocínio'));

    expect(aviso).toBeTruthy();
    expect(aviso!.message).toContain('3 vagas');
    expect(aviso!.actionPath).toBe('sponsors');

    // Informativo, não urgente: escalação em falta e jogador lesionado continuam vindo antes.
    expect(aviso!.severity).toBe('info');
  });

  it('fala no singular quando falta uma só', () => {
    const uma = Array.from({ length: MAX_SPONSORSHIPS - 1 }, (_, i) => ({ id: `s${i}` })) as never;
    const aviso = clubAlerts(clubWith({ sponsorships: uma }), healthy).find((a) => a.message.includes('patrocínio'));
    expect(aviso!.message).toBe('Uma vaga de patrocínio em aberto');
  });
});
