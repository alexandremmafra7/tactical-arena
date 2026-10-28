# 13. Pipeline de IA & Roteamento — OmniRoute
> **Tags:** `#omniroute` `#combo` `#failover` `#claude-code` `#cco` `#llm-routing`  
> *Data de Atualização: 12 de Setembro de 2026*  
> *Classificação: Segundo Cérebro / ORÁCULO / Infraestrutura de IA*

---

## ⚡ 1. Arquitetura do Combo Oficial OmniRoute

O **OmniRoute** está configurado com uma esteira de **Failover Dinâmico em 5 Níveis** com alternância contínua entre provedores gratuitos para garantir **Zero Paradas (Zero-Block)** no Lead Developer (Claude Code / CCO).

```
┌────────────────────────────────────────────────────────────────────────┐
│                      💻 Claude Code (CCO / Jarvis)                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Requisição HTTP)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         ⚡ OMNIROUTE PROXY                             │
│                  (Escalonamento & Failover Automático)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ├──► [1] 🟢 SambaNova / MiniMax-M2.7 (Main / Pinned)
                                    │     │ (Se Rate Limit / 429 / Timeout)
                                    ├──► [2] 🟡 NVIDIA NIM / Nemotron 3 Super 120B A12B
                                    │     │ (Se Rate Limit / 429 / Timeout)
                                    ├──► [3] 🔵 Gemini (AI Studio) / Gemini 3.1 Flash Lite
                                    │     │ (Se Rate Limit / 429 / Timeout)
                                    ├──► [4] 🟠 Groq / GPT OSS 120B (ou Llama-3.3-70B)
                                    │     │ (Se Rate Limit / 429 / Timeout)
                                    └──► [5] 🟣 Cloudflare Workers AI / GLM 4.7 Flash (FREE)
```

---

## 📋 2. Composição Canônica do Combo Oficial

| Ordem | Provedor | Modelo Configurado | Papel no Pipeline | Tipo de Conta |
|:---:|---|---|---|---|
| **1** | **SambaNova** | `MiniMax-M2.7` | **Titular Absoluto** (Raciocínio & Código Monorepo) | Pinned Account |
| **2** | **NVIDIA NIM** | `Nemotron 3 Super 120B A12B` | **1º Reserva** (Cálculo & Lógica Estrutural) | Dynamic Account |
| **3** | **Gemini (Google AI Studio)** | `Gemini 3.1 Flash Lite` | **2º Reserva** (Contexto Longo & Velocidade) | Dynamic Account |
| **4** | **Groq** | `GPT OSS 120B` *(ou `Llama-3.3-70B-Versatile`)* | **3º Reserva** (Execução Instantânea Ultra-Rápida) | Dynamic Account |
| **5** | **Cloudflare Workers AI** | `GLM 4.7 Flash (FREE)` | **4º Reserva** (Contingência Zero-Cost) | Dynamic Account |

---

## ⚙️ 3. Regras de Disparo & Contingência

1. **Comportamento de Fallback:**
   * Todas as opções de `[ ] fallback apenas de cota` ficam **desmarcadas** para que o OmniRoute salte para o próximo modelo caso ocorra **qualquer instabilidade** (seja erro 429 de cota, timeout ou erro temporário 5xx do upstream).
2. **Ciclo de Recuperação:**
   * Enquanto os modelos de backup (NVIDIA, Gemini, Groq, Cloudflare) respondem às chamadas, a cota por minuto do modelo principal (`SambaNova / MiniMax`) recarrega silenciosamente em background.
3. **Consumo pelo CCO:**
   * O Claude Code consome a rota unificada do OmniRoute sem necessidade de reconfiguração de chave ou reinicialização de terminal.
