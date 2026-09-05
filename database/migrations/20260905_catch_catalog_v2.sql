-- Additive migration: retains all legacy tables, URLs and identifiers for rollback.
-- Run once via a privileged PostgreSQL connection/Supabase SQL editor before enabling v2.
begin;

do $$ begin
  create type public.marketplace as enum ('amazon_br', 'amazon_us', 'mercado_livre');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.offer_currency as enum ('BRL', 'USD');
exception when duplicate_object then null; end $$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  legacy_id text,
  title text not null,
  slug text not null,
  description text,
  category text not null,
  subcategory text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists products_slug_unique on public.products(slug);
create unique index if not exists products_legacy_id_unique on public.products(legacy_id);
create index if not exists products_category_idx on public.products(category);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  legacy_id text,
  platform public.marketplace not null,
  external_id text,
  source_url text not null,
  affiliate_url text,
  raw_affiliate_id text,
  original_price numeric(14,2),
  current_price numeric(14,2) not null,
  currency public.offer_currency not null,
  discount_percentage integer generated always as (
    case when original_price > current_price then least(100, greatest(0, floor((original_price-current_price)*100/original_price)::integer)) else 0 end
  ) stored,
  reference_price_kind text not null default 'unknown',
  reference_provenance text,
  history_verified_at timestamptz,
  rating numeric(2,1),
  rating_count integer,
  shipping_price numeric(14,2),
  shipping_label text,
  in_stock boolean not null default false,
  is_deal_of_the_day boolean not null default false,
  is_active boolean not null default false,
  last_checked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_positive_price check (current_price > 0 and (original_price is null or original_price > 0)),
  constraint offers_rating_valid check ((rating is null or rating between 0 and 5) and (rating_count is null or rating_count >= 0)),
  constraint offers_shipping_valid check (shipping_price is null or shipping_price >= 0),
  constraint offers_reference_kind_valid check (reference_price_kind in ('list','average_30d','unknown'))
);
create unique index if not exists offers_legacy_id_unique on public.offers(legacy_id);
create unique index if not exists offers_marketplace_external_unique on public.offers(platform, external_id);
create index if not exists offers_product_idx on public.offers(product_id);
create index if not exists offers_catalog_idx on public.offers(currency, is_active, in_stock, discount_percentage);
create index if not exists offers_sync_idx on public.offers(last_checked_at) where is_active = true;

create table if not exists public.offer_price_history (
  id bigint generated always as identity primary key,
  legacy_id bigint,
  offer_id uuid not null references public.offers(id) on delete cascade,
  price numeric(14,2) not null,
  original_price numeric(14,2),
  currency public.offer_currency not null,
  in_stock boolean not null,
  source text not null,
  observed_at timestamptz not null default now(),
  constraint offer_history_positive_price check (price > 0)
);
create unique index if not exists offer_history_legacy_unique on public.offer_price_history(legacy_id);
create unique index if not exists offer_history_observation_unique on public.offer_price_history(offer_id, observed_at);
create index if not exists offer_history_offer_time_idx on public.offer_price_history(offer_id, observed_at);

create table if not exists public.click_analytics (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  user_country varchar(2),
  ip_hash text,
  user_agent text,
  channel text not null default 'site',
  clicked_at timestamptz not null default now()
);
create index if not exists click_analytics_offer_time_idx on public.click_analytics(offer_id, clicked_at);

alter table public.products enable row level security;
alter table public.offers enable row level security;
alter table public.offer_price_history enable row level security;
alter table public.click_analytics enable row level security;

-- Public catalog metadata is read-only. Raw offer URLs and analytics never leave the server.
revoke all on public.products, public.offers, public.offer_price_history, public.click_analytics from anon, authenticated;
grant select on public.products to anon, authenticated;
drop policy if exists "public product metadata" on public.products;
create policy "public product metadata" on public.products for select to anon, authenticated using (true);
grant all on public.products, public.offers, public.offer_price_history, public.click_analytics to service_role;
grant usage, select on sequence public.offer_price_history_id_seq to service_role;

do $$ begin
  if to_regclass('public.produtos') is not null then
    insert into public.products (legacy_id,title,slug,category,subcategory,image_url,created_at,updated_at)
    select id,titulo,slug,
      case when categoria='AUTOMOTIVO' then 'Automotivo' when subcategoria='PERFORMANCE_HIPERTROFIA' then 'Performance' else 'Longevidade' end,
      subcategoria,imagem_url,criado_em,atualizado_em
    from public.produtos where plataforma::text in ('AMAZON_BR','AMAZON_US','MERCADO_LIVRE') and moeda in ('BRL','USD')
    on conflict do nothing;

    insert into public.offers (product_id,legacy_id,platform,external_id,source_url,affiliate_url,original_price,current_price,currency,
      reference_price_kind,reference_provenance,rating,in_stock,is_active,last_checked_at,expires_at,created_at,updated_at)
    select p.id,l.id,
      case l.plataforma::text when 'AMAZON_BR' then 'amazon_br' when 'AMAZON_US' then 'amazon_us' else 'mercado_livre' end::public.marketplace,
      case when l.plataforma::text in ('AMAZON_BR','AMAZON_US') then substring(l.url_original from '/(?:dp|gp/product)/([A-Za-z0-9]{10})')
        else replace(substring(l.url_original from '(MLB-?[0-9]+)'),'-','') end,
      l.url_original,l.url_afiliado,nullif(l.preco_medio_30d,0),l.preco_atual,l.moeda::text::public.offer_currency,
      'unknown',l.origem_verificacao,l.avaliacao,l.ativo,l.ativo,l.atualizado_em,l.oferta_valida_ate,l.criado_em,l.atualizado_em
    from public.produtos l join public.products p on p.legacy_id=l.id
    where l.preco_atual > 0
    on conflict do nothing;
  end if;
  if to_regclass('public.historico_precos') is not null then
    -- Copy observations that already exist; never manufacture a 30-day timeline from one quote.
    insert into public.offer_price_history (legacy_id,offer_id,price,original_price,currency,in_stock,source,observed_at)
    select h.id,o.id,h.preco,h.preco_lista,o.currency,h.disponivel,'legacy:'||h.fonte,h.coletado_em
    from public.historico_precos h join public.offers o on o.legacy_id=h.produto_id
    where h.preco > 0 on conflict do nothing;
  end if;
end $$;

comment on column public.offers.affiliate_url is 'Server-only. Public UI exposes /api/c/product-slug, never this column.';
comment on column public.offers.history_verified_at is 'Only set after independently validating 30-day observation coverage. Legacy averages do not qualify.';
notify pgrst, 'reload schema';
commit;
