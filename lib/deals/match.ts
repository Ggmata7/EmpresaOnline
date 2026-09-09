export function normalizeTitle(title: string): string {
  return title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Ignore word order only. Never drop model, capacity, color, voltage or kit tokens. */
export function titlesMatch(left: string, right: string): boolean {
  const a = normalizeTitle(left), b = normalizeTitle(right);
  if (!a || !b) return false;
  if (a === b) return true;
  // Curated identity for this standardized, unflavoured single-package product.
  // Keep all other products on strict token matching until GTIN evidence exists.
  const creatineIdentity = (title: string) => {
    if (!/soldiers nutrition/.test(title) || !/creatina/.test(title) || !/monohidratada/.test(title) ||
      /kit|combo|pack|sabor|capsula|\b[2-9]\s*x\b/.test(title)) return null;
    const weights = [...title.matchAll(/\b(\d+)\s*(kg|g)\b/g)];
    if (weights.length !== 1) return null;
    const residual = title.replace(weights[0][0], '').replace(/\b(soldiers|nutrition|creatina|monohidratada|suplemento|em|po|100|pura|de)\b/g, '').trim();
    if (residual) return null;
    return Number(weights[0][1]) * (weights[0][2] === 'kg' ? 1000 : 1);
  };
  const leftWeight = creatineIdentity(a), rightWeight = creatineIdentity(b);
  if (leftWeight && leftWeight === rightWeight) return true;
  return a.split(' ').sort().join(' ') === b.split(' ').sort().join(' ');
}
