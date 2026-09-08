export function normalizeTitle(title: string): string {
  return title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Ignore word order only. Never drop model, capacity, color, voltage or kit tokens. */
export function titlesMatch(left: string, right: string): boolean {
  const a = normalizeTitle(left), b = normalizeTitle(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.split(' ').sort().join(' ') === b.split(' ').sort().join(' ');
}
