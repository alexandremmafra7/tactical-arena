import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  prepareOfflineWorld, loadLocalGameState, localClaimClub,
  localListStaffMarket, localHireStaff,
  localSponsorshipOffers, localSignSponsorship, resetInMemoryGameState,
} from './localEngine.js';
import { MAX_SPONSORSHIPS } from '@tactical-arena/shared';

const PUBLIC = path.resolve(__dirname, '../../public');

/**
 * As telas que abriam vazias no telefone.
 *
 * O `client.ts` tem 34 funções que vão direto ao servidor sem desvio offline. No desktop isso é invisível,
 * porque há um servidor do outro lado; no Android é uma tela que não faz nada. Estas duas são as que o
 * usuário encontrou primeiro, e cada uma quebrava de um jeito diferente: patrocínio não tinha caminho
 * nenhum, e a comissão técnica tinha um caminho que mentia.
 */
describe('as funções que só existiam no servidor', () => {
  beforeEach(async () => {
    localStorage.clear();
    /**
     * O mundo vive em memória além do `localStorage`, e `prepareOfflineWorld` só monta uma vez por sessão.
     * Sem isto um teste entrega ao seguinte o clube que ele acabou de mexer, e o seguinte prova outra coisa.
     */
    resetInMemoryGameState();
    globalThis.fetch = (async (url: string) => {
      const file = path.join(PUBLIC, String(url).replace(/^\//, ''));
      if (!fs.existsSync(file)) return { ok: false } as Response;
      return { ok: true, text: async () => fs.readFileSync(file, 'utf8') } as Response;
    }) as typeof fetch;
    await prepareOfflineWorld();
  });

  it('oferece um mercado de comissão técnica, e não uma pessoa só', async () => {
    const clube = loadLocalGameState().clubs[0];
    const mercado = await localListStaffMarket(clube.id);

    /**
     * Isto devolvia exatamente um profissional inventado à mão, "Dr. Carlos Silva", assistente tático,
     * sempre o mesmo. O mercado inteiro do Android era esse um.
     */
    expect(mercado.length).toBeGreaterThan(5);
    expect(new Set(mercado.map((m) => m.role)).size).toBeGreaterThan(1);
    expect(mercado.every((m) => m.wage > 0)).toBe(true);
    expect(mercado.some((m) => m.name === 'Dr. Carlos Silva')).toBe(false);
  });

  it('contrata quem o técnico escolheu, e não um genérico', async () => {
    const clube = await localClaimClub(loadLocalGameState().clubs[0].id);
    const mercado = await localListStaffMarket(clube.id);
    const alvo = mercado.find((m) => m.role !== 'TACTICAL_ASSISTANT' && m.minClubVisibility <= 50)!;
    expect(alvo, 'o mercado tem de ter alguém que não seja assistente tático').toBeTruthy();

    const depois = await localHireStaff(clube.id, alvo.id);
    const contratado = (depois.staff ?? []).find((m) => m.id === alvo.id);

    /**
     * O `staffId` era ignorado por inteiro. Escolhesse quem escolhesse, chegava um "Profissional
     * Contratado" assistente tático de nota 80, então nenhum dos bônus que o jogador foi buscar chegava a
     * valer: um preparador físico contratado não dava bônus de preparador físico nenhum.
     */
    expect(contratado, 'a pessoa contratada tem de ser a escolhida').toBeTruthy();
    expect(contratado!.name).toBe(alvo.name);
    expect(contratado!.role).toBe(alvo.role);
    expect(contratado!.rating).toBe(alvo.rating);
    expect((depois.staff ?? []).some((m) => m.name === 'Profissional Contratado')).toBe(false);
  });

  it('deixa uma pessoa por função', async () => {
    const clube = await localClaimClub(loadLocalGameState().clubs[0].id);
    const mercado = await localListStaffMarket(clube.id);
    const mesmaFuncao = mercado.filter((m) => m.role === mercado[0].role && m.minClubVisibility <= 50);
    if (mesmaFuncao.length < 2) return;

    await localHireStaff(clube.id, mesmaFuncao[0].id);
    const depois = await localHireStaff(clube.id, mesmaFuncao[1].id);

    // Contratar para um posto ocupado substitui quem estava lá, como no servidor.
    expect((depois.staff ?? []).filter((m) => m.role === mesmaFuncao[0].role)).toHaveLength(1);
    expect((depois.staff ?? []).find((m) => m.role === mesmaFuncao[0].role)!.id).toBe(mesmaFuncao[1].id);
  });

  it('recusa quem o clube ainda não tem porte para contratar', async () => {
    const clube = await localClaimClub(loadLocalGameState().clubs[0].id);
    const caro = (await localListStaffMarket(clube.id)).find((m) => m.minClubVisibility > 90);
    if (!caro) return;

    // Sem esta trava o mercado inteiro fica disponível no primeiro dia de carreira.
    await expect(localHireStaff(clube.id, caro.id)).rejects.toThrow();
  });

  it('mostra propostas de patrocínio, que offline nunca chegavam', async () => {
    const clube = await localClaimClub(loadLocalGameState().clubs[0].id);
    const ofertas = await localSponsorshipOffers(clube.id);

    // `getSponsorshipOffers` ia direto ao servidor: no Android a aba abria vazia e ficava vazia.
    expect(ofertas.length).toBeGreaterThan(0);
    expect(ofertas.every((o) => o.weeklyAmount > 0 && o.weeksRemaining > 0)).toBe(true);
    expect(ofertas.every((o) => o.sponsorName?.trim().length > 0)).toBe(true);
  });

  it('não remexe as propostas enquanto o jogador as lê', async () => {
    const clube = await localClaimClub(loadLocalGameState().clubs[0].id);

    /**
     * O servidor semeia isto em `Date.now()`, o que lá é inofensivo porque cada chamada é uma requisição.
     * Aqui a tela relê a cada render, e as propostas trocariam debaixo do dedo de quem está comparando.
     */
    const uma = await localSponsorshipOffers(clube.id);
    const outra = await localSponsorshipOffers(clube.id);
    expect(uma.map((o) => o.sponsorName)).toEqual(outra.map((o) => o.sponsorName));
  });

  it('assina uma proposta e credita a luva', async () => {
    const clube = await localClaimClub(loadLocalGameState().clubs[0].id);
    const caixaAntes = clube.budget;
    const ofertas = await localSponsorshipOffers(clube.id);
    const nova = ofertas.find((o) => !clube.sponsorships.some((s) => s.type === o.type))!;
    expect(nova, 'tem de haver uma proposta de um tipo que o clube ainda não tem').toBeTruthy();

    const depois = await localSignSponsorship(clube.id, nova);

    expect(depois.sponsorships.some((s) => s.sponsorName === nova.sponsorName)).toBe(true);
    expect(depois.budget).toBe(caixaAntes + (nova.signingBonus ?? 0));

    // E ficou gravado, senão o contrato some ao trocar de tela.
    expect(loadLocalGameState().clubs.find((c) => c.id === clube.id)!.sponsorships.some(
      (s) => s.sponsorName === nova.sponsorName,
    )).toBe(true);
  });

  it('troca o contrato em vigor quando a proposta é de substituição', async () => {
    const clube = await localClaimClub(loadLocalGameState().clubs[0].id);
    const atual = clube.sponsorships[0];
    const rival = (await localSponsorshipOffers(clube.id)).find((o) => o.type === atual.type && o.isReplacement);
    if (!rival) return;

    const depois = await localSignSponsorship(clube.id, rival);

    // Uma vaga por tipo: assinar a rival rompe a que estava correndo, não empilha as duas.
    expect(depois.sponsorships.filter((s) => s.type === atual.type)).toHaveLength(1);
    expect(depois.sponsorships.find((s) => s.type === atual.type)!.sponsorName).toBe(rival.sponsorName);
  });

  it('recusa um segundo patrocínio do mesmo tipo', async () => {
    const clube = await localClaimClub(loadLocalGameState().clubs[0].id);

    /**
     * Com a prancha cheia é a trava do máximo que dispara primeiro, então o clube abre uma vaga antes: o que
     * se quer provar aqui é a regra de um contrato por tipo, e não a do total.
     */
    const atual = clube.sponsorships[0];
    clube.sponsorships = clube.sponsorships.slice(0, 2);
    const repetido = { ...atual, id: 'outro', sponsorName: 'Outra Marca', isReplacement: false };

    await expect(localSignSponsorship(clube.id, repetido)).rejects.toThrow(/já tem um patrocínio/);
  });

  it('recusa quando a prancha de patrocínios está cheia', async () => {
    const clube = await localClaimClub(loadLocalGameState().clubs[0].id);

    // Um clube nasce com quatro contratos e o teto é cinco, então a prancha é enchida primeiro.
    const modelo = clube.sponsorships[0];
    const tipos = ['MASTER', 'KIT_SUPPLIER', 'REGIONAL', 'TECH_EQUIPMENT', 'STADIUM_NAMING', 'AIRLINE'];
    clube.sponsorships = tipos.slice(0, MAX_SPONSORSHIPS).map((type, i) => ({ ...modelo, id: `cheio-${i}`, type })) as never;

    const sexto = { ...modelo, id: 'sexto', type: 'BANK', sponsorName: 'Marca Nova', isReplacement: false };
    await expect(localSignSponsorship(clube.id, sexto as never)).rejects.toThrow(/máximo/);
  });

  it('lista e renova contratos do elenco no modo offline', async () => {
    const clube = await localClaimClub(loadLocalGameState().clubs[0].id);
    const { localGetContracts, localRenewPlayerContract } = await import('./localEngine.js');
    const visao = await localGetContracts(clube.id);

    expect(visao.seasonYear).toBe(2026);
    expect(visao.players.length).toBe(clube.players.length);
    expect(visao.players[0].costByYears['2']).toBeGreaterThan(0);

    const jogador = clube.players[0];
    const caixaAntes = clube.budget;
    const { club: atualizado, cost } = await localRenewPlayerContract(clube.id, jogador.id, 2);

    expect(atualizado.budget).toBe(caixaAntes - cost);
    expect(atualizado.players.find((p) => p.id === jogador.id)!.contractUntil).toBeGreaterThan(2026);
  });

  it('lista e assina jogadores sem clube (passes livres) no modo offline', async () => {
    const clube = await localClaimClub(loadLocalGameState().clubs[0].id);
    const { localListFreeAgents, localSignFreeAgent } = await import('./localEngine.js');
    const livres = await localListFreeAgents(clube.id);

    expect(livres.length).toBeGreaterThan(0);
    const primeiro = livres[0];
    const tamanhoAntes = clube.players.length;
    const caixaAntes = clube.budget;

    const { club: atualizado, cost, player } = await localSignFreeAgent(clube.id, primeiro.id, 3);
    expect(atualizado.players.length).toBe(tamanhoAntes + 1);
    expect(atualizado.budget).toBe(caixaAntes - cost);
    expect(player.name).toBe(primeiro.player.name);

    // O jogador assinado foi removido da lista de livres
    const livresDepois = await localListFreeAgents(clube.id);
    expect(livresDepois.some((f) => f.id === primeiro.id)).toBe(false);
  });
});
