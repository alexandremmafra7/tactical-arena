/**
 * TACTICAL ARENA FC — GUIA INTELIGENTE DE ZONAS DE UNIFORME 2D
 * Centraliza o mapa de zonas, regras de colisão, restrições dimensionais,
 * costuras raglan e algoritmo de ajuste de proporção para escudos, marcas esportivas e patrocinadores.
 */

export const JERSEY_CANONICAL_WIDTH = 200;
export const JERSEY_CANONICAL_HEIGHT = 200;

export type JerseyZoneId = 'A_CREST' | 'B_BRAND' | 'C_MASTER_SPONSOR' | 'D_OPTIONAL_SPONSOR';

export interface JerseyZoneConfig {
  id: JerseyZoneId;
  label: string;
  /** Coordenadas centrais (X, Y) na grade canônica de 200 × 200 */
  center: { x: number; y: number };
  maxWidth: number;
  maxHeight: number;
  minWidth: number;
  minHeight: number;
  anchor: 'center';
  zIndex: number;
  /** Margem de respiro interna da zona */
  padding: number;
}

export interface SeamCurve {
  start: { x: number; y: number };
  control: { x: number; y: number };
  end: { x: number; y: number };
}

/**
 * Definição geométrica oficial das costuras raglan e gola (Fonte única da verdade).
 * Usada tanto na validação de posicionamento quanto na renderização visual do SVG.
 */
export const JERSEY_SEAMS = {
  leftRaglan: {
    start: { x: 80, y: 26 },
    control: { x: 60, y: 62 },
    end: { x: 38, y: 96 },
  } as SeamCurve,
  rightRaglan: {
    start: { x: 120, y: 26 },
    control: { x: 140, y: 62 },
    end: { x: 162, y: 96 },
  } as SeamCurve,
  collar: 'M 80 26 Q 100 39 120 26',
  hem: 'M 42 192 Q 100 196 158 192',
};

/**
 * Mapa oficial calibrado de zonas de aplicação da camiseta.
 * Calibragem baseada na silhueta atlética frontal simétrica (eixo central x = 100):
 * - A_CREST (Escudo): Centro (130, 76), box 20x20. Posicionado no peito esquerdo,
 *   totalmente protegido e distante da costura raglan direita.
 * - B_BRAND (Marca Esportiva): Centro (70, 76), box 20x16. Simétrico ao escudo (x = 70),
 *   totalmente protegido e distante da costura raglan esquerda.
 * - C_MASTER_SPONSOR (Master): Centro (100, 112), box até 76x28. Abaixo das costuras (y > 96).
 * - D_OPTIONAL_SPONSOR (Opcional): Centro (100, 154), box até 60x18. Região inferior.
 */
export const JERSEY_ZONES: Record<JerseyZoneId, JerseyZoneConfig> = {
  A_CREST: {
    id: 'A_CREST',
    label: 'Escudo do Clube',
    center: { x: 130, y: 76 },
    maxWidth: 20,
    maxHeight: 20,
    minWidth: 12,
    minHeight: 12,
    anchor: 'center',
    zIndex: 10,
    padding: 1,
  },
  B_BRAND: {
    id: 'B_BRAND',
    label: 'Marca Esportiva',
    center: { x: 70, y: 76 },
    maxWidth: 20,
    maxHeight: 16,
    minWidth: 10,
    minHeight: 8,
    anchor: 'center',
    zIndex: 10,
    padding: 1,
  },
  C_MASTER_SPONSOR: {
    id: 'C_MASTER_SPONSOR',
    label: 'Patrocinador Principal',
    center: { x: 100, y: 112 },
    maxWidth: 76,
    maxHeight: 28,
    minWidth: 32,
    minHeight: 12,
    anchor: 'center',
    zIndex: 9,
    padding: 2,
  },
  D_OPTIONAL_SPONSOR: {
    id: 'D_OPTIONAL_SPONSOR',
    label: 'Patrocinador Opcional',
    center: { x: 100, y: 154 },
    maxWidth: 60,
    maxHeight: 18,
    minWidth: 24,
    minHeight: 8,
    anchor: 'center',
    zIndex: 8,
    padding: 2,
  },
};

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResolvedZonePlacement {
  zoneId: JerseyZoneId;
  box: BoundingBox;
  visible: boolean;
  scale: number;
  hasCollision: boolean;
  collisionDetails?: string;
  isWithinBounds: boolean;
}

/**
 * Calcula o tamanho proporcional (object-fit: contain) de uma arte dentro da zona,
 * respeitando os limites máximos e a proporção original da imagem.
 */
export function fitElementIntoZone(
  zone: JerseyZoneConfig,
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number; scale: number; box: BoundingBox } {
  const w = Math.max(1, naturalWidth);
  const h = Math.max(1, naturalHeight);

  const availableW = Math.max(4, zone.maxWidth - zone.padding * 2);
  const availableH = Math.max(4, zone.maxHeight - zone.padding * 2);

  const scale = Math.min(availableW / w, availableH / h, 1);
  const finalW = Math.max(4, Math.round(w * scale * 100) / 100);
  const finalH = Math.max(4, Math.round(h * scale * 100) / 100);

  const x = Math.round((zone.center.x - finalW / 2) * 100) / 100;
  const y = Math.round((zone.center.y - finalH / 2) * 100) / 100;

  return {
    width: finalW,
    height: finalH,
    scale,
    box: { x, y, width: finalW, height: finalH },
  };
}

/**
 * Verifica colisão (sobreposição de retângulos AABB) entre duas caixas.
 */
export function checkBoxesCollision(boxA: BoundingBox, boxB: BoundingBox, margin = 1): boolean {
  return !(
    boxA.x + boxA.width + margin <= boxB.x ||
    boxB.x + boxB.width + margin <= boxA.x ||
    boxA.y + boxA.height + margin <= boxB.y ||
    boxB.y + boxB.height + margin <= boxA.y
  );
}

/**
 * Limites da silhueta útil do tecido e validação contra costuras raglan.
 */
export function isWithinTorsoBounds(box: BoundingBox): boolean {
  const minX = 42;
  const maxX = 158;
  const minY = 36;
  const maxY = 188;

  if (
    box.x < minX ||
    box.x + box.width > maxX ||
    box.y < minY ||
    box.y + box.height > maxY
  ) {
    return false;
  }

  // Validação de proximidade / cruzamento com as costuras raglan (y <= 96)
  // Costura direita aproximada: x = 120 + 0.6 * (y - 26)
  // Costura esquerda aproximada: x = 80 - 0.6 * (y - 26)
  const boxTop = box.y;
  const boxBottom = Math.min(box.y + box.height, 96);

  if (boxTop <= 96) {
    // Lado esquerdo (Marca / B_BRAND)
    const rightEdgeLeft = box.x + box.width;
    const leftSeamTop = 80 - 0.6 * (Math.max(boxTop, 26) - 26);
    if (rightEdgeLeft <= 100 && box.x < leftSeamTop + 2) {
      return false; // Muito próximo ou cruzando a costura esquerda
    }

    // Lado direito (Escudo / A_CREST)
    const leftEdgeRight = box.x;
    const rightSeamTop = 120 + 0.6 * (Math.max(boxTop, 26) - 26);
    if (leftEdgeRight >= 100 && leftEdgeRight + box.width > rightSeamTop - 2) {
      return false; // Muito próximo ou cruzando a costura direita
    }
  }

  return true;
}

export interface ZoneInputItem {
  zoneId: JerseyZoneId;
  naturalWidth?: number;
  naturalHeight?: number;
  enabled?: boolean;
}

/**
 * Resolve o layout de todos os elementos das zonas simultaneamente:
 * - Redimensiona em contain
 * - Verifica limites de silhueta e costuras
 * - Detecta colisões
 * - Se houver colisão ou violação de limites, ajusta ou oculta o opcional.
 */
export function resolveJerseyZonesLayout(items: ZoneInputItem[]): Map<JerseyZoneId, ResolvedZonePlacement> {
  const result = new Map<JerseyZoneId, ResolvedZonePlacement>();

  for (const item of items) {
    if (!item.enabled) continue;
    const zone = JERSEY_ZONES[item.zoneId];
    if (!zone) continue;

    const naturalW = item.naturalWidth && item.naturalWidth > 0 ? item.naturalWidth : zone.maxWidth;
    const naturalH = item.naturalHeight && item.naturalHeight > 0 ? item.naturalHeight : zone.maxHeight;

    const { box, scale } = fitElementIntoZone(zone, naturalW, naturalH);
    let isWithinBounds = isWithinTorsoBounds(box);

    let finalBox = { ...box };
    let finalScale = scale;
    let visible = true;

    // Se violar os limites/costuras, tenta reduzir proporcionalmente antes de ocultar
    if (!isWithinBounds && (item.zoneId === 'A_CREST' || item.zoneId === 'B_BRAND')) {
      const reducedZone = { ...zone, maxWidth: zone.maxWidth * 0.85, maxHeight: zone.maxHeight * 0.85 };
      const fitRed = fitElementIntoZone(reducedZone, naturalW, naturalH);
      finalBox = fitRed.box;
      finalScale = fitRed.scale;
      isWithinBounds = isWithinTorsoBounds(finalBox);
    }

    if (!isWithinBounds && item.zoneId === 'D_OPTIONAL_SPONSOR') {
      visible = false;
    }

    result.set(item.zoneId, {
      zoneId: item.zoneId,
      box: finalBox,
      visible,
      scale: finalScale,
      hasCollision: false,
      isWithinBounds,
    });
  }

  // Verificação de colisões entre elementos ativos
  const master = result.get('C_MASTER_SPONSOR');
  const optional = result.get('D_OPTIONAL_SPONSOR');
  const crest = result.get('A_CREST');
  const brand = result.get('B_BRAND');

  if (master && optional && checkBoxesCollision(master.box, optional.box, 2)) {
    optional.hasCollision = true;
    optional.collisionDetails = 'Colisão detectada entre Patrocinador Master e Patrocinador Opcional. Opcional ocultado.';
    optional.visible = false;
  }

  if (master && crest && checkBoxesCollision(master.box, crest.box, 2)) {
    crest.hasCollision = true;
    crest.collisionDetails = 'Conflito de área entre Escudo e Patrocinador Master.';
  }

  if (master && brand && checkBoxesCollision(master.box, brand.box, 2)) {
    brand.hasCollision = true;
    brand.collisionDetails = 'Conflito de área entre Marca Esportiva e Patrocinador Master.';
  }

  return result;
}
