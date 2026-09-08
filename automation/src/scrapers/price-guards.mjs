export const UNIT_PRICE = /\/\s*(?:litros?|kg|ml|unidade|un|m²|l|g|m)\b|per\s+(?:ounce|unit|count|pound|fl oz)/i;

/** Inspect the price's immediate wrapper, not just its isolated offscreen number. */
export function isUnitPrice(node) {
  if (!node.length) return false;
  return node.closest('.a-price-unit, .a-size-small.a-color-secondary').length > 0 ||
    UNIT_PRICE.test(node.text()) || (!node.parent().is('#corePrice_feature_div, #corePriceDisplay_desktop_feature_div') && UNIT_PRICE.test(node.parent().text()));
}

export function amazonReferencePrice($, scope, parseMoney, currency) {
  const candidates = scope.find('.a-price.a-text-price .a-offscreen, .a-text-strike, .a-text-price[data-a-strike="true"] .a-offscreen, .basisPrice .a-text-price .a-offscreen, s .a-offscreen, del .a-offscreen');
  for (const element of candidates.toArray()) {
    const node = $(element);
    if (!isUnitPrice(node) && !isUnitPrice(node.parent())) {
      const value = parseMoney(node.text(), currency);
      if (value) return value;
    }
  }
  return null;
}
