# Contribuindo com o CATch

Leia [AGENTS.md](../AGENTS.md) antes de alterar arquivos. O mesmo processo vale
para mantenedores, colaboradores, automações e agentes de IA.

## 1. Registre a tarefa antes de desenvolver

Use GitHub CLI autenticado na conta autorizada, sem copiar tokens para o projeto:

```sh
gh auth status
gh issue list --repo Ggmata7/EmpresaOnline --state open
gh issue create --repo Ggmata7/EmpresaOnline --title "fix: descrever o problema" --body "Contexto, reprodução, escopo e critérios de aceite."
```

Bug, Feature, Chore, documentação e ajustes de deploy exigem Issue prévia. Use os
campos dos [formulários oficiais](ISSUE_TEMPLATE/) como referência também no CLI.
Para uma tarefa já registrada, valide a Issue existente em vez de duplicá-la.

## 2. Crie uma branch isolada

Substitua `123` pelo número real retornado pelo GitHub:

```sh
git status --short
git fetch origin main
git switch -c fix/issue-123-descricao origin/main
```

Para melhorias, features, documentação ou chores, use `feat/issue-123-descricao`.
Se o checkout contiver mudanças de outra tarefa, preserve-o e crie um worktree:

```sh
git worktree add -b feat/issue-123-descricao ../EmpresaOnline-issue-123 origin/main
```

Não reutilize a branch de uma tarefa encerrada. Inclua no commit apenas os arquivos
da Issue; confira `git diff` e `git diff --cached` antes de confirmar.

## 3. Desenvolva e valide

Use Node.js 24 para executar também os módulos de automação em TypeScript e pnpm
compatível com o workflow atual. Não atualize dependências sem necessidade da Issue.

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` executa lint/tipagem (`tsc --noEmit`), testes e build de produção.
Corrija as falhas antes do merge. Para alterações exclusivamente documentais,
valide adicionalmente Markdown, links relativos e sintaxe/estrutura dos Issue Forms.
Se algum comando não puder ser executado, deixe o item correspondente desmarcado,
explique a limitação e peça validação ao revisor; isso não equivale a aprovação.

Documente novas variáveis com nome, finalidade, obrigatoriedade e ambientes de uso.
Nunca publique valores reais de `.env`, `DATABASE_URL`, tokens, cookies ou chaves.
Migrações e alterações de produção precisam de plano de aplicação/rollback e
autorização explícita; testes não devem carregar ou modificar produção implicitamente.

## 4. Commits e Pull Request

Formato: `tipo(escopo opcional): resumo`. Tipos aceitos: `feat`, `fix`, `refactor`,
`perf`, `docs`, `test`, `ci`, `chore`. Use `!` e explique `BREAKING CHANGE:` quando
houver quebra de compatibilidade. Exemplos:

```text
feat(catalog): adicionar filtro por categoria
fix(collector): ignorar preço por litro
refactor(affiliates): separar adaptadores
perf(catalog): reduzir consultas repetidas
chore: documentar governança do repositório
```

Envie a branch da tarefa, nunca a `main`:

```sh
git push -u origin fix/issue-123-descricao
gh pr create --repo Ggmata7/EmpresaOnline --base main --head fix/issue-123-descricao --template .github/PULL_REQUEST_TEMPLATE.md
```

Preencha o template e substitua `Closes #<id>` pelo número real, por exemplo
`Closes #123`. Informe alterações, validações, riscos, ambiente e rollback.
O título do PR também deve seguir Conventional Commits. Não marque itens ainda
não comprovados. Responda à revisão na mesma branch e repita os checks após ajustes.

## 5. Merge e deploy

- Proibidos commits e pushes diretos na `main`, mesmo por administradores ou agentes.
- Merge exclusivamente pelo PR revisado e com as validações aprovadas. Prefira
  squash merge com título Conventional Commits; nunca simule esse fluxo com merge local.
- Agentes abrem o PR para revisão e não fazem merge sem autorização explícita.
- Deploy de produção somente a partir de commit incorporado à `main` via PR.
  Preview serve à revisão e não deve ser promovido para contornar o merge.
- Hotfixes, rollback de código e mudanças de workflow também seguem Issue → branch → PR.
- Após o merge, verifique o resultado do deploy; um push ou merge não comprova
  que a Vercel publicou com sucesso. Relate as falhas e vincule-as a uma Issue.

## Checklist administrativo de proteção

Um mantenedor deve configurar no GitHub um ruleset/proteção para `main` que exija
PR, aprovação de outro revisor, resolução de conversas e checks de CI existentes
para lint/tipagem, testes e build; bloquear force-push e exclusão, sem bypass de
administradores/agentes. Na Vercel, conferir `main` como branch de produção.

Essas configurações são externas aos templates. Não estão ativadas automaticamente
por este guia. Se os checks de PR ainda não existirem, abra uma Issue para implementá-los
antes de cadastrá-los como obrigatórios; não invente nomes de checks nem declare
proteção técnica sem confirmação no painel/API.
