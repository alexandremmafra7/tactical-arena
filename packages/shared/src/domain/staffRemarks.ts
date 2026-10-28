import type { Club } from './club.js';
import type { Player } from './player.js';
import { createRng } from '../simulation/rng.js';
import { STAFF_ROLES_INFO, type StaffMember, type StaffRole } from './staff.js';
import { tiredPlayers } from './clubBriefing.js';
import { MAX_SQUAD_SIZE } from './youthAcademy.js';

/**
 * Something a member of the comissão says, where the manager is already working.
 *
 * The staff used to live entirely on their own screen: five cards, a hire button, and a set of multipliers
 * applied silently somewhere else. Nothing any of them did was ever visible at the moment it mattered, so a
 * manager could run a whole season without noticing whether the R$ 80.000 a week bought anything.
 *
 * A remark is an opinion, never an action. Nothing here changes a lineup, a price or a budget: it says what
 * the person the club employs would say, and the manager decides. That is the same line the rest of the game
 * holds, and it is the reason the staff is worth having a voice at all.
 */
export interface StaffRemark {
  role: StaffRole;
  /** Who is speaking. Null when the post is vacant and the remark is about that. */
  staffName: string | null;
  tone: 'WARNING' | 'OPPORTUNITY' | 'INFO' | 'VACANT';
  text: string;
  /** The player this is about, when it is about one. */
  playerId?: string;
}

function member(club: Club, role: StaffRole): StaffMember | undefined {
  return club.staff?.find((s) => s.role === role);
}

/** The remark a vacant post makes for itself, so an empty chair is visible rather than merely absent. */
function vacancy(role: StaffRole): StaffRemark {
  return {
    role,
    staffName: null,
    tone: 'VACANT',
    text: `Sem ${STAFF_ROLES_INFO[role].title.toLowerCase()} no clube. Ninguém está olhando isso por você.`,
  };
}


/**
 * The preparador físico, on the eleven the manager is picking right now.
 *
 * Not the same observation the home screen carries. That one is about the squad and answers "is anybody
 * struggling"; this one is about the team sheet in front of you and answers "is the man you just picked
 * going to last". It changes with every click, which is exactly when a fitness coach would speak up, and it
 * is the same warning the game then holds them to: saving this lineup puts it on their record (see
 * `recordFitnessWarnings`), and the match settles whether they were right.
 *
 * Shares `tiredPlayers` with the briefing so the two can never disagree about who is spent.
 */
export function lineupRemarks(club: Club, lineupPlayerIds: readonly string[]): StaffRemark[] {
  const coach = member(club, 'FITNESS_COACH');
  if (!coach) return [vacancy('FITNESS_COACH')];

  const picked = new Set(lineupPlayerIds);
  const atRisk = tiredPlayers(club.players, coach.rating).filter((p) => picked.has(p.id));

  if (atRisk.length === 0) {
    return [
      {
        role: 'FITNESS_COACH',
        staffName: coach.name,
        tone: 'INFO',
        text: 'O time que você escalou está inteiro. Ninguém me preocupa para hoje.',
      },
    ];
  }

  // Three at most. A voice that flags eleven players has said nothing about any of them.
  return atRisk.slice(0, 3).map((player) => ({
    role: 'FITNESS_COACH' as const,
    staffName: coach.name,
    tone: 'WARNING' as const,
    playerId: player.id,
    text:
      player.fatigue >= 85
        ? `${player.name} está no limite. Se jogar os 90 minutos, é risco de lesão.`
        : `${player.name} não está inteiro. Eu não contaria com ele para o jogo todo.`,
  }));
}

/**
 * How far off a coordinator's read of a prospect can be.
 *
 * Potential is an exact number in the data and nobody in football has ever had one. What a coordinator sells
 * is a judgement, so this is the width of theirs: a bronze can be a dozen points wrong about a boy, an elite
 * one is within two or three. It is the same idea as the tactical assistant's misread, and it is the reason
 * two coordinators of different quality are worth different money.
 */
function scoutingError(rating: number): number {
  return Math.max(2, Math.round(16 - (rating - 50) * 0.28));
}

/**
 * The coordenador da base, on the academy screen.
 *
 * The academy already develops players faster with a good coordinator (see `getYouthDevelopmentBoost`), which
 * is invisible by construction: a number applied weekly to a hidden counter. What a manager can act on is who
 * to bring up and who is taking a place they will never justify, and that is a judgement rather than a figure.
 *
 * Deliberately not a potential estimate. The academy table already prints each boy's exact ceiling, so a
 * scouted guess beside it would read as a broken number rather than as somebody's opinion. The uncertainty is
 * still here, it just decides *who the coordinator picks*: a weak one ranks the boys by a reading of their
 * ceiling that can be a dozen points out, and recommends the wrong one often enough to matter.
 */
export function youthRemarks(club: Club): StaffRemark[] {
  const coordinator = member(club, 'YOUTH_COORDINATOR');
  if (!coordinator) return [vacancy('YOUTH_COORDINATOR')];

  const prospects = club.academyPlayers ?? [];
  if (prospects.length === 0) {
    return [{ role: 'YOUTH_COORDINATOR', staffName: coordinator.name, tone: 'INFO', text: 'A base está vazia. Não tenho ninguém para te mostrar.' }];
  }

  const error = scoutingError(coordinator.rating);
  const read = (player: Player): number => {
    // Seeded per coordinator and per boy, so the same person always reads the same kid the same way.
    const rng = createRng(`scout-${coordinator.id}-${player.id}`);
    return player.potential + (rng() * 2 - 1) * error;
  };

  const ranked = [...prospects].sort((a, b) => read(b) - read(a));
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const sure = error <= 5;

  const manual = club.staffDelegationConfig?.youthPromotions === 'manual';
  const ready = ranked.find((player) => player.age >= 20 || (player.overall >= 70 && player.potential >= 82));
  const target = manual && ready ? ready : best;
  const fullSquad = club.players.length >= MAX_SQUAD_SIZE;
  const remarks: StaffRemark[] = [
    {
      role: 'YOUTH_COORDINATOR',
      staffName: coordinator.name,
      tone: 'OPPORTUNITY',
      playerId: target.id,
      text: manual && ready
        ? fullSquad
          ? `${ready.name} está pronto, mas o elenco está cheio. A decisão de abrir vaga e promover é sua.`
          : `${ready.name} está pronto para subir. No modo manual, a decisão de promover é sua.`
        : sure
          ? `${best.name} é o melhor que temos aqui. Sobe para o profissional.`
          : `Se eu tivesse que apostar em um, apostaria em ${best.name}. Mas é cedo para cravar.`,
    },
  ];

  // Only worth saying when there is a real gap between the best and the worst, and a real choice to make.
  if (ranked.length >= 3 && read(best) - read(worst) > 10) {
    remarks.push({
      role: 'YOUTH_COORDINATOR',
      staffName: coordinator.name,
      tone: 'INFO',
      playerId: worst.id,
      text: `${worst.name} está ocupando uma vaga. Eu não seguraria.`,
    });
  }

  return remarks;
}

/**
 * The diretor financeiro, on a piece of spending the manager is about to commit to.
 *
 * A stadium expansion costs between R$ 2 e 20 milhões, and the screen offering it shows the price, the new
 * capacity and the extra gate money, but never the one number that decides whether the club survives the
 * decision: how many weeks of cover are left afterwards. The button is disabled when the money is not there
 * at all, which is a different question from whether spending it is wise.
 *
 * Bounded by what a director can actually see: the club's own balance and its own weekly burn. It offers no
 * verdict on the football, and it does not stop anything.
 */
export function spendingRemarks(club: Club, cost: number, weeklyNet: number): StaffRemark[] {
  const director = member(club, 'FINANCIAL_DIRECTOR');
  if (!director) return [vacancy('FINANCIAL_DIRECTOR')];

  const money = (value: number) => `R$ ${Math.round(value).toLocaleString('pt-BR')}`;
  const after = club.budget - cost;

  if (after < 0) {
    return [
      {
        role: 'FINANCIAL_DIRECTOR',
        staffName: director.name,
        tone: 'WARNING',
        text: `Faltam ${money(-after)} para isso. Não temos como pagar.`,
      },
    ];
  }

  if (weeklyNet >= 0) {
    return [
      {
        role: 'FINANCIAL_DIRECTOR',
        staffName: director.name,
        tone: 'INFO',
        text: `Sobram ${money(after)} depois de pagar, e as contas fecham no positivo. Pode ir em frente.`,
      },
    ];
  }

  const weeks = Math.floor(after / -weeklyNet);
  return [
    {
      role: 'FINANCIAL_DIRECTOR',
      staffName: director.name,
      tone: weeks <= 8 ? 'WARNING' : 'INFO',
      text:
        weeks <= 8
          ? `Depois disso o caixa cobre ${weeks} semanas. É apertado demais para o meu gosto.`
          : `Depois disso sobram ${money(after)}, o que dá ${weeks} semanas de folga. Dá para encarar.`,
    },
  ];
}

/**
 * How wrong a director's valuation of a player can be, as a share of what the player is worth.
 *
 * Same shape as the coordinator's scouting error and for the same reason: a valuation is an opinion. A weak
 * director is a third out either way, an elite one is within five percent, and it is their number the manager
 * sees rather than the true one.
 */
function valuationError(rating: number): number {
  return Math.max(0.05, 0.4 - (rating - 50) * 0.007);
}

export interface DirectorVerdict {
  /** What this director thinks the player is worth. Their number, not the true one. */
  valuation: number;
  tone: 'WARNING' | 'OPPORTUNITY' | 'INFO';
  /** One word for a table cell: "Caro", "Justo", "Pechincha". */
  label: string;
  /** The whole sentence, for anywhere with room for it. */
  text: string;
  directorName: string;
}

/** Beyond this much either side of the director's valuation, a price stops being merely a price. */
const PRICE_GAP = 0.2;

/**
 * The diretor de futebol, on a player the manager is looking at buying.
 *
 * The discount this director negotiates is already real (see `getDirectorTransferDiscount`), and it applies
 * silently at the moment of the deal. What they never did was the other half of the job: saying whether the
 * asking price is any good before the manager commits to it.
 *
 * Their valuation is their own, with their own error in it, and the manager never sees the true figure. That
 * is the whole reason a better director is worth more money: not a bigger discount, a more reliable opinion
 * about what to spend it on. Returns null when the post is vacant, because nobody is valuing anything.
 */
export function directorVerdict(club: Club, target: Player, askingPrice: number): DirectorVerdict | null {
  const director = member(club, 'FOOTBALL_DIRECTOR');
  if (!director) return null;

  // Seeded per director and per player, so a refresh never changes their mind about the same man.
  const rng = createRng(`value-${director.id}-${target.id}`);
  const valuation = Math.round(target.marketValue * (1 + (rng() * 2 - 1) * valuationError(director.rating)));
  const gap = (askingPrice - valuation) / Math.max(1, valuation);
  const money = `R$ ${valuation.toLocaleString('pt-BR')}`;

  if (gap > PRICE_GAP) {
    return {
      valuation, tone: 'WARNING', label: 'Caro', directorName: director.name,
      text: `Estão pedindo caro. Para mim ${target.name} vale ${money}, e não o que estão cobrando.`,
    };
  }
  if (gap < -PRICE_GAP) {
    return {
      valuation, tone: 'OPPORTUNITY', label: 'Pechincha', directorName: director.name,
      text: `Isso é uma pechincha. Avalio ${target.name} em ${money}. Eu fecharia hoje.`,
    };
  }
  return {
    valuation, tone: 'INFO', label: 'Justo', directorName: director.name,
    text: `O preço está dentro do que eu esperava. Avalio ${target.name} em ${money}.`,
  };
}

/** The same verdict as a remark, for screens that show one player rather than a list of them. */
export function scoutingRemarks(club: Club, target: Player, askingPrice: number): StaffRemark[] {
  const verdict = directorVerdict(club, target, askingPrice);
  if (!verdict) return [vacancy('FOOTBALL_DIRECTOR')];

  return [
    { role: 'FOOTBALL_DIRECTOR', staffName: verdict.directorName, tone: verdict.tone, playerId: target.id, text: verdict.text },
  ];
}
