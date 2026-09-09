# Expansão verificada do catálogo

Requer Node 24 e `DATABASE_URL` no ambiente. Não inclui segredos no repositório.

```sh
node --env-file=/caminho/privado/.env scripts/seed-catalog-scale.ts
node --env-file=/caminho/privado/.env scripts/verify-scale.ts
pnpm check
```

- `SCALE_MINUTES`: orçamento do processo, padrão 25 minutos, máximo 120. O lote iniciado termina atomicamente antes da próxima checagem do orçamento.
- Cada categoria para ao alcançar 100 **títulos nacionais distintos e ativos**, excluindo ofertas expiradas e importados. Capacidade configurada não é estoque comprovado. Saída 1 indica meta incompleta ou falha.
- As listas de nichos são termos de descoberta, não um ranking inventado de faturamento. Produtos, imagens, preços e disponibilidade são extraídos das páginas públicas atuais. Não há seed com preços estimados.
- Mercado Livre usa `/ofertas?category=...&page=...`, com categorias observadas no próprio hub público. O teste de 09/09/2026 obteve HTTP 200 nesse hub; API de busca e algumas páginas individuais continuam restritas.
- Cards públicos exigem indicação explícita de entrega; páginas individuais exigem estoque disponível. Não se interpreta a simples existência de um link como estoque.
- Em HTTP 403 há uma tentativa limitada de sitemap público. Sitemap indisponível, autenticação, CAPTCHA e rate limits não são contornados com proxies ou sessões privadas.
- Tags ML são reaplicadas e auditadas. Descontos usam apenas preço riscado presente na fonte; nenhum preço por volume/unidade serve de âncora.
- Deduplicação e cache vivem na mesma transação bloqueada. Mesmo título em lojas nacionais distintas pode compartilhar produto; IDs diferentes na mesma loja são preservados para evitar mistura de variantes.
- `verify-scale.ts` registra contagem por categoria/plataforma, integridade de tags e vencedores nacionais. Zero pares concorrentes é informado como ausência de comparação real, não como uma comparação criada artificialmente.

O workflow de seis horas mantém o coletor normal. A expansão pode ser solicitada no disparo manual com `scale_catalog`.

## Auditoria de encerramento — 09/09/2026

Títulos nacionais distintos com oferta ativa/não expirada: Eletrônicos 99, Casa 92,
Beleza 121, Automotivo 85, Moda 120, Fitness 116, Livros 36.
Ofertas ativas: Amazon BR 87, Mercado Livre 588, Amazon US 6.
Um produto nacional tem ambas as lojas vinculadas; zero vencedores incorretos e
zero links ML sem os parâmetros de atribuição exigidos.

A meta de 100 em cada categoria permanece incompleta. A contagem varia com
expiração/estoque; não confundir registros históricos com ofertas ativas.
