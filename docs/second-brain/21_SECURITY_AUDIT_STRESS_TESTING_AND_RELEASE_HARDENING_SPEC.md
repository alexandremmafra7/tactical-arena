# 21. Especificação Mestre: Blindagem de Segurança, Auditoria Geral & Testes de Stress Massivos
> **Tags:** `#seguranca` `#auditoria` `#stress-test` `#data-leak-prevention` `#anti-crash` `#compliance`  
> *Data de Criação: 17 de Outubro de 2026*  
> *Classificação: Segundo Cérebro / ORÁCULO / Tactical Arena FC*

---

## 🛡️ 1. Justificativa & Princípio de Tolerância Zero

O Tactical Arena FC é um produto comercial de software destinado à distribuição pública (Steam, itch.io, instaladores Windows e APK Android). No mercado contemporâneo de jogos, **um único vazamento de dados, brecha de segurança ou travamento silencioso (White Screen of Death) destrói irreversivelmente a reputação comercial da empresa e encerra a viabilidade do produto**.

A segurança não é um pós-processamento estético: ela é a **garantia fundacional da venda**.

---

## 🔒 2. Pilares de Blindagem de Segurança (Zero Data Leak)

### 2.1. Isolamento de Saves & Prevenção de Exfiltração Local
1. **Proteção contra DNS Rebinding & SSRF:**
   * O servidor local (`127.0.0.1:3979`) só pode aceitar requisições de origens autorizadas (`allowedOrigins`), rejeitando cabeçalhos `Host` forjados ou conexões de rede externa quando em `APP_MODE=local`.
2. **Ocultação Absoluta de Credenciais e Tokens:**
   * Nenhum endpoint JSON (`/saves`, `/career`, `/club`, `/health`, `/config`) pode incluir tokens internos (`managerToken`), senhas, chaves de assinatura ou identificadores confidenciais.
   * `timingSafeEqual` obrigatório em todas as comparações de sessão e tokens para evitar ataques de temporização (Timing Attacks).
3. **Higienização de Stack Traces & Erros em Produção:**
   * Em `NODE_ENV=production`, nenhum erro retornado pela API pode exibir caminhos de arquivos do sistema (`D:\Code\...`, `C:\Users\...`) ou detalhes do driver SQLite/Prisma. As mensagens devem ser opacas e auditáveis internamente via logger com ID de correlação.

### 2.2. Sandboxing do Sistema de Arquivos & Anti Path-Traversal
1. **Sanitização Estrita de Slugs e Nomes de Arquivos:**
   * Operações de upload de escudo (`uploadEditorCrest`), saves (`deleteSave`, `loadSave`, `duplicateSave`) e exportação/importação de Mod Packs devem validar rigorosamente os parâmetros de entrada com regex `^[a-zA-Z0-9_-]+$`.
   * Rejeição explícita de caracteres perigosos: `..`, `/`, `\`, `%00` (null byte), `:`, `*`, `?`, `"`, `<`, `>`, `|`.
2. **Restrição de Diretórios Canônicos:**
   * Todo acesso a disco deve ser resolvido contra caminhos base canônicos (`path.resolve`) e validado se a rota resultante permanece estritamente dentro da pasta autorizada (`path.startsWith(allowedBasePath)`).

### 2.3. Sanitização contra Injeção (SQL, XSS & Prototype Pollution)
1. **Prevenção de XSS em Nomes de Clubes e Atletas:**
   * Sanitização de strings provenientes do usuário, Mod Packs ou dados CSV antes de renderizar em telas e antes de salvar em banco.
2. **Imutabilidade e Proteção contra Prototype Pollution:**
   * Funções de merge profundo de objetos e patches táticos devem bloquear chaves perigosas como `__proto__`, `constructor` e `prototype`.

---

## ⚡ 3. Bateria de Testes de Stress Massivos (Massive Load & Chaos Engineering)

Para garantir que o jogo nunca trave nem acumule vazamentos de memória (Memory Leaks) em sessões longas de jogadores reais (8 a 10 horas seguidas):

### 3.1. Simulação Monte Carlo Estendida (500 a 1.000 Partidas)
* Executar bateria massiva de 500 partidas consecutivas em loop rápido, monitorando:
  * Delta de memória heap (`process.memoryUsage().heapUsed`): a retenção deve permanecer plana após estabilização do GC.
  * Invariantes estatísticos: sem scores anômalos (ex: 25x0), sem cartões negativos, sem xG `NaN` ou `Infinity`.

### 3.2. Teste de Resistência Multitemporada (10 Anos de Carreira Ininterruptos)
* Executar 10 avanços de temporada seguidos (`Season Rollover x10`), validando:
  * Aposentadoria de veteranos e injeção de promessas da base sem estouro de tamanho de elenco.
  * Finanças sustentáveis sem hiperinflação exponencial de orçamentos e sem clubes quebrando em dívidas infinitas.
  * Integridade referencial do banco de dados (zero registros órfãos em contratos, títulos ou tabelas históricas).

### 3.3. Teste de Concorrência & Bloqueios Atômicos (Race Conditions)
* Disparo de requisições simultâneas:
  * 10 lances simultâneos no mesmo milissegundo no Deadline Day.
  * Tentativa de compra dupla do mesmo jogador por dois clubes concorrentes.
  * Avanço de rodada enquanto uma substituição tática ao vivo é processada.
  * O `careerOperationLock` deve serializar ou rejeitar as requisições concorrentes de forma limpa e atômica.

---

## 🛡️ 4. Anti-Crash na Interface (Web & UI Hardening)

1. **Error Boundary Global & Setorial:**
   * Criar `GlobalErrorBoundary.tsx` Stadium Night na raiz do aplicativo (`App.tsx`), impedindo que erros não tratados em qualquer componente derrubem o app para a "tela branca".
   * Botão de "Recuperar / Voltar ao Início" com diagnóstico seguro em memória.
2. **Resiliência do Sintetizador de Áudio (`WebAudio`):**
   * Em ambientes onde a política de autoplay do navegador bloqueia áudio ou em navegadores sem suporte a certas interfaces, o `soundFx` deve silenciar graciosamente sem emitir erros no console ou interromper o fluxo da partida.
3. **Validação de Limites Numéricos em Inputs:**
   * Garantir que nenhum input numérico (orçamentos, cláusulas, atributos) aceite `NaN`, exponenciais (`1e99`), ou números negativos nos formulários.

---

## 📋 5. Plano de Execução da Blindagem Geral

| Fase | Escopo | Arquivos Chave |
|---|---|---|
| **Fase A** | Testes de Segurança de Limites & Anti-Vazamento | `packages/server/security-tests/boundaries.test.ts`, `dataLeakage.test.ts`, `pathTraversal.test.ts` |
| **Fase B** | Testes de Stress Monte Carlo & Multitemporadas (10 anos) | `packages/server/src/simulation/massiveStress.test.ts`, `seasonLongevity.test.ts` |
| **Fase C** | Error Boundary Stadium Night & Sanitização de Inputs | `packages/web/src/components/GlobalErrorBoundary.tsx`, `App.tsx` |
| **Fase D** | Auditoria de Dependências & Bundle Sanitization | `npm audit`, verificação de `dist/` contra secrets |

---
