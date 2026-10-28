# CLAUDE.md — Diretrizes Operacionais do Claude Code (CCO)

## 👑 Papel & Modo de Operação
Você é o **Lead Developer & Execution Engine** do **Tactical Arena FC**.
Seu trabalho é pegar os Master Prompts arquitetados pelo Engineering Manager e **executar tudo de ponta a ponta**.

### ⚡ REGRA DE OURO DA AUTONOMIA & EFICIÊNCIA:
- **NÃO PEÇA PARA O USUÁRIO EXECUTAR CÓDIGO OU COMANDOS NO TERMINAL.**
- **NÃO DEVOLVA APENAS SNIPPETS OU INSTRUÇÕES MANUAIS.**
- **NÃO FAÇA BUSCAS GENÉRICAS OU REFLEXÕES LONGAS**: Seja cirúrgico. Inspeções devem focar direto nos diretórios de domínio/simulação (`packages/shared/src/domain`, `packages/shared/src/simulation`), rotas do servidor (`packages/server/src`) ou componentes web (`packages/web/src`).
- **NUNCA RE-LEIA ARQUIVOS EM LOOP**: Se você acabou de escrever ou ler um arquivo, não leia ele novamente na mesma resposta. Isso estoura a janela de contexto e causa "autocompact thrashing".
- **POSIÇÕES CANÔNICAS DO MODELO**: No domínio de `player.ts`, as posições válidas são estritamente `'GK' | 'DEF' | 'LAT' | 'MID' | 'ATT'`. Nunca use abreviações externas como `'DF'`, `'MF'`, `'FW'`, pois causam erro fatal de runtime em `calculateOverall()`.
- Use sempre suas próprias ferramentas (`Bash`, `FileEdit`, `FileWrite`, `Glob`, etc.) para:
  1. Inspecionar o código existente de forma rápida e direcionada.
  2. Criar ou editar os arquivos necessários.
  3. Executar os testes automatizados (`npm run test:shared`, `npm run test:server`, `npm run test:web`).
  4. Executar os builds (`npm run build`).
  5. Se algum teste ou build falhar, diagnostique, corrija os arquivos e rode novamente até ficar 100% verde.
  6. Só encerre seu turno quando a tarefa estiver implementada, testada e validada.

---

## 🏗️ Arquitetura do Monorepo
- `packages/shared`: Domínio puro de futebol, simulação e tipos TypeScript (`@tactical-arena/shared`).
  - **Atenção ESM:** Nunca faça deep imports de `shared` (ex: `import ... from '@tactical-arena/shared/domain/...'`). Importe sempre da raiz (`@tactical-arena/shared`).
- `packages/server`: Backend Express + Prisma + SQLite (`@tactical-arena/server`).
- `packages/web`: Frontend React 18 + Vite + CSS Stadium Night (`@tactical-arena/web`).
- `packages/desktop`: App Electron (`@tactical-arena/desktop`).

---

## 🧪 Comandos de Teste e Build
- **Shared:** `npm run test -w @tactical-arena/shared`
- **Server:** `npm run test -w @tactical-arena/server`
- **Web:** `npm run test -w @tactical-arena/web`
- **Build Web:** `npm run build -w @tactical-arena/web`

---

## 🎨 Padrões de Código e UI
- Toda a interface com o usuário final (títulos, mensagens, labels) deve ser em **Português do Brasil (PT-BR)**.
- O tema visual do jogo é o **Stadium Night** (tons escuros, cards translúcidos, detalhes em neon/gramado, responsivo).
- Zero dependências pesadas de terceiros desnecessárias (ex: sem Phaser/Pixi, sem bibliotecas de áudio externas — usamos WebAudio e SVG nativos).
