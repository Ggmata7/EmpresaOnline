import { relations, sql } from 'drizzle-orm';
import { bigint, boolean, check, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const marketplace = pgEnum('marketplace', ['amazon_br', 'amazon_us', 'mercado_livre']);
export const offerCurrency = pgEnum('offer_currency', ['BRL', 'USD']);
const time = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  legacyId: text('legacy_id'),
  title: text('title').notNull(),
  normalizedTitle: text('normalized_title').generatedAlwaysAs(sql`public.catch_normalize_title(title)`),
  isInternational: boolean('is_international').default(false).notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  subcategory: text('subcategory'),
  imageUrl: text('image_url'),
  createdAt: time('created_at').defaultNow().notNull(),
  updatedAt: time('updated_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('products_slug_unique').on(table.slug), uniqueIndex('products_legacy_id_unique').on(table.legacyId), index('products_category_idx').on(table.category), index('products_match_idx').on(table.isInternational, table.category, table.normalizedTitle)]);

export const offers = pgTable('offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  legacyId: text('legacy_id'),
  platform: marketplace('platform').notNull(),
  externalId: text('external_id'),
  sourceUrl: text('source_url').notNull(),
  // Raw destinations are server-only: RLS/grants deny public reads; UI uses /api/c/[slug].
  affiliateUrl: text('affiliate_url'),
  // Compatibility aliases: existing redirects and sync retain their current column names.
  url: text('url').generatedAlwaysAs(sql`affiliate_url`),
  rawAffiliateId: text('raw_affiliate_id'),
  originalPrice: numeric('original_price', { precision: 14, scale: 2 }),
  currentPrice: numeric('current_price', { precision: 14, scale: 2 }).notNull(),
  currency: offerCurrency('currency').notNull(),
  discountPercentage: integer('discount_percentage').generatedAlwaysAs(sql`case when original_price > current_price then least(100, greatest(0, floor((original_price - current_price) * 100 / original_price)::integer)) else 0 end`),
  referencePriceKind: text('reference_price_kind').default('unknown').notNull(),
  referenceProvenance: text('reference_provenance'),
  historyVerifiedAt: time('history_verified_at'),
  rating: numeric('rating', { precision: 2, scale: 1 }),
  ratingCount: integer('rating_count'),
  shippingPrice: numeric('shipping_price', { precision: 14, scale: 2 }),
  shippingLabel: text('shipping_label'),
  inStock: boolean('in_stock').default(false).notNull(),
  isDealOfTheDay: boolean('is_deal_of_the_day').default(false).notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  lastCheckedAt: time('last_checked_at'),
  lastChecked: time('last_checked').generatedAlwaysAs(sql`last_checked_at`),
  expiresAt: time('expires_at'),
  createdAt: time('created_at').defaultNow().notNull(),
  updatedAt: time('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('offers_legacy_id_unique').on(table.legacyId),
  uniqueIndex('offers_marketplace_external_unique').on(table.platform, table.externalId),
  index('offers_product_idx').on(table.productId),
  index('offers_catalog_idx').on(table.currency, table.isActive, table.inStock, table.discountPercentage),
  index('offers_sync_idx').on(table.lastCheckedAt).where(sql`${table.isActive} = true`),
  check('offers_positive_price', sql`${table.currentPrice} > 0 and (${table.originalPrice} is null or ${table.originalPrice} > 0)`),
  check('offers_rating_valid', sql`(${table.rating} is null or ${table.rating} between 0 and 5) and (${table.ratingCount} is null or ${table.ratingCount} >= 0)`),
  check('offers_shipping_valid', sql`${table.shippingPrice} is null or ${table.shippingPrice} >= 0`),
  check('offers_reference_kind_valid', sql`${table.referencePriceKind} in ('list', 'average_30d', 'unknown')`),
]);

export const offerPriceHistory = pgTable('offer_price_history', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  legacyId: bigint('legacy_id', { mode: 'number' }),
  offerId: uuid('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),
  price: numeric('price', { precision: 14, scale: 2 }).notNull(),
  originalPrice: numeric('original_price', { precision: 14, scale: 2 }),
  currency: offerCurrency('currency').notNull(),
  inStock: boolean('in_stock').notNull(),
  source: text('source').notNull(),
  observedAt: time('observed_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('offer_history_legacy_unique').on(table.legacyId), uniqueIndex('offer_history_observation_unique').on(table.offerId, table.observedAt), index('offer_history_offer_time_idx').on(table.offerId, table.observedAt), check('offer_history_positive_price', sql`${table.price} > 0`)]);

export const clickAnalytics = pgTable('click_analytics', {
  id: uuid('id').defaultRandom().primaryKey(),
  offerId: uuid('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),
  userCountry: varchar('user_country', { length: 2 }),
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  channel: text('channel').default('site').notNull(),
  clickedAt: time('clicked_at').defaultNow().notNull(),
}, (table) => [index('click_analytics_offer_time_idx').on(table.offerId, table.clickedAt)]);

export const productRelations = relations(products, ({ many }) => ({ offers: many(offers) }));
export const offerRelations = relations(offers, ({ one, many }) => ({ product: one(products, { fields: [offers.productId], references: [products.id] }), history: many(offerPriceHistory), clicks: many(clickAnalytics) }));
export const priceHistoryRelations = relations(offerPriceHistory, ({ one }) => ({ offer: one(offers, { fields: [offerPriceHistory.offerId], references: [offers.id] }) }));
export const clickRelations = relations(clickAnalytics, ({ one }) => ({ offer: one(offers, { fields: [clickAnalytics.offerId], references: [offers.id] }) }));
