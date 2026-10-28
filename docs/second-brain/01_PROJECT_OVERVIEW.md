# 01. Visão Geral do Projeto & Arquitetura
> **Projeto:** Tactical Arena (Elifoot Reforged)  
> **Tags:** `#arquitetura` `#monorepo` `#typescript` `#react`

---

## ⚽ 1. O Que É o Tactical Arena?
É uma releitura moderna, profunda e imersiva do clássico **Elifoot / Championship Manager**, focado em:
- **Gestão de Clubes & Carreira de Treinador**: Estilos táticos, evolução de atributos, categorias de base, finanças, estádio e transferências.
- **Simulação Tática Detalhada**: Atributos físicos/técnicos/mentais, funções específicas por posição, química setorial e lances dramáticos ao vivo.
- **Multiplataforma Resiliente**: Funciona 100% Offline (Local Engine no Desktop Electron e Mobile Capacitor) ou Conectado a um Servidor dedicado.

---

## 📦 2. Estrutura do Monorepo

```
elifoot-reforged/
├── packages/
│   ├── shared/     <- Núcleo de domínio: tipos, simulação tática, geradores determinísticos e RNG
│   ├── web/        <- Frontend React + Vite: páginas, componentes visuais, áudio e estilos
│   ├── desktop/    <- Wrapper Electron para Windows/macOS/Linux
│   └── server/     <- Backend Node.js / Fastify / Prisma para partidas e persistência remota
├── content/        <- Banco de dados de clubes (clubs.csv), escudos (crests) e uniformes
├── tools/          <- Ferramentas de automação e suporte (ex: jarvis_techlead)
└── docs/           <- Documentação técnica e Segundo Cérebro
```

---

## ⚙️ 3. Regras Arquiteturais Críticas
1. **Determinismo & Sincronização**: O pacote `@tactical-arena/shared` contém toda a lógica matemática pura e nunca importa diretamente código do browser ou do Node.
2. **Dual-Runtime (Offline vs Online)**:
   - No modo Offline, `packages/web/src/api/localEngine.ts` emula o servidor no browser/IndexedDB.
   - No modo Online, `client.ts` faz requisições HTTP/REST para `packages/server`.
3. **Persistência de Saves**: Saves são versionados com schema explícito e armazenados com integridade garantida.
