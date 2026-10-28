import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { prepareOfflineWorld, loadLocalGameState, localClaimClub, localAdvanceMatchday, localAdvanceLiveMatch, localFoundClub, localListFoundableCountries, localListAvailableClubs, localPlayableCountries, localCreateNewSave } from './localEngine.js';

/**
 * The offline world, booted exactly the way the phone boots it.
 *
 * The pieces are covered elsewhere; this is the one that answers the two questions that actually decide
 * whether this ships: does the app read its own bundled database through `fetch`, and does what comes out
 * fit in `localStorage`, which is where the save lives and which stops somewhere around 5 MB.
 */
const PUBLIC = path.resolve(__dirname, '../../public');

describe('the offline world boots from the shipped files', () => {
  beforeAll(async () => {
    localStorage.clear();

    // Served out of the app bundle on Android, from the dev server in the browser. Both are a same origin GET.
    globalThis.fetch = (async (url: string) => {
      const file = path.join(PUBLIC, String(url).replace(/^\//, ''));
      if (!fs.existsSync(file)) return { ok: false } as Response;
      return { ok: true, text: async () => fs.readFileSync(file, 'utf8') } as Response;
    }) as typeof fetch;

    await prepareOfflineWorld();
  });

  it('takes charge of a club that exists', async () => {
    const state = loadLocalGameState();
    const nomes = state.clubs.map((c) => c.name);

    expect(nomes).toContain('Flamengo');
    expect(state.clubs.length).toBeGreaterThan(60);

    /**
     * The bug the user reported as "os elencos estao aleatorios": every squad came out of `generateSquad`,
     * so Flamengo fielded eleven invented men. These are the real ones, off `players.csv`.
     */
    const fla = state.clubs.find((c) => c.name === 'Flamengo')!;
    expect(fla.players.length).toBeGreaterThanOrEqual(11);
    expect(fla.sponsorships.length).toBeGreaterThan(0);
    expect(fla.stadiumCapacity).toBeGreaterThan(2_000);
  });

  it('gives Brazil four divisions to be promoted and relegated between', () => {
    const state = loadLocalGameState();
    const brasileiras = state.leagues.filter((l) => l.countryCode === 'BRA');

    expect(brasileiras).toHaveLength(4);
    expect(brasileiras.map((l) => l.division).sort()).toEqual([1, 2, 3, 4]);

    // 20 clubes numa liga sÃ£o 38 rodadas de returno duplo, que Ã© o BrasileirÃ£o de verdade.
    for (const liga of brasileiras) {
      expect(liga.clubIds).toHaveLength(20);
      expect(new Set(liga.fixtures.map((f) => f.round)).size).toBe(38);
    }
  });

  it('fits in the storage the save has to live in', () => {
    const bytes = JSON.stringify(loadLocalGameState()).length;
    const mb = bytes / 1_048_576;

    /**
     * The real constraint, and the reason the whole 1.505 club database is not shipped: `localStorage` throws
     * `QuotaExceededError` around 5 MB, and a save that cannot be written is a career that vanishes on the
     * next launch. Measured at the time of writing: 2,52 MB for 76 clubs and 1.877 players.
     */
    expect(mb, `o save ocupa ${mb.toFixed(2)} MB`).toBeLessThan(4);

    // And it round trips, which is the assertion the number above is only a proxy for.
    expect(() => localStorage.setItem('offline_size_probe', JSON.stringify(loadLocalGameState()))).not.toThrow();
    localStorage.removeItem('offline_size_probe');
  });

  it('plays a whole round of a real league', async () => {
    const fla = loadLocalGameState().clubs.find((c) => c.name === 'Flamengo')!;
    await localClaimClub(fla.id);
    await localAdvanceMatchday();

    const state = loadLocalGameState();
    const liga = state.leagues.find((l) => l.clubIds.includes(fla.id))!;
    const rodada = liga.fixtures.filter((f) => f.round === 1);

    // Nineteen of the twenty games played, and the manager's own left standing for them to watch.
    expect(rodada.filter((f) => f.result)).toHaveLength(9);
    expect(rodada.find((f) => f.homeClubId === fla.id || f.awayClubId === fla.id)?.result).toBeFalsy();
  });

  it('runs a whole championship, week by week, from the second division', async () => {
    /**
     * The test that would have caught what the user kept reporting as "sÃ³ a rodada do player Ã© simulada".
     * It plays from SÃ©rie B, because two bugs only bit there or only bit the manager's own match:
     *
     *  - every league lookup was `countryCode === club.country`, which was right until Brazil had a second
     *    division and then quietly answered "SÃ©rie A" for a SÃ©rie B club, so the result was written into a
     *    fixture list the club does not appear in;
     *  - `localAdvanceLiveMatch` built one team sheet from the home squad and gave it to both sides, so the
     *    engine threw on every match the manager actually played.
     *
     * Either one leaves the manager's fixture without a result. An unfinished round is never behind the
     * clock, so the date stopped on the first matchday and stayed there for the rest of the career.
     */
    localStorage.clear();
    await prepareOfflineWorld();

    const segunda = loadLocalGameState().leagues.find((l) => l.id === 'league_BRA_2')!;
    await localClaimClub(segunda.clubIds[0]);

    const datas: string[] = [];
    for (let semana = 0; semana < 6; semana += 1) {
      const avanco = await localAdvanceMatchday();
      /**
       * A partida do tÃ©cnico, jogada como a tela a joga: pedidos sucessivos de minuto, com o intervalo no
       * meio. Uma chamada sÃ³ ao minuto 90 parava no intervalo, porque a partida offline passou a ser ao
       * vivo de verdade em vez de resolver os noventa minutos de uma vez.
       */
      if (avanco.matchId) {
        for (const minuto of [45, 46, 90, 120]) await localAdvanceLiveMatch(avanco.matchId, minuto);
      }
      datas.push(avanco.date);
    }

    // Six different dates. Before this it was the same one six times.
    expect(new Set(datas).size).toBe(6);

    const estado = loadLocalGameState();
    const minha = estado.leagues.find((l) => l.id === segunda.id)!;
    expect(minha.fixtures.filter((f) => f.result)).toHaveLength(60);

    // Including the manager's own six, which is the half that was silently missing.
    const meus = minha.fixtures.filter(
      (f) => (f.homeClubId === segunda.clubIds[0] || f.awayClubId === segunda.clubIds[0]) && f.result,
    );
    expect(meus).toHaveLength(6);

    // And the rest of the world kept its own calendar: three other leagues, all six rounds in.
    for (const outra of estado.leagues.filter((l) => l.id !== segunda.id)) {
      expect(new Set(outra.fixtures.filter((f) => f.result).map((f) => f.round)).size, outra.id).toBe(6);
    }
  });

  it('lets the manager found a club offline, in the access division', async () => {
    /**
     * O criador de times existia sÃ³ no servidor: `foundClub` no cliente ia direto Ã  rede, sem desvio, entÃ£o
     * no Android o botÃ£o abria o formulÃ¡rio e o envio morria. A lista de paÃ­ses vinha do mesmo lugar e o
     * `catch` devolvia vazio, entÃ£o nem paÃ­s havia para escolher.
     */
    localStorage.clear();
    await prepareOfflineWorld();

    const paises = await localListFoundableCountries();
    expect(paises.map((p) => p.code)).toContain('BRA');

    // SÃ³ quem tem segunda divisÃ£o entra: fundar sem ela seria empurrar alguÃ©m para fora da primeira.
    expect(paises.every((p) => p.accessDivision > 1)).toBe(true);

    const braAccess = paises.find((p) => p.code === 'BRA')!.accessDivision;
    const antes = loadLocalGameState();
    const acesso = antes.leagues.find((l) => l.id === `league_BRA_${braAccess}`)!;
    const maisFraco = acesso.clubIds
      .map((id) => antes.clubs.find((c) => c.id === id)!)
      .reduce((fraco, c) => (c.players.reduce((s, p) => s + p.overall, 0) / c.players.length <
        fraco.players.reduce((s, p) => s + p.overall, 0) / fraco.players.length ? c : fraco));

    const meu = await localFoundClub({ name: 'EsperanÃ§a FC', country: 'BRA', citySize: 'MEDIUM' });

    expect(meu.name).toBe('EsperanÃ§a FC');
    expect(meu.players.length).toBeGreaterThanOrEqual(11);
    expect(meu.stadiumCapacity).toBe(8_000);
    expect(meu.sponsorships.length).toBeGreaterThan(0);

    const depois = loadLocalGameState();
    const liga = depois.leagues.find((l) => l.id === `league_BRA_${braAccess}`)!;

    // Uma troca sÃ³: entra na vaga do mais fraco, e a divisÃ£o continua com vinte.
    expect(liga.clubIds).toContain(meu.id);
    expect(liga.clubIds).not.toContain(maisFraco.id);
    expect(liga.clubIds).toHaveLength(20);
    expect(depois.clubs.find((c) => c.id === maisFraco.id), 'quem sai nÃ£o fica solto no mundo').toBeUndefined();

    // E em cada jogo jÃ¡ sorteado, senÃ£o a divisÃ£o joga contra um clube que nÃ£o existe mais.
    expect(liga.fixtures.some((f) => f.homeClubId === maisFraco.id || f.awayClubId === maisFraco.id)).toBe(false);
    expect(liga.fixtures.filter((f) => f.homeClubId === meu.id || f.awayClubId === meu.id)).toHaveLength(38);
  });

  it('starts a founded club below the division it joins', async () => {
    localStorage.clear();
    await prepareOfflineWorld();

    const braAccess = (await localListFoundableCountries()).find((p) => p.code === 'BRA')!.accessDivision;
    const acesso = loadLocalGameState().leagues.find((l) => l.id === `league_BRA_${braAccess}`)!;
    const media = (c: { players: { overall: number }[] }) => c.players.reduce((s, p) => s + p.overall, 0) / c.players.length;
    const mediaDaDivisao = acesso.clubIds
      .map((id) => loadLocalGameState().clubs.find((c) => c.id === id)!)
      .reduce((soma, c) => soma + media(c), 0) / acesso.clubIds.length;

    const meu = await localFoundClub({ name: 'Zero FC', country: 'BRA', citySize: 'SMALL' });

    // Fundar nÃ£o pode ser o caminho fÃ¡cil: o elenco nasce abaixo da mÃ©dia de quem jÃ¡ estÃ¡ lÃ¡.
    expect(media(meu)).toBeLessThan(mediaDaDivisao);

    // E a cidade pequena troca receita por caixa, que Ã© a escolha inteira dessa tela.
    expect(meu.stadiumCapacity).toBe(2_000);
    expect(meu.budget).toBeGreaterThan((await localFoundClub({ name: 'X', country: 'BRA', citySize: 'LARGE' })).budget);
  });

  it('offers only the countries it can actually build', async () => {
    localStorage.clear();
    await prepareOfflineWorld();

    const paises = await localPlayableCountries();

    /**
     * A tela oferecia os 98 paÃ­ses da lista estÃ¡tica do `shared` e o mundo tinha trÃªs, entÃ£o escolher Chile
     * dava "nenhum clube disponÃ­vel" sem dizer por quÃª. Medido no arquivo: dos 144 paÃ­ses, 29 tÃªm 16 clubes
     * ou mais com elenco real. Os outros vÃ£o de 1 a 12 clubes, o que nÃ£o dÃ¡ campeonato: BÃ©lgica 6, PolÃ´nia 2.
     */
    expect(paises.length).toBeGreaterThanOrEqual(45);
    expect(paises).toEqual(expect.arrayContaining(['BRA', 'ARG', 'URU', 'CHI', 'ESP', 'ENG', 'POL', 'BEL', 'NZL']));

    /**
     * O critÃ©rio Ã© ter clubes que dÃªem campeonato, e nÃ£o estar numa lista escrita Ã  mÃ£o. Nenhum paÃ­s entra
     * sem os 16, e Ã© isso que a asserÃ§Ã£o guarda: um paÃ­s com quatro clubes na lista abriria uma liga que o
     * gerador de tabela nÃ£o consegue sortear.
     */
    expect(paises).not.toContain('LUX');
    expect(paises).not.toContain('AND');
  });

  it('builds a country the moment it is asked for', async () => {
    localStorage.clear();
    await prepareOfflineWorld();

    // O Chile nÃ£o estÃ¡ no mundo de partida: ou Ã© montado agora, do arquivo, ou a tela mente.
    expect(loadLocalGameState().clubs.some((c) => c.country === 'CHI')).toBe(false);

    const chilenos = await localListAvailableClubs('CHI');

    /**
     * O tamanho vem da divisÃ£o escrita no `clubs.csv`, e nÃ£o de um corte em vinte: a primeira divisÃ£o
     * chilena do arquivo tem dezesseis clubes. O que precisa valer sempre Ã© ser par, senÃ£o o returno duplo
     * nÃ£o sorteia, e conter os clubes que de facto jogam a primeira divisÃ£o.
     */
    expect(chilenos.length).toBeGreaterThanOrEqual(16);
    expect(chilenos.length % 2, 'divisão ímpar não gera tabela').toBe(0);
    expect(chilenos.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Colo Colo', 'Universidad de Chile', 'Universidad Católica']),
    );
    expect(chilenos.every((c) => c.players.length >= 11)).toBe(true);
    expect(chilenos.every((c) => c.sponsorships.length > 0)).toBe(true);

    // Com campeonato de verdade por trÃ¡s, senÃ£o o clube existe e nÃ£o tem o que jogar.
    const liga = loadLocalGameState().leagues.find((l) => l.countryCode === 'CHI')!;
    // Returno duplo: 2(n-1) rodadas, seja qual for o tamanho da divisÃ£o.
    expect(new Set(liga.fixtures.map((f) => f.round)).size).toBe(2 * (chilenos.length - 1));
  });

  it('keeps the save inside its quota however many countries are browsed', async () => {
    localStorage.clear();
    await prepareOfflineWorld();

    /**
     * O motivo de haver rodÃ­zio. Cada paÃ­s custa perto de 0,6 MB e a cota do `localStorage` para em torno de
     * 5 MB, entÃ£o um jogador que espia dez paÃ­ses antes de escolher encheria a cota sÃ³ de olhar. Fica um de
     * cada vez: ao trazer o seguinte, o anterior que ninguÃ©m assumiu vai embora.
     */
    for (const pais of ['CHI', 'ESP', 'ENG', 'ITA', 'MEX', 'POR', 'USA', 'JPN']) {
      await localListAvailableClubs(pais);
    }

    const estado = loadLocalGameState();
    const paisesNoMundo = new Set(estado.leagues.map((l) => l.countryCode));

    // Os trÃªs de origem mais o Ãºltimo espiado.
    expect(paisesNoMundo).toEqual(new Set(['BRA', 'ARG', 'URU', 'JPN']));

    const mb = JSON.stringify(estado).length / 1_048_576;
    expect(mb, `o save ocupa ${mb.toFixed(2)} MB`).toBeLessThan(4.8);
    expect(() => localStorage.setItem('quota_probe', JSON.stringify(estado))).not.toThrow();
    localStorage.removeItem('quota_probe');
  });

  it('never evicts the country the manager has a club in', async () => {
    localStorage.clear();
    await prepareOfflineWorld();

    const chilenos = await localListAvailableClubs('CHI');
    await localClaimClub(chilenos[0].id);

    // Espiar outro paÃ­s depois de assumir nÃ£o pode levar embora o campeonato onde a carreira acontece.
    await localListAvailableClubs('ESP');

    const estado = loadLocalGameState();
    expect(estado.leagues.some((l) => l.countryCode === 'CHI'), 'o paÃ­s do tÃ©cnico fica').toBe(true);
    expect(estado.clubs.find((c) => c.id === chilenos[0].id)?.ownerId).toBeTruthy();
  });

  it('allows founding a club even if local game state was initialized before offline content loaded', async () => {
    localStorage.clear();
    // Simulates early synchronous loadLocalGameState call on app boot
    const initialState = loadLocalGameState();
    expect(initialState.leagues.some((l) => l.countryCode === 'BRA' && l.division === 2)).toBe(true);

    const paises = await localListFoundableCountries();
    expect(paises.map((p) => p.code)).toContain('BRA');

    const club = await localFoundClub({ name: 'Mafra FC', country: 'BRA', citySize: 'SMALL' });
    expect(club.name).toBe('Mafra FC');
    expect(club.country).toBe('BRA');
    expect(club.ownerId).toBe(initialState.userId);
  });

  it('claims a club from any country after creating a new save slot without "Clube nÃ£o encontrado"', async () => {
    localStorage.clear();
    await prepareOfflineWorld();

    const chilenos = await localListAvailableClubs('CHI');
    const selected = chilenos[0];

    // Simulates OnboardingWizard handleClaimClub
    await localCreateNewSave({
      managerFirstName: 'Treinador',
      managerLastName: 'Teste',
      managerNationality: 'CHI',
      managerStyle: 'Estrategista',
      gameMode: 'STANDARD',
    });

    const claimed = await localClaimClub(selected.id);
    expect(claimed.id).toBe(selected.id);
    expect(claimed.name).toBe(selected.name);

    const state = loadLocalGameState();
    expect(state.clubs.find((c) => c.id === selected.id)?.ownerId).toBeTruthy();
  });
});
