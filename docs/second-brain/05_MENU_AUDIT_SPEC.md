# 05. Auditoria de Menus & Arquitetura de Navegação
> **Tags:** `#ui-ux` `#navigation` `#ergonomia` `#game-design` `#canon-2026`

---

## 🧭 1. Diagnóstico da Navegação & Objetivos
- **Arquivo Principal:** `packages/web/src/components/ClubNav.tsx`, `HubSubnav.tsx` e `packages/web/src/lib/clubNavigation.ts`.
- **Problemas Superados:**
  - Telas-Hub intermediárias estáticas (`/team` e `/financial`) que travavam o jogador com cliques intermediários.
  - Alternância de alta frequência entre **Tática** e **Elenco** que exigia voltar para o topo.
  - Falta de atalhos rápidos para o próximo confronto e competições ativas.

---

## 📐 2. Princípios Canônicos Implementados

### A. Regra dos 2 Cliques (Garantia por Grafo)
- Módulo puro `clubNavigation.ts` com **43 testes unitários** provando que qualquer destino de gestão essencial (`squad`, `tactics`, `training`, `transfers`, `finance`, `league`, `cup`) é atingível em no máximo **2 ações deliberadas** a partir de qualquer ponto do jogo.

### B. Remoção de Hub Gates Estáticos
- Rotas legadas `/team` e `/financial` redirecionadas automaticamente via `LegacyClubRedirect` para `/squad` e `/finance`.
- Telas filhas (`Training`, `Academy`, `Staff`, `Contracts`, `Finance`, `Sponsors`, `Stadium`) voltam direto para o painel principal (`ClubHome`), eliminando loops.

### C. Atalhos Globais no Cabeçalho (Topbar)
- `⚽ Próximo confronto` (leva a `/briefing`).
- `🏆 Competições` (leva a `/competitions`).

### D. Sala de Comando (ClubHome.tsx) & Olheiro Rápido
- Card dinâmico **Olheiro rápido** (`quickOpponentScout`): exibe média de overall do rival, retrospecto na liga, destaque individual e atalho direto `Preparar plano de jogo` para `/tactics`.

### E. Neo-Myth Tech Design System & Acessibilidade
- **Tipografia Offline-First:** Fontes variáveis locais *Space Grotesk* (display/títulos) e *Inter* (corpo/dados) sem dependência externa de CDN.
- **Alvo de Toque Canônico:** Mínimo de **48×48px** para botões e links de navegação (`.back-to-panel`, `.home-button`, `.topbar-shortcut`, `.hub-subnav-btn`, `.mobile-nav-item`, `.mobile-drawer-tile`).

