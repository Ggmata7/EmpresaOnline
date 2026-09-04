# Radar de Ofertas

Catálogos Brasil e Global, arbitragem de preço em ciclos de 6 horas, deep links de afiliado, contagem de cliques e distribuição segmentada por WhatsApp.

## Estrutura

- `app/`: catálogo React e redirecionador de cliques.
- `components/offer-card.tsx`: card com preço anterior, desconto, cupom e contagem regressiva.
- `database/schema.sql`: DDL completo para Supabase/PostgreSQL.
- `db/schema.ts`: esquema D1 para a versão hospedada do catálogo.
- `automation/src/ingestion.mjs`: coleta resiliente e cálculo do desconto real.
- `automation/src/affiliate-links.mjs`: higienização e validação dos links.
- `automation/src/whatsapp.mjs`: envio por Meta Cloud API ou Evolution API.
- `.github/workflows/affiliate-cycle.yml`: ciclo agendado a cada 6 horas.
- `ARCHITECTURE.md`: decisões, fluxo e cuidados de conformidade.

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

Abra `http://localhost:3000/brasil` ou `http://localhost:3000/global`.

## Configuração

Copie `.env.example` para `.env.local`. Nunca envie tokens ou `SUPABASE_SERVICE_ROLE_KEY` ao repositório. O projeto já conhece as IDs públicas Amazon informadas pelo operador; as outras redes continuam bloqueadas até receberem seus deep links oficiais.

Para a automação, copie `automation/config/sources.example.json` para `automation/config/sources.json`, substitua todos os placeholders e execute:

```bash
node automation/src/run-cycle.mjs
```

O protótipo usa ofertas ilustrativas; preços reais só entram após configuração das APIs/fontes autorizadas e de pelo menos três observações de histórico.
