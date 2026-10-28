import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Rola a janela e os elementos raiz para o topo (0, 0).
 */
export function resetScrollToTop(behavior: ScrollBehavior = 'instant') {
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, left: 0, behavior });
  }
  if (typeof document !== 'undefined') {
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  }
}

/**
 * Garante que em qualquer navegação de rota no SPA a visualização
 * volte ao topo (scrollTop = 0), prevenindo que telas abram no final
 * da página (por exemplo, ao entrar no jogo ao vivo vindo da preleção).
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    resetScrollToTop('instant');
  }, [pathname]);

  return null;
}
