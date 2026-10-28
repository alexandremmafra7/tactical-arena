import { useMemo, useState } from 'react';
import {
  COUNTRIES,
  CREST_RULES,
  buildCrestPrompt,
  type FoundCareerClub,
  type KitPattern,
  JERSEY_ZONES,
  fitElementIntoZone,
  checkBoxesCollision,
} from '@tactical-arena/shared';
import { CountryFlag } from './CountryFlag.js';
import { ClubCrest } from './ClubCrest.js';
import { ModernJersey2D } from './ModernJersey2D.js';

/** Mirrors CITY_SIZES on the server, which is where the numbers actually take effect. */
const CITY_SIZES = [
  { key: 'SMALL', label: 'Cidade pequena', detail: 'Campo de 2.000 lugares. Você fica com todo o dinheiro.' },
  { key: 'MEDIUM', label: 'Cidade média', detail: 'Estádio de 8.000 lugares. Custa 30% do caixa inicial.' },
  { key: 'LARGE', label: 'Cidade grande', detail: 'Estádio de 15.000 lugares. Custa 55% do caixa inicial.' },
] as const;

const KIT_PATTERNS: Array<{ key: KitPattern; label: string }> = [
  { key: 'SOLID', label: 'Lisa' },
  { key: 'STRIPES_VERTICAL', label: 'Listras Verticais' },
  { key: 'STRIPES_HORIZONTAL', label: 'Listras Horizontais' },
  { key: 'DIAGONAL_SASH', label: 'Faixa Diagonal' },
  { key: 'HALVES', label: 'Metade a Metade' },
  { key: 'GRADIENT', label: 'Degradê' },
];

const PRESET_COLOR_PAIRS = [
  { label: 'Vermelho / Branco', primary: '#e11d48', secondary: '#ffffff' },
  { label: 'Azul / Branco', primary: '#2563eb', secondary: '#ffffff' },
  { label: 'Verde / Branco', primary: '#16a34a', secondary: '#ffffff' },
  { label: 'Preto / Branco', primary: '#18181b', secondary: '#ffffff' },
  { label: 'Vermelho / Preto', primary: '#dc2626', secondary: '#18181b' },
  { label: 'Amarelo / Preto', primary: '#eab308', secondary: '#18181b' },
  { label: 'Azul / Amarelo', primary: '#1d4ed8', secondary: '#facc15' },
  { label: 'Vinho / Dourado', primary: '#881337', secondary: '#fbbf24' },
];

const AWAY_PRESET_PAIRS = [
  { label: 'Branco Clássico', primary: '#f8fafc', secondary: '#1e293b' },
  { label: 'Preto Noturno', primary: '#0f172a', secondary: '#fbbf24' },
  { label: 'Amarelo Canário', primary: '#facc15', secondary: '#1e3a8a' },
  { label: 'Cinza Prata', primary: '#94a3b8', secondary: '#0f172a' },
  { label: 'Azul Celeste', primary: '#38bdf8', secondary: '#ffffff' },
  { label: 'Dourado / Vinho', primary: '#fbbf24', secondary: '#881337' },
];

const POPULAR_KIT_SUPPLIERS = [
  'Titan Sport',
  'Apex Athletics',
  'Vortex Athletic',
  'Zenit Sports',
  'Prisma Sportswear',
  'Maxima Sportswear',
  'Rincon Sports',
  'Braza Athletic',
  'Garra Esportes',
  'Furia Esportes',
  'Raio Esportivo',
  'Rasante Esportivo',
  'Trinca Sports',
  'Vigor Sports',
];

const POPULAR_MASTER_SPONSORS = [
  'Aerolux Airways',
  'Banco Meridian Global',
  'Zafiro Seguros Internacional',
  'Petro Vanguard Energy',
  'Skyline Telecom Global',
  'Orion Motors',
  'Banco Confiança Continental',
  'Seguradora Vitalis Corp',
  'TeleConecta Corp',
  'Grupo Fortaleza Holdings',
  'Energetica Aurora',
  'Vetor Financeiro',
];

const POPULAR_OPTIONAL_SPONSORS = [
  'AutoCenter Trajeto',
  'Bebidas Correnteza',
  'Mercadão da Vila',
  'Farmácia Popular Saúde',
  'Padaria Espiga Dourada',
  'Distribuidora Tempero',
  'Mercadinho Poupança',
  'AutoPeças Serrano',
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

interface FoundClubFormProps {
  value: FoundCareerClub;
  foundable: { code: string; accessDivision: number; size: number }[];
  onChange: (next: FoundCareerClub) => void;
  errors?: Record<string, string>;
}

export function FoundClubForm({ value, foundable, onChange, errors }: FoundClubFormProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [activeKitTab, setActiveKitTab] = useState<'HOME' | 'AWAY'>('HOME');

  const awayPrimary = value.awayPrimaryColor || '#f8fafc';
  const awaySecondary = value.awaySecondaryColor || value.primaryColor || '#1e293b';
  const awayPattern = value.awayKitPattern || 'SOLID';

  const prompt = useMemo(
    () => buildCrestPrompt({
      clubName: value.name || 'meu clube',
      city: value.city,
      countryName: countryName(value.countryCode),
      colors: `${value.primaryColor} ${value.secondaryColor}`
    }),
    [value.name, value.city, value.countryCode, value.primaryColor, value.secondaryColor]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFileName(file?.name ?? null);
    if (file) {
      try {
        const b64 = await fileToBase64(file);
        onChange({
          ...value,
          crest: {
            ...value.crest,
            crestBase64: b64,
          },
        });
      } catch {
        setFileName(null);
      }
    } else {
      setFileName(null);
      onChange({
        ...value,
        crest: {
          ...value.crest,
          crestBase64: null,
        },
      });
    }
  };

  // Verificação de conflito / colisão visual entre Master e Opcional
  const collisionWarning = useMemo(() => {
    if (!value.showOptionalSponsor || !value.optionalSponsorName || !value.masterSponsorName) {
      return null;
    }
    const masterFit = fitElementIntoZone(JERSEY_ZONES.C_MASTER_SPONSOR, 76, 28);
    const optionalFit = fitElementIntoZone(JERSEY_ZONES.D_OPTIONAL_SPONSOR, 60, 18);
    const hasCollision = checkBoxesCollision(masterFit.box, optionalFit.box, 1);
    if (hasCollision) {
      return 'Aviso: Há sobreposição de espaço entre o Patrocinador Master e o Patrocinador Opcional. O opcional será ocultado para preservar o padrão profissional.';
    }
    return null;
  }, [value.showOptionalSponsor, value.optionalSponsorName, value.masterSponsorName]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Country and Club Basic Identification */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Nome do Clube:</label>
          <input
            placeholder="Ex: União Operária, Estrela FC..."
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            style={{ width: '100%' }}
          />
          {errors?.name && (
            <span role="alert" style={{ fontSize: '0.75rem', color: '#ef4444' }}>
              {errors.name}
            </span>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>Cidade:</label>
          <input
            placeholder="Ex: Santos, Belo Horizonte..."
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            style={{ width: '100%' }}
          />
          {errors?.city && (
            <span role="alert" style={{ fontSize: '0.75rem', color: '#ef4444' }}>
              {errors.city}
            </span>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>País da Liga:</label>
          <select
            value={value.countryCode}
            onChange={(e) => onChange({ ...value, countryCode: e.target.value })}
            style={{ width: '100%' }}
          >
            {foundable.map((f) => (
              <option key={f.code} value={f.code}>
                {countryName(f.code)} (Divisão {f.accessDivision})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Visual Identity Live Preview Card (Mostra Titular e Reserva Lado a Lado) */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 10,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ClubCrest
            club={{
              id: 'preview',
              name: value.name || 'Meu Clube',
              crestBase64: value.crest.crestBase64,
              primaryColor: value.primaryColor,
              secondaryColor: value.secondaryColor,
            }}
            size={56}
          />
          <div>
            <strong style={{ fontSize: '1.15rem', display: 'block', color: '#f8fafc' }}>{value.name || 'Nome do Clube'}</strong>
            <span className="muted" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <CountryFlag code={value.countryCode} size={14} />
              {value.city ? `${value.city}, ` : ''}
              {countryName(value.countryCode)}
            </span>
          </div>
        </div>

        {/* Showcase Duplo: Titular (Home) e Reserva (Away) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          {/* Card Miniatura Titular */}
          <div
            onClick={() => setActiveKitTab('HOME')}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: 8,
              background: activeKitTab === 'HOME' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: activeKitTab === 'HOME' ? '1px solid #38bdf8' : '1px solid transparent',
              transition: 'all 0.2s',
            }}
            title="Clique para editar o uniforme titular"
          >
            <div style={{ position: 'relative', width: 78, height: 78, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ModernJersey2D
                club={{
                  id: 'preview',
                  name: value.name || 'Meu Clube',
                  crestBase64: value.crest.crestBase64,
                  primaryColor: value.primaryColor,
                  secondaryColor: value.secondaryColor,
                }}
                kitPattern={value.kitPattern}
                primaryColor={value.primaryColor}
                secondaryColor={value.secondaryColor}
                isAway={false}
                supplierName={value.supplierName || 'Titan Sport'}
                masterSponsorName={value.masterSponsorName || null}
                optionalSponsorName={value.showOptionalSponsor ? value.optionalSponsorName : null}
                showOptionalSponsor={Boolean(value.showOptionalSponsor)}
                size={78}
              />
            </div>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: activeKitTab === 'HOME' ? '#38bdf8' : '#94a3b8', display: 'block', marginTop: 4 }}>
              1º Titular (Home)
            </span>
          </div>

          {/* Card Miniatura Reserva */}
          <div
            onClick={() => setActiveKitTab('AWAY')}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: 8,
              background: activeKitTab === 'AWAY' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: activeKitTab === 'AWAY' ? '1px solid #38bdf8' : '1px solid transparent',
              transition: 'all 0.2s',
            }}
            title="Clique para editar o uniforme reserva"
          >
            <div style={{ position: 'relative', width: 78, height: 78, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ModernJersey2D
                club={{
                  id: 'preview',
                  name: value.name || 'Meu Clube',
                  crestBase64: value.crest.crestBase64,
                  primaryColor: value.primaryColor,
                  secondaryColor: value.secondaryColor,
                }}
                kitPattern={awayPattern}
                primaryColor={awayPrimary}
                secondaryColor={awaySecondary}
                isAway={true}
                awayPrimaryColor={awayPrimary}
                awaySecondaryColor={awaySecondary}
                awayKitPattern={awayPattern}
                supplierName={value.supplierName || 'Titan Sport'}
                masterSponsorName={value.masterSponsorName || null}
                optionalSponsorName={value.showOptionalSponsor ? value.optionalSponsorName : null}
                showOptionalSponsor={Boolean(value.showOptionalSponsor)}
                size={78}
              />
            </div>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: activeKitTab === 'AWAY' ? '#38bdf8' : '#94a3b8', display: 'block', marginTop: 4 }}>
              2º Reserva (Away)
            </span>
          </div>
        </div>
      </div>

      {collisionWarning && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: '0.82rem',
            color: '#fca5a5',
          }}
        >
          {collisionWarning}
        </div>
      )}

      {/* City size choice */}
      <fieldset>
        <legend className="muted" style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          De onde vem o clube
        </legend>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {CITY_SIZES.map((size) => (
            <button
              key={size.key}
              type="button"
              className={value.citySize === size.key ? 'btn-primary' : 'btn-secondary'}
              onClick={() => onChange({ ...value, citySize: size.key })}
              style={{ textAlign: 'left', padding: '8px 12px', maxWidth: 230 }}
              aria-pressed={value.citySize === size.key}
            >
              <strong style={{ display: 'block' }}>{size.label}</strong>
              <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{size.detail}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Uniformes do Clube: Abas Titular e Reserva */}
      <fieldset>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <legend className="muted" style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Uniforme Oficial do Clube (Titular & Reserva)
          </legend>

          {/* Seletor de Aba de Uniforme */}
          <div style={{ display: 'inline-flex', gap: 6, background: 'rgba(0,0,0,0.35)', padding: 3, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              type="button"
              className={activeKitTab === 'HOME' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveKitTab('HOME')}
              style={{ padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600 }}
            >
              1º Uniforme (Titular)
            </button>
            <button
              type="button"
              className={activeKitTab === 'AWAY' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveKitTab('AWAY')}
              style={{ padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600 }}
            >
              2º Uniforme (Reserva)
            </button>
          </div>
        </div>

        {/* -------------------------------------------------------------
            ABA 1: UNIFORME TITULAR (HOME)
           ------------------------------------------------------------- */}
        {activeKitTab === 'HOME' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                Configurando Uniforme Titular (Home):
              </span>
              <span className="muted" style={{ fontSize: '0.78rem' }}>
                ({KIT_PATTERNS.find((p) => p.key === value.kitPattern)?.label})
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {KIT_PATTERNS.map((pattern) => (
                <button
                  key={pattern.key}
                  type="button"
                  className={value.kitPattern === pattern.key ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => onChange({ ...value, kitPattern: pattern.key })}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  aria-pressed={value.kitPattern === pattern.key}
                >
                  {pattern.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <span>Cor Principal:</span>
                <input
                  type="color"
                  value={value.primaryColor}
                  onChange={(e) => onChange({ ...value, primaryColor: e.target.value })}
                  style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                />
                <input
                  type="text"
                  value={value.primaryColor}
                  onChange={(e) => onChange({ ...value, primaryColor: e.target.value })}
                  style={{ width: 80, fontSize: '0.8rem', padding: '4px 6px' }}
                />
                {errors?.primaryColor && (
                  <span role="alert" style={{ marginLeft: 8, fontSize: '0.75rem', color: '#ef4444' }}>
                    {errors.primaryColor}
                  </span>
                )}
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <span>Cor Secundária:</span>
                <input
                  type="color"
                  value={value.secondaryColor}
                  onChange={(e) => onChange({ ...value, secondaryColor: e.target.value })}
                  style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                />
                <input
                  type="text"
                  value={value.secondaryColor}
                  onChange={(e) => onChange({ ...value, secondaryColor: e.target.value })}
                  style={{ width: 80, fontSize: '0.8rem', padding: '4px 6px' }}
                />
                {errors?.secondaryColor && (
                  <span role="alert" style={{ marginLeft: 8, fontSize: '0.75rem', color: '#ef4444' }}>
                    {errors.secondaryColor}
                  </span>
                )}
              </label>
            </div>

            {/* Presets Titulares */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {PRESET_COLOR_PAIRS.map((pair) => (
                <button
                  key={pair.label}
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onChange({ ...value, primaryColor: pair.primary, secondaryColor: pair.secondary });
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  aria-pressed={value.primaryColor === pair.primary && value.secondaryColor === pair.secondary}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: pair.primary,
                      border: '1px solid #ffffff44',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: pair.secondary,
                      border: '1px solid #ffffff44',
                      display: 'inline-block',
                    }}
                  />
                  <span>{pair.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            ABA 2: UNIFORME RESERVA (AWAY)
           ------------------------------------------------------------- */}
        {activeKitTab === 'AWAY' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                  Configurando Uniforme Reserva (Away):
                </span>
                <span className="muted" style={{ fontSize: '0.78rem' }}>
                  ({KIT_PATTERNS.find((p) => p.key === awayPattern)?.label})
                </span>
              </div>

              {/* Ações Rápidas de Configuração do Reserva */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onChange({
                      ...value,
                      awayPrimaryColor: value.secondaryColor || '#ffffff',
                      awaySecondaryColor: value.primaryColor,
                    });
                  }}
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  Inverter cores do Titular
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onChange({
                      ...value,
                      awayPrimaryColor: '#f8fafc',
                      awaySecondaryColor: value.primaryColor,
                      awayKitPattern: 'SOLID',
                    });
                  }}
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  Branco Clássico
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {KIT_PATTERNS.map((pattern) => (
                <button
                  key={pattern.key}
                  type="button"
                  className={awayPattern === pattern.key ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => onChange({ ...value, awayKitPattern: pattern.key })}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  aria-pressed={awayPattern === pattern.key}
                >
                  {pattern.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <span>Cor Principal Reserva:</span>
                <input
                  type="color"
                  value={awayPrimary}
                  onChange={(e) => onChange({ ...value, awayPrimaryColor: e.target.value })}
                  style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                />
                <input
                  type="text"
                  value={awayPrimary}
                  onChange={(e) => onChange({ ...value, awayPrimaryColor: e.target.value })}
                  style={{ width: 80, fontSize: '0.8rem', padding: '4px 6px' }}
                />
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <span>Cor Secundária Reserva:</span>
                <input
                  type="color"
                  value={awaySecondary}
                  onChange={(e) => onChange({ ...value, awaySecondaryColor: e.target.value })}
                  style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                />
                <input
                  type="text"
                  value={awaySecondary}
                  onChange={(e) => onChange({ ...value, awaySecondaryColor: e.target.value })}
                  style={{ width: 80, fontSize: '0.8rem', padding: '4px 6px' }}
                />
              </label>
            </div>

            {/* Presets Específicos para Reserva */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {AWAY_PRESET_PAIRS.map((pair) => (
                <button
                  key={pair.label}
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onChange({ ...value, awayPrimaryColor: pair.primary, awaySecondaryColor: pair.secondary });
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  aria-pressed={awayPrimary === pair.primary && awaySecondary === pair.secondary}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: pair.primary,
                      border: '1px solid #ffffff44',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: pair.secondary,
                      border: '1px solid #ffffff44',
                      display: 'inline-block',
                    }}
                  />
                  <span>{pair.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {/* Marca Esportiva e Patrocinadores (Seção 8) */}
      <fieldset>
        <legend className="muted" style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Marca Esportiva & Patrocinadores (Ambos os Uniformes)
        </legend>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 8 }}>
          {/* Marca Esportiva */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
              Marca Esportiva (Material):
            </label>
            <select
              value={value.supplierName || 'Titan Sport'}
              onChange={(e) => onChange({ ...value, supplierName: e.target.value })}
              style={{ width: '100%', fontSize: '0.85rem', padding: '6px 8px' }}
            >
              {POPULAR_KIT_SUPPLIERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Patrocinador Master */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4 }}>
              Patrocinador Master (Peito):
            </label>
            <select
              value={value.masterSponsorName || ''}
              onChange={(e) => onChange({ ...value, masterSponsorName: e.target.value || null })}
              style={{ width: '100%', fontSize: '0.85rem', padding: '6px 8px' }}
            >
              <option value="">(Sem Patrocínio Inicial)</option>
              {POPULAR_MASTER_SPONSORS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Patrocinador Opcional */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={Boolean(value.showOptionalSponsor)}
                onChange={(e) => onChange({ ...value, showOptionalSponsor: e.target.checked })}
              />
              <span>Ativar Patrocinador Opcional (Barra Frontal)</span>
            </label>
            {value.showOptionalSponsor && (
              <select
                value={value.optionalSponsorName || POPULAR_OPTIONAL_SPONSORS[0]}
                onChange={(e) => onChange({ ...value, optionalSponsorName: e.target.value })}
                style={{ width: '100%', fontSize: '0.85rem', padding: '6px 8px', marginTop: 4 }}
              >
                {POPULAR_OPTIONAL_SPONSORS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </fieldset>

      {/* Crest Selection & AI Prompt */}
      <fieldset>
        <legend className="muted" style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Escudo
        </legend>
        <p className="muted" style={{ margin: '6px 0', fontSize: '0.82rem' }}>
          Sem enviar nada, o clube já ganha um escudo estilizado com as cores do time. Se quiser o seu:
        </p>
        <ul className="muted" style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: '0.8rem' }}>
          {CREST_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Detalhes das cores (ex: vermelho e preto)"
            value={`${value.primaryColor} ${value.secondaryColor}`}
            onChange={(e) => {
              const colors = e.target.value.split(' ');
              if (colors.length === 2) {
                onChange({ ...value, primaryColor: colors[0], secondaryColor: colors[1] });
              }
            }}
            style={{ minWidth: 240, flex: 1 }}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              navigator.clipboard?.writeText(prompt).then(
                () => setPromptCopied(true),
                () => setPromptCopied(false),
              );
            }}
          >
            {promptCopied ? 'Prompt copiado' : 'Copiar prompt do escudo'}
          </button>
          <label className="btn-secondary" style={{ cursor: 'pointer' }} htmlFor="crest-upload">
            {fileName ?? 'Enviar PNG'}
            <input
              id="crest-upload"
              type="file"
              accept="image/png"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
          {errors?.crest && (
            <span role="alert" style={{ marginLeft: 8, fontSize: '0.75rem', color: '#ef4444' }}>
              {errors.crest}
            </span>
          )}
        </div>

        <details style={{ marginTop: 8 }}>
          <summary className="muted" style={{ cursor: 'pointer', fontSize: '0.8rem' }}>
            Ver o prompt
          </summary>
          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5 }}>{prompt}</p>
        </details>
      </fieldset>
    </div>
  );
}
