import { useState, useId, useMemo, type CSSProperties } from 'react';
import type { KitPattern } from '@tactical-arena/shared';
import {
  JERSEY_CANONICAL_WIDTH,
  JERSEY_CANONICAL_HEIGHT,
  JERSEY_ZONES,
  JERSEY_SEAMS,
  resolveJerseyZonesLayout,
  getSponsorLogoUrl,
  resolveClubKit,
} from '@tactical-arena/shared';
import { ClubCrest } from './ClubCrest.js';

export interface ModernJersey2DProps {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  kitPattern?: KitPattern | null;
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  debug?: boolean;

  /** Dados do clube para exibição do escudo oficial / customizado */
  club?: {
    id: string;
    name: string;
    slug?: string | null;
    crestBase64?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
  } | null;
  customCrestUrl?: string | null;

  /** Marca esportiva (fornecedor) */
  supplierName?: string | null;
  supplierLogoUrl?: string | null;
  showBrand?: boolean;

  /** Patrocinador principal (Master) */
  masterSponsorName?: string | null;
  masterSponsorLogoUrl?: string | null;
  showMasterSponsor?: boolean;

  /** Patrocinador opcional (inferior/regional) */
  optionalSponsorName?: string | null;
  optionalSponsorLogoUrl?: string | null;
  showOptionalSponsor?: boolean;

  /** Modo uniforme reserva */
  isAway?: boolean;
  awayPrimaryColor?: string | null;
  awaySecondaryColor?: string | null;
  awayKitPattern?: KitPattern | null;
}

function getLuminance(hex: string): number {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return 0.5;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function formatChestText(name: string): string {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length <= 2) return name.trim().toUpperCase();
  return `${words[0]} ${words[1]}`.toUpperCase();
}

/**
 * Converte nome da marca do fornecedor para os assets transparentes de camiseta
 */
export function getKitSupplierJerseyAsset(supplierName: string): string {
  const clean = supplierName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  const specialMap: Record<string, string> = {
    'titan-sport': '/sponsors/kit-supplier/para camiseta/titan-sport-mark-removebg-preview.png',
    'zenit-sports': '/sponsors/kit-supplier/para camiseta/zenit-sports-mark-removebg-preview.png',
    'vortex-athletic': '/sponsors/kit-supplier/para camiseta/vortex-athletic-mark-removebg-preview.png',
    'prisma-sportswear': '/sponsors/kit-supplier/para camiseta/prisma-sportswear-mark-removebg-preview.png',
    'maxima-sportswear': '/sponsors/kit-supplier/para camiseta/maxima-sportswear-mark-removebg-preview.png',
    'impacto-athletic': '/sponsors/kit-supplier/para camiseta/impacto-athletic-mark-removebg-preview.png',
    'garra-esportes': '/sponsors/kit-supplier/para camiseta/garra-esportes-mark-removebg-preview.png',
    'furia-esportes': '/sponsors/kit-supplier/para camiseta/furia-esportes-mark-removebg-preview.png',
    'raio-esportivo': '/sponsors/kit-supplier/para camiseta/raio-esportivo-mark-removebg-preview.png',
    'rasante-esportivo': '/sponsors/kit-supplier/para camiseta/rasante-esportivo-mark-removebg-preview.png',
    'rincon-sports': '/sponsors/kit-supplier/para camiseta/rincon-sports-mark-removebg-preview.png',
    'trinca-sports': '/sponsors/kit-supplier/para camiseta/trinca-sports-mark-removebg-preview.png',
    'vigor-sports': '/sponsors/kit-supplier/para camiseta/vigor-sports-mark-removebg-preview.png',
  };

  return specialMap[clean] || getSponsorLogoUrl(supplierName, 'KIT_SUPPLIER', true);
}

/**
 * CAMISETA 2D PROFISSIONAL — TACTICAL ARENA FC
 * Renderizador baseado em camadas SVG com zonas calibradas e costuras dinâmicas.
 */
export function ModernJersey2D({
  primaryColor,
  secondaryColor,
  kitPattern,
  size = 180,
  className = '',
  style,
  debug = false,
  club,
  customCrestUrl,
  supplierName,
  supplierLogoUrl,
  showBrand = true,
  masterSponsorName,
  masterSponsorLogoUrl,
  showMasterSponsor = true,
  optionalSponsorName,
  optionalSponsorLogoUrl,
  showOptionalSponsor = false,
  isAway = false,
  awayPrimaryColor,
  awaySecondaryColor,
  awayKitPattern,
}: ModernJersey2DProps) {
  const reactId = useId().replace(/:/g, '_');

  const [supplierError, setSupplierError] = useState(false);
  const [masterError, setMasterError] = useState(false);
  const [optionalError, setOptionalError] = useState(false);

  // Detecção automática de query param de debug (?jerseyDebug=1)
  const isDebugActive = useMemo(() => {
    if (debug) return true;
    if (typeof window !== 'undefined' && window.location?.search?.includes('jerseyDebug=1')) {
      return true;
    }
    return false;
  }, [debug]);

  // Resolve o kit completo através da base canônica oficial ou customizações do clube
  const resolvedKit = useMemo(() => {
    return resolveClubKit({
      slug: club?.slug,
      name: club?.name,
      primaryColor: primaryColor ?? club?.primaryColor,
      secondaryColor: secondaryColor ?? club?.secondaryColor,
      kitPattern: kitPattern ?? (club as any)?.kitPattern,
      awayPrimaryColor: awayPrimaryColor ?? (club as any)?.awayPrimaryColor,
      awaySecondaryColor: awaySecondaryColor ?? (club as any)?.awaySecondaryColor,
      awayKitPattern: awayKitPattern ?? (club as any)?.awayKitPattern,
    });
  }, [club, primaryColor, secondaryColor, kitPattern, awayPrimaryColor, awaySecondaryColor, awayKitPattern]);

  // Cores dinâmicas para Home e Away
  const basePrimary = isAway ? resolvedKit.awayPrimaryColor : resolvedKit.primaryColor;
  const baseSecondary = isAway ? resolvedKit.awaySecondaryColor : resolvedKit.secondaryColor;
  const activePattern = isAway ? resolvedKit.awayKitPattern : resolvedKit.kitPattern;

  let activePrimary = basePrimary;
  let activeSecondary = baseSecondary;

  if (isAway && !awayPrimaryColor && !awayKitPattern && !(club as any)?.awayPrimaryColor) {
    const lum1 = getLuminance(resolvedKit.primaryColor);
    const lum2 = getLuminance(resolvedKit.secondaryColor);

    if (lum1 < 0.45 && lum2 < 0.45) {
      activePrimary = '#f8fafc';
      activeSecondary = resolvedKit.primaryColor;
    } else if (lum1 >= 0.7) {
      activePrimary = lum2 < 0.45 ? resolvedKit.secondaryColor : '#0f172a';
      activeSecondary = resolvedKit.primaryColor;
    }
  }

  // Zonas inteligentes resolvidas matematicamente
  const layout = useMemo(() => {
    return resolveJerseyZonesLayout([
      { zoneId: 'A_CREST', naturalWidth: 20, naturalHeight: 20, enabled: Boolean(club || customCrestUrl) },
      { zoneId: 'B_BRAND', naturalWidth: 20, naturalHeight: 16, enabled: showBrand },
      { zoneId: 'C_MASTER_SPONSOR', naturalWidth: 76, naturalHeight: 28, enabled: showMasterSponsor && Boolean(masterSponsorName) },
      { zoneId: 'D_OPTIONAL_SPONSOR', naturalWidth: 60, naturalHeight: 18, enabled: showOptionalSponsor && Boolean(optionalSponsorName) },
    ]);
  }, [club, customCrestUrl, showBrand, showMasterSponsor, masterSponsorName, showOptionalSponsor, optionalSponsorName]);

  const crestPlacement = layout.get('A_CREST');
  const brandPlacement = layout.get('B_BRAND');
  const masterPlacement = layout.get('C_MASTER_SPONSOR');
  const optionalPlacement = layout.get('D_OPTIONAL_SPONSOR');

  const resolvedSupplierLogo = supplierLogoUrl !== undefined
    ? supplierLogoUrl
    : (supplierName ? getKitSupplierJerseyAsset(supplierName) : null);

  const resolvedMasterLogo = masterSponsorLogoUrl !== undefined
    ? masterSponsorLogoUrl
    : (masterSponsorName ? getSponsorLogoUrl(masterSponsorName, 'MASTER', false) : null);

  const resolvedOptionalLogo = optionalSponsorLogoUrl !== undefined
    ? optionalSponsorLogoUrl
    : (optionalSponsorName ? getSponsorLogoUrl(optionalSponsorName, 'REGIONAL', false) : null);

  const dimensionStyle: CSSProperties = {
    position: 'relative',
    width: typeof size === 'number' ? `${size}px` : size,
    height: typeof size === 'number' ? `${size}px` : size,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  const clipId = `jersey_clip_${reactId}`;
  const patternVertId = `pattern_vert_${reactId}`;
  const patternHorizId = `pattern_horiz_${reactId}`;
  const patternSashId = `pattern_sash_${reactId}`;
  const patternHalvesId = `pattern_halves_${reactId}`;
  const patternGradientId = `pattern_gradient_${reactId}`;
  const fabricDepthId = `fabric_depth_${reactId}`;
  const sideShadowId = `side_shadow_${reactId}`;

  // Caminho da silhueta frontal simétrica e atlética
  const jerseySilhouettePath = 'M 80 26 Q 100 38 120 26 L 164 42 L 186 82 L 162 96 L 158 192 Q 100 196 42 192 L 38 96 L 14 82 L 36 42 Z';

  return (
    <div className={`modern-jersey-2d-root ${className}`} style={dimensionStyle}>
      <svg
        viewBox={`0 0 ${JERSEY_CANONICAL_WIDTH} ${JERSEY_CANONICAL_HEIGHT}`}
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{
          display: 'block',
          overflow: 'visible',
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.30))',
        }}
      >
        <defs>
          {/* 1. Máscara de silhueta da camiseta */}
          <clipPath id={clipId}>
            <path d={jerseySilhouettePath} />
          </clipPath>

          {/* 2. Padrões gráficos */}
          <pattern id={patternVertId} width="24" height="200" patternUnits="userSpaceOnUse">
            <rect width="12" height="200" fill={activePrimary} />
            <rect x="12" width="12" height="200" fill={activeSecondary} />
          </pattern>

          <pattern id={patternHorizId} width="200" height="28" patternUnits="userSpaceOnUse">
            <rect width="200" height="14" fill={activePrimary} />
            <rect y="14" width="200" height="14" fill={activeSecondary} />
          </pattern>

          <linearGradient id={patternSashId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={activePrimary} />
            <stop offset="38%" stopColor={activePrimary} />
            <stop offset="38%" stopColor={activeSecondary} />
            <stop offset="62%" stopColor={activeSecondary} />
            <stop offset="62%" stopColor={activePrimary} />
            <stop offset="100%" stopColor={activePrimary} />
          </linearGradient>

          <linearGradient id={patternHalvesId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={activePrimary} />
            <stop offset="50%" stopColor={activePrimary} />
            <stop offset="50%" stopColor={activeSecondary} />
            <stop offset="100%" stopColor={activeSecondary} />
          </linearGradient>

          <linearGradient id={patternGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={activePrimary} />
            <stop offset="100%" stopColor={activeSecondary} />
          </linearGradient>

          {/* 3. Textura e profundidade de tecido realista */}
          <linearGradient id={fabricDepthId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="25%" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="75%" stopColor="#000000" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
          </linearGradient>

          <linearGradient id={sideShadowId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.22" />
            <stop offset="15%" stopColor="#000000" stopOpacity="0.0" />
            <stop offset="85%" stopColor="#000000" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
          </linearGradient>
        </defs>

        {/* Camadas de tecido (clipPath) */}
        <g clipPath={`url(#${clipId})`}>
          {/* Base sólida de segurança */}
          <rect width="200" height="200" fill={activePrimary} />

          {/* Padrão selecionado */}
          {activePattern === 'STRIPES_VERTICAL' && <rect width="200" height="200" fill={`url(#${patternVertId})`} />}
          {activePattern === 'STRIPES_HORIZONTAL' && <rect width="200" height="200" fill={`url(#${patternHorizId})`} />}
          {activePattern === 'DIAGONAL_SASH' && <rect width="200" height="200" fill={`url(#${patternSashId})`} />}
          {activePattern === 'HALVES' && <rect width="200" height="200" fill={`url(#${patternHalvesId})`} />}
          {activePattern === 'GRADIENT' && <rect width="200" height="200" fill={`url(#${patternGradientId})`} />}

          {/* Textura e sombreamento base do tecido */}
          <rect width="200" height="200" fill={`url(#${fabricDepthId})`} />
          <rect width="200" height="200" fill={`url(#${sideShadowId})`} />
        </g>

        {/* =========================================================================
            LOGOS E ESCUDO (Renderizados ANTES das costuras para integração profissional)
           ========================================================================= */}

        {/* ZONA B: MARCA ESPORTIVA (Fornecedor) */}
        {brandPlacement?.visible && (
          <g
            transform={`translate(${brandPlacement.box.x}, ${brandPlacement.box.y})`}
            style={{ mixBlendMode: 'multiply' }}
          >
            {resolvedSupplierLogo && !supplierError ? (
              <image
                href={resolvedSupplierLogo}
                width={brandPlacement.box.width}
                height={brandPlacement.box.height}
                preserveAspectRatio="xMidYMid meet"
                onError={() => setSupplierError(true)}
              />
            ) : (
              <text
                x={brandPlacement.box.width / 2}
                y={brandPlacement.box.height / 2 + 3}
                textAnchor="middle"
                fill={activeSecondary}
                fontFamily="'Space Grotesk', system-ui, sans-serif"
                fontSize="9"
                fontWeight="800"
                letterSpacing="0.05em"
              >
                {supplierName ? supplierName.slice(0, 2).toUpperCase() : 'TA'}
              </text>
            )}
          </g>
        )}

        {/* ZONA A: ESCUDO DO CLUBE (Movido para dentro do SVG via foreignObject) */}
        {crestPlacement?.visible && (
          <foreignObject
            x={crestPlacement.box.x}
            y={crestPlacement.box.y}
            width={crestPlacement.box.width}
            height={crestPlacement.box.height}
            style={{ overflow: 'visible' }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              {customCrestUrl ? (
                <img
                  src={customCrestUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : club ? (
                <ClubCrest club={club} size={crestPlacement.box.width} />
              ) : null}
            </div>
          </foreignObject>
        )}

        {/* ZONA C: PATROCINADOR MASTER */}
        {masterPlacement?.visible && masterSponsorName && (
          <g
            transform={`translate(${masterPlacement.box.x}, ${masterPlacement.box.y})`}
            style={{ mixBlendMode: 'multiply' }}
          >
            {activePattern !== 'SOLID' && (
              <rect
                x="-3"
                y="-2"
                width={masterPlacement.box.width + 6}
                height={masterPlacement.box.height + 4}
                rx="2"
                fill="rgba(255, 255, 255, 0.20)"
              />
            )}
            {resolvedMasterLogo && !masterError ? (
              <image
                href={resolvedMasterLogo}
                width={masterPlacement.box.width}
                height={masterPlacement.box.height}
                preserveAspectRatio="xMidYMid meet"
                onError={() => setMasterError(true)}
              />
            ) : (
              <text
                x={masterPlacement.box.width / 2}
                y={masterPlacement.box.height / 2 + 3}
                textAnchor="middle"
                fill="#ffffff"
                fontFamily="'Space Grotesk', system-ui, sans-serif"
                fontSize={masterPlacement.box.height > 20 ? '10' : '8.5'}
                fontWeight="900"
                letterSpacing="0.05em"
              >
                {formatChestText(masterSponsorName)}
              </text>
            )}
          </g>
        )}

        {/* ZONA D: PATROCINADOR OPCIONAL */}
        {optionalPlacement?.visible && optionalSponsorName && (
          <g
            transform={`translate(${optionalPlacement.box.x}, ${optionalPlacement.box.y})`}
            style={{ mixBlendMode: 'multiply' }}
          >
            {resolvedOptionalLogo && !optionalError ? (
              <image
                href={resolvedOptionalLogo}
                width={optionalPlacement.box.width}
                height={optionalPlacement.box.height}
                preserveAspectRatio="xMidYMid meet"
                onError={() => setOptionalError(true)}
              />
            ) : (
              <text
                x={optionalPlacement.box.width / 2}
                y={optionalPlacement.box.height / 2 + 3}
                textAnchor="middle"
                fill="#cbd5e1"
                fontFamily="'Space Grotesk', system-ui, sans-serif"
                fontSize="7.5"
                fontWeight="700"
                letterSpacing="0.04em"
              >
                {formatChestText(optionalSponsorName)}
              </text>
            )}
          </g>
        )}

        {/* =========================================================================
            COSTURAS E ACABAMENTOS (Renderizados POR CIMA dos logos, com blend mode)
           ========================================================================= */}
        <g style={{ mixBlendMode: 'multiply', opacity: 0.85 }}>
          {/* Costura Raglan Esquerda a partir de JERSEY_SEAMS */}
          <path
            d={`M ${JERSEY_SEAMS.leftRaglan.start.x} ${JERSEY_SEAMS.leftRaglan.start.y} Q ${JERSEY_SEAMS.leftRaglan.control.x} ${JERSEY_SEAMS.leftRaglan.control.y} ${JERSEY_SEAMS.leftRaglan.end.x} ${JERSEY_SEAMS.leftRaglan.end.y}`}
            fill="none"
            stroke="rgba(0,0,0,0.25)"
            strokeWidth="1.2"
            strokeDasharray="3,2"
          />
          {/* Costura Raglan Direita a partir de JERSEY_SEAMS */}
          <path
            d={`M ${JERSEY_SEAMS.rightRaglan.start.x} ${JERSEY_SEAMS.rightRaglan.start.y} Q ${JERSEY_SEAMS.rightRaglan.control.x} ${JERSEY_SEAMS.rightRaglan.control.y} ${JERSEY_SEAMS.rightRaglan.end.x} ${JERSEY_SEAMS.rightRaglan.end.y}`}
            fill="none"
            stroke="rgba(0,0,0,0.25)"
            strokeWidth="1.2"
            strokeDasharray="3,2"
          />
        </g>

        {/* Gola anatômica e punhos */}
        <path d="M 80 26 Q 100 20 120 26 Q 100 32 80 26" fill="rgba(0,0,0,0.25)" />
        <path
          d={JERSEY_SEAMS.collar}
          fill="none"
          stroke={activeSecondary}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <line x1="14" y1="82" x2="38" y2="96" stroke={activeSecondary} strokeWidth="3" strokeLinecap="round" />
        <line x1="186" y1="82" x2="162" y2="96" stroke={activeSecondary} strokeWidth="3" strokeLinecap="round" />
        <path
          d={JERSEY_SEAMS.hem}
          fill="none"
          stroke="rgba(0,0,0,0.20)"
          strokeWidth="1.2"
        />

        {/* =========================================================================
            MODO DEBUG (Visualização exata de zonas, âncoras, margens e costuras)
           ========================================================================= */}
        {isDebugActive && (
          <g className="jersey-debug-overlay" pointerEvents="none">
            {/* Silhueta contorno debug */}
            <path d={jerseySilhouettePath} fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2,2" opacity="0.7" />

            {/* Renderiza caixas de zonas e centros */}
            {Object.entries(JERSEY_ZONES).map(([key, zone]) => {
              const placement = layout.get(key as any);
              const box = placement ? placement.box : { x: zone.center.x - zone.maxWidth / 2, y: zone.center.y - zone.maxHeight / 2, width: zone.maxWidth, height: zone.maxHeight };
              const color = key === 'A_CREST' ? '#10b981' : key === 'B_BRAND' ? '#8b5cf6' : key === 'C_MASTER_SPONSOR' ? '#f59e0b' : '#ec4899';

              return (
                <g key={key}>
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    fill={color}
                    fillOpacity="0.15"
                    stroke={color}
                    strokeWidth="1"
                    strokeDasharray="2,1"
                  />
                  <circle cx={zone.center.x} cy={zone.center.y} r="1.5" fill={color} />
                  <text
                    x={box.x}
                    y={Math.max(10, box.y - 2)}
                    fill={color}
                    fontSize="6"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {key} ({zone.center.x},{zone.center.y})
                  </text>
                </g>
              );
            })}

            {/* Linhas de eixo central */}
            <line x1="100" y1="20" x2="100" y2="190" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="1,1" opacity="0.6" />
          </g>
        )}
      </svg>
    </div>
  );
}
