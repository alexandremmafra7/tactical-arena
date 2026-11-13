import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Club, FormResult, League, Player, TacticalAssistantAdvice, OppositionDossier } from '@tactical-arena/shared';
import { autoFillLineup, formatShortPtBr, generateOppositionDossier, getRecommendedTeamTalk, injuredPlayers, suspendedPlayers } from '@tactical-arena/shared';
import {
  applyTeamTalk,
  getActiveLeague,
  getClub,
  getClubCalendar,
  getClubForm,
  getTacticalAdvice,
  getOppositionDossier,
  saveTacticPreset,
  setDefaultTacticPreset,
  setRoundTactic,
  autoPrepareTactics,
  listMyClubs,
  listSaves,
  loadSave,
  ensureServerAuthSession,
  type CalendarEntry,
} from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { TeamTalkCard } from '../components/TeamTalkCard.js';
import { OppositionDossierCard } from '../components/OppositionDossierCard.js';
import { competitionLogo } from '../lib/competitionLogo.js';
import { goToMatchday } from '../lib/goToMatchday.js';
import { resetScrollToTop } from '../components/ScrollToTop.js';
import { WEATHER_LABEL, WEATHER_NOTE, weatherOfEntry } from '../lib/matchWeather.js';
import { SunIcon, CloudRainIcon, FlameIcon, TacticsIcon, CompetitionsIcon, AlertTriangleIcon } from '../components/icons/AppIcons.js';

type LeagueWithStandings = League & { standings?: { clubId: string }[] };

/**
 * A preleção: o momento entre decidir jogar e o apito.
 *
 * O jogo não tinha esse momento. O botão do painel chamava o dia de jogo e caía direto no ao vivo, então a
 * única vez em que o jogo parava e perguntava alguma coisa era quando o time estava desescalado — e aí era
 * um aviso de erro, não um ritual. Um técnico chega ao vestiário sabendo quem é o adversário, como ele vem
 * jogando e quem não pode entrar em campo; aqui ele fica sabendo.
 *
 * As condições entraram depois, quando o motor passou a simular o tempo de verdade (ver weather.ts). Antes
 * disso ficaram de fora de propósito: o painel escrevia "Gramado Molhado" a cada terceira rodada, texto
 * inventado que não movia uma bola, e numa tela que promete dizer o que o técnico precisa saber, mostrar
 * aquilo seria mentir. Agora o que está escrito aqui é o que a partida vai aplicar.
 *
 * A leitura do auxiliar não é nova: `generateTacticalAssistantAdvice` existe há tempos, com o acerto e o
 * nível de detalhe amarrados à nota de quem você contratou, e o servidor já registra a previsão para
 * cobrar o auxiliar depois. Só que a única tela que a mostrava era a da comissão, que não sabe quem é o
 * próximo adversário, então o relatório saía genérico e não previa nada. Aqui ele chega com o adversário
 * junto, que é o que faz a previsão valer.
 */
export function MatchBriefingPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  const [club, setClub] = useState<Club | null>(null);
  const [opponent, setOpponent] = useState<Club | null>(null);
  const [entry, setEntry] = useState<CalendarEntry | null>(null);
  const [league, setLeague] = useState<LeagueWithStandings | null>(null);
  const [myForm, setMyForm] = useState<FormResult[]>([]);
  const [theirForm, setTheirForm] = useState<FormResult[]>([]);
  const [advice, setAdvice] = useState<TacticalAssistantAdvice | null>(null);
  const [dossier, setDossier] = useState<OppositionDossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [teamTalkApplied, setTeamTalkApplied] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function aplicarContraEstrategia() {
    if (!club) return;
    setError(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      const res = await autoPrepareTactics(club.id, opponent?.id);
      setClub(res.club);
      const form = res.club.pendingRoundTactic?.formation ?? res.tactic?.formation ?? '4-4-2';
      setSuccessMsg(`✓ Contra-estratégia aplicada pelo Auxiliar! Time escalado em ${form}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;

    (async () => {
      try {
        const [clubData, calendar] = await Promise.all([getClub(clubId), getClubCalendar(clubId).catch(() => null)]);
        if (cancelled) return;
        setClub(clubData);

        const next = (calendar?.entries ?? []).find((e: CalendarEntry) => !e.result && !e.matchId) ?? null;
        setEntry(next);
        if (!next) return;

        /**
         * Tudo o que segue é o conteúdo da preleção, e nada disso pode impedir o jogador de entrar em campo.
         * Se a forma do adversário não vier, a preleção fica mais pobre; o botão continua funcionando.
         */
        const [opp, mine, theirs, read, activeLeague, fetchedDossier] = await Promise.all([
          getClub(next.opponentClubId).catch(() => null),
          getClubForm(clubId).catch(() => [] as FormResult[]),
          getClubForm(next.opponentClubId).catch(() => [] as FormResult[]),
          getTacticalAdvice(clubId, next.opponentClubId).catch(() => null),
          getActiveLeague(clubId).catch(() => null),
          getOppositionDossier(clubId, next.opponentClubId).catch(() => null),
        ]);
        if (cancelled) return;
        setOpponent(opp);
        setMyForm(mine);
        setTheirForm(theirs);
        setAdvice(read);
        setLeague(activeLeague);

        if (fetchedDossier) {
          setDossier(fetchedDossier);
        } else if (opp) {
          const assistant = clubData.staff?.find((s) => s.role === 'TACTICAL_ASSISTANT');
          const oppTactic = opp.pendingRoundTactic ?? autoFillLineup(opp);
          setDossier(generateOppositionDossier(opp, oppTactic, assistant));
        }
      } catch (err) {
        if (!cancelled) {
          const rawMsg = (err as Error).message || '';
          if (rawMsg.includes('Token') || rawMsg.includes('401')) {
            try {
              const session = await ensureServerAuthSession();
              if (session) {
                const retryClub = await getClub(clubId);
                if (!cancelled) {
                  setClub(retryClub);
                  setLoading(false);
                  return;
                }
              }
            } catch {}
          }
          setError(rawMsg);
          try {
            const myClubs = await listMyClubs();
            if (myClubs.length > 0 && myClubs[0].id !== clubId) {
              navigate(`/clubs/${myClubs[0].id}/briefing`, { replace: true });
              return;
            }
            const savesRes = await listSaves().catch(() => null);
            if (savesRes && savesRes.saves.length > 0) {
              const current = savesRes.saves.find((s: any) => s.id === savesRes.currentSaveId) ?? savesRes.saves[0];
              if (current) {
                const loaded = await loadSave(current.id).catch(() => null);
                const recoveredId = loaded?.claimedClubId || loaded?.save?.clubId;
                if (recoveredId && recoveredId !== clubId) {
                  navigate(`/clubs/${recoveredId}/briefing`, { replace: true });
                  return;
                }
              }
            }
          } catch {}
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  async function entrarEmCampo() {
    if (!club) return;
    setError(null);
    setBusy(true);
    try {
      if (!escalado) {
        const tactic = autoFillLineup(club);
        await setRoundTactic(club.id, tactic);
        const preset = await saveTacticPreset(club.id, 'Padrão (4-4-2)', tactic);
        await setDefaultTacticPreset(club.id, preset.id);
      }
      if (!teamTalkApplied && club.staffDelegationConfig?.delegateTeamTalks !== false) {
        const isDerby = Boolean(entry?.stageName && (entry.stageName.includes('Final') || entry.stageName.includes('Decisão')));
        const rec = getRecommendedTeamTalk('PRE_MATCH', 0, isDerby);
        await applyTeamTalk(club.id, rec.id, 'PRE_MATCH', 0).catch(() => {});
      }
      const matchId = await goToMatchday(club.id);
      if (matchId) {
        resetScrollToTop('instant');
        navigate(`/match/${matchId}/live`);
        return;
      }
      navigate(`/clubs/${club.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  /** Escalar os melhores e seguir, para quem não quer abrir a prancheta. Vinha do aviso que esta tela substituiu. */
  async function escalarEEntrar() {
    if (!club) return;
    setError(null);
    setBusy(true);
    try {
      const tactic = autoFillLineup(club);
      await setRoundTactic(club.id, tactic);
      const preset = await saveTacticPreset(club.id, 'Padrão (4-4-2)', tactic);
      await setDefaultTacticPreset(club.id, preset.id);
      await entrarEmCampo();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (loading) return <div className="page">Preparando a preleção...</div>;
  if (error && !club) {
    const isTokenErr = error.includes('Token') || error.includes('401');
    return (
      <div className="page error" style={{ textAlign: 'center', padding: '60px 20px', maxWidth: 480, margin: '40px auto' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#f87171', marginBottom: 12 }}>
          {isTokenErr ? 'Sessão Expirada' : 'Clube não encontrado'}
        </h2>
        <p className="muted" style={{ margin: '0 0 24px', lineHeight: 1.5 }}>
          {isTokenErr
            ? 'Sua sessão com o servidor expirou ou foi reiniciada. Clique em Reconectar para continuar.'
            : error.includes('não encontrado')
              ? 'O clube solicitado não foi encontrado no banco de dados.'
              : error}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Reconectar
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
            Início / Carreira
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>
            Meus Clubes
          </button>
        </div>
      </div>
    );
  }
  if (!club) return null;

  if (!entry) {
    return (
      <div className="page">
        <ClubNav club={club} active="home" />
        <section className="card">
          <h2>Nenhuma partida marcada</h2>
          <p className="muted">
            O calendário não tem próximo jogo para o {club.name}. Isso acontece entre temporadas, antes de a
            competição começar.
          </p>
          <p className="home-link">
            <Link className="btn-secondary" to={`/clubs/${club.id}/competitions`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CompetitionsIcon size={16} /> Ver competições
            </Link>
          </p>
        </section>
      </div>
    );
  }

  const starters = club.pendingRoundTactic?.lineup?.filter((slot) => Boolean(slot?.playerId)).length ?? 0;
  const escalado = starters === 11;

  const pos = (c: Club | null) =>
    c && league?.standings ? league.standings.findIndex((row) => row.clubId === c.id) + 1 || null : null;
  const minhaPos = pos(club);
  const posDeles = pos(opponent);

  const meusDesfalques = desfalques(club.players);
  const desfalquesDeles = opponent ? desfalques(opponent.players) : [];

  const logo = competitionLogo(entry.competitionName);
  const rodada = entry.stageName ?? `Rodada ${entry.round}`;

  // O clima é o da cidade do jogo, então quem manda decide o país consultado.
  const weather = weatherOfEntry(entry, club.id, entry.isHome ? club.country : opponent?.country);

  return (
    <div className="page briefing">
      <ClubNav club={club} active="home" />

      {error && <p className="error">{error}</p>}

      <section className="briefing-header">
        <div className="briefing-comp">
          <div className="briefing-comp-left">
            {logo && <img src={logo} alt="" className="briefing-comp-logo" />}
            <div className="briefing-comp-info">
              <span className="briefing-comp-name">{entry.competitionName}</span>
              <span className="briefing-comp-round">
                {rodada}
                {entry.date ? ` • ${formatShortPtBr(entry.date)}` : ''}
                {' • '}
                {entry.isHome ? 'em casa' : 'fora de casa'}
              </span>
            </div>
          </div>
          <div className="briefing-comp-right">
            {escalado ? (
              <span className="header-status-badge ok">✓ Escalação Pronta</span>
            ) : (
              <span className="header-status-badge pendente">⚠️ {starters}/11 Titulares</span>
            )}
          </div>
        </div>

        <div className="briefing-matchup">
          <BriefingSide
            club={entry.isHome ? club : opponent}
            fallbackName={entry.isHome ? club.name : entry.opponentName}
            position={entry.isHome ? minhaPos : posDeles}
            form={entry.isHome ? myForm : theirForm}
          />

          <div className="briefing-center-action">
            <div className="briefing-vs-badge">VS</div>

            <button
              type="button"
              className="briefing-hero-kickoff"
              onClick={entrarEmCampo}
              disabled={busy}
              title={escalado ? 'Iniciar partida' : 'Escalar automaticamente os 11 titulares e iniciar partida'}
            >
              <span className="kickoff-hero-icon">⚽</span>
              <span className="kickoff-hero-label">
                {busy ? 'ENTRANDO EM CAMPO...' : escalado ? 'ENTRAR EM CAMPO' : 'ESCALAR E ENTRAR'}
              </span>
              <span className="kickoff-hero-sub">({rodada})</span>
            </button>

            <div className="briefing-hero-actions">
              <Link
                className={`btn-briefing-quick ${escalado ? '' : 'urgent'}`}
                to={`/clubs/${club.id}/tactics`}
                title={escalado ? 'Ajustar titulares, banco e instruções' : 'Defina os 11 titulares para jogar'}
              >
                <TacticsIcon size={14} />
                <span>{escalado ? `Tática (${club.pendingRoundTactic?.formation ?? '4-4-2'})` : 'Montar Tática'}</span>
              </Link>

              <button
                type="button"
                className="btn-briefing-quick btn-quick-assistant"
                onClick={aplicarContraEstrategia}
                disabled={busy}
                title="Auxiliar ajusta escalação e contra-estratégia para enfrentar este adversário"
              >
                <span>⚡ Contra-Estratégia</span>
              </button>

              {!escalado && (
                <button
                  type="button"
                  className="btn-briefing-quick btn-quick-autofill"
                  onClick={escalarEEntrar}
                  disabled={busy}
                  title="Escala os 11 melhores automaticamente e entra na partida"
                >
                  <span>⚡ Escalar e Entrar</span>
                </button>
              )}
            </div>
          </div>

          <BriefingSide
            club={entry.isHome ? opponent : club}
            fallbackName={entry.isHome ? entry.opponentName : club.name}
            position={entry.isHome ? posDeles : minhaPos}
            form={entry.isHome ? theirForm : myForm}
          />
        </div>
      </section>

      {successMsg && <div className="briefing-success-toast">{successMsg}</div>}

      {/* Faixa compacta de status de pré-jogo (3 cards reduzidos em 1 única linha) */}
      <div className="briefing-status-strip">
        <div className={`status-strip-card ${escalado ? 'is-ok' : 'is-pending'}`}>
          <div className="strip-card-icon">
            <TacticsIcon size={16} />
          </div>
          <div className="strip-card-body">
            <span className="strip-card-title">Escalação</span>
            <span className="strip-card-desc">
              {escalado ? `✓ Escalado em ${club.pendingRoundTactic?.formation ?? '4-4-2'}` : `⚠️ ${starters}/11 titulares definidos`}
            </span>
          </div>
          <Link to={`/clubs/${club.id}/tactics`} className="strip-card-link">
            {escalado ? 'Prancheta →' : 'Escalar →'}
          </Link>
        </div>

        <div className={`status-strip-card weather-card weather-${weather.toLowerCase()}`}>
          <div className="strip-card-icon">
            {weather === 'DRY' && <SunIcon size={16} color="#fbbf24" />}
            {weather === 'RAIN' && <CloudRainIcon size={16} color="#60a5fa" />}
            {weather === 'HOT' && <FlameIcon size={16} color="#f97316" />}
          </div>
          <div className="strip-card-body">
            <span className="strip-card-title">Condições: {WEATHER_LABEL[weather]}</span>
            <span className="strip-card-desc" title={WEATHER_NOTE[weather]}>
              {WEATHER_NOTE[weather]}
            </span>
          </div>
        </div>

        <div className="status-strip-card outs-card">
          <div className="strip-card-icon">🏥</div>
          <div className="strip-card-body">
            <span className="strip-card-title">Quem não joga</span>
            <span className="strip-card-desc">
              {meusDesfalques.length === 0 && desfalquesDeles.length === 0
                ? 'Ambos os elencos 100% completos'
                : `${meusDesfalques.length} fora no ${club.name} • ${desfalquesDeles.length} no ${opponent?.name ?? 'rival'}`}
            </span>
          </div>
          {(meusDesfalques.length > 0 || desfalquesDeles.length > 0) && (
            <div className="strip-card-tags">
              {meusDesfalques.slice(0, 2).map((d) => (
                <span key={d.player.id} className="strip-tag" title={`${d.player.name}: ${d.motivo}`}>
                  {d.player.name.split(' ')[0]}
                </span>
              ))}
              {meusDesfalques.length > 2 && <span className="strip-tag">+{meusDesfalques.length - 2}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Grid de inteligência de 2 colunas equilibradas (Espionagem + Preleção) */}
      <div className="briefing-intel-grid">
        <div className="intel-col-scouting">
          {dossier ? (
            <div className="scouting-wrapper">
              <OppositionDossierCard dossier={dossier} onApplyCountermeasures={aplicarContraEstrategia} />
              {advice && (
                <div className="briefing-addon-advice">
                  <div className="addon-advice-head">
                    <span className="addon-advice-badge">Leitura do Auxiliar ({advice.confidenceLabel})</span>
                    <span className="addon-advice-setup">
                      Sugerido: <strong>{advice.recommendedFormation}</strong> · {advice.recommendedMentality} · {advice.recommendedPressing}
                    </span>
                  </div>
                  {advice.keyWeakness && (
                    <p className="addon-advice-weakness">
                      <span className="weakness-chip">Ponto Fraco</span> {advice.keyWeakness}
                    </p>
                  )}
                  {advice.assistantNotes && (
                    <p className="addon-advice-notes muted">{advice.assistantNotes}</p>
                  )}
                </div>
              )}
            </div>
          ) : advice ? (
            <section className="card briefing-read">
              <div className="briefing-read-head">
                <h3>Leitura do auxiliar</h3>
                <span className={`briefing-confidence ${confidenceClass(advice.confidence)}`}>
                  {advice.confidenceLabel}
                </span>
              </div>
              <p className="briefing-read-summary">{advice.opponentSummary}</p>
              <p className="briefing-read-weakness">
                <span className="briefing-weakness-tag">Ponto Fraco</span>
                {advice.keyWeakness}
              </p>
              <div className="briefing-recommendation">
                <span className="briefing-rec-label">Ele montaria assim</span>
                <span className="briefing-rec-values">
                  {advice.recommendedFormation} · {advice.recommendedMentality} · {advice.recommendedPressing}
                </span>
              </div>
              <p className="briefing-read-notes">{advice.assistantNotes}</p>
              <div className="briefing-read-actions">
                <button
                  type="button"
                  className="btn-briefing-assistant"
                  onClick={aplicarContraEstrategia}
                  disabled={busy}
                >
                  {busy ? 'Aplicando...' : 'Aplicar Contra-Estratégia'}
                </button>
              </div>
            </section>
          ) : (
            <div className="card muted" style={{ padding: 20, textAlign: 'center' }}>
              Sem relatório tático do adversário disponível.
            </div>
          )}
        </div>

        <div className="intel-col-talk">
          <TeamTalkCard
            clubId={club.id}
            context="PRE_MATCH"
            scoreDifferential={0}
            isDerbyOrFinal={Boolean(entry.stageName && (entry.stageName.includes('Final') || entry.stageName.includes('Decisão')))}
            onApplied={() => {
              setTeamTalkApplied(true);
              getClub(club.id).then(setClub).catch(() => {});
            }}
          />
        </div>
      </div>

      <div className="briefing-footer-actions">
        {!escalado && (
          <button type="button" className="btn-secondary briefing-autofill" onClick={escalarEEntrar} disabled={busy}>
            Escalar os melhores e entrar
          </button>
        )}
        <button type="button" className="briefing-kickoff-footer" onClick={entrarEmCampo} disabled={busy}>
          {busy ? 'Entrando em campo...' : escalado ? `ENTRAR EM CAMPO (${rodada}) →` : `ESCALAR E ENTRAR (${rodada}) →`}
        </button>
      </div>
    </div>
  );
}

/** Lesionado e suspenso são a mesma pergunta para quem escala: quem não posso usar hoje. */
function desfalques(players: Player[]): { player: Player; motivo: string }[] {
  const out: { player: Player; motivo: string }[] = [];
  for (const p of injuredPlayers(players)) {
    out.push({ player: p, motivo: p.injuryWeeks === 1 ? 'lesionado, volta na próxima' : `lesionado, ${p.injuryWeeks} jogos` });
  }
  for (const p of suspendedPlayers(players)) {
    out.push({ player: p, motivo: 'suspenso' });
  }
  return out;
}

function ListaDesfalques({ jogadores }: { jogadores: { player: Player; motivo: string }[] }) {
  if (jogadores.length === 0) return <p className="muted">Elenco completo.</p>;
  return (
    <ul className="briefing-outs-list">
      {jogadores.map(({ player, motivo }) => (
        <li key={player.id}>
          <strong>{player.name}</strong>
          <span className="muted"> {motivo}</span>
        </li>
      ))}
    </ul>
  );
}

function BriefingSide({
  club,
  fallbackName,
  position,
  form,
}: {
  club: Club | null;
  fallbackName: string;
  position: number | null;
  form: FormResult[];
}) {
  return (
    <div className="briefing-side">
      {club ? <ClubCrest club={club} size={52} /> : <div className="briefing-side-crest-empty" />}
      <span className="briefing-side-name">{club?.name ?? fallbackName}</span>
      {position && <span className="briefing-side-pos">{position}º na tabela</span>}
      {form.length > 0 ? (
        <span className="form-pills briefing-side-form" title="Últimos jogos, do mais antigo para o mais recente">
          {form.map((r, i) => (
            <span key={i} className={`form-pill form-${r}`}>
              {r}
            </span>
          ))}
        </span>
      ) : (
        <span className="briefing-side-form-empty">sem jogos ainda</span>
      )}
    </div>
  );
}

function confidenceClass(confidence: number): string {
  if (confidence >= 0.8) return 'alta';
  if (confidence >= 0.6) return 'media';
  return 'baixa';
}
