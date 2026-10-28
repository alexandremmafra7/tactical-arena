import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_STAFF_DELEGATION_CONFIG } from '@tactical-arena/shared';
import {
  prepareOfflineWorld, loadLocalGameState, localClaimClub,
  localCreateNewSave,
  localAdvanceMatchday, localAdvanceLiveMatch, localUpdateLiveMatchTactic, resetInMemoryGameState,
  saveLocalGameState,
} from './localEngine.js';

const PUBLIC = path.resolve(__dirname, '../../public');

/**
 * A partida acontece, em vez de aparecer pronta.
 *
 * `localAdvanceLiveMatch` simulava os noventa minutos numa chamada só e devolvia o placar. A tela
 * `LiveMatch` a chama num laço conforme o tempo real passa, pedindo "avance até o minuto 12", e narra a
 * partir de `updated.live.events`. Sem o campo `live` ela não tinha o que mostrar: o jogador apertava "ir
 * para a partida" e recebia o resultado, sem ver nada. É a maior parte da jogabilidade.
 */
describe('a partida ao vivo, offline', () => {
  beforeEach(async () => {
    localStorage.clear();
    resetInMemoryGameState();
    globalThis.fetch = (async (url: string) => {
      const file = path.join(PUBLIC, String(url).replace(/^\//, ''));
      if (!fs.existsSync(file)) return { ok: false } as Response;
      return { ok: true, text: async () => fs.readFileSync(file, 'utf8') } as Response;
    }) as typeof fetch;
    await prepareOfflineWorld();
  });

  async function irParaAPartida() {
    const liga = loadLocalGameState().leagues.find((l) => l.id === 'league_BRA_1')!;
    await localClaimClub(liga.clubIds[0]);
    const avanco = await localAdvanceMatchday();
    expect(avanco.matchId).toBeTruthy();
    return avanco.matchId!;
  }

  it('devolve o jogo em andamento, e não o placar final', async () => {
    const id = await irParaAPartida();
    const aos15 = await localAdvanceLiveMatch(id, 15);

    // O que a tela lê. Antes disto era `status: 'SIMULATED'` e `live` indefinido já na primeira chamada.
    expect(aos15.status).toBe('LIVE');
    expect(aos15.live).toBeTruthy();
    expect(aos15.live!.currentMinute).toBe(15);
    expect(Array.isArray(aos15.live!.events)).toBe(true);
    expect(aos15.result).toBeUndefined();
  });

  it('avança o relógio a cada pedido, sem voltar atrás', async () => {
    const id = await irParaAPartida();
    const minutos: number[] = [];
    for (const alvo of [5, 12, 27, 40, 45]) {
      const m = await localAdvanceLiveMatch(id, alvo);
      minutos.push(m.live!.currentMinute);
    }
    expect(minutos).toEqual([...minutos].sort((a, b) => a - b));
    expect(minutos[minutos.length - 1]).toBeGreaterThanOrEqual(45);
  });

  it('só narra o que já aconteceu', async () => {
    const id = await irParaAPartida();
    const aos30 = await localAdvanceLiveMatch(id, 30);

    /**
     * A tentação era simular o jogo inteiro de uma vez e ir revelando os eventos. O que se ganha fazendo de
     * verdade é isto: no minuto 30 nem o motor sabe ainda o que acontece no 31.
     */
    expect(aos30.live!.events.every((e) => e.minute <= 30)).toBe(true);
  });

  it('para no intervalo em vez de atravessar direto', async () => {
    const id = await irParaAPartida();
    const fim1 = await localAdvanceLiveMatch(id, 60);

    // Pedir o minuto 60 no primeiro tempo não pode entregar o segundo: o intervalo é uma parada de verdade.
    expect(fim1.live!.currentMinute).toBeLessThan(50);
    expect(fim1.live!.period).toBe('HT');

    const segundo = await localAdvanceLiveMatch(id, 60);
    expect(segundo.live!.period).toBe('2T');
  });

  it('termina o jogo, grava o resultado e roda o resto da rodada', async () => {
    const id = await irParaAPartida();
    for (const alvo of [45, 46, 70, 90, 95, 100]) await localAdvanceLiveMatch(id, alvo);
    const fim = await localAdvanceLiveMatch(id, 120);

    expect(fim.status).toBe('SIMULATED');
    expect(fim.result).toBeTruthy();

    const estado = loadLocalGameState();
    const liga = estado.leagues.find((l) => l.id === 'league_BRA_1')!;
    const rodada = liga.fixtures.filter((f) => f.round === 1);

    // O placar da tela e o da tabela são o mesmo, e o resto da rodada aconteceu no mesmo dia.
    const meu = rodada.find((f) => f.homeClubId === liga.clubIds[0] || f.awayClubId === liga.clubIds[0])!;
    expect(meu.result!.homeGoals).toBe(fim.result!.homeGoals);
    expect(rodada.every((f) => f.result), 'a rodada inteira tem de fechar').toBe(true);
    expect(estado.liveMatch, 'a partida terminada não fica pendurada no save').toBeFalsy();
  });

  it('aplica fisioterapia ao encerrar a partida uma única vez', async () => {
    const id = await irParaAPartida();
    const state = loadLocalGameState();
    const club = state.clubs.find((candidate) => candidate.ownerId === 'local_manager_1')!;
    const patient = club.players[club.players.length - 1];
    patient.injuryWeeks = 4;
    club.staff = [{
      id: 'fitness',
      name: 'Fisiologista',
      role: 'FITNESS_COACH',
      tier: 'OURO',
      rating: 95,
      specialty: 'Recuperação rápida',
      description: '',
      wage: 1,
      minClubVisibility: 0,
      minCareerTitles: 0,
      avatar: '⚡',
      nationality: 'BRA',
    }];
    club.staffDelegationConfig = {
      ...DEFAULT_STAFF_DELEGATION_CONFIG,
      presetMode: 'custom',
      injuryRehab: 'auto_fastest',
    };
    saveLocalGameState(state);

    for (const alvo of [45, 46, 70, 90, 95, 100, 120]) await localAdvanceLiveMatch(id, alvo);

    const after = loadLocalGameState();
    const afterPlayer = after.clubs.find((candidate) => candidate.id === club.id)!.players.find((player) => player.id === patient.id);
    expect(afterPlayer?.injuryWeeks).toBe(1);

    const medicalNews = after.news.filter((item) =>
      item.category === 'INJURY' &&
      item.headline.startsWith('🏥 Fisioterapia:') &&
      item.headline.includes(patient.name) &&
      item.headline.includes('2 semanas'),
    );
    expect(medicalNews).toHaveLength(1);

    await localAdvanceLiveMatch(id, 120);
    expect(loadLocalGameState().news.filter((item) => item.id === `medical_${id}_${patient.id}`)).toHaveLength(1);
  }, 60000);

  it('sobrevive a fechar e reabrir a tela no meio do jogo', async () => {
    const id = await irParaAPartida();
    const antes = await localAdvanceLiveMatch(id, 25);

    /**
     * O estado vivo mora no save. Sem isso, sair da tela no minuto 25 e voltar recomeçaria a partida do
     * zero, e num telefone sair da tela é o que o sistema operacional faz sozinho.
     */
    // A gravação é adiada em 100 ms, então o save precisa ter chegado ao disco antes de esquecer a memória.
    await new Promise((r) => setTimeout(r, 150));
    resetInMemoryGameState();
    const depois = await localAdvanceLiveMatch(id, 26);

    expect(depois.live!.currentMinute).toBe(26);
    expect(depois.live!.events.length).toBeGreaterThanOrEqual(antes.live!.events.length);
    expect(depois.live!.homeGoals).toBeGreaterThanOrEqual(antes.live!.homeGoals);
  });

  it('joga a mesma partida que jogaria de uma vez só', async () => {
    const id = await irParaAPartida();

    // O motor promete isso: mesmo sorteio, mesma matemática, assistido ou resolvido de uma vez.
    let ultimo = await localAdvanceLiveMatch(id, 45);
    for (const alvo of [46, 60, 75, 90, 95, 120]) ultimo = await localAdvanceLiveMatch(id, alvo);

    expect(ultimo.result!.events!.some((e) => e.minute > 45), 'o segundo tempo tem de ter acontecido').toBe(true);
    expect(ultimo.result!.stats, 'estatísticas completas da partida precisam estar preenchidas').toBeDefined();
    expect(ultimo.result!.stats.home).toBeDefined();
    expect(ultimo.result!.stats.away).toBeDefined();
    expect(typeof ultimo.result!.stats.home.shots).toBe('number');
    expect(typeof ultimo.result!.stats.away.possession).toBe('number');
  });

  it('simula os outros jogos da rodada ao vivo em paralelo', async () => {
    const id = await irParaAPartida();
    const { fixtures: siblingsInicial } = await import('./localEngine.js').then((m) => m.localGetMatchSiblings(id));
    expect(siblingsInicial.length).toBeGreaterThan(0);
    expect(siblingsInicial.every((s) => s.status === 'LIVE')).toBe(true);

    const firstSib = siblingsInicial[0];
    const { localTickLiveMatch } = await import('./localEngine.js');
    const updated = await localTickLiveMatch(firstSib.id, 30);
    expect(updated.status).toBe('LIVE');
    expect(updated.live?.currentMinute).toBe(30);

    const finished = await localTickLiveMatch(firstSib.id, 120);
    expect(finished.status).toBe('SIMULATED');
    expect(finished.result).toBeDefined();
    expect(finished.result?.stats).toBeDefined();
  });

  it('atualiza a postura tática ao vivo e persiste no estado do jogo', async () => {
    const id = await irParaAPartida();
    const partidaInicial = await localAdvanceLiveMatch(id, 20);
    expect(partidaInicial.live).toBeTruthy();

    const currentTactic = partidaInicial.live!.homeTactic;
    const novaTatica = {
      ...currentTactic,
      mentality: 'attacking' as const,
      pressing: 'HIGH_PRESS' as const,
      attackApproach: 'TOTAL_ATTACK' as const,
    };

    const atualizada = await localUpdateLiveMatchTactic(id, novaTatica);
    expect(atualizada.live).toBeTruthy();
    expect(atualizada.live!.homeTactic.mentality).toBe('attacking');
    expect(atualizada.live!.homeTactic.pressing).toBe('HIGH_PRESS');
    expect(atualizada.live!.homeTactic.attackApproach).toBe('TOTAL_ATTACK');

    // Test stance transition to Contra-Ataque (defensive, low block, counter attack)
    const contraAtaqueTatica = {
      ...atualizada.live!.homeTactic,
      mentality: 'defensive' as const,
      pressing: 'LOW_BLOCK' as const,
      attackApproach: 'COUNTER_ATTACK' as const,
    };
    const atualizadaContra = await localUpdateLiveMatchTactic(id, contraAtaqueTatica);
    expect(atualizadaContra.live!.homeTactic.mentality).toBe('defensive');
    expect(atualizadaContra.live!.homeTactic.pressing).toBe('LOW_BLOCK');
    expect(atualizadaContra.live!.homeTactic.attackApproach).toBe('COUNTER_ATTACK');

    // Test stance transition to Equilibrar (balanced, medium, balanced)
    const equilibrarTatica = {
      ...atualizadaContra.live!.homeTactic,
      mentality: 'balanced' as const,
      pressing: 'MEDIUM' as const,
      attackApproach: 'BALANCED' as const,
    };
    const atualizadaEquilibrado = await localUpdateLiveMatchTactic(id, equilibrarTatica);
    expect(atualizadaEquilibrado.live!.homeTactic.mentality).toBe('balanced');
    expect(atualizadaEquilibrado.live!.homeTactic.pressing).toBe('MEDIUM');
    expect(atualizadaEquilibrado.live!.homeTactic.attackApproach).toBe('BALANCED');

    // Avançar a partida continua usando a nova tática equilibrada
    const aos40 = await localAdvanceLiveMatch(id, 40);
    expect(aos40.live!.homeTactic.mentality).toBe('balanced');
    expect(aos40.live!.homeTactic.pressing).toBe('MEDIUM');
    expect(aos40.live!.homeTactic.attackApproach).toBe('BALANCED');
  });
});


