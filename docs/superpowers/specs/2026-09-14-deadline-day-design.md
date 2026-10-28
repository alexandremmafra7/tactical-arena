# Deadline Day e Leilão ao Vivo — Design

## Escopo

Implementar o Deadline Day do mercado de transferências com o mesmo comportamento no servidor e no modo offline. A funcionalidade cobre ativação da janela, leilões, lances do jogador e da IA, avanço das horas, panic sell, notícias e liquidação final das transferências.

## Arquitetura

A regra de negócio será uma função pura no pacote `@tactical-arena/shared`. Servidor e `localEngine` serão apenas adaptadores responsáveis por carregar estado, chamar o motor e persistir o resultado. Isso evita duas implementações divergentes.

O domínio compartilhado exportará `AuctionBid`, `DeadlineAuctionItem`, `DeadlineDayState` e funções para:

- criar/normalizar o estado;
- validar e registrar um lance;
- calcular o lance mínimo seguinte;
- simular lances determinísticos da IA;
- avançar `12 → 8 → 4 → 2 → 1 → 0` horas;
- aplicar panic sell de 15% a 30%;
- resolver leilões vendidos ou sem comprador;
- gerar as notícias correspondentes.

## Regras

- Um lance só é aceito em leilão `ACTIVE`, antes de zero hora.
- O clube vendedor não pode comprar o próprio jogador.
- O primeiro lance deve alcançar `minimumBid`; os seguintes devem superar o atual em pelo menos 5%.
- Valor e salário devem ser números positivos e finitos.
- Um clube não pode comprometer mais que seu orçamento disponível.
- A IA usa RNG injetado/seeded para manter testes e modo offline reproduzíveis.
- Panic sell reduz o preço mínimo entre 15% e 30%, sem alterar o valor de mercado do jogador.
- Em zero hora, o maior lance vence. Sem lance válido, o item vira `RESOLVED_UNSOLD`.
- A liquidação revalida orçamento, propriedade do jogador e existência dos clubes antes de mover dinheiro e atleta.

## Persistência do servidor

`GameState` receberá `deadlineDayJson`, inicializado com estado inativo. O serviço de Deadline Day lerá esse campo, chamará o motor compartilhado e gravará a nova versão. A transferência vencedora será liquidada em transação Prisma junto com a atualização do estado.

Rotas autenticadas:

- `GET /transfers/deadline-day?clubId=...`
- `POST /transfers/deadline-day/bid`
- `POST /transfers/deadline-day/advance`

A rota de lance valida tipos na borda. O serviço confirma que o clube comprador pertence ao usuário autenticado.

## Modo offline

`LocalGameState` receberá `deadlineDay?: DeadlineDayState`. Saves anteriores serão normalizados na leitura. As funções locais terão os mesmos contratos do cliente HTTP e usarão as mesmas funções puras do shared. A liquidação modificará `clubs` e salvará uma única nova versão do estado.

## Interface

`TransfersHub` ganhará uma aba `deadline` intitulada **⏰ Deadline Day**. Ela exibirá:

- hora restante e status da janela;
- saldo do clube;
- cards/tabela de leilões;
- maior lance, clube líder e histórico;
- campo de lance e salário;
- feed de breaking news;
- botão de avanço de hora.

A aba mostrará estado vazio quando o evento ainda não estiver ativo. Erros de regra serão exibidos no banner já existente. A implementação reutilizará estilos e componentes atuais, sem novo framework visual.

## Fluxo de dados

1. A tela busca clube e estado do Deadline Day.
2. O usuário lança ou avança uma hora pelo cliente unificado.
3. Servidor ou localEngine carrega o estado persistido.
4. O motor compartilhado valida e produz o próximo estado.
5. Ao chegar a zero, o adaptador liquida os resultados válidos.
6. A resposta atualiza leilões, notícias e saldo na tela.

## Erros e consistência

Entradas externas são rejeitadas com mensagens de domínio. Leilões já encerrados não aceitam lances. Tentativas concorrentes no servidor são revalidadas na liquidação; o estado e os clubes são gravados juntos. Falhas na liquidação deixam o item sem venda em vez de criar saldo negativo ou duplicar jogador.

## Testes

- Shared: mínimo de lance, rejeições, avanço de horas, IA determinística, panic sell e resolução.
- Servidor: autenticação/propriedade, persistência e liquidação atômica.
- Web/localEngine: contrato equivalente e persistência no save.
- Build e testes dos três workspaces para detectar exports e tipos quebrados.
