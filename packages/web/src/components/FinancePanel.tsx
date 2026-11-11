import { useState } from 'react';
import { AccountStatement } from './AccountStatement.js';
import type { Club, LoanPlanKey, Sponsorship, SponsorGoal } from '@tactical-arena/shared';
import {
  CONTRACT_LENGTHS,
  LOAN_PLANS,
  MAX_LOAN_AMOUNT,
  MAX_SPONSORSHIPS,
  MIN_LOAN_AMOUNT,
  SPONSOR_TYPES,
  calculateBankGuaranteeEligibility,
  calculateClubVisibility,
  calculateInitialMembers,
  calculateLoanTerms,
  calculateMembershipWeeklyRevenue,
  generateSeasonBroadcastTargets,
  getMembershipTier,
  getSponsorLogoUrl,
  sponsorArtSlug,
  ALL_BROADCASTER_CHANNELS,
} from '@tactical-arena/shared';
import { getSponsorshipOffers, signSponsorship, takeLoan } from '../api/client.js';
import { ClubCrest } from './ClubCrest.js';
import { BroadcastLogo } from './BroadcastLogo.js';

interface FinancePanelProps {
  club: Club;
  onUpdate: (club: Club) => void;
  onError: (message: string) => void;
  /** Qual metade mostrar: o quadro de patrocínios, ou o resto do dinheiro do clube. */
  secao?: 'patrocinios' | 'conta';
}

type FinanceTab = 'sponsors' | 'goals' | 'broadcasting' | 'loans';

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function sponsorTypeLabel(type: string): string {
  return SPONSOR_TYPES.find((t) => t.type === type)?.label ?? type;
}

function contractLengthLabel(key: string): string {
  return CONTRACT_LENGTHS.find((c) => c.key === key)?.label ?? key;
}

function getTotalContractWeeks(contractLength: string, weeksRemaining: number): number {
  if (contractLength === 'CURTO') return Math.max(weeksRemaining, 21);
  if (contractLength === 'MEDIO') return Math.max(weeksRemaining, 30);
  if (contractLength === 'LONGO') return Math.max(weeksRemaining, 65);
  return Math.max(weeksRemaining, 52);
}

function getProfileBadge(profile?: string): { label: string; className: string; icon: string; desc: string } {
  switch (profile) {
    case 'MECENAS':
      return {
        label: 'Investidor Mecenas',
        className: 'profile-mecenas',
        icon: '',
        desc: 'Mega aporte imediato no caixa para contratações + metas de topo.',
      };
    case 'PERFORMANCE':
      return {
        label: 'Foco em Performance',
        className: 'profile-performance',
        icon: '',
        desc: 'Valores equilibrados com grandes premiações por metas alcançadas.',
      };
    case 'ESTAVEL':
    default:
      return {
        label: 'Estável e Seguro',
        className: 'profile-estavel',
        icon: '',
        desc: 'Maior valor semanal garantido, contrato longo e metas realistas.',
      };
  }
}

export function FinancePanel({ club, onUpdate, onError, secao = 'conta' }: FinancePanelProps) {
  /**
   * Qual metade do painel esta tela mostra.
   *
   * O painel era um só, com quatro abas, e patrocínio era a primeira delas: dois níveis fundo, dentro de
   * "Finanças", para a única receita que o técnico negocia. Agora patrocínio tem card e tela próprios, e o
   * resto ficou com o nome do que é, conta corrente. O componente continua sendo um, porque as duas metades
   * compartilham o cabeçalho de caixa e as mesmas ações sobre o clube.
   */
  const abas: FinanceTab[] = secao === 'patrocinios' ? ['sponsors'] : ['goals', 'broadcasting', 'loans'];
  const [activeTab, setActiveTab] = useState<FinanceTab>(abas[0]);
  const [offers, setOffers] = useState<Sponsorship[] | null>(null);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanPlanKey, setLoanPlanKey] = useState<LoanPlanKey>('MEDIO');
  const [loadingOffers, setLoadingOffers] = useState(false);
  /** O último contrato assinado, para a tela confirmar o que acabou de acontecer. */
  const [assinado, setAssinado] = useState<
    { sponsorName: string; weeklyAmount: number; signingBonus: number; substituido: string | null } | null
  >(null);
  const [signingOfferId, setSigningOfferId] = useState<string | null>(null);
  const [takingLoan, setTakingLoan] = useState(false);
  const [dismissedOfferIds, setDismissedOfferIds] = useState<Set<string>>(new Set());

  function handleDismissOffer(offerId: string) {
    setDismissedOfferIds((prev) => new Set([...prev, offerId]));
  }

  function handleDismissAllPoachOffers() {
    setDismissedOfferIds((prev) => {
      const next = new Set(prev);
      offers?.forEach((o) => {
        if (o.isPoachOffer) next.add(o.id);
      });
      return next;
    });
  }

  const totalWeekly = club.sponsorships.reduce((acc, s) => acc + s.weeklyAmount, 0);
  const estimatedAnnual = totalWeekly * 52;
  const maxWeeklyAmount = club.sponsorships.length > 0 ? Math.max(...club.sponsorships.map((s) => s.weeklyAmount)) : 0;

  // Sócio-Torcedor & Visibilidade
  const membersCount = club.membersCount ?? calculateInitialMembers(club, 1);
  const membershipTier = getMembershipTier(membersCount);
  const membershipWeeklyRevenue = calculateMembershipWeeklyRevenue(membersCount);
  const visibility = calculateClubVisibility(club, 1, 0, membersCount);
  const broadcastTargets = generateSeasonBroadcastTargets(visibility.score, 1);
  const bankGuarantees = calculateBankGuaranteeEligibility(club.budget, visibility.score);

  // Metas ativas de todos os patrocinadores
  const allActiveGoals: { sponsorName: string; sponsorType: string; goal: SponsorGoal }[] = [];
  club.sponsorships.forEach((s) => {
    s.goals?.forEach((g) => {
      allActiveGoals.push({ sponsorName: s.sponsorName, sponsorType: s.type, goal: g });
    });
  });

  const totalPotentialRewards = allActiveGoals.reduce((sum, g) => sum + g.goal.reward, 0);
  const totalCompletedRewards = allActiveGoals.filter((g) => g.goal.isCompleted).reduce((sum, g) => sum + g.goal.reward, 0);

  async function handleLoadOffers() {
    setLoadingOffers(true);
    try {
      setOffers(await getSponsorshipOffers(club.id));
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoadingOffers(false);
    }
  }

  /**
   * Assina o contrato com o patrocinador escolhido.
   *
   * Mantém a mesa de negociação aberta para que o próprio usuário decida quando quer sair,
   * permitindo avaliar e fechar contratos para as demais cotas em sequência sem ser
   * arremessado de volta à tela inicial a cada clique.
   */
  async function handleSignSponsorship(offer: Sponsorship) {
    setSigningOfferId(offer.id);
    try {
      const anterior = club.sponsorships.find((s) => s.type === offer.type);
      const updated = await signSponsorship(club.id, offer);

      // Ao aceitar uma proposta para uma cota, descarta a própria e todas as outras propostas concorrentes da mesma cota
      setDismissedOfferIds((prev) => {
        const next = new Set(prev);
        next.add(offer.id);
        offers?.forEach((o) => {
          if (o.type === offer.type || (anterior && o.replacedSponsorName === anterior.sponsorName)) {
            next.add(o.id);
          }
        });
        return next;
      });

      onUpdate(updated);
      setAssinado({
        sponsorName: offer.sponsorName,
        weeklyAmount: offer.weeklyAmount,
        signingBonus: offer.signingBonus ?? 0,
        substituido: anterior?.sponsorName ?? null,
      });

      // Recarrega propostas para atualizar o incumbente e permitir negociar outras cotas,
      // filtrando qualquer proposta remanescente da cota recém-assinada para evitar que
      // ofertas rivais menos favoráveis continuem na tela e induzam o jogador a erro.
      try {
        const freshOffers = await getSponsorshipOffers(club.id);
        setOffers(freshOffers.filter((o) => o.type !== offer.type && o.id !== offer.id));
      } catch {
        setOffers((prev) => (prev ? prev.filter((o) => o.type !== offer.type && o.id !== offer.id) : null));
      }
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSigningOfferId(null);
    }
  }

  async function handleTakeLoan(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(loanAmount);
    if (!amount) return;
    setTakingLoan(true);
    try {
      onUpdate(await takeLoan(club.id, amount, loanPlanKey));
      setLoanAmount('');
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setTakingLoan(false);
    }
  }

  const amountForPreview = Number(loanAmount) || 0;

  /**
   * What already occupies each slot.
   *
   * An offer for a type the club already holds is not an offer in a vacuum, it is a swap: the manager is
   * being asked whether this is better than what they have. Without the incumbent on the same screen that
   * question cannot be answered without leaving the table and coming back, which is the one thing a
   * negotiation table exists to avoid.
   */
  const activeByType = new Map(club.sponsorships.map((s) => [s.type, s]));

  // Group candidate proposals by sponsorship type
  const offersByType = new Map<Sponsorship["type"], Sponsorship[]>();
  const poachOffers: Sponsorship[] = [];

  offers?.forEach((o) => {
    if (dismissedOfferIds.has(o.id)) return;
    if (o.isPoachOffer) {
      const atual = activeByType.get(o.type);
      // Se não há patrocinador para rescindir, ou o patrocinador atual já é o próprio, ou o patrocinador atual já mudou em relação a quem essa proposta veio substituir, ou o valor semanal não é superior ao atual, descarta
      if (!atual || atual.sponsorName === o.sponsorName || o.weeklyAmount <= atual.weeklyAmount) return;
      if (o.replacedSponsorName && atual.sponsorName !== o.replacedSponsorName) return;
      poachOffers.push(o);
    } else {
      const list = offersByType.get(o.type) ?? [];
      list.push(o);
      offersByType.set(o.type, list);
    }
  });

  return (
    <div className="finance-pro-container">
      {/*
        O cartão de topo é o do patrocínio: nome, porte e total contratado por semana.
        Na conta corrente ele só repetia o caixa e o total de patrocínio que o extrato logo abaixo já diz,
        com mais detalhe. Duas vezes o mesmo número na mesma tela é ruído.
      */}
      {secao === 'patrocinios' && (
      <div className="finance-pro-header">
        <div className="finance-club-profile">
          <ClubCrest club={club} size={48} />
          <div>
            <h2 className="finance-club-name">{club.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span className="visibility-tier-tag" data-tier={visibility.tier}>
                {visibility.label}
              </span>
              <span className="membership-tier-tag">Sócio {membershipTier.label}</span>
            </div>
          </div>
        </div>

        <div className="finance-budget-block">
          <span className="finance-budget-label">Orçamento em Caixa:</span>
          <span className={`finance-budget-value ${club.budget < 0 ? 'error' : ''}`}>{formatMoney(club.budget)}</span>
        </div>

        <div className="finance-total-sponsors-badge">
          
          <div className="finance-total-sponsors-text">
            <span className="finance-total-sponsors-title">PATROCÍNIOS ATIVOS:</span>
            <span className="finance-total-sponsors-amount">{formatMoney(totalWeekly)}/sem</span>
            <span className="finance-total-sponsors-sub">Anual: {formatMoney(estimatedAnnual)}</span>
          </div>
        </div>
      </div>
      )}

      {/* O extrato abre a tela de conta corrente: entradas, saídas, saúde e projeção antes de qualquer aba. */}
      {secao === 'conta' && <AccountStatement club={club} />}

      {/*
        Uma aba sozinha não é escolha, então a barra não é desenhada.
        Não é `hidden`: `.finance-nav-tabs-bar` é `display: flex` no CSS, e display explícito ganha do
        atributo. A barra continuava na tela com as pílulas escondidas ocupando lugar.
      */}
      {abas.length > 1 && (
      <div className="finance-nav-tabs-bar">
        <button
          type="button"
          className={`finance-tab-pill-btn ${activeTab === 'sponsors' ? 'active' : ''}`}
          onClick={() => setActiveTab('sponsors')}
          style={{ display: abas.includes('sponsors') ? undefined : 'none' }}
        >
          Patrocínios e Propostas ({club.sponsorships.length}/{MAX_SPONSORSHIPS})
        </button>
        <button
          type="button"
          className={`finance-tab-pill-btn ${activeTab === 'goals' ? 'active' : ''}`}
          onClick={() => setActiveTab('goals')}
          style={{ display: abas.includes('goals') ? undefined : 'none' }}
        >
          Metas de Desempenho ({allActiveGoals.length})
        </button>
        <button
          type="button"
          className={`finance-tab-pill-btn ${activeTab === 'broadcasting' ? 'active' : ''}`}
          onClick={() => setActiveTab('broadcasting')}
          style={{ display: abas.includes('broadcasting') ? undefined : 'none' }}
        >
          Transmissão e Sócio-Torcedor
        </button>
        <button
          type="button"
          className={`finance-tab-pill-btn ${activeTab === 'loans' ? 'active' : ''}`}
          onClick={() => setActiveTab('loans')}
          style={{ display: abas.includes('loans') ? undefined : 'none' }}
        >
          Bancos, Empréstimos e Caixa
        </button>
      </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: PATROCÍNIOS & MERCADO DE PROPOSTAS                                */}
      {/* ========================================================================= */}
      {activeTab === 'sponsors' && (
        <div className="finance-tab-content">
          {/* Propostas de Concorrentes no Meio da Temporada (Poaching / Assédio) */}
          {poachOffers.length > 0 && (
            <div className="poach-alert-container">
              <div className="poach-alert-header">
                <div>
                  <h3 className="poach-alert-title">PROPOSTAS CONCORRENTES NO MEIO DA TEMPORADA!</h3>
                  <p className="poach-alert-desc">
                    O excelente desempenho do seu time atraiu concorrentes de peso no mercado dispostos a cobrir a rescisão e
                    aumentar as receitas do clube!
                  </p>
                </div>
                <button
                  type="button"
                  className="poach-dismiss-all-btn"
                  onClick={handleDismissAllPoachOffers}
                  title="Dispensar todas as propostas concorrentes"
                >
                  ✕ Dispensar Propostas
                </button>
              </div>

              <div className="poach-cards-grid">
                {poachOffers.map((o) => {
                  const isSigning = signingOfferId === o.id;
                  const profile = getProfileBadge(o.sponsorProfile);
                  const atual = activeByType.get(o.type);
                  const cotaNome = sponsorTypeLabel(o.type);
                  const ganhoSemanal = atual ? o.weeklyAmount - atual.weeklyAmount : o.weeklyAmount;

                  return (
                    <div key={o.id} className="poach-offer-card">
                      <div className="poach-cota-header">
                        <span className="poach-cota-badge">COTA: {cotaNome.toUpperCase()}</span>
                        <span className="poach-cota-hint">Concorre pela cota de {cotaNome}</span>
                      </div>

                      <div className="poach-card-top">
                        <div className="sponsor-pro-logo-wrap">
                          <img
                            src={getSponsorLogoUrl(o.sponsorName, o.type)}
                            alt={o.sponsorName}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span className="poach-replace-tag">Substituir {o.replacedSponsorName || atual?.sponsorName}</span>
                          <h4 className="poach-sponsor-name">{o.sponsorName}</h4>
                          <span className={`sponsor-profile-tag ${profile.className}`}>
                            {profile.icon} {profile.label}
                          </span>
                        </div>
                      </div>

                      {/* Quadro Comparativo: Atual vs Proposta */}
                      {atual && (
                        <div className="poach-vs-box">
                          <div className="poach-vs-row">
                            <span className="poach-vs-label">Atual ({atual.sponsorName}):</span>
                            <span className="poach-vs-val muted">{formatMoney(atual.weeklyAmount)}/sem</span>
                          </div>
                          <div className="poach-vs-row highlight">
                            <span className="poach-vs-label">Nova Proposta:</span>
                            <span className="poach-vs-val gold">{formatMoney(o.weeklyAmount)}/sem</span>
                          </div>
                          <div className="poach-vs-delta">
                            <span>Aumento Líquido:</span>
                            <strong className="green">+{formatMoney(ganhoSemanal)}/sem</strong>
                          </div>
                        </div>
                      )}

                      <div className="poach-financial-row">
                        <div className="poach-stat-col">
                          <span className="stat-label">NOVA RECEITA SEMANAL</span>
                          <strong className="stat-value highlight">+{formatMoney(o.weeklyAmount)}/sem</strong>
                        </div>
                        {o.signingBonus ? (
                          <div className="poach-stat-col">
                            <span className="stat-label">APORTE IMEDIATO DE REFORÇOS</span>
                            <strong className="stat-value green">+{formatMoney(o.signingBonus)}</strong>
                          </div>
                        ) : null}
                      </div>

                      {o.goals && o.goals.length > 0 && (
                        <div className="sponsor-offer-goals-box">
                          <span className="goals-header-label">Metas Contratuais:</span>
                          {o.goals.map((g) => (
                            <div key={g.id} className="sponsor-offer-goal-item">
                              <span>• {g.title}</span>
                              <strong className="gold">+{formatMoney(g.reward)}</strong>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="poach-buttons-row">
                        <button
                          type="button"
                          className="btn-options-action save poach-action-btn"
                          onClick={() => handleSignSponsorship(o)}
                          disabled={isSigning}
                        >
                          {isSigning ? 'Assinando e Rompendo...' : `Aceitar e Trocar ${cotaNome}`}
                        </button>
                        <button
                          type="button"
                          className="poach-reject-btn"
                          onClick={() => handleDismissOffer(o.id)}
                          disabled={isSigning}
                        >
                          Recusar (Manter {atual?.sponsorName ?? 'Atual'})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/*
            Confirmação de contrato assinado: informa claramente quem entrou, por quanto,
            e quem foi substituído, confirmando que propostas concorrentes foram encerradas.
          */}
          {assinado && (
            <div className="contrato-assinado" role="status" style={{ marginBottom: 16 }}>
              <span className="contrato-assinado-icone" aria-hidden="true">✓</span>
              <div className="contrato-assinado-texto">
                <strong>Contrato assinado com {assinado.sponsorName}!</strong>
                <span>
                  {formatMoney(assinado.weeklyAmount)}/sem
                  {assinado.signingBonus > 0 && ` e +${formatMoney(assinado.signingBonus)} de bônus imediato no caixa`}
                  {assinado.substituido && ` (substituindo ${assinado.substituido})`}
                  . As propostas concorrentes para esta cota foram encerradas.
                </span>
              </div>
              <button type="button" className="contrato-assinado-fechar" onClick={() => setAssinado(null)} aria-label="Fechar aviso">
                ✕
              </button>
            </div>
          )}

          {/* Card com Patrocínios Ativos */}
          <div className="sponsors-pro-card">
            <div className="sponsors-pro-header">
              <h3 className="sponsors-pro-title">
                PATROCÍNIOS ATIVOS ({club.sponsorships.length}/{MAX_SPONSORSHIPS})
              </h3>
              {offers === null ? (
                <button
                  type="button"
                  className="btn-options-action save"
                  style={{ padding: '8px 18px', fontSize: '0.84rem' }}
                  onClick={handleLoadOffers}
                  disabled={loadingOffers}
                >
                  {loadingOffers ? 'Buscando Mercado...' : 'Negociar / Ver Propostas Concorrentes'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-options-action info"
                  style={{ padding: '8px 18px', fontSize: '0.84rem' }}
                  onClick={() => setOffers(null)}
                >
                  ✕ Fechar Mesa de Negociação
                </button>
              )}
            </div>

            {club.sponsorships.length === 0 && (
              <p className="muted" style={{ padding: '16px 0' }}>
                Nenhum patrocínio ativo no momento. Clique no botão acima para abrir a mesa de negociação e escolher as melhores propostas para o seu clube.
              </p>
            )}

            <div className="sponsors-pro-list">
              {club.sponsorships.map((s) => {
                const totalWeeks = getTotalContractWeeks(s.contractLength, s.weeksRemaining);
                const percentRemaining = Math.max(1, Math.round((s.weeksRemaining / totalWeeks) * 100));
                const isBestDeal = s.weeklyAmount === maxWeeklyAmount && club.sponsorships.length > 1;
                const slug = sponsorArtSlug(s.sponsorName);
                const profile = getProfileBadge(s.sponsorProfile);

                return (
                  <div key={s.id} className={`sponsor-pro-row ${s.type === 'MASTER' ? 'master' : ''}`}>
                    {/* Logo & Identidade */}
                    <div className="sponsor-pro-identity">
                      <div className="sponsor-pro-logo-wrap">
                        <img
                          src={getSponsorLogoUrl(s.sponsorName, s.type)}
                          alt={s.sponsorName}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="sponsor-pro-identity-text">
                        <span className="sponsor-pro-type-label">{sponsorTypeLabel(s.type)}</span>
                        <span className="sponsor-pro-name">{s.sponsorName}</span>
                        <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                          <span className={`sponsor-profile-tag ${profile.className}`}>{profile.label}</span>
                          {isBestDeal && <span className="sponsor-pro-best-badge">MAIOR ACORDO</span>}
                        </div>
                      </div>
                    </div>

                    {/* Valor Semanal & Aporte */}
                    <div className="sponsor-pro-weekly">
                      <span className="sponsor-pro-weekly-amount">{formatMoney(s.weeklyAmount)}/sem</span>
                      <span className="sponsor-pro-weekly-sub">{formatMoney(s.weeklyAmount * 52)}/ano</span>
                      {s.signingBonus ? (
                        <span className="sponsor-signing-bonus-tag">Aporte: +{formatMoney(s.signingBonus)}</span>
                      ) : null}
                    </div>

                    {/* Vigência */}
                    <div className="sponsor-pro-time-col">
                      <span className="sponsor-pro-col-label">VIGÊNCIA RESTANTE</span>
                      <div className="sponsor-pro-time-bar">
                        <div className="sponsor-pro-time-fill" style={{ width: `${percentRemaining}%` }} />
                      </div>
                      <span className="sponsor-pro-time-text">
                        {s.weeksRemaining}/{totalWeeks} sem · {percentRemaining}%
                      </span>
                    </div>

                    {/* Duração */}
                    <div className="sponsor-pro-time-col">
                      <span className="sponsor-pro-col-label">DURAÇÃO</span>
                      <span className="sponsor-pro-length-text">{contractLengthLabel(s.contractLength)}</span>
                    </div>

                    {/* Metas / Bônus */}
                    <div className="sponsor-pro-bonus-col">
                      <span className="sponsor-pro-col-label">BÔNUS E METAS</span>
                      <span>Título: {formatMoney(s.titleBonus)}</span>
                      <span>Copa: {formatMoney(s.cupBonus)}</span>
                      {s.goals && s.goals.length > 0 ? (
                        <span className="gold">{s.goals.filter((g) => g.isCompleted).length}/{s.goals.length} metas batidas</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MESA DE NEGOCIAÇÃO COMPARATIVA (PROPOSTAS CONCORRENTES LADO A LADO) */}
          {offers !== null && (
            <div className="negotiation-table-section">
              <div className="negotiation-table-header">
                <div>
                  <h3 className="negotiation-table-title">MESA DE NEGOCIAÇÃO: PROPOSTAS CONCORRENTES</h3>
                  <p className="negotiation-table-sub">
                    Compare as ofertas concorrentes para cada cota. Avalie o equilíbrio entre valor semanal garantido, aporte
                    imediato de contratação e metas contratuais.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-options-action info"
                  style={{ padding: '8px 18px', fontSize: '0.84rem', whiteSpace: 'nowrap' }}
                  onClick={() => setOffers(null)}
                >
                  ✕ Voltar ao Quadro de Patrocinadores
                </button>
              </div>

              {assinado && (
                <div className="contrato-assinado" role="status" style={{ margin: '16px 0 0' }}>
                  <span className="contrato-assinado-icone" aria-hidden="true">✓</span>
                  <div className="contrato-assinado-texto">
                    <strong>Contrato assinado com {assinado.sponsorName}!</strong>
                    <span>
                      {formatMoney(assinado.weeklyAmount)}/sem
                      {assinado.signingBonus > 0 && ` e ${formatMoney(assinado.signingBonus)} de luva no caixa`}
                      {assinado.substituido && `, no lugar de ${assinado.substituido}`}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>
                      Você permanece na mesa de negociação. Avalie e feche as demais cotas abaixo ou clique em "Voltar ao Quadro" quando terminar.
                    </span>
                  </div>
                  <button type="button" className="contrato-assinado-fechar" onClick={() => setAssinado(null)} aria-label="Fechar aviso">
                    ✕
                  </button>
                </div>
              )}

              {offersByType.size === 0 && (
                <p className="muted" style={{ padding: '20px 0' }}>
                  Todas as cotas de patrocínio já estão ocupadas. Aguarde o término dos contratos vigentes ou novas propostas de mercado.
                </p>
              )}

              {Array.from(offersByType.entries()).map(([type, typeOffers]) => (
                <div key={type} className="negotiation-slot-group">
                  <div className="negotiation-slot-header">
                    <span className="negotiation-slot-badge">{sponsorTypeLabel(type)}</span>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      {typeOffers.length} Propostas Concorrentes Disponíveis
                    </span>
                  </div>

                  {/* The deal these proposals are competing with, stated before any of them. */}
                  {activeByType.has(type) && (
                    <div className="negotiation-incumbent">
                      <span className="negotiation-incumbent-tag">Contrato atual</span>
                      <strong className="negotiation-incumbent-name">{activeByType.get(type)!.sponsorName}</strong>
                      <span className="negotiation-incumbent-value">
                        {formatMoney(activeByType.get(type)!.weeklyAmount)}/sem
                      </span>
                      <span className="negotiation-incumbent-rest">
                        {activeByType.get(type)!.weeksRemaining} semanas restantes
                      </span>
                    </div>
                  )}

                  <div className="negotiation-proposals-grid">
                    {typeOffers.map((o) => {
                      const slug = sponsorArtSlug(o.sponsorName);
                      const isSigning = signingOfferId === o.id;
                      const profile = getProfileBadge(o.sponsorProfile);

                      const atual = activeByType.get(o.type);
                      const diferenca = atual ? o.weeklyAmount - atual.weeklyAmount : null;

                      return (
                        <div key={o.id} className={`negotiation-proposal-card ${o.isChallenge ? 'challenge' : ''}`}>
                          {/*
                            The comparison the manager came here to make. Signing this replaces what is in
                            the slot, so the number that decides it is the difference, not the amount.
                          */}
                          {diferenca !== null && (
                            <div className={`proposal-delta ${diferenca > 0 ? 'better' : diferenca < 0 ? 'worse' : 'same'}`}>
                              {diferenca > 0
                                ? `+${formatMoney(diferenca)}/sem sobre o contrato atual`
                                : diferenca < 0
                                  ? `${formatMoney(diferenca)}/sem em relação ao contrato atual`
                                  : 'Mesmo valor do contrato atual'}
                              <span className="proposal-delta-year">
                                {diferenca === 0 ? '' : `${diferenca > 0 ? '+' : ''}${formatMoney(diferenca * 52)}/ano`}
                              </span>
                            </div>
                          )}
                          <div className="proposal-card-header">
                            <div className="sponsor-pro-logo-wrap">
                              <img
                                src={getSponsorLogoUrl(o.sponsorName, o.type)}
                                alt={o.sponsorName}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="proposal-title-box">
                              <h4 className="proposal-sponsor-name">{o.sponsorName}</h4>
                              <span className={`sponsor-profile-tag ${profile.className}`}>
                                {profile.icon} {profile.label}
                              </span>
                            </div>
                          </div>

                          <div className="proposal-financial-main">
                            <div className="proposal-weekly-box">
                              <span className="label">RECEITA SEMANAL</span>
                              <strong className="amount">{formatMoney(o.weeklyAmount)}/sem</strong>
                              <span className="sub">{formatMoney(o.weeklyAmount * 52)}/ano</span>
                            </div>

                            {o.signingBonus ? (
                              <div className="proposal-signing-box">
                                <span className="label">APORTE PARA REFORÇOS</span>
                                <strong className="bonus-amount">+{formatMoney(o.signingBonus)}</strong>
                                <span className="sub">Creditado à vista no caixa</span>
                              </div>
                            ) : null}
                          </div>

                          <div className="proposal-terms-box">
                            <div className="term-row">
                              <span className="term-label">Duração do Contrato:</span>
                              <strong className="term-val">{contractLengthLabel(o.contractLength)} ({o.weeksRemaining} semanas)</strong>
                            </div>
                            {o.craqueFund ? (
                              <div className="term-row">
                                <span className="term-label">Fundo de Craque (80+ OVR):</span>
                                <strong className="term-val gold">{formatMoney(o.craqueFund)}</strong>
                              </div>
                            ) : null}
                          </div>

                          {/* Metas Contratuais Explícitas */}
                          {o.goals && o.goals.length > 0 && (
                            <div className="proposal-goals-list">
                              <span className="goals-section-title">Metas Contratuais:</span>
                              {o.goals.map((g) => (
                                <div key={g.id} className="proposal-goal-row">
                                  <div className="goal-desc-box">
                                    <strong>{g.title}</strong>
                                    <span className="goal-desc">{g.description}</span>
                                  </div>
                                  <span className="goal-reward-tag">+{formatMoney(g.reward)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button
                              type="button"
                              className="btn-options-action save proposal-sign-btn"
                              style={{ flex: 1 }}
                              onClick={() => handleSignSponsorship(o)}
                              disabled={isSigning}
                            >
                              {isSigning
                                ? 'Assinando...'
                                : o.isChallenge
                                  ? 'Trocar Naming Rights'
                                  : atual
                                    ? `Assinar e Trocar (${atual.sponsorName})`
                                    : 'Fechar com Esta Empresa'}
                            </button>
                            <button
                              type="button"
                              className="poach-reject-btn"
                              style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                              onClick={() => handleDismissOffer(o.id)}
                              disabled={isSigning}
                              title="Dispensar esta proposta da mesa de negociação"
                            >
                              ✕ Dispensar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn-options-action save"
                  style={{ padding: '10px 24px', fontSize: '0.9rem' }}
                  onClick={() => setOffers(null)}
                >
                  ✓ Concluir Negociações e Voltar ao Quadro
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: METAS DE DESEMPENHO & CLÁUSULAS CONTRATUAIS                       */}
      {/* ========================================================================= */}
      {activeTab === 'goals' && (
        <div className="finance-tab-content">
          <div className="sponsors-pro-card">
            <div className="sponsors-pro-header">
              <div>
                <h3 className="sponsors-pro-title">
                  METAS CONTRATUAIS ATIVAS DA TEMPORADA
                </h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                  Acompanhe o cumprimento das metas estabelecidas nos contratos de patrocínio. Cada meta alcançada gera
                  premiação financeira direta para o clube.
                </p>
              </div>
              <div className="goals-summary-badge">
                <span className="badge-label">PREMIAÇÃO ACUMULADA:</span>
                <strong className="badge-value green">
                  {formatMoney(totalCompletedRewards)} / {formatMoney(totalPotentialRewards)}
                </strong>
              </div>
            </div>

            {allActiveGoals.length === 0 && (
              <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
                Nenhuma meta contratual ativa no momento. Assine contratos com perfil "Performance" ou "Mecenas" para disputar metas financeiras.
              </p>
            )}

            <div className="active-goals-grid">
              {allActiveGoals.map(({ sponsorName, sponsorType, goal }) => (
                <div key={goal.id} className={`active-goal-card ${goal.isCompleted ? 'completed' : goal.isFailed ? 'failed' : ''}`}>
                  <div className="goal-card-header">
                    <span className="goal-sponsor-pill">
                      {sponsorName} ({sponsorTypeLabel(sponsorType)})
                    </span>
                    <span className={`goal-status-badge ${goal.isCompleted ? 'completed' : goal.isFailed ? 'failed' : 'ongoing'}`}>
                      {goal.isCompleted ? 'Meta Atingida' : goal.isFailed ? 'Não Atingida' : 'Em Andamento'}
                    </span>
                  </div>

                  <h4 className="goal-title-text">{goal.title}</h4>
                  <p className="goal-description-text">{goal.description}</p>

                  <div className="goal-card-footer">
                    <span className="reward-label">Bônus Contratual:</span>
                    <strong className="reward-val gold">+{formatMoney(goal.reward)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: DIREITOS DE TRANSMISSÃO & SÓCIO-TORCEDOR                           */}
      {/* ========================================================================= */}
      {activeTab === 'broadcasting' && (
        <div className="finance-tab-content">
          <div className="finance-overview-2col-grid">
            {/* Sócio-Torcedor */}
            <div className="sponsors-pro-card finance-metric-card">
              <div className="metric-card-header">
                <div className="metric-card-title-wrap">
                  
                  <div>
                    <h3 className="sponsors-pro-title" style={{ margin: 0 }}>PROGRAMA SÓCIO-TORCEDOR</h3>
                    <span className="muted" style={{ fontSize: '0.75rem' }}>Receita recorrente direta dos associados</span>
                  </div>
                </div>
                <span className="membership-tier-pill">{membershipTier.label}</span>
              </div>

              <div className="metric-stats-row">
                <div className="metric-stat-box">
                  <span className="metric-stat-label">SÓCIOS ATIVOS</span>
                  <strong className="metric-stat-value gold">{membersCount.toLocaleString('pt-BR')}</strong>
                  <span className="metric-stat-sub">+{Math.round(membersCount * 0.02).toLocaleString('pt-BR')} nesta fase</span>
                </div>

                <div className="metric-stat-box">
                  <span className="metric-stat-label">RECEITA SEMANAL</span>
                  <strong className="metric-stat-value green">+{formatMoney(membershipWeeklyRevenue)}/sem</strong>
                  <span className="metric-stat-sub">{formatMoney(membershipWeeklyRevenue * 52)}/ano</span>
                </div>
              </div>

              <div className="metric-card-footer">
                <div className="membership-perk-item">
                  
                  <span>Prioridade e cota garantida de até <strong>60%</strong> da capacidade do estádio nos dias de jogo</span>
                </div>
                <div className="membership-perk-item">
                  
                  <span>Adesão acelera com vitórias consecutivas (+2%), clássicos (+4%) e conquista de títulos (+25%)</span>
                </div>
              </div>
            </div>

            {/* Nível de Visibilidade */}
            <div className="sponsors-pro-card finance-metric-card">
              <div className="metric-card-header">
                <div className="metric-card-title-wrap">
                  
                  <div>
                    <h3 className="sponsors-pro-title" style={{ margin: 0 }}>NÍVEL DE VISIBILIDADE</h3>
                    <span className="muted" style={{ fontSize: '0.75rem' }}>Índice de atratividade comercial e audiência</span>
                  </div>
                </div>
                <span className="visibility-score-badge">{visibility.score}/100</span>
              </div>

              <div className="visibility-progress-track">
                <div className="visibility-progress-fill" style={{ width: `${visibility.score}%` }} />
              </div>

              <div className="visibility-factors-grid">
                <div className="visibility-factor-item">
                  <span>Estádio ({club.stadiumCapacity.toLocaleString('pt-BR')})</span>
                  <strong>{Math.round(visibility.breakdown.stadium)} pts</strong>
                </div>
                <div className="visibility-factor-item">
                  <span>Nível do Elenco</span>
                  <strong>{Math.round(visibility.breakdown.squad)} pts</strong>
                </div>
                <div className="visibility-factor-item">
                  <span>Títulos e Conquistas</span>
                  <strong>{Math.round(visibility.breakdown.titles)} pts</strong>
                </div>
                <div className="visibility-factor-item">
                  <span>Quadro de Sócios</span>
                  <strong>{Math.round(visibility.breakdown.membership)} pts</strong>
                </div>
              </div>

              <div className="metric-card-footer">
                <div className="membership-perk-item">
                  
                  <span>Maior pontuação atrai jogos na TV aberta, maiores contratos e garantias bancárias globais.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Emissoras Credenciadas */}
          <div className="sponsors-pro-card">
            <div className="sponsors-pro-header">
              <h3 className="sponsors-pro-title">
                 DIREITOS DE TRANSMISSÃO E REDES DE MÍDIA OFICIAIS
              </h3>
              <span className="broadcast-rights-status-tag">7 Emissoras Credenciadas</span>
            </div>

            <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.82rem' }}>
              Emissoras oficiais que transmitem os jogos do seu clube nesta temporada. Partidas televisionadas em TV aberta pagam
              bonificação de audiência por exibição.
            </p>

            <div className="broadcast-channels-2col-grid">
              {Object.values(ALL_BROADCASTER_CHANNELS).map((channel) => (
                <div key={channel.id} className="broadcast-channel-card" style={{ borderLeftColor: channel.brandColor }}>
                  <div className="broadcast-card-main">
                    <BroadcastLogo logoKey={channel.logoKey} size="md" showBadge={false} />
                    <div className="broadcast-card-details">
                      <div className="broadcast-card-title-row">
                        <strong className="broadcast-card-name">{channel.name}</strong>
                        <span className="broadcast-card-badge" style={{ color: channel.accentColor }}>
                          {channel.badgeLabel}
                        </span>
                      </div>
                      <span className="broadcast-card-corp">{channel.conglomerateName}</span>
                      <span className="broadcast-card-slogan">"{channel.slogan}"</span>
                    </div>
                  </div>

                  <div className="broadcast-card-fee-box">
                    <span className="fee-box-label">BÔNUS POR JOGO ABERTO</span>
                    <strong className="fee-box-amount">+{formatMoney(channel.facilityFeeBonus)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Metas de Transmissão */}
          <div className="sponsors-pro-card">
            <div className="sponsors-pro-header">
              <h3 className="sponsors-pro-title">
                METAS DE AUDIÊNCIA DE TRANSMISSÃO
              </h3>
              <span className="muted" style={{ fontSize: '0.78rem' }}>Contratadas pelas emissoras</span>
            </div>

            <div className="broadcast-targets-list">
              {broadcastTargets.map((target) => (
                <div key={target.id} className={`broadcast-target-row ${target.isCompleted ? 'completed' : ''}`}>
                  <div className="target-icon-col">
                    <BroadcastLogo logoKey={target.broadcasterLogoKey} size="sm" showBadge={false} />
                  </div>

                  <div className="target-info-col">
                    <div className="target-title-row">
                      <strong className="target-title">{target.title}</strong>
                      <span className="target-sponsor-tag">{target.broadcasterName}</span>
                    </div>
                    <p className="target-desc">{target.description}</p>
                  </div>

                  <div className="target-reward-col">
                    <span className="target-reward-label">RECOMPENSA</span>
                    <strong className="target-reward-val">+{formatMoney(target.reward)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: BANCOS, EMPRÉSTIMOS & FLUXO DE CAIXA                               */}
      {/* ========================================================================= */}
      {activeTab === 'loans' && (
        <div className="finance-tab-content">
          {/* Garantias Bancárias Institucionais */}
          <div className="sponsors-pro-card">
            <div className="sponsors-pro-header">
              <div>
                <h3 className="sponsors-pro-title">
                  LINHAS DE GARANTIA BANCÁRIA INSTITUCIONAL
                </h3>
                <span className="muted" style={{ fontSize: '0.78rem' }}>Linhas de crédito para investimento em craques</span>
              </div>
            </div>

            <div className="bank-guarantees-grid">
              {bankGuarantees.map((bg) => (
                <div key={bg.id} className={`bank-card ${bg.isAvailable ? 'available' : 'locked'}`}>
                  <div className="bank-card-header">
                    
                    <div>
                      <h4 className="bank-name">{bg.bankName}</h4>
                      <span className="bank-tier-tag">Visibilidade Mínima: {bg.minVisibilityScore} pts</span>
                    </div>
                  </div>

                  <div className="bank-card-stats">
                    <div>
                      <span>Limite Máximo de Garantia:</span>
                      <strong className="gold">{formatMoney(bg.maxGuaranteeAmount)}</strong>
                    </div>
                    <div>
                      <span>Taxa de Juros:</span>
                      <span>{(bg.interestRatePerMonth * 100).toFixed(1)}% ao mês</span>
                    </div>
                  </div>

                  <p className="bank-desc">{bg.description}</p>

                  <div className="bank-card-status">
                    {bg.isAvailable ? (
                      <span className="badge-avail text-success">✓ Linha Aprovada e Disponível</span>
                    ) : (
                      <span className="badge-locked text-danger">Bloqueada (Requer mais visibilidade)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Empréstimos & Parcelas Ativas */}
          <div className="sponsors-pro-card">
            <h3 className="sponsors-pro-title">
              EMPRÉSTIMOS ATIVOS E PARCELAMENTOS
            </h3>

            {club.loans.length === 0 && club.pendingTransferPayments.length === 0 && (
              <p className="muted" style={{ margin: '10px 0' }}>Nenhum empréstimo ou parcelamento de transferência pendente.</p>
            )}

            {club.loans.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <span className="sponsor-pro-col-label">EMPRÉSTIMOS BANCÁRIOS</span>
                {club.loans.map((l) => (
                  <div key={l.id} className="sponsor-pro-row" style={{ gridTemplateColumns: '1.5fr 1.2fr 1.2fr auto' }}>
                    <span style={{ fontWeight: 800 }}>Saldo Devedor: {formatMoney(l.remainingBalance)}</span>
                    <span style={{ color: '#ffd700', fontWeight: 800 }}>Parcela: {formatMoney(l.weeklyPayment)}/semana</span>
                    <span className="muted">{l.weeksRemaining} semana(s) restante(s)</span>
                  </div>
                ))}
              </div>
            )}

            {club.pendingTransferPayments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <span className="sponsor-pro-col-label">PARCELAS DE TRANSFERÊNCIAS</span>
                {club.pendingTransferPayments.map((p) => (
                  <div key={p.id} className="sponsor-pro-row" style={{ gridTemplateColumns: '1.5fr 1.2fr 1.2fr auto' }}>
                    <span style={{ fontWeight: 800 }}>Parcelamento de Jogador</span>
                    <span style={{ color: '#ffd700', fontWeight: 800 }}>{formatMoney(p.weeklyAmount)}/semana</span>
                    <span className="muted">{p.weeksRemaining} semana(s) restante(s)</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16, marginTop: 16 }}>
              <span className="sponsor-pro-col-label" style={{ display: 'block', marginBottom: 8 }}>
                SOLICITAR NOVO EMPRÉSTIMO BANCÁRIO
              </span>
              <form onSubmit={handleTakeLoan} className="inline-form" style={{ gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="number"
                  placeholder={`Valor (${formatMoney(MIN_LOAN_AMOUNT)} a ${formatMoney(MAX_LOAN_AMOUNT)})`}
                  min={MIN_LOAN_AMOUNT}
                  max={MAX_LOAN_AMOUNT}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  style={{ minWidth: 260, fontSize: '0.88rem' }}
                />
                <select
                  value={loanPlanKey}
                  onChange={(e) => setLoanPlanKey(e.target.value as LoanPlanKey)}
                  style={{ minWidth: 260, fontSize: '0.88rem' }}
                >
                  {LOAN_PLANS.map((plan) => (
                    <option key={plan.key} value={plan.key}>
                      {plan.label} • {plan.termWeeks} semanas, juros {Math.round(plan.interestRate * 100)}%
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="btn-options-action save"
                  disabled={takingLoan || !Number(loanAmount)}
                  style={{ padding: '10px 20px', fontSize: '0.88rem' }}
                >
                  {takingLoan ? 'Processando...' : 'Contratar Empréstimo'}
                </button>
              </form>
              {amountForPreview > 0 && (
                <p className="muted" style={{ marginTop: 8, fontSize: '0.78rem' }}>
                  Parcela estimada: <strong>{formatMoney(calculateLoanTerms(amountForPreview, loanPlanKey).weeklyPayment)}/semana</strong> por{' '}
                  <strong>{calculateLoanTerms(amountForPreview, loanPlanKey).weeksRemaining} semanas</strong>.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
