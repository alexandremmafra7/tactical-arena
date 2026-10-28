# 16. Deadline Day & Leilões ao Vivo de Fim de Janela (Live Auction Engine)
> **Tags:** #transfers #deadline-day #auctions #market #second-brain  
> *Data de Criação: Setembro de 2026*

---

## 🧭 1. Visão Geral e Conceito

O **Deadline Day** é o ápice da janela de transferências do **Tactical Arena FC / Elifoot Reforged**, emulando a eletricidade do último dia de mercado do futebol europeu e brasileiro (estilo *Sky Sports News* e *Fabrizio Romano*).

`
[ Início: 12h ] ──► [ 8h ] ──► [ 4h: Panic Sell ] ──► [ 2h ] ──► [ 1h: Anti-Sniping ] ──► [ 0h: Fechamento & Liquidação ]
`

---

## ⚙️ 2. Regras e Mecânica do Motor de Leilão (@tactical-arena/shared)

Localizado em [packages/shared/src/domain/deadlineDay.ts](file:///d:/Code/elifoot-reforged/packages/shared/src/domain/deadlineDay.ts):

### 2.1. Progressão Horária e Horários Oficiais
* **Horas do Deadline:** DEADLINE_HOURS = [12, 8, 4, 2, 1, 0].
* Cada clique em avançar transiciona para o próximo horário de fechamento.

### 2.2. Regras de Lances
* **Lance de Abertura:** Deve ser no mínimo igual ao minimumBid do leilão.
* **Lances Concorrentes (Raise Rule):** Devem ser no mínimo **5% superiores** ao maior lance atual, arredondados para múltiplos de 1.000:
  \text{nextMinBid} = \lceil (\text{currentBid} \times 1.05) / 1000 \rceil \times 1000
* **Validação de Orçamento:** O comprador deve ter saldo disponível em caixa.
* **Proibição de Auto-Lance:** O vendedor e o líder atual não podem dar lances sobre suas próprias ofertas.

### 2.3. Vendas em Pânico (*Panic Sell*)
* A partir das 4h, 2h e 1h restantes, jogadores listados sem propostas podem entrar em liquidação com descontos automáticos de **15% a 30%** no lance mínimo (minimumBid), **sem** desvalorizar o marketValue fixo do atleta.

### 2.4. Compras Desesperadas da IA (*Panic Buy*)
* Clubes da IA com carências graves em posições específicas entram na disputa agressiva nas horas finais, gerando guerra de lances e alimentando o feed de *Breaking News*.

### 2.5. Liquidação Atômica (*Settlement*)
* Às 0h, o leilão encerra. O jogador é transferido para o time do maior lance, o vendedor recebe o valor em caixa e o comprador tem o saldo deduzido atomicamente, sem risco de duplicidade ou fundos perdidos.

---

## 🎨 3. Interface Visual Stadium Night (TransfersHub.tsx)

* **HUD Superior Neon:** Contador regressivo com badge pulsante ⏳ 4h RESTANTES.
* **Breaking News Ticker:** Feed dinâmico com notícias de última hora (*🚨 Flamengo cobre lance por atacante...*).
* **Quadro de Panic Buy:** Lista de clubes rivais desesperados por posições e verbas disponíveis.
* **Cards de Leilão:**
  * Badge de desconto *-20% PANIC SELL*.
  * Histórico em tempo real de lances.
  * Botão de 1 clique ⚡ Cobrir Lance (+5%) e modal para lances livres.

---

## 💾 4. Persistência & Paridade

* **Server (packages/server)**: Armazenado em GameState.deadlineDayJson via Prisma / SQLite com migração automática via ensureSchema.ts.
* **Offline (packages/web/src/api/localEngine.ts)**: Persistido no LocalGameState.deadlineDayState em localStorage, permitindo jogar o encerramento da janela sem conexão.
