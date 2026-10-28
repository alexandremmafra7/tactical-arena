# 03. Sistema de Cores Dinâmicas dos Clubes
> **Tags:** `#ui-ux` `#design-system` `#css-variables` `#wcag`

---

## 🎨 1. Objetivo da Funcionalidade
Personalizar a experiência de gestão do clube: quando o usuário visualiza um jogador (`PlayerDetail.tsx`), o centro de treinamento (`Training.tsx`) ou o elenco (`Squad.tsx`), a interface adota as **cores primárias e secundárias do clube**.

---

## 🧮 2. Módulo de Cálculo (`packages/web/src/lib/clubTheme.ts`)

- **Resolução de Cores:**
  - Se o clube possui `primaryColor` no banco, usa a cor hexadecimal.
  - Caso contrário, deriva deterministicamente um `hue` a partir do `hashSeed(club.id) % 360`.
- **Cálculo de Contraste WCAG 2.1:**
  - Calcula a luminância relativa para definir `--accent-contrast` (`#ffffff` ou `#0b0b0d`), garantindo legibilidade perfeita de textos sobre botões.
- **Variáveis Injetadas:**
  - `--accent`: Cor primária ativa.
  - `--accent-contrast`: Cor do texto do botão primário.
  - `--club-primary`: Cor primária pura.
  - `--club-secondary`: Cor de apoio/secundária.
  - `--club-glow`: Sombra com canal alfa para bordas e destaques.

---

## 📱 3. Elementos Afetados
1. **Barras de Atributos (`.attr-bar-fill`)**: Preenchimento no tom do clube.
2. **Botões de Ação**: Botões primários (`⚡ Treinar`, `⚡ Treino Automático`) e bordas ativas de botões secundários.
3. **Cards & Badges**: Borda superior do card de jogador e destaques de notas de função tática (`.fit-score strong`).
