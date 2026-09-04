-- PostgreSQL 16 / Supabase production schema.
create extension if not exists pgcrypto;

create type public.regiao_catalogo as enum ('BRASIL', 'GLOBAL');
create type public.plataforma_afiliada as enum (
  'AMAZON_BR', 
  'AMAZON_US', 
  'MERCADO_LIVRE', 
  'SHOPEE', 
  'ALIEXPRESS', 
  'IHERB', 
  'FARMACIA', 
  'AUTOPECAS',
  'TIKTOK_SHOP',
  'SHEIN'
);

create table public.produtos (
  id text primary key,
  slug text not null unique,
  plataforma public.plataforma_afiliada not null,
  titulo text not null,
  categoria text not null check (categoria in ('AUTOMOTIVO', 'SUPLEMENTACAO_LONGEVIDADE')),
  subcategoria text not null,
  regiao public.regiao_catalogo not null,
  moeda char(3) not null check (moeda in ('BRL', 'USD', 'AOA')),
  url_original text not null,
  url_afiliado text,
  imagem_url text,
  avaliacao numeric(2,1) check (avaliacao between 0 and 5),
  origem_verificacao text,
  preco_atual numeric(14,2),
  preco_medio_30d numeric(14,2),
  desconto_real_percentual numeric(6,2),
  oferta_valida_ate timestamptz,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint ck_url_afiliado_publicacao check (ativo = false or url_afiliado is not null),
  constraint ck_preco_publicacao check (
    ativo = false or (
      preco_atual > 0 and preco_medio_30d > preco_atual and
      desconto_real_percentual >= 0 and desconto_real_percentual <= 100
    )
  )
);

create table public.historico_precos (
  id bigint generated always as identity primary key,
  produto_id text not null references public.produtos(id) on delete cascade,
  preco numeric(14,2) not null check (preco > 0),
  preco_lista numeric(14,2),
  disponivel boolean not null default true,
  fonte text not null,
  coletado_em timestamptz not null default now()
);

create table public.cupons (
  id bigint generated always as identity primary key,
  produto_id text not null references public.produtos(id) on delete cascade,
  codigo text not null,
  desconto_percentual numeric(6,2),
  desconto_valor numeric(14,2),
  valido_de timestamptz,
  valido_ate timestamptz,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (produto_id, codigo)
);

create table public.canais_whatsapp (
  id bigint generated always as identity primary key,
  nome text not null,
  group_id text not null unique,
  categoria text not null,
  subcategoria text,
  regiao public.regiao_catalogo not null,
  provedor text not null check (provedor in ('META_CLOUD', 'EVOLUTION')),
  visibilidade text not null default 'PRIVADO' check (visibilidade in ('PUBLICO', 'PRIVADO')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.cliques (
  id bigint generated always as identity primary key,
  produto_id text not null references public.produtos(id) on delete cascade,
  canal text not null,
  campanha text,
  visitor_hash text,
  user_agent text,
  referer text,
  criado_em timestamptz not null default now()
);

create table public.disparos_whatsapp (
  id bigint generated always as identity primary key,
  produto_id text not null references public.produtos(id) on delete cascade,
  canal_id bigint not null references public.canais_whatsapp(id) on delete cascade,
  status text not null check (status in ('PENDENTE', 'ENVIADO', 'FALHOU', 'IGNORADO')),
  provider_message_id text,
  erro text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  unique (produto_id, canal_id)
);

create index idx_produtos_catalogo on public.produtos (regiao, categoria, ativo, desconto_real_percentual desc);
create index idx_historico_produto_data on public.historico_precos (produto_id, coletado_em desc);
create index idx_cupons_ativos on public.cupons (produto_id, valido_ate) where ativo = true;
create index idx_cliques_produto_data on public.cliques (produto_id, criado_em desc);
create index idx_disparos_pendentes on public.disparos_whatsapp (status, criado_em) where status = 'PENDENTE';

create or replace view public.melhores_ofertas
with (security_invoker = true) as
with ranqueadas as (
  select
    p.*,
    row_number() over (
      partition by p.regiao,
        case
          when p.categoria = 'AUTOMOTIVO' then 'AUTOMOTIVO'
          else p.subcategoria
        end
      order by p.desconto_real_percentual desc, p.atualizado_em desc
    ) as posicao_categoria
  from public.produtos p
  where p.ativo = true
    and p.url_afiliado is not null
    and (p.oferta_valida_ate is null or p.oferta_valida_ate > now())
)
select * from ranqueadas where posicao_categoria <= 20;

alter table public.produtos enable row level security;
alter table public.historico_precos enable row level security;
alter table public.cupons enable row level security;
alter table public.canais_whatsapp enable row level security;
alter table public.cliques enable row level security;
alter table public.disparos_whatsapp enable row level security;

create policy "catalogo publico somente leitura" on public.produtos for select using (ativo = true and url_afiliado is not null);
create policy "historico publico somente leitura" on public.historico_precos for select using (true);
create policy "cupons publicos ativos" on public.cupons for select using (ativo = true and (valido_ate is null or valido_ate > now()));
create policy "registro de cliques publico" on public.cliques for insert with check (true);
