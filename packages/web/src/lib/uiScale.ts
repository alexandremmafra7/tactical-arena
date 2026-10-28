export type UiScaleOption = 'auto' | '75' | '85' | '100' | '115';

const LOCAL_STORAGE_KEY = 'tactical_ui_scale';

type ScaleChangeListener = (scale: UiScaleOption, factor: number) => void;
const listeners = new Set<ScaleChangeListener>();

let currentOption: UiScaleOption = 'auto';
let currentFactor = 1.0;
let isInitialized = false;

export function calculateAutoScale(): number {
  if (typeof window === 'undefined') return 1.0;
  const h = window.innerHeight;
  const w = window.innerWidth;

  // Telas muito pequenas (ex: 720p ou notebooks antigos)
  if (h <= 720 || w <= 1280) {
    return 0.75;
  }
  // Telas comuns de notebooks (1366x768 ou 1080p com escala de 125%/150% do Windows)
  if (h <= 780 || w <= 1380) {
    return 0.82;
  }
  // Telas HD+ intermediárias (1600x900)
  if (h <= 900 || w <= 1600) {
    return 0.90;
  }
  // Telas ligeiramente menores que Full HD
  if (h < 1000) {
    return 0.95;
  }
  // Full HD nativo (1920x1080) ou superior
  return 1.0;
}

export function getNumericFactor(option: UiScaleOption): number {
  switch (option) {
    case '75':
      return 0.75;
    case '85':
      return 0.85;
    case '100':
      return 1.0;
    case '115':
      return 1.15;
    case 'auto':
    default:
      return calculateAutoScale();
  }
}

export function applyUiScale(option: UiScaleOption): number {
  currentOption = option;
  const factor = getNumericFactor(option);
  currentFactor = factor;

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, option);
    } catch {}
  }

  // 1. Electron webFrame native zoom (mantém vetores e nitidez perfeita)
  if (typeof window !== 'undefined' && window.electronAPI?.setZoomFactor) {
    try {
      window.electronAPI.setZoomFactor(factor);
    } catch {}
  }

  // 2. CSS zoom fallback (para navegador ou renderizadores Chromium)
  if (typeof document !== 'undefined' && document.documentElement) {
    try {
      (document.documentElement.style as any).zoom = String(factor);
    } catch {}
  }

  // Notificar componentes
  listeners.forEach((listener) => {
    try {
      listener(currentOption, currentFactor);
    } catch {}
  });

  return factor;
}

export function getSavedUiScale(): UiScaleOption {
  if (typeof localStorage === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved === 'auto' || saved === '75' || saved === '85' || saved === '100' || saved === '115') {
      return saved as UiScaleOption;
    }
  } catch {}
  return 'auto';
}

export function getCurrentUiScale(): { option: UiScaleOption; factor: number } {
  return { option: currentOption, factor: currentFactor };
}

export function onUiScaleChange(listener: ScaleChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Inicializa o auto-scaling global e registra atalhos de zoom do teclado */
export function initUiScale(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  const saved = getSavedUiScale();
  applyUiScale(saved);

  // Recalcular quando redimensionar ou alternar tela cheia se estiver em 'auto'
  window.addEventListener('resize', () => {
    if (currentOption === 'auto') {
      applyUiScale('auto');
    }
  });

  // Atalhos de teclado comuns de desktop (Ctrl +, Ctrl -, Ctrl 0)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        const steps: UiScaleOption[] = ['75', '85', '100', '115'];
        const idx = steps.indexOf(currentOption as any);
        if (idx !== -1 && idx < steps.length - 1) {
          applyUiScale(steps[idx + 1]);
        } else if (currentOption === 'auto') {
          applyUiScale('115');
        }
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const steps: UiScaleOption[] = ['75', '85', '100', '115'];
        const idx = steps.indexOf(currentOption as any);
        if (idx > 0) {
          applyUiScale(steps[idx - 1]);
        } else if (currentOption === 'auto') {
          applyUiScale('75');
        }
      } else if (e.key === '0') {
        e.preventDefault();
        applyUiScale('auto');
      }
    }
  });
}
