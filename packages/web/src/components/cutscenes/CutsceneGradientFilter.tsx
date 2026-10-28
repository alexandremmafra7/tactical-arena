import React from 'react';
import { getClubTingimentoColors } from '@tactical-arena/shared';

interface CutsceneGradientFilterProps {
  club?: any;
}

export const CutsceneGradientFilter: React.FC<CutsceneGradientFilterProps> = ({ club }) => {
  const colors = getClubTingimentoColors(club);
  const { darkColor, primaryColor, secondaryColor } = colors;

  return (
    <svg aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <filter id="club-gradient-tint" colorInterpolationFilters="sRGB">
        {/* Step 1: Convert to grayscale luminance */}
        <feColorMatrix
          type="matrix"
          values="0.33 0.33 0.33 0 0
                  0.33 0.33 0.33 0 0
                  0.33 0.33 0.33 0 0
                  0 0 0 1 0"
          result="gray"
        />
        {/* Step 2: Map grayscale to club gradient (darkColor -> primaryColor -> secondaryColor) */}
        <feComponentTransfer in="gray" result="colored">
          <feFuncR type="table" tableValues={`${hexToChannel(darkColor, 'r')} ${hexToChannel(primaryColor, 'r')} ${hexToChannel(secondaryColor, 'r')}`} />
          <feFuncG type="table" tableValues={`${hexToChannel(darkColor, 'g')} ${hexToChannel(primaryColor, 'g')} ${hexToChannel(secondaryColor, 'g')}`} />
          <feFuncB type="table" tableValues={`${hexToChannel(darkColor, 'b')} ${hexToChannel(primaryColor, 'b')} ${hexToChannel(secondaryColor, 'b')}`} />
        </feComponentTransfer>
        <feBlend mode="normal" in="colored" in2="SourceGraphic" result="blend" />
      </filter>
    </svg>
  );
};

function hexToChannel(hex: string, channel: 'r' | 'g' | 'b'): number {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  let val = 0;
  if (channel === 'r') val = (num >> 16) & 255;
  if (channel === 'g') val = (num >> 8) & 255;
  if (channel === 'b') val = num & 255;
  return val / 255;
}
