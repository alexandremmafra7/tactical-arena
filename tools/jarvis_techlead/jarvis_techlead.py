import os
import sys
import threading
import tkinter as tk
from tkinter import messagebox
import winsound
import requests
import pyperclip
import keyboard

# ==============================================================================
# CONFIGURAÇÕES DO JARVIS TECH LEAD
# ==============================================================================
# Provedores suportados: "anthropic" (Claude), "openai" (GPT-4o), "gemini"
API_PROVIDER = os.getenv("JARVIS_API_PROVIDER", "anthropic")
API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY") or ""

SYSTEM_PROMPT = """Você é um Staff Software Engineer e Principal Architect com mais de 20 anos de experiência em engenharia de software e liderança técnica.
Seu único objetivo é receber ideias, requisitos brutos ou ordens informais do usuário e transformá-los em **prompts de engenharia de software de altíssima precisão**, projetados para extrair o melhor resultado de LLMs de programação (Claude 3.7 Sonnet, Claude Code, Cursor ou Antigravity).

Ao receber qualquer pedido do usuário, converta-o estritamente na seguinte estrutura padrão:

### 🎯 1. Objetivo & Contexto
- Resumo executivo da demanda e impacto esperado.
- Escopo e arquitetura geral proposta.

### 🏗️ 2. Especificação Técnica & Arquitetura
- Padrões de design recomendados (Clean Architecture, SOLID, DTOs, Repository, etc.).
- Tipagem estrita, separação de camadas e desacoplamento.
- Contratos de dados / interfaces esperadas.

### 🛡️ 3. Regras de Negócio & Edge Cases (Casos de Borda)
- Validações críticas de input, sanitização e tolerância a falhas.
- Tratamento explícito de exceções e fallbacks.
- Considerações de concorrência, segurança ou performance (se aplicável).

### 📋 4. Critérios de Aceite & Checklist de Implementação
- Passo a passo numerado e objetivo do que o código deve conter.
- Arquivos/módulos sugeridos a serem criados ou modificados.

### 🧪 5. Plano de Testes & Verificação
- Cenários de testes unitários e de integração obrigatórios.

Diretrizes de Tom:
- Seja direto, técnico e imperativo.
- Elimine ambiguidades: assuma a melhor prática de mercado para o caso concreto.
- Entregue pronto para cópia."""

def chamar_api_ia(prompt_bruto):
    """Envia a ideia bruta para a IA e devolve o prompt estruturado de Tech Lead."""
    if not API_KEY or API_KEY.startswith("SUA_CHAVE"):
        # Modo Fallback / Demonstração local caso a chave não esteja configurada ainda
        return f"""### 🎯 1. Objetivo & Contexto
- Implementação da funcionalidade: {prompt_bruto}
- Objetivo: Modularizar a lógica garantindo manutenibilidade, desacoplamento e aderência às melhores práticas de engenharia.

### 🏗️ 2. Especificação Técnica & Arquitetura
- Aplicar princípios SOLID e separação de responsabilidades (SRP).
- Definir interfaces claras e contratos de dados tipados.
- Isolar efeitos colaterais em serviços de infraestrutura/repositório.

### 🛡️ 3. Regras de Negócio & Edge Cases
- Validar inputs sanitizando dados antes do processamento.
- Implementar tratamento de exceções com fallbacks resilientes.
- Garantir comportamento determinístico e idempotente nas operações críticas.

### 📋 4. Critérios de Aceite & Checklist de Implementação
1. Criar interfaces/tipos correspondentes à funcionalidade.
2. Implementar o serviço principal com injeção de dependências.
3. Adicionar logs estruturados e tratamento de erro centralizado.

### 🧪 5. Plano de Testes & Verificação
- Testar cenários de sucesso e fluxos alternativos com inputs inválidos.
- Cobrir casos de borda e tratamento de falhas externas.

*(Configure sua ANTHROPIC_API_KEY ou OPENAI_API_KEY nas variáveis de ambiente ou no topo do arquivo para integração direta com a API)*"""

    if API_PROVIDER == "anthropic":
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 1800,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": prompt_bruto}]
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        if resp.status_code == 200:
            return resp.json()["content"][0]["text"]
        raise Exception(f"Erro Anthropic ({resp.status_code}): {resp.text}")

    elif API_PROVIDER == "openai":
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "gpt-4o",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt_bruto}
            ]
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
        raise Exception(f"Erro OpenAI ({resp.status_code}): {resp.text}")

class JarvisTechLeadUI:
    def __init__(self):
        self.root = None
        self.is_open = False

    def abrir_janela(self):
        if self.is_open:
            return
        
        self.is_open = True
        self.root = tk.Tk()
        self.root.title("🤖 Jarvis - Tech Lead Prompt Refiner")
        self.root.geometry("600x420")
        self.root.configure(bg="#181825")
        self.root.attributes("-topmost", True)

        # Centralizar na tela
        self.root.update_idletasks()
        w = self.root.winfo_screenwidth()
        h = self.root.winfo_screenheight()
        x = (w // 2) - (600 // 2)
        y = (h // 2) - (420 // 2)
        self.root.geometry(f"600x420+{x}+{y}")

        # Título
        lbl_titulo = tk.Label(
            self.root, 
            text="O que você deseja implementar?", 
            font=("Segoe UI", 13, "bold"), 
            fg="#cdd6f4", 
            bg="#181825"
        )
        lbl_titulo.pack(pady=(16, 6))

        # Subtítulo de ajuda
        lbl_sub = tk.Label(
            self.root, 
            text="Fale no microfone ou digite sua ideia de forma simples e direta:", 
            font=("Segoe UI", 9), 
            fg="#a6adc8", 
            bg="#181825"
        )
        lbl_sub.pack(pady=(0, 8))

        # Caixa de Texto
        self.txt_input = tk.Text(
            self.root, 
            height=7, 
            font=("Consolas", 10), 
            bg="#1e1e2e", 
            fg="#cdd6f4", 
            insertbackground="#cdd6f4",
            relief="flat",
            padx=12, 
            pady=10,
            wrap="word"
        )
        self.txt_input.pack(fill="x", padx=20, pady=5)
        self.txt_input.focus_set()

        # Status / Feedback
        self.lbl_status = tk.Label(
            self.root, 
            text="Dica: Enter para gerar | Esc para fechar | Botão para ditar por voz", 
            font=("Segoe UI", 9), 
            fg="#6c7086", 
            bg="#181825"
        )
        self.lbl_status.pack(pady=6)

        # Botões de Ação
        frame_botoes = tk.Frame(self.root, bg="#181825")
        frame_botoes.pack(pady=10)

        self.btn_mic = tk.Button(
            frame_botoes, 
            text="🎙️ Ditar por Voz", 
            command=self.ouvir_microfone,
            font=("Segoe UI", 9, "bold"),
            bg="#fab387",
            fg="#11111b",
            activebackground="#f5c2e7",
            relief="flat",
            padx=16,
            pady=7,
            cursor="hand2"
        )
        self.btn_mic.pack(side="left", padx=6)

        self.btn_processar = tk.Button(
            frame_botoes, 
            text="⚡ Gerar Prompt Tech Lead (Ctrl+V)", 
            command=self.processar,
            font=("Segoe UI", 9, "bold"),
            bg="#a6e3a1",
            fg="#11111b",
            activebackground="#94e2d5",
            relief="flat",
            padx=18,
            pady=7,
            cursor="hand2"
        )
        self.btn_processar.pack(side="left", padx=6)

        # Atalhos de Teclado
        self.root.bind("<Return>", lambda e: self.processar() if not e.state & 0x1 else None)
        self.root.bind("<Escape>", lambda e: self.fechar())
        self.root.protocol("WM_DELETE_WINDOW", self.fechar)

        self.root.mainloop()

    def fechar(self):
        self.is_open = False
        if self.root:
            try:
                self.root.destroy()
            except Exception:
                pass

    def ouvir_microfone(self):
        def _thread_mic():
            self.lbl_status.config(text="🎙️ Gravando... Fale sua ideia agora!", fg="#fab387")
            try:
                import speech_recognition as sr
                r = sr.Recognizer()
                with sr.Microphone() as source:
                    r.adjust_for_ambient_noise(source, duration=0.6)
                    audio = r.listen(source, timeout=6, phrase_time_limit=20)
                
                self.lbl_status.config(text="Transcrevendo fala em português...", fg="#89b4fa")
                texto = r.recognize_google(audio, language="pt-BR")
                
                atual = self.txt_input.get("1.0", tk.END).strip()
                novo_texto = (atual + " " + texto).strip() if atual else texto
                self.txt_input.delete("1.0", tk.END)
                self.txt_input.insert(tk.END, novo_texto)
                self.lbl_status.config(text="Fala transcrita com sucesso! Pressione Enter para gerar.", fg="#a6e3a1")
            except Exception as e:
                self.lbl_status.config(text=f"Aviso de voz: {str(e)[:50]}", fg="#f38ba8")
        
        threading.Thread(target=_thread_mic, daemon=True).start()

    def processar(self):
        prompt_bruto = self.txt_input.get("1.0", tk.END).strip()
        if not prompt_bruto:
            return

        self.lbl_status.config(text="🧠 Jarvis transformando em especificação de Tech Lead...", fg="#f9e2af")
        self.btn_processar.config(state="disabled")

        def _thread_processar():
            try:
                resultado = chamar_api_ia(prompt_bruto)
                pyperclip.copy(resultado)
                
                # Som de sucesso do Jarvis
                winsound.Beep(1200, 150)
                winsound.Beep(1800, 200)

                self.root.after(0, self.fechar)
            except Exception as e:
                def _mostrar_erro():
                    self.lbl_status.config(text=f"Erro: {str(e)[:50]}", fg="#f38ba8")
                    self.btn_processar.config(state="normal")
                self.root.after(0, _mostrar_erro)

        threading.Thread(target=_thread_processar, daemon=True).start()

# Instância da aplicação
app = JarvisTechLeadUI()

def disparar_jarvis():
    if not app.is_open:
        threading.Thread(target=app.abrir_janela, daemon=True).start()

if __name__ == "__main__":
    # Se chamado com argumento "--now", abre a janela imediatamente (útil para clique direto/Stream Deck)
    if "--now" in sys.argv:
        app.abrir_janela()
    else:
        print("="*65)
        print("🤖 JARVIS TECH LEAD INICIADO COM SUCESSO!")
        print("👉 Pressione [Ctrl + Alt + J] em qualquer tela")
        print("👉 Ou use o atalho criado no Stream Deck / Desktop")
        print("👉 O prompt técnico já vai sair copiado no seu Ctrl + V!")
        print("="*65)
        
        keyboard.add_hotkey('ctrl+alt+j', disparar_jarvis)
        keyboard.wait()
