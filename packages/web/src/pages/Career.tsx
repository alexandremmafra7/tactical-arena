import { calculateClubVisibility, countryName, SACK_FLOOR, WARNING_FLOOR } from '@tactical-arena/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COUNTRIES, type Club } from '@tactical-arena/shared';
import {
  acceptJobOffer,
  Career,
  getCareer,
  getClub,
  getJobOffers,
  getApproaches,
  getClubManager,
  ManagerView,
  acceptApproach as acceptApproachApi,
  declineApproach as declineApproachApi,
  JobOffer,
  ApproachView,
  listSaves,
  ManagerProfile,
  resignClub,
} from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { CountryFlag } from '../components/CountryFlag.js';
import { StaffIcon, TrophyIcon, ArrowLeftIcon, HomeIcon } from '../components/icons/AppIcons.js';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function titleLabel(title: Career['titles'][number]): string {
  if (title.type === 'league') return `Liga (Divisão ${title.division}), temporada ${title.season}`;
  return `Copa "${title.name}", temporada ${title.season}`;
}

export function CareerPage() {
  const navigate = useNavigate();
  const [career, setCareer] = useState<Career | null>(null);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [activeClub, setActiveClub] = useState<Club | null>(null);
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [sondagens, setSondagens] = useState<ApproachView[]>([]);
  /** O próprio técnico, com a confiança que a diretoria tem nele. */
  const [treinador, setTreinador] = useState<ManagerView | null>(null);
  /** A estatura do clube atual, para a sondagem poder ser comparada com ele em vez de flutuar sozinha. */
  const [estaturaAtual, setEstaturaAtual] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resignClubTarget, setResignClubTarget] = useState<{ id: string; name: string } | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [data, savesData] = await Promise.all([
        getCareer(),
        listSaves().catch(() => ({ currentSaveId: '', currentManager: null, saves: [] })),
      ]);
      setCareer(data);
      setManager(savesData.currentManager);

      if (data.activeClubIds.length > 0) {
        const clube = await getClub(data.activeClubIds[0]);
        setActiveClub(clube);
        setOffers([]);
        setSondagens(await getApproaches());
        setTreinador(await getClubManager(clube.id).catch(() => null));
        setEstaturaAtual(
          calculateClubVisibility(clube, 1, clube.titlesWon ?? 0, clube.membersCount ?? undefined).score,
        );
      } else {
        setActiveClub(null);
        setSondagens([]);
        setEstaturaAtual(null);
        setTreinador(null);
        setOffers(await getJobOffers());
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function executeResign() {
    if (!resignClubTarget) return;
    const clubId = resignClubTarget.id;
    setResignClubTarget(null);
    setBusy(true);
    setError(null);
    try {
      await resignClub(clubId);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Aceitar leva ao clube novo; recusar apaga aquela sondagem e mais nada.
   *
   * O servidor é que faz a troca inteira — sair do atual, assumir o novo, cobrar a reputação — porque a
   * ordem dessas três coisas importa e resolvê-la no cliente deixaria o técnico com dois clubes ao mesmo
   * tempo se a rede falhasse no meio.
   */
  async function aceitarSondagem(id: string) {
    setBusy(true);
    setError(null);
    try {
      const club = await acceptApproachApi(id);
      navigate(`/clubs/${club.id}`);
    } catch (err) {
      setError((err as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function recusarSondagem(id: string) {
    setBusy(true);
    try {
      await declineApproachApi(id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptOffer(offerId: string) {
    setBusy(true);
    setError(null);
    try {
      const club = await acceptJobOffer(offerId);
      navigate(`/clubs/${club.id}`);
    } catch (err) {
      setError((err as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="page">Carregando...</div>;
  if (!career) return null;

  const country = COUNTRIES.find((c) => c.code === manager?.nationality);

  /**
   * Como cada saída se chama para quem lê.
   *
   * O motivo é gravado em código no banco, e a tabela mostrava o código cru: quem foi mandado embora lia
   * "SACKED" na própria carreira. E os dois casos precisam de palavras diferentes — pedir demissão e ser
   * demitido eram ambos "Demissão", que é justamente a distinção que esta coluna existe para fazer.
   */
  function motivoDeSaida(reason: string | null): string {
    if (reason === 'RESIGNED') return 'Pediu demissão';
    if (reason === 'SACKED') return 'Demitido';
    return reason ?? 'Encerrada';
  }

  // O aviso vem na URL, posto por `goToMatchday` no momento em que a demissão chegou do servidor.
  const demitido = new URLSearchParams(window.location.search).has('sacked');

  return (
    <div className="page">
      {activeClub ? (
        <>
          <ClubNav club={activeClub} active="career" backTo={`/clubs/${activeClub.id}/history`} />
          <HubSubnav hub="club" clubId={activeClub.id} active="career" />
        </>
      ) : (
        <header className="topbar">
          <h1 className="brand">
            <img src="/logo-icon.png" alt="Tactical Arena FC" width={32} height={32} /> Minha Carreira
          </h1>
          <div className="topbar-actions">
            <Link className="back-to-panel" to="/dashboard" title="Voltar" aria-label="Voltar">
              <ArrowLeftIcon size={20} />
            </Link>
            <Link className="home-button" to="/dashboard" title="Ir para a página inicial" aria-label="Ir para a página inicial">
              <HomeIcon size={20} color="var(--accent)" />
            </Link>
          </div>
        </header>
      )}

      {/*
        A demissão dita, em palavras, na primeira tela que o técnico vê depois dela.
        Chegar aqui sem explicação seria o pior desfecho possível para o sistema inteiro: o jogador saberia
        que perdeu o clube e não saberia por quê.
      */}
      {demitido && (
        <section className="card contratos-alerta" role="status">
          A diretoria decidiu encerrar seu trabalho no clube. A carreira continua: escolha o próximo desafio
          entre as propostas abaixo.
        </section>
      )}

      {/* MANAGER HERO PROFILE CARD */}
      <section className="card manager-hero-card" style={{ background: 'linear-gradient(135deg, #181410 0%, #100f12 100%)', border: '1.5px solid var(--accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: '3rem', background: '#1c191e', border: '2px solid #ffd700', borderRadius: '50%', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(!manager?.avatar || manager.avatar === '👔') ? <StaffIcon size={38} color="#ffd700" /> : manager.avatar}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>
              Perfil Oficial do Treinador
            </span>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#ffd700', fontFamily: 'var(--font-display)' }}>
              {manager?.fullName ?? 'Professor Técnico'}
            </h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
              <span className="manager-badge-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CountryFlag code={manager?.nationality ?? 'BRA'} size={16} title={country?.name ?? manager?.nationality ?? 'Brasil'} /> {country?.name ?? manager?.nationality ?? 'Brasil'}
              </span>
              <span className="manager-badge-pill">
                Filosofia: {manager?.style ?? 'Estrategista'}
              </span>
              <span className="manager-badge-pill" style={{ color: '#ffd700', borderColor: 'rgba(212, 175, 55, 0.4)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TrophyIcon size={13} color="#ffd700" /> {career.titles.length} {career.titles.length === 1 ? 'Título' : 'Títulos'}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      {activeClub && (
        <section className="card">
          <h2>Clube atual</h2>
          <p className="crest-name">
            <strong>{activeClub.name}</strong>
          </p>

          {/*
            A confiança da diretoria, à vista.
            Ela já decidia demissões e sondagens sem o técnico nunca a ver: só descobria a nota quando o
            presidente batia à porta, e a essa altura já era um ultimato. Um número que governa a carreira
            tem de ser visível antes de doer.
          */}
          {treinador?.confidence !== undefined && (
            <div className="confianca">
              <div className="confianca-topo">
                <span className="confianca-rotulo">Confiança da diretoria</span>
                <strong className={`confianca-valor confianca-${treinador.mood}`}>{treinador.moodLabel}</strong>
              </div>
              <div
                className="confianca-barra"
                role="meter"
                aria-valuenow={treinador.confidence}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Confiança da diretoria"
              >
                <span className={`confianca-preenchida confianca-${treinador.mood}`} style={{ width: `${treinador.confidence}%` }} />
                {/* As duas marcas dizem onde o chão fica, para a queda ser lida e não adivinhada. */}
                <span className="confianca-marca confianca-marca-aviso" style={{ left: `${WARNING_FLOOR}%` }} aria-hidden="true" />
                <span className="confianca-marca confianca-marca-fim" style={{ left: `${SACK_FLOOR}%` }} aria-hidden="true" />
              </div>
              <p className="muted confianca-motivo">
                {treinador.warnings ? 'O presidente já pediu satisfações. ' : ''}
                {treinador.confidenceReason
                  ? `O que mais pesa hoje: ${treinador.confidenceReason}.`
                  : 'Ainda sem partidas suficientes para a diretoria formar opinião.'}
              </p>
              <p className="muted">
                Reputação no mercado: <strong>{treinador.reputation}</strong> — é ela que decide o tamanho dos
                clubes que procuram você.
              </p>
            </div>
          )}

          <button className="btn-secondary" onClick={() => setResignClubTarget({ id: activeClub.id, name: activeClub.name })} disabled={busy}>
            Se demitir
          </button>
        </section>
      )}

      {/*
        Sondagens: clubes que querem o técnico enquanto ele ainda tem emprego.
        Separadas das ofertas de propósito — uma proposta a quem está desempregado é uma saída, uma sondagem
        a quem tem clube é uma decisão, e as duas não cabem na mesma lista sem confundir as duas situações.
      */}
      {activeClub && sondagens.length > 0 && (
        <section className="card">
          <h2>Clubes interessados</h2>
          <p className="muted">
            Trocar de clube com a temporada em curso é permitido, e custa reputação: abandonar um trabalho no
            meio pesa na forma como o mercado enxerga você.
          </p>
          <ul className="contratos-lista">
            {sondagens.map((sondagem) => (
              <li
                key={sondagem.id}
                className={`contrato-linha ${sondagem.locked ? 'contrato-bloqueado' : 'contrato-good'}`}
              >
                <div className="contrato-quem">
                  <strong>{sondagem.clubName}</strong>
                  <span className="muted">{countryName(sondagem.clubCountry)}</span>
                </div>
                <div className="contrato-prazo">
                  <span className="contrato-prazo-valor">Estatura {sondagem.visibility}</span>
                  <span className="muted">seu clube: {estaturaAtual ?? '--'}</span>
                </div>
                <div className="contrato-acao">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy || sondagem.locked}
                    onClick={() => aceitarSondagem(sondagem.id)}
                  >
                    {sondagem.locked ? 'Bloqueado' : 'Assinar'}
                  </button>
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => recusarSondagem(sondagem.id)}>
                    Recusar
                  </button>
                </div>
                {sondagem.locked && sondagem.lockReason && (
                  <p className="contrato-bloqueio">{sondagem.lockReason}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!activeClub && (
        <section className="card">
          <h2>Ofertas de emprego</h2>
          {offers.length === 0 && <p className="muted">Nenhuma oferta no momento.</p>}
          <ul className="club-list">
            {offers.map((offer) => (
              <li key={offer.id}>
                <span className="crest-name">
                  <strong>{offer.clubName}</strong>
                </span>
                <button onClick={() => handleAcceptOffer(offer.id)} disabled={busy} style={{ marginLeft: 8 }}>
                  Aceitar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Títulos</h2>
        {career.titles.length === 0 && <p className="muted">Nenhum título conquistado ainda.</p>}
        {career.titles.length > 0 && (
          <ul className="club-list">
            {career.titles.map((title, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><TrophyIcon size={14} color="#ffd700" /> {titleLabel(title)}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Histórico de clubes</h2>
        {career.tenures.length === 0 && <p className="muted">Você ainda não treinou nenhum clube.</p>}
        {career.tenures.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Clube</th>
                  <th>País</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {career.tenures
                  .slice()
                  .reverse()
                  .map((tenure, i) => (
                    <tr key={i}>
                      <td>
                        {tenure.endedAt ? (
                          tenure.clubName
                        ) : (
                          <Link to={`/clubs/${tenure.clubId}`}>{tenure.clubName}</Link>
                        )}
                      </td>
                      <td>
                        <CountryFlag code={tenure.countryCode} />
                      </td>
                      <td>{formatDate(tenure.startedAt)}</td>
                      <td>{tenure.endedAt ? formatDate(tenure.endedAt) : '-'}</td>
                      <td>{tenure.endedAt ? motivoDeSaida(tenure.endReason) : 'Atual'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ConfirmModal
        isOpen={!!resignClubTarget}
        title="Pedir Demissão do Clube"
        message={
          <>
            Tem certeza que deseja pedir demissão do <strong style={{ color: '#ffd700' }}>{resignClubTarget?.name}</strong>?
            Você ficará desempregado e o clube ficará disponível para outro técnico no mercado.
          </>
        }
        confirmLabel="Pedir Demissão"
        cancelLabel="Permanecer no Clube"
        variant="danger"
        onCancel={() => setResignClubTarget(null)}
        onConfirm={executeResign}
      />
    </div>
  );
}
