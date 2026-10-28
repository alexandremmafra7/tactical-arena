import React, { useState } from 'react';
import type { Club, StaffDelegationConfig } from '@tactical-arena/shared';
import { getStaffDelegationPreset } from '@tactical-arena/shared';
import { updateStaffDelegationConfig } from '../api/client.js';
import { LightningIcon, StaffIcon, TacticsIcon, CheckIcon } from './icons/AppIcons.js';

export interface AutomationProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  club: Club;
  onProfileChanged?: (updatedClub: Club) => void;
}

type ProfileMode = 'brasfoot_casual' | 'balanced' | 'football_manager_hardcore';

interface ProfileOption {
  id: ProfileMode;
  name: string;
  tagline: string;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  features: string[];
}

const PROFILES: ProfileOption[] = [
  {
    id: 'brasfoot_casual',
    name: 'Modo Arcade / Dinâmico',
    tagline: 'Agilidade Máxima (90% Automatizado)',
    accentColor: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(16, 185, 129, 0.4)',
    features: [
      'Auxiliar escala o melhor 11 a cada rodada sem exigir abrir menus',
      'Substituições automáticas de lesionados durante a partida',
      'Diretor renova contratos de rotina sem você precisar micromanagear',
      'Treinos e descanso preventivo conduzidos pela preparação física',
      'Você foca no essencial: contratar craques e vencer jogos',
    ],
  },
  {
    id: 'balanced',
    name: 'Modo Gestor / Híbrido',
    tagline: 'Equilíbrio Ideal (Padrão)',
    accentColor: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: 'rgba(56, 189, 248, 0.4)',
    features: [
      'Você escala os 11 titulares e define a formação na prancheta',
      'Diretor alerta sobre craques em risco e cuida da burocracia',
      'Treino semanal conduzido pela comissão técnica',
      'Botão mágico de 1-clique disponível no Dia de Jogo quando quiser agilidade',
    ],
  },
  {
    id: 'football_manager_hardcore',
    name: 'Modo Estrategista / Avançado',
    tagline: 'Controle Manual Cirúrgico',
    accentColor: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeBorder: 'rgba(245, 158, 11, 0.4)',
    features: [
      'Escalação e ajustes táticos estritamente manuais',
      'Contratos, multas e dispensas decididos atleta por atleta',
      'Treinos específicos individuais e categorias de base manuais',
      'Preleções e coletivas de imprensa conduzidas por você',
    ],
  },
];

export function AutomationProfileModal({
  isOpen,
  onClose,
  club,
  onProfileChanged,
}: AutomationProfileModalProps) {
  const [busy, setBusy] = useState(false);
  const currentMode = club.staffDelegationConfig?.presetMode ?? 'brasfoot_casual';

  if (!isOpen) return null;

  async function handleSelect(mode: ProfileMode) {
    if (busy || mode === currentMode) return;
    setBusy(true);
    try {
      const preset = getStaffDelegationPreset(mode);
      const updated = await updateStaffDelegationConfig(club.id, preset);
      if (onProfileChanged) {
        onProfileChanged(updated);
      }
      onClose();
    } catch (err) {
      alert(`Erro ao alterar modo: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          background: 'linear-gradient(145deg, #181528 0%, #0d0b16 100%)',
          border: '1.5px solid rgba(168, 85, 247, 0.4)',
          borderRadius: 16,
          maxWidth: 820,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LightningIcon size={24} fill="#38bdf8" color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>
                Perfil de Automação & Controle
              </h3>
              <p className="muted" style={{ margin: '3px 0 0', fontSize: '0.82rem' }}>
                Escolha o quanto a comissão técnica resolve por você. Alterne a qualquer momento com 1 clique!
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '6px 12px', fontSize: '0.9rem' }}
          >
            ✕
          </button>
        </div>

        {/* Profiles Grid */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {PROFILES.map((p) => {
            const isActive = currentMode === p.id;
            return (
              <div
                key={p.id}
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isActive
                    ? `2px solid ${p.accentColor}`
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                  boxShadow: isActive ? `0 0 20px ${p.accentColor}25` : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{p.name}</h4>
                    {isActive && (
                      <span
                        style={{
                          background: p.badgeBg,
                          color: p.accentColor,
                          border: `1px solid ${p.badgeBorder}`,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 12,
                          textTransform: 'uppercase',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <CheckIcon size={11} color={p.accentColor} />
                        Ativo
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.75rem',
                      color: p.accentColor,
                      fontWeight: 700,
                      marginBottom: 12,
                    }}
                  >
                    {p.tagline}
                  </span>

                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: '0.78rem',
                      color: 'var(--muted)',
                      lineHeight: '1.45',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    {p.features.map((feat, i) => (
                      <li key={i}>{feat}</li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  className={isActive ? 'btn-secondary' : 'btn-primary'}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    background: isActive ? 'transparent' : undefined,
                    borderColor: isActive ? p.accentColor : undefined,
                    color: isActive ? p.accentColor : undefined,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  disabled={busy || isActive}
                  onClick={() => handleSelect(p.id)}
                >
                  {isActive ? (
                    <>
                      <CheckIcon size={14} color={p.accentColor} />
                      <span>Modo Selecionado</span>
                    </>
                  ) : (
                    <span>Ativar {p.name.split('/')[0].trim()}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
