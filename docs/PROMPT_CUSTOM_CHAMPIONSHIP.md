# Especificação Técnica: Modo Campeonatos Personalizados (Custom Championships) & Fundação Multiplayer

## 1. Visão Geral e Objetivo
Implementar o modo de jogo **Campeonatos Personalizados** no Tactical Arena FC. Este modo permite ao jogador montar uma estrutura de ligas e copas com total liberdade, escolhendo clubes de qualquer nacionalidade, configurando o formato de disputa (pontos corridos, pontos corridos com playoffs finais, copas eliminatórias) e definindo de 1 a 4 divisões com regras de promoção e rebaixamento.

Além de ser uma experiência single-player rica (ex: criar uma "Superliga Mundial" ou uma "Libertadores dos Sonhos"), essa arquitetura serve como alicerce direto para o **Multiplayer P2P**, onde o Host poderá criar mini-campeonatos e ligas customizadas para jogar com amigos.

---

## 2. Requisitos Funcionais

### 2.1 Formatos de Competição Suportados
1. **Pontos Corridos Puro (`LEAGUE_PURE`):**
   - Turno Único (`SINGLE_ROUND`) ou Ida e Volta (`DOUBLE_ROUND`).
   - Campeão definido pelo topo da tabela de classificação ao término das rodadas.
2. **Pontos Corridos com Playoffs (`LEAGUE_WITH_PLAYOFFS`):**
   - Fase regular em pontos corridos (todos contra todos).
   - Linha de corte de classificação para o mata-mata final:
     - **Top 4:** Semifinais (1º vs 4º, 2º vs 3º) e Final (com disputa opcional de 3º lugar).
     - **Top 8:** Quartas de final (1º vs 8º, 2º vs 7º, 3º vs 6º, 4º vs 5º), Semifinais e Final.
   - Formato do mata-mata: Jogo único (campo neutro) ou Ida e Volta (com vantagem de empate por melhor campanha na fase regular ou disputa de pênaltis).
3. **Copa Eliminatória (`CUP_KNOCKOUT`):**
   - Torneio eliminatório mata-mata (8, 16 ou 32 clubes).
   - Quantidade de fases ajustada automaticamente pelo número de participantes (ex: 8 clubes = 3 fases; 16 clubes = 4 fases; 32 clubes = 5 fases).
   - Jogo único ou ida e volta (com pênaltis).
4. **Múltiplas Divisões com Acesso e Descenso (`CUSTOM_PYRAMID`):**
   - O jogador pode criar de 1 a 4 divisões (ex: Divisão 1 / Série Ouro com 16 clubes, Divisão 2 / Série Prata com 16 clubes).
   - Configuração de vagas de promoção e rebaixamento (ex: sobem 2 e caem 2 a cada temporada).
   - Opção de incluir uma **Copa Geral** integrando clubes de todas as divisões criadas.

### 2.2 Seleção Rápida e Inteligente de Clubes (Dois Níveis)
1. **Seleção em Lote (Bulk Actions):**
   - **Por País:** Botão que abre a lista de países disponíveis e permite adicionar com 1 clique todos os clubes de uma divisão específica daquele país (ex: "Adicionar todos da Premier League Inglesa" ou "Adicionar Série A do Brasil").
   - **Presets Rápidos em 1 Clique:**
     - *"Top 20 Mundial"* (os 20 clubes com melhor pontuação/elenco da base).
     - *"Melhores da América do Sul"* (principais clubes de Brasil, Argentina, Uruguai, etc.).
     - *"Gigantes da Europa"* (campeões e potências da UEFA).
     - *"G-12 Brasileiro"* + convidados.
2. **Customização Individual (Ajuste Fino):**
   - Busca universal de clubes por nome com auto-complete.
   - Filtros por país, continente, estrelas de elenco e divisão original.
   - Botão para remover clube avulso (`X`) ou substituir por outro clube de qualquer lugar do mundo.
   - Arrastar e soltar (ou botões de troca) entre Divisão 1 e Divisão 2.

### 2.3 Preservação do Resto do Mundo e Mercado Global (Requisito Crítico)
- **A base de dados completa (1.880+ clubes e dezenas de milhares de jogadores) NÃO PODE ser excluída do save.**
- Apenas os clubes selecionados para o campeonato personalizado disputam as rodadas da liga ativa.
- Os demais clubes continuam existindo no SQLite com status `REST_OF_WORLD` (sem jogos de liga detalhados).
- **Mercado Global 100% Funcional:** O jogador continua podendo pesquisar qualquer jogador do planeta, contratar promessas de países periféricos, enviar olheiros mundiais e negociar empréstimos e compras com clubes de fora da liga.
- **Modos de Duração:**
  - *Tiro Curto:* Disputa uma temporada/edição até o título e encerra.
  - *Carreira Contínua:* Temporadas infinitas com virada de ano, acesso e descenso entre as divisões customizadas, envelhecimento, evolução e novas janelas de transferência.

---

## 3. Arquitetura e Modelagem Técnica

### 3.1 `@tactical-arena/shared` (`packages/shared/src/domain/customChampionship.ts`)
Criar o módulo de domínio com tipos e funções puras:
```ts
export type TournamentFormatType = 
  | 'LEAGUE_PURE'
  | 'LEAGUE_WITH_PLAYOFFS'
  | 'CUP_KNOCKOUT'
  | 'CUSTOM_PYRAMID';

export interface CustomPlayoffConfig {
  qualifyingSpots: 4 | 8;
  tieFormat: 'SINGLE_LEG' | 'TWO_LEGGED';
  hasThirdPlaceMatch: boolean;
  neutralFinal: boolean;
}

export interface CustomDivisionConfig {
  division: number;
  name: string;
  clubIds: string[];
  roundsFormat: 'SINGLE' | 'DOUBLE';
  promotionCount: number;
  relegationCount: number;
  playoffs?: CustomPlayoffConfig;
}

export interface CustomCupConfig {
  name: string;
  clubIds: string[];
  tieFormat: 'SINGLE_LEG' | 'TWO_LEGGED';
}

export interface CustomChampionshipConfig {
  id: string;
  name: string;
  formatType: TournamentFormatType;
  divisions: CustomDivisionConfig[];
  cup?: CustomCupConfig;
  settings: {
    isContinuousCareer: boolean;
    allowTransfers: boolean;
    injuriesAndSuspensions: boolean;
  };
}

// Funções puras:
export function generatePlayoffBracket(standings: LeagueTableEntry[], config: CustomPlayoffConfig): PlayoffBracket;
export function advancePlayoffRound(bracket: PlayoffBracket, results: MatchResult[]): PlayoffBracket;
export function generateCustomCupBracket(clubIds: string[], config: CustomCupConfig): CupBracket;
export function validateCustomChampionshipConfig(config: CustomChampionshipConfig): { valid: boolean; errors: string[] };
```

### 3.2 Backend & SQLite (`packages/server/src/services/customChampionshipService.ts`)
- Criar a rotina para inicializar um novo save customizado:
  - Clona `template.db` para `saves/<saveId>.db`.
  - Associa os `clubIds` escolhidos às ligas/divisões criadas na tabela `League`.
  - Configura os calendários dos clubes participantes (`LeagueFixture[]`).
  - Para clubes não escolhidos: define suas ligas como inativas ou remove do agendamento de partidas ativas, mantendo registros de `Club` e `Player` intactos para consulta do mercado e olheiros.

### 3.3 Suporte Offline (`packages/web/src/api/localEngine.ts` e `client.ts`)
- Implementar `localCreateCustomChampionship(config, userClubId)` e `localGetCustomChampionshipState()` no `localEngine.ts` para que o modo funcione 100% no cliente sem depender do servidor HTTP.

### 3.4 Interface Web (`packages/web/src/pages/CustomChampionshipWizard.tsx`)
Criar o Wizard com 4 etapas:
1. **Etapa 1 - Estrutura:** Escolha do formato (Pontos Corridos, Com Playoffs, Copa ou Pirâmide com Divisões) e quantidade de clubes/vagas.
2. **Etapa 2 - Seleção de Clubes:** 
   - Barra superior com botões de Presets rápidos ("Top 20 Mundial", "Gigantes Brasileiros", etc.) e botão "+ Adicionar País Inteiro".
   - Cards/Listas das divisões criadas com contagem de clubes (ex: 16/16).
   - Campo de busca para adicionar ou trocar clubes avulsos com badges de país e estrelas.
3. **Etapa 3 - Escolha do Clube do Jogador:**
   - Seleção do clube que o técnico vai comandar dentre os participantes.
4. **Etapa 4 - Confirmação e Regras:**
   - Opção de Tiro Curto vs Carreira Contínua e botão "Iniciar Campeonato".

### 3.5 Telas de Acompanhamento
- **Classificação & Tabela:** Visualização das rodadas e tabela de pontos.
- **Árvore de Playoffs / Copa:** Componente visual de chaveamento (Quartas $\rightarrow$ Semis $\rightarrow$ Final) mostrando os classificados e placares agregados.

---

## 4. Plano de Testes e Validação Obrigatória
Seguindo as regras do projeto (`AGENTS.md`):
1. **Testes Unitários no Shared:**
   - `packages/shared/src/domain/customChampionship.test.ts`:
     - Validação de configurações válidas e inválidas.
     - Geração de confrontos de pontos corridos com turno único e duplo.
     - Montagem e avanço de chaveamento de playoffs (top 4 e top 8).
     - Montagem e avanço de copas eliminatórias (8, 16 e 32 clubes).
2. **Testes do LocalEngine / Web:**
   - `packages/web/src/api/localEngine.test.ts`:
     - Criação e avanço de rodadas em campeonato personalizado offline.
3. **Garantir 100% Verde:**
   - `npm run test -w packages/shared`
   - `npm run test -w packages/web`
   - `npm run test -w packages/server`
   - `npm run build -w packages/web`
