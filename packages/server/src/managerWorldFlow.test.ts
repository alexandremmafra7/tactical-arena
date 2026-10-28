import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from './db/prisma.js';
import { ensureSchema } from './db/ensureSchema.js';
import {
  ensureManagersForAllClubs,
  ensureUnemployedPool,
  getManagerForClub,
  hireBestAvailable,
  releaseManager,
  startingReputation,
  REPUTATION_SACK_PENALTY,
} from './services/managerService.js';
import { BOT_OWNER_ID, generateStarterSquad } from '@tactical-arena/shared';

/**
 * O mundo tem treinadores.
 *
 * Sem eles nada do mercado é possível: não há de quem um clube se separar, nenhuma vaga pode abrir, e uma
 * sondagem seria ficção. Estes testes provam as três propriedades das quais tudo o resto depende — um clube
 * tem um comando e só um, quem sai volta ao mercado, e a vaga sempre encontra alguém.
 */
async function criarClube(nome: string, capacidade = 20_000): Promise<string> {
  const id = randomUUID();
  await prisma.club.create({
    data: {
      id,
      name: nome,
      ownerId: BOT_OWNER_ID,
      country: 'BRA',
      playersJson: JSON.stringify(generateStarterSquad(id, 'BRA')),
      academyPlayersJson: '[]',
      stadiumCapacity: capacidade,
    },
  });
  return id;
}

describe('treinadores do mundo', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  it('dá comando a todo clube que não tem, e só a esses', async () => {
    const clubeA = await criarClube(`Comando FC ${Date.now()}`);
    const clubeB = await criarClube(`Comando EC ${Date.now()}`);

    await ensureManagersForAllClubs();
    const primeiro = await getManagerForClub(clubeA);
    expect(primeiro).not.toBeNull();
    expect(primeiro!.name.trim().length).toBeGreaterThan(3);
    expect(await getManagerForClub(clubeB)).not.toBeNull();

    /**
     * Idempotência sem marca de "já rodou".
     *
     * A função é chamada em todo arranque e em toda importação. Se uma segunda passagem criasse um segundo
     * treinador, o mundo dobraria de comando a cada abertura do jogo — e o índice único no `clubId` só
     * transformaria isso num erro de gravação em vez de num mundo errado.
     */
    const criadosDeNovo = await ensureManagersForAllClubs();
    const depois = await getManagerForClub(clubeA);
    expect(depois!.id).toBe(primeiro!.id);
    expect(criadosDeNovo).toBe(0);
  });

  it('usa o nome real quando existe, e inventa só quando não existe', async () => {
    const slug = `slug-real-${randomUUID().slice(0, 8)}`;
    const id = randomUUID();
    await prisma.club.create({
      data: {
        id,
        name: 'Clube Com Nome Real',
        slug,
        ownerId: BOT_OWNER_ID,
        country: 'BRA',
        playersJson: JSON.stringify(generateStarterSquad(id, 'BRA')),
        academyPlayersJson: '[]',
      },
    });

    await ensureManagersForAllClubs(new Map([[slug, 'Abel Ferreira']]));
    const real = await getManagerForClub(id);

    expect(real!.name).toBe('Abel Ferreira');
    // Nome real não recebe nacionalidade inventada: Abel Ferreira dirige no Brasil e é português, e afirmar
    // "BRA" seria uma mentira que a tela mostraria com bandeira e tudo.
    expect(real!.nationality).toBeNull();
  });

  it('dá reputação maior a quem comanda clube maior', async () => {
    const grande = await criarClube(`Gigante FC ${Date.now()}`, 80_000);
    const pequeno = await criarClube(`Modesto FC ${Date.now()}`, 6_000);

    await ensureManagersForAllClubs();

    const doGrande = await getManagerForClub(grande);
    const doPequeno = await getManagerForClub(pequeno);
    expect(doGrande!.reputation).toBeGreaterThan(doPequeno!.reputation);
  });

  it('devolve ao mercado quem sai, cobrando a reputação', async () => {
    const clube = await criarClube(`Demissao FC ${Date.now()}`);
    await ensureManagersForAllClubs();

    const antes = await getManagerForClub(clube);
    const solto = await releaseManager(clube, REPUTATION_SACK_PENALTY);

    expect(solto!.id).toBe(antes!.id);
    expect(solto!.clubId).toBeNull();
    expect(solto!.reputation).toBe(antes!.reputation - REPUTATION_SACK_PENALTY);
    // O clube fica de facto vago, senão a vaga não existe para ninguém preencher.
    expect(await getManagerForClub(clube)).toBeNull();
  });

  it('preenche a vaga a partir do bolsão', async () => {
    const clube = await criarClube(`Vaga FC ${Date.now()}`);
    await ensureManagersForAllClubs();
    await ensureUnemployedPool();
    await releaseManager(clube, REPUTATION_SACK_PENALTY);

    const novo = await hireBestAvailable(clube, 50);

    expect(novo).not.toBeNull();
    expect(novo!.clubId).toBe(clube);
    expect((await getManagerForClub(clube))!.id).toBe(novo!.id);
  });

  it('não deixa um clube grande contratar acima do que ele alcança... nem ficar sem ninguém', async () => {
    /**
     * As duas metades da mesma regra. O teto impede que todo clube do mundo dispute o mesmo nome; a saída de
     * emergência impede que um clube fique sem comando, que é um estado que nada no jogo sabe representar.
     */
    const clube = await criarClube(`Teto FC ${Date.now()}`);
    await ensureManagersForAllClubs();
    await ensureUnemployedPool();
    await releaseManager(clube, 0);

    const modesto = await hireBestAvailable(clube, 10);
    expect(modesto).not.toBeNull();
    expect(modesto!.reputation).toBeLessThanOrEqual(startingReputation(10) + 10);
  });

  it('mantém o bolsão abastecido, sem inflar quando já está cheio', async () => {
    await ensureUnemployedPool(24);
    const cheio = await prisma.manager.count({ where: { clubId: null } });
    expect(cheio).toBeGreaterThanOrEqual(24);

    // Chamar de novo com o mesmo mínimo não pode criar mais ninguém, senão todo arranque engorda o mercado.
    expect(await ensureUnemployedPool(24)).toBe(0);
  });
});
