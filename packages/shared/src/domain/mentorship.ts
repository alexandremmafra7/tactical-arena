import type { Player, Position } from './player.js';

export interface MentorshipPair {
  id: string;
  mentorId: string;
  mentorName: string;
  apprenticeId: string;
  apprenticeName: string;
  compatibilityScore: number; // 10 a 100
  positionMatch: boolean;
  sharedNationality: boolean;
  weeksActive: number;
}

export type SectorTrainingFocus =
  | 'OFFSIDE_TRAP'
  | 'CLEAN_TACKLING'
  | 'AERIAL_DUELS'
  | 'POSSESSION_FLOW'
  | 'HIGH_PRESS_RECOVERY'
  | 'QUICK_TRANSITION'
  | 'CLINICAL_FINISHING'
  | 'WING_OVERLAPS';

export const SECTOR_FOCUS_LABELS: Record<SectorTrainingFocus, { label: string; unit: 'DEFENSE' | 'MIDFIELD' | 'ATTACK'; description: string }> = {
  OFFSIDE_TRAP: {
    label: 'Linha de Impedimento',
    unit: 'DEFENSE',
    description: 'Sincronização da zaga para adiantar o bloco e desarmar ataques velozes.',
  },
  CLEAN_TACKLING: {
    label: 'Desarme Limpo & Cobertura',
    unit: 'DEFENSE',
    description: 'Minimiza faltas perigosas na entrada da área e cartões amarelos desnecessários.',
  },
  AERIAL_DUELS: {
    label: 'Bolas Aéreas & Cruzamentos',
    unit: 'DEFENSE',
    description: 'Combate e impulsão para neutralizar escanteios e bolas alçadas na área.',
  },
  POSSESSION_FLOW: {
    label: 'Circulação & Posse de Bola',
    unit: 'MIDFIELD',
    description: 'Triangulações de passe curto e domínio do ritmo no círculo central.',
  },
  HIGH_PRESS_RECOVERY: {
    label: 'Pressão Pós-Perda Imediata',
    unit: 'MIDFIELD',
    description: 'Recuperação nos primeiros 5 segundos para gerar finalizações rápidas.',
  },
  QUICK_TRANSITION: {
    label: 'Transição Vertical Veloz',
    unit: 'MIDFIELD',
    description: 'Lançamentos diagonais rápidos para as pontas e contra-ataques mortais.',
  },
  CLINICAL_FINISHING: {
    label: 'Finalização Clínica a 1 Toque',
    unit: 'ATTACK',
    description: 'Aproveitamento máximo de chances cara a cara com o goleiro.',
  },
  WING_OVERLAPS: {
    label: 'Cruzamentos & Dobras pelas Alas',
    unit: 'ATTACK',
    description: 'Aceleração nos corredores laterais e cruzamentos na segunda trave.',
  },
};

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

/**
 * Avalia se um jogador tem perfil para mentorar jovens atletas.
 * Exige idade >= 27 anos ou traço de liderança/determinação.
 */
export function isEligibleMentor(player: Player): boolean {
  if (player.age < 27 && !player.traits.includes('LEADER') && !player.traits.includes('DETERMINED')) {
    return false;
  }
  return true;
}

/**
 * Avalia se o atleta tem perfil de aprendiz (jovem até 22 anos).
 */
export function isEligibleApprentice(player: Player): boolean {
  return player.age <= 22;
}

/**
 * Calcula a afinidade de mentoria entre um veterano e uma jovem promessa.
 */
export function calculateMentorshipCompatibility(
  mentor: Player,
  apprentice: Player,
): { score: number; reasons: string[]; isEligible: boolean } {
  if (!isEligibleMentor(mentor)) {
    return {
      score: 0,
      reasons: ['Mentor não possui idade mínima (27+) ou perfil de liderança.'],
      isEligible: false,
    };
  }

  if (!isEligibleApprentice(apprentice)) {
    return {
      score: 0,
      reasons: ['Aprendiz possui mais de 22 anos.'],
      isEligible: false,
    };
  }

  if (mentor.id === apprentice.id) {
    return { score: 0, reasons: ['Um atleta não pode mentorar a si mesmo.'], isEligible: false };
  }

  let score = 50;
  const reasons: string[] = [];

  const positionMatch = mentor.position === apprentice.position;
  if (positionMatch) {
    score += 30;
    reasons.push(`Mesma posição (${mentor.position}) · Transferência direta de fundamentos táticos (+30)`);
  } else {
    reasons.push(`Posições distintas (${mentor.position} ⇄ ${apprentice.position}) · Aprendizado geral`);
  }

  const sharedNationality = mentor.nationality === apprentice.nationality;
  if (sharedNationality) {
    score += 15;
    reasons.push(`Mesma nacionalidade (${mentor.nationality}) · Comunicação e acolhimento cultural (+15)`);
  }

  if (mentor.traits.includes('LEADER')) {
    score += 15;
    reasons.push('Mentor é Líder Nato · Inspiração e respeito no vestiário (+15)');
  } else if (mentor.traits.includes('DETERMINED')) {
    score += 10;
    reasons.push('Mentor é Determinado · Alta ética de trabalho (+10)');
  }

  if (mentor.traits.includes('TEMPERAMENTAL')) {
    score -= 15;
    reasons.push('Atenção: Mentor Temperamental · Risco de atrito emocional (-15)');
  }
  if (mentor.traits.includes('UNDISCIPLINED')) {
    score -= 20;
    reasons.push('Cuidado: Mentor Indisciplinado · Mau exemplo em rotinas de treino (-20)');
  }

  const finalScore = clamp(score, 10, 100);

  return {
    score: finalScore,
    reasons,
    isEligible: true,
  };
}

/**
 * Atribui automaticamente os melhores pares de mentoria pelo Coordenador da Base.
 * - Prioriza as promessas mais jovens e de maior potencial.
 * - Limite de no máximo 2 aprendizes por mentor experiente.
 * - 1 mentor por jovem.
 */
export function autoAssignMentorshipPairs(
  squad: Player[],
  existingPairs: MentorshipPair[] = [],
): MentorshipPair[] {
  const mentors = squad.filter(isEligibleMentor);
  const apprentices = squad.filter(isEligibleApprentice);

  if (mentors.length === 0 || apprentices.length === 0) {
    return existingPairs;
  }

  // Manter pares existentes válidos
  const validExisting = existingPairs.filter((pair) => {
    const m = squad.find((p) => p.id === pair.mentorId);
    const a = squad.find((p) => p.id === pair.apprenticeId);
    return m && a && isEligibleMentor(m) && isEligibleApprentice(a);
  });

  const assignedApprentices = new Set(validExisting.map((p) => p.apprenticeId));
  const mentorLoad = new Map<string, number>();
  for (const pair of validExisting) {
    mentorLoad.set(pair.mentorId, (mentorLoad.get(pair.mentorId) ?? 0) + 1);
  }

  // Ordenar aprendizes por potencial e juventude
  const unassignedApprentices = apprentices
    .filter((a) => !assignedApprentices.has(a.id))
    .sort((a, b) => b.potential - a.potential || a.age - b.age);

  const newPairs: MentorshipPair[] = [...validExisting];

  for (const apprentice of unassignedApprentices) {
    // Buscar melhor mentor com vaga disponível (máx 2)
    let bestMentor: Player | null = null;
    let bestScore = -1;

    for (const mentor of mentors) {
      const currentCount = mentorLoad.get(mentor.id) ?? 0;
      if (currentCount >= 2) continue;

      const comp = calculateMentorshipCompatibility(mentor, apprentice);
      if (comp.isEligible && comp.score > bestScore) {
        bestScore = comp.score;
        bestMentor = mentor;
      }
    }

    if (bestMentor && bestScore >= 45) {
      const pairId = `mentorship-${bestMentor.id}-${apprentice.id}`;
      newPairs.push({
        id: pairId,
        mentorId: bestMentor.id,
        mentorName: bestMentor.name,
        apprenticeId: apprentice.id,
        apprenticeName: apprentice.name,
        compatibilityScore: bestScore,
        positionMatch: bestMentor.position === apprentice.position,
        sharedNationality: bestMentor.nationality === apprentice.nationality,
        weeksActive: 0,
      });

      mentorLoad.set(bestMentor.id, (mentorLoad.get(bestMentor.id) ?? 0) + 1);
      assignedApprentices.add(apprentice.id);
    }
  }

  return newPairs;
}

/**
 * Aplica a passagem de tempo semanal na mentoria:
 * - Incrementa semanas ativas.
 * - Gera eventos de absorção de mentalidade positiva ou evolução de atributos.
 */
export function applyMentorshipTick(
  pairs: MentorshipPair[],
  squad: Player[],
  rng: () => number = Math.random,
): { updatedSquad: Player[]; updatedPairs: MentorshipPair[]; events: string[] } {
  const events: string[] = [];
  const playerMap = new Map(squad.map((p) => [p.id, { ...p, traits: [...p.traits] }]));

  const updatedPairs = pairs.map((pair) => {
    const updated = { ...pair, weeksActive: pair.weeksActive + 1 };
    const mentor = playerMap.get(pair.mentorId);
    const apprentice = playerMap.get(pair.apprenticeId);

    if (!mentor || !apprentice) return updated;

    // A cada 3 semanas com boa compatibilidade, o jovem tem chance de evolução acelerada
    if (updated.weeksActive % 3 === 0) {
      const roll = rng();
      const bonusChance = (pair.compatibilityScore / 100) * 0.45; // até 45% de chance

      if (roll < bonusChance) {
        // Melhora comprometimento e moral
        apprentice.commitment = clamp(apprentice.commitment + 6, 0, 100);
        apprentice.morale = clamp(apprentice.morale + 4, 0, 100);

        // Se mentor é LEADER ou DETERMINED, pode transferir ou amenizar indisciplina
        if (mentor.traits.includes('DETERMINED') && !apprentice.traits.includes('DETERMINED') && roll < 0.20) {
          apprentice.traits.push('DETERMINED');
          events.push(`🎓 ${apprentice.name} absorveu a DETERMINAÇÃO do mentor ${mentor.name}!`);
        } else if (apprentice.traits.includes('TEMPERAMENTAL') && mentor.traits.includes('LEADER') && roll < 0.25) {
          apprentice.traits = apprentice.traits.filter((t) => t !== 'TEMPERAMENTAL');
          events.push(`🕊️ Sob a tutela de ${mentor.name}, ${apprentice.name} amadureceu e superou seu temperamento explosivo!`);
        } else {
          events.push(`⭐ ${apprentice.name} demonstrou grande evolução sob mentoria de ${mentor.name} (+Comprometimento).`);
        }
      }
    }

    return updated;
  });

  return {
    updatedSquad: Array.from(playerMap.values()),
    updatedPairs,
    events,
  };
}
