/** Runs a bounded worker queue; each rejection is isolated and results retain input order. */
export async function mapConcurrent(items, worker, concurrency = 5, deadline = Infinity) {
  const count = Math.min(5, Math.max(1, Math.trunc(concurrency) || 1));
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(count, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      if (Date.now() >= deadline) {
        results[index] = { status: 'skipped', reason: 'execution_budget' };
        continue;
      }
      try { results[index] = { status: 'fulfilled', value: await worker(items[index], index) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }));
  return results;
}

function money(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1e12 ? Number(value.toFixed(2)) : null;
}

/** Item endpoint: absence/authorization errors must not be interpreted as out-of-stock. */
export function parseMercadoLivreItem(item, expectedId) {
  if (!item || item.id !== expectedId) throw new Error('item_identity_mismatch');
  if (!['active', 'paused', 'closed'].includes(item.status)) throw new Error('unknown_stock_status');
  if (item.currency_id !== 'BRL') throw new Error('currency_mismatch');
  const currentPrice = money(item.price);
  const inStock = item.status === 'active' && (typeof item.available_quantity !== 'number' || item.available_quantity > 0);
  if (inStock && !currentPrice) throw new Error('invalid_price');
  return {
    currentPrice,
    originalPrice: money(item.original_price),
    currency: 'BRL', inStock,
    referencePriceKind: money(item.original_price) ? 'list' : 'unknown',
    referenceProvenance: 'mercado_livre:items',
    isDealOfTheDay: false,
    expiresAt: null,
    // Frete depends on address; a global free-shipping flag is insufficient to promise zero cost.
    shippingPrice: null,
    shippingLabel: item.shipping?.free_shipping === true ? 'Frete grátis: consulte condições na loja' : null,
  };
}

/** Creators API OffersV2: public, new-condition, non-subscription listings only. */
export function parseAmazonItemResponse(payload, expectedAsin, currency) {
  const items = payload?.itemsResult?.items ?? payload?.itemResults?.items;
  const item = Array.isArray(items) ? items.find((entry) => entry.asin === expectedAsin) : undefined;
  if (!item) throw new Error('item_not_accessible');
  const listings = item.offersV2?.listings;
  if (!Array.isArray(listings) || listings.length === 0) throw new Error('missing_offer_data');
  const candidates = listings.filter((listing) =>
    listing.condition?.value === 'New' && listing.violatesMAP !== true &&
    !String(listing.type || '').includes('SUBSCRIBE') &&
    (!listing.dealDetails?.accessType || listing.dealDetails.accessType === 'ALL'));
  const listing = candidates.find((entry) => entry.isBuyBoxWinner) ?? candidates
    .filter((entry) => money(entry.price?.money?.amount))
    .sort((a, b) => a.price.money.amount - b.price.money.amount)[0];
  if (!listing) throw new Error('no_public_offer');
  const availability = String(listing.availability?.type || '').replaceAll('_', '');
  if (!['INSTOCK', 'INSTOCKSCARCE', 'OUTOFSTOCK', 'UNAVAILABLE'].includes(availability)) throw new Error('unknown_stock_status');
  const inStock = ['INSTOCK', 'INSTOCKSCARCE'].includes(availability);
  const currentPrice = money(listing.price?.money?.amount);
  if (inStock && (!currentPrice || listing.price.money.currency !== currency)) throw new Error('invalid_price_or_currency');
  const basis = listing.price?.savingBasis;
  const originalPrice = basis?.savingBasisType === 'LIST_PRICE' && basis.money?.currency === currency ? money(basis.money.amount) : null;
  const end = listing.dealDetails?.endTime;
  return {
    currentPrice, originalPrice, currency, inStock,
    referencePriceKind: originalPrice ? 'list' : 'unknown',
    referenceProvenance: 'amazon:creators_api',
    isDealOfTheDay: /^(deal of the day|oferta do dia)$/i.test(listing.dealDetails?.badge ?? ''),
    expiresAt: end && Number.isFinite(Date.parse(end)) ? new Date(end).toISOString() : null,
    shippingPrice: null, shippingLabel: null,
  };
}
