# Public promo collector

Requires Node 24 and root dependencies (`pnpm install --frozen-lockfile`).
From `automation`: `pnpm start -- --env ../../affiliate-arbitrage/.env`, or
`node src/run-cycle.mjs --env ../../affiliate-arbitrage/.env`.
In CI, DATABASE_URL is injected directly. Amazon canonical pages need no API keys.
ML search is attempted without a token, but the service may require authorization
and return 403. No proxy rotation, challenge bypass or hidden APIs are used.
Amazon ASINs are maintained in `config/amazon-watchlist.json`; IDs are monitoring
candidates, not a guarantee of availability or conversion. No old seed prices are imported.

The default mode is `public`; `COLLECTOR_MODE=legacy` retains the previous pipeline.
GitHub Actions schedules collection every six hours, with manual workflow_dispatch.
The updated workflow must be committed/pushed before the new schedule code is active.

Current price, stock evidence, marketplace product URL and allowlisted image CDN
are required. Missing original price uses current price (0% discount), never a margin.
Prices are not 30-day averages. Currency and number locale are validated separately.
US collection stays in USD, in its own regional section. National titles match across
retailers without dropping model/variant tokens. Ambiguous titles are not merged.
Up to 20 captured offers per category/region per run, sorted by discount; not a claim
to find all offers or the global best price. Public observations expire in six hours.

HTTP blocks, login redirects, CAPTCHAs and missing data are reported, not bypassed.
Cheerio does not execute JavaScript: client-rendered storefronts may yield no rows.
An entirely empty/blocked cycle exits 1 and preserves the database. This is observable
failure, not successful ingestion. No WhatsApp messages are sent by public mode.
Affiliate parameters are attribution instructions, not a guarantee of commission.
Existing catalog schema v2 must be enabled separately to display normalized offers.

Verify actual recent persisted products, not legacy totals:
`node scripts/verify-public-collection.mjs --env ../affiliate-arbitrage/.env`
(from repository root). This exits 1 unless at least 10 distinct products include
both national and international offers. A collection may update existing offers;
the logs distinguish creates from updates and re-read committed rows.
