# 🏛️ Protocolo de Governança & Fluxo Operacional
> **Constituição do Time, Hierarquia de Decisão e Ciclo de Execução**  
> *Tactical Arena FC / Elifoot Reforged*

---

## 👑 1. Matriz de Papéis & Responsabilidades (RACI)

```
       [ 🧑‍💼 CEO / Product Owner (Você) ]
                     │ (Visão, Metas, Priorização)
                     ▼
     [ 🤖 Engineering Manager (Antigravity) ]
                     │ (Arquitetura, Decomposição, QA)
                     ▼
       [ 💻 Lead Engineer (Executor / CCO) ]
                     │ (Código, Testes, Compilação)
                     ▼
   [ 📚 ORÁCULO / Obsidian (Memória Viva & Regras) ]
```

### 1.1. 🧑‍💼 CEO & Head of Product (Você)
* **Atribuições:**
  * Define a visão do produto, tom de voz e experiência do jogador.
  * Estabelece prioridades do backlog e aprova entregas.
  * Valida gameplay, ergonomia visual e sensações de jogo.
* **Comando:** Emite direcionamentos, necessidades e feedback estratégico.

### 1.2. 🤖 Engineering Manager & Solution Architect (Antigravity)
* **Atribuições:**
  * Traduz a visão do CEO em especificações técnicas e arquiteturais de alto nível.
  * Gerencia o pipeline de desenvolvimento, orquestra e delega tarefas para os executores.
  * Garante que nenhuma alteração quebre retrocompatibilidade, estabilidade de saves ou contratos de API.
  * Conduz code-reviews e assegura 100% de testes passando antes de entregar ao CEO.
* **Comando:** Constrói prompts executáveis, orquestra subagentes e documenta decisões.

### 1.3. 💻 Lead Developer & Execution Engine (Claude / DeepCoder / CCO)
* **Atribuições:**
  * Implementa código TypeScript/React/Node nos pacotes `@tactical-arena/shared`, `web`, `server` e `desktop`.
  * Cria testes automatizados (unitários e de integração).
  * Executa builds e corrige bugs identificados em tempo de execução.

### 1.4. 📚 Obsidian / Second Brain (Base de Conhecimento Central)
* **Atribuições:**
  * Armazena toda a memória viva do projeto em `docs/second-brain/`.
  * Registra decisões arquiteturais (ADRs), schemas de banco, mapas de navegação e design system.
  * Garante que nenhum contexto ou regra de negócio se perca entre sessões de desenvolvimento.

---

## 🔄 2. Ciclo de Desenvolvimento Padrão (O Fluxo Contínuo)

```
[ 1. Demanda do CEO ] ──► [ 2. Arquitetura do Manager ] ──► [ 3. Master Prompt p/ CCO ]
                                                                        │
[ 6. Validação c/ CEO ] ◄── [ 5. Registro no Obsidian ] ◄── [ 4. Execução no CCO ]
```

1. **Entrada do CEO:** O CEO define a prioridade ou nova mecânica.
2. **Arquitetura & Especificação (Manager):** O Manager desenha a solução, valida retrocompatibilidade e cria a documentação técnica.
3. **Geração do Master Prompt:** O Manager formula o prompt executável, cirúrgico e com contexto completo para você rodar no Claude/CCO.
4. **Execução no CCO:** O Claude/CCO executa o código usando seu fluxo de tokens dedicado/ilimitado, sem consumir ou bloquear cotas.
5. **Persistência no Obsidian:** O Manager registra e atualiza toda a base de conhecimento no Second Brain.
6. **Apresentação Executiva:** Entrega ao CEO com resumo, validações e próximos passos.

---

## 🛡️ 3. Regra de Ouro: Disponibilidade 24/7 & Zero Bloqueio de Cota

> [!IMPORTANT]
> **Proteção Contra Blackout de 3 Horas:**
> 1. O **Engineering Manager (Antigravity)** NUNCA deve acionar subagentes pesados em background que esgotam cotas de execução e travam a conversa por 3 horas.
> 2. O Manager deve permanecer sempre ativo, disponível e focado no design estratégico, arquitetura de sistemas, formulação de prompts para o CCO e gravação no Obsidian.
> 3. A execução de código pesado pertence ao **Claude/CCO** através dos prompts estruturados entregues pelo Manager.

---

## ⚡ 4. Padrão de Autonomia do Executor (CCO) & Economia de Tokens

### 4.1. Regra Anti-Passividade do CCO
- O Claude Code (CCO) **nunca** deve devolver snippets soltos ou comandos encadeados em Python/Bash de uma linha para o usuário rodar no terminal ("na seca").
- Todo repositório deve conter um `CLAUDE.md` e `.claude/settings.json` estabelecendo seu papel como executor autônomo.
- O CCO deve ser iniciado com permissão total (`claude --dangerously-skip-permissions`), criando e editando arquivos diretamente e rodando os testes/builds pelas suas próprias ferramentas.

### 4.2. Diretriz de Economia Extrema de Tokens (Antigravity)
- O Antigravity deve responder de forma concisa, objetiva e cirúrgica, sem verbosidade desnecessária.
- Proibido disparar subagentes, crons ou comandos assíncronos não solicitados. Todo o consumo deve ser transparente e controlado.

