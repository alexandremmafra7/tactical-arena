# ⚽ TACTICAL ARENA FC — MASTER IMPLEMENTATION PLAN: MOTOR TÁTICO PROFISSIONAL (FIFA/UEFA COMPLIANT)

**Autor:** Principal Game Engine & Systems Architect (Staff Engineer)  
**Projeto:** Tactical Arena FC (`D:\Code\elifoot-reforged`)  
**Documento Fonte:** `Tactical_Arena_Estudo_Tatico_Profissional.xlsx`  
**Data:** 10 de Setembro de 2026  
**Status:** Plano Executivo & Arquitetura Técnica Aprovada  
**Classificação:** `Segundo Cérebro / Obsidian / Tactical Arena / Core Engine`

---

## 🎯 1. VISÃO EXECUTIVA & PRINCÍPIOS DE DESIGN DO MOTOR

O objetivo desta evolução é transformar o motor de simulação do **Tactical Arena FC** de um modelo probabilístico simplificado em um **Simulador Tático Profissional Explicável**, com profundidade estratégica equivalente a um *micro-Football Manager ágil*, mantendo a rapidez de execução em dispositivos móveis e desktop.

### ⚖️ Princípios Invioláveis de Arquitetura:
1. **Formação não determina comportamento:** O desenho tático (ex: 4-3-3) é apenas a geometria de partida; as instruções das 4 fases do jogo definem o comportamento dinâmico.
2. **Toda vantagem gera uma vulnerabilidade (Sem táticas invencíveis):** Nenhuma escolha tática pode ser puramente dominante. Subir a linha aumenta a pressão, mas expõe as costas da zaga; jogar em bloco baixo protege a área, mas cede a posse e a iniciativa.
3. **Causalidade e Feedback Explicável no Pós-Jogo:** O treinador deve saber com precisão lógica *por que* ganhou, empatou ou tomou gols (ex: número de desarmes na pressão alta, bolas nas costas da linha, contra-ataques sofridos).
4. **Custo Físico & Desgaste Proporcional:** Pressão alta, contra-ataque veloz e sobrecarga de alas custam estamina e aumentam o risco de lesões e falhas técnicas nos minutos finais.
5. **Níveis de Abstração para UX (Fácil de Jogar, Difícil de Dominar):**
   - *Nível 1 (Casual):* 8 Presets Táticos prontos (1 clique).
   - *Nível 2 (Intermediário):* Ajustes de 5 sliders fundamentais (Mentalidade, Estilo de Ataque, Marcação, Linha Defensiva, Pressão).
   - *Nível 3 (Avançado):* Gatilhos contextuais in-game e papéis individuais de jogadores.

---

## 🏗️ 2. MAPA DE IMPACTO ARQUITETURAL NO MONOREPO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PACKAGES / SHARED                                  │
│                                                                             │
│  ┌───────────────────────────┐         ┌─────────────────────────────────┐  │
│  │ src/domain/tactic.ts      │         │ src/simulation/tacticalMatchup  │  │
│  │ - 8 Presets Profissionais │         │ - Matriz de Vantagens Táticas   │  │
│  │ - Rest Defence (2+3, 3+2) │         │ - Cálculo de Duelo Tático       │  │
│  │ - Fases Com/Sem Bola      │         └─────────────────────────────────┘  │
│  └─────────────┬─────────────┘                          │                   │
│                │                                        ▼                   │
│                ▼                       ┌─────────────────────────────────┐  │
│  ┌───────────────────────────┐         │ src/simulation/engine.ts        │  │
│  │ src/simulation/teamStrength│────────>│ - Probabilidade de Transição    │  │
│  │ - Compatibilidade WINGS   │         │ - Counterpress temporal         │  │
│  │ - Eficiência de Bloco     │         │ - Exposição de Linha Alta       │  │
│  └───────────────────────────┘         └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PACKAGES / WEB & DESKTOP                           │
│                                                                             │
│  ┌───────────────────────────┐         ┌─────────────────────────────────┐  │
│  │ src/components/PitchField │         │ src/pages/MatchResult.tsx       │  │
│  │ - Linhas dinâmicas        │         │ - Relatório Causal Pós-Jogo     │  │
│  │ - Setas de transição      │         │ - Métricas de Pressão e Gols    │  │
│  └───────────────────────────┘         └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 3. O BACKLOG TÉCNICO DE IMPLEMENTAÇÃO (FASE A FASE)

---

### 🧩 FASE 1: NÚCLEO MATEMÁTICO & COMPATIBILIDADE DE FORMAÇÃO (MVP CORE)

#### 🔹 Tarefa 1.1: Compatibilidade Estilo de Ataque WINGS × Ocupação de Alas/Pontas
* **Arquivos:**
  - `packages/shared/src/simulation/teamStrength.ts`
  - `packages/shared/src/simulation/teamStrength.test.ts`
* **Implementação Técnica:**
  - Implementar função `calculateFlankCoverage(formation: Formation, lineup: LineupSlot[])`:
    - Verifica se a formação possui alas (`LAT`) ou atacantes de ponta (`ATT` com `side === 'LEFT' | 'RIGHT'`).
  - Se o `attackStyle === 'WINGS'`:
    - Com cobertura lateral completa (>= 2 jogadores por lado ou pontas nativos): Bônus de **+5% a +8%** no setor ofensivo e geração de cruzamentos.
    - Sem jogadores de corredor (ex: 3-5-2 afunilado ou 4-3-1-2 sem laterais ofensivos): Penalidade de **-12%** na criação de chances pelo setor, forçando desarmes adversários.
  - Estilos de marcação (`ZONAL`, `MAN_MARKING`, `BALANCED`) permanecem desacoplados da exigência de pontas para não punir defesas legítimas.

#### 🔹 Tarefa 1.2: Matriz de Altura de Bloco & Altura da Linha Defensiva
* **Arquivos:**
  - `packages/shared/src/domain/tactic.ts`
  - `packages/shared/src/simulation/tacticalMatchup.ts`
* **Implementação Técnica:**
  - Adicionar enums:
    - `DefensiveBlockHeight = 'LOW_BLOCK' | 'MID_BLOCK' | 'HIGH_PRESS'`
    - `DefensiveLineHeight = 'DEEP' | 'BALANCED' | 'HIGH'`
  - **Dinâmica Matemática:**
    - `HIGH_PRESS` + `HIGH_LINE`: Multiplica roubadas de bola no terço ofensivo em **1.35x**, mas aumenta o xG de chances cedidas por bola longa/contra-ataque nas costas da zaga em **1.40x** (se o adversário tiver atacantes rápidos).
    - `LOW_BLOCK` + `DEEP_LINE`: Reduz o perigo de bolas nas costas para **0.4x**, mas cede **65%+ de posse de bola** e sofre maior volume de chutes de média distância.

#### 🔹 Tarefa 1.3: Catálogo Canônico dos 8 Presets Táticos Oficiais
* **Arquivo:** `packages/shared/src/domain/tacticPreset.ts`
* **Implementação Técnica:**
  Criar os presets pré-calibrados da planilha:
  1. **Tiki-Taka / Jogo de Posição:** 4-3-3 · Posse Curta · Bloco Alto · Linha Alta · Pressão Pós-Perda.
  2. **Gegenpressing (Rock & Roll):** 4-2-3-1 · Ritmo Vertical · Pressão Alta Sufocante · Transição Veloz.
  3. **Bloco Baixo & Contra-Golpe (Mourinho/Simeone):** 5-3-2 ou 4-4-2 · Bloco Baixo · Linha Baixa · Lançamento Direto.
  4. **Ataque pelas Pontas (Futebol Clássico):** 4-4-2 · WINGS · Cruzamentos na Área · Marcação Equilibrada.
  5. **Controle de Meio-Campo (Losango):** 4-4-2 Diamond · Jogo por Dentro · Bloco Médio.
  6. **Ataque Total / Desespero (Tudo ou Nada):** 3-4-3 · Linha Muito Alta · Pressão Total · Mentalidade Ofensiva.
  7. **Catenaccio / Trancaço:** 5-4-1 · Bloco Muito Baixo · Marcação Individual Rígida.
  8. **Transição Equilibrada:** 4-1-4-1 · Bloco Médio · Posse e Ataque Balanceados.

---

### 🧩 FASE 2: TRANSIÇÕES DINÂMICAS & REST DEFENCE NO MOTOR DE PARTIDA

#### 🔹 Tarefa 2.1: Modelo de Transição Pós-Perda (Counterpress vs Recompor)
* **Arquivos:**
  - `packages/shared/src/simulation/engine.ts`
  - `packages/shared/src/simulation/engine.test.ts`
* **Implementação Técnica:**
  - Janela probabilística de 5 segundos após a perda da posse:
    - Se tática = `COUNTERPRESS`: Rola teste de `Trabalho em Equipe` + `Antecipação` vs `Primeiro Toque` do adversário. Sucesso = recuperação imediata em zona perigosa (+xG). Falha = linha desestruturada por 1 turno de simulação.
    - Se tática = `RECOMPOR`: O time recua imediatamente para as posições do bloco base, cedendo progressão sem risco de desorganização.

#### 🔹 Tarefa 2.2: Estrutura de Rest Defence (2+3 ou 3+2)
* **Arquivos:**
  - `packages/shared/src/domain/tactic.ts`
  - `packages/shared/src/simulation/teamStrength.ts`
* **Implementação Técnica:**
  - Quando um time ataca, quem fica para proteger a transição adversária:
    - **Padrão 3+2:** 3 zagueiros (ou 2 zagueiros + 1 lateral fixo) + 2 volantes à frente. Estabilidade máxima contra contra-ataques centrais.
    - **Padrão 2+3:** 2 zagueiros rápidos + 2 laterais invertidos e 1 primeiro volante no círculo central. Máxima retenção territorial, mas vulnerável a pontas rápidos nos flancos.

---

### 🧩 FASE 3: QUÍMICA DE ELENCO & PAPÉIS TÁTICOS ATIVOS

#### 🔹 Tarefa 3.1: Entrosamento e Química Setorial (Squad Chemistry System)
* **Arquivos:**
  - `packages/shared/src/domain/squadHarmony.ts`
  - `packages/shared/src/simulation/sectorSynergy.test.ts`
* **Implementação Técnica:**
  - Tabela de minutos jogados juntos por parcerias críticas:
    - Dupla de Zaga (`DEF` + `DEF`)
    - Dupla de Meio-Campo (`VOL` + `MEI`)
    - Dupla/Trio de Ataque (`ATA` + `ATA` / `EXT`)
  - Escala de afinidade (0 a 100):
    - 0-25 (Recém-contratados): +10% de chance de desentendimento/passe errado sob pressão.
    - 75-100 (Veteranos entrosados): Bônus de +6% em antecipação coletiva e coberturas defensivas.

#### 🔹 Tarefa 3.2: Papel Tático Aprofundado por Jogador
* **Arquivos:**
  - `packages/shared/src/domain/player.ts`
  - `packages/shared/src/simulation/engine.ts`
* **Implementação Técnica:**
  - Transformar `PlayerFunction` em modificador matemático ativo:
    - **Volante Cão de Guarda:** +20% em desarmes e faltas táticas, -15% em construção de jogadas.
    - **Meia 8 (Box-to-Box):** Aumenta recuperação de 2ª bola, exige alta estamina.
    - **Falso 9:** Recua para atrair zagueiros adversários (+abertura de espaço para infiltração de pontas), mas reduz presença de área em cruzamentos.
    - **Ponta Invertido:** Foca em finalização e drible para dentro vs **Ponta Clássico** que foca em cruzamento na linha de fundo.

---

### 🧩 FASE 4: INTERFACE, CAMPINHO DINÂMICO & RELATÓRIO PÓS-JOGO (UX)

#### 🔹 Tarefa 4.1: Campinho Interativo Dinâmico (`PitchField.tsx`)
* **Arquivos:**
  - `packages/web/src/components/PitchField.tsx`
  - `packages/web/src/styles.css`
* **Implementação Técnica:**
  - Quando o usuário altera a altura da linha ou a pressão, a linha de zaga visual no campo sobe ou desce graficamente.
  - Renderização de setas de apoio sutis indicando o fluxo de ataque (Pelos Lados = setas nas alas; Pelo Meio = setas convergindo para o semicírculo).

#### 🔹 Tarefa 4.2: Relatório Causal Pós-Jogo (`MatchResult.tsx`)
* **Arquivos:**
  - `packages/web/src/pages/MatchResult.tsx`
  - `packages/shared/src/domain/match.ts`
* **Implementação Técnica:**
  - Exibição de cards explicativos de performance tática:
    - *"Eficiência da Pressão: 8 recuperações de bola no ataque geraram 2 gols."*
    - *"Vulnerabilidade: 3 contra-ataques perigosos concedidos nas costas da zaga adiantada."*
    - *"Sinergia das Pontas: 14 cruzamentos tentados, 4 finalizações originadas pelos alas."*

---

## 🧪 4. PLANO DE CALIBRAÇÃO & PROTEÇÃO CONTRA REGRESSÃO (MONTE CARLO)

Para garantir que o motor permaneça equilibrado e não gere anomalias estatísticas:

1. **Bateria de Simulação em Lote (1.000 Jogos):**
   - Script de teste automatizado que simula 1.000 partidas entre times de forças iguais e díspares.
   - **Métricas de Aceite:**
     - Média de gols por partida: entre **2.40 e 2.90 gols**.
     - Vitórias do mandante: entre **42% e 48%**.
     - Empates: entre **24% e 28%**.
     - Frequência de cartões amarelos: **3.2 a 4.5 por jogo**.
2. **Testes Unitários em Vitest:**
   - 100% de cobertura nos novos arquivos de compatibilidade e modificadores táticos.

---

## 📅 5. CRONOGRAMA DE EXECUÇÃO RECOMENDADO

| Sprint | Foco | Tarefas | Entregável |
| :---: | :--- | :--- | :--- |
| **Sprint 1** | **Core Tático & WINGS** | Tarefas 1.1, 1.2 e 1.3 | Compatibilidade de Pontas, Altura de Bloco/Linha e 8 Presets Oficiais. |
| **Sprint 2** | **Transições & Motor** | Tarefas 2.1 e 2.2 | Counterpress, Recomposição e Rest Defence 2+3 / 3+2 no `engine.ts`. |
| **Sprint 3** | **Química & Papéis** | Tarefas 3.1 e 3.2 | Sistema de Entrosamento e Papéis Táticos reais por posição. |
| **Sprint 4** | **UX & Visualização** | Tarefas 4.1 e 4.2 | Campinho dinâmico, feedback pós-jogo e compilação do novo `.exe` e `.apk`. |
