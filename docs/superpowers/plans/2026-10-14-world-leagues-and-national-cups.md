# Passo 11: Principais Ligas & Copas Nacionais do Mundo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o ecossistema das 10 principais ligas e copas nacionais do mundo (Inglaterra, Espanha, Itália, Alemanha, França, Portugal, Holanda, Brasil, Argentina e Arábia Saudita) com suas respectivas divisões, copas nacionais mata-mata, supercopas, regras de classificação continental (Champions League, Libertadores, Europa League, AFC Champions League), troféus oficiais e visualizador Stadium Night.

**Architecture:**
- Domínio puro em `@tactical-arena/shared`: `worldLeagues.ts`, `nationalCups.ts`, extensões em `trophyRoom.ts` e exportação pública no barrel `index.ts`.
- Mapeamento determinístico de troféus oficiais a partir dos assets PNG já existentes em `content/trophies/` (`tr_nacional_*.png`, `tr_copa_*.png`, `tr_supercopa_*.png`).
- Resolução e merge de vagas continentais sem duplicatas (`qualifyLeagueTopFour`, `qualifyNationalCupWinner`, `mergeContinentalQualifications`).
- Interface do usuário em `packages/web`: componente Stadium Night `WorldCompetitionsModal` integrado em `CompetitionsHubPage` e suporte a imagens oficiais de troféus na `TrophyRoom.tsx`.

**Tech Stack:** TypeScript 5.8, React 18, Vitest 2, npm workspaces.

**Spec:** `docs/second-brain/19_WORLD_LEAGUES_CUPS_AND_NATIONAL_TEAMS_SPEC.md`

---

## File Map

- Modify `packages/shared/src/domain/worldLeagues.ts`: Definições das 10 ligas de elite, divisões, vagas continentais e desempates.
- Create `packages/shared/src/domain/worldLeagues.test.ts`: Testes unitários para regras de ligas globais e vagas continentais.
- Modify `packages/shared/src/domain/nationalCups.ts`: Definições das copas nacionais, supercopas, formatos e recompensas continentais.
- Create `packages/shared/src/domain/nationalCups.test.ts`: Testes unitários para copas e supercopas nacionais.
- Modify `packages/shared/src/domain/trophyRoom.ts`: Suporte a assets oficiais de troféus para competições nacionais.
- Modify `packages/shared/src/domain/trophyRoom.test.ts`: Testes de visual spec e troféus nacionais.
- Modify `packages/shared/src/index.ts`: Exportação pública dos domínios `worldLeagues` e `nationalCups`.
- Modify `packages/web/src/pages/TrophyRoom.tsx`: Renderização de troféu PNG oficial com glow Stadium Night.
- Create `packages/web/src/components/WorldCompetitionsModal.tsx`: Modal interativo Stadium Night para explorar ligas e copas globais.
- Create `packages/web/src/components/WorldCompetitionsModal.test.tsx`: Testes de renderização e navegação por países/confederações.
- Modify `packages/web/src/pages/CompetitionsHub.tsx`: Acesso ao Hub de Ligas Globais e Copas do Mundo.
- Modify `docs/second-brain/06_ACTIVE_ROADMAP.md`: Atualização do status do Passo 11 para concluído.

---

### Task 1: Domínio e Testes de Ligas Mundiais e Copas Nacionais

- [x] **Step 1: Criar testes unitários para `worldLeagues.test.ts`**
- [x] **Step 2: Criar testes unitários para `nationalCups.test.ts`**
- [x] **Step 3: Garantir completude em `worldLeagues.ts` e `nationalCups.ts`**
- [x] **Step 4: Exportar tipos e funções no barrel público `packages/shared/src/index.ts`**
- [x] **Step 5: Executar testes de shared (`npm run test:shared`)**

---

### Task 2: Integração com Sala de Troféus e Assets Oficiais

- [x] **Step 1: Atualizar `trophyRoom.ts` para resolver assets oficiais de troféus (`tr_nacional_*.png`, `tr_copa_*.png`, `tr_supercopa_*.png`)**
- [x] **Step 2: Atualizar testes em `trophyRoom.test.ts`**
- [x] **Step 3: Atualizar `TrophyRoom.tsx` para exibir a imagem oficial do troféu quando disponível**
- [x] **Step 4: Executar testes de web e shared**

---

### Task 3: Modal Interativo de Ligas e Copas do Mundo (Stadium Night)

- [x] **Step 1: Criar componente `WorldCompetitionsModal.tsx` com filtros de confederação, cards de ligas, copas, vagas continentais e troféus oficiais**
- [x] **Step 2: Criar testes unitários `WorldCompetitionsModal.test.tsx`**
- [x] **Step 3: Integrar botão de abertura em `CompetitionsHub.tsx`**
- [x] **Step 4: Executar `npm test -w packages/web`**

---

### Task 4: Validação Geral e Atualização do Roadmap

- [x] **Step 1: Rodar suíte de testes de todo o monorepo (`test:shared`, `test:server`, `test:web`)**
- [x] **Step 2: Testar build de produção**
- [x] **Step 3: Atualizar `docs/second-brain/06_ACTIVE_ROADMAP.md` marcando Passo 11 como 🟢 Concluído**

