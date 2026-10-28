/** Five hand-drawn stages, one per stadium level. */
const STADIUM_IMAGE_COUNT = 5;

export function stadiumImageUrl(level: number): string {
  const step = Math.max(1, Math.min(STADIUM_IMAGE_COUNT, level));
  return `/stadium/level-${step}.png`;
}

export function stadiumConstructionVideoUrl(targetLevel: number, step?: number): string {
  if (step && step >= 1 && step <= 4) {
    const tier = targetLevel > 1 && step === 4 ? targetLevel - 1 : Math.max(1, Math.min(4, targetLevel));
    return `/stadium/tier-${tier}-step-${step}.mp4`;
  }
  const t = Math.max(2, Math.min(5, targetLevel));
  return `/stadium/construction-tier-${t}.mp4`;
}

interface StadiumIconProps {
  level: number;
  size?: number;
  className?: string;
}

export function StadiumIcon({ level, size = 220, className }: StadiumIconProps) {
  return (
    <img
      src={stadiumImageUrl(level)}
      alt={`Estádio nível ${level}`}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
