# 15. Sala de Troféus, Galeria de Campeões & Hall da Fama (Record Books)
> **Tags:** #trophy-room #hall-of-fame #records #reputation #second-brain  
> *Data de Criação: Setembro de 2026*

---

## 🧭 1. Visão Geral e Propósito

O sistema de **Sala de Troféus & Hall da Fama** adiciona profundidade esportiva, legado histórico e fator replay imersivo ao **Tactical Arena FC**. Permite que técnicos e clubes imortalizem suas glórias, conquistas, grandes goleadas e atletas históricos (inclusive ex-jogadores e aposentados).

\\\
[ Títulos & Conquistas ] ──────► [ Sala de Troféus 3D ] ──────► [ Reputação do Clube & Técnico ]
[ Partidas & Feitos ]    ──────► [ Livro de Recordes ]   ──────► [ Maior Compra, Venda & Goleada ]
[ Gols / Assist / Jogos] ──────► [ Hall da Fama (Pódio)] ──────► [ Top 3 Ouro, Prata e Bronze ]
\\\

---

## 🏛️ 2. Arquitetura e Modelagem de Dados

### 2.1. Modelos no Domínio Compartilhado (\@tactical-arena/shared\)

Localizado em [\packages/shared/src/domain/trophyRoom.ts\](file:///d:/Code/elifoot-reforged/packages/shared/src/domain/trophyRoom.ts):

* **TrophyTier**:
  * \WORLD\: Mundial de Clubes e Super Mundial Quadrienal.
  * \CONTINENTAL\: Libertadores, Champions League e Copa Sul-Americana.
  * \NATIONAL\: Brasileirão Série A/B/C/D, Copa do Brasil e Supercopas Nacionais.
  * \REGIONAL\: Campeonatos Estaduais e Copas Regionais.
* **TrophyEntry**: Registro com ID da taça, temporada/ano, nome da competição, vice-campeão, placar da final, técnico campeão e artilheiro.
* **TrophyVisualSpec**: Especificação visual com paleta em degradê Stadium Night, badges com glow, emoji e cor de borda néon.
* **ClubRecordBook**:
  * \highestTransferFeeReceived\: Maior venda da história do clube.
  * \highestTransferFeePaid\: Maior compra da história do clube.
  * \iggestWin\: Maior goleada aplicada (placar, adversário, data e campeonato).
  * \longestUnbeatenStreak\: Maior sequência invicta histórica.
  * \currentUnbeatenStreak\: Sequência invicta em andamento.
  * \llTimeTopScorers\: Top 3 artilheiros históricos do clube.
  * \llTimeTopAssisters\: Top 3 líderes em assistências.
  * \llTimeMostAppearances\: Top 3 jogadores com mais partidas disputadas.

---

## ⚖️ 3. Sistema Calibrado de Reputação (\REPUTATION_WEIGHTS\)

A cada título conquistado, a reputação do clube e a do técnico são aumentadas dinamicamente:

| Tipo de Competição | Ganho Clube | Ganho Técnico | Exemplo |
| :--- | :--- | :--- | :--- |
| \WORLD_CUP_CLUB\ / \SUPER_WORLD_CUP\ | +150 | +120 | Super Mundial FIFA |
| \CONTINENTAL_CUP_1\ | +100 | +80 | Libertadores / Champions League |
| \CONTINENTAL_CUP_2\ | +60 | +50 | Copa Sul-Americana / Europa League |
| \NATIONAL_LEAGUE_1\ | +80 | +70 | Brasileirão Série A / Premier League |
| \NATIONAL_CUP\ | +50 | +40 | Copa do Brasil / FA Cup |
| \NATIONAL_LEAGUE_2\ | +40 | +30 | Série B |
| \STATE_CHAMPIONSHIP\ | +20 | +15 | Paulistão / Carioca |

---

## 🖥️ 4. Interface Stadium Night & Experiência de Usuário

* **Prateleira de Troféus 3D (\TrophyRoom.tsx\)**:
  * Grid responsivo com filtros rápidos \[ Todos | Mundial | Continental | Nacional | Regional ]\.
  * Cards com efeito metálico/holográfico e iluminação de estádio à noite.
* **Pódio do Hall da Fama**:
  * Medalhas dinâmicas 🥇 Ouro, 🥈 Prata e 🥉 Bronze.
  * Abas para alternar entre \[ ⚽ Gols | 👟 Assistências | 🛡️ Partidas ]\.
* **Mural de Recordes Esportivos & Financeiros**:
  * Cards informativos de maior venda, compra e goleada com badges temáticos.

---

## 🔄 5. Paridade de Armazenamento (Server & Offline)

* **Server (\packages/server\)**: Colunas JSON \	rophiesJson\ e \ecordBookJson\ em \Club\ e \Manager\ no SQLite / Prisma. Migração retrocompatível em \ensureSchema.ts\.
* **Offline (\packages/web/src/api/localEngine.ts\)**: Armazenamento idempotente em \LocalGameState\, acessível tanto via web quanto pelo executável desktop sem necessidade de conexão.
