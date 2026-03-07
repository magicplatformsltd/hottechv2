-- Affiliate link entries in products.affiliate_links (JSONB) may include:
-- price_amount (text), price_currency (text). No schema change; JSONB accepts new keys.
-- Product box TipTap node config may store affiliatePriceOverrides (post-specific).
COMMENT ON COLUMN public.products.affiliate_links IS 'JSONB array of { retailer, url, price?, price_amount?, price_currency? }. price_currency = code (GBP, USD, EUR, etc.).';
