# CATch — operação

## Entregue nesta versão

- Identidade CATch, JPG convertido em WebP (43 KB), vídeo WebM/MP4 abaixo de 1 MB por formato, pausa e movimento reduzido.
- PostCSS/Tailwind 4 configurado explicitamente; sem esse arquivo as classes da interface não eram compiladas.
- Filtros de categoria/loja, ordenação, favoritos locais, transparência e links de saída explícitos.
- ISR 900 s, skeleton, imagens com tamanho reservado e URLs externas restritas às CDNs das três lojas.
- `/api/c/[slug]?offer=ID`: seleção explícita da loja; rota genérica escolhe a oferta regional do mesmo produto. Links antigos `/api/click/` continuam válidos. Analytics via `after`, sem bloquear o redirect 307.
- Banco PostgreSQL Drizzle com products, offers, offer_price_history e click_analytics. Migração aditiva em database/migrations/20260905_catch_catalog_v2.sql, mantendo tabelas antigas.

## Estado e ativação

Migração aplicada no Supabase em 05/09/2026: 60 ofertas Amazon BR copiadas. O catálogo mantém leitura legada enquanto `CATALOG_SCHEMA_VERSION` não for `2`, para continuar acompanhando a ingestão existente. Não foram inventados produtos Amazon EUA ou Mercado Livre.

Antes de ativar: configurar no servidor as credenciais Creators API de cada Amazon, `MERCADO_LIVRE_ACCESS_TOKEN`, `CRON_SECRET` (32+ caracteres), `DATABASE_URL` do pooler e `CATALOG_SCHEMA_VERSION=2`. As credenciais da API são diferentes da sessão de login no painel. Valores exclusivamente no servidor, nunca NEXT_PUBLIC.

Após validar GET autenticado `/api/cron/sync-offers`, configurar secret CRON_SECRET e variables PUBLIC_SITE_URL + CATCH_SYNC_ENABLED=true no GitHub. O workflow troca da ingestão legada para o endpoint protegido a cada 6h. Não ativar ambos contra fontes divergentes. Erros e adaptadores não configurados não renovam artificialmente timestamps.

O pipeline consulta ofertas existentes, não descobre automaticamente produtos novos. Novos ASINs/IDs e links oficiais de Mercado Livre precisam ser cadastrados nas fontes. Itens equivalentes só são agrupados quando vinculados ao mesmo product_id; títulos parecidos não são prova de equivalência.

Os preços antigos misturam referências de lista e médias. Por isso são rotulados como referência; selos de histórico exigem provenance comprovada. Uma meta FCP <1s ou melhora de 50% exige medição comparável; não foi garantida.

## Validação

`pnpm test` inclui parser/concurrency + seleção regional/destinos de afiliado. `pnpm lint` e `pnpm build` verificam tipos, bundles e páginas ISR. Sem env local, o build local mostra catálogo vazio; a validação de catálogo usa o Preview Vercel com configuração do projeto.

Referências de integração: [Amazon Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/get-started/using-curl), [Mercado Livre OAuth](https://developers.mercadolivre.com.br/autenticacao-e-autorizacao).
