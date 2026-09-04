import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const produtos = sqliteTable('produtos', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  plataforma: text('plataforma').notNull(),
  titulo: text('titulo').notNull(),
  categoria: text('categoria').notNull(),
  subcategoria: text('subcategoria').notNull(),
  regiao: text('regiao').notNull(),
  moeda: text('moeda').notNull(),
  urlOriginal: text('url_original').notNull(),
  urlAfiliado: text('url_afiliado'),
  imagemUrl: text('imagem_url'),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  atualizadoEm: text('atualizado_em').notNull(),
}, (table) => [
  uniqueIndex('uq_produtos_slug').on(table.slug),
  index('idx_produtos_regiao_categoria_ativo').on(table.regiao, table.categoria, table.ativo),
]);

export const historicoPrecos = sqliteTable('historico_precos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  produtoId: text('produto_id').notNull().references(() => produtos.id, { onDelete: 'cascade' }),
  preco: real('preco').notNull(),
  precoLista: real('preco_lista'),
  disponivel: integer('disponivel', { mode: 'boolean' }).notNull().default(true),
  coletadoEm: text('coletado_em').notNull(),
}, (table) => [index('idx_historico_produto_data').on(table.produtoId, table.coletadoEm)]);

export const cupons = sqliteTable('cupons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  produtoId: text('produto_id').notNull().references(() => produtos.id, { onDelete: 'cascade' }),
  codigo: text('codigo').notNull(),
  descontoPercentual: real('desconto_percentual'),
  validoAte: text('valido_ate'),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
}, (table) => [index('idx_cupons_produto_ativo').on(table.produtoId, table.ativo)]);

export const canaisWhatsapp = sqliteTable('canais_whatsapp', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull(),
  groupId: text('group_id').notNull(),
  categoria: text('categoria').notNull(),
  subcategoria: text('subcategoria'),
  regiao: text('regiao').notNull(),
  provedor: text('provedor').notNull(),
  visibilidade: text('visibilidade').notNull().default('PRIVADO'),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
}, (table) => [uniqueIndex('uq_canais_whatsapp_group_id').on(table.groupId)]);

export const cliques = sqliteTable('cliques', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  produtoId: text('produto_id').notNull().references(() => produtos.id, { onDelete: 'cascade' }),
  canal: text('canal').notNull(),
  visitorHash: text('visitor_hash'),
  userAgent: text('user_agent'),
  criadoEm: text('criado_em').notNull(),
}, (table) => [index('idx_cliques_produto_data').on(table.produtoId, table.criadoEm)]);
