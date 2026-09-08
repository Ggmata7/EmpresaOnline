ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS verified_coupon jsonb;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS price_evidence jsonb;
-- Preserve references before clearing unverified anchors. This backup is private.
CREATE TABLE IF NOT EXISTS public.catalog_reference_audit (
  offer_id uuid PRIMARY KEY, original_price numeric, reference_price_kind text,
  reference_provenance text, archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalog_reference_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_reference_audit FROM anon, authenticated;
INSERT INTO public.catalog_reference_audit (offer_id, original_price, reference_price_kind, reference_provenance)
SELECT id, original_price, reference_price_kind, reference_provenance FROM public.offers
WHERE original_price > current_price AND history_verified_at IS NULL AND price_evidence IS NULL
ON CONFLICT DO NOTHING;
UPDATE public.offers SET original_price = current_price, reference_price_kind = 'unknown'
WHERE original_price > current_price AND history_verified_at IS NULL AND price_evidence IS NULL;
