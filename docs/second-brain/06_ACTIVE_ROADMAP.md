# 06. Roadmap Ativo & Status Técnico
> **Tags:** #roadmap #status #tasks #second-brain  
> *Última Atualização: Setembro de 2026*

---

## 🧭 Visão Geral do Ciclo de Desenvolvimento

\\\
[ 🟢 Concluído / Homologado ] ────────► [ 🟢 Concluído / Homologado ] ────────► [ 🟢 Concluído / Homologado ]
  • Onboarding & Carreira                 • Item 1: Scout & Diretor Mercado       • Item 5: Avanço Rápido de Calendário
  • Cores Dinâmicas & Design System       • Item 2: Contratos em Lote             • Fase 12: Pirâmide Internacional
  • Direitos de TV & Economia de Mídia    • Item 3: Depto Médico & Lesões         • Passo 1: Sala de Troféus & Hall da Fama
  • Setup Jarvis TechLead & Stream Deck   • Item 4: Base & Regime de Treino       • Passo 2: Deadline Day & Leilões ao Vivo
  • Padrão Visual Stadium Night           • Badges Especiais (Gênio/Baita/Sub-20) • WebAudio High-Fidelity Synthesizer
  • Quiz de Perfil do Treinador           • Calibração de Overalls & GKs          • 1.252 Testes Automatizados (100% Green)
\\\

---

## 📌 1. Quadro de Status das Entregas

| Frente de Trabalho | Status | Responsável | Detalhes & Impacto no Monorepo |
|---|---|---|---|
| **Criação de Carreira & Isolamento** | 🟢 Concluído | Antigravity / CCO | Múltiplas carreiras independentes sem colisão/reserva de clubes entre saves. |
| **Quiz de Perfil do Técnico (Fase 11)** | 🟢 Concluído | Antigravity / CCO | Entrevista interativa de 4 perguntas; mapeamento direto para delegação da comissão. |
| **Diretor: Scout & Mercado (Item 1)** | 🟢 Concluído | Antigravity / CCO | \computeDirectorTransferRecommendations\, propostas rápidas em 1 clique e modal FM. |
| **Contratos: Gestão em Lote (Item 2)** | 🟢 Concluído | Antigravity / CCO | Detecção de contratos a expirar (\identifyExpiringContracts\) e renovação em lote. |
| **Depto Médico & Prevenção (Item 3)** | 🟢 Concluído | Antigravity / CCO | \calculatePlayerInjuryRisk\, alerta pré-jogo e botão "Poupar Atletas em Risco". |
| **Base & Regimes de Treino (Item 4)** | 🟢 Concluído | Antigravity / CCO | Promoção automática de promessas (teto de 30 atletas), CT com alternância rápida/FM. |
| **Badges de Jogadores Especiais** | 🟢 Concluído | Antigravity | GÊNIO (88+ / World-class), BAITA JOGADOR (80-87 / Destaques) e PROMESSA SUB-20 (≤20 anos, Potencial 82+). |
| **Calibração Realista de Overalls** | 🟢 Concluído | Antigravity | Base de 116+ estrelas mundiais e do Brasil calibradas; correção da inflação de GKs (Rossi ~78). |
| **Identidade Visual dos Ícones Táticos** | 🟢 Concluído | Antigravity | Ícones táticos integrados e legenda com layout responsivo e sem rolagem horizontal. |
| **Avanço Rápido de Calendário (Item 5)** | 🟢 Concluído | Antigravity | Modo "Pular até o Jogo" (\astAdvance.ts\, \FastAdvanceButton\), simulação atômica de semanas e paradas de emergência. |
| **Pirâmide Internacional & Mundiais (Fase 12)**| 🟢 Concluído | Antigravity | Libertadores, Sul-Americana, Champions, Mundial Anual e Super Mundial Quadrienal (\continentalCompetitions.ts\, \ContinentalGroupStage.tsx\). |
| **Passo 1: Sala de Troféus & Hall da Fama** | 🟢 Concluído | Antigravity / CCO | Prateleira 3D, filtros por tiers, pódio top 3 de gols/assistências/jogos e livro de recordes. |
| **Passo 2: Deadline Day & Leilões ao Vivo** | 🟢 Concluído | Antigravity / CCO | Leilões de fim de janela, lances concorrentes +5%, panic sell/buy, contagem 12h-0h e liquidação atômica. |
| **Passo 3: Reconhecimento de Oposição & Dossiê Scout** | 🟢 Concluído | Antigravity / CCO | Missões de olheiro (`evaluateScoutingMission`), detecção de presets adversários, linha defensiva, rest defence, jogador-chave e contramedidas táticas no pré-jogo (`OppositionDossierCard`). |
| **Passo 4: Relatório Causal Pós-Jogo & Papéis Táticos** | 🟢 Concluído | Antigravity / CCO | Relatório tático causal (`generateTacticalMatchReport`), avaliação de papéis individuais (`calculateRolePerformanceReport`) e card Stadium Night (`TacticalRolePerformanceCard`) no pós-jogo. |
| **Passo 5: Coletiva de Imprensa Causal & Reativa** | 🟢 Concluído | Antigravity / CCO | Perguntas dinâmicas baseadas em fatos do jogo (`pressRecoveries`, linha alta, impacto de reservas), credenciais de imprensa, posturas morais e delegação 1-clique ao auxiliar. |
| **Passo 6: Campinho Tático & Prancheta Interativa** | 🟢 Concluído | Antigravity / CCO | Linhas de química SVG (`PitchPartnershipLines`), pílulas de funções táticas nos atletas (`PlayerFunctionPill`), toggle `[ 👁️ Simples / 📐 Prancheta FM ]` e barra de resumo de entrosamento (`PartnershipSummaryBar`). |
| **Passo 7: Visualizador Ao Vivo & Assistente de Beira de Campo** | 🟢 Concluído | Antigravity / CCO | Alertas causais em tempo real (`TouchlineAssistantCard`) para jogadores pendurados, exaustão (<50%), vulnerabilidade de linha alta e intervenção em 1 clique no `LiveMatch.tsx`. |
| **Passo 8: Radar Poligonal de Atributos & Comparador Tático** | 🟢 Concluído | Antigravity / CCO | Radar hexagonal SVG de 6 eixos (`PlayerRadarChart`), comparador lado a lado (`PlayerComparisonModal`) com veredito de scout e integração em `Squad.tsx` e `Transfers.tsx`. |
| **Passo 9: Hierarquia do Vestiário, Grupos & Capitães** | 🟢 Concluído | Antigravity / CCO | Pirâmide de liderança em 4 degraus (`hierarchy-pyramid`), mapa de grupos sociais (`computeSocialGroupsSummary`), e mediação de conflitos em 1 clique com o capitão (`resolvePlayerConcernWithLeader`). |
| **Passo 10: Mentoria 1-para-1 & Treino Setorial** | 🟢 Concluído | Antigravity / CCO | Mentoria veterano (27+) ⇄ promessa sub-22 (`calculateMentorshipCompatibility`, `autoAssignMentorshipPairs`), medidor de afinidade, cards Stadium Night e treino em bloco por linhas (Defesa, Meio e Ataque). |
| **Passo 11: Principais Ligas & Copas Nacionais do Mundo** | 🟢 Concluído | Antigravity / CCO | 10 ligas de elite (BRA, ENG, ESP, ITA, GER, FRA, POR, NED, ARG, KSA), copas nacionais mata-mata, supercopas, regras de vagas continentais, troféus PNG oficiais e modal Stadium Night (`WorldCompetitionsModal`). |
| **Passo 12: Mundiais de Clubes da FIFA (Anual & Super 32)** | 🟢 Concluído | Antigravity / CCO | Copa Intercontinental de Dezembro (6 campeões) e Super Mundial Quadrienal de 32 clubes (8 grupos de 4) no calendário unificado. |
| **Passo 13: Seleções Nacionais & Convocação Dinâmica** | 🟢 Concluído | Antigravity / CCO | 62+ Seleções Nacionais, convocação automática dos 23 melhores atletas de cada país a partir de `players.csv`, uniformes oficiais e modo carreira na seleção. |
| **Passo 14: Copa do Mundo da FIFA & Torneios de Seleções** | 🟢 Concluído | Antigravity / CCO | Copa do Mundo (32 seleções), Copa América, Eurocopa, Finalíssima CONMEBOL-UEFA e prateleiras de troféus internacionais. |
| **Passo 15: Central de Negociações & Cláusulas Avançadas** | 🟢 Concluído | Antigravity / CCO | Cláusulas de bônus por gol/clean sheet, sell-on clause (mais-valia), mesa de negociação interativa (`NegotiationRoomModal`) com perfis de agentes e medidor de paciência. |
| **Passo 16: Rede Mundial de Olheiros & Névoa de Guerra** | 🟢 Concluído | Antigravity / CCO | Sistema de Fog of War para atributos desconhecidos (`maskPlayerAttributes`), perfis de olheiros, missões internacionais (`GlobalScoutMission`) e painel de garimpo (`ScoutingNetworkPage.tsx`). |
| **Passo 17: Torneios de Pré-Temporada & Amistosos de Verão** | 🟢 Concluído | Antigravity / CCO | Convites para turnês internacionais (`Florida Winter Cup`, `Troféu Ramón de Carranza`, `Asia Summer Tour`), cotas de participação milionárias, prêmios e chaveamento quadrangular (`PreSeasonInvitationModal.tsx`). |
| **Passo 18: O "Juice", Emoção & Polish do Dia de Jogo** | 🟢 Concluído | Antigravity / CCO | Linha do tempo visual da partida (`MatchDramaWidgets`), fluxo de momentum, suspense e clímax dos acréscimos, replay de lances capitais pós-jogo (`CapitalMomentsReplay`) e disputa de pênaltis tensa. |
| **Passo 19: Editor In-Game & Customização de Times/Kits** | 🟢 Concluído | Antigravity / CCO | Kit Designer SVG em tempo real (titular/reserva, padrões e listras), editor de estádio e gramado, gerador de elenco 1-clique e exportação/importação de Mod Packs. |
| **Passo 20: Modo Torneio Rápido & Partida Rápida (Quick Play)** | 🟢 Concluído | Antigravity / CCO | Partida rápida 1v1 (clubes ou seleções), Copas mata-mata customizadas (4, 8 ou 16 times), chaveamento com pódio e troféu sem poluição do save de carreira. |
| **Passo 21: Modo Online Multiplayer P2P (WebRTC DataChannel)** | 🟢 Concluído | Antigravity / CCO | Salas com código (ex: `ARENA-882`), Duelos 1v1, Mini-torneios mata-mata (4 a 8 players), Fantasy Draft, STUN NAT traversal e sincronização de ticks do motor sem custo de servidor. |
| **Fase Final: Blindagem de Segurança, Auditoria Geral & Stress Tests** | 🟡 Em Execução | Antigravity / CCO | Anti-vazamento de dados, anti path-traversal, sandbox de saves, testes de stress de 10 anos e 500 partidas, Error Boundary e auditoria de produção. |
| **Engine de Áudio de Alta Fidelidade** | 🟢 Concluído | Antigravity | WebAudio sintetizado puro (sem MP3s pesados), apitos suaves, chutes, traves e comemoração da torcida. |
| **Fase 07: Motor Tático & Bônus de Combate (3.5)** | 🟢 Concluído | Antigravity / CCO | `squadPartnership.ts`, química de setores, bônus LEADER, evento `LEADERSHIP_RALLY`, e margem financeira por combate (`calculateCombatPerformanceBonus`). |

---

## 🧪 2. Saúde e Qualidade do Monorepo

* **Total de Testes Automatizados:** **1.470+ testes** (912 em shared, 288 em server, 270 em web) — **100% Green**.
* **Build de Produção:** Compilação 100% limpa em Vite, Server e Desktop Electron (`Tactical Arena FC 0.1.0.exe`).
