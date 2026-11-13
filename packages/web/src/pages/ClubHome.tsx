import { useEffect, useState } from 'react';
import { useGameDate } from '../lib/useGameDate.js';
import { MeetingCard } from '../components/MeetingCard.js';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  MAX_SPONSORSHIPS,
  type MeetingContext,
  calculateAttendance,
  calculateAttendanceRate,
  clubAdvice,
  clubAlerts,
  formatShortPtBr,
  seasonObjective,
  seasonsRemaining,
  weeklyCashFlow,
  STAFF_ROLES_INFO,
  autoFillLineup,
  identifyExpiringContracts,
  getRecommendedTeamTalk,
} from '@tactical-arena/shared';
import type { ApproachView, CalendarEntry, ManagerView } from '../api/client.js';
import type { BriefingContext, Club, DirectorTransferRecommendation, FormResult, League, NewsCategory, NewsItem, Sponsorship, TacticPreset } from '@tactical-arena/shared';
import {
  getClub,
  getClubForm,
  getClubCalendar,
  getClubNews,
  getLeague,
  getActiveLeague,
  listTacticPresets,
  listTransferProposals,
  listScoutingDatabase,
  createTransferProposal,
  getSponsorshipOffers,
  getClubManager,
  getApproaches,
  batchRenewContracts,
  setRoundTactic,
  saveTacticPreset,
  setDefaultTacticPreset,
  applyTeamTalk,
  listMyClubs,
  listSaves,
  loadSave,
  ensureServerAuthSession,
} from '../api/client.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { ClubNav } from '../components/ClubNav.js';
import { useViewMode } from '../context/ViewModeContext.js';
import { useCutscene } from '../context/CutsceneContext.js';
import { DirectorRecommendationsCard } from '../components/DirectorRecommendationsCard.js';
import { ExpiringContractsBanner } from '../components/ExpiringContractsBanner.js';
import { FastAdvanceButton } from '../components/FastAdvanceButton.js';
import { useClubColor } from '../lib/useClubColor.js';
import { competitionLogo } from '../lib/competitionLogo.js';
import { goToMatchday } from '../lib/goToMatchday.js';
import { resetScrollToTop } from '../components/ScrollToTop.js';
import { WEATHER_LABEL, weatherOfEntry } from '../lib/matchWeather.js';
import {
  SoccerBallIcon,
  StadiumIconSvg,
  ActivityIcon,
  LightningIcon,
  SunIcon,
  CloudRainIcon,
  FlameIcon,
  BrainIcon,
  SquadIcon,
  CheckIcon,
  AlertTriangleIcon,
  SponsorsIcon,
  ContractsIcon,
  TrainingIcon,
  AcademyIcon,
  StaffIcon,
  StaffRoleIcon,
  TacticsIcon,
} from '../components/icons/AppIcons.js';

type LeagueWithStandings = League & { standings: { clubId: string; played: number; wins: number; draws: number; losses: number; points: number }[] };

const NEWS_CATEGORY_LABEL: Record<NewsCategory, string> = {
  MATCH_RESULT: 'Resultado',
  MANAGER: 'Comando',
  GOAL_STREAK: 'Destaque',
  INJURY: 'Lesão',
  SUSPENSION: 'Suspensão',
  TRANSFER_IN: 'Contratação',
  TRANSFER_OUT: 'Saída',
  CONTRACT: 'Contrato',
  TITLE: 'Título',
  PROMOTION: 'Acesso',
  RELEGATION: 'Rebaixamento',
  NATIONAL_TEAM: 'Seleção',
};

function formatNewsDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Repeats of the same category collapse into one row ("Lesões (3)") that expands on click, so a bad week
 *  of injuries reads as a summary instead of three near-identical lines pushing everything else off. */
function groupNews(items: NewsItem[]): { category: NewsCategory; items: NewsItem[] }[] {
  const groups: { category: NewsCategory; items: NewsItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.category === item.category) last.items.push(item);
    else groups.push({ category: item.category, items: [item] });
  }
  return groups;
}

const NEWS_GROUP_LABEL: Partial<Record<NewsCategory, string>> = {
  INJURY: 'Lesões',
  SUSPENSION: 'Suspensões',
  MATCH_RESULT: 'Resultados',
  TRANSFER_IN: 'Contratações',
  TRANSFER_OUT: 'Saídas',
  GOAL_STREAK: 'Destaques',
  TITLE: 'Títulos',
  PROMOTION: 'Acessos',
  RELEGATION: 'Rebaixamentos',
};

export function quickOpponentScout(opponent: Club, standing?: LeagueWithStandings['standings'][number]) {
  const standout = opponent.players.reduce<(typeof opponent.players)[number] | null>(
    (best, player) => (!best || player.overall > best.overall ? player : best),
    null,
  );
  const averageOverall = opponent.players.length
    ? Math.round(opponent.players.reduce((sum, player) => sum + player.overall, 0) / opponent.players.length)
    : 0;
  return {
    averageOverall,
    standout,
    record: standing ? `${standing.wins}V · ${standing.draws}E · ${standing.losses}D` : 'Sem dados na liga',
  };
}

/**
 * Club home dashboard — the game's landing screen (see Login/Start): team identity + league position
 * + next fixture at a glance, the starting XI on a mini pitch, and the finance snapshot, each with a
 * link onward to its full screen. Replaces the old menu-grid hub now that Squad/Finance/etc. are one
 * click away from here instead of being the only way in.
 */
export function ClubHomePage() {
  const { playCutscene } = useCutscene();
  const { isBrasfoot, toggleViewMode } = useViewMode();
  // A data corrente, para o teto de um cartão de reunião por dia de jogo.
  const gameState = useGameDate();

  /**
   * O aviso do presidente aparece uma vez, e o "uma vez" mora aqui.
   *
   * O servidor grava que o aviso foi dado e nunca o retira, porque é ele que autoriza a demissão depois. Se
   * a tela lesse só esse campo, o cartão voltaria a cada visita para sempre. Guardar o que já foi visto é
   * preferência de quem joga, não estado do mundo, e por isso fica no armazenamento local — a mesma escolha
   * que os adiamentos de reunião já fazem.
   */
  const CHAVE_AVISO = 'tactical_arena_aviso_presidente_v1';
  function avisosVistos(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_AVISO) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  /** A melhor proposta de patrocínio na mesa, buscada só quando há vaga para preencher. */
  const [melhorProposta, setMelhorProposta] = useState(0);

  /** O treinador deste clube e a confiança da diretoria nele, para o presidente ter o que dizer. */
  const [treinador, setTreinador] = useState<ManagerView | null>(null);

  /** Clubes que sondaram o técnico. Faixa discreta, e não reunião: é convite, não cobrança. */
  const [sondagens, setSondagens] = useState<ApproachView[]>([]);
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);

  /**
   * A melhor proposta de patrocínio na mesa, buscada só quando há vaga aberta.
   *
   * Fica aqui em cima, e não junto do resto da lógica lá embaixo, porque abaixo existe um `return`
   * antecipado enquanto o clube carrega. Um hook depois dele roda em alguns renders e não em outros, e o
   * React derruba a tela inteira com "rendered more hooks than during the previous render" — foi
   * exatamente o que aconteceu na primeira tentativa.
   */
  useEffect(() => {
    const vagas = MAX_SPONSORSHIPS - (club?.sponsorships?.length ?? 0);
    if (!club || vagas <= 0) {
      setMelhorProposta(0);
      return;
    }
    // Falhar aqui não pode custar a tela: sem número, o assunto simplesmente não vira reunião.
    getSponsorshipOffers(club.id)
      .then((ofertas: Sponsorship[]) => {
        const ativos = new Set(club.sponsorships.map((c) => c.type));
        const livres = ofertas.filter((o: Sponsorship) => !ativos.has(o.type));
        setMelhorProposta(livres.reduce((maior: number, o: Sponsorship) => Math.max(maior, o.weeklyAmount), 0));
      })
      .catch(() => setMelhorProposta(0));
  }, [club?.id, club?.sponsorships?.length]);

  // Falhar aqui também não pode custar a tela: offline a rota não existe, e o clube continua a abrir.
  useEffect(() => {
    if (!club?.id) return;
    getClubManager(club.id)
      .then(setTreinador)
      .catch(() => setTreinador(null));
    getApproaches()
      .then(setSondagens)
      .catch(() => setSondagens([]));
  }, [club?.id]);
  const [league, setLeague] = useState<LeagueWithStandings | null>(null);
  const [opponent, setOpponent] = useState<Club | null>(null);
  /** The very next thing this club plays, whichever competition it belongs to. */
  const [nextEntry, setNextEntry] = useState<CalendarEntry | null>(null);
  /**
   * Os jogos logo depois do próximo.
   *
   * O hero já anuncia a partida de sábado. O que faltava era o que vem na sequência: uma sexta seguida de
   * meio de semana de copa muda o que se decide hoje no treino e na escalação, e isso não aparecia em
   * lugar nenhum sem abrir o calendário inteiro.
   */
  const [upcoming, setUpcoming] = useState<CalendarEntry[]>([]);
  const [defaultPreset, setDefaultPreset] = useState<TacticPreset | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [form, setForm] = useState<FormResult[]>([]);
  const [proposalCount, setProposalCount] = useState(0);
  const [scoutClubs, setScoutClubs] = useState<any[]>([]);
  const [openNewsGroup, setOpenNewsGroup] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [magicResolving, setMagicResolving] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const clubColor = useClubColor(club);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [clubData, presets, newsData, formData, proposals, scoutData] = await Promise.all([
          getClub(clubId),
          listTacticPresets(clubId),
          getClubNews(clubId),
          getClubForm(clubId).catch(() => [] as FormResult[]),
          listTransferProposals(clubId).catch(() => []),
          listScoutingDatabase().catch(() => []),
        ]);
        if (cancelled) return;
        setClub(clubData);
        const contractKey = `cutscene_first_contract_${clubId}`;
        if (!localStorage.getItem(contractKey)) {
          localStorage.setItem(contractKey, 'true');
          playCutscene({
            type: 'primeiro-contrato',
            club: clubData,
            data: { managerName: 'Treinador', salary: 150000 }
          });
        }
        setDefaultPreset(presets.find((p) => p.isDefault) ?? null);
        setNews(newsData);
        setForm(formData);
        setScoutClubs(scoutData);
        // Only offers where *we* are the seller need a decision — the ones we sent are already ours.
        setProposalCount(proposals.filter((p) => p.sellerClubId === clubId && p.status === 'PENDING').length);

        const mine = await getActiveLeague(clubId).catch(() => null);
        if (mine) {
          const full = (await getLeague(mine.id).catch(() => null)) as LeagueWithStandings | null;
          if (full && !cancelled) setLeague(full);
        }

        const calendar = await getClubCalendar(clubId).catch(() => null);
        const pending = (calendar?.entries ?? []).filter((entry: CalendarEntry) => !entry.result && !entry.matchId);
        const next = pending[0] ?? null;
        if (!cancelled) {
          setNextEntry(next);
          setUpcoming(pending.slice(1, 5));
          if (next) {
            const opponentClub = await getClub(next.opponentClubId).catch(() => null);
            if (!cancelled) setOpponent(opponentClub);
          }
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
              navigate(`/clubs/${myClubs[0].id}`, { replace: true });
              return;
            }
            const savesRes = await listSaves().catch(() => null);
            if (savesRes && savesRes.saves.length > 0) {
              const current = savesRes.saves.find((s: any) => s.id === savesRes.currentSaveId) ?? savesRes.saves[0];
              if (current) {
                const loaded = await loadSave(current.id).catch(() => null);
                const recoveredId = loaded?.claimedClubId || loaded?.save?.clubId;
                if (recoveredId && recoveredId !== clubId) {
                  navigate(`/clubs/${recoveredId}`, { replace: true });
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

  if (loading) return <div className="page">Carregando...</div>;
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

  const standingIndex = league?.standings.findIndex((s) => s.clubId === club.id) ?? -1;
  const standingRow = standingIndex >= 0 ? league!.standings[standingIndex] : null;

  const isHome = nextEntry?.isHome ?? false;

  const lineupTactic = club.pendingRoundTactic ?? defaultPreset;

  // Where the club sits now drives how full the ground gets, so the finance figures and the crowd on the
  // attendance card are the same number rather than two guesses that disagree (see calculateAttendanceRate).
  const attendanceInputs = {
    stadiumCapacity: club.stadiumCapacity,
    leaguePosition: standingIndex >= 0 ? standingIndex + 1 : null,
    totalClubsInLeague: league?.clubIds.length ?? 0,
    titlesWon: club.titlesWon,
    matchesPlayed: standingRow?.played ?? 0,
  };
  const attendance = calculateAttendance(attendanceInputs);
  const { income: weeklyIncome, expense: weeklyExpense } = weeklyCashFlow(club, calculateAttendanceRate(attendanceInputs));

  const briefing: BriefingContext = {
    incomingProposals: proposalCount,
    hasLineup: !!lineupTactic,
    weeklyNet: weeklyIncome - weeklyExpense,
  };

  const alerts = clubAlerts(club, briefing);
  const advice = clubAdvice(club, briefing);


  // Season shape: how far through the fixture list, and what the board is expecting.
  const totalRounds = league ? Math.max(...league.fixtures.map((f) => f.round), 0) : 0;
  const currentRound = league
    ? Math.min(totalRounds, (league.fixtures.filter((f) => f.matchId === null && !f.result).sort((a, b) => a.round - b.round)[0]?.round ?? totalRounds))
    : 0;

  /**
   * O momento, para a sala de reuniões decidir se vale interromper.
   *
   * A tela do clube é a pausa natural: o técnico chegou, ainda não começou nada, e é aqui que um
   * profissional o pararia no corredor. Nunca no meio da escalação, nunca durante a partida.
   *
   * As propostas de patrocínio só são buscadas quando há vaga aberta, que é a única situação em que a
   * regra pode disparar. Sem isso o assunto nunca chegaria a existir, e eu tinha deixado exatamente esse
   * buraco: a condição pedia dinheiro concreto na mesa e ninguém ia buscar o número.
   */
  const diasAteJogo = (() => {
    if (!nextEntry?.date || !gameState?.currentDate) return 99;
    const dia = (iso: string) => {
      const [ano, mes, d] = iso.split('-').map(Number);
      return Date.UTC(ano, mes - 1, d) / 86_400_000;
    };
    return Math.max(0, Math.round(dia(nextEntry.date) - dia(gameState.currentDate)));
  })();

  const meetingContext: MeetingContext = {
    hasLineup: !!lineupTactic,
    daysToNextMatch: diasAteJogo,
    // A rodada serve de relógio das semanas, que é o que os adiamentos contam.
    currentWeek: Math.max(1, currentRound || 1),
    academyReady: (club.academyPlayers ?? []).filter((p) => p.age >= 18).length,
    bestSponsorUpgrade: melhorProposta,
    /**
     * Contrato a vencer, contado com a mesma função que a tela de contratos usa.
     *
     * O limite é uma temporada restante e não zero de propósito: avisar quando já venceu é avisar tarde,
     * porque a essa altura o jogador já sabe que sai de graça e o preço de renovar subiu.
     */
    expiringContracts: gameState
      ? club.players.filter((p) => seasonsRemaining(p, gameState.seasonYear) <= 1).length
      : 0,
    boardConfidence: treinador?.confidence,
    boardConcern: treinador?.confidenceReason ?? undefined,
    /**
     * Quem decide avisar é o servidor, no tick semanal, e não esta tela.
     *
     * A tela poderia comparar a nota com o piso e chegar sozinha à mesma conclusão — e aí haveria duas
     * regras de quando o presidente aparece, que divergiriam no dia em que uma delas mudasse. O `warnings`
     * gravado é a decisão já tomada; aqui só se pergunta se ela é desta semana.
     */
    boardWarning: (treinador?.warnings ?? 0) > (avisosVistos()[club.id] ?? 0),
    boardWarningCount: treinador?.warnings ?? 0,
  };
  const totalClubs = league?.clubIds.length ?? 0;
  const playedRounds = standingRow?.played ?? 0;
  // Squad strength relative to the division decides what the board asks for — see seasonObjective.
  const squadRank = league
    ? [...league.standings].sort((a, b) => b.points - a.points).findIndex((s) => s.clubId === club.id) + 1 || totalClubs
    : 0;
  const objective = league && totalClubs > 1
    ? seasonObjective(squadRank, totalClubs, standingIndex >= 0 ? standingIndex + 1 : null, playedRounds, totalRounds)
    : null;

  const opponentPosition = opponent && league ? league.standings.findIndex((s) => s.clubId === opponent.id) + 1 : 0;
  const opponentStanding = opponent && league ? league.standings.find((s) => s.clubId === opponent.id) : undefined;
  const opponentScout = opponent ? quickOpponentScout(opponent, opponentStanding) : null;

  const lineupSlots = lineupTactic?.lineup ?? [];
  const starterCount = lineupSlots.filter((slot) => Boolean(slot?.playerId)).length;
  const starterPlayers = lineupSlots
    .map((slot) => club.players.find((p) => p.id === slot.playerId))
    .filter(Boolean);

  const unavailableStarters = starterPlayers.filter(
    (p) => (p?.injuryWeeks ?? 0) > 0 || (p?.suspensions?.length ?? 0) > 0,
  );
  const hasUnavailableStarters = unavailableStarters.length > 0;
  const isLineupReady = starterCount === 11 && !hasUnavailableStarters;
  const presetMode = club.staffDelegationConfig?.presetMode ?? 'brasfoot_casual';
  const isArcadeMode = presetMode === 'brasfoot_casual';
  const newsGroups = groupNews(news);

  /**
   * ⚡ Ação Mágica do Dia de Jogo:
   * Resolve todas as pendências pela comissão técnica e avança direto para a partida ao vivo em 1 clique.
   */
  async function handleMagicMatchdayAction() {
    if (!club || magicResolving) return;
    setMagicResolving(true);
    try {
      // 1. Auxiliar Técnico escala os melhores disponíveis mantendo a formação
      const formation = lineupTactic?.formation ?? '4-4-2';
      const autoTactic = autoFillLineup(club, nextEntry?.competitionId ?? null, formation);
      await setRoundTactic(club.id, autoTactic);
      const preset = await saveTacticPreset(club.id, `Padrão (${formation})`, autoTactic).catch(() => null);
      if (preset?.id) {
        await setDefaultTacticPreset(club.id, preset.id).catch(() => {});
      }

      // 2. Diretor de Futebol resolve renovações emergenciais se houver saldo
      const currentSeason = gameState?.seasonYear ?? 2026;
      const analysis = identifyExpiringContracts(club, 10, currentSeason);
      if (
        analysis.recommendedBatchPlayerIds.length > 0 &&
        club.budget >= analysis.totalBatchCost &&
        club.staffDelegationConfig?.contractRenewals !== 'manual'
      ) {
        await batchRenewContracts(club.id, analysis.recommendedBatchPlayerIds, { years: 2 }).catch(() => {});
      }

      // 3. Auxiliar conduz preleção automática se delegada
      if (club.staffDelegationConfig?.delegateTeamTalks !== false) {
        const isDerby = Boolean(
          nextEntry?.stageName &&
            (nextEntry.stageName.includes('Final') || nextEntry.stageName.includes('Decisão')),
        );
        const rec = getRecommendedTeamTalk('PRE_MATCH', 0, isDerby);
        await applyTeamTalk(club.id, rec.id, 'PRE_MATCH', 0).catch(() => {});
      }

      // 4. Vai direto para o apito inicial!
      const matchId = await goToMatchday(club.id);
      if (matchId) {
        resetScrollToTop('instant');
        navigate(`/match/${matchId}/live`);
        return;
      }
      navigate(`/clubs/${club.id}`);
    } catch (err) {
      alert(`Erro na preparação automática: ${(err as Error).message}`);
    } finally {
      setMagicResolving(false);
    }
  }

  function handleGoToMatch() {
    if (!club) return;
    resetScrollToTop('instant');
    navigate(`/clubs/${club.id}/briefing`);
  }

  async function handleDirectorQuickOffer(rec: DirectorTransferRecommendation) {
    if (!club) return;
    try {
      const res = await createTransferProposal({
        buyerClubId: club.id,
        sellerClubId: rec.sellerClubId,
        targetPlayerId: rec.player.id,
        cashAmount: rec.suggestedOfferPrice,
        installments: 1,
        offeredPlayerIds: [],
        hasBankGuarantee: true,
      });
      if (res.status === 'ACCEPTED') {
        const updated = await getClub(club.id);
        setClub(updated);
      }
    } catch {
      // ignore
    }
  }

  async function handleBatchRenew(playerIds: string[], yearsMap: Record<string, number>) {
    if (!club || playerIds.length === 0) return;
    try {
      const res = await batchRenewContracts(club.id, playerIds, { years: 2, yearsMap });
      setClub(res.club);
    } catch {
      // ignore
    }
  }

  const avgFatigue = club.players.length > 0 ? Math.round(club.players.reduce((sum, p) => sum + p.fatigue, 0) / club.players.length) : 0;
  const avgStamina = Math.max(10, 100 - avgFatigue);
  const avgMorale = club.players.length > 0 ? Math.round(club.players.reduce((sum, p) => sum + p.morale, 0) / club.players.length) : 80;
  const moraleText = avgMorale >= 80 ? 'Excelente' : avgMorale >= 60 ? 'Alta' : avgMorale >= 40 ? 'Regular' : 'Baixa';
  const unavailablePlayerCount = club.players.filter(
    (player) => (player.injuryWeeks ?? 0) > 0 || (player.suspensions?.length ?? 0) > 0,
  ).length;
  /*
   * O tempo de verdade, o mesmo que a partida vai aplicar.
   *
   * Esta linha dizia "Gramado Molhado" a cada terceira rodada e não movia uma bola do jogo: o tipo
   * `MatchWeather` existia na entrada do motor e ninguém preenchia nem lia. Um dado decorativo que se
   * parece com informação é pior que nenhum, porque ensina o jogador que os números da tela não valem.
   * Agora vale: ver weather.ts e a preleção, onde ele também aparece explicado.
   */
  const weather = weatherOfEntry(nextEntry, club.id, isHome ? club.country : opponent?.country);
  // Reads from the calendar entry, so a cup tie announces itself as one instead of borrowing the league's name.
  const competitionName = nextEntry?.competitionName ?? league?.name ?? 'Campeonato';
  const roundLabel = nextEntry?.stageName ?? (nextEntry ? `Rodada ${nextEntry.round}` : '');
  const matchdayLabel = nextEntry ? `${roundLabel} • ${competitionName}` : 'Próxima Partida';

  const matchDate = nextEntry?.date ?? gameState?.currentDate;
  const matchMonth = matchDate ? Number(matchDate.slice(5, 7)) : 1;
  const isQuarter1 = matchMonth >= 1 && matchMonth <= 3;
  const periodLabel = isQuarter1 ? '1º Trimestre (Jan-Mar): Campeonato Estadual' : 'Temporada Nacional (Abr-Dez): Brasileirão & Copa do Brasil';

  return (
    <div
      className="page club-home"
      // Everything gold on the dashboard reads from this, so a club themes itself without touching any
      // other rule (see crestColor.ts). Unset falls through to the global --accent.
      style={clubColor ? ({ ['--club-accent' as string]: clubColor } as React.CSSProperties) : undefined}
    >
      <ClubNav club={club} active="home" onClubUpdate={(u) => setClub(u)} />

      {error && <p className="error">{error}</p>}

      {/* Matchday Focus Hero Card (Compact Broadcast Strip) */}
      {nextEntry && opponent && (
        <>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(36, 32, 44, 0.6)', padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>Calendário Ativo:</span>
            <span className="badge-pill-neutral" style={{ fontSize: '0.75rem', background: isQuarter1 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)', color: isQuarter1 ? '#fbbf24' : '#38bdf8' }}>
              {periodLabel}
            </span>
          </div>
          <section className="matchday-hero-compact">
          <div className="matchday-compact-main">
            <div className="matchday-compact-header">
              {competitionLogo(competitionName) && (
                <img
                  src={competitionLogo(competitionName)!}
                  alt={competitionName}
                  className="matchday-comp-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <span className="matchday-compact-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <SoccerBallIcon size={14} />
                <span>{matchdayLabel}</span>
              </span>
              <span className="matchday-compact-venue" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <StadiumIconSvg size={14} />
                <span>{isHome ? `Estádio do ${club.name} (Mando de Campo)` : `Estádio do ${opponent.name} (Visitante)`}</span>
              </span>
            </div>

            <div className="matchday-compact-matchup">
              <div className="matchday-compact-team home">
                <ClubCrest club={isHome ? club : opponent} size={36} />
                <span className="matchday-compact-name">{isHome ? club.name : opponent.name}</span>
                <span className="matchday-compact-pos">{isHome ? `${standingIndex + 1}º` : `${opponentPosition}º`}</span>
              </div>

              <div className="matchday-compact-vs">VS</div>

              <div className="matchday-compact-team away">
                <span className="matchday-compact-pos">{isHome ? `${opponentPosition}º` : `${standingIndex + 1}º`}</span>
                <span className="matchday-compact-name">{isHome ? opponent.name : club.name}</span>
                <ClubCrest club={isHome ? opponent : club} size={36} />
              </div>
            </div>

            <div className="matchday-compact-vitals">
              <span className="matchday-vital-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ActivityIcon size={13} color="#10b981" /> Físico: <strong className={avgStamina >= 80 ? 'metric-success' : ''}>{avgStamina}%</strong>
              </span>
              <span className="matchday-vital-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <BrainIcon size={12} color="#c084fc" /> Moral: <strong className={avgMorale >= 60 ? 'metric-success' : ''}>{moraleText}</strong>
              </span>
              <span className="matchday-vital-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {weather === 'DRY' && <SunIcon size={12} color="#fbbf24" />}
                {weather === 'RAIN' && <CloudRainIcon size={12} color="#60a5fa" />}
                {weather === 'HOT' && <FlameIcon size={12} color="#f97316" />}
                <strong>{WEATHER_LABEL[weather]}</strong>
              </span>
              <span className="matchday-vital-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <SquadIcon size={12} color="#38bdf8" /> Público: <strong>{(attendance ?? 0).toLocaleString('pt-BR')}</strong>
              </span>
            </div>

            {/*
              A escalação era um campo desenhado no meio da tela inicial, editável por arraste, duplicando
              a prancheta. Aqui ela é o que o dia de jogo precisa dizer: está pronta ou não está, e o
              caminho para resolver. Mexer nos onze é na prancheta, que existe para isso.
            */}
            <div className="matchday-compact-lineup">
              {hasUnavailableStarters ? (
                <span className="matchday-lineup-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#f87171' }}>
                  <AlertTriangleIcon size={14} color="#f87171" />
                  <span>
                    {unavailableStarters.length} desfalque(s) no time titular ({unavailableStarters.map((p) => p?.name).join(', ')})
                  </span>
                </span>
              ) : starterCount === 11 ? (
                <span className="matchday-lineup-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <CheckIcon size={14} color="#4ade80" /> Escalado em <strong>{lineupTactic?.formation ?? '4-4-2'}</strong>
                </span>
              ) : (
                <span className="matchday-lineup-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <AlertTriangleIcon size={14} color="#f59e0b" /> {starterCount} de 11 titulares definidos
                </span>
              )}
              <Link className="matchday-lineup-link" to={`/clubs/${club.id}/tactics`}>
                {isLineupReady ? 'Mudar escalação' : 'Montar na prancheta'}
              </Link>
            </div>
          </div>

          <div className="matchday-compact-action" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {isArcadeMode ? (
              // MODO ARCADE / ELIFOOT: Ação 1-Clique Mágica Direta
              <>
                <button
                  type="button"
                  className="matchday-compact-cta"
                  onClick={handleMagicMatchdayAction}
                  disabled={magicResolving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderColor: '#34d399',
                    boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)',
                  }}
                  title="Auxiliar Técnico escala o melhor time, aplica preleção e inicia a partida em 1 clique"
                >
                  <SoccerBallIcon size={16} />
                  <span>{magicResolving ? 'Preparando...' : `JOGAR PARTIDA (${roundLabel})`}</span>
                </button>
                <Link
                  to={`/clubs/${club.id}/briefing`}
                  className="btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  title="Conferir dossiê do adversário e preleção"
                >
                  Pré-Jogo
                </Link>
              </>
            ) : !isLineupReady ? (
              // MODO GESTOR COM DESFALQUE: Botão Mágico em Destaque para não travar o jogador!
              <>
                <button
                  type="button"
                  className="matchday-compact-cta"
                  onClick={handleMagicMatchdayAction}
                  disabled={magicResolving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                    borderColor: '#c084fc',
                    boxShadow: '0 0 16px rgba(168, 85, 247, 0.4)',
                  }}
                  title="Auxiliar Técnico substitui os desfalques pelos melhores reservas e vai direto para o jogo"
                >
                  <StaffIcon size={16} color="#fbbf24" />
                  <span>{magicResolving ? 'Preparando...' : 'RESOLVER COM A COMISSÃO & JOGAR'}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleGoToMatch}
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                >
                  Ver Pré-Jogo
                </button>
              </>
            ) : (
              // MODO NORMAL COM TIME PRONTO: Ir para a partida + Atalho de Otimizar opcional
              <>
                <button
                  type="button"
                  className="matchday-compact-cta"
                  onClick={handleGoToMatch}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <SoccerBallIcon size={16} />
                  <span>{`IR PARA A PARTIDA (${roundLabel})`}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleMagicMatchdayAction}
                  disabled={magicResolving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  title="O Auxiliar Técnico revisa a forma física e escala o melhor time titular disponível"
                >
                  <TacticsIcon size={14} color="#fbbf24" />
                  <span>Auto-Otimizar 1-Clique</span>
                </button>
              </>
            )}
            <FastAdvanceButton clubId={club.id} className="btn-secondary" />
          </div>

        </section>
        </>
      )}

      <div className="home-grid">
        <div className="home-col">

          <section className="card">
            {/*
              O card mostrava a posição e parava aí: a tabela completa existe, em /league/:id, e não tinha
              nenhum link vivo saindo das telas do clube. Um técnico abre a tabela toda semana.
            */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Classificação</h3>
              {league && (
                <Link to={`/league/${league.id}`} className="link-see-more">
                  Ver tabela completa
                </Link>
              )}
            </div>
            {standingRow ? (
              <div className="mini-standing">
                <div>
                  <span className="muted">Pos.</span>
                  <strong>{standingIndex + 1}º</strong>
                </div>
                <div>
                  <span className="muted">Pts</span>
                  <strong>{standingRow.points}</strong>
                </div>
                <div>
                  <span className="muted">J</span>
                  <strong>{standingRow.played}</strong>
                </div>
                <div>
                  <span className="muted">V</span>
                  <strong>{standingRow.wins}</strong>
                </div>
                <div>
                  <span className="muted">E</span>
                  <strong>{standingRow.draws}</strong>
                </div>
                <div>
                  <span className="muted">D</span>
                  <strong>{standingRow.losses}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">Ainda sem liga associada.</p>
            )}

            {form.length > 0 && (
              <div className="form-strip" title="Últimos 5 jogos, do mais antigo para o mais recente">
                <span className="muted">Últimos jogos</span>
                <span className="form-pills">
                  {form.map((r, i) => (
                    <span key={i} className={`form-pill form-${r}`}>
                      {r}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </section>

          {league && totalRounds > 0 && (
            <section className="card">
              <h3>Progresso da Temporada</h3>
              <p className="muted">
                Rodada {currentRound} de {totalRounds} ({Math.round((currentRound / totalRounds) * 100)}%)
              </p>
              <div className="attendance-bar" title={`Rodada ${currentRound} de ${totalRounds}`}>
                <div className="attendance-bar-fill" style={{ width: `${Math.round((currentRound / totalRounds) * 100)}%` }} />
              </div>
              {objective && (
                <>
                  <p className="objective-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px' }}>
                    <span>
                      <strong>Meta:</strong> {objective.label}
                    </span>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: objective.onTrack ? '#4caf50' : 'var(--muted)' }}>
                      {Math.round(objective.progress * 100)}%
                      {objective.met && <span className="objective-met"> ✓ Concluído</span>}
                      {!objective.met && objective.onTrack && <span style={{ marginLeft: '4px' }}>● No caminho</span>}
                    </span>
                  </p>
                  <div className="attendance-bar" title={`Progresso da Meta: ${Math.round(objective.progress * 100)}%`}>
                    <div
                      className={`attendance-bar-fill${objective.onTrack ? ' objective-on-track' : ''}`}
                      style={{ width: `${Math.max(objective.progress > 0 ? 4 : 0, Math.round(objective.progress * 100))}%` }}
                    />
                  </div>
                </>
              )}
            </section>
          )}

          {/* Card Oficial: Central de Notificacoes & Alertas da Diretoria */}
          <section className="card notification-board-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: (alerts.length > 0 || sondagens.length > 0)
                      ? (alerts.some((a) => a.severity === 'urgent') ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)')
                      : 'rgba(34, 197, 94, 0.2)',
                    border: `1.5px solid ${(alerts.length > 0 || sondagens.length > 0)
                      ? (alerts.some((a) => a.severity === 'urgent') ? '#ef4444' : '#f59e0b')
                      : '#22c55e'}`,
                    color: (alerts.length > 0 || sondagens.length > 0)
                      ? (alerts.some((a) => a.severity === 'urgent') ? '#ef4444' : '#f59e0b')
                      : '#4ade80',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.8rem',
                  }}
                >
                  {(alerts.length > 0 || sondagens.length > 0) ? '!' : '✓'}
                </div>
                <h3 style={{ margin: 0, fontSize: '0.96rem' }}>Central de Notificações</h3>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: (alerts.length + sondagens.length > 0) ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                  color: (alerts.length + sondagens.length > 0) ? '#fbbf24' : '#4ade80',
                  border: `1px solid ${(alerts.length + sondagens.length > 0) ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                }}
              >
                {alerts.length + sondagens.length} {alerts.length + sondagens.length === 1 ? 'pendência' : 'pendências'}
              </span>
            </div>

            {alerts.length === 0 && sondagens.length === 0 ? (
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 8, textAlign: 'center' }}>
                <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                  Nenhum aviso pendente. O clube e o elenco estão em ordem para a rodada.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map((al, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 12px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ color: al.severity === 'urgent' ? '#ef4444' : '#f59e0b', fontWeight: 900, flexShrink: 0 }}>
                        !
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {al.message}
                      </span>
                    </div>
                    <Link
                      to={`/clubs/${club.id}/${al.actionPath}`}
                      className="btn-primary"
                      style={{
                        fontSize: '0.72rem',
                        padding: '4px 8px',
                        textDecoration: 'none',
                        flexShrink: 0,
                        fontWeight: 700,
                      }}
                    >
                      {al.actionLabel}
                    </Link>
                  </div>
                ))}
                {sondagens.map((s, idx) => (
                  <div
                    key={`s-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 12px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ color: '#38bdf8', fontWeight: 900, flexShrink: 0 }}>!</span>
                      <span style={{ fontSize: '0.8rem', color: '#f8fafc' }}>
                        Sondagem: {s.clubName}
                      </span>
                    </div>
                    <Link
                      to="/career"
                      className="btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '4px 8px', textDecoration: 'none', flexShrink: 0 }}
                    >
                      Ver
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Card: Olheiro rápido */}
          {!isBrasfoot && opponent && opponentScout && (
            <section className="card scout-card">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <h3 style={{ margin: 0 }}>Olheiro rápido</h3>
                <span className="muted">{opponent.name}</span>
              </div>
              <div className="mini-standing" style={{ marginTop: 12 }}>
                <div>
                  <span className="muted">Força média</span>
                  <strong>{opponentScout.averageOverall} OVR</strong>
                </div>
                <div>
                  <span className="muted">Retrospecto</span>
                  <strong>{opponentScout.record}</strong>
                </div>
                <div>
                  <span className="muted">Destaque</span>
                  <strong>{opponentScout.standout ? `${opponentScout.standout.name} (${opponentScout.standout.overall})` : '—'}</strong>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <Link className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 48 }} to={`/clubs/${club.id}/tactics`}>
                  <TacticsIcon size={16} style={{ marginRight: 6 }} /> Preparar plano de jogo
                </Link>
              </div>
            </section>
          )}

          {/* Over here rather than in the money column: it balances the two flanks at three cards each,
              and keeps "Saldo em conta" directly above "Próxima Partida" on the right, which is the
              adjacency that card was asked for in the first place. */}
          {!isBrasfoot && (
            <section className="card">
              <h3>Notícias do Clube</h3>
              {news.length === 0 ? (
                <p className="muted">Nenhuma notícia ainda. Jogue uma partida para começar.</p>
              ) : (
                <ul className="club-news-list">
                  {/*
                    Três blocos, não a temporada inteira. O que aconteceu é contexto; esta tela existe para
                    o que vem a seguir, e a lista completa rolava mais que o dia de jogo.
                  */}
                  {newsGroups.slice(0, 3).map((group, gi) => {
                    const solo = group.items.length === 1;
                    const open = solo || openNewsGroup === gi;
                    const cls = `club-news-item club-news-${group.category.toLowerCase()}`;
                    return (
                      <li key={gi} className={cls}>
                        {solo ? (
                          <>
                            <span className="club-news-category">{NEWS_CATEGORY_LABEL[group.category]}</span>
                            <p>{group.items[0].headline}</p>
                            <span className="club-news-date">{formatNewsDate(group.items[0].createdAt)}</span>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="club-news-group-toggle"
                              onClick={() => setOpenNewsGroup(open ? null : gi)}
                              aria-expanded={open}
                            >
                              <span className="club-news-category">
                                {NEWS_GROUP_LABEL[group.category] ?? NEWS_CATEGORY_LABEL[group.category]} ({group.items.length})
                              </span>
                              <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                            </button>
                            {open &&
                              group.items.map((item) => (
                                <p key={item.id} className="club-news-grouped-line">
                                  {item.headline}
                                </p>
                              ))}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {!isBrasfoot && advice.length > 0 && (
            <section className="card">
              <h3>Recomendações</h3>
              {/*
                Every line here belongs to somebody on the comissão, and used to arrive unsigned. Naming them
                is the whole point: it is the only place in the game where the people the club pays for are
                visible doing their job. A vacant post still speaks, it just has no name and notices later.
              */}
              <ul className="advice-list">
                {advice.map((a, i) => (
                  <li key={i} className={`advice-item advice-${a.severity}`}>
                    {a.role && (
                      <span title={STAFF_ROLES_INFO[a.role].title} style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center' }}>
                        {a.staffName ? (
                          <StaffRoleIcon role={a.role} size={15} />
                        ) : (
                          <AlertTriangleIcon size={14} color="#fbbf24" />
                        )}
                      </span>
                    )}
                    {a.staffName ? (
                      <strong style={{ marginRight: 5 }}>{a.staffName}:</strong>
                    ) : (
                      a.role && (
                        <Link
                          to={`/clubs/${club.id}/staff`}
                          className="advice-vacancy-link"
                        >
                          Cargo vago:
                        </Link>
                      )
                    )}
                    {a.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ⚠️ Expiring Contracts Banner & Batch Automation */}
          <ExpiringContractsBanner
            isCompact
            club={club}
            currentSeason={gameState?.seasonYear ?? 2026}
            onBatchRenewConfirmed={handleBatchRenew}
          />

          {/* 🎯 Director of Football Scouting Recommendations */}
          {!isBrasfoot && scoutClubs.length > 0 && club.staffDelegationConfig?.scoutingAutomation !== 'manual' && (
            <DirectorRecommendationsCard
              isCompact
              club={club}
              availablePlayers={scoutClubs}
              onQuickOffer={handleDirectorQuickOffer}
              onCustomProposal={() => navigate(`/clubs/${club.id}/transfers?tab=scouting`)}
              onBuyout={() => navigate(`/clubs/${club.id}/transfers?tab=scouting`)}
            />
          )}
        </div>

        <div className="home-col">
          {/* Card 1: Cofre & Finanças */}
          <section className="card">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Cofre & Finanças</h3>
              <Link to={`/clubs/${club.id}/finance`} className="link-see-more">
                Extrato detalhado
              </Link>
            </div>
            <div className="mini-standing" style={{ marginTop: 12 }}>
              <div>
                <span className="muted">Saldo em Caixa</span>
                <strong className={club.budget < 0 ? 'metric-danger' : ''}>
                  {(club.budget ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                </strong>
              </div>
              <div>
                <span className="muted">Fluxo Semanal</span>
                <strong className={briefing.weeklyNet > 0 ? 'metric-success' : briefing.weeklyNet < 0 ? 'metric-danger' : ''}>
                  {briefing.weeklyNet > 0 ? '+' : ''}
                  {(briefing?.weeklyNet ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                </strong>
              </div>
              <div>
                <span className="muted">Patrocínios</span>
                <strong>{club.sponsorships?.length ?? 0}/{MAX_SPONSORSHIPS}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Link className="btn-secondary" style={{ flex: 1, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} to={`/clubs/${club.id}/sponsors`}>
                <SponsorsIcon size={15} />
                <span>Patrocínios</span>
              </Link>
              <Link className="btn-secondary" style={{ flex: 1, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} to={`/clubs/${club.id}/stadium`}>
                <StadiumIconSvg size={15} />
                <span>Estádio</span>
              </Link>
            </div>
          </section>

          {/* Card 2: Gestão do Elenco & Alertas */}
          <section className="card">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Gestão do Elenco</h3>
              <Link to={`/clubs/${club.id}/squad`} className="link-see-more">
                Ver todos ({club.players.length})
              </Link>
            </div>
            <div className="mini-standing" style={{ marginTop: 12 }}>
              <div>
                <span className="muted">Elenco</span>
                <strong>{club.players.length} atletas</strong>
              </div>
              <div>
                <span className="muted">Contratos a Vencer</span>
                <strong>{meetingContext?.expiringContracts ?? 0}</strong>
              </div>
              <div>
                <span className="muted">DM / Suspensos</span>
                <strong className={unavailablePlayerCount > 0 ? 'metric-danger' : ''}>
                  {unavailablePlayerCount}
                </strong>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
              {(meetingContext?.expiringContracts ?? 0) > 0 ? (
                <Link className="btn-secondary" style={{ textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} to={`/clubs/${club.id}/contracts`}>
                  <ContractsIcon size={15} />
                  <span>Contratos ({meetingContext?.expiringContracts})</span>
                </Link>
              ) : (
                <Link className="btn-secondary" style={{ textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} to={`/clubs/${club.id}/contracts`}>
                  <ContractsIcon size={15} />
                  <span>Contratos</span>
                </Link>
              )}
              <Link className="btn-secondary" style={{ textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} to={`/clubs/${club.id}/training`}>
                <TrainingIcon size={15} />
                <span>Treinamento</span>
              </Link>
              <Link className="btn-secondary" style={{ textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} to={`/clubs/${club.id}/academy`}>
                <AcademyIcon size={15} />
                <span>Categorias de Base</span>
              </Link>
              <Link className="btn-secondary" style={{ textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} to={`/clubs/${club.id}/staff`}>
                <StaffIcon size={15} />
                <span>Comissão & Diretores</span>
              </Link>
            </div>
          </section>

          {/* Card 3: Próximos compromissos */}
          <section className="card">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Próximos compromissos</h3>
              <Link to={`/clubs/${club.id}/agenda`} className="link-see-more">
                Calendário completo
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>
                {nextEntry ? 'Nenhum jogo marcado depois do próximo.' : 'O calendário é montado quando a competição começa.'}
              </p>
            ) : (
              <ul className="home-fixture-list" style={{ marginTop: 12 }}>
                {upcoming.map((entry, i) => (
                  <li key={`${entry.competitionName}-${entry.round}-${i}`} className="home-fixture-item">
                    <span className="home-fixture-date">{entry.date ? formatShortPtBr(entry.date) : 'a definir'}</span>
                    <span className="home-fixture-opponent">
                      <ClubCrest
                        club={{
                          id: entry.opponentClubId,
                          name: entry.opponentName,
                          slug: entry.opponentSlug ?? null,
                          crestBase64: entry.opponentCrestBase64 ?? null,
                          primaryColor: entry.opponentPrimaryColor ?? null,
                          secondaryColor: entry.opponentSecondaryColor ?? null,
                        } as Club}
                        size={20}
                      />
                      {entry.opponentName}
                    </span>
                    <span className="home-fixture-venue">{entry.isHome ? 'casa' : 'fora'}</span>
                    <span className="home-fixture-comp">{entry.competitionName}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Sobe de baixo, sem empurrar nada. As regras de silêncio vivem em staffMeetings. */}
      <MeetingCard club={club} context={meetingContext} gameDate={gameState?.currentDate ?? null} />
    </div>
  );
}
