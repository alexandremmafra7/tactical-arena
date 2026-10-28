import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { COUNTRIES, FUNCTIONS_BY_POSITION, MAX_PLAYER_FUNCTIONS, getPlayerTier, isYouthGem, playerRoles } from '@tactical-arena/shared';
import type { Club, PersonalityTrait, Player, PlayerFunction, PlayerRole } from '@tactical-arena/shared';
import { createMatch, getClub, setPlayerRole, setPlayerFunctions, submitTactic, batchRenewContracts } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { ExpiringContractsBanner } from '../components/ExpiringContractsBanner.js';
import { CountryFlag } from '../components/CountryFlag.js';
import { RoleIcons } from '../components/RoleIcon.js';
import { PromessaSub20Icon, SpecialPlayerBadge } from '../components/SpecialPlayerIcon.js';
import { SpecialPlayersLegend, SpecialPlayersLegendModal } from '../components/SpecialPlayersLegend.js';
import { PlayerComparisonModal } from '../components/PlayerComparisonModal.js';
import { positionLabel } from '../lib/positionLabel.js';
import { footLetter } from '../lib/footLabel.js';
import { functionLabel } from '../lib/functionLabel.js';
import { getClubThemeStyle } from '../lib/clubTheme.js';
import { useViewMode } from '../context/ViewModeContext.js';

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

const TRAIT_LABELS: Record<PersonalityTrait, string> = {
  AGGRESSIVE: 'Faltoso',
  PROVOCATIVE: 'Provocador',
  TEMPERAMENTAL: 'Temperamental',
  UNDISCIPLINED: 'Indisciplinado',
  SELFISH: 'Egocêntrico',
  LEADER: 'Líder',
  DETERMINED: 'Determinado',
};

/** Order shown in the role checklist — a player can hold any number of these at once. */
const ROLE_OPTIONS: { value: PlayerRole; label: string }[] = [
  { value: 'CAPTAIN', label: 'Capitão' },
  { value: 'FREE_KICK_TAKER', label: 'Batedor de faltas' },
  { value: 'PENALTY_TAKER', label: 'Batedor de pênaltis' },
  { value: 'CORNER_RIGHT_TAKER', label: 'Escanteio pela direita' },
  { value: 'CORNER_LEFT_TAKER', label: 'Escanteio pela esquerda' },
];

/** Roster overview: attributes, traits, captain armband, and the club's opponent challenge form. */
export function SquadPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opponentClubId, setOpponentClubId] = useState('');
  const [showLegendModal, setShowLegendModal] = useState(false);
  const [comparisonPrimaryPlayer, setComparisonPrimaryPlayer] = useState<Player | null>(null);
  const [comparisonSecondaryPlayer, setComparisonSecondaryPlayer] = useState<Player | null>(null);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const { isBrasfoot, toggleViewMode } = useViewMode();

  function handleOpenComparison(player: Player) {
    setComparisonPrimaryPlayer(player);
    const samePos = club?.players.find((p) => p.id !== player.id && p.position === player.position);
    const fallbackOther = club?.players.find((p) => p.id !== player.id);
    setComparisonSecondaryPlayer(samePos ?? fallbackOther ?? null);
    setComparisonModalOpen(true);
  }

  useEffect(() => {
    if (!clubId) return;
    getClub(clubId)
      .then(setClub)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [clubId]);

  async function handleToggleRole(playerId: string, role: PlayerRole, assign: boolean) {
    if (!club) return;
    setError(null);
    try {
      setClub(await setPlayerRole(club.id, playerId, role, assign));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleAddFunction(player: Player, fn: PlayerFunction) {
    if (!club || !fn) return;
    setError(null);
    try {
      setClub(await setPlayerFunctions(club.id, player.id, [...player.functions, fn]));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRemoveFunction(player: Player, fn: PlayerFunction) {
    if (!club) return;
    setError(null);
    try {
      setClub(await setPlayerFunctions(club.id, player.id, player.functions.filter((f) => f !== fn)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  /**
   * O amistoso passa a usar o plano tático do clube, como qualquer outra partida.
   *
   * Ele abria uma segunda prancheta, própria da partida, que era um editor de escalação quase igual ao de
   * `/clubs/:id/tactics` — dois lugares para montar o mesmo time, que iam divergir na primeira regra nova.
   * E era incoerente com o que o próprio jogo decidiu: o plano vale para todas as partidas até o técnico
   * mudar. Um amistoso é uma partida. Se não há time escalado, vai para a prancheta e volta.
   */
  async function handleChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!club) return;
    setError(null);
    const plano = club.pendingRoundTactic;
    if (!plano || plano.lineup.filter((slot) => slot?.playerId).length < 11) {
      navigate(`/clubs/${club.id}/tactics`);
      return;
    }
    try {
      const match = await createMatch(club.id, opponentClubId.trim());
      const atualizada = await submitTactic(match.id, plano);
      /*
       * O amistoso multi-jogador fica em WAITING_TACTICS até o outro técnico escalar o time dele. A tela
       * de resultado é quem sabe esperar por isso; a de ao vivo não tem o que mostrar e devolve para cá.
       */
      navigate(`/match/${match.id}/${atualizada.status === 'LIVE' ? 'live' : 'result'}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleBatchRenew(playerIds: string[], yearsMap: Record<string, number>) {
    if (!club || playerIds.length === 0) return;
    setError(null);
    try {
      const res = await batchRenewContracts(club.id, playerIds, { years: 2, yearsMap });
      setClub(res.club);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) return <div className="page">Carregando...</div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club) return null;

  return (
    <div className="page squad-page" style={getClubThemeStyle(club)}>
      <ClubNav club={club} active="squad" backTo={`/clubs/${club.id}`} />
      <HubSubnav hub="team" clubId={club.id} active="squad" />

      {error && <p className="error">{error}</p>}

      {/* ⚠️ Expiring Contracts Banner & Batch Automation */}
      <ExpiringContractsBanner
        club={club}
        onBatchRenewConfirmed={handleBatchRenew}
      />

      <section className="card">
        <div className="topbar flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2>Elenco ({club.players.length} jogadores)</h2>
          </div>
          {!isBrasfoot && (
            <button
              type="button"
              className="btn-secondary btn-special-legend-trigger"
              onClick={() => setShowLegendModal(true)}
              title="Ver Legenda de Jogadores Especiais"
            >
              Legenda de Especiais
            </button>
          )}
        </div>
        <div className="table-scroll">
        <table>
          <thead>
            {isBrasfoot ? (
              <tr>
                <th>Nome</th>
                <th>Pos.</th>
                <th>Força</th>
                <th>Idade</th>
                <th>Salário</th>
                <th>Valor</th>
              </tr>
            ) : (
              <tr>
                <th>Nome</th>
                <th></th>
                <th>Pos.</th>
                <th></th>
                <th></th>
                <th>Idade</th>
                <th>Força</th>
                <th>Potencial</th>
                <th>Estrela</th>
                <th>Traços</th>
                <th>Atribuição</th>
                <th>Valor</th>
                <th>Radar</th>
              </tr>
            )}
          </thead>
          <tbody>
            {club.players.map((p: Player) => {
              const tier = getPlayerTier(p.overall, p.starLevel, p.diferenciado, p.age, p.potential, p.name);
              const roles = playerRoles(club, p.id);
              const availableFunctions = FUNCTIONS_BY_POSITION[p.position];

              if (isBrasfoot) {
                return (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/clubs/${club.id}/players/${p.id}`}>{p.name}</Link>
                      {(p.suspensions ?? []).some((s) => s.matchesRemaining > 0) && (
                        <span className="muted"> (suspenso)</span>
                      )}
                      {(p.injuryWeeks ?? 0) > 0 && <span className="muted"> (lesionado)</span>}
                    </td>
                    <td>{positionLabel(p.position)}</td>
                    <td className="font-bold text-amber-400">{Math.round(p.overall)}</td>
                    <td>{p.age}</td>
                    <td>{formatMoney(p.wage ?? 0)}</td>
                    <td>{formatMoney(p.marketValue)}</td>
                  </tr>
                );
              }

              return (
                <tr key={p.id}>
                  <td>
                    <Link to={`/clubs/${club.id}/players/${p.id}`}>{p.name}</Link>
                    {(p.suspensions ?? []).some((s) => s.matchesRemaining > 0) && (
                      <span className="muted"> (suspenso {Math.max(...(p.suspensions ?? []).map((s) => s.matchesRemaining))}j)</span>
                    )}
                    {(p.injuryWeeks ?? 0) > 0 && <span className="muted"> (lesionado {p.injuryWeeks}j)</span>}
                    {p.age <= 20 && isYouthGem(p) && <PromessaSub20Icon size={18} />}
                  </td>
                  <td>
                    <RoleIcons roles={roles} />
                  </td>
                  <td>
                    {positionLabel(p.position)}
                    {availableFunctions.length > 0 && (
                      <details className="function-select">
                        <summary>{p.functions.length > 0 ? p.functions.map(functionLabel).join(', ') : '+ função'}</summary>
                        <div className="function-options">
                          {availableFunctions.map((fn) => {
                            const checked = p.functions.includes(fn);
                            const disabled = !checked && p.functions.length >= MAX_PLAYER_FUNCTIONS;
                            return (
                              <label key={fn} className="function-option">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => (checked ? handleRemoveFunction(p, fn) : handleAddFunction(p, fn))}
                                />
                                {functionLabel(fn)}
                              </label>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </td>
                  <td className={p.preferredFoot === 'BOTH' ? 'foot-ambidextrous' : undefined}>{footLetter(p.preferredFoot)}</td>
                  <td>
                    <CountryFlag code={p.nationality} title={countryName(p.nationality)} />
                  </td>
                  <td>{p.age}</td>
                  <td>{Math.round(p.overall)}</td>
                  <td>{p.potential}</td>
                  <td>
                    {tier ? (
                      <SpecialPlayerBadge tier={tier} />
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    {p.traits.length === 0 && <span className="muted">-</span>}
                    {p.traits.map((trait) => (
                      <span key={trait} className="trait-badge">
                        {TRAIT_LABELS[trait]}
                      </span>
                    ))}
                  </td>
                  <td>
                    <details className="function-select">
                      <summary>
                        {roles.length > 0 ? roles.map((r: PlayerRole) => ROLE_OPTIONS.find((o) => o.value === r)?.label).join(', ') : '+ atribuição'}
                      </summary>
                      <div className="function-options">
                        {ROLE_OPTIONS.map((opt) => {
                          const checked = roles.includes(opt.value);
                          return (
                            <label key={opt.value} className="function-option">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleRole(p.id, opt.value, !checked)}
                              />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    </details>
                  </td>
                  <td>{formatMoney(p.marketValue)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-squad-compare"
                      onClick={() => handleOpenComparison(p)}
                      title={`Comparar ${p.name}`}
                    >
                      Comparar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      <section className="card">
        <h2>Desafiar um clube</h2>
        <p className="muted">
          Peça o ID do clube adversário para o outro técnico. O amistoso usa o plano tático que estiver
          valendo; sem time escalado, você vai primeiro para a prancheta.
        </p>
        {/* O ID do próprio clube: sem ele, o técnico não tem o que mandar para o outro. Ficava só na tela
            antiga de escolher clube, que ninguém alcança jogando. */}
        <p className="muted" style={{ fontSize: '0.78rem' }}>
          O ID do seu clube é <code>{club.id}</code>.
        </p>
        <form onSubmit={handleChallenge} className="inline-form">
          <input placeholder="ID do clube adversário" value={opponentClubId} onChange={(e) => setOpponentClubId(e.target.value)} required />
          <button type="submit">Desafiar com {club.name}</button>
        </form>
      </section>

      <SpecialPlayersLegendModal
        isOpen={showLegendModal}
        onClose={() => setShowLegendModal(false)}
      />

      {comparisonPrimaryPlayer && (
        <PlayerComparisonModal
          isOpen={comparisonModalOpen}
          onClose={() => setComparisonModalOpen(false)}
          primaryPlayer={comparisonPrimaryPlayer}
          secondaryPlayer={comparisonSecondaryPlayer}
          squad={club.players}
          onSelectSecondaryPlayer={(p) => setComparisonSecondaryPlayer(p)}
        />
      )}
    </div>
  );
}
