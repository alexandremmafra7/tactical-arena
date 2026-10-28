# 08. Direitos de Transmissão & Economia de Mídia (Broadcast Rights)
> **Tags:** `#financas` `#broadcast` `#gameplay-loop` `#economia` `#neo-myth`

---

## 📺 1. Visão Geral e Propósito

Transformação dos **Direitos de Transmissão e Canais de Mídia** de um elemento estético em um **mecanismo econômico e estratégico central**:
- Geração de receita recorrente por visibilidade em partidas televisionadas.
- Metas contratuais de audiência por temporada (`BroadcastTarget`) com bônus e repercussão no feed de notícias.
- Integração plena ao motor de simulação (`matchService.ts`), contabilidade (`financeService.ts`) e interface pós-jogo (`MatchResult.tsx`).

---

## 📐 2. Regras de Negócio & Rateio de Cota (*Facility Fee*)

### A. Rateio por Partida Transmitida
- **TV Aberta / Pay-TV Nobre (OmniSports HD, SkyLine Sports, Vertex Premium, Aura Broadcast):**
  - **Mandante:** **65%** do `facilityFeeBonus` (direitos de arena, custos operacionais e infraestrutura).
  - **Visitante:** **35%** do `facilityFeeBonus` (participação na atratividade e audiência).
- **Streaming Global & PPV (NovaPlay+, Zenith Premiere, Pulse Live):**
  - **50% / 50%** dividido em partes iguais entre os dois clubes.
- **Transmissão Local / Sem Emissora Nobre:** Sem repasse de *Facility Fee*.

### B. Liquidação Atômica no Pós-Jogo
Em `packages/server/src/services/matchService.ts` (`applyBroadcastFacilityFeeAfterMatch`), assim que a partida é encerrada (simulação instantânea ou live tick), os orçamentos `homeClub.budget` e `awayClub.budget` são incrementados atomicamente.

---

## 🎯 3. Avaliação de Metas de Audiência (`evaluateBroadcastTargets`)

Função determinística pura em `packages/shared/src/domain/broadcastRights.ts`:

```typescript
export interface BroadcastEvaluationContext {
  leaguePosition?: number;
  totalClubsInLeague?: number;
  isChampion?: boolean;
  isCupFinalist?: boolean;
  openBroadcastWins?: number;
  totalGoalsScored?: number;
}
```

### Tipos de Metas Contratuais:
1. **G-4 / Top 4 na Liga:** Bônus por classificação entre os 4 primeiros colocados.
2. **Título de Campeão:** Premiação por conquista da liga.
3. **Finalista da Copa:** Bônus por alcançar a grande final do torneio eliminatório.
4. **Vitórias em TV Aberta:** Bonificação por performance em jogos transmitidos em rede aberta.
5. **Gols Marcados:** Metas de atratividade ofensiva.

Ao término da temporada em `financeService.ts` (`distributePrizeMoney` e `distributeCupPrizeMoney`), as metas são avaliadas, o valor total é creditado ao cofre do clube e uma notícia oficial é publicada no mural esportivo.

---

## 🎨 4. Experiência Visual & Design System Neo-Myth Tech

- **Pós-Jogo (`MatchResult.tsx`):**
  - Card estilizado da emissora oficial exibindo insígnia, nome do canal e badge de sinal.
  - Indicador visual do repasse financeiro obtido: `📺 Cota de Transmissão recebida: +R$ 39.000 (OmniSports HD)`.
- **Painel Financeiro (`FinancePanel.tsx`):**
  - Seção dedicada com emissoras credenciadas, bônus base por jogo e tabela de metas ativas da temporada.

---

## 🧪 5. Arquivos e Testes de Referência

- **Domínio:** `packages/shared/src/domain/broadcastRights.ts` & `broadcastRights.test.ts`
- **Serviços:** `packages/server/src/services/matchService.ts`, `financeService.ts`
- **Integração E2E:** `packages/server/src/broadcastFinanceFlow.test.ts`
- **UI:** `packages/web/src/pages/MatchResult.tsx`, `FinancePanel.tsx`
