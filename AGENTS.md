# Regras de Pós-Atualização (Post-Update Rules)

Sempre que concluir a implementação de uma funcionalidade grande, um novo Passo do Roadmap ou realizar alterações estruturais profundas ("grandes atualizações"), você deve **obrigatoriamente** seguir o fluxo de debug e validação antes de considerar a tarefa concluída:

1. **Testes do Backend e Shared:** 
   Execute `npm run test` nos pacotes `@tactical-arena/shared` e `@tactical-arena/server` para garantir que a lógica de negócio e as rotas continuam funcionando.
   
2. **Testes da Interface (Web):**
   Execute `npm run test` no pacote `@tactical-arena/web` para garantir que os componentes e a navegação não foram quebrados.
   
3. **Build de Produção:**
   Sempre execute o build das dependências e da interface (`npm run build` na raiz ou no pacote alterado) para garantir que não há erros de empacotamento.

4. **Verificação de Importações (ESM):**
   Garanta que não há importações profundas (deep imports) do pacote `shared` que quebrem o ESM (ex: importe sempre da raiz de `@tactical-arena/shared` em vez de caminhos internos).

Se algum teste falhar, você deve usar suas ferramentas para ler os logs, corrigir os erros e rodar os testes novamente. Nunca considere a tarefa "pronta" se os testes e o build não estiverem 100% verdes.

## Rotina Noturna (Nightly Build & Vault Sync)

Sempre que o usuário disser as frases **"pode empacotar que vou dormir"** ou **"vou dormir"** (ou variações), você deve iniciar a seguinte rotina de encerramento:

1. **Compilar o Executável (Build):**
   Navegue até `packages/desktop` e execute `npm run package` para gerar o `.exe` mais recente com tudo o que foi feito no dia.
   
2. **Enviar para as Pastas Padrão de Release (OBRIGATÓRIO):**
   Após o build, copie **obrigatoriamente** os executáveis (`Tactical Arena FC Setup 0.1.0.exe` e `Tactical Arena FC 0.1.0.exe`) do diretório `dist-release` para:
   - **Pasta Padrão Global de Releases:** `D:\Releases\Tactical_Arena\`
   - **Pasta de Release do Repositório:** `d:\Code\elifoot-reforged\release\desktop\`
   - **Cofre Obsidian:** `D:\Brain\Mafra\01_Projetos\Tactical_Arena\Builds\`
   
3. **Sincronizar Documentação (Opcional):**
   Aproveite para checar se há novos documentos no `docs/second-brain` que precisem ser copiados/sincronizados para `D:\Brain\Mafra\01_Projetos\Tactical_Arena\`.
   
4. Responda com uma mensagem confirmando que o empacotamento foi feito e listando os locais exatos onde os executáveis foram salvos.

## Controle de Tarefas e Consumo de Tokens

- **Nenhuma Tarefa em Segundo Plano ou Subagente Não Solicitado:** É terminantemente proibido disparar `invoke_subagent`, cron jobs (`schedule`) ou comandos em segundo plano (`IsDaemon: true` ou assíncronos desnecessários) sem que o usuário peça explicitamente.
- Todo processamento deve ser síncrono e direto na conversa principal para que o usuário tenha total controle e visibilidade do consumo de tokens.

