# 17. Sintetizador de Áudio e Efeitos Sonoros da Partida (WebAudio Architecture)
> **Tags:** #audio #sfx #webaudio #match-engine #second-brain  
> *Data de Criação: Setembro de 2026*

---

## 🧭 1. Visão Geral

Para garantir uma experiência de jogo imersiva, retrô e de alta fidelidade sem pesar no carregamento (zero dependência de centenas de megabytes de arquivos MP3/WAV pesados), o **Tactical Arena FC** utiliza uma **Engine de Síntese WebAudio Pura** em tempo real.

`
[ Evento da Partida / UI ] ──► [ WebAudio Synthesizer ] ──► [ Filtros Bi-quad + Harmônicos ] ──► [ Áudio Cristalino e Suave ]
`

---

## 🎧 2. Catálogo de Efeitos Sintetizados

Localizado em [packages/web/src/lib/soundEffects.ts](file:///d:/Code/elifoot-reforged/packages/web/src/lib/soundEffects.ts):

| Efeito | Descrição & Síntese | Frequências & Envelopes |
| :--- | :--- | :--- |
| **⚽ Gol / Explosão da Torcida** | Acorde ressonante maior + ruído branco filtrado com passa-baixa e reverberação suave. | 440Hz / 554Hz / 659Hz + Lowpass 400Hz com decay longo. |
| **📢 Apito do Árbitro** | Dois osciladores senoidais com modulação de frequência suave (sem o estridente de ondas quadradas). | 2800Hz e 3200Hz com vibrato de 25Hz. |
| **💥 Chute na Bola / Finalização** | Impacto abafado com onda triangular e queda rápida de pitch. | 140Hz descendo para 40Hz em 80ms. |
| **🥅 Bola na Trave** | Ressonância metálica com decay exponencial e harmônicos agudos. | 820Hz com filtro ressonante Q=15. |
| **🟨 Cartão Amarelo / Vermelho** | Tom de alerta dramático curto e pontual. | Onda senoidal dupla 600Hz -> 450Hz. |
| **✨ Interface & Cliques de Menu** | Pop sutil e satisfatório com micro-delay. | Onda senoidal 800Hz em 30ms com fade suave. |

---

## 🛡️ 3. Tratamento de Políticas de Autoplay do Navegador

* **Inicialização Preguiçosa (*Lazy AudioContext*)**: O AudioContext é instanciado e desbloqueado no primeiro clique/interação do usuário.
* **Mudo e Controle de Volume Global**: O volume mestre é ajustado nas preferências e respeita o silenciador do sistema.
