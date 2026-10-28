import { DEFAULT_MANAGER_STYLE, type ManagerStyleId } from '@tactical-arena/shared';
import { readSavesIndex } from './saveService.js';

/**
 * Retorna o estilo de treinador associado ao usuário.
 * Caso o usuário não possua save ativo ou o estilo não esteja definido, retorna o estilo padrão ('Estrategista').
 */
export function getManagerStyle(userId?: string | null): ManagerStyleId {
  if (!userId) return DEFAULT_MANAGER_STYLE;
  try {
    const save = readSavesIndex().saves.find((s) => s.managerUserId === userId);
    return (save?.managerStyle as ManagerStyleId) ?? DEFAULT_MANAGER_STYLE;
  } catch {
    return DEFAULT_MANAGER_STYLE;
  }
}
