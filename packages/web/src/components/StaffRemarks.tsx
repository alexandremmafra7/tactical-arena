import { type StaffRemark } from '@tactical-arena/shared';
import { PromessaSub20Icon } from './SpecialPlayerIcon.js';
import { AlertTriangleIcon, StaffRoleIcon } from './icons/AppIcons.js';

const TONE_STYLE: Record<StaffRemark['tone'], { border: string; text: string; background: string }> = {
  WARNING: { border: 'rgba(239, 68, 68, 0.35)', text: '#fca5a5', background: 'rgba(239, 68, 68, 0.1)' },
  OPPORTUNITY: { border: 'rgba(34, 197, 94, 0.35)', text: '#86efac', background: 'rgba(34, 197, 94, 0.1)' },
  INFO: { border: 'rgba(255, 255, 255, 0.1)', text: '#cbd5e1', background: 'rgba(0, 0, 0, 0.25)' },
  VACANT: { border: 'rgba(245, 158, 11, 0.3)', text: '#fbbf24', background: 'rgba(245, 158, 11, 0.08)' },
};

/**
 * The comissão, speaking on the screen where their work is.
 *
 * They used to exist only on their own page: five cards, a hire button, and multipliers applied silently
 * somewhere else. This is the other half of the fix, and it is deliberately quiet. Every line is an opinion
 * with a name attached, and none of them has a button: nothing here changes a lineup, a price or a budget.
 * The manager reads it and decides, which is the whole point of employing somebody.
 */
export function StaffRemarks({ remarks, title }: { remarks: StaffRemark[]; title?: string }) {
  if (remarks.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '10px 0' }}>
      {title && (
        <span className="muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
      )}
      {remarks.map((remark, index) => {
        const tone = TONE_STYLE[remark.tone];
        return (
          <div
            key={`${remark.role}-${remark.playerId ?? index}`}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: tone.background, border: `1px solid ${tone.border}`,
              borderRadius: 8, padding: '8px 10px', fontSize: '0.83rem',
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1.2, display: 'inline-flex', alignItems: 'center', marginTop: 1 }}>
              {remark.tone === 'VACANT' ? (
                <AlertTriangleIcon size={16} color="#fbbf24" />
              ) : remark.role === 'YOUTH_COORDINATOR' ? (
                <PromessaSub20Icon size={18} showGlow={false} />
              ) : (
                <StaffRoleIcon role={remark.role} size={16} color={tone.text} />
              )}
            </span>
            <span style={{ color: tone.text }}>
              {remark.staffName && (
                <strong style={{ color: '#fff', marginRight: 6 }}>{remark.staffName}:</strong>
              )}
              {remark.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
