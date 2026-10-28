interface CountryFlagProps {
  code?: string | null;
  size?: number;
  /** Shown as a native hover tooltip (e.g. the country's full name) — omit to fall back to just `code`. */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Real flag artwork (4:3 SVGs from flag-icons, copied into public/flags) — emoji flags render inconsistently across platforms (especially Windows). */
export function CountryFlag({ code, size = 16, title, className = '', style }: CountryFlagProps) {
  const cleanCode = (code || 'BRA').toUpperCase();
  return (
    <img
      src={`/flags/${cleanCode}.svg`}
      alt={cleanCode}
      title={title ?? cleanCode}
      width={Math.round((size * 4) / 3)}
      height={size}
      className={`flag-icon ${className}`.trim()}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        borderRadius: 2,
        boxShadow: '0 0 1px rgba(0,0,0,0.5)',
        objectFit: 'cover',
        ...style,
      }}
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.src.endsWith('/flags/BRA.svg')) {
          img.src = '/flags/BRA.svg';
        }
      }}
    />
  );
}
