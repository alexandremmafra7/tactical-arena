import type { Player, PlayerFunction, Position } from '../domain/player.js';

export interface PlayerRoleModifier {
  role: PlayerFunction;
  name: string;
  description: string;
  defendingMultiplier: number;
  passingMultiplier: number;
  attackingMultiplier: number;
  paceMultiplier: number;
  staminaCostMultiplier: number;
  foulMultiplier: number;
}

export const PLAYER_ROLE_MODIFIERS: Record<PlayerFunction, PlayerRoleModifier> = {
  // Papéis Clássicos / Base
  LATERAL: {
    role: 'LATERAL',
    name: 'Lateral Clássico',
    description: 'Equilíbrio entre marcação na lateral e apoio moderado.',
    defendingMultiplier: 1.05,
    passingMultiplier: 1.0,
    attackingMultiplier: 0.95,
    paceMultiplier: 1.0,
    staminaCostMultiplier: 1.0,
    foulMultiplier: 1.0,
  },
  ALA: {
    role: 'ALA',
    name: 'Ala',
    description: 'Apoio constante ao ataque pelos corredores.',
    defendingMultiplier: 0.92,
    passingMultiplier: 1.05,
    attackingMultiplier: 1.1,
    paceMultiplier: 1.05,
    staminaCostMultiplier: 1.1,
    foulMultiplier: 1.0,
  },
  VOLANTE: {
    role: 'VOLANTE',
    name: 'Primeiro Volante',
    description: 'Proteção à frente da zaga e distribuição simples.',
    defendingMultiplier: 1.12,
    passingMultiplier: 0.98,
    attackingMultiplier: 0.9,
    paceMultiplier: 0.95,
    staminaCostMultiplier: 1.0,
    foulMultiplier: 1.05,
  },
  MEIA_CRIACAO: {
    role: 'MEIA_CRIACAO',
    name: 'Meia de Criação',
    description: 'Articulação de jogadas e assistências decisivas.',
    defendingMultiplier: 0.88,
    passingMultiplier: 1.2,
    attackingMultiplier: 1.05,
    paceMultiplier: 0.95,
    staminaCostMultiplier: 0.95,
    foulMultiplier: 0.9,
  },
  CENTROAVANTE: {
    role: 'CENTROAVANTE',
    name: 'Centroavante',
    description: 'Finalizador de área tradicional.',
    defendingMultiplier: 0.8,
    passingMultiplier: 0.9,
    attackingMultiplier: 1.15,
    paceMultiplier: 1.0,
    staminaCostMultiplier: 1.0,
    foulMultiplier: 1.0,
  },
  PONTA: {
    role: 'PONTA',
    name: 'Ponta',
    description: 'Velocidade e amplitude pelos flancos.',
    defendingMultiplier: 0.85,
    passingMultiplier: 1.05,
    attackingMultiplier: 1.1,
    paceMultiplier: 1.15,
    staminaCostMultiplier: 1.05,
    foulMultiplier: 0.95,
  },
  SEGUNDO_ATACANTE: {
    role: 'SEGUNDO_ATACANTE',
    name: 'Segundo Atacante',
    description: 'Mobilidade em volta da área e chegada surpresa.',
    defendingMultiplier: 0.88,
    passingMultiplier: 1.08,
    attackingMultiplier: 1.12,
    paceMultiplier: 1.05,
    staminaCostMultiplier: 1.05,
    foulMultiplier: 0.95,
  },

  // Novos Papéis Modernos Especializados
  ZAGUEIRO_REBATEDOR: {
    role: 'ZAGUEIRO_REBATEDOR',
    name: 'Zagueiro Rebatedor',
    description: 'Foco em desarmes e combate aéreo direto; evita riscos na saída.',
    defendingMultiplier: 1.18,
    passingMultiplier: 0.88,
    attackingMultiplier: 0.9,
    paceMultiplier: 0.95,
    staminaCostMultiplier: 1.0,
    foulMultiplier: 1.1,
  },
  ZAGUEIRO_CONSTRUTOR: {
    role: 'ZAGUEIRO_CONSTRUTOR',
    name: 'Zagueiro Construtor',
    description: 'Qualidade no passe longo e quebra de linhas a partir de trás.',
    defendingMultiplier: 1.02,
    passingMultiplier: 1.15,
    attackingMultiplier: 0.95,
    paceMultiplier: 1.0,
    staminaCostMultiplier: 1.0,
    foulMultiplier: 0.95,
  },
  LATERAL_CONSTRUTOR: {
    role: 'LATERAL_CONSTRUTOR',
    name: 'Lateral Invertido / Construtor',
    description: 'Afuniça para o centro para gerar superioridade numérica na posse.',
    defendingMultiplier: 1.05,
    passingMultiplier: 1.12,
    attackingMultiplier: 0.98,
    paceMultiplier: 0.95,
    staminaCostMultiplier: 1.0,
    foulMultiplier: 0.95,
  },
  ALA_OFENSIVO: {
    role: 'ALA_OFENSIVO',
    name: 'Ala Ofensivo',
    description: 'Extremo apoio na linha de fundo, especialista em cruzamentos.',
    defendingMultiplier: 0.88,
    passingMultiplier: 1.1,
    attackingMultiplier: 1.15,
    paceMultiplier: 1.1,
    staminaCostMultiplier: 1.18,
    foulMultiplier: 1.0,
  },
  VOLANTE_CAO_DE_GUARDA: {
    role: 'VOLANTE_CAO_DE_GUARDA',
    name: 'Volante Cão de Guarda',
    description: 'Desarmes agressivos e destruição da criação adversária.',
    defendingMultiplier: 1.22,
    passingMultiplier: 0.85,
    attackingMultiplier: 0.85,
    paceMultiplier: 1.0,
    staminaCostMultiplier: 1.12,
    foulMultiplier: 1.25,
  },
  MEIA_BOX_TO_BOX: {
    role: 'MEIA_BOX_TO_BOX',
    name: 'Meia Box-to-Box',
    description: 'Motor do meio-campo: atua de área a área com alta intensidade.',
    defendingMultiplier: 1.08,
    passingMultiplier: 1.05,
    attackingMultiplier: 1.08,
    paceMultiplier: 1.05,
    staminaCostMultiplier: 1.25,
    foulMultiplier: 1.05,
  },
  MEIA_ARMADOR: {
    role: 'MEIA_ARMADOR',
    name: 'Meia Armador / Camisa 10',
    description: 'Visão privilegiada, cadência e passes que deixam companheiros na cara do gol.',
    defendingMultiplier: 0.82,
    passingMultiplier: 1.25,
    attackingMultiplier: 1.05,
    paceMultiplier: 0.9,
    staminaCostMultiplier: 0.92,
    foulMultiplier: 0.85,
  },
  PONTA_INVERTIDO: {
    role: 'PONTA_INVERTIDO',
    name: 'Ponta Invertido',
    description: 'Corta da ponta para o meio para finalizar com o pé bom.',
    defendingMultiplier: 0.85,
    passingMultiplier: 1.0,
    attackingMultiplier: 1.2,
    paceMultiplier: 1.12,
    staminaCostMultiplier: 1.05,
    foulMultiplier: 0.95,
  },
  PONTA_LINHA_DE_FUNDO: {
    role: 'PONTA_LINHA_DE_FUNDO',
    name: 'Ponta Agudo / Linha de Fundo',
    description: 'Drible vertical e cruzamento rápido para a área.',
    defendingMultiplier: 0.85,
    passingMultiplier: 1.15,
    attackingMultiplier: 1.02,
    paceMultiplier: 1.2,
    staminaCostMultiplier: 1.08,
    foulMultiplier: 0.95,
  },
  CENTROAVANTE_REFERENCIA: {
    role: 'CENTROAVANTE_REFERENCIA',
    name: 'Homem de Referência / Pivô',
    description: 'Forte no jogo aéreo, protege a bola de costas para a zaga.',
    defendingMultiplier: 0.85,
    passingMultiplier: 0.95,
    attackingMultiplier: 1.22,
    paceMultiplier: 0.9,
    staminaCostMultiplier: 1.0,
    foulMultiplier: 1.05,
  },
  FALSO_NOVE: {
    role: 'FALSO_NOVE',
    name: 'Falso 9',
    description: 'Recua para atrair zagueiros e serve companheiros que infiltram.',
    defendingMultiplier: 0.9,
    passingMultiplier: 1.2,
    attackingMultiplier: 1.05,
    paceMultiplier: 1.0,
    staminaCostMultiplier: 1.05,
    foulMultiplier: 0.9,
  },
};

/**
 * Computes combined modifiers for a player based on their assigned functions.
 * Stacks up to MAX_PLAYER_FUNCTIONS (or defaults to neutral 1.0).
 */
export function getPlayerRoleModifiers(functions: PlayerFunction[] = []): {
  defendingMultiplier: number;
  passingMultiplier: number;
  attackingMultiplier: number;
  paceMultiplier: number;
  staminaCostMultiplier: number;
  foulMultiplier: number;
} {
  if (!functions || functions.length === 0) {
    return {
      defendingMultiplier: 1.0,
      passingMultiplier: 1.0,
      attackingMultiplier: 1.0,
      paceMultiplier: 1.0,
      staminaCostMultiplier: 1.0,
      foulMultiplier: 1.0,
    };
  }

  let def = 1.0;
  let pass = 1.0;
  let att = 1.0;
  let pace = 1.0;
  let stamina = 1.0;
  let foul = 1.0;

  for (const fn of functions) {
    const mod = PLAYER_ROLE_MODIFIERS[fn];
    if (mod) {
      def *= mod.defendingMultiplier;
      pass *= mod.passingMultiplier;
      att *= mod.attackingMultiplier;
      pace *= mod.paceMultiplier;
      stamina *= mod.staminaCostMultiplier;
      foul *= mod.foulMultiplier;
    }
  }

  return {
    defendingMultiplier: Number(def.toFixed(3)),
    passingMultiplier: Number(pass.toFixed(3)),
    attackingMultiplier: Number(att.toFixed(3)),
    paceMultiplier: Number(pace.toFixed(3)),
    staminaCostMultiplier: Number(stamina.toFixed(3)),
    foulMultiplier: Number(foul.toFixed(3)),
  };
}

/**
 * Assistant Manager recommendation: picks the ideal tactical role for a player
 * based on their position, attributes, and natural tendencies.
 */
export function autoAssignBestRolesForPlayer(player: Player): PlayerFunction[] {
  if (!player || !player.attributes) {
    return [];
  }
  switch (player.position) {
    case 'GK':
      return [];

    case 'DEF':
      if (player.attributes.passing >= 66) {
        return ['ZAGUEIRO_CONSTRUTOR'];
      }
      return ['ZAGUEIRO_REBATEDOR'];

    case 'LAT':
      if (player.attributes.passing >= 70 || player.attributes.pace >= 78) {
        return ['ALA_OFENSIVO'];
      }
      if (player.attributes.passing >= 64) {
        return ['LATERAL_CONSTRUTOR'];
      }
      return ['LATERAL'];

    case 'MID':
      if (player.attributes.defending >= 74 && player.attributes.defending > player.attributes.passing) {
        return ['VOLANTE_CAO_DE_GUARDA'];
      }
      if (player.attributes.physical >= 72 && player.attributes.passing >= 66) {
        return ['MEIA_BOX_TO_BOX'];
      }
      if (player.attributes.passing >= 70) {
        return ['MEIA_ARMADOR'];
      }
      if (player.attributes.defending >= 65) {
        return ['VOLANTE'];
      }
      return ['MEIA_CRIACAO'];

    case 'ATT':
      if (player.attributes.pace >= 80) {
        if (player.attributes.finishing >= player.attributes.passing) {
          return ['PONTA_INVERTIDO'];
        }
        return ['PONTA_LINHA_DE_FUNDO'];
      }
      if (player.attributes.passing >= 72 && player.attributes.finishing >= 65) {
        return ['FALSO_NOVE'];
      }
      return ['CENTROAVANTE_REFERENCIA'];

    default:
      return [];
  }
}

/**
 * Auto-assigns ideal roles to all specified players (or whole squad).
 * Used by the 1-click "⚡ Papéis Ideais (Auxiliar)" delegation button.
 */
export function autoAssignSquadRoles(
  playerIds: string[],
  squad: Player[],
): Record<string, PlayerFunction[]> {
  const result: Record<string, PlayerFunction[]> = {};
  const squadMap = new Map(squad.map((p) => [p.id, p]));

  for (const id of playerIds) {
    const player = squadMap.get(id);
    if (player && player.position !== 'GK') {
      result[id] = autoAssignBestRolesForPlayer(player);
    }
  }

  return result;
}
