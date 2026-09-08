export type VerifiedCoupon = { code: string; price: number; verifiedAt: string; validUntil: string };
export function validCoupon(value: unknown, currentPrice: number, now = Date.now()): VerifiedCoupon | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const coupon = value as VerifiedCoupon;
  const verified = Date.parse(coupon.verifiedAt), until = Date.parse(coupon.validUntil);
  if (typeof coupon.code !== 'string' || !coupon.code.trim() || !Number.isFinite(coupon.price) ||
    coupon.price <= 0 || coupon.price >= currentPrice || !Number.isFinite(verified) || verified > now ||
    !Number.isFinite(until) || until <= now || verified >= until) return undefined;
  return coupon;
}
