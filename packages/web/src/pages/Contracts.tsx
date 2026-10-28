import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Club, Player } from '@tactical-arena/shared';
import { getClub, getContracts, isOfflineMode, listFreeAgents, renewPlayerContract, batchRenewContracts, signFreeAgent } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { ExpiringContractsBanner } from '../components/ExpiringContractsBanner.js';

/**
 * Contratos: quem está a vencer, e quem está livre no mercado.
 *
 * O jogo não tinha contrato, e a consequência era maior do que parece: sem prazo nenhum jogador tem motivo
 * para sair, o mundo fica parado, e o diretor de futebol não tem trabalho — renovar contrato num jogo sem
 * contrato é nada.
 *
 * Esta tela é onde o prazo vira decisão. O preço de cada duração vem do servidor, e não é recalculado aqui:
 * a fórmula mora no `shared` e escrevê-la também no cliente é como este projeto já quebrou três vezes esta
 * semana, com nome de liga, divisão de campeonato e partida ao vivo.
 */
function dinheiro(valor: number): string {
  return (valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

interface LinhaContrato {
  playerId: string;
  contractUntil: number | null;
  seasonsRemaining: number;
  costByYears: Record<string, number>;
}

/** Quão urgente é este contrato. Um ano ou menos é o ponto em que o jogador pode sair sem o clube receber. */
function urgencia(temporadas: number): 'bad' | 'warning' | 'good' {
  if (temporadas <= 0) return 'bad';
  return temporadas === 1 ? 'warning' : 'good';
}

export function ContractsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [contratos, setContratos] = useState<{ seasonYear: number; players: LinhaContrato[] } | null>(null);
  const [livres, setLivres] = useState<{ id: string; player: Player; sinceSeason: number }[]>([]);
  const [anos, setAnos] = useState<Record<string, number>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!clubId) return;
    try {
      const [c, ct, fa] = await Promise.all([
        getClub(clubId),
        getContracts(clubId),
        listFreeAgents(clubId, { limit: 30 }),
      ]);
      setClub(c);
      setContratos(ct);
      setLivres(fa);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [clubId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando) return <div className="page">Carregando...</div>;
  if (erro && !club) return <div className="page error">{erro}</div>;
  if (!club || !contratos) return null;

  const porId = new Map(contratos.players.map((l) => [l.playerId, l]));

  /**
   * A vencer primeiro, e dentro disso o melhor primeiro.
   *
   * Uma lista de elenco por ordem de contrato responde à pergunta que traz o técnico aqui: quem eu perco se
   * não fizer nada. Ordenar por nome faria a informação existir e não ser vista.
   */
  const elenco = [...club.players].sort((a, b) => {
    const ra = porId.get(a.id)?.seasonsRemaining ?? 99;
    const rb = porId.get(b.id)?.seasonsRemaining ?? 99;
    return ra - rb || b.overall - a.overall;
  });

  async function renovar(jogador: Player) {
    const escolhido = anos[jogador.id] ?? 2;
    setOcupado(jogador.id);
    setErro(null);
    try {
      const { cost } = await renewPlayerContract(club!.id, jogador.id, escolhido);
      setMensagem(`${jogador.name} renovou por ${escolhido} temporada(s), a ${dinheiro(cost)}`);
      await carregar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function assinar(livre: { id: string; player: Player }) {
    setOcupado(livre.id);
    setErro(null);
    try {
      const { cost } = await signFreeAgent(club!.id, livre.id, 3);
      setMensagem(`${livre.player.name} assinou por 3 temporadas, com luva de ${dinheiro(cost)}`);
      await carregar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function handleBatchRenew(playerIds: string[], yearsMap: Record<string, number>) {
    if (!club || playerIds.length === 0) return;
    setErro(null);
    try {
      const res = await batchRenewContracts(club.id, playerIds, { years: 2, yearsMap });
      setMensagem(`${res.renewedCount} contratos renovados com sucesso (Total: ${dinheiro(res.totalCost)})`);
      await carregar();
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  const aVencer = elenco.filter((p) => (porId.get(p.id)?.seasonsRemaining ?? 99) <= 1).length;

  return (
    <div className="page">
      <ClubNav club={club} active="contracts" />
      <HubSubnav hub="team" clubId={club.id} active="contracts" />

      {/* ⚠️ Expiring Contracts Banner & Batch Automation */}
      <ExpiringContractsBanner
        club={club}
        currentSeason={contratos.seasonYear}
        onBatchRenewConfirmed={handleBatchRenew}
      />

      <section className="card contratos-cabecalho">
        <h2>Contratos</h2>
        <p className="muted">
          Temporada {contratos.seasonYear}. Quem chega ao fim do contrato sai de graça, e o clube não recebe nada.
          Renovar cedo custa menos.
        </p>
        {aVencer > 0 && (
          <p className="contratos-alerta">
            {aVencer === 1 ? 'Um contrato' : `${aVencer} contratos`} a vencer nesta temporada ou na próxima.
          </p>
        )}
        <p className="muted contratos-caixa">Caixa: <strong>{dinheiro(club.budget)}</strong></p>
      </section>

      {mensagem && <p className="contratos-ok" role="status">{mensagem}</p>}
      {erro && <p className="error">{erro}</p>}

      <section className="card">
        <h3>Elenco</h3>
        <ul className="contratos-lista">
          {elenco.map((jogador) => {
            const linha = porId.get(jogador.id);
            const restantes = linha?.seasonsRemaining ?? 0;
            const escolhido = anos[jogador.id] ?? 2;
            const custo = linha?.costByYears?.[String(escolhido)] ?? 0;

            return (
              <li key={jogador.id} className={`contrato-linha contrato-${urgencia(restantes)}`}>
                <div className="contrato-quem">
                  <strong>{jogador.name}</strong>
                  <span className="muted">
                    {jogador.position} · {jogador.overall} · {jogador.age} anos
                  </span>
                </div>

                <div className="contrato-prazo">
                  <span className="contrato-prazo-valor">
                    {restantes <= 0 ? 'Vence agora' : restantes === 1 ? 'Último ano' : `${restantes} temporadas`}
                  </span>
                  {linha?.contractUntil && <span className="muted">até {linha.contractUntil}</span>}
                </div>

                <div className="contrato-acao">
                  <select
                    value={escolhido}
                    onChange={(e) => setAnos((prev) => ({ ...prev, [jogador.id]: Number(e.target.value) }))}
                    aria-label={`Anos de renovação para ${jogador.name}`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'temporada' : 'temporadas'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={ocupado === jogador.id || custo > club.budget}
                    onClick={() => renovar(jogador)}
                  >
                    {ocupado === jogador.id ? 'Renovando...' : `Renovar por ${dinheiro(custo)}`}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h3>Sem clube ({livres.length})</h3>
        <p className="muted">
          Jogadores cujo contrato venceu em algum clube do mundo. Não há taxa de transferência: paga-se só a luva.
        </p>
        {livres.length === 0 ? (
          <p className="muted">Ninguém no mercado agora. A lista enche na virada da temporada.</p>
        ) : (
          <ul className="contratos-lista">
            {livres.map((livre) => (
              <li key={livre.id} className="contrato-linha">
                <div className="contrato-quem">
                  <strong>{livre.player.name}</strong>
                  <span className="muted">
                    {livre.player.position} · {livre.player.overall} · {livre.player.age} anos
                  </span>
                </div>
                <div className="contrato-prazo">
                  <span className="muted">livre desde {livre.sinceSeason}</span>
                  <span className="muted">salário {dinheiro(livre.player.wage)}/sem</span>
                </div>
                <div className="contrato-acao">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={ocupado === livre.id}
                    onClick={() => assinar(livre)}
                  >
                    {ocupado === livre.id ? 'Assinando...' : 'Assinar por 3 temporadas'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
