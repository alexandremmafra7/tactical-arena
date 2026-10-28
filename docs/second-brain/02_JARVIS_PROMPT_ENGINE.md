# 02. Jarvis Prompt Engine (Automação de Engenharia)
> **Tags:** `#ia` `#prompt-engineering` `#jarvis` `#stream-deck` `#automacao`

---

## 🤖 1. O Conceito do Jarvis Tech Lead
O Jarvis atua como um **compilador de intenções**: ele recebe comandos rápidos, informais ou falados no microfone e os transforma em **especificações completas de Staff/Principal Engineer** projetadas para extrair o máximo de precisão do Claude, Cursor e agentes de IA.

---

## 🛠️ 2. Arquitetura do Setup Local (`tools/jarvis_techlead/`)

- **Script Principal:** `jarvis_techlead.py`
  - **Atalho Global:** `Ctrl + Alt + J` (captura global no Windows).
  - **Interface Flutuante:** Janela minimalista Dark Mode (Tkinter) sempre no topo.
  - **Reconhecimento de Voz:** Transcrição em tempo real em Português via SpeechRecognition/Microfone.
  - **Integração Clipboard:** Resposta processada pela API do Claude/OpenAI vai direto para o `Ctrl + V` com beep de sucesso.
- **Acionador Stream Deck:**
  - `abrir_janela_direto.bat` ou tecla com atalho `Ctrl + Alt + J`.
- **Inicializador Silencioso:** `iniciar_jarvis_silencioso.vbs` (roda em background sem janela do CMD).

---

## 📐 3. Template Canônico de Prompt de Tech Lead

```markdown
### 🎯 1. Objetivo & Contexto
- Resumo executivo da demanda e arquitetura proposta.

### 🏗️ 2. Especificação Técnica & Design Patterns
- Padrões recomendados (Clean Code, SOLID, DTOs, Repository, etc.).
- Tipagem estrita e desacoplamento de responsabilidades.

### 🛡️ 3. Regras de Negócio & Edge Cases
- Validações, sanitização e casos de borda.
- Tratamento de exceções e tolerância a falhas.

### 📋 4. Critérios de Aceite & Checklist de Implementação
- Passo a passo numerado e objetivo.

### 🧪 5. Plano de Testes & Verificação
- Cenários de testes unitários e de integração essenciais.
```
