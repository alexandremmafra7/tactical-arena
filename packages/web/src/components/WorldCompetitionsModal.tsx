import React, { useState } from 'react';
import {
  WORLD_LEAGUE_COUNTRIES,
  getNationalCupsForCountry,
  getSuperCupForCountry,
  type WorldLeagueCountryConfig,
  type ContinentalSlot,
} from '@tactical-arena/shared';

interface WorldCompetitionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const slotBadge = (slot: ContinentalSlot) => {
  switch (slot) {
    case 'CHAMPIONS_LEAGUE':
      return { text: 'UEFA Champions League', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.18)' };
    case 'LIBERTADORES':
      return { text: 'CONMEBOL Libertadores', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.18)' };
    case 'EUROPA_LEAGUE':
      return { text: 'UEFA Europa League', color: '#fb923c', bg: 'rgba(249, 115, 22, 0.18)' };
    case 'CONFERENCE_LEAGUE':
      return { text: 'UEFA Conference League', color: '#34d399', bg: 'rgba(16, 185, 129, 0.18)' };
    case 'SUDAMERICANA':
      return { text: 'CONMEBOL Sul-Americana', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.18)' };
    case 'AFC_CHAMPIONS_LEAGUE':
      return { text: 'AFC Champions League', color: '#facc15', bg: 'rgba(234, 179, 8, 0.18)' };
    default:
      return { text: slot, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.18)' };
  }
};

export const WorldCompetitionsModal: React.FC<WorldCompetitionsModalProps> = ({ isOpen, onClose }) => {
  const [selectedConfed, setSelectedConfed] = useState<string>('ALL');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('BRA');

  if (!isOpen) return null;

  const filteredCountries = WORLD_LEAGUE_COUNTRIES.filter((country) => {
    if (selectedConfed === 'ALL') return true;
    return country.confederation === selectedConfed;
  });

  const activeCountry = WORLD_LEAGUE_COUNTRIES.find((c) => c.code === selectedCountryCode) || filteredCountries[0] || WORLD_LEAGUE_COUNTRIES[0];
  const countryCups = getNationalCupsForCountry(activeCountry.code);
  const countrySuperCup = getSuperCupForCountry(activeCountry.code);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(5, 5, 10, 0.88)',
        backdropFilter: 'blur(8px)',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="world-competitions-title"
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          color: '#f8fafc',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(15, 23, 42, 0.95)',
          }}
        >
          <div>
            <h2
              id="world-competitions-title"
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 800,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Ligas & Copas Nacionais do Mundo
              <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>Passo 11</span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Estrutura de divisões oficiais, copas eliminatórias e distribuição de vagas continentais
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#e2e8f0',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            aria-label="Fechar modal"
          >
            ✕ Fechar
          </button>
        </div>

        {/* Filter bar: Confederations */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 23, 42, 0.75)',
            fontSize: '0.78rem',
            overflowX: 'auto',
          }}
        >
          <span style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4 }}>
            Confederação:
          </span>
          {(['ALL', 'UEFA', 'CONMEBOL', 'AFC'] as const).map((confed) => (
            <button
              key={confed}
              onClick={() => {
                setSelectedConfed(confed);
                const matching = confed === 'ALL' ? WORLD_LEAGUE_COUNTRIES : WORLD_LEAGUE_COUNTRIES.filter((c) => c.confederation === confed);
                if (matching.length > 0 && !matching.some((m) => m.code === selectedCountryCode)) {
                  setSelectedCountryCode(matching[0].code);
                }
              }}
              style={{
                padding: '4px 12px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '0.75rem',
                border: selectedConfed === confed ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                background: selectedConfed === confed ? '#f59e0b' : 'rgba(255, 255, 255, 0.06)',
                color: selectedConfed === confed ? '#0f172a' : '#cbd5e1',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {confed === 'ALL' ? 'Todas as Nações' : confed === 'UEFA' ? 'UEFA (Europa)' : confed === 'CONMEBOL' ? 'CONMEBOL (América do Sul)' : 'AFC (Ásia)'}
            </button>
          ))}
        </div>

        {/* Main Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Countries Selector Carousel/Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {filteredCountries.map((c: WorldLeagueCountryConfig) => (
              <button
                key={c.code}
                onClick={() => setSelectedCountryCode(c.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  border: activeCountry.code === c.code ? '1.5px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.12)',
                  background: activeCountry.code === c.code ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeCountry.code === c.code ? '#fbbf24' : '#e2e8f0',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                <img
                  src={`/flags/${c.code}.svg`}
                  alt=""
                  style={{ width: 20, height: 14, objectFit: 'cover', borderRadius: 2, display: 'inline-block' }}
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          {/* Active Country Banner */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={`/flags/${activeCountry.code}.svg`}
                alt={activeCountry.name}
                style={{ width: 44, height: 30, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(255, 255, 255, 0.25)', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
              />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{activeCountry.name}</span>
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.1)', color: '#cbd5e1' }}>
                    {activeCountry.confederation}
                  </span>
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                  {activeCountry.divisions.length} divisões oficiais catalogadas • {countryCups.length} copa(s) nacional(is)
                </p>
              </div>
            </div>

            {/* Official Trophies Showcase for this country */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0, 0, 0, 0.4)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Taças Oficiais</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24' }}>Liga & Copas</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeCountry.divisions[0]?.trophyAsset && (
                  <img
                    src={`/trophies/${activeCountry.divisions[0].trophyAsset}`}
                    alt="Taça da Liga"
                    title={`Taça oficial: ${activeCountry.divisions[0].name}`}
                    style={{ width: 28, height: 28, objectFit: 'contain' }}
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                )}
                {countryCups[0]?.trophyAsset && (
                  <img
                    src={`/trophies/${countryCups[0].trophyAsset}`}
                    alt="Taça da Copa"
                    title={`Taça oficial: ${countryCups[0].name}`}
                    style={{ width: 28, height: 28, objectFit: 'contain' }}
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                )}
                {countrySuperCup?.trophyAsset && (
                  <img
                    src={`/trophies/${countrySuperCup.trophyAsset}`}
                    alt="Supercopa"
                    title={`Taça oficial: ${countrySuperCup.name}`}
                    style={{ width: 28, height: 28, objectFit: 'contain' }}
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Grid: Divisions & Cups */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
            {/* Left: Divisions Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Divisões Nacionais da Liga ({activeCountry.divisions.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeCountry.divisions.map((div) => (
                  <div
                    key={div.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'rgba(30, 41, 59, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img
                        src={`/trophies/${div.trophyAsset}`}
                        alt={div.name}
                        style={{ width: 24, height: 24, objectFit: 'contain' }}
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>{div.name}</span>
                        <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.1)', color: '#cbd5e1', fontWeight: 700 }}>
                          {div.division}ª Divisão
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                        Formato: Turno e Returno com tabela de pontos corridos
                      </p>

                      {/* Continental Slots */}
                      {div.qualifyingSlots.length > 0 && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: '#94a3b8', width: '100%' }}>Vagas Continentais:</span>
                          {div.qualifyingSlots.map((slot, idx) => {
                            const badge = slotBadge(slot);
                            return (
                              <span
                                key={`${div.id}-${slot}-${idx}`}
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.color}40`,
                                }}
                              >
                                {idx + 1}º Lugar ➔ {badge.text}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: National Cups Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Copas Nacionais & Supercopa ({countryCups.length + (countrySuperCup ? 1 : 0)})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {countryCups.map((cup) => {
                  const rewardBadge = slotBadge(cup.continentalReward);
                  return (
                    <div
                      key={cup.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <img
                          src={`/trophies/${cup.trophyAsset}`}
                          alt={cup.name}
                          style={{ width: 24, height: 24, objectFit: 'contain' }}
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>{cup.name}</span>
                          <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontWeight: 700 }}>
                            Mata-Mata
                          </span>
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                          Formato: {cup.format === 'MIXED_COPA_DO_BRASIL' ? 'Preliminares + Ida e Volta (32 Clubes)' : 'Eliminatória direta até a Final'}
                        </p>
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: '#94a3b8' }}>Prêmio:</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: rewardBadge.bg, color: rewardBadge.color, border: `1px solid ${rewardBadge.color}40` }}>
                            Campeão ➔ {rewardBadge.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {countrySuperCup && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'rgba(30, 41, 59, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img
                        src={`/trophies/${countrySuperCup.trophyAsset}`}
                        alt={countrySuperCup.name}
                        style={{ width: 24, height: 24, objectFit: 'contain' }}
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>{countrySuperCup.name}</span>
                        <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', fontWeight: 700 }}>
                          Supercopa
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                        Decisão em jogo único: Campeão da Liga Nacional vs Campeão da Copa Nacional
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(15, 23, 42, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: '#94a3b8',
          }}
        >
          <span>Tactical Arena FC • Sistema Global de Ligas & Copas</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 18px',
              borderRadius: '9999px',
              background: '#f59e0b',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: '0.82rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
