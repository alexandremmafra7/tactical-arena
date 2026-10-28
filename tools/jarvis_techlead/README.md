# 🤖 Jarvis Tech Lead - Prompt Refiner

Transforma ideias informais e ordens em linguagem natural em **prompts estruturados de Tech Lead / Staff Engineer** de altíssima precisão para o Claude, Cursor, Copilot ou Antigravity.

---

## 📁 Arquivos Criados:
- `jarvis_techlead.py`: Script principal com interface visual Dark Mode, microfone e atalhos.
- `iniciar_jarvis_silencioso.vbs`: Inicializador em segundo plano sem janela preta do CMD.
- `abrir_janela_direto.bat`: Disparador instantâneo (ótimo para botão do Stream Deck).
- `requirements.txt`: Dependências Python.

---

## ⚡ Como Usar:

### 1. Instalar as dependências (primeira vez):
```powershell
pip install -r requirements.txt
```

### 2. Configurar a sua Chave de API:
Defina a variável de ambiente `ANTHROPIC_API_KEY` (ou `OPENAI_API_KEY`) no Windows, ou edite diretamente no topo do arquivo `jarvis_techlead.py`.

### 3. Usando com Atalho de Teclado:
- Dê dois cliques em `iniciar_jarvis_silencioso.vbs`.
- Pressione **`Ctrl + Alt + J`** em qualquer lugar do Windows.
- Fale ou digite sua ideia, dê **Enter**.
- Cole com **`Ctrl + V`** no Claude!

### 4. Usando no Stream Deck 🎛️:
- **Método A (Recomendado)**: Adicione uma tecla com a ação **Hotkey** configurada para `Ctrl + Alt + J`.
- **Método B**: Adicione a ação **Open (Abrir)** apontando para o arquivo `abrir_janela_direto.bat`.
