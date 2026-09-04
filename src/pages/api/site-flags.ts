import type { APIRoute } from "astro";
import { SHOP_URL } from "../../consts";
import { readFlag, isCustomsOpen } from "../../lib/site-flags";

export const prerender = false;

// How long a computed stock result is cached at the edge before we re-check.
const CACHE_SECONDS = 600;
// Safety cap on how many product pages we'll crawl per check.
const MAX_PRODUCTS = 30;
// Per-request fetch timeout against the SumUp store.
const FETCH_TIMEOUT_MS = 6000;

/** Product <loc> URLs from the SumUp products sitemap. */
function extractProductUrls(xml: string): string[] {
	return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
		.map((m) => m[1].trim())
		.filter((u) => /\/product\//.test(u));
}

/**
 * A SumUp product is purchasable when its "Add to cart" button is rendered and
 * not carrying a real boolean `disabled` attribute. We must NOT match on page
 * text like "Sold out", that lives in an i18n dictionary on every page, nor
 * on Tailwind `disabled:` utility classes, hence the negative lookahead.
 */
function isProductAvailable(html: string): boolean {
	const marker = "ost-theme-product-add-to-cart-button";
	const idx = html.indexOf(marker);
	if (idx === -1) return false;
	const start = html.lastIndexOf("<button", idx);
	const end = html.indexOf(">", idx);
	if (start === -1 || end === -1) return false;
	const tag = html.slice(start, end + 1);
	if (/\bdisabled(?![:\w-])/i.test(tag)) return false;
	return true;
}

async function fetchText(url: string): Promise<string | null> {
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "badjuju-shop-status" },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}

/** Crawl the store; true if at least one product is in stock. Fails silent. */
async function detectStockAvailable(base: string): Promise<boolean> {
	const xml = await fetchText(`${base}/sitemap.products.xml`);
	if (!xml) return false;
	const products = extractProductUrls(xml).slice(0, MAX_PRODUCTS);
	for (const url of products) {
		const html = await fetchText(url);
		if (html && isProductAvailable(html)) return true;
	}
	return false;
}

/** Stock detection result, cached ~10 min via the Cache API (no-op in dev). */
async function getStockAvailable(base: string): Promise<boolean> {
	const cache = typeof caches !== "undefined" ? (caches as any).default : null;
	const cacheKey = new Request(`${base}/__stock_status`);
	if (cache) {
		const hit = await cache.match(cacheKey);
		if (hit) {
			try {
				return (await hit.json()).available === true;
			} catch {
				/* fall through and recompute */
			}
		}
	}
	const available = await detectStockAvailable(base);
	if (cache) {
		await cache.put(
			cacheKey,
			Response.json(
				{ available },
				{ headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` } }
			)
		);
	}
	return available;
}

export const GET: APIRoute = async ({ locals }) => {
	const base = SHOP_URL.replace(/\/+$/, "");

	// --- Stock: Toast_Stock_Override -----------------------------------------
	//   ""/absent → auto-detect from the store · "0" → force hidden · "1" → show
	const ov = ((await readFlag(locals, "Toast_Stock_Override")) ?? "").trim();
	let stockAvailable: boolean;
	if (ov === "1") stockAvailable = true;
	else if (ov === "0") stockAvailable = false;
	else stockAvailable = await getStockAvailable(base);

	// --- Customs: Toast_Customs_Open ------------------------------------------
	//   dd/mm/yyyy cutoff; open while today (Amsterdam) is on or before it.
	//   Drives both the customs toast and the inquiry form's submit button.
	const customsOpen = await isCustomsOpen(locals);

	// No-store so a KV change is reflected on the next page load. The expensive
	// stock scrape is still cached server-side inside getStockAvailable.
	return Response.json(
		{ stockAvailable, customsOpen },
		{ headers: { "Cache-Control": "no-store" } }
	);
};
