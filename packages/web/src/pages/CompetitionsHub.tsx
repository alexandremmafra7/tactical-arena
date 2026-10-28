import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Club, Cup, League } from '@tactical-arena/shared';
import { getActiveLeague, getClub, getClubCalendar, listCups, type CalendarEntry } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubCard } from '../components/HubCard.js';
import { competitionsHubStatus } from '../lib/hubStatus.js';
import { WorldCompetitionsModal } from '../components/WorldCompetitionsModal.js';
import { ContinentalHubModal } from '../components/ContinentalHubModal.js';
import { TrophyIcon, GlobeIcon } from '../components/icons/AppIcons.js';

type LeagueWithStandings = League & { standings?: { clubId: string }[] };

/**
 * Hub de Competições.
 *
 * A tabela do campeonato e o chaveamento da copa sempre existiram, com tela pronta, e não apareciam em
 * menu nenhum: os únicos links vivos estavam no resumo de rodada e na tela antiga de escolher clube. Um
 * técnico olha a tabela toda semana, então ela precisa de porta.
 *
 * O calendário, que ocupava sozinho uma aba de primeiro nível, é o terceiro card daqui — é assunto de
 * competição, não um hub por si.
 */
export function CompetitionsHubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [league, setLeague] = useState<LeagueWithStandings | null>(null);
  const [cups, setCups] = useState<Cup[]>([]);
  const [nextEntry, setNextEntry] = useState<CalendarEntry | null>(null);
  const [showWorldModal, setShowWorldModal] = useState(false);
  const [showContinentalModal, setShowContinentalModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    (async () => {
      try {
        const clubData = await getClub(clubId);
        if (cancelled) return;
        setClub(clubData);

        // Tudo aqui é o que os cards dizem de si. Uma falha não pode derrubar o hub inteiro.
        const [activeLeague, allCups, calendar] = await Promise.all([
          getActiveLeague(clubId).catch(() => null),
          listCups().catch(() => [] as Cup[]),
          getClubCalendar(clubId).catch(() => null),
        ]);
        if (cancelled) return;
        setLeague(activeLeague);
        setCups(allCups.filter((c) => c.clubIds.includes(clubId)));
        setNextEntry((calendar?.entries ?? []).find((entry: CalendarEntry) => !entry.result && !entry.matchId) ?? null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  if (loading) return <div className="page">Carregando competições...</div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club) return null;

  const status = competitionsHubStatus(club, league, cups, nextEntry);

  return (
    <div className="page">
      <ClubNav club={club} active="competitions" />

      {/* Passo 11: Banner de Ligas e Copas do Mundo */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-inner flex-shrink-0">
            <GlobeIcon size={20} color="var(--accent, #f59e0b)" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <span>Ligas &amp; Copas Nacionais do Mundo</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold uppercase">
                Global
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Conheça as 10 ligas de elite, copas mata-mata, supercopas e distribuição de vagas continentais
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowWorldModal(true)}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20 flex items-center gap-1.5 flex-shrink-0"
        >
          <span>Explorar Mundo</span>
        </button>
      </div>

      <div className="hub-grid hub-grid-banners">
        <HubCard
          to={league ? `/league/${league.id}` : undefined}
          art="/cards/liga.webp"
          alt="Tabela do campeonato"
          status={status.league}
          disabledReason="Seu clube ainda não está em um campeonato"
        />

        {cups.length > 0 ? (
          cups.map((cup) => (
            <HubCard key={cup.id} to={`/cup/${cup.id}`} art="/cards/copa.webp" alt={cup.name} status={status[cup.id]} />
          ))
        ) : (
          <HubCard
            art="/cards/copa.webp"
            alt="Copa"
            disabledReason="Seu clube não está disputando copa nesta temporada"
          />
        )}

        <HubCard
          to={`/clubs/${club.id}/agenda`}
          art="/cards/calendario.webp"
          alt="Calendário da temporada"
          status={status.agenda}
        />
      </div>

      {/* Banner de Competições Continentais */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-600/10 via-slate-900 to-slate-900 border border-blue-500/30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shadow-inner flex-shrink-0">
            <TrophyIcon size={20} color="#fbbf24" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <span>Competições Continentais (Libertadores &amp; Sul-Americana)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold uppercase">
                Continental
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Acompanhe a fase de grupos, chaveamento de mata-mata, repescagem e premiações financeiras
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowContinentalModal(true)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/20 flex items-center gap-1.5 flex-shrink-0"
        >
          <span>Ver Torneios</span>
        </button>
      </div>

      <WorldCompetitionsModal isOpen={showWorldModal} onClose={() => setShowWorldModal(false)} />
      <ContinentalHubModal isOpen={showContinentalModal} onClose={() => setShowContinentalModal(false)} />
    </div>
  );
}
