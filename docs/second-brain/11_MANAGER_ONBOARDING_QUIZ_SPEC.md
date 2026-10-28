# 🧠 Especificação: Quiz de Estilo de Treinador (Brasfooter vs FMer)
> **Onboarding Narrativo, Identificação de Perfil e Auto-Configuração de Carreira**  
> *Tactical Arena FC / Elifoot Reforged*

---

## 🎯 1. Objetivo
Permitir que qualquer jogador recém-chegado defina sua experiência de jogo ideal (seja ela a agilidade clássica do **Brasfoot** ou a profundidade tática do **Football Manager**) de forma fluida, imersiva e sem formulários técnicos chatos.

---

## 📋 2. As 4 Perguntas da Entrevista da Diretoria

```
[ Criação do Técnico ] ──► [ Entrevista da Diretoria ] ──► [ Perfil Identificado ] ──► [ Início de Carreira ]
                                (4 Perguntas)              ⚡ Brasfoot / ⚖️ Equilibrado / 🧠 FM
```

1. **Dia do Jogo (Substituições & Ritmo):**
   - **A (⚡ Brasfoot):** Auxiliar coloca o melhor reserva de imediato sem travar a partida.
   - **B (🧠 FM):** Pausa total para análise na prancheta tática.
2. **Mercado da Bola (Contratações & Alvos):**
   - **A (⚡ Brasfoot):** Lista de recomendações prontas do Diretor para compra em 1 clique.
   - **B (🧠 FM):** Relatórios de olheiros, histórico e atributos detalhados.
3. **Vestiário & Contratos (Burocracia):**
   - **A (⚡ Brasfoot):** Diretoria renova automaticamente atletas de composição; treinador foca apenas nas estrelas.
   - **B (🧠 FM):** Negociação manual minuciosa de cada vínculo.
4. **Rotina de Treinamento (Desenvolvimento):**
   - **A (⚡ Brasfoot):** Treino geral para manter fôlego e foco no jogo.
   - **B (🧠 FM):** Treino individual focado em atributos específicos.

---

## ⚙️ 3. Integração Técnica
- Componente: `ManagerStyleQuizModal.tsx` integrado ao `OnboardingWizard.tsx`.
- Ao concluir o quiz, o perfil ativa automaticamente o preset `StaffDelegationConfig` (`brasfoot_casual`, `balanced` ou `football_manager_hardcore`) no momento em que o clube é assumido ou fundado.
