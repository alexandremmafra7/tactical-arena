# 20. Especificação Mestre: Multiplayer P2P, Salas Hospedadas & Mini-Torneios
> **Tags:** `#multiplayer` `#p2p` `#webrtc` `#mini-torneios` `#draft` `#online` `#stadium-night`  
> *Data de Criação: 17 de Outubro de 2026*  
> *Classificação: Segundo Cérebro / ORÁCULO / Tactical Arena FC*

---

## 📡 1. Diagnóstico da 1ª Tentativa (Post-Mortem Técnico)

A primeira tentativa de modo online no Tactical Arena FC falhou por três motivos fundamentais de rede e arquitetura:

1. **Barreira de CGNAT & Falta de Port Forwarding:**
   * Usuários domésticos no Brasil estão sob CGNAT de operadoras de internet.
   * Abrir um servidor local na porta `3979` não permitia conexões externas sem IP público fixo ou configuração manual de portas no roteador.
2. **Servidor Monolítico Pesado para Sessões Curtas:**
   * O backend foi construído para gerenciar um banco SQLite/Prisma permanente com 1.800 clubes, transferências e histórico profundo.
   * Sessões online de amigos precisam de estado efêmero e volátil que exista apenas durante a partida.
3. **Comunicação Baseada em HTTP REST Síncrono:**
   * Requisições HTTP comuns causavam desincronização de telas e travamentos quando dois técnicos tomavam decisões simultâneas.

---

## 🌐 2. A Arquitetura Definitiva: P2P com WebRTC DataChannel

A solução padrão da indústria para jogos independentes (sem custo de infraestrutura na nuvem e sem necessidade de abrir portas no modem) é a conexão **Peer-to-Peer (P2P)** via **WebRTC**:

```
 [ HOST / CRIADOR ]                                          [ CLIENT / AMIGO ]
 • Clica em "Criar Sala"                                     • Digita o código "GOL-784"
 • Recebe o código "GOL-784"                                 • Conecta instantaneamente
         │                                                           │
         ▼                                                           ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │ 📡 SINALIZADOR GRATUITO DE ENCONTRO (PeerJS Cloud / STUN Google)      │
   │ (Fura NAT e firewalls de roteadores em menos de 1 segundo)            │
   └───────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
         🔗 CONEXÃO DIRETA P2P ESTABELECIDA (WebRTC DataChannel)
         • Latência ultrabaixa (<30ms)
         • O Host roda o Motor Tático e transmite os eventos
         • O Cliente envia escalação, substituições e táticas
```

---

## 🎮 3. Formatos dos Mini-Jogos & Mini-Torneios Online

O segredo do sucesso do modo online no estilo Brasfoot é a **agilidade (partidas de 10 a 25 minutos)** em vez de ligas longas de 38 rodadas:

### 3.1. ⚔️ Duelo Direto 1v1 (Ida e Volta ou Melhor de 3) — *10 Minutos*
* Dois amigos escolhem seus clubes ou seleções nacionais.
* **Cronômetro Tático:** 60 segundos para definir escalação inicial e postura tática.
* **Transmissão Simultânea:** Ambos acompanham o visualizador ao vivo com a mesma linha do tempo, narração de lances e chat de reações em tempo real.

### 3.2. 🏆 Mini Torneio Mata-Mata (4 a 8 Jogadores) — *15 a 20 Minutos*
* **Chaveamento Automático:** Quartas de Final $\rightarrow$ Semifinais $\rightarrow$ Grande Final.
* Se houver menos de 8 jogadores humanos, o Host preenche as vagas restantes com bots da máquina.
* Todas as partidas de cada fase acontecem em paralelo. Ao término de cada jogo, os vencedores avançam automaticamente para a próxima chave.

### 3.3. 🎲 Modo Fantasy Draft (Copa das Estrelas) — *15 Minutos*
* **Draft em Turnos (Snake Draft):**
  * Rodada 1: Jogador A escolhe atacante de elite (ex: Vini Jr); Jogador B escolhe Mbappé; Jogador C escolhe Haaland.
  * Rodadas 2 a 5: Escolha dos meias, zagueiros e goleiros em ordem invertida.
* Com os elencos montados em 3 minutos, inicia-se o torneio mata-mata direto!

---

## 📦 4. Protocolo Leve de Mensagens P2P

As trocas de dados entre Host e Clientes ocorrem via JSON enxuto:

| Mensagem | Direção | Payload / Descrição |
|---|---|---|
| `JOIN_LOBBY` | Cliente $\rightarrow$ Host | `{ playerName, selectedClubId, avatar }` |
| `LOBBY_STATE` | Host $\rightarrow$ Todos | `{ roomCode, participants, tournamentType, readyStatus }` |
| `SUBMIT_TACTIC` | Cliente $\rightarrow$ Host | `{ clubId, lineup, mentality, pressing, roles }` |
| `MATCH_START` | Host $\rightarrow$ Todos | `{ matchId, homeClub, awayClub, seed }` |
| `MATCH_TICK` | Host $\rightarrow$ Todos | `{ minute, score, events: [goal, card, sub], xG }` |
| `TACTICAL_SUB` | Cliente $\rightarrow$ Host | `{ inPlayerId, outPlayerId, newFormation }` |
| `CHAT_REACTION` | Qualquer $\rightarrow$ Todos | `{ sender, emoji, text }` |

---

## 🛠️ 5. Roteiro de Implementação do Modo Online

O modo online será ativado como o **Passo 21 do Roadmap**, com os seguintes marcos:

1. **Março 1: Conector WebRTC & Lobby (`packages/shared/src/domain/onlineLobby.ts`):**
   * Gerador de códigos amigáveis de 6 caracteres (ex: `ARENA-882`).
   * Biblioteca P2P integrada no frontend com suporte a STUN/TURN público.
2. **Março 2: Sincronização do Motor em Tempo Real (`packages/web/src/lib/p2pSync.ts`):**
   * Motor de simulação autoritativo rodando no Host e despachando ticks via DataChannel.
3. **Março 3: Interface da Sala Online (`packages/web/src/pages/OnlineMultiplayerPage.tsx`):**
   * Sala de espera Stadium Night, visualizador da chave de mata-mata online e chat de zoeira/comemoração.
