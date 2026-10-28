# Fase 05: Auditoria de Menus & Arquitetura de Navegação - Design Consolidado

> **Tags:** `#ui-ux` `#navigation` `#ergonomia` `#game-design`

## 1. Visão Geral

Este documento especifica as mudanças necessárias para atender aos objetivos da Fase 05: Auditoria de Menus & Arquitetura de Navegação, com foco em eliminar gargalos de navegação, reorganizar a navegação de primeiro nível e transformar o ClubHome em uma "Sala de Comando".

## 2. Objetivos Específicos

### 2.1 Eliminar Gargalos & Hubs Intermediários (Regra dos 2 Cliques)
- Qualquer tela essencial de gestão deve ser acessível em no máximo 2 toques a partir de qualquer ponto do jogo.
- Telas essenciais: Tática / Prancheta, Elenco, Treino, Mercado de Transferências, Finanças, Tabela da Liga, Chave de Copa.
- Refatorar `ClubNav.tsx` e `HubSubnav.tsx` para evitar telas intermediárias estáticas (TeamHub, FinanceHub).

### 2.2 Reorganização de 1º Nível & Atalhos de Alta Frequência
- Desafogar o menu "Minha equipe" (que acumulou 6 subitens).
- Criar atalhos visuais diretos de transição rápida entre Tática e Elenco.
- Links diretos na barra/cabeçalho para o Próximo Confronto / Competições.

### 2.3 Dashboard "Sala de Comando" (ClubHome.tsx)
- Transformar a tela inicial do clube em uma central de widgets acionáveis:
  - Status do próximo rival
  - Scout rápido do próximo rival
  - Alertas de contratos expirando
  - Saldo de caixa
  - Moral do elenco
- Substituir cards de navegação estáticos por widgets informativos e acionáveis.

## 3. Decisões de Arquitetura

### 3.1 Hubs Estáticos vs. Funcionais
- **TeamHub** e **FinanceHub** serão convertidos em páginas de redirecionamento que imediatamente encaminham o usuário para seus destinos primários relevantes, mantendo compatibilidade com links existentes, mas não sendo mais portais obrigatórios.
- **CompetitionsHub** permanecerá como hub funcional devido ao seu estado dinâmico e links contextualizados para ligas/copas específicas do clube.
- **TransfersHub** permanece inalterado como workspace funcional de gestão de transferências.
- **HistoryHub** permanece como hub de consulta para informações históricas de baixa frequência.

### 3.2 Estratégia de Redirecionamento
- Rotas `/clubs/:clubId/team` e `/clubs/:clubId/financial` serão aliases declarativos com `<Navigate replace>` para:
  - `/clubs/:clubId/squad` (para team)
  - `/clubs/:clubId/finance` (para financial)
- Isso mantém a retrocompatibilidade enquanto elimina a necessidade de passar por hubs estáticos.
- O comportamento de "Voltar" será padronizado para navegar hierarquicamente para cima na estrutura real, não para hubs artificiais.

### 3.3 Navegação Persistente (ClubNav)
- **Desktop**: Manter acesso direto a:
  - Elenco (`/clubs/:id/squad`)
  - Tática (`/clubs/:id/tactics`)
  - Competições (`/clubs/:id/competitions`) - manter como entrada para o hub funcional
  - Mercado (`/clubs/:id/transfers`)
  - Finanças (`/clubs/:id/finance`)
  - Clube/História (`/clubs/:id/history`)
- **Mobile Bottom Nav**: Manter os 4 ícones fixos (Início, Elenco, Tática, Competições) + botão "Mais"
- **Mobile Drawer ("Mais")**: Reorganizar para reduzir congestionamento, priorizando acesso frequente.

### 3.4 Navegação de Irmãos (HubSubnav)
- Manter o componente para navegação entre telas irmãs dentro do mesmo contexto.
- Atualizar grupos para refletir a nova estrutura após redirecionamentos.
- Garantir que targets de touch tenham mínimo 48x48 dp.

### 3.5 Links Diretos no Cabeçalho
- Adicionar links diretos no topbar para:
  - Próximo Confronto (`/clubs/:clubId/briefing`)
  - Competições (`/clubs/:clubId/competitions`) - acesso direto além do nav existente
- Posicionar esses links de forma visível e acessível no topbar.

### 3.6 ClubHome como Sala de Comando
- Substituir a seção atual de cards por widgets acionáveis em grid responsivo.
- Widgets necessários:
  1. **Próximo Confronto**: Mostrar adversário, data, local, com link direto para briefing
  2. **Scout Rápido do Rival**: Resumo visual de forças/fraquezas baseado em dados já carregados
  3. **Alertas de Contratos**: Lista de jogadores com contratos vencendo em <30 dias, link para gestão de contratos
  4. **Saldo de Caixa**: Valor atual com tendência semanal, link para extrato detalhado
  5. **Moral do Elenco**: Indicador visual da moral média do elenco, link para página de elenco/detalhes
- Cada widget deve ter target de touch mínimo 48x48 dp e indicar claramente sua interatividade.

### 3.7 Conformidade com Neo-Myth Tech
- **Fonte Display**: Space Grotesk (títulos, labels importantes)
- **Fonte Funcional**: Inter (textos corporais, dados)
- **Paleta Canônica**: Usar exatamente as variáveis CSS definidas em styles.css
- **Touch Targets**: Garantir mínimo 48x48 dp em todos os elementos interativos
- Abordagem offline-safe: hospedar fontes localmente em `/public/fonts/`

## 4. Mapeamento de Rotas e Navegação

### 4.1 Rotas Principais (Acesso em ≤2 cliques a partir de qualquer tela de gestão)
```
/clubs/:id/squad              ← Elenco (direto)
/clubs/:id/tactics            ← Tática (direto)
/clubs/:id/training           ← Treino (direto após remoção do hub intermediário)
/clubs/:id/transfers          ← Mercado (direto)
/clubs/:id/finance            ← Finanças (direto após redirecionamento)
/league/:leagueId             ← Tabela da Liga (direto via competições → league)
/cup/:cupId                   ← Chave de Copa (direto via competições → cup)
```

### 4.2 Fluxo de Redirecionamento
```
/clubs/:id/team              → (redirect) → /clubs/:id/squad
/clubs/:id/financial         → (redirect) → /clubs/:id/finance
```

### 4.3 Comportamento do Botão "Voltar"
- Deve navegar hierarquicamente para cima na estrutura real de navegação
- Nunca deve levar a um hub estático como destino final
- Exemplos:
  - De `/clubs/:id/squad` → `/clubs/:id` (ClubHome)
  - De `/clubs/:id/tactics` → `/clubs/:id` (ClubHome)
  - De `/league/:leagueId` → `/clubs/:myClubId/competitions` (se no contexto de clube)
  - De `/cup/:cupId` → `/clubs/:myClubId/competitions` (se no contexto de clube)

## 5. Não-Funcionais e Restrições

### 5.1 Conformidade Técnica
- Manter total conformidade com o Design System Neo-Myth Tech
- Space Grotesk para display/hierarchy, Inter para funcional/body text
- Paleta canônica exatamente como definida
- Minimum touch target de 48×48 dp verificado em browsers reais

### 5.2 Qualidade e Testes
- Garantir que `npm run build -w packages/web` continue 100% íntegro
- Garantir que root `npm run build` continue 100% íntegro
- Criar testes automatizados para validar a regra dos 2 cliques
- Executar suíte de testes de ponta a ponta após as mudanças
- Não adicionar novas dependências a menos que seja absolutamente necessário

### 5.3 Metodologia de Implementação
- Abordagem TDD: escrever testes falhando primeiro, depois implementar
- Ponytail/YAGNI: reutilizar estruturas existentes, evitar abstrações especulativas
- Fazer as menores mudanças possíveis que atendam aos requisitos
- Deixar verificações runtime para lógica não trivial
- Preservar compatibilidade com links existentes através de redirecionamentos

## 6. Critérios de Aceitação

### 6.1 Funcionais
- [ ] Todas as telas essenciais de gestão acessíveis em ≤2 toques a partir de qualquer ponto do jogo
- [ ] Menu "Minha equipe" desafogado (máximo 4 subitens visíveis sem scroll)
- [ ] Acesso visual direto entre Tática e Elenco (já existente, manter)
- [ ] Links diretos no cabeçalho para Próximo Confronto e Competições
- [ ] ClubHome funcionando como Sala de Comando com widgets acionáveis
- [ ] Nenhum hub estático (TeamHub, FinanceHub) como destino obrigatório de navegação

### 6.2 Técnicos
- [ ] Build do web package passando 100%
- [ ] Build raiz passando 100%
- [ ] Testes unitários de navegação passando
- [ ] Testes E2E de navegação passando (desktop e mobile)
- [ ] Conformidade com Neo-Myth Tech verificada (fontes, palette, touch targets)
- [ ] Nenhuma nova dependência adicionada desnecessariamente

### 6.3 Experiência do Usuário
- [ ] Redução perceptível no número de cliques para tarefas de gestão frequentes
- [ ] Fluxo de navegação intuitivo e consistente
- [ ] Feedback visual claro para elementos interativos
- [ ] Acessibilidade preservada (foco, contraste, leitura de tela)

## 7. Riscos e Mitigações

### 7.1 Risco: Quebra de Links Existentes
- Mitigação: Implementar redirecionamentos em vez de remoção direta de rotas
- Mitigação: Manter rotas antigas funcionando como aliases através de redirect

### 7.2 Risco: Inconsistência no Comportamento do "Voltar"
- Mitigação: Definir e documentar claramente a hierarquia de navegação real
- Mitigação: Centralizar lógica de navegação de retorno onde possível

### 7.3 Risco: Sobrecarga Visual no ClubHome
- Mitigação: Usar grid responsivo com limites claros para número de widgets
- Mitigação: Priorizar informações mais acionáveis e relevantes

### 7.4 Risco: Não-conformidade com Touch Targets
- Mitigação: Especificar mínimo 48x48 dp explicitamente em CSS
- Mitigação: Testar em dispositivos reais e emuladores