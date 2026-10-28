import React, { useEffect } from 'react';
import { AlertTriangleIcon } from './icons/AppIcons.js';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  const accentColor = variant === 'danger' ? '#ef4444' : variant === 'warning' ? '#f59e0b' : '#38bdf8';
  const confirmBtnBg =
    variant === 'danger'
      ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
      : variant === 'warning'
      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
      : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'linear-gradient(145deg, #18161b 0%, #0d0c0e 100%)',
          border: `1.5px solid ${accentColor}55`,
          borderRadius: 16,
          padding: '24px',
          boxShadow: `0 20px 45px rgba(0, 0, 0, 0.85), 0 0 25px ${accentColor}22`,
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `${accentColor}18`,
              border: `1px solid ${accentColor}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangleIcon size={24} color={accentColor} />
          </div>
          <div>
            <h3 id="confirm-modal-title" style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#ffffff' }}>
              {title}
            </h3>
          </div>
        </div>

        <div style={{ fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.55 }}>
          {message}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              fontSize: '0.88rem',
              fontWeight: 600,
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.14)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              fontSize: '0.88rem',
              fontWeight: 700,
              borderRadius: 10,
              border: 'none',
              background: confirmBtnBg,
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: `0 4px 12px ${accentColor}40`,
              transition: 'all 0.15s ease',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
