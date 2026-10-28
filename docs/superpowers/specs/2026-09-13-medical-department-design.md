# Departamento Médico e Prevenção Automática de Lesões

## Objetivo

Implementar o Item 3 do roadmap com três capacidades conectadas: previsão de risco de lesão antes da partida, proteção do onze inicial com um clique e reabilitação automática após partidas e transições semanais.

A solução reutiliza `FITNESS_COACH`, `StaffDelegationConfig`, `NewsItem` e os fluxos de escalação já existentes. Não cria uma nova função de comissão técnica, uma nova caixa de entrada ou uma segunda representação de fadiga.

## 1. Domínio compartilhado

Criar `packages/shared/src/domain/medicalDepartment.ts` e exportá-lo por `packages/shared/src/index.ts`.

### Tipos públicos

```ts
export type InjuryRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface InjuryRiskResult {
  riskPercentage: number;
  riskLevel: InjuryRiskLevel;
  description: string;
}

export interface SquadInjuryAlert extends InjuryRiskResult {
  playerId: string;
  playerName: string;
  isStarter: boolean;
  suggestion: string;
}

export type MedicalCareMode =
  | 'auto_fastest'
  | 'auto_balanced'
  | 'manual_medical_clinic';

export interface MedicalRecovery {
  playerId: string;
  playerName: string;
  previousInjuryWeeks: number;
  injuryWeeks: number;
  weeksReduced: number;
}

export interface MedicalCareResult {
  club: Club;
  recoveries: MedicalRecovery[];
}
```

### `calculatePlayerInjuryRisk`

```ts
export function calculatePlayerInjuryRisk(
  player: Player,
  matchStamina = 100,
  isRain = false,
): InjuryRiskResult;
```

Regras:

1. Limitar `matchStamina` ao intervalo de 0 a 100.
2. Calcular resistência física pela média dos valores numéricos disponíveis em `STAMINA`, `AEROBIC_STAMINA` e `STRENGTH_STAMINA`. Se nenhum existir em um save antigo, usar `player.attributes.physical`.
3. Aplicar risco-base por condição:
   - 70 ou mais: 10;
   - 50 a 69: 35, com nível mínimo `MODERATE`;
   - 30 a 49: 60, com nível mínimo `HIGH`;
   - abaixo de 30: 85, com nível mínimo `CRITICAL`.
4. Ajustar pela resistência com `(50 - resistance) * 0.3`, mantendo o piso do nível determinado pela condição. Assim, boa resistência reduz a porcentagem sem esconder a categoria mínima exigida pela fadiga.
5. Chuva ou gramado pesado adiciona 12 pontos percentuais.
6. Limitar o resultado final a 0–100.
7. Classificar: abaixo de 25 `LOW`, abaixo de 50 `MODERATE`, abaixo de 75 `HIGH`, e 75 ou mais `CRITICAL`, respeitando o piso de condição acima.
8. Produzir descrição curta em português com condição, resistência e impacto climático.

O parâmetro continua aceitando a condição projetada de uma partida. Os chamadores que avaliam a situação atual passam `100 - player.fatigue` explicitamente.

### `getSquadInjuryAlerts`

```ts
export function getSquadInjuryAlerts(
  squad: Player[],
  startingLineupIds: string[],
): SquadInjuryAlert[];
```

Para cada jogador, calcular a condição atual como `100 - player.fatigue`, chamar `calculatePlayerInjuryRisk` e retornar somente riscos `HIGH` ou `CRITICAL`. IDs presentes em `startingLineupIds` recebem `isStarter: true` e recomendação de substituição; os demais são tratados como opções de banco/reserva e recebem recomendação de descanso e monitoramento.

### `applyAutomatedMedicalCare`

```ts
export function applyAutomatedMedicalCare(
  club: Club,
  chiefDoctorRating = 3,
  mode: MedicalCareMode = 'auto_balanced',
): MedicalCareResult;
```

A assinatura pedida é preservada. `chiefDoctorRating` é uma abstração de eficácia médica entre 1 e 5. Os chamadores convertem o `FITNESS_COACH.rating` de 50–99 para essa escala com faixas determinísticas: 50–59 → 1, 60–69 → 2, 70–79 → 3, 80–89 → 4, 90–99 → 5. Sem preparador físico, usar o padrão 3.

Regras de redução adicional:

- `manual_medical_clinic`: nenhuma alteração;
- `auto_balanced`: 1 semana adicional quando a avaliação é 3–5; nenhuma redução adicional em 1–2;
- `auto_fastest`: 1 semana adicional em 1–3 e 2 semanas adicionais em 4–5.

A função:

- não muta o clube recebido;
- mantém `injuryWeeks` inteiro e nunca abaixo de zero;
- retorna o clube atualizado;
- inclui em `recoveries` apenas atletas cuja recuperação foi realmente reduzida;
- registra valores anterior e posterior para notificações e testes.

Essa redução é adicional ao avanço normal já realizado pelo fluxo de partida ou semana.

## 2. Integração com delegação e notificações

O modo efetivo é `club.staffDelegationConfig ?? DEFAULT_STAFF_DELEGATION_CONFIG`. O tratamento automático ocorre quando:

- `injuryRehab === 'auto_fastest'`; ou
- `injuryRehab === 'auto_balanced'`; ou
- `presetMode === 'brasfoot_casual'`, tratado como `auto_fastest` mesmo em saves antigos com configuração parcial.

`manual_medical_clinic` não aplica redução automática, salvo quando o preset casual exige explicitamente `auto_fastest`.

Cada recuperação gera uma notícia `INJURY`:

```text
🏥 Fisioterapia: Nome do Atleta teve a recuperação reduzida em X semana(s).
```

Somente reduções positivas geram notícia. Não há notícia para no-op, jogador saudável ou tratamento manual.

### Servidor: pós-partida

Integrar no ponto único de finalização em `packages/server/src/services/matchService.ts`, depois de `updateInjuries` e antes da persistência final dos elencos. Aplicar apenas ao clube humano envolvido e publicar as recuperações por uma função pequena em `newsService.ts` que reutiliza `recordNews`.

Isso garante uma aplicação por partida concluída e cobre tanto partida acompanhada quanto resolução automática, sem colocar efeitos colaterais em `clubService.toDomain`.

### Servidor: transição semanal

Manter o caminho rápido de `weeklyTickService.ts` para clubes bot: ele continua apenas incrementando `pendingRestWeeks`.

Depois do lote, usar o caminho lento já reservado aos clubes humanos:

1. Ler somente cada clube humano com elenco materializado por `toDomain`;
2. Nesse momento, `pendingRestWeeks` já foi aplicado uma vez;
3. Aplicar tratamento médico automático uma vez;
4. Persistir `playersJson`; a extensão existente zera a dívida de descanso materializada;
5. Criar notícias para as reduções retornadas.

Não aplicar tratamento em `toDomain`: essa função pode ser chamada várias vezes para a mesma semana e causaria reduções repetidas durante simples leituras.

### Motor local/offline

`localEngine.ts` não possui tick semanal próprio; o calendário offline avança por rodada. Portanto:

- aplicar tratamento quando a partida do clube do usuário for finalizada em `localAdvanceLiveMatch`;
- também cobrir qualquer caminho local que finalize diretamente a partida do usuário sem passar pela tela ao vivo;
- atualizar o clube em `state.clubs` e inserir as notícias em `state.news` antes do único `saveLocalGameState` daquele encerramento;
- não inventar um segundo relógio semanal offline. Se um tick semanal local for criado no futuro, ele chamará a mesma função compartilhada.

## 3. Interface pré-jogo

Integrar em `packages/web/src/pages/ClubTactics.tsx`, que já controla `selections` e `substituteIds`.

### Alerta

Para cada titular selecionado, passar `100 - player.fatigue` a `calculatePlayerInjuryRisk`. Quando houver titular `HIGH` ou `CRITICAL`, exibir:

> 🏥 Alerta do Médico Chefe: X titulares estão com alto risco de lesão por fadiga acumulada.

Manter a cópia solicitada literalmente, inclusive “titulares”, para qualquer valor de X.

O alerta inclui o botão:

> ⚡ Poupar Atletas em Risco

### Troca em um clique

A ação altera somente titulares em risco, sem remontar o onze inteiro:

1. Criar cópias de `selections` e `substituteIds`.
2. Processar titulares `CRITICAL` antes de `HIGH`.
3. Para cada titular, considerar apenas substitutos disponíveis e aptos (`isPlayerAvailable`).
4. Preferir a mesma posição natural do titular; se não houver, usar o melhor substituto restante compatível com a posição do slot segundo os helpers de formação existentes.
5. Entre candidatos equivalentes, ordenar por menor fadiga e depois maior `overall`.
6. Trocar os IDs: o reserva entra no slot e o titular sai para o mesmo índice do banco, preservando tamanho e ordem tanto quanto possível.
7. Se nenhum candidato for válido para determinado slot, manter aquele titular e continuar com os demais.
8. Exibir feedback informando quantos titulares foram poupados; desabilitar o botão somente se nenhuma troca válida puder ser feita.

A ação apenas atualiza o estado editável da tela. A persistência continua nos fluxos existentes de salvar tática ou ir para a partida.

### Indicador crítico

No indicador individual de condição física, adicionar classe/badge discreto para risco `CRITICAL`. A animação pode alterar opacidade e sombra, mas deve ser removida por completo em `@media (prefers-reduced-motion: reduce)`, deixando um indicador estático. Não criar animação alternativa no modo de movimento reduzido.

## 4. Compatibilidade e falhas seguras

- Saves antigos sem `detailedAttributes` usam `attributes.physical`.
- Valores fora de faixa são limitados antes do cálculo.
- Clubes sem comissão usam avaliação médica padrão 3.
- Configuração ausente usa `DEFAULT_STAFF_DELEGATION_CONFIG`.
- Jogadores já indisponíveis não são candidatos para entrar na escalação.
- Tratamento e risco são funções puras; persistência e notícias ficam nos adaptadores servidor/local.
- Falha ao gravar uma notícia não deve desfazer a atualização já válida do elenco, seguindo a tolerância usada pelas notícias existentes.

## 5. Testes e verificação

### Testes compartilhados obrigatórios

Criar `packages/shared/src/domain/medicalDepartment.test.ts` com fixtures reais de `Player`, `Club` e `StaffMember` e IDs determinísticos. Cobrir:

- condição 70, 50, 30 e abaixo de 30;
- resistência detalhada e fallback de save antigo;
- chuva adicionando 12 pontos;
- limite 0–100;
- alertas usando `100 - fatigue` e distinguindo titular/reserva;
- exclusão de riscos `LOW` e `MODERATE`;
- cuidado manual como no-op;
- modos balanceado e mais rápido nas cinco faixas de avaliação;
- `injuryWeeks` inteiro e limitado a zero;
- imutabilidade do clube recebido;
- registros de recuperação somente quando houve redução.

### Testes de integração

Adicionar testes no nível mais estreito já disponível para:

- pós-partida do servidor: redução e notícia exatamente uma vez;
- tick semanal humano: descanso devido mais tratamento, sem alterar o caminho em lote de bots;
- motor local: clube atualizado e notícia criada após finalização;
- helper puro da troca tática, extraído apenas se isso permitir teste sem renderização pesada: preserva formação/banco e prioriza atletas frescos.

### Comandos finais

```sh
npm test
npm run build --workspace=@tactical-arena/web
```

Se o build React falhar, corrigir apenas os erros verificados e executar novamente. Após implementação, realizar revisão TypeScript, React e geral conforme o fluxo obrigatório do projeto.

## 6. Fora de escopo

- Nova função `CHIEF_DOCTOR` na comissão técnica;
- prédio ou nível de clínica médica;
- tela separada de prontuários;
- risco baseado em histórico clínico inexistente;
- alteração da probabilidade de lesão do motor de partidas;
- novo relógio semanal no modo offline;
- dependências novas.
