# Sala de Troféus, Galeria de Campeões e Hall da Fama — Design

**Data:** 2026-09-14  
**Projeto:** Tactical Arena FC / Elifoot Reforged  
**Status:** Aprovado para planejamento

## Objetivo

Eternizar as conquistas do clube e do treinador em uma página Stadium Night que reúna troféus, ídolos e recordes históricos. O sistema registrará somente eventos ocorridos após esta atualização e terá paridade entre servidor e modo desktop/offline.

## Decisões aprovadas

- Registrar somente novos títulos; não reconstruir conquistas de temporadas antigas.
- Manter ex-jogadores e aposentados nos rankings históricos.
- Persistir três líderes em gols, assistências e partidas.
- Persistir reputação separada para clube e técnico, com pesos por competição.
- Usar modelos Prisma próprios no servidor.
- Atualizar o histórico incrementalmente a partir de partidas, transferências e encerramentos de competições.
- Incluir maior sequência invicta e sequência atual.
- Oferecer paridade completa no `localEngine`.
- Contabilizar partidas por jogador somente quando houver uma escalação registrada. Partidas de CPU sem escalação não serão estimadas.
- Adotar a composição visual “Painel equilibrado”: troféus, Hall da Fama e recordes compartilham a primeira visão.

## Arquitetura

### Domínio compartilhado

`@tactical-arena/shared` exporá tipos e funções puras para aplicar eventos históricos. Essas funções não acessarão Prisma nem armazenamento local. O servidor e o `localEngine` usarão os mesmos reducers e persistirão o resultado em adaptadores próprios.

Tipos principais:

- `CompetitionType`: liga, copa nacional, Libertadores, Sul-Americana, Champions League, Europa League, Conference League, Intercontinental e Mundial de Clubes.
- `TrophyEntry`: snapshot da conquista, incluindo identificadores da competição e temporada, clube, técnico, vice-campeão, artilheiro e ícone.
- `HistoricalPlayerRankingEntry`: snapshot do jogador com identificador, nome, era e total.
- `ClubRecordBook`: top 3 de gols, assistências e partidas; maior compra; maior venda; maior goleada; sequência invicta recorde e sequência atual.
- Eventos discriminados para partida, transferência e título. Eventos desconhecidos serão rejeitados.

`recordTournamentChampion` receberá o estado histórico e um troféu, recusará duplicidades e retornará um novo estado com o troféu e os incrementos de reputação. `updateClubRecords` aplicará um evento tipado e retornará o livro atualizado sem mutar o valor de entrada.

### Persistência do servidor

Serão criados modelos Prisma próprios para:

1. troféus;
2. vínculo de títulos ao currículo do técnico;
3. totais históricos por jogador e clube;
4. recordes esportivos e financeiros do clube.

A persistência conservará snapshots de nomes e era, evitando que vendas, aposentadorias ou mudanças posteriores de nome apaguem a história. Uma chave única formada por competição, edição/temporada e clube campeão tornará a gravação idempotente.

Os novos campos e tabelas seguirão o mecanismo de compatibilidade adotado pelo projeto em `ensureSchema.ts`, além do schema Prisma. Saves existentes iniciarão com histórico vazio.

### Persistência offline

O save do `localEngine` receberá estruturas equivalentes para troféus, currículo do técnico, totais históricos e recordes. A forma serializada poderá diferir das tabelas Prisma, mas será derivada dos mesmos tipos compartilhados e produzirá a mesma resposta de API.

## Fluxos de atualização

### Partida encerrada

O ponto central de encerramento da partida emitirá um evento para cada clube:

- gols e assistências creditados aos jogadores identificados no resultado;
- partida creditada somente aos jogadores de uma escalação persistida;
- placar avaliado para maior goleada aplicada;
- vitória ou empate incrementa a sequência invicta atual;
- derrota zera a sequência atual;
- uma sequência atual acima do máximo atualiza o recorde histórico.

O processamento usará uma identidade estável de evento para impedir que a mesma partida seja contabilizada mais de uma vez.

### Transferência concluída

Somente transferências efetivamente concluídas gerarão eventos:

- o vendedor poderá atualizar sua maior venda;
- o comprador poderá atualizar sua maior compra;
- proposta recusada, cancelada ou ainda pendente não altera recordes.

O snapshot guardará jogador, valor, clube contraparte e ano da temporada do jogo.

### Competição encerrada

Liga nacional, copa nacional e competições continentais/mundiais chamarão um único serviço de conquista. Em uma transação, ele:

1. grava o troféu;
2. vincula o título ao currículo do técnico que comandava o campeão no encerramento;
3. incrementa a reputação do clube e do técnico conforme o tipo da competição;
4. atualiza `titlesWon` exatamente uma vez;
5. preserva vice-campeão, técnico e artilheiro como snapshots;
6. mantém premiação financeira e notícias já existentes.

O serviço consolidará os incrementos hoje espalhados pelos encerramentos para eliminar contagem duplicada. Se a competição não produzir campeão válido, nenhum título será gravado.

### Pesos de reputação

Os pesos ficarão em uma tabela constante no domínio, sem sistema de configuração adicional. Competições mundiais terão o maior peso, seguidas por continentais, liga nacional e copa nacional. Ambos os scores respeitarão os limites válidos já usados pelo domínio do projeto.

## API

### `GET /clubs/:clubId/trophy-room`

Retorna:

- troféus ordenados por temporada decrescente e agrupáveis por competição;
- top 3 de gols, assistências e partidas;
- maior compra, maior venda, maior goleada e invencibilidade;
- reputação histórica do clube.

Um clube sem dados recebe coleções vazias e recordes nulos, não erro.

### `GET /career/trophy-room`

Retorna:

- currículo do técnico autenticado;
- títulos agrupados por clube e temporada;
- reputação atual do técnico.

Não haverá endpoints públicos para alterar o histórico. Somente os serviços internos do jogo poderão escrevê-lo. As rotas de clube respeitarão as regras existentes de visibilidade; o currículo será limitado ao usuário autenticado.

O `localEngine` implementará contratos equivalentes para que os mesmos componentes React funcionem nos dois modos.

## Interface Stadium Night

A página `/clubs/:clubId/history` receberá a seção “Sala de Troféus & História”. A primeira visão será equilibrada em três blocos.

### Prateleira de Troféus

- cards com relevo dourado, prateado ou identidade continental;
- ícone, competição, temporada, técnico, vice e artilheiro;
- títulos mais recentes primeiro;
- filtros por era e competição;
- agrupamentos repetidos poderão apresentar contagem sem esconder as edições individuais.

### Quadro de Honra

- abas para gols, assistências e partidas;
- pódio com os três maiores jogadores;
- nome, posição no ranking, total e era;
- ex-jogadores e aposentados continuam visíveis.

### Mural de Recordes

Cards para:

- maior compra;
- maior venda;
- maior goleada;
- maior sequência invicta;
- sequência invicta atual.

### Responsividade e acessibilidade

No mobile, os blocos serão empilhados em uma coluna. Prateleiras e pódios usarão rolagem horizontal interna sem causar rolagem horizontal na página. Filtros e abas terão foco visível, nomes acessíveis e operação por teclado. O contraste seguirá o tema Stadium Night e animações decorativas respeitarão `prefers-reduced-motion`.

Estados vazios explicarão que somente conquistas e recordes posteriores à atualização serão registrados.

## Consistência e tratamento de erros

- Transações impedem gravações parciais no encerramento de competições.
- Restrições únicas e identificadores de evento impedem reprocessamento.
- Valores financeiros e contadores devem ser finitos e não negativos.
- Eventos inválidos falham explicitamente; não serão ignorados silenciosamente.
- Falhas em notícia decorativa não revertem uma conquista persistida, preservando o comportamento já existente.
- O histórico guarda snapshots e não depende da permanência do jogador ou técnico no clube.

## Testes e verificação

### Shared

`packages/shared/src/domain/trophyRoom.test.ts` cobrirá:

- registro de troféu e idempotência;
- pesos e limites de reputação;
- ordenação e retenção do top 3;
- gols, assistências e partidas;
- maior compra e venda;
- maior goleada;
- sequência invicta atual e histórica;
- validação de eventos.

### Server

Testes de serviço cobrirão:

- encerramento de liga;
- encerramento de copa nacional;
- encerramento continental e mundial;
- vínculo com o técnico vigente;
- transação e reprocessamento idempotente;
- incremento único de `titlesWon`;
- registros gerados por partidas e transferências.

### Offline e Web

- testes do `localEngine` verificarão paridade dos contratos e persistência no save;
- testes React cobrirão carregamento, estado vazio, filtros, abas, pódios e renderização dos recordes;
- uma verificação responsiva confirmará que a página não cria rolagem horizontal global.

### Comandos finais

- executar `npm test` no monorepo;
- compilar `packages/shared`;
- compilar `packages/server` como dependência da integração;
- compilar `packages/web`.

## Fora do escopo

- reconstruir títulos ou recordes de saves anteriores;
- estimar escalações de clubes CPU para atribuir partidas individuais;
- permitir edição manual do histórico;
- criar um sistema configurável de pesos de reputação;
- armazenar imagens de jogadores exclusivamente para o Hall da Fama.