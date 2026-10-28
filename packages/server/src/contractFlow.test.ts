import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { getGameState } from './services/gameStateService.js';

const app = createApp();

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, userId: res.body.userId as string };
}

async function createClubFor(token: string, name: string) {
  const res = await request(app).post('/clubs').set('Authorization', `Bearer ${token}`).send({ name, country: 'BRA' });
  expect(res.status).toBe(201);
  return res.body;
}

/**
 * O ciclo do contrato, de ponta a ponta.
 *
 * O jogo não tinha contrato: o jogador tinha salário e multa e nenhum prazo, e sem prazo ninguém sai. Isso
 * deixava o mundo parado e o diretor de futebol sem trabalho de verdade — renovar contrato num jogo sem
 * contrato é nada.
 *
 * Estes testes cobrem as duas metades que fecham o ciclo: renovar antes de vencer, e assinar quem ficou livre.
 */
describe('Contratos', () => {
  it('mostra o prazo de cada jogador e quanto custa cada duração', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, `Contrato FC ${Date.now()}`);

    const res = await request(app).get(`/clubs/${club.id}/contracts`).set('Authorization', `Bearer ${manager.token}`);
    expect(res.status).toBe(200);
    expect(res.body.players.length).toBe(club.players.length);

    const linha = res.body.players[0];
    expect(typeof linha.seasonsRemaining).toBe('number');

    /**
     * O preço vem do servidor, por duração. A tela precisa mostrá-lo antes de o técnico decidir, e a conta
     * mora no shared: escrevê-la também no cliente é como este projeto já quebrou com nome de liga e divisão.
     */
    expect(Object.keys(linha.costByYears)).toEqual(['1', '2', '3', '4', '5']);
    expect(linha.costByYears['4']).toBeGreaterThan(linha.costByYears['2']);
  });

  it('renova, cobra do caixa e estende o prazo', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, `Renova FC ${Date.now()}`);
    const alvo = club.players[0];

    const antes = await request(app).get(`/clubs/${club.id}/contracts`).set('Authorization', `Bearer ${manager.token}`);
    const prazoAntes = antes.body.players.find((p: any) => p.playerId === alvo.id).seasonsRemaining;

    const res = await request(app)
      .post(`/clubs/${club.id}/players/${alvo.id}/renew`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ years: 3 });

    expect(res.status).toBe(200);
    expect(res.body.cost).toBeGreaterThan(0);
    expect(res.body.club.budget).toBe(club.budget - res.body.cost);

    const depois = await request(app).get(`/clubs/${club.id}/contracts`).set('Authorization', `Bearer ${manager.token}`);
    const prazoDepois = depois.body.players.find((p: any) => p.playerId === alvo.id).seasonsRemaining;

    // Renovar cedo soma: quem tinha prazo pela frente e comprou três anos fica com mais, não com três.
    expect(prazoDepois).toBe(prazoAntes + 3);
  });

  it('recusa renovação de quem não é do clube, e de quem não é o dono', async () => {
    const dono = await registerAndLogin();
    const intruso = await registerAndLogin();
    const club = await createClubFor(dono.token, `Guarda FC ${Date.now()}`);

    const deOutro = await request(app)
      .post(`/clubs/${club.id}/players/${club.players[0].id}/renew`)
      .set('Authorization', `Bearer ${intruso.token}`)
      .send({ years: 2 });
    expect(deOutro.status).toBe(400);

    const inexistente = await request(app)
      .post(`/clubs/${club.id}/players/nao-existe/renew`)
      .set('Authorization', `Bearer ${dono.token}`)
      .send({ years: 2 });
    expect(inexistente.status).toBe(400);
  });

  it('assina um passe livre, tira-o da lista e põe-no no elenco', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, `Livre FC ${Date.now()}`);
    const { seasonYear } = await getGameState();

    // Um jogador sem clube, como a virada de temporada o deixa.
    const modelo = { ...club.players[0], id: 'livre-1', name: 'Passe Livre', wage: 8_000 };
    const id = `teste-${randomUUID()}`;
    await prisma.freeAgent.create({
      data: {
        id,
        playerJson: JSON.stringify(modelo),
        country: 'BRA',
        /**
         * Overall no teto de propósito, para este jogador vir sempre no topo da lista.
         *
         * A coluna só existe para ordenar. Filtrar por posição não bastou: as outras suítes desta pasta
         * viram temporada e o mundo solta centenas de jogadores por vez — medido, 4.745 sem clube ao fim de
         * uma execução completa, com o melhor da posição em 92. Um jogador de overall 64 fica fora dos
         * primeiros duzentos e o teste falha por um motivo que não tem nada a ver com o que ele verifica.
         */
        overall: 99,
        position: modelo.position,
        sinceSeason: seasonYear,
      },
    });

    /**
     * Filtrado pela posição, e o jogador vem no topo pelo overall 99 gravado acima.
     *
     * A lista vem ordenada por qualidade e limitada, e as outras suítes desta pasta produzem milhares de
     * passes livres ao virar temporada. Subir o teto não resolvia: o que resolve é o jogador do teste ser
     * o melhor da posição, o que não depende de quantos outros existem.
     */
    const lista = await request(app)
      .get(`/clubs/${club.id}/free-agents?position=${modelo.position}&limit=20`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(lista.status).toBe(200);
    expect(lista.body.some((f: any) => f.id === id)).toBe(true);

    const res = await request(app)
      .post(`/clubs/${club.id}/free-agents/${id}/sign`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ years: 3 });

    expect(res.status).toBe(200);
    expect(res.body.club.players.length).toBe(club.players.length + 1);
    expect(res.body.club.budget).toBe(club.budget - res.body.cost);

    /**
     * Id novo ao assinar: o antigo carregava o clube de origem, e dois clubes não podem partilhar um
     * jogador. Sem isto, assinar o mesmo passe livre por dois clubes daria o mesmo id em dois elencos.
     */
    expect(res.body.player.id).not.toBe('livre-1');
    expect(res.body.player.contractUntil).toBeGreaterThan(seasonYear);

    // E saiu da lista, senão dois clubes assinariam o mesmo jogador.
    expect(await prisma.freeAgent.findUnique({ where: { id } })).toBeNull();

    const segunda = await request(app)
      .post(`/clubs/${club.id}/free-agents/${id}/sign`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ years: 3 });
    expect(segunda.status).toBe(400);
  });
});
