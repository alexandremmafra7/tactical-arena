import type { PlayerFunction } from '@tactical-arena/shared';

const FUNCTION_LABELS: Record<PlayerFunction, string> = {
  LATERAL: 'Lateral',
  ALA: 'Ala',
  VOLANTE: 'Volante',
  MEIA_CRIACAO: 'Meia de criação',
  CENTROAVANTE: 'Centroavante',
  PONTA: 'Ponta',
  SEGUNDO_ATACANTE: 'Segundo atacante',
  ZAGUEIRO_REBATEDOR: 'Zagueiro Rebatedor',
  ZAGUEIRO_CONSTRUTOR: 'Zagueiro Construtor',
  LATERAL_CONSTRUTOR: 'Lateral Construtor',
  ALA_OFENSIVO: 'Ala Ofensivo',
  VOLANTE_CAO_DE_GUARDA: 'Cão de Guarda',
  MEIA_BOX_TO_BOX: 'Box-to-Box',
  MEIA_ARMADOR: 'Meia Armador',
  PONTA_INVERTIDO: 'Ponta Invertido',
  PONTA_LINHA_DE_FUNDO: 'Ponta Agudo',
  CENTROAVANTE_REFERENCIA: 'Homem de Referência',
  FALSO_NOVE: 'Falso 9',
};

export function functionLabel(fn: PlayerFunction): string {
  return FUNCTION_LABELS[fn];
}
