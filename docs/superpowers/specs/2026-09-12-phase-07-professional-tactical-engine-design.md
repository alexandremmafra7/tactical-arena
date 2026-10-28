# Fase 07 — Motor Tático Profissional

**Data:** 12 de setembro de 2026  
**Status:** desenho aprovado  
**Base:** `docs/second-brain/06_ACTIVE_ROADMAP.md` e `docs/second-brain/07_TACTICAL_ENGINE_MASTER_PLAN.md`

## Objetivo

Concluir as quatro fases do plano mestre sobre o motor atual, transformando decisões táticas em causas rastreáveis sem criar um simulador paralelo nem substituir o loop determinístico por minuto.

A entrega inclui:

- compatibilidade de formação e estilos;
- matriz contextual de duelos;
- contrapressão, recomposição e rest defence;
- química persistente e papéis individuais ativos;
- controles completos, campinho dinâmico e relatório causal;
- calibração Monte Carlo executável como gate.

## Decisão arquitetural

A implementação será incremental. `Tactic`, `TeamStrength`, `tacticalMatchup()` e `simulateMatchSegment()` continuam sendo as fontes únicas de configuração, agregação, confronto e execução.

O loop por minuto permanece. A janela de cinco segundos da contrapressão é representada como uma reação imediata à perda dentro da mesma sequência ofensiva:

```text
posse/ataque
  -> chance ou perda
  -> reação pós-perda
       -> COUNTERPRESS: recuperação ou falha
       -> RECOMPOSE: retorno ao bloco
  -> possível transição adversária
```

Esta abordagem preserva:

- determinismo por seed;
- equivalência entre simulação instantânea e segmentada;
- retomada de partidas ao vivo;
- compatibilidade com saves anteriores;
- calibração e testes já existentes.

Não será criado um segundo modelo para fabricar relatórios, pois placar e explicação precisam vir da mesma cadeia causal.

## 1. Núcleo tático

### 1.1 Cobertura dos corredores

`calculateFlankCoverage()` continuará sendo o ponto único de compatibilidade do estilo `WINGS`, mas cobertura completa passará a exigir ocupação útil dos dois lados.

Cada corredor será considerado coberto por pelo menos uma destas condições:

- lateral/ala posicionado no lado correspondente;
- atacante de lado no corredor correspondente;
- ocupação equivalente resultante de posicionamento livre.

Os multiplicadores permanecem dentro das faixas aprovadas:

- dois corredores cobertos: bônus de `1.06`;
- cobertura incompleta: penalidade de `0.88`.

Marcação permanece independente da ocupação ofensiva dos corredores.

### 1.2 Bloco, linha e rest defence

`PressingIntensity` continuará representando a altura do bloco e `DefensiveLineHeight` a linha defensiva. A matriz existente permanece contextual:

- bloco alto e linha alta favorecem recuperação avançada, com exposição a velocidade e bola longa;
- bloco baixo e linha profunda protegem as costas e cedem território;
- combinações intermediárias mantêm efeito intermediário.

A semântica de `RestDefenceModifiers.centralExposure` será corrigida. Valor menor que `1` significa menor exposição e deve aumentar a resistência efetiva ao ataque adversário; não pode reduzir a própria defesa.

`3+2` prioriza proteção central. `2+3` prioriza retenção territorial e assume vulnerabilidade adicional nos flancos. A compatibilidade continuará interpolando até o neutro quando o pessoal escolhido não sustenta a estrutura.

### 1.3 Presets canônicos

`CANONICAL_TACTIC_PRESETS` permanece como catálogo único dos oito arquétipos do plano mestre:

1. Tiki-Taka;
2. Gegenpressing;
3. Bloco Baixo & Contra-Golpe;
4. Ataque pelas Pontas;
5. Controle de Meio-Campo;
6. Ataque Total;
7. Catenaccio;
8. Transição Equilibrada.

Os IDs existentes serão preservados para não quebrar consumidores. O roadmap será ajustado aos arquétipos canônicos do plano mestre, eliminando a lista divergente de identificadores.

Na interface, os presets canônicos aparecem ao lado dos planos salvos. Aplicar um deles:

1. altera formação e controles;
2. executa o autofill já existente para montar XI e banco compatíveis;
3. mantém tudo editável antes de salvar ou entrar em campo.

## 2. Transições e custo físico

### 2.1 Reação pós-perda

Uma reação pós-perda só será avaliada após uma sequência ofensiva malsucedida. Não haverá mais uma tentativa de contrapressão incondicional por equipe a cada minuto.

Em `COUNTERPRESS`:

- o coletivo de trabalho em equipe e antecipação enfrenta primeiro toque e compostura do adversário;
- fadiga e compatibilidade da rest defence modificam a probabilidade;
- o resultado permanece limitado entre 15% e 75%;
- sucesso registra recuperação avançada e pode gerar uma chance rápida real;
- falha registra a tentativa e expõe a equipe à próxima transição adversária.

Em `RECOMPOSE`:

- não há tentativa de recuperação avançada;
- a equipe retorna ao bloco;
- não recebe a desorganização específica da contrapressão falhada.

O consumo do RNG continuará fixo entre ramos equivalentes, preservando o determinismo e evitando deslocamentos acidentais do fluxo aleatório.

### 2.2 Chance rápida

A chance imediata após recuperação deixará de estar desativada. Ela será limitada por uma probabilidade pequena, calibrada em relação à chance normal da equipe, e terá um bônus modesto de qualidade. O mecanismo não pode dobrar o volume de chutes nem ultrapassar os limites estatísticos da fase.

### 2.3 Desgaste dentro da partida

A eficiência física deixará de depender somente da fadiga pré-jogo. O motor aplicará um fator de estamina por minuto, derivado do helper fisiológico já existente, acrescido do custo da estratégia:

- pressão alta;
- contrapressão;
- ataque total;
- sobrecarga de alas;
- papel box-to-box.

O fator será recalculado na agregação de força durante a partida e após substituições. O custo pós-jogo continuará sendo aplicado uma única vez ao elenco; não haverá cobrança dupla do mesmo desgaste.

## 3. Química persistente

### 3.1 Dados

Cada jogador poderá carregar um mapa opcional e retrocompatível:

```ts
partnershipMinutes?: Record<string, number>
```

A chave é o ID do parceiro e o valor são os minutos efetivamente compartilhados em campo. Não haverá nova tabela nem migração relacional: os jogadores já são persistidos em JSON e saves antigos simplesmente começam sem histórico.

A atualização será simétrica e limitada às parcerias taticamente relevantes:

- zagueiro + zagueiro;
- volante + meia;
- dupla/trio de ataque;
- lateral + ponta do mesmo corredor.

A sobreposição real será derivada da escalação e da linha do tempo de substituições, lesões e expulsões. Jogadores fora do campo não acumulam minutos juntos.

### 3.2 Afinidade

A afinidade é normalizada de `0` a `100`:

- até 450 minutos: faixa `0–25`, com penalidade progressiva de até 10% sob pressão;
- de 451 a 1.349 minutos: adaptação progressiva;
- a partir de 1.350 minutos: faixa `75–100`, com bônus progressivo até 6% em antecipação coletiva e cobertura.

A química setorial existente continuará responsável pelos modificadores de ataque e defesa, agora combinando composição funcional e afinidade real. O relatório expõe somente modificadores realmente aplicados.

## 4. Papéis individuais ativos

`PlayerFunction` será estendido sem remover funções anteriores:

- `VOLANTE_CAO_GUARDA`: +20% em combate e faltas táticas; -15% em construção;
- `MEIA_BOX_TO_BOX`: melhora segunda bola e contrapressão; cobra desgaste adicional;
- `FALSO_NOVE`: melhora combinação central e infiltração; reduz presença em cruzamentos;
- `PONTA_INVERTIDO`: favorece drible e finalização por dentro;
- `PONTA_CLASSICO`: favorece cruzamentos e criação lateral.

`FUNCTIONS_BY_POSITION` continuará sendo o limite de atribuição. Funções incompatíveis serão recusadas pela mesma validação usada pelos papéis atuais.

Os modificadores serão aplicados dentro da agregação existente em `teamStrength.ts`. Não será criada uma segunda camada de atributos. Cada vantagem terá custo explícito, impedindo uma função estritamente dominante.

## 5. Métricas causais

`MatchSideStats`, `MatchSegmentResult` e `LiveMatchState` serão ampliados com contadores normalizados para zero em dados antigos:

- recuperações avançadas de contrapressão;
- gols originados dessas recuperações;
- contrapressões falhadas;
- contra-ataques perigosos concedidos;
- cruzamentos tentados;
- finalizações originadas pelos corredores;
- desgaste tático adicional aplicado.

As métricas são produzidas pela mesma sequência que decide o evento. Não serão inferidas por mera coincidência no mesmo minuto.

O transporte deve ser idêntico nos quatro caminhos:

1. segmentos internos de `simulateMatch()`;
2. resultado instantâneo;
3. estado e avanço de partida ao vivo no servidor;
4. motor local/offline da aplicação web.

## 6. Interface

### 6.1 Controles

`ClubTactics` e `LiveTacticalModal` expõem:

- altura da linha: `DEEP`, `BALANCED`, `HIGH`;
- reação pós-perda: `COUNTERPRESS`, `RECOMPOSE`;
- rest defence: `3+2`, `2+3`.

Carregamento, preset, edição ao vivo e salvamento devem preservar os três valores.

### 6.2 Campinho dinâmico

`PitchField` receberá propriedades opcionais para linha e estilo ofensivo e reutilizará o SVG existente:

- `DEEP`, `BALANCED` e `HIGH` deslocam um indicador visual da linha defensiva;
- `WINGS` desenha fluxos nos corredores;
- `THROUGH_MIDDLE` desenha fluxos convergentes ao centro;
- `BALANCED` mostra ambos de forma discreta.

A camada é informativa. Ela não altera coordenadas nem reposiciona jogadores. Sem biblioteca gráfica adicional.

### 6.3 Pós-jogo

`matchInsights.ts` continuará sendo o gerador único de cards. `PostMatchInsightsCard` continuará sendo o componente de exibição.

Os novos diagnósticos incluem:

- eficiência da pressão e gols decorrentes;
- exposição da linha e transições perigosas concedidas;
- produção pelos lados, com cruzamentos e finalizações;
- química setorial aplicada;
- custo físico da estratégia.

Um card só aparece quando existe evidência relevante. Textos não podem atribuir causalidade além do que o motor registrou.

## 7. Compatibilidade e validação

- Campos novos em `Player`, `Tactic`, `LiveMatchState` e estatísticas serão opcionais na leitura e normalizados em um ponto compartilhado.
- Saves antigos permanecem carregáveis sem migração manual.
- Métricas ausentes assumem zero.
- Controles táticos ausentes continuam usando os fallbacks atuais.
- Funções incompatíveis com a posição falham na fronteira de entrada.
- A mesma entrada e seed continuam produzindo a mesma partida.

## 8. Verificação

### 8.1 Testes unitários

Devem fixar:

- cobertura bilateral de `WINGS`;
- sentido correto de rest defence;
- duelos pressão/linha;
- sobreposição de minutos e faixas de afinidade;
- modificadores e custos dos cinco papéis;
- cadeia causal de contrapressão e recomposição;
- geração de cada insight causal.

### 8.2 Integração

Devem comprovar:

- comportamento dos oito presets;
- equivalência entre partida instantânea e segmentada;
- retomada de estado antigo;
- transporte integral de métricas no servidor e no motor local;
- persistência simétrica de minutos de parceria.

### 8.3 Web

Devem comprovar:

- aplicação e edição dos presets canônicos;
- carregamento e salvamento dos três controles novos;
- variação do SVG conforme linha e estilo;
- renderização condicional dos diagnósticos.

### 8.4 Gate Monte Carlo

Um script determinístico de 1.000 partidas falhará com código diferente de zero quando qualquer faixa sair dos limites aprovados:

- gols por partida: `2,40–2,90`;
- vitórias do mandante: `42–48%`;
- empates: `24–28%`;
- cartões amarelos: `3,2–4,5` por jogo.

O comando será registrado no pacote raiz para execução local e em CI. A semente e os confrontos serão fixos para evitar flutuação do gate.

## 9. Sequência de implementação

1. Criar testes falhos para defeitos do núcleo e corrigir cobertura/rest defence.
2. Tornar a reação pós-perda causal e transportar seus contadores.
3. Integrar estamina progressiva e papéis ativos.
4. Persistir minutos de parceria e aplicar química.
5. Expor presets e controles na web.
6. Desenhar indicadores no campinho e ampliar insights.
7. Conectar os caminhos servidor/local e saves antigos.
8. Executar e ajustar o gate Monte Carlo.
9. Rodar testes, build e revisões obrigatórias.
10. Atualizar `06_ACTIVE_ROADMAP.md` e `docs/fase07-progress.md` somente quando tudo estiver verde.

## 10. Fora de escopo

- simulação evento a evento de passes e duelos;
- relógio subminuto real;
- novo framework gráfico;
- nova dependência de runtime;
- reescrita do motor ou da persistência;
- vídeo de análise pós-jogo;
- abstrações preparadas para futuras fases não requisitadas.

## Critério de conclusão

A Fase 07 estará concluída quando todas as quatro fases do plano mestre estiverem representadas no produto, os relatórios forem sustentados por métricas causais, os caminhos instantâneo e ao vivo permanecerem equivalentes, saves antigos carregarem normalmente, o gate Monte Carlo passar e o build completo finalizar com código zero.