export type ManagerStyleId = 'Estrategista' | 'Ofensivo' | 'Formador' | 'Gestor';

export interface ManagerStyleDefinition {
  id: ManagerStyleId;
  label: string;
  icon: string;
  desc: string;
}

export const MANAGER_STYLES: readonly ManagerStyleDefinition[] = [
  { id: 'Estrategista', label: 'Estrategista', icon: '•', desc: 'Equilíbrio tático e leitura inteligente de jogo' },
  { id: 'Ofensivo', label: 'Ofensivo', icon: '•', desc: 'Pressão alta e busca constante pelo gol' },
  { id: 'Formador', label: 'Formador', icon: '•', desc: 'Foco no desenvolvimento e formação da base' },
  { id: 'Gestor', label: 'Gestor de Elenco', icon: '•', desc: 'Liderança de grupo e harmonia no vestiário' },
] as const;

export const DEFAULT_MANAGER_STYLE: ManagerStyleId = 'Estrategista';

/** Retorna a definição de estilo correspondente ao id, ou a definição padrão se não encontrado. */
export function getManagerStyleDefinition(id?: string | null): ManagerStyleDefinition {
  if (!id) return MANAGER_STYLES[0];
  const found = MANAGER_STYLES.find((s) => s.id === id || s.id.toLowerCase() === id.toLowerCase());
  return found ?? MANAGER_STYLES[0];
}

/** Verifica se um id corresponde a um estilo de treinador válido. */
export function isValidManagerStyle(id: string): id is ManagerStyleId {
  return MANAGER_STYLES.some((s) => s.id === id);
}

/**
 * Aplica o bônus de leitura tática do estilo Estrategista (+0.12 na precisão, teto de 0.98).
 */
export function applyTacticalAdviceStyleBonus(readingAccuracy: number, managerStyle?: string | null): number {
  if (managerStyle === 'Estrategista') {
    return Math.max(0.2, Math.min(0.98, readingAccuracy + 0.12));
  }
  return readingAccuracy;
}

/**
 * Aplica o bônus anímico do estilo Ofensivo (+2 em vitórias, +1 por gol a partir de 2 gols, máx +2 extra).
 */
export function applyMoraleStyleBonus(
  baseMoraleDelta: number,
  goalsFor: number,
  goalsAgainst: number,
  managerStyle?: string | null,
): number {
  if (managerStyle === 'Ofensivo') {
    let extra = 0;
    if (goalsFor > goalsAgainst) {
      extra += 2;
    }
    if (goalsFor >= 2) {
      extra += Math.min(2, goalsFor - 1);
    }
    return baseMoraleDelta + extra;
  }
  return baseMoraleDelta;
}

/**
 * Aplica o bônus de formação do estilo Formador (1.25x no ganho de pontos de desenvolvimento para atletas <= 23 anos).
 */
export function applyMatchDevelopmentStyleBonus(points: number, age: number, managerStyle?: string | null): number {
  if (managerStyle === 'Formador' && age <= 23) {
    return points * 1.25;
  }
  return points;
}

/**
 * Aplica o bônus de negociação do estilo Gestor (+5% no valor semanal e +8% nas luvas de assinatura).
 */
export function applySponsorshipStyleBonus(
  weeklyAmount: number,
  signingBonus: number,
  managerStyle?: string | null,
): { weeklyAmount: number; signingBonus: number } {
  if (managerStyle === 'Gestor') {
    return {
      weeklyAmount: Math.round((weeklyAmount * 1.05) / 1000) * 1000,
      signingBonus: Math.round((signingBonus * 1.08) / 1000) * 1000,
    };
  }
  return { weeklyAmount, signingBonus };
}
