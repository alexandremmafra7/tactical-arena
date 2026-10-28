# 09. Padrão Visual & Design System
> **Tags:** `#ui-ux` `#design-system` `#css-tokens` `#typography` `#wcag` `#stadium-night`

---

## 🏟️ 1. Filosofia de Design & Identidade

O padrão visual do **Tactical Arena (Elifoot Reforged)** foi concebido sob a estética **"Stadium Night"** (Noite de Estádio):
- **Imersão Clássica & Moderna**: Combina a sobriedade dos simuladores táticos europeus com a nostalgia elegante do futebol clássico.
- **Dark Theme Nativo**: Fundo escuro profundo com iluminação pontual dourada (`#d4af37`), reduzindo a fadiga visual em sessões longas.
- **Zero Dependências de CDN**: Todos os assets visuais, ícones e fontes tipográficas são empacotados localmente (`public/fonts/`), garantindo fidelidade visual e funcionamento 100% offline em Desktop e Mobile (Android/Capacitor).

---

## 🎨 2. Tokens de Design & Paleta de Cores

As cores globais são declaradas no `:root` em `packages/web/src/styles.css` e podem ser consumidas por qualquer componente.

### 🌟 Paleta Base (Stadium Night)

| Variável | Valor Hex | Função & Uso |
|---|---|---|
| `--bg` | `#0b0b0d` | Fundo principal da aplicação (preto azulado/noite profunda). |
| `--fg` | `#f2ecdd` | Cor de texto principal (off-white quente de alta legibilidade). |
| `--card` | `#18161a` | Superfície de cartões, painéis, modais e seções elevadas. |
| `--accent` | `#d4af37` | Dourado troféu/ouro — destaque principal, botões de ação e links. |
| `--muted` | `#9a9488` | Rótulos secundários, metadados, legendas e textos de suporte. |
| `--error` | `#ff6b6b` | Alertas críticos, avisos de rebaixamento, lesões e cartões vermelhos. |

### 🛡️ Variáveis Dinâmicas de Clube (`clubTheme.ts`)

Quando o usuário está no contexto de um clube específico (Elenco, Detalhes do Jogador, Centro de Treinamento), o tema injeta propriedades customizadas baseadas na identidade da equipe:

| Variável | Descrição |
|---|---|
| `--club-primary` | Cor primária oficial do clube (ou derivada deterministicamente via hash). |
| `--club-secondary` | Cor secundária de apoio para contraste e detalhes. |
| `--accent-contrast` | `#ffffff` ou `#0b0b0d`, calculado via WCAG 2.1 sobre a cor primária para garantir leitura perfeita. |
| `--club-glow` | Sombra/halo suave com canal alfa aplicada a bordas e banners ativos. |

---

## 🔤 3. Tipografia

A hierarquia tipográfica utiliza fontes variáveis self-hosted com fallback para o sistema operacional.

```css
--font-display: 'Space Grotesk', -apple-system, Segoe UI, Roboto, Arial, sans-serif;
--font-body: 'Inter', -apple-system, Segoe UI, Roboto, Arial, sans-serif;
```

### 📋 Famílias e Aplicações

1. **Space Grotesk (`--font-display`)**:
   - **Uso**: Títulos (`h1`, `h2`, `h3`), cabeçalhos de tabelas, badges táticas, números de placar e botões principais.
   - **Personalidade**: Geométrica, moderna e com forte presença visual esportiva.
2. **Inter (`--font-body`)**:
   - **Uso**: Textos corridos, atributos de jogadores, listas de transferências, relatórios da diretoria e formulários.
   - **Personalidade**: Alta legibilidade e renderização cristalina em qualquer densidade de pixels.
3. **Bebas Neue**:
   - **Uso**: Números de camisa e placares de impacto na partida ao vivo.

---

## 📐 4. Layout, Grid e Responsividade

### 🖥️ Contêiner da Página (`.page`)
- **Largura Fluida Controlada**: `max-width: min(92vw, 1100px)`.
- **Justificativa**: Evita colunas excessivamente esticadas em monitores Ultra-Wide (4K/1440p) e elimina calhas mortas em janelas menores.
- **Espaçamento**: Margem automática centralizada com padding inferior generoso (`64px`) para acomodar barras de navegação flutuantes em mobile.

### 🖼️ Backdrop de Estádio
- Elemento pseudo `body::before` posicionado com `position: fixed; inset: 0; z-index: -1`.
- Gradiente vertical sobreposto à imagem `/bg-stadium.png` que mantém o estádio visível sem competir com o texto dos cards.

---

## 🧩 5. Componentes Padrão & Anatomia Visual

### 🔘 Botões (`button`, `.btn-*`)

```css
/* Botão Primário */
.btn-primary {
  background: var(--accent);
  color: var(--accent-contrast, #1a1400);
  font-family: var(--font-display);
  font-weight: 700;
  border-radius: 8px;
  padding: 10px 18px;
  border: none;
  cursor: pointer;
  transition: transform 0.1s ease, filter 0.15s ease;
}

/* Hover e Foco Acessível */
.btn-primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
```

- **`.btn-secondary`**: Fundo transparente ou `rgba(255,255,255,0.06)` com borda sutil de 1px.
- **`.btn-danger`**: Fundo no tom `--error` com texto contrastante para ações destrutivas (rescindir, demitir).

### 🃏 Cards e Painéis (`.card`, `.panel`)
- Fundo: `var(--card)`.
- Borda: `1px solid rgba(255, 255, 255, 0.08)`.
- Raio de Borda (`border-radius`): `10px` a `14px`.
- Padding interno padrão: `16px` a `24px`.

### 📊 Barras de Atributo (`.attr-bar`)
- Barra de fundo: `rgba(255, 255, 255, 0.1)`.
- Preenchimento (`.attr-bar-fill`): `var(--accent)` ou `var(--club-primary)`.
- Escala de Cores por Nota:
  - **85+**: Dourado / Elite (`#d4af37` ou `#eab308`)
  - **70 - 84**: Verde / Titular Forte (`#22c55e`)
  - **55 - 69**: Azul / Composição de Elenco (`#3b82f6`)
  - **< 55**: Cinza Neutro (`#9a9488`)

### 🎖️ 5.1. Badges e Tiers Especiais de Jogadores (`SpecialPlayerBadge`)

Para identificação visual instantânea de estrelas, talentos e promessas, o jogo adota 3 tiers canônicos:

| Badge / Tier | Ícone Local | Critérios de Disparo | Tratamento Visual |
|---|---|---|---|
| **GÊNIO** | `/icons/genio.png` | `overall >= 88` OU craque mundial consagrado (`isKnownStandoutName`) | Halo dourado (`#ffd700`), badge `.tier-genio` com borda iluminada. |
| **BAITA JOGADOR** | `/icons/diferenciado.png` | `overall >= 80` OU `diferenciado === true` OU craque nacional | Halo ciano/azul elétrico (`#38bdf8`), badge `.tier-baita`. |
| **PROMESSA SUB-20** | `/icons/promessa-sub20.png` | `age <= 20 && potential >= 82` | Fundo arredondado `.promessa-glow-bg`, halo esmeralda (`#4ade80`). |

#### 📋 Modal de Legenda de Jogadores Especiais (`SpecialPlayersLegend.tsx`)
* Cabeçalho de colunas simplificado com `"Nome"` direto (sem "Nome sugerido").
* Layout fixo com quebra de linha automática (`table-layout: fixed; width: 100%; word-break: break-word`) evitando scroll horizontal.
* Ícone da Promessa Sub-20 harmonizado com o mesmo formato de quadro arredondado dos demais.

---

## ♿ 6. Diretrizes de Acessibilidade (WCAG 2.1)

1. **Contraste Mínimo de 4.5:1**:
   - Todo texto informativo contra fundo escuro utiliza `--fg` (`#f2ecdd`), atingindo contraste > 12:1.
   - Textos de botão dinâmico alternam automaticamente entre preto e branco conforme a cor do clube.
2. **Foco Visível (`:focus-visible`)**:
   - Elementos interativos recebem `outline: 2px solid var(--accent); outline-offset: 2px` na navegação por teclado.
3. **Área de Toque Mobile**:
   - Botões e itens de menu possuem altura mínima de `44px` para uso confortável em telas sensíveis ao toque.

---

## 📜 7. Regras de Ouro para Novos Componentes

1. 🚫 **Não use cores hexadecimais soltas no CSS**: Utilize sempre `var(--bg)`, `var(--card)`, `var(--fg)`, `var(--accent)` e `var(--muted)`.
2. 🚫 **Não importe fontes do Google Fonts via `@import url(...)`**: O jogo roda offline; fontes devem ser declaradas localmente.
3. ✅ **Mantenha a consistência da 'Regra dos 2 Cliques'**: Menus e submenus devem levar o jogador à ação com clareza visual imediata.
4. ✅ **Preserve o tema Stadium Night**: Modais e overlays devem utilizar transparências escuras com blur suave (`backdrop-filter: blur(8px)`).

