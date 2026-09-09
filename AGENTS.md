# Regras operacionais do CATch

Estas regras valem para todo o repositório, para humanos e agentes de IA.
Antes de editar qualquer arquivo, leia este guia, [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md)
e eventuais instruções adicionais do diretório afetado. Uma solicitação de tarefa
não dispensa o fluxo de Issue, branch e Pull Request.

## Fluxo obrigatório

1. Inspecione `git status`, a branch atual e as instruções aplicáveis, sem modificar arquivos.
2. Antes da primeira alteração de cada tarefa (Bug, Feature ou Chore), crie a Issue
   no GitHub com `gh issue create --repo Ggmata7/EmpresaOnline`. Descreva objetivo,
   escopo e critérios de aceite. Se a tarefa já tiver uma Issue correspondente,
   confirme-a com `gh issue view <id>` e registre seu número; não crie duplicatas.
3. Parta da `origin/main` atualizada e use uma branch isolada:
   - `feat/issue-<id>-descricao` para funcionalidades, melhorias, documentação e chores;
   - `fix/issue-<id>-descricao` para correções.
   Use descrição curta em kebab-case. Uma tarefa/Issue por branch.
4. Preserve mudanças preexistentes. Se houver arquivos alterados de outra tarefa,
   use um worktree separado; não faça reset, stash ou limpeza automática desses arquivos.
5. Faça commits pequenos com Conventional Commits: `feat:`, `fix:`, `refactor:`,
   `perf:`, `docs:`, `test:`, `ci:` ou `chore:`; escopo é opcional, por exemplo
   `fix(collector): rejeitar preços por unidade`. Não inclua segredos ou `.env`.
6. Execute as validações descritas no guia de contribuição e registre resultados
   reais no PR. Nunca declare um teste aprovado sem executá-lo.
7. Envie somente a branch da tarefa e abra o PR com base `main`. A descrição deve
   conter `Closes #<id>` e o checklist de [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
8. Todo merge acontece exclusivamente pelo PR, após revisão e validação. Agentes
   entregam o link do PR aberto; não aprovam o próprio PR, não fazem merge nem
   ativam auto-merge sem autorização explícita do responsável.

## Proibições e deploy

- Proibidos commits, pushes e force-pushes diretos na `main`, inclusive hotfixes,
  reversões, alterações de configuração, documentação ou correções feitas por IA.
- Não usar `git push origin HEAD:main`, `git push origin main` ou merge local seguido
  de push para contornar o PR. Reversões também exigem Issue, branch e PR.
- Produção deve receber apenas commits já incorporados à `main` via PR. Preview
  da branch/PR é permitido; não promover Preview diretamente para produção.
- Não disparar deploy, migração ou alteração no Supabase de produção apenas por
  estar desenvolvendo uma tarefa. Documente impacto, rollback e autorização no PR.
- Falha de autenticação, ausência de `gh` ou bloqueio de permissões exige regularizar
  o acesso ou informar o impedimento; nunca contornar o processo pela `main`.
- Não marcar checklist automaticamente, inventar evidências de testes, expor tokens
  em logs ou apresentar configuração documentada como proteção já ativada.

## Proteção técnica

Estes arquivos definem a política, mas não bloqueiam pushes por si só. A proteção
da `main`/ruleset e os checks obrigatórios devem ser configurados por um mantenedor,
conforme o guia de contribuição. Até lá, a política continua obrigatória.
