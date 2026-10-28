# 04. Fluxo Unificado de Criação de Carreira
> **Status:** design aprovado em 2026-09-08  
> **Tags:** `#onboarding` `#ux-narrative` `#arquitetura` `#saves` `#offline` `#acessibilidade`

---

## 1. Objetivo

Transformar a criação de carreira em uma única jornada imersiva, acessível e confiável. O jogador define sua identidade, escolhe o desafio e assume ou funda um clube antes de confirmar. Somente a confirmação final produz efeitos persistentes.

O fluxo deverá:

- eliminar a criação repetida de saves e identidades;
- impedir saves órfãos, sem clube ou ligados ao usuário errado;
- usar o mesmo contrato público nos runtimes online e offline;
- nunca trocar silenciosamente de runtime durante uma operação;
- preservar e migrar saves legados;
- abrir imediatamente o clube criado com dados sincronizados;
- manter a identidade visual atual do jogo, elevando narrativa, hierarquia e feedback.

## 2. Escopo

### Arquivos centrais

- `packages/web/src/components/OnboardingWizard.tsx`
- `packages/web/src/components/FoundClubForm.tsx`
- `packages/web/src/components/StartSubmenuModal.tsx`
- `packages/web/src/pages/Start.tsx`
- `packages/web/src/pages/Dashboard.tsx`
- `packages/web/src/pages/Career.tsx`
- `packages/web/src/api/client.ts`
- `packages/web/src/api/localEngine.ts`
- `packages/web/src/api/offlineWorld.ts`
- `packages/shared/src/domain/managerStyle.ts`
- `packages/shared/src/domain/gameMode.ts`
- `packages/server/src/routes/saves.ts`
- `packages/server/src/services/saveService.ts`
- serviços de clube, fundação, mandato e tática usados pela operação final

### Fora do escopo

- novo design system ou biblioteca de estado;
- novas regras ou novos IDs de modo de carreira;
- editor avançado de estádio;
- reescrita geral da persistência fora da criação, migração e carregamento de saves;
- bancos permanentemente conectados por slot nesta entrega.

## 3. Problemas confirmados

O código atual possui duas portas de criação independentes: `StartSubmenuModal` e `OnboardingWizard` dentro do Dashboard. Os dois fluxos coletam dados equivalentes e podem ser executados em sequência.

No wizard atual, `createNewSave()` é chamado após a primeira etapa e novamente ao escolher ou fundar um clube. Cada chamada online cria outro usuário, restaura o banco-base e libera clubes. O retorno com `token` e `userId` é descartado; a atribuição do clube usa a identidade anteriormente autenticada. No caminho de fundação, um clube recém-criado pode ser removido por uma restauração posterior do template.

Outros problemas confirmados:

- `StartSubmenuModal` tenta ler `claimedClubId` de uma resposta que nunca contém o campo;
- falhas HTTP de criação ou regras de negócio caem silenciosamente para o motor offline;
- `saves_index.json` usa leitura-modificação-escrita não atômica;
- o servidor substitui o arquivo SQLite enquanto existe um cliente Prisma global aberto;
- o motor offline devolve IDs que `localListSaves()` e `localLoadSave()` não respeitam;
- metadados de países e listas de clubes possuem loadings e requisições independentes;
- regras de modo aparecem em mais de um nível sem um seletor único de política;
- escolhas por cards não são integralmente operáveis por teclado;
- mudanças de etapa não gerenciam foco nem anunciam loading e erro;
- o bootstrap offline constrói e serializa o mundo na thread principal antes da primeira renderização.

## 4. Decisões aprovadas

| Tema | Decisão |
|---|---|
| Porta oficial | Central de Carreiras no menu inicial |
| Estado transitório | Um `CareerDraft` local controlado pelo `OnboardingWizard` |
| Persistência | Uma única operação na confirmação final |
| Runtime | Escolhido antes do envio e imutável durante a operação |
| Contrato | Entrada e resposta equivalentes online e offline |
| Compatibilidade | Preservar e migrar saves existentes |
| Direção visual | Evolução da identidade atual, sem novo sistema visual |
| IDs de modo | Manter `STANDARD`, `PREMIUM` e `HARDCORE` |
| Rótulos visíveis | Standard, Premium e Iron Man |
| Destino após sucesso | `ClubHome` em `/clubs/:clubId` |

## 5. Arquitetura do fluxo

```text
Start
└─ CareerHub / StartSubmenuModal
   └─ OnboardingWizard
      ├─ ManagerCredentialStep
      ├─ CareerContractStep
      ├─ ClubSelectionStep
      │  ├─ ExistingClubShowcase
      │  └─ FoundClubForm
      └─ CareerPresentationStep
```

`OnboardingWizard` é o único orquestrador da nova carreira. Ele possui o rascunho, a etapa atual, metadados, cache de clubes e estado da submissão. As etapas recebem valores e callbacks; nenhuma etapa chama API de escrita.

`FoundClubForm` passa a ser um editor controlado. Nome, cidade, porte da cidade, cores, uniforme e `CareerCrest` pertencem ao `CareerDraft` e sobrevivem à navegação entre etapas.

`StartSubmenuModal` deixa de manter um segundo formulário de técnico. `Dashboard` deixa de possuir consultas e estados de criação; uma sessão válida sem clube abre a mesma Central de Carreiras. `Career.tsx` continua como consumidor do perfil normalizado e não assume responsabilidade pelo onboarding.

## 6. Contrato compartilhado

Os tipos de criação devem viver em `@tactical-arena/shared`, sem importar tipos de infraestrutura do servidor ou navegador.

```ts
interface CreateCareerInput {
  idempotencyKey: string;
  saveName: string;
  manager: {
    firstName: string;
    lastName: string;
    nationality: string;
    style: ManagerStyleId;
    avatar: string;
    clockFormat: ClockFormat;
  };
  gameMode: GameMode;
  club:
    | { kind: 'TAKE_OVER'; clubId: string }
    | {
        kind: 'FOUND';
        countryCode: string;
        name: string;
        city: string;
        primaryColor: string;
        secondaryColor: string;
        crest: CareerCrest;
      };
}

interface CreateCareerResult {
  save: SaveSlot;
  token: string;
  userId: string;
  club: Club;
  reused: boolean;
}
```

A chave de idempotência é criada uma vez ao abrir o wizard. Voltar etapas, clicar duas vezes, sofrer timeout ou tentar novamente não gera outra chave. Reutilizar a chave com payload diferente retorna conflito.

`SaveSlot` persistido não contém `managerToken`. O token é emitido na resposta e reemitido para o `userId` quando um save é carregado.

## 7. Estado no cliente

Será usado `useReducer`; nenhuma dependência será adicionada.

```ts
interface CareerCreationState {
  step: 1 | 2 | 3 | 4;
  draft: CareerDraft;
  metadata: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    playableCountries: CountryOption[];
    foundableCountries: CountryOption[];
  };
  clubs: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    items: Club[];
    cacheKey?: string;
  };
  submission: {
    status: 'idle' | 'submitting' | 'success' | 'error';
    error?: string;
  };
}
```

Não serão armazenados valores deriváveis, incluindo:

- obrigação de fundar o próprio clube;
- divisões disponíveis para assumir;
- países elegíveis;
- validade da etapa;
- resumo final;
- descrição e restrições do contrato.

A troca de etapa altera apenas `step`. O `draft` permanece intacto até cancelamento explícito ou sucesso.

## 8. Metadados e cache

Ao montar o wizard, as consultas independentes serão iniciadas juntas:

```ts
const [playableCountries, foundableCountries] = await Promise.all([
  listPlayableCountries(),
  listFoundableCountries(),
]);
```

A interface terá um único estado de carregamento e reservará o espaço final para evitar mudança de layout. Um erro mostra tentativa novamente sem apagar o rascunho.

A lista de clubes é consultada apenas quando a etapa Clube está ativa, a escolha é `TAKE_OVER` e país/divisão são válidos. Resultados são guardados durante a vida do wizard por `countryCode:division`. Uma resposta obsoleta não pode substituir uma seleção mais recente; a implementação usará cancelamento quando disponível e um identificador monotônico de requisição como garantia local.

O cache é transitório. Não será criado cache global ou persistente para esses metadados.

## 9. Política de modo centralizada

`packages/shared/src/domain/gameMode.ts` permanece como fonte única. As novas funções compõem as regras existentes em vez de duplicá-las:

```ts
careerEntryPolicy(mode)
eligibleTakeoverDivisions(mode, divisions)
validateCareerClubChoice(mode, choice)
```

A política deriva de `canTakeOverDivision()` e `mustFoundOwnClub()`.

- `STANDARD` é exibido como **Standard**;
- `PREMIUM` é exibido como **Premium**;
- `HARDCORE` é exibido como **Iron Man**.

Os IDs persistidos e o comportamento permanecem iguais. Iron Man exige fundação. Restrições permanecem visíveis e são explicadas com texto do domínio, não apenas por controles desabilitados.

## 10. Operação online

`POST /saves/new` passa a significar criação completa da carreira. Não haverá sequência pública `createNewSave → claimClub/foundClub` no onboarding.

### Ordem da operação

1. adquirir bloqueio global curto de criação;
2. validar forma, estilo, modo, escolha e disponibilidade antes de efeitos;
3. verificar `idempotencyKey` e hash canônico do payload;
4. produzir snapshot consistente do save ativo;
5. criar banco temporário no mesmo volume do banco ativo;
6. conectar um Prisma dedicado ao banco temporário;
7. numa transação SQLite, criar usuário e perfil, assumir ou fundar clube, abrir mandato e configurar tática inicial;
8. gravar no staging o slot já associado ao clube;
9. desconectar o Prisma dedicado;
10. promover banco e índice por arquivos temporários e renomeações;
11. liberar o bloqueio e devolver o resultado.

O cliente Prisma global nunca terá seu arquivo substituído enquanto estiver conectado. Os serviços usados na criação aceitarão o cliente transacional necessário, sem introduzir uma interface genérica ou fábrica para outros fluxos.

### Atomicidade entre banco e índice

SQLite e sistema de arquivos não oferecem uma transação conjunta. A operação usará staging e um marcador durável com estados:

```text
prepared → database-promoted → index-promoted
```

No startup, qualquer marcador incompleto será concluído ou revertido antes que novas requisições de saves sejam aceitas. A carreira anterior permanece recuperável até `index-promoted`.

O índice será escrito como arquivo temporário no mesmo diretório e promovido por rename. IDs de slots usam `randomUUID()`.

### Idempotência

- chave inédita: executa a operação;
- chave concluída e mesmo hash: devolve a carreira existente com `reused: true`;
- chave existente e hash diferente: `409 IDEMPOTENCY_CONFLICT`;
- chave em progresso: espera o bloqueio e lê o resultado final ou responde com estado recuperável;
- falha antes da conclusão: repetir a mesma chave retoma ou reinicia com segurança conforme o marcador.

## 11. Operação offline

`localCreateNewSave(input)` implementa o mesmo contrato sem chamar o servidor:

1. obter o mundo-base preparado;
2. clonar o estado mínimo necessário para staging;
3. validar o payload com os seletores compartilhados;
4. aplicar perfil, modo, clube, mandato e tática no staging;
5. criar slot e registrar chave/hash de idempotência;
6. serializar e persistir uma vez;
7. promover o staging como estado ativo;
8. devolver `CreateCareerResult`.

Um erro não promove estado parcial. Repetir a mesma chave não reconstrói o mundo. `localListSaves()` e `localLoadSave(id)` passam a respeitar os IDs reais retornados na criação.

O runtime é escolhido antes da submissão. Falha online não executa `localCreateNewSave()` automaticamente. A interface pode oferecer ao jogador voltar e iniciar conscientemente uma carreira local, que usará uma nova chave e exibirá o runtime escolhido.

## 12. Migração de saves existentes

Slots recebem `schemaVersion`. Ausência desse campo identifica formato legado.

Ao carregar um save legado:

1. ler sem alterar o original;
2. aplicar valores padrão compatíveis, incluindo `gameMode: 'STANDARD'` quando ausente;
3. remover `managerToken` do formato persistido;
4. reconciliar `managerUserId` e clube por evidência inequívoca;
5. validar o resultado normalizado;
6. criar backup do índice anterior;
7. gravar e promover a nova versão atomicamente.

Ambiguidades de identidade ou clube não serão resolvidas por heurística destrutiva. Elas produzem um estado de recuperação orientado ao jogador. Invalidação por `BUILD_STAMP` deixa de descartar progresso silenciosamente.

## 13. Experiência em quatro atos

### 13.1 Credencial do Treinador

A etapa usa uma ficha oficial com nome, nacionalidade, avatar e filosofia. Os estilos vêm de `MANAGER_STYLES`. Cada opção mostra sua descrição e o bônus real correspondente ao domínio.

### 13.2 A Proposta

Os modos aparecem como contratos de carreira. Cada card informa objetivo, liberdades, restrições e consequências imutáveis antes da escolha. A seleção de Iron Man determina `FOUND` automaticamente.

### 13.3 O Clube

**Assumir:** cards mostram escudo, cores, país, divisão, orçamento e expectativa da diretoria. Cards indisponíveis explicam a restrição.

**Fundar:** `FoundClubForm` apresenta preview ao vivo de escudo procedural, cores, uniforme, cidade e estádio. O componente edita o rascunho; não chama API.

### 13.4 Assinatura e apresentação

Primeiro, a etapa mostra revisão completa e o botão **Assinar contrato**. Durante o envio, informa a atividade real sem inventar percentual. Após sucesso, usa o `club` retornado para apresentar a manchete:

> “O Treinador Alex Ribeiro é apresentado oficialmente no Clube Atlético Aurora.”

A transição então abre `/clubs/:clubId`. Recarregar durante a manchete não causa duplicação; a carreira já está íntegra e pode ser continuada.

## 14. Acessibilidade, movimento e responsividade

- escolhas e etapas interativas usam elementos nativos;
- grupos usam `fieldset` e `legend` quando apropriado;
- cards de seleção usam `button` e `aria-pressed`;
- indicador usa `aria-current="step"`;
- o título da nova etapa recebe foco programático;
- loading usa `aria-live="polite"` e `aria-busy`;
- erros usam `role="alert"` e permanecem associados ao campo ou ação;
- validação leva foco ao primeiro campo inválido;
- o modal usa `aria-modal`, foco inicial, contenção e devolução de foco;
- todos os controles têm foco visível consistente;
- desktop usa trilho lateral; Mobile/Capacitor usa indicador compacto e uma coluna;
- transições usam opacidade e pequeno deslocamento;
- `prefers-reduced-motion: reduce` remove deslocamento e atraso da apresentação;
- nenhum som novo é obrigatório; qualquer feedback futuro deverá respeitar a preferência de áudio já existente.

## 15. Erros e recuperação

A API retorna códigos estáveis e mensagem apropriada ao jogador:

| Código | Comportamento no cliente |
|---|---|
| `VALIDATION_ERROR` | volta ou foca o campo correspondente |
| `CLUB_UNAVAILABLE` | atualiza clubes e mantém o rascunho |
| `MODE_RESTRICTION` | explica a regra compartilhada |
| `IDEMPOTENCY_CONFLICT` | bloqueia reenvio e orienta reinício seguro |
| `NETWORK_ERROR` | permite tentar novamente com a mesma chave |
| `STORAGE_ERROR` | informa que a carreira anterior não foi alterada |
| `RECOVERY_REQUIRED` | aguarda recuperação antes de nova criação |

Nenhum erro de escrita será convertido em sucesso offline. Erros de leitura poderão usar cache apenas quando isso não alterar runtime ou regra de negócio.

## 16. Estratégia de testes

### Shared

- política de entrada para os três modos;
- divisões elegíveis;
- Iron Man exigindo fundação;
- combinações inválidas;
- rótulos novos sem alteração dos IDs;
- validação dos dois variantes de clube.

### Servidor

- assumir clube em cada divisão permitida;
- rejeitar divisão incompatível sem efeitos persistidos;
- fundar clube preservando nome, cidade, cores e escudo;
- associar save, usuário, clube e mandato;
- repetir chave e devolver a mesma carreira;
- rejeitar mesma chave com payload diferente;
- falhar antes da promoção e preservar carreira anterior;
- recuperar interrupção entre promoção do banco e índice;
- rejeitar payload inválido sem efeitos;
- não expor token dentro do slot.

Os testes usam diretórios e bancos temporários; nunca o `dev.db` real.

### Offline

- assumir clube e persistir uma vez;
- fundar clube preservando toda a customização;
- criar IDs distintos e carregáveis;
- evitar reinicialização em retry idempotente;
- sobreviver a reload com modo e clube corretos;
- não promover estado parcial;
- migrar save legado sem perda de progresso.

### Web

- iniciar metadados em paralelo e exibir um loading;
- preservar o rascunho ao voltar etapas;
- usar cache por país e divisão;
- ignorar resposta obsoleta;
- forçar fundação no Iron Man;
- operar todos os cards por teclado;
- mover foco entre etapas;
- chamar a criação uma vez com payload completo;
- repetir com a mesma chave após erro;
- autenticar o resultado, apresentar manchete e abrir `ClubHome`.

### E2E

Executar online e offline:

- Standard assumindo clubes permitidos em divisões disponíveis;
- Premium assumindo clube de primeira divisão;
- Iron Man fundando clube e sem opção de assumir;
- fundação com cores, escudo, cidade e estádio;
- interrupção de rede sem troca silenciosa de runtime;
- clique duplo e retry sem duplicação;
- migração e abertura de save legado;
- desktop e viewport Mobile/Capacitor;
- teclado, foco, nomes acessíveis, anúncios e movimento reduzido.

## 17. Ordem de implementação

1. contratos e seletores compartilhados;
2. criação online protegida e testes;
3. criação offline equivalente e migração;
4. wizard controlado em quatro etapas;
5. remoção dos fluxos e estados redundantes;
6. acessibilidade, responsividade e transições;
7. E2E online e offline;
8. `npm run test`;
9. `npm run build`, sem erros TypeScript;
10. execução real e validação de abertura imediata da `ClubHome`.

## 18. Critérios de aceite

- [ ] Existe uma única porta e um único rascunho de criação.
- [ ] Perfil, modo e clube são persistidos numa operação idempotente.
- [ ] Nenhum save novo termina sem clube associado.
- [ ] Metadados iniciais carregam em paralelo com um estado consolidado.
- [ ] Regras de modo são derivadas de `@tactical-arena/shared`.
- [ ] Online e offline implementam a mesma entrada e resposta.
- [ ] O runtime não muda silenciosamente após erro.
- [ ] Voltar etapas preserva todos os campos.
- [ ] Cards de clube exibem os dados exigidos e são operáveis por teclado.
- [ ] Fundação preserva cores, escudo, cidade e estádio.
- [ ] A apresentação usa dados persistidos retornados pela operação.
- [ ] O sucesso autentica o usuário correto e abre imediatamente `ClubHome`.
- [ ] Saves legados são preservados e migrados com backup.
- [ ] Desktop e Mobile/Capacitor passam pela verificação responsiva e acessível.
- [ ] `npm run test` passa.
- [ ] `npm run build` passa sem erros TypeScript.
