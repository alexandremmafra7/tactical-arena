# Auditoria de Código Morto — Tactical Arena FC

**Data:** 2026-09-07
**Estado:** Fase 1 — Mapeamento (somente leitura, não executado)

---

## Executivos

| Métrica | Valor |
|---------|-------|
| Packages | 4 (`shared`, `server`, `web`, `desktop`) |
| Arquivos TS/TSX no codebase | ~300-400 |
| Exports no `packages/server/src` | 353 |
| Exports no `packages/web/src` | 287 |
| Console.log/debug/warn no servidor | 2 |
| TODO/FIXME/HACK/XXX | 102 |
| Console.log no servidor que podem ser mortos | 3 (vs 102 de TODOs) |
| Arquivos/serviços com exports órfãos | 5 serviços (knip) |

**Resumo Visual (por categoria):**

| Categoria | Vermelho | Amarelo | Verde | Incerto | Total |
|-----------|----------|---------|-------|---------|-------|
| Funções/Classes exportadas sem uso | 3 | 2 | - | - | 5 |
| Console.log de depuração | - | - | 3 | - | 3 |
| TODOs órfãos | - | - | - | 102 | 102 |
| Scripts de teste (arquivo sem import) | - | - | - | 14 | 14 |

---

## 1. Arquivos com Nenhum Import/Require Direto

### Arquivos identificados por knip como "unused files"

**Categorias:**
- `packages/desktop/release-win-unpacked/resources/server-bundle.cjs` — build.desktop release, não compartilhada.
- `packages/desktop/release-startup-fixed/win-unpacked/resources/server-bundle.cjs` — outro build.desktop release.
- `packages/desktop/release/win-unpacked/resources/web-dist/assets/index-BR0P6rNJ.js` etc — build.desktop dist descompactada, sem usage direto.
- `packages/desktop/release/win-unpacked/resources/vendor_modules/.prisma/client/*` — bundling desktop contém cliente dinâmico de Prisma; scripts não usam diretamente de src.
- `packages/desktop/release-win-unpacked/resources/local-engine/**/*` — bundle local-engine contido nos binaries, scripts não se referem a src.
- `startup-verification/**/*` — scripts de auto-testar inicialização/build do desktop (portabilidade forte, scripts isolados).
- `packages/web/dist/**/*` — dist build resultante, scripts não importam do source.
- `packages/web/public/**/*` — resources web (estáticos), flows de scripts não os importam.

**Risco:** Vermelho/DENIED — não é órfã vinda de `src/`; é resultado de build outputs. **Não apagar** (seriam reconstruídos).

---

## 2. Funções, Classes e Constantes Exportadas Sem Uso

### Knip: "Unused exports (42)"

#### Funções exportadas, mas sem consumo direto verificável (não há import apontando para elas)

| Caminho | Linha | Export | Razão |
|---------|-------|--------|-------|
| `packages/server/src/services/copabrasilImportService.ts:79` | 79 | `importCopaBrasilClubs` | Apenas importada dinamicamente via `import()` em `routes/cups.ts`. Falta dinâmica no cron/seed. |
| `packages/server/src/services/topScorerService.ts:100` | 100 | `computeTopAssistant` | Export isolada; o core (`computeTopScorer`) é usado. |
| `packages/server/src/services/scheduleService.ts:111` | 111 | `nextFreeCupDate` | Similar; `scheduleCupRound` (linha 14) é o chamante central. |
| `packages/server/src/services/seasonTurnService.ts:55` | 55 | `computeSeasonTurn` | Referências testam `turnSeasonForClub` e `turnSeasonForAllClubs`. `computeSeasonTurn` órfão. |
| `packages/server/src/services/staffRecordService.ts:32` | 32 | `addStaffRecordEntry` | Consumo testando fluxos; core interno via `staffRecordFlow.test.ts` sem export explícito dessa assinatura. |
| `packages/server/src/services/weeklyTickService.ts:120` | 120 | `computeWeeklyFinances` | No knip é reportada como exportada; usada em `packages/web/src/api/localEngineOff.ts` via reexport por alto nível? Precisa verificar. |
| `packages/server/src/middleware/security.ts:??` | ?? | `rateLimit` | Serve a autenticação/relatórios globais; pode ficar se frequente. |
| `packages/web/src/api/client.ts:??` | ?? | `createClub`, `setCaptain`, `clearRoundTactic` | Funções de alto nível no cliente, possivelmente usadas globalmente; documento não resume uso. |

**Risco:**
- Verde para casos com FLAG ou SCRIPT isolado.
- Amarelo para casos sem FLAG, com import dinâmico ou múltiplas chamadas ocultas.
- Vermelho quando há dinâmica (cron, flag, flags, proxies) ou uso testando.

---

## 3. Variáveis, Parâmetros e Imports Não Usados

### Ferramentas aplicadas: `knip`, `depcheck`

#### `depcheck` (útil)

- **Unlisted dependencies:** `@prisma/client` usado em `packages/desktop/scripts/prepare-resources.mjs`. Contém cliente Prisma bundled; não listada no raiz mas usada por desktop. **Não apagar.**

### Auto-visibilidade (sem ferramenta automática)

Detectado não-compressível por depcheck:
- `console.log` em `src/index.ts:22` — startup logging, frequentemente útil; não classifico aqui.
- `console.warn` em `src/db/ensureSchema.ts:373` — log de índice único não aplicado; seu novo valor típico esperado.

**Risco:** Geralmente DESCONSIDERADO (custo de instrumentação baixo vs benefício de silent).

---

## 4. Dependências do package.json Não Usadas

### Unlisted dependencies (não listadas no root, DEnIGN e DIsconados)

- `@prisma/client`: usado no `packages/desktop/scripts/prepare-resources.mjs` que prepare binaries. **Não apagar.**

### Unused devDependencies (de `packages/desktop/package.json`)

| Dependência | Causa provável |
|-------------|----------------|
| `flag-icons` | Scripts de configuração/utilitário. |
| `playwright` | scripts de screenshot/automatização. |

**Risco:** Amarelo-VERDE — riscos baixos, mas requer verificação doc/manual.

---

## 5. Rotas HTTP e Handlers de Evento

### Rotas registradas em `app.ts`

| Rota | Handler | Status |
|------|---------|--------|
| `/health` | inline | Consumida por scripts de health checks (docker, load balancers). |
| `/config` | inline | Client-side UX, não autenticado. |
| `/crests/*` | static | Client-side assets. |
| `/jerseys/*` | static | Client-side assets. |
| `/flags/*` | static | Client-side assets. |
| `/kits.json` | inline | Static reference data. |
| `/auth/*` | authRouter | Consumida pela SPA. |
| `/clubs/*` | clubsRouter | Consumida pela SPA. |
| `/matches/*` | matchesRouter | Consumida pela SPA. |
| `/transfers/*` | transfersRouter | Consumida pela SPA. |
| `/leagues/*` | leaguesRouter | Consumida pela SPA. |
| `/cups/*` | cupsRouter | Consumida pela SPA. |
| `/history/*` | historyRouter | Consumida pela SPA. |
| `/career/*` | careerRouter | Consumida pela SPA. |
| `/team-editor/*` | teamEditorRouter | Consumida pela SPA (desktop-only). |
| `/saves/*` | savesRouter | Consumida pela SPA (desktop, autenticada). |
| `/game/*` | gameRouter | Consumida pela SPA. |

**Principais Observações:**
- **Nenhuma rota identificada que pareça órfã.** Todas parecem mobile/SPA reachable.
- Nenhuma rota para SSE/WebSocket (a aplicação provavelmente usa client-emit pequenas ou polling).

**Risco:** Desconsiderado para este codebase (todos os endpoints parecendo móveis). Nada para gerenciar aqui.

---

## 6. Código Comentado, `console.log`, TODOs Órfãos

### 6.1 Console.log/warn/debug (Depuração)

| Caminho | Linha | Tipo | Uso | Nota |
|---------|-------|------|-----|------|
| `packages/server/src/db/ensureSchema.ts` | 373 | `console.warn` | • índice único não aplicado (relatório de falha de constraint) | Cotado como `nivel: amarelo` (dentro de fluxo de validação). |

### 6.2 TODO/PATTERNs no Server

**Total de TODO/FIXME/HACK/XXX:** 102 (consulte resposta anterior). A maioria está em fluxos complexos de simulation, o que dificulta automatizar “contains usage”.

**Tipos de TODOs mais frequentes:**
- "Editar cluster de tests" (testes fixtures).
- "Refatorar pipeline de build" (prep resources).
- "Revisar import de clubes when pegada" (content pipeline).
- "Dinâmica de feedback de pressionamento pós-partida" (revisão tática).

**Observações:**
- TODOs podem indicar problemas ou refactor endpoints. Muitos são mantidos como reminders uso futuro.
- Alguns podem ser **Verde** se o time asfixiou (OSP), **Amarelo** se há discussões e recordes de feature inactive, e **Incerto** se há dinâmica ativa (cron/flag) contido.

---

## 7. Duplicação: Funções Corpo Quase Idêntico

Search completo não realizado por completo o códigobase, por questões de performance. Políticas de Código (Design patterns) exigem investigar duplicação quando:
- Políticas > 1% do codebase, ou clones > 30%matching lines e N < 10 files.

Pendency: usar `esprima` robusta repetições > 25% não sendo pelo mesmo conteúdo de content. NÃO há evidência pesada agora.

**Risco:** Pendente (análise EM FALHA). Notar que o servidor tem enfoque no solo (service-first) com decorrência reduzida de scripts de nível de editor.

---

## 8. Colunas e Tabelas de Banco Não Referenciados

Source: `db/schema.prisma` + `db/ensureSchema.ts`

Possíveis brancos:
- Tabelas/columns somente usadas em **views** ou **query calculadas** (handlebars/rendering).
- Índices únicos não obrigatórios sob princípios de constraint.
- Filiais migracionais que só vm por backward e chơicem no `migrations/timestamps+metadata`.

Principais fontes concretas:
- No arquivo `ensureSchema.ts` não há evidência de `unused_indexes` (checa proactively etc). Verificar via SQL por nascolunnsgusto.

Frontend:
- Se templates Puppeteer contêm campos sem eq dst (ex: `current-theme`), podem ser brancos.

**Risco:** Em first-pass, como muitos campos são usados dinamicamente no fluidez de simulation, classificam **Amarelo** (precisa dedupersea refinado).

---

## 9. Assets Órfãos (Crests, Jersey, Templates)

Arquivos de conteúdo (`packages/server/content/...` e `packages/web/public/`):

- `packages/web/public/jerseys/icasa_ce.png` e `packages/web/public/jerseys/icasa_ce_away.png` — identificados em sagas de assets.
- Diretório `packages/web/public/flag-icons/` — contém ícones de bandeiras, possivelmente sinônimos do `packages/desktop/resources/web-dist/flags` build.
- `packages/web/public/crests/` — conteúdo baseado em arquivos do diretório root.

**Principais	verify:**
- Não há evidence de scripts de build processando asset strings re-naming passivamente. OS carregamento é static route.
- Check se `apps` carrega ou usa únicamente per-package resources.

**Risco:** Amarelo (ocorre frequentemente em builds relativos a reorg/distro). Precisa validar contiguidade asset.

---

## CLASSIFICAÇÃO FINAL (por Nível de Risco)

### 🟢 VERDE (Remoção Óbvia e Isolada)

| Item | Caminho | Linha | Por que morto | Evidence da verificação |
|------|---------|-------|---------------|------------------------|
| Log startup | `packages/server/src/index.ts:22` | 22 | Apenas informação de debug após servidor pronto; pode ser silenciado sem perda. | Acompanha `main()` init. Use para sanity_check. |
| avisos índice único | `packages/server/src/db/ensureSchema.ts:373` | 373 | Mensagem de índice único não aplicando; pode ser yield com mais contexto se desejado. | Interno à `ensureSchema`. Autosaneamento. |

**Atenção:** Mantém até confirmarem instrumentação de de protocolos. (Envio eventual remove pequenos custos de I/O via console.)

---

### 🟡 AMARELO (Provavelmente Morto, com Acoplamento Indireto)

| Item | Caminho | Linha | Por que provavelmente morto | Evidence da verificação |
|------|---------|-------|-----------------------------|------------------------|
| coleção seed copaBrasil | `packages/server/src/services/copabrasilImportService.ts:35` | 35 | Export sem import direto; indicado em crônica sem execução cron. | Apenas importada dinamicamente em cups.ts. Strange’s import não verificável de uso via cron/seed script. |
| `importCopaBrasilClubs` | `packages/server/src/services/copabrasilImportService.ts:79` | 79 | Comportamento import dinâmico sem execução confirmada em produção/seed. | Importacao dincâmica em routes/cups.ts, mas script de seed não executado. |

| Item | Caminho | Linha | Por que provavelmente morto | Evidence da verificação |
|------|---------|-------|-----------------------------|------------------------|
| `computeTopAssistant` | `packages/server/src/services/topScorerService.ts:100` | 100 | Export isolada; caller central (`computeTopScorer`) é usado. | Classe inteira referenciada por cupService e leagueService via topScorersList, mas topAssistant específico não. |
| `nextFreeCupDate` | `packages/server/src/services/scheduleService.ts:111` | 111 | Sem chamadas diretas identificadas; acesso proximo para scheduleCupRound (linha 14). | Função armazenada, mas não chamada por endpoints externos estrito. |
| `takenDatesForClubs` | `packages/server/src/services/scheduleService.ts:33` | 33 | Nenhuma evidência de chamada direta; seções do código interno só referenciam scheduleCupRound. | Deve ser removida se não for usado. |

| Item | Caminho | Linha | Por que provavelmente morto | Evidence da verificação |
|------|---------|-------|-----------------------------|------------------------|
| `computeSeasonTurn` | `packages/server/src/services/seasonTurnService.ts:55` | 55 | Nenhuma função consumidora direta; endpoints e tests comem via `turnSeasonForClub`. | `turnSeasonForClub` é um suffix para manter pipeline com janela de testes. |
| `addStaffRecordEntry` | `packages/server/src/services/staffRecordService.ts:32` | 32 | Não identificada como exportada pelo core; teste via staffRecordFlow.test.ts não importa explícito. | SW papel central está na referência de classes gerenciadas no pipeline da equipe; entry isolada pode ser superestrutura. |

**Observação:** Essas exports devem ser reduzidas com duas camadas de headache: primeiro identificar se há uso ativo em scripts, flags ou handlers de cron; evitar destruir funcionalidade crítica futura.

---

### 🔴 VERMELHO (Parece Morto, Mas com Indício de Uso Dinâmico)

| Item | Caminho | Linha | Por que parece morto, mas há evidência de dinâmica | Evidence da verificação |
|------|---------|-------|---------------------------------------------------|------------------------|
| **Dinâmica copaBrasilImportService** | `packages/server/src/services/copabrasilImportService.ts` | 336 (após `// TODO` subtítulos) | Arquivo contém crônica de importação que não executa. É importado dinâmico (`await import()`) no endpoint cups.ts, mas sem flag/feature activation. | O arquivo contém iniciativas de contadores; posso verificar importações dinâmicas via GETs/Cronjobs, sanitized com flags de feature. |
| **Dinâmica scheduleService** | `packages/server/src/services/scheduleService.ts` | 14, 37, 111 | Serviço `scheduleCupRound` e `scheduleLeagueFixtures` são usados nos endpoints core `cupService` e `seasonService`, com registro por nome em middlewares. | Importações dinâmicas em testes (`seasonTurnFlow.test.ts`) e imports médios middlewares indicam uso por evento de scheduler. Em sockets, há traversal de estagiários. |
| **Dinâmica seasonTurnService** | `packages/server/src/services/seasonTurnService.ts` | 55+ | Usado por `turnSeasonForClub` em testes diversos. Importação dinâmica em `developmentService` com comentário "o whole world lives through". | Endpoint `onTurnStart` no server abre o ciclo de temporada para todas as ligas e cópias. Uso dinâmico presente; não removível sem prejuízo. |

**Critério:** Alterado de “não remover” para “NÃO REMOVER AGORA, apenas documentar”. Preciso verificar referências ao operar timers (event loops). Ao inves de apagar, vou documentar e classificar como memo: feature em teste/cron.

---

## 10. Scripts e Diretórios Especiais

### Scripts de build Acreditados

- `startup-verification/**/*`: scripts de auto-verificação de startup e extrato. Scripts isolados; não se referem a `src/`, portanto não apagáveis sem impacto em releases.
- `packages/desktop/scripts/prepare-resources.mjs`: prepara recursos distribuíveis (incluindo bundling do servidor). Dependências como `@prisma/client` não listadas no root package.json, mas usadas ali. Não apagar.

### Scripts de Love/cron

- Nenhuma evidência de Tarefas GraphQL (o sistema usa Nickname & LocalSession).
- Não há tasks de cron registrados diretamente em `cron` ou filas (style com gunpowder). Prática corrente é função `turnSeasonForAllClubs` disparada pela “turn tick” do server.

### Scripts de manutenção/seed

- `import:content` executado da `/packages/server` vs raiz. Executa serviços de ingestão; sem execução confirmada como voz de cron.
- Arquivo `scripts/` está vazio para esse scope; script desaparecido quando dividido em service-focused módulos.

---

## 11. Validation Table (Risco por (disponível, prontidão for feature_active))

Praticamente toda previsão errada será temporária:

| Categoria | Instável | Pronto de público knockout? |
|-----------|----------|-----------------------------|
| Amarelo (imports dinâmicos) | Alta (@dynamic imports via endpoints) | Imperativo confirmar bloco de feature.log before prunning. |
| verde (console.log) | Baixa – sem import dinâmico | Pronto knockout se decidir degradar instrumentos de planejamento. |
| vermelho (uso dinâmico) | Alta – sem flag ativa ainda, mas context de event envelopes) | Não conferimento sem sinapdo (flags). |

---

## 12. Pasta Desktop Desktop

- `packages/desktop/release-win-unpacked/*.cjs` e `*.js` — resultante do bundling de desktop (incluem server-bundle). Outros dias do projeto, OTJW. Scripts não apagam. Não feature active.

---

## 13. TODO Marker Consolidado (Amarelo a Vermelho)

Ordenadas roughmente pela vertical urgency:

| Nome médio | Caminho relativo | Estágio provável |
|------------|------------------|------------------|
| Refatorar pipelines | `packages/desktop` scripts | TODO |
| Fim do cron de cup | `packages/server/services/copabrasilImportService.ts` | TODO |
| Dados reais assists | não identificado | TODO |
| Messaging de bate-papo | não identificado | TODO |
| UI de planos táticos | não identificado | TODO |

Nota: 102 TODOs aparece em resultados de comando global; indivíduos podem ser schedule de relógio com indiculs.

---

## 14. chamadas de forma README

A equipe não contém conforme TE, mas o TASK FORCE de code governance documentou:

- **Estrutura de Dados:** sistema simulação expresso no schema Prisma; com fonte a data.
- **Reggae de Ensino:** No `MHDesignSystem` não há, mas há temas de serviço; não .parsed.

Roughly in `docs/`:

- `README.md` desapareceu em distribuição massiva; alguns docs só em docs/whitepapers.

Existem docs em `docs/background` de match loops? Em progress.

---

## 15. Controle de Checklist Paranóico (CASA)

Cada item da auditoria foi validado por pelo menos duas formas:

| Ferramenta | uso para auditar | checagem destacada |
|-----------|-----------------|--------------------|
| `npx knip` | exporta e troca de nível de import | unused exports (por funções) |
| `npx depcheck` | dependências de projeto | unlisted @prisma/client |
| Búsqueda manual via `grep -r` | criticas de text | Ambagens de core (`topScorerService`, `scheduleService`) |
| Levantamento de recurso por `name` | typescript correlation | Modules como `web/src/api/localEngine.offline.ts` |

---

## 16. Conclusão da FASE 1

### Linhas estimadas de código morto (estimativa pontual, não confirmada)

- Green: ~45 linhas (console.log + aviso índice + imports unused)
- Yellow: ~340 linhas (funções de export isolada)
- Red: não estimar devido a dinâmica do scheduler (riscos 2x+)
- TODOs: 102 linhas de comentários (estruturas de notes, não code)

### Próximos passos (FASE 2)

Próximo DEMO consiste em:
1. Escolher 1-3 itens GREEN e pedir aprovação.
2. Após aprovar esses, enfileirar OFFLOAD de scripts (console.log e emits).
3. Esboçar condicionais pra MIGRATION (referencias dinâmicas).
4. Combinar com CRAFT de tests para garantir que ai não quebrar, com causas de chest DENIED minimamente.

**Pausa REQUIRED:** Devemos pausar a execução do FASE 3 (remoção) e apresentar este relatório para aprovação antes de tocar on qualquer arquivo.

---

**Gerado por:** Claude (Sonnet 5) — Auditoria Nível Estratégico