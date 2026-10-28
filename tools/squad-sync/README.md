# squad-sync

Traz elencos de clubes do mundo todo para `content/clubs.csv` e `content/players.csv` (o formato que o
`npm run import:content` já lê). Duas fontes, combinadas:

| Etapa | Fonte | Custo | O que faz |
|---|---|---|---|
| Base em massa | [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) (CSV, atualizado semanalmente) | grátis | clubes + jogadores + valor de mercado → nota |
| Refino incremental | [API-Football](https://www.api-football.com) | grátis até ~100 req/dia | quem está no elenco **hoje** (transferências) |

## Uso (da raiz do repo)

```bash
npm run squads:sync        # baixa + gera content/*.generated.csv (nada é alterado ainda)
npm run squads:apply       # acrescenta ao clubs.csv/players.csv (backup .bak-squad-sync-AAAA-MM-DD)
npm run import:content     # leva ao banco (use em save novo — veja AGENTS/import-content.ts)
```

Opcional, com chave da API-Football (`API_FOOTBALL_KEY`, orçamento diário `API_FOOTBALL_DAILY_BUDGET`, padrão 90):

```bash
npm run squads:api         # busca os elencos mais antigos dentro da cota; guarda estado em cache/
npm run squads:api:apply   # reescreve esses elencos no players.csv, preservando nota/estrela de quem já existe
```

## Regras

- **Nunca sobrescreve clube existente.** Dedup por slug, nome e tokens do nome no mesmo país
  (`Boca Juniors` = `Club Atlético Boca Juniors`). Só entram clubes novos; elencos curados ficam intactos.
- **Posições canônicas:** `GK | DEF | LAT | MID | ATT` (Left/Right-Back → LAT).
- **Nota** = `55 + 9·log10(valor/100 mil)` limitada a 40–92; sem valor → 60. É uma aproximação, ajuste em `ratingFromValue`.
- Clube com menos de 11 jogadores é descartado (o jogo gera elenco sintético). Máximo de 30 por clube.
- Países fora do registro do jogo (`packages/shared/src/domain/country.ts`) são ignorados.

## Automatizar

`register-task.ps1` cria uma tarefa semanal no Agendador do Windows (`squads:sync` + `squads:api`).
**Não é executado automaticamente** — rode você mesmo quando quiser. Como a task só gera os `*.generated.csv`
e o cache, nada no jogo muda sem um `squads:apply` manual.

## Licenciamento

Nomes reais de jogadores/clubes e dados do Transfermarkt podem exigir licença para uso comercial.
Use para protótipo/uso pessoal; para publicar, troque por fonte licenciada ou nomes fictícios.
