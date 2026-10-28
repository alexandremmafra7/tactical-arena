import { useState, useEffect } from 'react';
import { hasPrivacyConsent, savePrivacyConsent } from '../lib/privacyService.js';
import { ShieldIcon } from './icons/AppIcons.js';

interface PrivacyConsentBannerProps {
  onOpenPolicy: () => void;
}

export function PrivacyConsentBanner({ onOpenPolicy }: PrivacyConsentBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasPrivacyConsent()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    savePrivacyConsent();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Aviso de Privacidade LGPD"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 640,
        margin: '0 auto',
        backgroundColor: '#18141d',
        border: '1px solid rgba(212,175,55,0.45)',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
        zIndex: 9998,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        color: '#e2e8f0',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ flex: '1 1 320px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <strong style={{ color: '#ffd700', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ShieldIcon size={16} color="#ffd700" /> Privacidade no Tactical Arena FC
          </strong>
          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontWeight: 700 }}>
            LGPD
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.45 }}>
          Seus dados de carreira e clubes são armazenados de forma 100% local. O jogo só transmite informações técnicas quando você se conecta a um servidor.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <button
          type="button"
          onClick={onOpenPolicy}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#cbd5e1',
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: '0.78rem',
            cursor: 'pointer',
          }}
        >
          Opções
        </button>
        <button
          type="button"
          onClick={handleAccept}
          style={{
            background: '#ffd700',
            border: 'none',
            color: '#0d0a10',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(255,215,0,0.25)',
          }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
