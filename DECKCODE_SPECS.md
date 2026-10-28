# Tactical Arena FC (Elifoot Reforged)

> **Status:** BUILDING
> **Prioridade:** medium
> **Progresso:** 82%
> **Foco Atual:** Calibrar o motor tático (benchmark Monte Carlo), fechar negociações e empacotar o beta desktop
> **Próxima Ação:** Executar benchmark de simulação de 100 rodadas e calibrar o balanceamento de gols em contra-ataque
> **Prazo:** 2026-12-05
> **Tech Stack:** TypeScript, React, Vite, Electron, Node.js, Vitest, Capacitor, Web Audio API

## 1. Visão Geral
Tactical Arena FC é um simulador de gestão de futebol clássico contemporâneo, sucessor espiritual do mítico Elifoot 98 e Championship Manager. O projeto combina jogabilidade rápida, viciante e sem burocracia excessiva com profundidade tática moderna, economia de direitos de transmissão, estádios modulares, formação de jovens talentos na base, síntese de áudio procedural para reações de torcida e motor de grounding científico para estatísticas realistas de partidas.

## 2. Próximos Passos
- [x] Criar arquitetura modular em monorepo (shared, server, web, desktop)
- [x] Implementar motor de simulação turno a turno com cálculo xG e shotpool
- [x] Construir visualizador 2D de lances da partida com aceleração de tempo
- [x] Integrar motor de áudio procedural com sintetizador de ruído de torcida
- [ ] (30/10) Benchmark de 100 rodadas e calibração de gols em contra-ataque
- [ ] (05/11) Calibrar tabela de atributos de jogadores para ligas nacionais e internacionais
- [ ] (08/11) Reconciliar este spec com o roadmap do vault: leilões ao vivo/Deadline Day constam como concluídos lá
- [ ] (20/11) Máquina de estados para negociações de atletas e ajuste de fadiga nos acréscimos do 2º tempo
- [ ] (05/12) Empacotar instalador Windows autônomo com npm run test e npm run build 100% verdes
- [ ] (20/12) Empacotar versão APK mobile (Capacitor) e teste real
- [ ] (2027-01) Página itch.io (edição Founder) e trailers; Steam depois

## 3. Metas & Submetas
- [x] (Dev) Suíte de testes automatizados com Vitest cobrindo regras de partida e banco de dados
- [x] (Dev) Startup portátil ultrarrápido (< 800ms) sem latência de IPC
- [ ] (Users) Conquistar 1.000 jogadores na fase beta da comunidade de saudosistas de Elifoot
- [ ] (Marketing) Produzir trailers de gameplay destacando a velocidade das rodadas e o modo carreira
- [ ] (Revenue) Disponibilizar edição Founder no itch.io e Steam com editor de ligas customizadas

## 4. Notas & Decisões
- **[DECISÃO]**: Utilizar banco de dados SQLite local embarcado para saves rápidos e portabilidade total entre Desktop e Mobile.
- **[DECISÃO]**: Simulação de áudio gerada em tempo real via Web Audio API em vez de samples pesados em MP3, reduzindo tamanho do bundle e permitindo dinâmica reativa ao volume da torcida.
- **[NOTA]**: Algoritmo de xG e simulação tática testado com 100 partidas consecutivas para garantir curva estatística realista sem anomalias de placar.
- **[BLOQUEIO]**: Necessário calibrar equilíbrio salarial e receitas de patrocínio para clubes de 4ª divisão.
- **[NOTA]**: Categoria: COMERCIAL (Mythra Apps & Games). Mythra Games. Prazo estendido (era 2026-11-15) para dar prioridade à trilha de apps Play.
- **[NOTA]**: Verificar direitos de nomes reais de jogadores/clubes antes de qualquer venda.

## 5. Especificações & Épicos
### Épico: Motor de Simulação Tática (Tactical Core Engine)
#### Feature: Motor 2D de Lances e Cálculo de xG
- **Status:** in_progress
- **Descrição:** Motor matemático que resolve duelos de jogadores linha por linha, gera mapa de calor e oportunidades reais de finalização.
##### Tarefas:
- [x] (Claude | high) Criar algoritmo de probabilidade de desarme baseado em posicionamento e agressividade
- [ ] (Claude | medium) Ajustar impacto da fadiga física nos acréscimos do segundo tempo
- [x] (Human | medium) Validar distribuição de posse de bola entre esquemas táticos (4-3-3 vs 5-3-2)
##### Spec:
A simulação ocorre em 90 ticks de 1 segundo de tempo de jogo. Cada tick avalia transição de setor (Defesa -> Meio -> Ataque) ponderada pelo atributo de passe do portador versus interceptação do marcador.

### Épico: Economia do Clube e Mercado de Transferências
#### Feature: Janela de Transferências e Deadline Day
- **Status:** backlog
- **Descrição:** Sistema de propostas contratuais, cláusulas de rescisão e leilão dinâmico de última hora.
##### Tarefas:
- [ ] (Claude | high) Implementar máquina de estados para negociações de atletas
- [ ] (Gemini | medium) Adicionar IA de dirigentes concorrentes com orçamentos proporcionais à divisão

## 6. Documentos & Referências
- [Visão Geral e Arquitetura](./docs/second-brain/01_PROJECT_OVERVIEW.md)
- [Plano Mestre do Motor Tático](./docs/second-brain/07_TACTICAL_ENGINE_MASTER_PLAN.md)
- [Fluxo de Carreira](./docs/second-brain/04_CAREER_FLOW_SPEC.md)
- [Economia e Mídia](./docs/second-brain/08_BROADCAST_RIGHTS_AND_MEDIA_ECONOMY.md)
