import { useEffect, useRef, useState } from 'react';
import {
  COUNTRIES,
  DEFAULT_MANAGER_STYLE,
  GAME_MODE_INFO,
  canTakeOverDivision,
  explainBlock,
  getManagerStyleDefinition,
  mustFoundOwnClub,
  type Club,
  type CreateCareerResult,
  type FoundCareerClub,
  type GameMode,
  getStaffDelegationPreset,
} from '@tactical-arena/shared';
import {
  listAvailableClubs,
  listFoundableCountries,
  listPlayableCountries,
  type ManagerProfile,
  createNewSave,
  claimClub,
  foundClub,
  updateStaffDelegationConfig,
} from '../api/client.js';
import { ClubCrest } from './ClubCrest.js';
import { CountryFlag } from './CountryFlag.js';
import { FoundClubForm } from './FoundClubForm.js';
import { ManagerStyleQuizModal, type ManagerStyleQuizPreset } from './ManagerStyleQuizModal.js';

interface OnboardingWizardProps {
  initialManagerProfile?: ManagerProfile | null;
  /** Fires once the canonical career-creation operation returns a complete result. */
  onCompleted: (result: CreateCareerResult) => void;
  onCancel?: () => void;
  onError?: (message: string) => void;
}

function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

const DELEGATION_PROFILE_LABELS: Record<ManagerStyleQuizPreset, string> = {
  brasfoot_casual: 'Estrategista Prático',
  balanced: 'Gestor Moderno',
  football_manager_hardcore: 'Mestre Tático',
};

const DEFAULT_FOUND_DRAFT: FoundCareerClub = {
  kind: 'FOUND',
  countryCode: 'BRA',
  name: '',
  city: '',
  citySize: 'SMALL',
  kitPattern: 'SOLID',
  primaryColor: '#e11d48',
  secondaryColor: '#ffffff',
  crest: { crestBase64: null },
};

interface CompleteCareerOnboardingParams {
  saveResult: Awaited<ReturnType<typeof createNewSave>>;
  delegationPreset: ManagerStyleQuizPreset;
  createClub: () => Promise<Club>;
}

export async function completeCareerOnboarding(
  { saveResult, delegationPreset, createClub }: CompleteCareerOnboardingParams,
  persistDelegation = updateStaffDelegationConfig,
): Promise<CreateCareerResult> {
  const club = await createClub();
  const updatedClub = await persistDelegation(
    club.id,
    getStaffDelegationPreset(delegationPreset),
  );

  return {
    save: saveResult.save,
    token: saveResult.token ?? '',
    userId: saveResult.userId ?? '',
    club: updatedClub,
    reused: false,
  };
}

export function OnboardingWizard({ initialManagerProfile, onCompleted, onCancel, onError }: OnboardingWizardProps) {
  const hasInitialProfile = Boolean(
    initialManagerProfile &&
      initialManagerProfile.firstName &&
      initialManagerProfile.firstName.trim() !== ''
  );
  const [step, setStep] = useState<1 | 2 | 3>(hasInitialProfile ? 3 : 1);

  // Step 1: Manager Profile
  const [firstName, setFirstName] = useState(initialManagerProfile?.firstName || 'Técnico');
  const [lastName, setLastName] = useState(initialManagerProfile?.lastName || 'Novo');
  const [nationality, setNationality] = useState(initialManagerProfile?.nationality || 'BRA');
  const [managerStyle, setManagerStyle] = useState<string>(initialManagerProfile?.style || DEFAULT_MANAGER_STYLE);
  const [quizOpen, setQuizOpen] = useState(false);
  const [delegationPreset, setDelegationPreset] = useState<ManagerStyleQuizPreset>('brasfoot_casual');

  // Step 2: Game Mode & Path
  const [gameMode, setGameMode] = useState<GameMode>(initialManagerProfile?.gameMode || 'PREMIUM');
  const [mode, setMode] = useState<'TAKE_OVER' | 'FOUND'>('TAKE_OVER');

  // Step 3: Club Selection / Foundation
  const [foundable, setFoundable] = useState<{ code: string; accessDivision: number; size: number }[]>([]);
  const [playableCountries, setPlayableCountries] = useState<string[] | null>(null);
  const [pickCountry, setPickCountry] = useState('BRA');
  const [pickDivision, setPickDivision] = useState(1);
  const [availableClubs, setAvailableClubs] = useState<Club[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [foundDraft, setFoundDraft] = useState<FoundCareerClub>(DEFAULT_FOUND_DRAFT);
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stageHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    listFoundableCountries().then(setFoundable).catch(() => setFoundable([]));
    listPlayableCountries().then(setPlayableCountries).catch(() => setPlayableCountries(null));
  }, []);

  useEffect(() => {
    if (mustFoundOwnClub(gameMode)) {
      setMode('FOUND');
    } else {
      setMode('TAKE_OVER');
      if (gameMode === 'STANDARD') {
        setPickDivision(2);
      } else {
        setPickDivision(1);
      }
    }
  }, [gameMode]);

  const clubListRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (step === 3 && mode === 'TAKE_OVER') {
      setAvailableClubs([]);
      setAvailableLoading(true);
      if (clubListRef.current) {
        clubListRef.current.scrollTop = 0;
      }
      refreshAvailableClubs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode, pickCountry, pickDivision]);

  async function refreshAvailableClubs() {
    setAvailableLoading(true);
    try {
      const list = await listAvailableClubs(pickCountry, pickDivision);
      setAvailableClubs(list);
    } catch (err) {
      onError?.((err as Error).message);
    } finally {
      setAvailableLoading(false);
    }
  }

  function focusFirstInvalidField() {
    requestAnimationFrame(() => {
      stageRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  function handleStep1Next(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      focusFirstInvalidField();
      return;
    }
    setStep(2);
  }

  function handleStep2Next() {
    setStep(3);
  }

  async function handleClaimClub(clubId: string) {
    try {
      const effectiveMode: GameMode = (pickDivision === 1 && gameMode === 'STANDARD') ? 'PREMIUM' : gameMode;
      const saveRes = await createNewSave({
        managerFirstName: firstName.trim(),
        managerLastName: lastName.trim(),
        managerNationality: nationality,
        managerStyle: managerStyle,
        gameMode: effectiveMode,
        clockFormat: 'HALF_45',
      });
      if (saveRes.token) localStorage.setItem('token', saveRes.token);
      if (saveRes.userId) localStorage.setItem('userId', saveRes.userId);
      onCompleted(
        await completeCareerOnboarding({
          saveResult: saveRes,
          delegationPreset,
          createClub: () => claimClub(clubId, effectiveMode),
        }),
      );
    } catch (err) {
      onError?.((err as Error).message);
    }
  }

  async function handleFoundSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!foundDraft.name.trim()) {
      focusFirstInvalidField();
      return;
    }
    try {
      const saveRes = await createNewSave({
        managerFirstName: firstName.trim(),
        managerLastName: lastName.trim(),
        managerNationality: nationality,
        managerStyle: managerStyle,
        gameMode,
        clockFormat: 'HALF_45',
      });
      if (saveRes.token) localStorage.setItem('token', saveRes.token);
      if (saveRes.userId) localStorage.setItem('userId', saveRes.userId);
      onCompleted(
        await completeCareerOnboarding({
          saveResult: saveRes,
          delegationPreset,
          createClub: () =>
            foundClub({
              name: foundDraft.name.trim(),
              country: foundDraft.countryCode,
              city: foundDraft.city.trim() || undefined,
              citySize: foundDraft.citySize,
              kitPattern: foundDraft.kitPattern,
              primaryColor: foundDraft.primaryColor,
              secondaryColor: foundDraft.secondaryColor,
              crestBase64: foundDraft.crest.crestBase64 ?? undefined,
            }),
        }),
      );
    } catch (err) {
      onError?.((err as Error).message);
    }
  }

  return (
    <div ref={stageRef} className="onboarding-wizard-container career-journey">
      {/* STEPPER HEADER */}
      <div
        className="wizard-stepper-bar"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--card, #18161a)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          padding: '12px 20px',
          marginBottom: 16,
          width: '100%',
        }}
      >
        <button
          type="button"
          className={`wizard-step-item ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}
          onClick={() => step > 1 && setStep(1)}
          disabled={step <= 1}
          style={{
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: step === 1 ? 'var(--accent, #d4af37)' : 'inherit',
            opacity: step === 1 ? 1 : step > 1 ? 0.9 : 0.5,
            cursor: step > 1 ? 'pointer' : 'default',
            boxShadow: 'none',
          }}
        >
          <span
            className="step-num"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: step === 1 ? 'var(--accent, #d4af37)' : step > 1 ? '#16a34a' : '#1e293b',
              border: `1.5px solid ${step === 1 ? 'var(--accent, #d4af37)' : step > 1 ? '#16a34a' : 'var(--muted, #9a9488)'}`,
              color: step === 1 ? '#1a1400' : '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            1
          </span>
          <span className="step-label" style={{ fontWeight: 600, fontSize: '0.92rem' }}>O Técnico</span>
        </button>

        <div className="step-connector" style={{ flex: 1, height: 2, background: 'rgba(255, 255, 255, 0.1)', margin: '0 12px' }} />

        <button
          type="button"
          className={`wizard-step-item ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}
          onClick={() => step > 2 && setStep(2)}
          disabled={step <= 2}
          style={{
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: step === 2 ? 'var(--accent, #d4af37)' : 'inherit',
            opacity: step === 2 ? 1 : step > 2 ? 0.9 : 0.5,
            cursor: step > 2 ? 'pointer' : 'default',
            boxShadow: 'none',
          }}
        >
          <span
            className="step-num"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: step === 2 ? 'var(--accent, #d4af37)' : step > 2 ? '#16a34a' : '#1e293b',
              border: `1.5px solid ${step === 2 ? 'var(--accent, #d4af37)' : step > 2 ? '#16a34a' : 'var(--muted, #9a9488)'}`,
              color: step === 2 ? '#1a1400' : '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            2
          </span>
          <span className="step-label" style={{ fontWeight: 600, fontSize: '0.92rem' }}>O Desafio</span>
        </button>

        <div className="step-connector" style={{ flex: 1, height: 2, background: 'rgba(255, 255, 255, 0.1)', margin: '0 12px' }} />

        <button
          type="button"
          className={`wizard-step-item ${step === 3 ? 'active' : ''}`}
          disabled
          style={{
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: step === 3 ? 'var(--accent, #d4af37)' : 'inherit',
            opacity: step === 3 ? 1 : 0.5,
            cursor: 'default',
            boxShadow: 'none',
          }}
        >
          <span
            className="step-num"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: step === 3 ? 'var(--accent, #d4af37)' : '#1e293b',
              border: `1.5px solid ${step === 3 ? 'var(--accent, #d4af37)' : 'var(--muted, #9a9488)'}`,
              color: step === 3 ? '#1a1400' : '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            3
          </span>
          <span className="step-label" style={{ fontWeight: 600, fontSize: '0.92rem' }}>O Clube</span>
        </button>

        {onCancel && (
          <div style={{ marginLeft: 'auto', paddingLeft: 24, borderLeft: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              style={{
                fontSize: '0.82rem',
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#94a3b8',
                background: 'rgba(255, 255, 255, 0.04)',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* STEP 1: MANAGER PROFILE */}
      {step === 1 && (
        <form onSubmit={handleStep1Next} className="card wizard-step-card career-stage">
          <h2 ref={stageHeadingRef} tabIndex={-1}>Passo 1 de 3: Perfil do Treinador</h2>
          <p className="muted">Defina quem é você na beira do gramado.</p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="firstName">Nome</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex: Bernardo"
                required
                aria-invalid={!firstName.trim()}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="lastName">Sobrenome</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ex: Silva"
                required
                aria-invalid={!lastName.trim()}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ minWidth: 180 }}>
              <label htmlFor="nationalitySelect">Nacionalidade</label>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <CountryFlag code={nationality} size={22} title={countryName(nationality)} aria-hidden="true" />
                <select
                  id="nationalitySelect"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  style={{ width: '100%' }}
                  aria-label={countryName(nationality)}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* QUIZ CALLOUT */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.08) 0%, rgba(212, 175, 55, 0.03) 100%)',
              border: '1px solid rgba(255, 215, 0, 0.25)',
              borderRadius: 12,
              padding: '14px 18px',
              marginTop: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <strong style={{ display: 'block', fontSize: '0.95rem', color: '#ffd700' }}>
                Estilo de Jogo & Delegação da Diretoria
              </strong>
              <span className="muted" style={{ fontSize: '0.82rem' }}>
                Perfil de comando: <strong>{DELEGATION_PROFILE_LABELS[delegationPreset]}</strong>
              </span>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setQuizOpen(true)}
              style={{
                fontSize: '0.85rem',
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #ffd700, #d4af37)',
                color: '#1a1400',
              }}
            >
              Descobrir meu estilo (Quiz da Diretoria)
            </button>
          </div>

          <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary">
              Avançar para o Desafio
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: GAME MODE & CHALLENGE */}
      {step === 2 && (
        <div className="card wizard-step-card career-stage">
          <h2 ref={stageHeadingRef} tabIndex={-1}>Passo 2 de 3: Escolha do Desafio</h2>
          <p className="muted">Qual o nível de desafio e a proposta desta carreira?</p>

          {/* Game Mode Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
            {(['STANDARD', 'HARDCORE', 'PREMIUM'] as GameMode[]).map((mKey) => {
              const info = GAME_MODE_INFO[mKey];
              if (!info) return null;
              const isSelected = gameMode === mKey;
              return (
                <div
                  key={mKey}
                  onClick={() => {
                    setGameMode(mKey);
                    if (mKey === 'HARDCORE') {
                      setMode('FOUND');
                    } else {
                      setMode('TAKE_OVER');
                      setPickDivision(mKey === 'STANDARD' ? 2 : 1);
                    }
                  }}
                  style={{
                    border: isSelected ? '2px solid var(--accent, #d4af37)' : '1px solid rgba(255,255,255,0.1)',
                    background: isSelected ? 'rgba(212, 175, 55, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ marginBottom: 6, color: isSelected ? '#ffd700' : '#94a3b8' }}>
                    {mKey === 'STANDARD' && (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polygon points="12 8 8 11 9.5 15.5 14.5 15.5 16 11"></polygon>
                      </svg>
                    )}
                    {mKey === 'HARDCORE' && (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        <path d="M9 12h6"></path>
                        <path d="M12 9v6"></path>
                      </svg>
                    )}
                    {mKey === 'PREMIUM' && (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"></path>
                      </svg>
                    )}
                  </div>
                  <strong style={{ display: 'block', fontSize: '1rem', color: isSelected ? 'var(--accent, #ffd700)' : 'inherit' }}>{info.label}</strong>
                  <p className="muted" style={{ fontSize: '0.8rem', margin: '4px 0 0', lineHeight: 1.35 }}>
                    {info.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Path Info Banner */}
          <div
            style={{
              marginTop: 16,
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '12px 16px',
            }}
          >
            {gameMode === 'HARDCORE' ? (
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#ffd700', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span><strong>Modo Iron Man:</strong> Você funda o seu próprio clube do zero a partir da divisão de acesso e o leva até a elite.</span>
              </p>
            ) : gameMode === 'PREMIUM' ? (
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"></path>
                </svg>
                <span><strong>Modo Premium:</strong> Você escolhe e assume qualquer clube existente do mundo (1ª ou 2ª divisão liberadas).</span>
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="12 8 8 11 9.5 15.5 14.5 15.5 16 11"></polygon>
                </svg>
                <span><strong>Modo Standard:</strong> Você assume um clube existente a partir da 2ª divisão e conquista o acesso em campo.</span>
              </p>
            )}
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              ← Voltar ao Treinador
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleStep2Next}
              style={{
                padding: '10px 22px',
                fontSize: '0.95rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #ffd700, #d4af37)',
                color: '#1a1400',
                border: 'none',
                borderRadius: 8,
                boxShadow: '0 4px 14px rgba(212, 175, 55, 0.3)',
                cursor: 'pointer',
              }}
            >
              Avançar para o Clube
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CLUB SELECTION / FOUNDATION */}
      {step === 3 && (
        <div className="card wizard-step-card career-stage">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 ref={stageHeadingRef} tabIndex={-1}>Passo 3 de 3: {mode === 'TAKE_OVER' ? 'Escolher um Clube' : 'Identidade do Clube'}</h2>
            <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
              ← Voltar ao Desafio
            </button>
          </div>

          {/* Resumo do Treinador e Modo */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: '0.88rem' }}>
              <CountryFlag code={nationality} size={18} title={countryName(nationality)} aria-hidden="true" />
              <span>
                <strong>{firstName} {lastName}</strong>
              </span>
              <span className="muted">•</span>
              <span>
                {getManagerStyleDefinition(managerStyle).label}
              </span>
              <span className="muted">•</span>
              <span style={{ background: 'rgba(255,215,0,0.15)', color: '#ffd700', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                Perfil de comando: {DELEGATION_PROFILE_LABELS[delegationPreset]}
              </span>
              <span className="muted">•</span>
              <span className="muted">
                {GAME_MODE_INFO[gameMode]?.label ?? gameMode}
              </span>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep(1)}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              Alterar Treinador
            </button>
          </div>

          {mode === 'TAKE_OVER' && !mustFoundOwnClub(gameMode) && (
            <div style={{ paddingBottom: 28 }}>
              <p className="muted" style={{ margin: '0 0 14px' }}>
                Selecione o país e a divisão para encontrar os clubes disponíveis sem técnico.
              </p>
              {!canTakeOverDivision(gameMode, pickDivision) && (
                <p className="contratos-alerta" style={{ color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '6px 12px', borderRadius: 6, margin: '0 0 14px' }}>
                  ℹ️ Ao assumir um clube de 1ª Divisão, sua carreira iniciará no modo Premium (acesso liberado a todas as divisões).
                </p>
              )}

              <div className="inline-form" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <CountryFlag code={pickCountry} size={22} title={countryName(pickCountry)} aria-hidden="true" />
                  <select value={pickCountry} onChange={(e) => setPickCountry(e.target.value)}>
                    {COUNTRIES.filter((c) => !playableCountries || playableCountries.includes(c.code)).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <select value={pickDivision} onChange={(e) => setPickDivision(Number(e.target.value))}>
                  {[1, 2, 3].map((d) => (
                    <option key={d} value={d}>
                      Divisão {d}
                    </option>
                  ))}
                </select>
              </div>

              {availableLoading && <p className="muted">Carregando clubes...</p>}
              {!availableLoading && availableClubs.length === 0 && <p className="muted">Nenhum clube disponível nesta divisão.</p>}

              <ul className="club-list" ref={clubListRef}>
                {availableClubs.map((club) => (
                  <li key={club.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                    <span className="crest-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <ClubCrest club={club} size={28} />
                      <strong>{club.name}</strong>
                      <span className="muted" style={{ fontSize: '0.82rem' }}>
                        • {club.players.length} jogadores
                      </span>
                    </span>
                    <button type="button" className="btn-primary" onClick={() => handleClaimClub(club.id)}>
                      Assumir este clube
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mode === 'FOUND' && (
            <form onSubmit={handleFoundSubmit} style={{ paddingBottom: 28 }}>
              <p className="muted" style={{ margin: '0 0 14px' }}>
                Personalize o nome, uniforme e escudo do seu novo clube para começar sua trajetória.
              </p>
              <FoundClubForm value={foundDraft} foundable={foundable} onChange={setFoundDraft} />
              <div style={{ marginTop: 24, marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" disabled={!foundDraft.name.trim()} style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 700 }}>
                  Fundar clube e iniciar carreira
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <ManagerStyleQuizModal
        isOpen={quizOpen}
        onClose={() => setQuizOpen(false)}
        onApplyProfile={(preset) => {
          setDelegationPreset(preset);
          if (preset === 'brasfoot_casual') {
            setManagerStyle('MOTIVATOR');
          } else if (preset === 'football_manager_hardcore') {
            setManagerStyle('TACTICIAN');
          } else {
            setManagerStyle('ORGANIZER');
          }
        }}
      />
    </div>
  );
}
