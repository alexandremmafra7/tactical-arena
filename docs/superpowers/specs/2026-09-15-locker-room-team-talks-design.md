# Vestiário Vivo e Preleções Táticas

## Objetivo

Adicionar hierarquia social, coesão, apoio ao treinador, insatisfação por minutos e preleções contextuais com o mesmo comportamento no domínio compartilhado, servidor Prisma/SQLite e motor offline. Os efeitos de preleção alteram `Player.morale`; o motor já recalcula a força a cada segmento e consome moral, portanto não será criado um segundo multiplicador de “determinação”.

## 1. Domínio compartilhado

Criar `packages/shared/src/domain/lockerRoom.ts` com os tipos e assinaturas aprovados. Adicionar `DETERMINED` a `PersonalityTrait` porque a fórmula aprovada o referencia.

### Liderança

```text
score = tenureWeeks * 0.5 + overall * 0.4 + ageBonus + personalityBonus + captainBonus
```

- idade >= 29: +15; idade >= 25: +8; abaixo: 0;
- `LEADER`: +20; `DETERMINED`: +10; demais: 0;
- capitão: +25;
- arredondar para uma casa decimal e limitar o mínimo a zero.

Ordenar por score decrescente, depois overall decrescente e id crescente para desempate. Os dois primeiros com score >= 70 são `TEAM_LEADER`. Nas posições 3–5, score >= 50 ou overall >= 78 produz `HIGHLY_INFLUENTIAL`. Os restantes com score >= 30 são `INFLUENTIAL`; abaixo disso, `GENERAL_SQUAD`.

`happiness` é a média arredondada de moral e compromisso, limitada a 0–100. A preocupação “Insatisfeito com poucos minutos em campo” aparece quando compromisso < 50.

A assinatura aprovada não informa país do clube nem origem da base. A classificação social será determinística e sem schema adicional:

- `CORE_VETERANS`: idade >= 29 ou tenure >= 104 semanas;
- `ACADEMY_PROSPECTS`: idade <= 21;
- `FOREIGN_PLAYERS`: nacionalidade diferente da nacionalidade modal do elenco;
- `GENERAL_GROUP`: demais.

### Coesão e apoio

Coesão começa em 70, considera no máximo cinco resultados recentes (+3 por vitória, -4 por derrota), e fica entre 10 e 100. Para aplicar as penalidades com a assinatura aprovada, a função deriva a hierarquia, seleciona em ordem determinística até `activeConcernsCount` atletas com felicidade < 50 e cobra -8 por líder, -4 por altamente influente e -2 pelos demais. Preocupações excedentes são tratadas como elenco geral (-2).

Apoio ao treinador é `45% * média dos líderes + 35% * média dos altamente influentes + 20% * média dos demais`. Quando uma faixa não existe, usar a média geral para ela. A atmosfera usa a média entre coesão e apoio: >=85 `EXCELLENT`, >=70 `GOOD`, >=50 `NORMAL`, >=30 `DISRUPTED`, abaixo `CRITICAL`.

### Preleções

IDs são estáveis: `${context}:${tone}`. Todas as quatro opções são retornadas, mas `expectedImpact` explica o contexto de placar/final.

- `PASSIONATE`: +8 para `AGGRESSIVE`, `DETERMINED` ou `LEADER`; +4 para os demais.
- `CALM`: +6 para idade <=22 ou moral <50; +2 para os demais.
- `DEMANDING`: +10 quando o time é favorito (`scoreDifferential >= 0`) e o apoio, derivado da média de `commitment`, é >=60; -6 quando apoio <50; 0 na faixa intermediária.
- `ENCOURAGING`: +8 quando `scoreDifferential < 0`; +3 nos demais casos.

Deltas são limitados a -10…+15. O RNG recebido define a reação agregada de modo reproduzível, sem alterar os deltas aprovados: efeito médio positivo e roll baixo gera `INSPIRED`; efeito positivo gera `FOCUSED`; efeito negativo gera `PRESSURE_OVERWHELMED`; zero gera `INDIFFERENT`.

`evaluateSquadHappinessTick` usa aparições da janela fornecida: zero aparições reduz moral e compromisso em 6; uma reduz em 3; duas ou mais não penalizam. Atletas com overall >=78 que terminam com compromisso <50 geram incidente. A função não muta a entrada.

## 2. Servidor

Adicionar `Club.lockerRoomJson` com default `{}` ao Prisma e ao `ensureSchema`. O serviço lê o clube, trata JSON ausente/corrompido como estado derivado, recalcula hierarquia a partir do elenco atual e preserva incidentes recentes.

`GET /clubs/:clubId/locker-room` exige autenticação e devolve o estado. `POST /clubs/:clubId/team-talk` exige posse, valida `talkId`, `context` e `scoreDifferential`, aplica os deltas ao `playersJson`, recalcula o estado e persiste ambos. `resolvePlayerConcern` eleva moral e compromisso do atleta em 8 e remove incidentes que mencionem o atleta; não será criada rota sem requisito de UI.

A preleção pré-jogo ou de intervalo é aplicada antes do segmento seguinte. Como `matchService` busca o clube persistido e `simulateMatchSegment` recalcula `teamStrength`, os novos valores de moral já têm efeito imediato. Não serão adicionados campos duplicados a `LiveMatchState`.

## 3. Offline e cliente

Adicionar `lockerRoomStates?: Record<string, LockerRoomState>` ao `LocalGameState`; saves antigos recebem `{}` durante healing. `localGetLockerRoom` deriva e armazena o estado por clube. `localApplyTeamTalk` usa a mesma função pura, altera moral no clube, recalcula/persiste estado e devolve `TeamTalkResult`.

`client.ts` expõe `getLockerRoom(clubId)` e `applyTeamTalk(clubId, talkId, context, scoreDifferential?)`, encaminhando ao modo ativo. O endpoint online e a função offline compartilham payload e retorno.

## 4. Interface

Criar `LockerRoom.tsx` na rota `/clubs/:clubId/locker-room`, reutilizando tokens Stadium Night. A página mostra medidores de coesão/apoio, atmosfera, faixas hierárquicas, grupos sociais, preocupações e incidentes. Adicionar o atalho ao menu de clube existente.

Criar um componente reutilizável `TeamTalkCard.tsx`. O pré-jogo aparece em `MatchBriefing`; o intervalo aparece em `LiveMatch` quando `period === 'HT'`. Cada contexto permite uma escolha, mostra a reação e desabilita nova submissão naquela montagem. O pós-jogo permanece suportado pela API e pelo domínio, mas não ganha uma terceira tela porque a etapa de UI solicitou explicitamente pré-jogo e intervalo.

## 5. Validação

Seguir RED–GREEN por camada. Rodar shared, server e web isoladamente, então build web e suíte global. Não adicionar dependências. Garantir acessibilidade básica: labels textuais, `aria-live` no feedback e medidores com `role="progressbar"`.