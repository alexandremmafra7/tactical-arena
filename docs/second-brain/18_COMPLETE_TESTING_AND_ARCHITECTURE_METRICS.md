# 18. Métricas de Arquitetura, Concorrência e Cobertura de Testes
> **Tags:** #testing #architecture #monorepo #quality #second-brain  
> *Data de Criação: Setembro de 2026*

---

## 📊 1. Panorama Geral de Testes (1.252 Testes Automatizados)

A suíte de testes do **Tactical Arena FC** é 100% determinística, cobrindo todas as camadas do monorepo:

| Pacote | Arquivos de Teste | Quantidade de Testes | Foco Principal |
| :--- | :--- | :--- | :--- |
| **@tactical-arena/shared** | 74 suítes | **792 testes** | Motor tático, sinergia, pênaltis, prorrogação, xG, moral, fadiga, troféus, leilões do deadline day, diretores e medicina esportiva. |
| **@tactical-arena/server** | 57 suítes | **278 testes** | Persistência SQLite/Prisma, autenticação JWT, transações atômicas financeiras, virada de temporada, direitos de TV e concorrência. |
| **@tactical-arena/web** | 25 suítes | **182 testes** | Motor offline (localEngine.ts), interface React, persistência em localStorage, wizard de onboarding e áudio WebAudio. |
| **Total do Monorepo** | **156 suítes** | **1.252 testes** | **100% Aprovados (Zero Falhas)** |

---

## 🧱 2. Princípios Arquiteturais Inegociáveis

1. **Domínio Puro no @tactical-arena/shared**: Nenhuma regra de futebol, cálculo tático ou progressão de estado depende de banco de dados ou frameworks.
2. **Paridade Absoluta Online ⇄ Offline**: Qualquer funcionalidade que existe no servidor deve funcionar de maneira equivalente no modo Offline / Desktop (localEngine.ts).
3. **Persistência Atômica e Imutável**: Nenhuma transferência ou evento esportivo move fundos ou jogadores pela metade.
4. **Isolamento de Saves**: Múltiplos saves/carreiras coexistem sem colisão de clubes ou jogadores.
