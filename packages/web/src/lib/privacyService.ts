const PRIVACY_CONSENT_KEY = 'tafc_privacy_consent_v1';
export const CURRENT_TERMS_VERSION = 1;

export function hasPrivacyConsent(): boolean {
  if (typeof localStorage === 'undefined') return true;
  const raw = localStorage.getItem(PRIVACY_CONSENT_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    return data.version >= CURRENT_TERMS_VERSION;
  } catch {
    return false;
  }
}

export function savePrivacyConsent(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(
    PRIVACY_CONSENT_KEY,
    JSON.stringify({
      accepted: true,
      timestamp: Date.now(),
      version: CURRENT_TERMS_VERSION,
    })
  );
}

/**
 * ATENDIMENTO AO ART. 18, V DA LGPD (PORTABILIDADE DOS DADOS):
 * Exporta todos os saves, configurações e dados do treinador em JSON.
 */
export function exportAllGameDataJson(): void {
  if (typeof localStorage === 'undefined') return;

  const exportedData: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    // Não exporta o token de autenticação bruto por segurança
    if (key === 'token') continue;
    try {
      exportedData[key] = JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
      exportedData[key] = localStorage.getItem(key);
    }
  }

  const payload = {
    metadados_lgpd: {
      jogo: 'Tactical Arena FC',
      data_exportacao: new Date().toISOString(),
      fundamento_legal: 'Art. 18, V da Lei 13.709/2018 (LGPD) - Portabilidade de Dados',
      natureza: 'Armazenamento local e dados de carreira',
      formato: 'JSON',
    },
    dados_carreira_e_treinador: exportedData,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `tactical_arena_fc_meus_dados_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * ATENDIMENTO AO ART. 18, VI DA LGPD (DIREITO À ELIMINAÇÃO):
 * Limpa todos os dados locais do jogo, saves e configurações.
 */
export function wipeAllGameData(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.clear();
  sessionStorage.clear();
  window.location.reload();
}
