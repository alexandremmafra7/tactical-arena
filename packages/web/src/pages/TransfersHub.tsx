import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import type {
  Club,
  DeadlineAuctionItem,
  DeadlineDayState,
  DirectorTransferRecommendation,
  NewsItem,
  Player,
  Sponsorship,
  TransferListing,
  TransferProposal,
} from '@tactical-arena/shared';
import {
  COUNTRIES,
  STAFF_ROLES_INFO,
  STAFF_TIER_CONFIG,
  autoShieldSquadReleaseClauses,
  calculateAdjustedWageForReleaseClause,
  calculateClubVisibility,
  calculateBankGuaranteeEligibility,
  getDirectorTransferDiscount,
  getPlayerTier,
  nextMinimumBid,
} from '@tactical-arena/shared';
import { positionLabel } from '../lib/positionLabel.js';
import { footLabel } from '../lib/footLabel.js';
import { CountryFlag } from '../components/CountryFlag.js';
import {
  acceptTransferProposal,
  advanceDeadlineDay,
  autoShieldSquadReleaseClauses as apiAutoShield,
  buyTransferListing,
  cancelTransferListing,
  createTransferProposal,
  getClub,
  getDeadlineDay,
  listPlayerForTransfer,
  listScoutingDatabase,
  listTransferListings,
  listTransferProposals,
  payReleaseClause,
  placeDeadlineDayBid,
  rejectTransferProposal,
  updatePlayerReleaseClause as apiUpdateReleaseClause,
  withdrawTransferProposal,
  getTransferNews,
} from '../api/client.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { ClubNav } from '../components/ClubNav.js';
import { SpecialPlayerBadge } from '../components/SpecialPlayerIcon.js';
import { SpecialPlayersLegendModal } from '../components/SpecialPlayersLegend.js';
import { DirectorRecommendationsCard } from '../components/DirectorRecommendationsCard.js';
import { PlayerComparisonModal } from '../components/PlayerComparisonModal.js';
import { useClubColor } from '../lib/useClubColor.js';
import {
  StarIcon,
  LightningIcon,
  ShieldIcon,
  UsersIcon,
  FinanceIcon,
  ChecklistIcon,
  AlertTriangleIcon,
  ClockIcon,
  TrophyIcon,
  BriefcaseIcon,
  SearchIcon,
  GlobeIcon,
  StoreIcon,
  MailIcon,
} from '../components/icons/AppIcons.js';

// A Comissão Técnica saiu daqui: ela é tela de Minha equipe, e ter aba própria neste hub fazia o mesmo
// assunto morar em dois lugares do menu.
type TabKey = 'scouting' | 'market' | 'proposals' | 'clauses' | 'deadline';
type ScoutSpecialFilter = 'ALL' | 'GENIO' | 'BAITA' | 'PROMISE' | 'AMBIDEXTROUS' | 'LEADER';
type ScoutSortBy = 'ovr_desc' | 'ovr_asc' | 'pot_desc' | 'val_desc' | 'val_asc' | 'age_asc' | 'name_asc';

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Badge for a player's display tier — gold "Gênio / Extraclasse" for the elite, cyan "Baita
 *  Jogador / Diferenciado" for the second tier. */
function TierBadge({ player }: { player: Player }) {
  const tier = getPlayerTier(player.overall, player.starLevel, player.diferenciado, player.age, player.potential, player.name);
  if (!tier) return null;
  return <SpecialPlayerBadge tier={tier} size="sm" />;
}

export function TransfersHubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabKey) || 'scouting';

  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tab 1: Scouting & Database Filters
  const [selectedCountry, setSelectedCountry] = useState('BRA');
  const [scoutClubs, setScoutClubs] = useState<Array<{ id: string; name: string; country: string; slug: string | null; players: Player[]; stadiumCapacity: number; titlesWon: number }>>([]);
  const [selectedScoutClubId, setSelectedScoutClubId] = useState<string | null>(null);
  
  // Advanced combinable filters
  const [scoutViewMode, setScoutViewMode] = useState<'explorer' | 'database'>('explorer');
  const [scoutSearchQuery, setScoutSearchQuery] = useState('');
  const [scoutRegionFilter, setScoutRegionFilter] = useState<'ALL' | 'EUROPE' | 'SOUTH_AMERICA' | 'BRA'>('ALL');
  const [scoutPosFilter, setScoutPosFilter] = useState('ALL');
  const [scoutSpecialFilter, setScoutSpecialFilter] = useState<ScoutSpecialFilter>('ALL');
  const [scoutFootFilter, setScoutFootFilter] = useState('ALL');
  const [scoutMinOvrFilter, setScoutMinOvrFilter] = useState('0');
  const [scoutMaxOvrFilter, setScoutMaxOvrFilter] = useState('99');
  const [scoutMinAgeFilter, setScoutMinAgeFilter] = useState('15');
  const [scoutMaxAgeFilter, setScoutMaxAgeFilter] = useState('45');
  const [scoutMaxPriceFilter, setScoutMaxPriceFilter] = useState('0');
  const [scoutSortBy, setScoutSortBy] = useState<ScoutSortBy>('ovr_desc');

  // Modals for hiring/proposal
  const [buyoutTarget, setBuyoutTarget] = useState<{ sellerClubId: string; sellerClubName: string; player: Player } | null>(null);
  const [proposalTarget, setProposalTarget] = useState<{ sellerClubId: string; sellerClubName: string; player: Player } | null>(null);
  const [proposalCash, setProposalCash] = useState('');
  const [proposalInstallments, setProposalInstallments] = useState('1');
  const [proposalOfferedIds, setProposalOfferedIds] = useState<string[]>([]);
  const [proposalHasBankGuarantee, setProposalHasBankGuarantee] = useState(true);

  // Tab 2: Market listings
  const [listings, setListings] = useState<TransferListing[]>([]);
  /**
   * As negociações fechadas no mundo.
   *
   * Isto morava num card do painel do clube, que é a tela de decidir o que fazer agora — e nada se decide
   * lendo que outro clube comprou um zagueiro. O assunto é mercado, então mora no mercado.
   */
  const [transferNews, setTransferNews] = useState<NewsItem[]>([]);
  const [sellPlayerId, setSellPlayerId] = useState('');
  const [sellAskingPrice, setSellAskingPrice] = useState('');

  // Tab 3: Proposals
  const [proposals, setProposals] = useState<TransferProposal[]>([]);

  // Tab 4: Squad Release Clauses
  const [editClausePlayer, setEditClausePlayer] = useState<Player | null>(null);
  const [customClauseValue, setCustomClauseValue] = useState('');

  // Tab 5: Deadline Day
  const [deadlineDay, setDeadlineDay] = useState<DeadlineDayState | null>(null);
  const [deadlineBid, setDeadlineBid] = useState<Record<string, string>>({});
  const [deadlineWage, setDeadlineWage] = useState<Record<string, string>>({});
  const [deadlineBusy, setDeadlineBusy] = useState(false);

  // Comparador Tático de Atletas (Passo 8)
  const [comparisonTargetPlayer, setComparisonTargetPlayer] = useState<Player | null>(null);
  const [comparisonReferencePlayer, setComparisonReferencePlayer] = useState<Player | null>(null);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);

  function handleOpenCompareTarget(targetPlayer: Player) {
    if (!club) return;
    const samePosition = club.players.filter((p) => p.position === targetPlayer.position);
    samePosition.sort((a, b) => b.overall - a.overall);
    const reference = samePosition[0] ?? club.players[0] ?? null;

    setComparisonTargetPlayer(targetPlayer);
    setComparisonReferencePlayer(reference);
    setComparisonModalOpen(true);
  }

  const clubColor = useClubColor(club);

  function notifySuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  async function loadData() {
    if (!clubId) return;
    try {
      // The staff market is not fetched here any more: hiring lives on the comissão page, and this screen
      // was still paying for the request on every load without rendering a single candidate.
      const [clubData, marketListings, proposalList, scoutDb, news, deadlineState] = await Promise.all([
        getClub(clubId),
        listTransferListings().catch(() => []),
        listTransferProposals(clubId).catch(() => []),
        listScoutingDatabase().catch(() => []),
        getTransferNews(clubId).catch(() => [] as NewsItem[]),
        Promise.resolve(getDeadlineDay(clubId)).catch(() => null),
      ]);
      setClub(clubData);
      setListings(marketListings);
      setProposals(proposalList);
      setScoutClubs(scoutDb);
      setTransferNews(news);
      setDeadlineDay(deadlineState);

      // Default selected scout club
      if (scoutDb.length > 0 && !selectedScoutClubId) {
        const firstInCountry = scoutDb.find((c: { id: string; country: string }) => c.country === selectedCountry && c.id !== clubId) ?? scoutDb[0];
        setSelectedScoutClubId(firstInCountry?.id ?? null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchCountryClubs() {
      if (!clubId) return;
      const alreadyHas = scoutClubs.some((c) => c.country === selectedCountry);
      if (!alreadyHas) {
        try {
          const newClubs = await listScoutingDatabase(selectedCountry);
          if (!cancelled && newClubs.length > 0) {
            setScoutClubs((prev) => {
              const others = prev.filter((c) => c.country !== selectedCountry);
              return [...others, ...newClubs];
            });
            const firstInCountry = newClubs.find((c) => c.id !== clubId) ?? newClubs[0];
            if (firstInCountry) {
              setSelectedScoutClubId(firstInCountry.id);
            }
          }
        } catch {
          // ignore
        }
      }
    }
    fetchCountryClubs();
    return () => {
      cancelled = true;
    };
  }, [selectedCountry, clubId, scoutClubs]);

  function setTab(tab: TabKey) {
    setSearchParams({ tab });
  }

  /**
   * The two directors this screen actually acts on: one discounts what a signing costs, the other decides
   * what the bank will guarantee. The other three roles were looked up here too, along with their stamina,
   * injury and sponsorship figures, and not one of them was read again anywhere in the file. Showing what
   * the staff is worth belongs where each of them works, not in a set of variables nothing renders.
   */
  const footballDirector = club?.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const financialDirector = club?.staff?.find((s) => s.role === 'FINANCIAL_DIRECTOR');
  const directorDiscount = getDirectorTransferDiscount(footballDirector);

  // Bank Guarantee Status
  const bankGuarantees = useMemo(() => {
    if (!club) return [];
    return club.bankGuarantees ?? calculateBankGuaranteeEligibility(club.budget, club.visibilityScore ?? 50, financialDirector?.rating ?? 50);
  }, [club, financialDirector]);

  const hasApprovedBankGuarantee = bankGuarantees.some((bg) => bg.isAvailable);

  // Master Sponsorship Craque Fund
  const masterSponsor = club?.sponsorships.find((s) => s.type === 'MASTER');
  const craqueFundRemaining = masterSponsor?.craqueFundRemaining ?? 0;

  // Selected scouting club
  const activeScoutClub = scoutClubs.find((c) => c.id === selectedScoutClubId);

  // Helper filter function
  function playerMatchesFilters(p: Player): boolean {
    if (scoutPosFilter !== 'ALL' && p.position !== scoutPosFilter) return false;
    if (scoutFootFilter !== 'ALL' && p.preferredFoot !== scoutFootFilter) return false;

    const minOvr = Number(scoutMinOvrFilter) || 0;
    if (p.overall < minOvr) return false;

    const maxOvr = Number(scoutMaxOvrFilter) || 99;
    if (p.overall > maxOvr) return false;

    const minAge = Number(scoutMinAgeFilter) || 15;
    if (p.age < minAge) return false;

    const maxAge = Number(scoutMaxAgeFilter) || 45;
    if (p.age > maxAge) return false;

    const maxPrice = Number(scoutMaxPriceFilter) || 0;
    if (maxPrice > 0 && p.marketValue > maxPrice) return false;

    if (scoutSpecialFilter !== 'ALL') {
      const tier = getPlayerTier(p.overall, p.starLevel, p.diferenciado, p.age, p.potential, p.name);
      if (scoutSpecialFilter === 'GENIO' && tier !== 'GENIO') return false;
      if (scoutSpecialFilter === 'BAITA' && tier !== 'BAITA') return false;
      if (scoutSpecialFilter === 'PROMISE' && !(p.age <= 21 && p.potential >= 80)) return false;
      if (scoutSpecialFilter === 'AMBIDEXTROUS' && p.preferredFoot !== 'BOTH') return false;
      if (scoutSpecialFilter === 'LEADER' && !p.traits?.includes('LEADER')) return false;
    }

    if (scoutSearchQuery.trim() && !p.name.toLowerCase().includes(scoutSearchQuery.toLowerCase())) {
      return false;
    }

    return true;
  }

  // Sorter
  function sortItemList<T extends { player: Player } | Player>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const pA = 'player' in a ? (a as { player: Player }).player : (a as Player);
      const pB = 'player' in b ? (b as { player: Player }).player : (b as Player);

      switch (scoutSortBy) {
        case 'ovr_desc': return pB.overall - pA.overall;
        case 'ovr_asc': return pA.overall - pB.overall;
        case 'pot_desc': return pB.potential - pA.potential;
        case 'val_desc': return pB.marketValue - pA.marketValue;
        case 'val_asc': return pA.marketValue - pB.marketValue;
        case 'age_asc': return pA.age - pB.age;
        case 'name_asc': return pA.name.localeCompare(pB.name);
        default: return pB.overall - pA.overall;
      }
    });
  }

  // Filtered players for current club
  const filteredScoutPlayers = useMemo(() => {
    const raw = (activeScoutClub?.players ?? []).filter(playerMatchesFilters);
    return sortItemList(raw);
  }, [activeScoutClub, scoutPosFilter, scoutFootFilter, scoutMinOvrFilter, scoutMaxOvrFilter, scoutMinAgeFilter, scoutMaxAgeFilter, scoutMaxPriceFilter, scoutSpecialFilter, scoutSearchQuery, scoutSortBy]);

  // Global database search results
  const globalDatabaseResults = useMemo(() => {
    const results: Array<{ club: { id: string; name: string; country: string; slug: string | null }; player: Player }> = [];
    for (const c of scoutClubs) {
      if (c.id === clubId) continue;
      for (const p of c.players) {
        if (playerMatchesFilters(p)) {
          results.push({ club: c, player: p });
        }
      }
    }
    return sortItemList(results);
  }, [scoutClubs, clubId, scoutRegionFilter, scoutPosFilter, scoutFootFilter, scoutMinOvrFilter, scoutMaxOvrFilter, scoutMinAgeFilter, scoutMaxAgeFilter, scoutMaxPriceFilter, scoutSpecialFilter, scoutSearchQuery, scoutSortBy]);

  function resetAllFilters() {
    setScoutRegionFilter('ALL');
    setScoutSearchQuery('');
    setScoutPosFilter('ALL');
    setScoutSpecialFilter('ALL');
    setScoutFootFilter('ALL');
    setScoutMinOvrFilter('0');
    setScoutMaxOvrFilter('99');
    setScoutMinAgeFilter('15');
    setScoutMaxAgeFilter('45');
    setScoutMaxPriceFilter('0');
    setScoutSortBy('ovr_desc');
  }

  function applyPresetFilter(preset: 'genio' | 'promise' | 'ambidextrous' | 'bargain') {
    resetAllFilters();
    if (preset === 'genio') {
      setScoutSpecialFilter('GENIO');
      setScoutMinOvrFilter('88');
    } else if (preset === 'promise') {
      setScoutSpecialFilter('PROMISE');
      setScoutMaxAgeFilter('21');
    } else if (preset === 'ambidextrous') {
      setScoutSpecialFilter('AMBIDEXTROUS');
      setScoutFootFilter('BOTH');
    } else if (preset === 'bargain') {
      setScoutMaxPriceFilter('3000000');
      setScoutMinOvrFilter('72');
    }
  }

  // --- Handlers: Buyout / Clause ---
  async function handleConfirmBuyout() {
    if (!club || !buyoutTarget) return;
    setError(null);
    try {
      await payReleaseClause(buyoutTarget.sellerClubId, buyoutTarget.player.id, club.id);
      notifySuccess(`${buyoutTarget.player.name} foi contratado com sucesso após pagamento da multa rescisória!`);
      setBuyoutTarget(null);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // --- Handlers: Proposals ---
  async function handleSendProposal(e: React.FormEvent) {
    e.preventDefault();
    if (!club || !proposalTarget) return;
    setError(null);
    const cash = Number(proposalCash) || 0;
    const installments = Math.max(1, Number(proposalInstallments) || 1);

    try {
      const result = await createTransferProposal({
        buyerClubId: club.id,
        sellerClubId: proposalTarget.sellerClubId,
        targetPlayerId: proposalTarget.player.id,
        cashAmount: cash,
        installments,
        offeredPlayerIds: proposalOfferedIds,
        hasBankGuarantee: proposalHasBankGuarantee && hasApprovedBankGuarantee,
      });

      if (result.status === 'ACCEPTED') {
        notifySuccess(`Negociação Concluída! O ${proposalTarget.sellerClubName} aceitou a proposta e ${proposalTarget.player.name} já faz parte do seu elenco!`);
      } else if (result.status === 'REJECTED') {
        notifySuccess(`Proposta enviada, porém foi RECUSADA pela diretoria do ${proposalTarget.sellerClubName}. Veja o motivo na aba Propostas.`);
      } else {
        notifySuccess(`Proposta oficial enviada ao ${proposalTarget.sellerClubName} por ${proposalTarget.player.name}!`);
      }

      setProposalTarget(null);
      setProposalCash('');
      setProposalInstallments('1');
      setProposalOfferedIds([]);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleAcceptProposal(id: string) {
    setError(null);
    try {
      await acceptTransferProposal(id);
      notifySuccess('Proposta aceita! Transferência concluída com sucesso.');
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRejectProposal(id: string) {
    setError(null);
    try {
      await rejectTransferProposal(id);
      notifySuccess('Proposta recusada.');
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleWithdrawProposal(id: string) {
    setError(null);
    try {
      await withdrawTransferProposal(id);
      notifySuccess('Proposta retirada.');
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleReopenProposalForTarget(p: TransferProposal) {
    // Find player in scout clubs
    for (const c of scoutClubs) {
      const pl = c.players.find((item) => item.id === p.targetPlayerId);
      if (pl) {
        setProposalTarget({ sellerClubId: c.id, sellerClubName: c.name, player: pl });
        setProposalCash(String(p.cashAmount));
        setProposalInstallments(String(p.installments));
        setProposalOfferedIds(p.offeredPlayerIds ?? []);
        return;
      }
    }
  }

  // --- Handlers: Market Listing ---
  async function handleListPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!club || !sellPlayerId) return;
    setError(null);
    const price = Number(sellAskingPrice);
    if (!price || price <= 0) return;

    try {
      await listPlayerForTransfer(club.id, sellPlayerId, price);
      notifySuccess('Jogador anunciado no mercado com sucesso!');
      setSellPlayerId('');
      setSellAskingPrice('');
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleBuyListing(listingId: string) {
    if (!club) return;
    setError(null);
    try {
      await buyTransferListing(listingId, club.id);
      notifySuccess('Jogador comprado do mercado de transferências!');
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCancelListing(listingId: string) {
    setError(null);
    try {
      await cancelTransferListing(listingId);
      notifySuccess('Anúncio cancelado com sucesso.');
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // --- Handlers: Release Clauses & Auto-Shield ---
  async function handleAutoShieldSquad() {
    if (!club) return;
    setError(null);
    try {
      const updated = await apiAutoShield(club.id);
      setClub(updated);
      notifySuccess('Todo o elenco foi blindado com super-multas pelo Diretor de Futebol!');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSaveCustomClause(e: React.FormEvent) {
    e.preventDefault();
    if (!club || !editClausePlayer) return;
    setError(null);
    const val = Number(customClauseValue);
    if (!val || val <= 0) return;

    try {
      const updated = await apiUpdateReleaseClause(club.id, editClausePlayer.id, val);
      setClub(updated);
      notifySuccess(`Multa rescisória de ${editClausePlayer.name} atualizada para ${formatMoney(val)}!`);
      setEditClausePlayer(null);
      setCustomClauseValue('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDirectorQuickOffer(rec: DirectorTransferRecommendation) {
    if (!club) return;
    setError(null);
    try {
      const result = await createTransferProposal({
        buyerClubId: club.id,
        sellerClubId: rec.sellerClubId,
        targetPlayerId: rec.player.id,
        cashAmount: rec.suggestedOfferPrice,
        installments: 1,
        offeredPlayerIds: [],
        hasBankGuarantee: hasApprovedBankGuarantee,
      });

      if (result.status === 'ACCEPTED') {
        notifySuccess(`Negociação Imediata Concluída! O ${rec.sellerClubName} aceitou a proposta de ${formatMoney(rec.suggestedOfferPrice)} e ${rec.player.name} já faz parte do seu elenco!`);
      } else if (result.status === 'REJECTED') {
        notifySuccess(`Proposta enviada, porém foi recusada pelo ${rec.sellerClubName} (${result.responseMessage || 'valor insuficiente'}).`);
      } else {
        notifySuccess(`Proposta oficial de ${formatMoney(rec.suggestedOfferPrice)} enviada ao ${rec.sellerClubName} por ${rec.player.name}!`);
      }
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleDirectorCustomProposal(rec: DirectorTransferRecommendation) {
    setProposalTarget({ sellerClubId: rec.sellerClubId, sellerClubName: rec.sellerClubName, player: rec.player });
    setProposalCash(String(rec.suggestedOfferPrice));
    setProposalInstallments('1');
    setProposalOfferedIds([]);
  }

  function handleDirectorBuyout(rec: DirectorTransferRecommendation) {
    setBuyoutTarget({ sellerClubId: rec.sellerClubId, sellerClubName: rec.sellerClubName, player: rec.player });
  }

  async function handleDeadlineBid(item: DeadlineAuctionItem) {
    if (!club) return;
    setDeadlineBusy(true);
    setError(null);
    try {
      const amount = Number(deadlineBid[item.id]) || nextMinimumBid(item);
      const wageOffer = Number(deadlineWage[item.id]) || item.player.wage;
      const updated = await placeDeadlineDayBid({
        auctionId: item.id,
        buyerClubId: club.id,
        amount,
        wageOffer,
      });
      setDeadlineDay(updated);
      notifySuccess(`Lance de ${formatMoney(amount)} registrado por ${item.player.name}!`);
      setDeadlineBid((prev) => ({ ...prev, [item.id]: '' }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeadlineBusy(false);
    }
  }

  async function handleAdvanceDeadline() {
    if (!club) return;
    setDeadlineBusy(true);
    setError(null);
    try {
      const updated = await advanceDeadlineDay(club.id);
      setDeadlineDay(updated);
      if (updated.currentHour === 0) {
        notifySuccess('A Janela de Transferências foi encerrada! Os leilões foram liquidados com sucesso.');
        await loadData();
      } else {
        notifySuccess(`Relógio do Deadline Day avançou para ${updated.currentHour}h restantes.`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeadlineBusy(false);
    }
  }

  if (loading) return <div className="page"><p>Carregando Central de Negociações...</p></div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club) return null;

  const pendingReceivedCount = proposals.filter((p) => p.sellerClubId === club.id && p.status === 'PENDING').length;

  // Proposal Modal Viability Calculator
  const sellerScoutClub = proposalTarget ? scoutClubs.find((c) => c.id === proposalTarget.sellerClubId) : null;
  const buyerVisScore = club.visibilityScore ?? 50;
  const sellerVisScore = sellerScoutClub
    ? calculateClubVisibility(
        {
          ...sellerScoutClub,
          budget: 5_000_000,
          players: sellerScoutClub.players,
          sponsorships: [],
          loans: [],
          stadiumLevel: 1,
          stadiumCapacity: sellerScoutClub.stadiumCapacity,
          titlesWon: sellerScoutClub.titlesWon,
        } as any,
        1,
        sellerScoutClub.titlesWon,
      ).score
    : 50;

  const prestigeDelta = buyerVisScore - sellerVisScore;
  const proposalCashNum = Number(proposalCash) || 0;
  const proposalInstallmentsNum = Number(proposalInstallments) || 1;
  const isInstallmentsProposal = proposalInstallmentsNum > 1;
  const bankGuaranteeNeeded = isInstallmentsProposal && proposalCashNum > 500_000 && buyerVisScore < 80;

  return (
    <div
      className="page transfers-hub-pro"
      style={clubColor ? ({ ['--club-accent' as string]: clubColor } as React.CSSProperties) : undefined}
    >
      <ClubNav club={club} active="transfers" />

      {/* Notifications */}
      {error && <div className="action-banner action-banner-danger" style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangleIcon size={16} /> {error}</div>}
      {successMsg && <div className="action-banner action-banner-success" style={{ marginBottom: 14 }}>✓ {successMsg}</div>}

      {/* Top Financial & Guarantee HUD */}
      <section className="transfers-hud-strip">
        <div className="transfers-hud-pill">
          <span className="transfers-hud-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FinanceIcon size={16} color="#10b981" /> <span>Saldo em Caixa</span>
          </span>
          <strong className="transfers-hud-val" style={{ color: '#4ade80' }}>{formatMoney(club.budget)}</strong>
        </div>

        {craqueFundRemaining > 0 && (
          <div className="transfers-hud-pill highlight-gold">
            <span className="transfers-hud-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <StarIcon size={16} color="#fbbf24" fill="#fbbf24" /> <span>Fundo de Craque (Patrocinador)</span>
            </span>
            <strong className="transfers-hud-val gold-glow">{formatMoney(craqueFundRemaining)}</strong>
            <span className="transfers-hud-sub">Exclusivo p/ estrelas (80+ OVR)</span>
          </div>
        )}

        {bankGuarantees.length > 0 && (
          <div className="transfers-hud-pill">
            <span className="transfers-hud-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <BriefcaseIcon size={16} color="#38bdf8" /> <span>Fiança Bancária</span>
            </span>
            <strong className="transfers-hud-val" style={{ color: hasApprovedBankGuarantee ? '#7fd0ff' : '#f87171' }}>
              {hasApprovedBankGuarantee ? formatMoney(bankGuarantees[0].maxGuaranteeAmount) : 'Não Habilitada'}
            </strong>
            <span className="transfers-hud-sub">{bankGuarantees[0].bankName}</span>
          </div>
        )}

        {directorDiscount > 0 && (
          <div className="transfers-hud-pill">
            <span className="transfers-hud-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <SearchIcon size={16} color="#a78bfa" /> <span>Desconto Diretor Futebol</span>
            </span>
            <strong className="transfers-hud-val" style={{ color: '#ffd700' }}>
              -{(directorDiscount * 100).toFixed(0)}%
            </strong>
            <span className="transfers-hud-sub">{footballDirector?.name}</span>
          </div>
        )}
      </section>

      {/* 🎯 Director of Football Scouting Recommendations & Quick Negotiations */}
      {scoutClubs.length > 0 && (
        <DirectorRecommendationsCard
          club={club}
          availablePlayers={scoutClubs}
          onQuickOffer={handleDirectorQuickOffer}
          onCustomProposal={handleDirectorCustomProposal}
          onBuyout={handleDirectorBuyout}
        />
      )}

      {/* Unified Symmetric Sub-Tabs Navigation */}
      <nav className="transfers-subnav-grid">
        <button
          type="button"
          className={`transfers-subnav-btn ${activeTab === 'scouting' ? 'active' : ''}`}
          onClick={() => setTab('scouting')}
        >
          <span className="subnav-icon"><GlobeIcon size={16} /></span>
          <span className="subnav-title">Explorador e Radar</span>
        </button>

        <button
          type="button"
          className={`transfers-subnav-btn ${activeTab === 'market' ? 'active' : ''}`}
          onClick={() => setTab('market')}
        >
          <span className="subnav-icon"><StoreIcon size={16} /></span>
          <span className="subnav-title">Mercado de Vendas ({listings.length})</span>
        </button>

        <button
          type="button"
          className={`transfers-subnav-btn ${activeTab === 'proposals' ? 'active' : ''}`}
          onClick={() => setTab('proposals')}
        >
          <span className="subnav-icon"><MailIcon size={16} /></span>
          <span className="subnav-title">
            Propostas {pendingReceivedCount > 0 && <span className="subnav-badge">{pendingReceivedCount}</span>}
          </span>
        </button>

        <button
          type="button"
          className={`transfers-subnav-btn ${activeTab === 'clauses' ? 'active' : ''}`}
          onClick={() => setTab('clauses')}
        >
          <span className="subnav-icon"><ShieldIcon size={16} /></span>
          <span className="subnav-title">Gestão de Multas</span>
        </button>

        <button
          type="button"
          className={`transfers-subnav-btn ${activeTab === 'deadline' ? 'active' : ''}`}
          onClick={() => setTab('deadline')}
        >
          <span className="subnav-icon"><LightningIcon size={16} color="#f59e0b" /></span>
          <span className="subnav-title">
            Deadline Day {deadlineDay?.isActive && <span className="subnav-badge highlight-pulse">{deadlineDay.currentHour}h</span>}
          </span>
        </button>

      </nav>

      {/* =========================================================================
          TAB 1: SCOUTING, RADAR E BANCO DE DADOS AVANÇADO
          ========================================================================= */}
      {activeTab === 'scouting' && (
        <section className="transfers-tab-pane">
          {/* Advanced Combinable Filters Bar */}
          <div className="card scout-filters-advanced-card">
            <div className="scout-filters-top-row">
              <div className="scout-search-main">
                <label>Buscar por Nome</label>
                <div className="scout-search-input-group">
                  <input
                    type="text"
                    placeholder="Digite o nome do atleta (ex: Arrascaeta, Pedro, Endrick)..."
                    value={scoutSearchQuery}
                    onChange={(e) => setScoutSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setScoutViewMode('database');
                      }
                    }}
                    className="scout-search-input"
                  />
                  <button
                    type="button"
                    className="btn-scout-search-submit"
                    onClick={() => setScoutViewMode('database')}
                  >
                    Buscar
                  </button>
                </div>
              </div>

              <div className="scout-mode-toggle">
                <button
                  type="button"
                  className={`btn-mode ${scoutViewMode === 'explorer' ? 'active' : ''}`}
                  onClick={() => setScoutViewMode('explorer')}
                >
                  Por Clube
                </button>
                <button
                  type="button"
                  className={`btn-mode ${scoutViewMode === 'database' ? 'active' : ''}`}
                  onClick={() => setScoutViewMode('database')}
                >
                  Base Global ({globalDatabaseResults.length})
                </button>
              </div>
            </div>

            {/* Combinable Controls Row */}
            <div className="scout-controls-grid">
              <div className="scout-control-item">
                <label>Posição</label>
                <select value={scoutPosFilter} onChange={(e) => setScoutPosFilter(e.target.value)}>
                  <option value="ALL">Todas as Posições</option>
                  <option value="GK">Goleiros (GOL)</option>
                  <option value="DEF">Zagueiros (DEF)</option>
                  <option value="LAT">Laterais (LAT)</option>
                  <option value="MID">Meias (MEI)</option>
                  <option value="ATT">Atacantes (ATA)</option>
                </select>
              </div>

              <div className="scout-control-item">
                <label>Especial / Tier</label>
                <select value={scoutSpecialFilter} onChange={(e) => setScoutSpecialFilter(e.target.value as ScoutSpecialFilter)}>
                  <option value="ALL">Todas as Características</option>
                  <option value="GENIO">Gênio / Extraclasse</option>
                  <option value="BAITA">Baita Jogador</option>
                  <option value="PROMISE">Jovem Promessa (Sub-21)</option>
                  <option value="AMBIDEXTROUS">Ambidestro</option>
                  <option value="LEADER">Líder de Elenco</option>
                </select>
              </div>

              <div className="scout-control-item">
                <label>Pé Preferido</label>
                <select value={scoutFootFilter} onChange={(e) => setScoutFootFilter(e.target.value)}>
                  <option value="ALL">Qualquer Pé</option>
                  <option value="RIGHT">Destro</option>
                  <option value="LEFT">Canhoto</option>
                  <option value="BOTH">Ambidestro (Ambos)</option>
                </select>
              </div>

              <div className="scout-control-item">
                <label>Força Mínima (OVR)</label>
                <select value={scoutMinOvrFilter} onChange={(e) => setScoutMinOvrFilter(e.target.value)}>
                  <option value="0">Qualquer Força</option>
                  <option value="70">70+ (Série A)</option>
                  <option value="75">75+ (Destaque)</option>
                  <option value="80">80+ (Craque)</option>
                  <option value="85">85+ (Baita / Gênio)</option>
                </select>
              </div>

              <div className="scout-control-item">
                <label>Teto de Preço</label>
                <select value={scoutMaxPriceFilter} onChange={(e) => setScoutMaxPriceFilter(e.target.value)}>
                  <option value="0">Sem Limite</option>
                  <option value="2000000">Até R$ 2 Milhões</option>
                  <option value="5000000">Até R$ 5 Milhões</option>
                  <option value="15000000">Até R$ 15 Milhões</option>
                  <option value="50000000">Até R$ 50 Milhões</option>
                </select>
              </div>

              <div className="scout-control-item">
                <label>Ordenar Por</label>
                <select value={scoutSortBy} onChange={(e) => setScoutSortBy(e.target.value as ScoutSortBy)}>
                  <option value="ovr_desc">Maior Força (OVR)</option>
                  <option value="pot_desc">Maior Potencial</option>
                  <option value="val_desc">Maior Valor de Mercado</option>
                  <option value="val_asc">Menor Preço (Pechincha)</option>
                  <option value="age_asc">Mais Jovem Primeiro</option>
                  <option value="name_asc">Nome (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Quick Preset Chips */}
            <div className="scout-chips-row">
              <span className="chips-label">Filtros Rápidos:</span>
              <button type="button" className="chip-btn" onClick={() => applyPresetFilter('genio')}>
                Apenas Craques (85+)
              </button>
              <button type="button" className="chip-btn" onClick={() => applyPresetFilter('promise')}>
                Promessas Sub-21
              </button>
              <button type="button" className="chip-btn" onClick={() => applyPresetFilter('ambidextrous')}>
                Ambidestros
              </button>
              <button type="button" className="chip-btn" onClick={() => applyPresetFilter('bargain')}>
                Pechinchas (Até R$ 3M)
              </button>
              <button type="button" className="chip-btn clear" onClick={resetAllFilters}>
                Limpar Filtros
              </button>
            </div>
          </div>

          {/* Database Global View Mode */}
          {scoutViewMode === 'database' ? (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="scout-results-header">
                <h3 style={{ margin: 0, color: '#ffd700' }}>
                  Base Global de Atletas ({globalDatabaseResults.length} encontrados)
                </h3>
              </div>
              {globalDatabaseResults.length === 0 ? (
                <p className="muted" style={{ padding: '20px 0' }}>Nenhum jogador encontrado com a combinação de filtros selecionada.</p>
              ) : (
                <div className="table-scroll">
                  <table className="scout-players-table">
                    <thead>
                      <tr>
                        <th>Jogador</th>
                        <th>Pos.</th>
                        <th>Pé</th>
                        <th>Força</th>
                        <th>Idade</th>
                        <th>Clube Atual</th>
                        <th>Valor de Mercado</th>
                        <th>Multa Rescisória</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalDatabaseResults.slice(0, 150).map(({ club: targetClub, player: p }) => (
                        <tr key={`${targetClub.id}-${p.id}`}>
                          <td>
                            <div className="scout-player-cell">
                              <span className="scout-player-name">{p.name}</span>
                              <TierBadge player={p} />
                              {p.age <= 21 && p.potential >= 80 && (
                                <span className="badge-star cyan" title="Jovem Promessa">
                                  <StarIcon size={12} color="#38bdf8" fill="#38bdf8" style={{ marginRight: 3 }} />
                                  Promessa
                                </span>
                              )}
                            </div>
                          </td>
                          <td><span className={`pos-pill pos-${p.position}`}>{positionLabel(p.position)}</span></td>
                          <td>{footLabel(p.preferredFoot)}</td>
                          <td><span className="ovr-badge">{p.overall}</span></td>
                          <td>{p.age} anos</td>
                          <td>
                            <span className="crest-name">
                              <ClubCrest club={targetClub} size={18} /> {targetClub.name}
                            </span>
                          </td>
                          <td>{formatMoney(p.marketValue)}</td>
                          <td><strong className="release-clause-tag">{formatMoney(p.releaseClause)}</strong></td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="scout-action-btns">
                              <button
                                type="button"
                                className="btn-scout-action compare"
                                onClick={() => handleOpenCompareTarget(p)}
                                title="Comparar com o titular da mesma posição do seu elenco"
                              >
                                Comparar
                              </button>
                              <button
                                type="button"
                                className="btn-scout-action buyout"
                                onClick={() => setBuyoutTarget({ sellerClubId: targetClub.id, sellerClubName: targetClub.name, player: p })}
                                title="Pagar multa rescisória e contratar imediatamente"
                              >
                                Multa
                              </button>
                              <button
                                type="button"
                                className="btn-scout-action proposal"
                                onClick={() => setProposalTarget({ sellerClubId: targetClub.id, sellerClubName: targetClub.name, player: p })}
                                title="Fazer proposta oficial com facilitadores e dificultadores"
                              >
                                Proposta
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {globalDatabaseResults.length > 150 && (
                    <p className="muted" style={{ textAlign: 'center', margin: '10px 0', fontSize: '0.82rem' }}>
                      Mostrando os primeiros 150 resultados. Refine seus filtros para encontrar atletas específicos.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Standard Club Explorer View */
            <div className="scout-explorer-layout" style={{ marginTop: 14 }}>
              {/* Left Column: Country & Club List */}
              <div className="scout-sidebar card">
                <h4 style={{ margin: '0 0 8px', color: '#ffd700' }}>País e Ligas</h4>
                <div className="country-pills-row">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      className={`country-pill ${selectedCountry === c.code ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedCountry(c.code);
                        const firstInCountry = scoutClubs.find((clubItem) => clubItem.country === c.code && clubItem.id !== clubId);
                        if (firstInCountry) setSelectedScoutClubId(firstInCountry.id);
                      }}
                    >
                      <CountryFlag code={c.code} size={18} title={c.name} style={{ marginRight: 6, borderRadius: 2 }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>

                <h4 style={{ margin: '14px 0 8px', color: 'var(--muted)' }}>Clubes</h4>
                <div className="scout-clubs-list">
                  {scoutClubs
                    .filter((c) => c.country === selectedCountry)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`scout-club-item ${selectedScoutClubId === c.id ? 'active' : ''} ${c.id === club.id ? 'is-own' : ''}`}
                        onClick={() => setSelectedScoutClubId(c.id)}
                      >
                        <ClubCrest club={c} size={22} />
                        <span className="scout-club-name">{c.name}</span>
                        {c.id === club.id && <span className="own-badge">Seu time</span>}
                      </button>
                    ))}
                </div>
              </div>

              {/* Right Column: Target Club Squad */}
              <div className="scout-main card">
                {activeScoutClub ? (
                  <>
                    <div className="scout-club-header">
                      <div className="scout-club-title">
                        <ClubCrest club={activeScoutClub} size={36} />
                        <div>
                          <h3 style={{ margin: 0 }}>{activeScoutClub.name}</h3>
                          <span className="muted" style={{ fontSize: '0.78rem' }}>
                            Estádio: {activeScoutClub.stadiumCapacity.toLocaleString('pt-BR')} lugares • {activeScoutClub.titlesWon} título(s) • {filteredScoutPlayers.length} de {activeScoutClub.players.length} atletas exibidos
                          </span>
                        </div>
                      </div>
                      {activeScoutClub.id === club.id && (
                        <span className="badge-pill gold">Seu próprio elenco</span>
                      )}
                    </div>

                    <div className="table-scroll">
                      <table className="scout-players-table">
                        <thead>
                          <tr>
                            <th>Jogador</th>
                            <th>Pos.</th>
                            <th>Pé</th>
                            <th>Força</th>
                            <th>Idade</th>
                            <th>Valor</th>
                            <th>Multa Rescisória</th>
                            <th style={{ textAlign: 'right' }}>Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredScoutPlayers.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <div className="scout-player-cell">
                                  <span className="scout-player-name">{p.name}</span>
                                  <TierBadge player={p} />
                                  {p.age <= 21 && p.potential >= 80 && (
                                    <span className="badge-star cyan">
                                      <StarIcon size={12} color="#38bdf8" fill="#38bdf8" style={{ marginRight: 3 }} />
                                      Promessa
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td><span className={`pos-pill pos-${p.position}`}>{positionLabel(p.position)}</span></td>
                              <td>{footLabel(p.preferredFoot)}</td>
                              <td><span className="ovr-badge">{p.overall}</span></td>
                              <td>{p.age} anos</td>
                              <td>{formatMoney(p.marketValue)}</td>
                              <td><strong className="release-clause-tag">{formatMoney(p.releaseClause)}</strong></td>
                              <td style={{ textAlign: 'right' }}>
                                {activeScoutClub.id === club.id ? (
                                  <button
                                    type="button"
                                    className="btn-small"
                                    onClick={() => {
                                      setEditClausePlayer(p);
                                      setCustomClauseValue(String(p.releaseClause));
                                      setTab('clauses');
                                    }}
                                  >
                                    Gerir Multa
                                  </button>
                                ) : (
                                  <div className="scout-action-btns">
                                    <button
                                      type="button"
                                      className="btn-scout-action compare"
                                      onClick={() => handleOpenCompareTarget(p)}
                                      title="Comparar com jogador da mesma posição do seu elenco"
                                    >
                                      Comparar
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-scout-action buyout"
                                      onClick={() => setBuyoutTarget({ sellerClubId: activeScoutClub.id, sellerClubName: activeScoutClub.name, player: p })}
                                      title="Pagar multa rescisória e contratar imediatamente"
                                    >
                                      Multa
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-scout-action proposal"
                                      onClick={() => setProposalTarget({ sellerClubId: activeScoutClub.id, sellerClubName: activeScoutClub.name, player: p })}
                                      title="Fazer proposta oficial com dinheiro, parcelas ou troca"
                                    >
                                      Proposta
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="muted">Selecione um clube ao lado para visualizar o elenco.</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 2: MERCADO E BALCÃO DE VENDAS
          ========================================================================= */}
      {activeTab === 'market' && (
        <section className="transfers-tab-pane">
          <div className="card">
            <h3>Notícias do mercado</h3>
            {transferNews.length === 0 ? (
              <p className="muted">Nenhuma negociação fechada ainda.</p>
            ) : (
              <ul className="club-news-list">
                {transferNews.slice(0, 6).map((item) => (
                  <li key={item.id} className="club-news-item club-news-transfer_in">
                    <p>{item.headline}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="transfers-2col-layout">
            {/* List Your Player */}
            <div className="card">
              <h3>Anunciar Jogador de {club.name}</h3>
              <p className="muted" style={{ fontSize: '0.82rem' }}>
                Coloque atletas no balcão de transferências para outros clubes fazerem propostas ou comprarem à vista.
              </p>
              <form onSubmit={handleListPlayer} className="list-player-form">
                <label>
                  Selecionar Jogador
                  <select value={sellPlayerId} onChange={(e) => setSellPlayerId(e.target.value)} required>
                    <option value="" disabled>Selecione um jogador do elenco</option>
                    {club.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({positionLabel(p.position)} • {p.overall} OVR) • Valor: {formatMoney(p.marketValue)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Preço Pedido (R$)
                  <input
                    type="number"
                    placeholder="Ex: 5000000"
                    min={1000}
                    value={sellAskingPrice}
                    onChange={(e) => setSellAskingPrice(e.target.value)}
                    required
                  />
                </label>

                <button type="submit" className="btn-options-action save" style={{ marginTop: 8 }}>
                  Publicar Anúncio no Mercado
                </button>
              </form>
            </div>

            {/* Market Listings */}
            <div className="card">
              <h3>Balcão do Mercado ({listings.length} anúncios)</h3>
              {listings.length === 0 ? (
                <p className="muted">Nenhum jogador anunciado no mercado no momento.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Jogador</th>
                        <th>Pos.</th>
                        <th>Força</th>
                        <th>Clube</th>
                        <th>Preço</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {listings.map((l) => (
                        <tr key={l.id}>
                          <td><strong>{l.player.name}</strong></td>
                          <td><span className={`pos-pill pos-${l.player.position}`}>{positionLabel(l.player.position)}</span></td>
                          <td><span className="ovr-badge">{l.player.overall}</span></td>
                          <td>
                            <span className="crest-name">
                              <ClubCrest
                                club={
                                  l.clubId === club.id
                                    ? club
                                    : {
                                        id: l.clubId,
                                        name: l.clubName,
                                        slug: (l as any).clubSlug ?? null,
                                        crestBase64: (l as any).crestBase64 ?? null,
                                        primaryColor: (l as any).primaryColor ?? null,
                                        secondaryColor: (l as any).secondaryColor ?? null,
                                      }
                                }
                                size={18}
                              />{' '}
                              {l.clubName}
                            </span>
                          </td>
                          <td><strong style={{ color: '#4ade80' }}>{formatMoney(l.askingPrice)}</strong></td>
                          <td>
                            {l.clubId === club.id ? (
                              <button type="button" className="btn-small danger" onClick={() => handleCancelListing(l.id)}>
                                Cancelar
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-small"
                                onClick={() => handleBuyListing(l.id)}
                                disabled={club.budget < l.askingPrice}
                              >
                                Comprar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 3: CENTRAL DE PROPOSTAS E JUSTIFICATIVAS DE NEGOCIAÇÃO
          ========================================================================= */}
      {activeTab === 'proposals' && (
        <section className="transfers-tab-pane">
          <div className="transfers-2col-layout">
            {/* Propostas Recebidas */}
            <div className="card">
              <h3 style={{ color: '#ffd700' }}>Propostas Recebidas (Seu Clube como Vendedor)</h3>
              {proposals.filter((p) => p.sellerClubId === club.id).length === 0 ? (
                <p className="muted">Nenhuma proposta recebida de outros clubes.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Jogador</th>
                        <th>Comprador</th>
                        <th>Oferta</th>
                        <th>Garantia</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposals
                        .filter((p) => p.sellerClubId === club.id)
                        .map((p) => (
                          <tr key={p.id}>
                            <td><strong>{p.targetPlayerName}</strong></td>
                            <td>{p.buyerClubName}</td>
                            <td>
                              <div>{formatMoney(p.cashAmount)} {p.installments > 1 && `(${p.installments}x)`}</div>
                              {p.offeredPlayerIds?.length > 0 && <span className="muted" style={{ fontSize: '0.72rem' }}>+ {p.offeredPlayerIds.length} atleta(s) em troca</span>}
                            </td>
                            <td>
                              {p.hasBankGuarantee ? (
                                <span className="badge-pill" style={{ background: '#1e3a8a', color: '#93c5fd', fontSize: '0.72rem' }}>✓ Fiança Bancária</span>
                              ) : p.installments > 1 ? (
                                <span className="badge-pill" style={{ background: '#451a03', color: '#fdba74', fontSize: '0.72rem' }}>Sem Fiança</span>
                              ) : (
                                <span className="muted" style={{ fontSize: '0.72rem' }}>À vista</span>
                              )}
                            </td>
                            <td><span className={`status-badge status-${p.status.toLowerCase()}`}>{p.status}</span></td>
                            <td>
                              {p.status === 'PENDING' && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button type="button" className="btn-small" onClick={() => handleAcceptProposal(p.id)}>Aceitar</button>
                                  <button type="button" className="btn-small danger" onClick={() => handleRejectProposal(p.id)}>Recusar</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Propostas Enviadas */}
            <div className="card">
              <h3 style={{ color: '#7fd0ff' }}>Propostas Enviadas (Seu Clube como Comprador)</h3>
              {proposals.filter((p) => p.buyerClubId === club.id).length === 0 ? (
                <p className="muted">Nenhuma proposta enviada no momento.</p>
              ) : (
                <div className="proposals-sent-cards-list">
                  {proposals
                    .filter((p) => p.buyerClubId === club.id)
                    .map((p) => (
                      <div key={p.id} className={`proposal-sent-card status-${p.status.toLowerCase()}`}>
                        <div className="proposal-card-header">
                          <div>
                            <h4 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>
                              {p.targetPlayerName} ➔ <span className="muted">{p.sellerClubName}</span>
                            </h4>
                            <span className="muted" style={{ fontSize: '0.78rem' }}>
                              Oferta: <strong>{formatMoney(p.cashAmount)}</strong> {p.installments > 1 ? `(${p.installments}x semanais)` : '(À vista)'}
                              {p.hasBankGuarantee && ' • Com Fiança Bancária'}
                            </span>
                          </div>
                          <span className={`status-badge status-${p.status.toLowerCase()}`}>{p.status}</span>
                        </div>

                        {/* Official Response Rationale Balloon */}
                        {p.responseMessage && (
                          <div className={`proposal-response-balloon ${p.status === 'ACCEPTED' ? 'accepted' : 'rejected'}`}>
                            <span className="balloon-title">
                              {p.status === 'ACCEPTED' ? 'Resposta Oficial da Diretoria:' : 'Justificativa de Recusa:'}
                            </span>
                            <p className="balloon-text">{p.responseMessage}</p>
                          </div>
                        )}

                        <div className="proposal-card-footer">
                          {p.status === 'PENDING' && (
                            <button type="button" className="btn-small danger" onClick={() => handleWithdrawProposal(p.id)}>
                              Retirar Proposta
                            </button>
                          )}
                          {p.status === 'REJECTED' && (
                            <button
                              type="button"
                              className="btn-small"
                              style={{ background: 'var(--accent)', color: '#10120e', fontWeight: 800 }}
                              onClick={() => handleReopenProposalForTarget(p)}
                            >
                              Ajustar e Nova Proposta
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Bank Guarantees Overview Card */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="clauses-header-row">
              <div>
                <h3 style={{ margin: 0, color: '#ffd700' }}>Sistema de Fiança e Garantias Bancárias</h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                  Clubes cautelosos exigem cartas de fiança para aceitar parcelamentos. Linhas de garantia dependem da visibilidade do clube e do Diretor Financeiro (CFO).
                </p>
              </div>
            </div>

            <div className="bank-guarantees-grid" style={{ marginTop: 14 }}>
              {bankGuarantees.map((bg) => (
                <div key={bg.id} className={`bank-guarantee-card ${bg.isAvailable ? 'approved' : 'locked'}`}>
                  <div className="bank-card-top">
                    <span className="bank-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <FinanceIcon size={20} color="#ffd700" />
                    </span>
                    <div>
                      <h4 style={{ margin: 0 }}>{bg.bankName}</h4>
                      <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.74rem' }}>{bg.description}</p>
                    </div>
                  </div>

                  <div className="bank-card-stats">
                    <div>
                      <span className="muted">Limite Disponível:</span>
                      <strong>{formatMoney(bg.maxGuaranteeAmount)}</strong>
                    </div>
                    <div>
                      <span className="muted">Taxa Institucional:</span>
                      <strong>{(bg.interestRatePerMonth * 100).toFixed(1)}% ao mês</strong>
                    </div>
                    <div>
                      <span className="muted">Visibilidade Mínima:</span>
                      <strong className={bg.isAvailable ? 'text-success' : 'text-danger'}>
                        {bg.minVisibilityScore} pts (Seu clube: {club.visibilityScore ?? 50})
                      </strong>
                    </div>
                  </div>

                  <div className="bank-card-status">
                    {bg.isAvailable ? (
                      <span className="badge-pill" style={{ background: '#065f46', color: '#a7f3d0' }}>
                        ✓ Linha Habilitada para Parcelamentos
                      </span>
                    ) : (
                      <span className="badge-pill" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
                        Visibilidade insuficiente ({club.visibilityScore ?? 50}/{bg.minVisibilityScore} pts)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 4: GESTÃO DE MULTAS RESCISÓRIAS E BLINDAGEM DO ELENCO
          ========================================================================= */}
      {activeTab === 'clauses' && (
        <section className="transfers-tab-pane">
          <div className="card">
            <div className="clauses-header-row">
              <div>
                <h3 style={{ margin: 0, color: '#ffd700' }}>Blindagem de Multas Rescisórias do Elenco</h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                  Gerencie as multas rescisórias dos seus atletas para evitar assédio de clubes rivais. Contratos com multas maiores demandam salários mais altos.
                </p>
              </div>
              <button
                type="button"
                className="btn-options-action save"
                onClick={handleAutoShieldSquad}
                title="Aplica super-multas calculadas automaticamente por categoria"
              >
                Blindagem Automática do Elenco
              </button>
            </div>

            <div className="table-scroll" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Jogador</th>
                    <th>Pos.</th>
                    <th>Força</th>
                    <th>Idade</th>
                    <th>Valor de Mercado</th>
                    <th>Multa Atual</th>
                    <th>Salário Semanal</th>
                    <th style={{ textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {club.players.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="scout-player-cell">
                          <span className="scout-player-name">{p.name}</span>
                          <TierBadge player={p} />
                          {p.age <= 21 && p.potential >= 80 && (
                            <span className="badge-star cyan">
                              <StarIcon size={12} color="#38bdf8" fill="#38bdf8" style={{ marginRight: 3 }} />
                              Promessa
                            </span>
                          )}
                        </div>
                      </td>
                      <td><span className={`pos-pill pos-${p.position}`}>{positionLabel(p.position)}</span></td>
                      <td><span className="ovr-badge">{p.overall}</span></td>
                      <td>{p.age} anos</td>
                      <td>{formatMoney(p.marketValue)}</td>
                      <td><strong className="release-clause-tag">{formatMoney(p.releaseClause)}</strong></td>
                      <td>{formatMoney(p.wage)}/sem</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-small"
                          onClick={() => {
                            setEditClausePlayer(p);
                            setCustomClauseValue(String(p.releaseClause));
                          }}
                        >
                          Ajustar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 5: DEADLINE DAY & LEILÕES AO VIVO
          ========================================================================= */}
      {activeTab === 'deadline' && (
        <section className="transfers-tab-pane deadline-day-pane">
          {/* Deadline Day Stadium Night HUD Header */}
          <div className="card deadline-stadium-header-card">
            <div className="deadline-header-main">
              <div className="deadline-title-group">
                <span className="deadline-badge-glow"><LightningIcon size={14} color="#ffd700" /> DEADLINE DAY</span>
                <h2>Leilões de Transferência de Fim de Janela</h2>
                <p className="deadline-subtitle">
                  O relógio está correndo! Cubra lances em tempo real, aproveite liquidações de pânico (<em>Panic Sell</em>) e monitore a busca desesperada de outros clubes.
                </p>
              </div>

              <div className="deadline-clock-widget">
                <div className="deadline-clock-display">
                  <span className="clock-label">TEMPO RESTANTE</span>
                  <div className="clock-countdown">
                    <span className="clock-hours">{deadlineDay?.currentHour ?? 0}</span>
                    <span className="clock-unit">h</span>
                  </div>
                  <span className="clock-status">
                    {deadlineDay?.isActive ? 'AO VIVO NO MERCADO' : 'JANELA FECHADA'}
                  </span>
                </div>

                {deadlineDay?.isActive && (
                  <button
                    type="button"
                    className="btn-action-primary deadline-advance-btn"
                    disabled={deadlineBusy}
                    onClick={handleAdvanceDeadline}
                  >
                    {deadlineBusy ? 'Processando...' : 'Avançar Hora do Relógio'}
                  </button>
                )}
              </div>
            </div>

            {/* Breaking News Ticker */}
            {deadlineDay?.breakingNews && deadlineDay.breakingNews.length > 0 && (
              <div className="deadline-news-ticker">
                <span className="ticker-badge"><AlertTriangleIcon size={12} color="#fff" /> PLANTÃO</span>
                <div className="ticker-content">
                  {deadlineDay.breakingNews.slice(-3).reverse().map((news, idx) => (
                    <span key={idx} className="ticker-item">{news}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Panic Buy Alert Board */}
          {deadlineDay?.panicBuyRequests && deadlineDay.panicBuyRequests.length > 0 && (
            <div className="card deadline-panic-buy-card">
              <div className="panic-buy-header">
                <h3>Plantão de Desespero (<em>Panic Buy Requests</em>)</h3>
                <span className="panic-buy-desc">Clubes da IA buscando reforços urgentes antes do encerramento</span>
              </div>
              <div className="panic-buy-grid">
                {deadlineDay.panicBuyRequests.map((req, idx) => (
                  <div key={idx} className="panic-buy-pill">
                    <span className="panic-club">{req.clubName}</span>
                    <span className="panic-pos">{positionLabel(req.positionNeeded)}</span>
                    <span className="panic-budget">Até {formatMoney(req.budgetMax)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Auctions Section */}
          <div className="deadline-auctions-container">
            <div className="deadline-section-title">
              <h3>Leilões Ativos na Janela ({deadlineDay?.auctions.length ?? 0})</h3>
              <span className="deadline-section-sub">
                Cada novo lance deve ser pelo menos 5% superior ao lance atual.
              </span>
            </div>

            {(!deadlineDay?.auctions || deadlineDay.auctions.length === 0) ? (
              <div className="card empty-state" style={{ padding: 40, textAlign: 'center' }}>
                <p>Nenhum atleta em leilão nesta janela de transferências.</p>
                <button
                  type="button"
                  className="btn-action-secondary"
                  onClick={() => setTab('market')}
                  style={{ marginTop: 12 }}
                >
                  Ver Mercado Normal e Listar Jogadores
                </button>
              </div>
            ) : (
              <div className="deadline-auctions-grid">
                {deadlineDay.auctions.map((item) => {
                  const minNext = nextMinimumBid(item);
                  const isWinning = item.highestBidderClubId === club.id;
                  const isSeller = item.sellerClubId === club.id;

                  return (
                    <div
                      key={item.id}
                      className={`card deadline-auction-card ${item.isPanicSell ? 'panic-sell-glow' : ''} ${item.status !== 'ACTIVE' ? 'resolved' : ''}`}
                    >
                      {item.isPanicSell && (
                        <div className="panic-sell-badge">
                          <AlertTriangleIcon size={12} color="#fff" /> PANIC SELL -{item.panicDiscountPct}%
                        </div>
                      )}

                      <div className="auction-card-top">
                        <div className="player-info-main">
                          <span className={`pos-badge pos-${item.player.position}`}>{item.player.position}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong className="player-name">{item.player.name}</strong>
                              <TierBadge player={item.player} />
                            </div>
                            <span className="player-meta-sub">
                              {item.player.overall} OVR • {item.player.age} anos • {footLabel(item.player.preferredFoot)}
                            </span>
                          </div>
                        </div>

                        <div className="auction-status-tag">
                          {item.status === 'ACTIVE' && (
                            <span className="tag-active"><ClockIcon size={12} /> {item.hoursRemaining}h rest.</span>
                          )}
                          {item.status === 'RESOLVED_SOLD' && (
                            <span className="tag-sold">✓ VENDIDO ({formatMoney(item.currentBid)})</span>
                          )}
                          {item.status === 'RESOLVED_UNSOLD' && (
                            <span className="tag-unsold">✕ ENCERRADO SEM LANCE</span>
                          )}
                        </div>
                      </div>

                      <div className="auction-club-row">
                        <span>Clube Vendedor:</span>
                        <strong>{item.sellerClubName}</strong>
                      </div>

                      <div className="auction-bid-status-box">
                        <div className="bid-row">
                          <span>Lance Atual:</span>
                          <strong className="bid-current-amount">
                            {item.currentBid > 0 ? formatMoney(item.currentBid) : 'Nenhum lance'}
                          </strong>
                        </div>
                        {item.highestBidderClubName && (
                          <div className="bid-row leader-row">
                            <span>Maior Ofertante:</span>
                            <strong className={isWinning ? 'text-positive' : ''}>
                              {isWinning ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TrophyIcon size={14} color="#ffd700" /> Você lidera!</span> : item.highestBidderClubName}
                            </strong>
                          </div>
                        )}
                        <div className="bid-row sub">
                          <span>Lance Mínimo Próximo:</span>
                          <strong>{formatMoney(minNext)}</strong>
                        </div>
                      </div>

                      {/* Bidding Controls (only when active and not seller) */}
                      {item.status === 'ACTIVE' && !isSeller && (
                        <div className="auction-bid-actions">
                          <button
                            type="button"
                            className="btn-action-primary quick-bid-btn"
                            disabled={deadlineBusy || club.budget < minNext}
                            onClick={() => {
                              setDeadlineBid((prev) => ({ ...prev, [item.id]: String(minNext) }));
                              handleDeadlineBid(item);
                            }}
                          >
                            Cobrir Lance ({formatMoney(minNext)})
                          </button>

                          <div className="custom-bid-form">
                            <div className="bid-input-group">
                              <label>Seu Lance (R$)</label>
                              <input
                                type="number"
                                min={minNext}
                                step={10000}
                                placeholder={String(minNext)}
                                value={deadlineBid[item.id] ?? ''}
                                onChange={(e) =>
                                  setDeadlineBid((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                              />
                            </div>
                            <div className="bid-input-group">
                              <label>Salário (R$/sem)</label>
                              <input
                                type="number"
                                min={item.player.wage}
                                step={1000}
                                placeholder={String(item.player.wage)}
                                value={deadlineWage[item.id] ?? ''}
                                onChange={(e) =>
                                  setDeadlineWage((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                              />
                            </div>
                            <button
                              type="button"
                              className="btn-action-secondary"
                              disabled={deadlineBusy || club.budget < (Number(deadlineBid[item.id]) || minNext)}
                              onClick={() => handleDeadlineBid(item)}
                              style={{ alignSelf: 'flex-end' }}
                            >
                              Dar Lance
                            </button>
                          </div>
                        </div>
                      )}

                      {isSeller && (
                        <div className="seller-notice">
                          <span><ShieldIcon size={14} /> Seu atleta colocado à venda na janela.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 5: COMISSÃO TÉCNICA E DIRETORES
          ========================================================================= */}
      {/* =========================================================================
          MODAL: PAGAR MULTA RESCISÓRIA (COMPRA INSTANTÂNEA)
          ========================================================================= */}
      {buyoutTarget && (
        <div className="options-modal-backdrop" onClick={() => setBuyoutTarget(null)}>
          <div className="options-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="options-modal-header">
              <div className="options-modal-title">
                <LightningIcon size={24} color="#f59e0b" />
                <h2>Pagar Multa Rescisória</h2>
              </div>
              <button type="button" className="options-modal-close" onClick={() => setBuyoutTarget(null)}>✕</button>
            </div>
            <div className="options-modal-body">
              <p style={{ margin: 0, fontSize: '0.88rem' }}>
                O pagamento integral da multa rescisória dispensa a aprovação do clube vendedor. O jogador aceita os termos e se transfere imediatamente.
              </p>

              <div className="buyout-details-box">
                <div className="buyout-row">
                  <span>Atleta Alvo:</span>
                  <strong>{buyoutTarget.player.name} ({positionLabel(buyoutTarget.player.position)} • {buyoutTarget.player.overall} OVR)</strong>
                </div>
                <div className="buyout-row">
                  <span>Clube Detentor:</span>
                  <strong>{buyoutTarget.sellerClubName}</strong>
                </div>
                <div className="buyout-row">
                  <span>Multa Rescisória:</span>
                  <strong style={{ color: '#ffd700' }}>{formatMoney(buyoutTarget.player.releaseClause)}</strong>
                </div>

                <div className="buyout-row highlight">
                  <span>Custo Líquido ao seu Caixa:</span>
                  <strong style={{ color: '#4ade80', fontSize: '1.1rem' }}>
                    {formatMoney(
                      Math.max(
                        0,
                        buyoutTarget.player.releaseClause -
                          ((buyoutTarget.player.overall >= 80 || buyoutTarget.player.starLevel !== 'NONE') ? Math.min(buyoutTarget.player.releaseClause, craqueFundRemaining) : 0)
                      )
                    )}
                  </strong>
                </div>

                <div className="buyout-row">
                  <span>Novo Salário Semanal:</span>
                  <span>{formatMoney(buyoutTarget.player.wage)}/sem</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn-options-action save"
                  style={{ flex: 1 }}
                  onClick={handleConfirmBuyout}
                >
                  Confirmar Pagamento e Contratar
                </button>
                <button type="button" className="btn-options-action quit" onClick={() => setBuyoutTarget(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: FAZER PROPOSTA OFICIAL COM INTELIGÊNCIA DE NEGOCIAÇÃO
          ========================================================================= */}
      {proposalTarget && (
        <div className="options-modal-backdrop" onClick={() => setProposalTarget(null)}>
          <div className="options-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="options-modal-header">
              <div className="options-modal-title">
                <UsersIcon size={24} color="#38bdf8" />
                <h2>Proposta Oficial por {proposalTarget.player.name}</h2>
              </div>
              <button type="button" className="options-modal-close" onClick={() => setProposalTarget(null)}>✕</button>
            </div>
            <div className="options-modal-body">
              <form onSubmit={handleSendProposal} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: '0.85rem' }}>
                  Clube Vendedor: <strong>{proposalTarget.sellerClubName}</strong> • Valor de Mercado: <strong>{formatMoney(proposalTarget.player.marketValue)}</strong>
                </div>

                {/* Live Negotiation Viability & Intelligence Box */}
                <div className="negotiation-intel-box">
                  <span className="intel-title">Análise de Viabilidade da Diretoria:</span>
                  
                  {prestigeDelta > 15 ? (
                    <div className="intel-pill positive">
                      <strong>Clube de Maior Expressão:</strong> O atleta tem grande entusiasmo pelo projeto do seu clube (+30% atratividade).
                    </div>
                  ) : prestigeDelta < -15 ? (
                    <div className="intel-pill warning">
                      <strong>Clube de Menor Expressão:</strong> O atleta reluta em ir para uma divisão/clube inferior. O vendedor exigirá compensação superior.
                    </div>
                  ) : (
                    <div className="intel-pill neutral">
                      <strong>Forças Equivalentes:</strong> Negociação equilibrada de mercado.
                    </div>
                  )}

                  {directorDiscount > 0 && (
                    <div className="intel-pill positive">
                      <strong>Diretor de Futebol ({footballDirector?.name}):</strong> +{(directorDiscount * 100).toFixed(0)}% de persuasão e desconto na contraproposta.
                    </div>
                  )}

                  {bankGuaranteeNeeded && (
                    <div className={`intel-pill ${hasApprovedBankGuarantee ? 'positive' : 'warning'}`}>
                      <strong>Fiança Bancária:</strong> {hasApprovedBankGuarantee ? '✓ Carta de fiança ativa para cobrir as parcelas.' : 'Atenção: Compras parceladas sem garantia bancária correm alto risco de recusa.'}
                    </div>
                  )}
                </div>

                <label>
                  Valor em Dinheiro (R$)
                  <input
                    type="number"
                    placeholder="Ex: 8000000"
                    min={0}
                    value={proposalCash}
                    onChange={(e) => setProposalCash(e.target.value)}
                    required
                  />
                </label>

                <label>
                  Forma de Pagamento / Parcelamento
                  <select value={proposalInstallments} onChange={(e) => setProposalInstallments(e.target.value)}>
                    <option value="1">1x (À vista no ato da aceitação)</option>
                    <option value="3">3x parcelas semanais</option>
                    <option value="6">6x parcelas semanais</option>
                    <option value="12">12x parcelas semanais (Garantia Estendida)</option>
                  </select>
                </label>

                {isInstallmentsProposal && (
                  <label className="checkbox-label" style={{ fontSize: '0.85rem', color: '#7fd0ff', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={proposalHasBankGuarantee}
                      onChange={(e) => setProposalHasBankGuarantee(e.target.checked)}
                    />
                    Vincular Carta de Fiança Bancária do Clube
                  </label>
                )}

                <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
                  <legend style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffd700' }}>Jogadores em Troca (Opcional)</legend>
                  <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {club.players.map((p) => (
                      <label key={p.id} className="checkbox-label" style={{ fontSize: '0.78rem' }}>
                        <input
                          type="checkbox"
                          checked={proposalOfferedIds.includes(p.id)}
                          onChange={() =>
                            setProposalOfferedIds((prev) =>
                              prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            )
                          }
                        />
                        {p.name} ({positionLabel(p.position)} • {p.overall} OVR) • {formatMoney(p.marketValue)}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="submit" className="btn-options-action save" style={{ flex: 1 }}>
                    Enviar Proposta Oficial
                  </button>
                  <button type="button" className="btn-options-action quit" onClick={() => setProposalTarget(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: AJUSTAR MULTA RESCISÓRIA INDIVIDUAL
          ========================================================================= */}
      {editClausePlayer && (
        <div className="options-modal-backdrop" onClick={() => setEditClausePlayer(null)}>
          <div className="options-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="options-modal-header">
              <div className="options-modal-title">
                <ShieldIcon size={24} color="#38bdf8" />
                <h2>Ajustar Multa: {editClausePlayer.name}</h2>
              </div>
              <button type="button" className="options-modal-close" onClick={() => setEditClausePlayer(null)}>✕</button>
            </div>
            <div className="options-modal-body">
              <form onSubmit={handleSaveCustomClause} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Aumentar a multa rescisória protege o jogador contra assédio, mas ele exigirá um salário proporcionalmente maior.
                </p>

                <div className="buyout-details-box">
                  <div className="buyout-row">
                    <span>Valor de Mercado:</span>
                    <strong>{formatMoney(editClausePlayer.marketValue)}</strong>
                  </div>
                  <div className="buyout-row">
                    <span>Multa Atual:</span>
                    <strong>{formatMoney(editClausePlayer.releaseClause)}</strong>
                  </div>
                  <div className="buyout-row">
                    <span>Salário Atual:</span>
                    <span>{formatMoney(editClausePlayer.wage)}/sem</span>
                  </div>
                </div>

                <label>
                  Nova Multa Rescisória (R$)
                  <input
                    type="number"
                    min={editClausePlayer.marketValue}
                    step={100000}
                    value={customClauseValue}
                    onChange={(e) => setCustomClauseValue(e.target.value)}
                    required
                  />
                </label>

                {Number(customClauseValue) > 0 && (
                  <div className="buyout-details-box" style={{ background: 'rgba(212,175,55,0.08)' }}>
                    <div className="buyout-row">
                      <span>Novo Salário Estimado:</span>
                      <strong style={{ color: '#ffd700' }}>
                        {formatMoney(
                          calculateAdjustedWageForReleaseClause(
                            editClausePlayer,
                            Number(customClauseValue),
                            footballDirector?.rating
                          )
                        )}/sem
                      </strong>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="submit" className="btn-options-action save" style={{ flex: 1 }}>
                    Salvar Novo Contrato
                  </button>
                  <button type="button" className="btn-options-action quit" onClick={() => setEditClausePlayer(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {comparisonReferencePlayer && comparisonTargetPlayer && (
        <PlayerComparisonModal
          isOpen={comparisonModalOpen}
          onClose={() => setComparisonModalOpen(false)}
          primaryPlayer={comparisonReferencePlayer}
          secondaryPlayer={comparisonTargetPlayer}
          squad={club.players}
          onSelectSecondaryPlayer={(p) => setComparisonReferencePlayer(p)}
        />
      )}
    </div>
  );
}
