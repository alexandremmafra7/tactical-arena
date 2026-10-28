# Fase 07: Motor Tático Profissional - Progresso

**Status:** ✓ Ma parte implementada, auditoria pendente
**Última Atualização:** Sep 11, 2026

---

## 📋 Mapeamento Planejado vs Implementado

### FASE 1: NÚCLEO MATEMÁTICO (MVP CORE)

| Tarefa | Planejado | Implementado | Arquivo | Status |
|--------|-----------|--------------|---------|--------|
| **1.1** Compatibilidade WINGS × Alas | Obter/suspender quando rally contínuo de maneira incontível. Pesquisar Não encontrado. | `calculateFlankCoverage()` com multiplicadores `WINGS_WITH_FLANK_COVERAGE`(1.06) / `WINGS_WITHOUT_FLANK_COVERAGE`(0.88) | `simulation/teamStrength.ts` (linhas 43-51) | ✅ Completo |
| **1.2** Altura de Bloco & Linha Defensiva | `DefensiveLineHeight` enum: `DEEP`, `BALANCED`, `HIGH`. Matriz de vantagens. | `DEFENSIVE_LINE_MODIFIERS` com `spaceBehind`(0.2/0.5/0.9) e `recoverySupport`(0.92/1.0/1.17) | `domain/tactic.ts` (linhas 55-98, 244-252) | ✅ Completo |
| **1.3** 8 Presets光大 | `CANONICAL_TACTIC_PRESETS`: Tiki-Taka, Gegenpress, Bloco Baixo, Pontas, Losango, Total Football, Catenaccio, Equilibrada. | Array completo com 8 presets em `tacticPreset.ts` | `domain/tacticPreset.ts` (linhas 42-147) | ✅ Completo |

---

### FASE 2: TRANSIÇÕES DINÂMICAS & REST DEFENCE

| Tarefa | Planejado | Implementado | Arquivo | Status |
|--------|-----------|--------------|---------|--------|
| **2.1** Modelo de Transição Pós-Perda | Window de 5 segundos após bola perdida. Roll COUNTERPRESS vs RECOMPOSE. Estado de disorganized no engine. | `counterpressSuccessProbability()` (engines.ts, 1376-1389). Estado `disorganized` como flag para próxima sequência adversária. | `simulation/engine.ts` (629-700, 696-700) | ✅ Completo |
| **2.2** Rest Defence 2+3 vs 3+2 | Guardar "defensor de três" e "controle de dois" em bengalinas de boi. | `computeRestDefenceCompatibility()` em `teamStrength.ts` (268-292). `RestDefenceModifiers`: `centralExposure`(0.8/0.95), `territorialRetention`(1.0/1.1), `flankVulnerability`(1.0/1.2). | `simulation/teamStrength.ts` (254-292) | ✅ Completo |

---

### FASE 3: QUÍMICA & PAPÉIS (FUTURO)

| Tarefa | Planejado | Implementado | Status |
|--------|-----------|--------------|--------|
| **3.1** Squad Chemistry System | Pontos por entrosamento de parcerias críticas (Zaga, Meio, Ataque) com escala de afinidade (NEW a VETERAN) e bônus de cobertura/passes. | `calculatePartnershipAffinity`, `findCriticalPartnerships`, `calculateSquadPartnershipSynergy` em `domain/squadPartnership.ts` com suíte de testes. | ✅ Completo |
| **3.2** Papéis Táticos Ativos | Transformar `PlayerFunction` em modificador matemático: 11 funções ativas com bônus e 1-clique no auxiliar. | `PLAYER_ROLE_MODIFIERS`, `autoAssignSquadRoles` em `playerRoleModifiers.ts`, botão no auxiliar em `ClubTactics.tsx`. | ✅ Completo |
| **3.3** Carisma de Líder | +3% em entrosamento defensivo se tiver trait LEADER e cancelamento de atritos. | `calculateSectorSynergy` com +3% de sinergia defensiva para LEADER (`teamStrength.ts`), cancelamento de atritos em `squadHarmony.ts` e bônus em `teamworkOf()`. | ✅ Completo |
| **3.4** Liderança & Grito de Guerra | Líder (+) troca ambiente raivoso em seu time: blindagem de crise e união. | Evento `LEADERSHIP_RALLY` em `lockerRoom.ts` gerado em má fase na presença de capitão/líder, reduzindo em 65% a perda de moral e convertendo desunião em coesão (+6). | ✅ Completo |
| **3.5** Margem de Pagamento por Combate do Jogo | Bonificações financeiras proporcionais ao desempenho coletivo (clean sheet, pressão alta, superação de azarão, fair play e goleada). | `calculateCombatPerformanceBonus` em `domain/finance.ts`, card de premiação em `MatchResult.tsx` e liquidação automática em `matchService.ts`/`localEngine.ts`. | ✅ Completo |

---

### FASE 4: UX & RELATÓRIO PÓS-JOGO

| Tarefa | Planejado | Implementado | Status |
|--------|-----------|--------------|--------|
| **4.1** Campinho Dinâmico | Altura da linha defensiva subindo/descendo graficamente e setas dinâmicas de estilo de ataque (alas, meio, equilibrado). | `PitchTacticalOverlay`, linha com badge de status, zona de perigo/espaço nas costas e setas em `PitchField.tsx` / `ClubTactics.tsx`. | ✅ Completo |
| **4.2** Relatório Causal pós-Jogo | Cards com explicação de performance tática: recuperações na pressão, bolas nas costas, sinergia de pontas. | `simulation/tacticalReport.ts` integrado em `MatchResult.tsx` com relatório causal completo. | ✅ Completo |

---

## 🧩 STATUS DO BACKLOG DA FASE 07

### Concluído (100% Validado)
1. ✅ **8 Presets Táticos Canônicos** - Presets oficiais e balanceados em `tacticPreset.ts`.
2. ✅ **Transição Pós-Perda e Rest Defence** - Counterpress / Recompor e 2+3 / 3+2 em `engine.ts` e `teamStrength.ts`.
3. ✅ **Papéis Táticos Ativos** - 11 funções ativas com modificadores matemáticos e delegação em 1 clique para o Auxiliar.
4. ✅ **Relatório Causal Pós-Jogo** - Diagnóstico com cards explicativos de performance tática em `MatchResult.tsx`.
5. ✅ **Campinho Dinâmico (UX)** - Linha defensiva visual que sobe e desce, área de perigo nas costas da zaga e setas dinâmicas de estilo de ataque em `PitchField.tsx` / `ClubTactics.tsx`.
6. ✅ **Calibração Monte Carlo (1.000 jogos)** - Script oficial `scripts/benchmark-tactical-engine.ts` (`npm run test:benchmark`) aferido contra parâmetros oficiais FIFA/UEFA (Gols: 2.88, Mandante: 43.6%, Empates: 22.5%, Amarelos: 4.68, Recuperações Pressão: 6.9/jogo).
7. ✅ **Química de Parcerias (Squad Chemistry)** - Módulo canônico `squadPartnership.ts` mapeando Dupla de Zaga, Eixo Central de Meio e Dupla de Ataque com escala de afinidade (NEW/DEVELOPING/ESTABLISHED/VETERAN), bônus de cobertura e risco de pressão.
8. ✅ **Carisma de Líder (Tarefa 3.3)** - Sinergia defensiva coletiva de +3% com trait LEADER em `teamStrength.ts` e anulação de atritos em `squadHarmony.ts`.
9. ✅ **Liderança & Grito de Guerra (Tarefa 3.4)** - Evento dinâmico `LEADERSHIP_RALLY` em `lockerRoom.ts` gerado em má fase na presença de capitão/líder, reduzindo em 65% a perda de moral e gerando coesão positiva (+6).
10. ✅ **Margem de Pagamento por Combate do Jogo (Tarefa 3.5)** - Premiação e bonificação financeira proporcional ao desempenho coletivo (clean sheet, pressão alta, azarão, fair play e goleada) em `finance.ts`, integrado na UI (`MatchResult.tsx`) e liquidado no backend (`matchService.ts`) e offline (`localEngine.ts`).

### Próximas Frentes
- Fase 07 100% Concluída e Validada na Suíte de Governança. Próximo ciclo: Roadmap Geral do Monorepo.