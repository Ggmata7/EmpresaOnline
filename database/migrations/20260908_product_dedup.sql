-- Additive migration; run atomically. No legacy tables or offers are removed.
CREATE OR REPLACE FUNCTION public.catch_normalize_title(value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog
AS $$ SELECT trim(regexp_replace(regexp_replace(normalize(lower(value), NFD), U&'[\0300-\036f]', '', 'g'), '[^a-z0-9]+', ' ', 'g')) $$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS normalized_title text
  GENERATED ALWAYS AS (public.catch_normalize_title(title)) STORED;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_international boolean NOT NULL DEFAULT false;

-- A preexisting mixed product needs explicit review rather than silently moving offers.
DO $$ BEGIN
  IF EXISTS (SELECT product_id FROM public.offers GROUP BY product_id
    HAVING bool_or(platform = 'amazon_us') AND bool_or(platform <> 'amazon_us')) THEN
    RAISE EXCEPTION 'mixed_region_products_require_review';
  END IF;
END $$;
UPDATE public.products p SET is_international = true
WHERE EXISTS (SELECT 1 FROM public.offers o WHERE o.product_id = p.id AND o.platform = 'amazon_us');
CREATE INDEX IF NOT EXISTS products_match_idx ON public.products(is_international, category, normalized_title);
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS url text GENERATED ALWAYS AS (affiliate_url) STORED;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS last_checked timestamptz GENERATED ALWAYS AS (last_checked_at) STORED;

CREATE OR REPLACE FUNCTION public.catch_check_offer_region() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE international boolean;
BEGIN
  SELECT is_international INTO international FROM public.products WHERE id = NEW.product_id FOR SHARE;
  IF international IS DISTINCT FROM (NEW.platform = 'amazon_us') OR
    NEW.currency::text <> (CASE WHEN NEW.platform = 'amazon_us' THEN 'USD' ELSE 'BRL' END) THEN
    RAISE EXCEPTION 'offer_product_region_mismatch';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catch_offer_region ON public.offers;
CREATE TRIGGER catch_offer_region BEFORE INSERT OR UPDATE OF product_id, platform, currency
ON public.offers FOR EACH ROW EXECUTE FUNCTION public.catch_check_offer_region();

CREATE OR REPLACE FUNCTION public.catch_check_product_region() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.offers WHERE product_id = NEW.id AND (platform = 'amazon_us') <> NEW.is_international) THEN
    RAISE EXCEPTION 'product_offer_region_mismatch';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catch_product_region ON public.products;
CREATE TRIGGER catch_product_region BEFORE UPDATE OF is_international ON public.products
FOR EACH ROW EXECUTE FUNCTION public.catch_check_product_region();
NOTIFY pgrst, 'reload schema';
