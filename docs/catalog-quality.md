# CATch: qualidade e expansão do catálogo

## Execução (Node 24)

Com `DATABASE_URL` carregada no ambiente:

```sh
node scripts/migrate-catalog-quality.mjs
node automation/src/run-cycle.mjs
node scripts/catalog-report.mjs
pnpm test
pnpm build
```

O workflow mantém o cron de seis horas. `COLLECTOR_DISCOVERY=false` desliga a descoberta e mantém a watchlist. `COLLECTOR_DISCOVERY_PAGES` aceita 1–10 páginas por categoria (padrão 2). A verificação individual tem orçamento de 15 minutos; ofertas não verificadas não são inventadas. HTTP 401/403/429/503 ou desafios suspendem a plataforma durante o lote.

`MERCADO_LIVRE_ACCESS_TOKEN` é opcional para o cliente HTTP, mas a API respondeu 403 sem acesso autorizado no teste real. Parâmetros de afiliado não substituem permissão de API nem garantem comissão. Novas plataformas precisam de adaptador, atribuição própria e extensão explícita das moedas/enums do banco.

## Regras

- Preço unitário nunca é referência de desconto. Âncoras antigas sem evidência foram preservadas em `catalog_reference_audit`, sem acesso público, e retiradas da vitrine.
- `verified_coupon` contém `{code, price, verifiedAt, validUntil}`. Somente valores menores, positivos, verificados e ainda válidos entram na comparação; não inferir desconto a partir do código.
- Nacional compara ofertas do mesmo produto. Importados são separados por moeda e deduplicados também pelo título na exibição. Não fundir modelos/voltagens/tamanhos apenas por similaridade aproximada.
- A vitrine suporta 100 itens por categoria/região e renderiza 24 cards por lote. Configurar capacidade não comprova que a meta de estoque foi atingida.

## Execução confirmada em 2026-09-08

43 produtos novos, 11 ofertas atualizadas; 109 produtos no catálogo (103 ofertas Amazon BR, 6 Amazon US, 0 Mercado Livre). Foram arquivadas 51 referências antigas sem evidência; a auditoria final encontrou zero âncoras de desconto sem evidência. Isso não reconstrói o texto unitário original de dados históricos.

Meta de 700 produtos/100 em cada categoria **pendente**. A coleta verificou 54 ofertas e rejeitou candidatos sem dados suficientes. Mercado Livre permanece bloqueado por HTTP 403. Não confundir candidatos encontrados com produtos persistidos.
