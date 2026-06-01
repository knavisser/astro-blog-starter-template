import type { APIRoute } from "astro";
import { SHOP_URL } from "../../consts";

export const prerender = false;

// How long a computed stock result is cached at the edge before we re-check.
const CACHE_SECONDS = 600;
// Safety cap on how many product pages we'll crawl per check.
const MAX_PRODUCTS = 30;
// Per-request fetch timeout against the SumUp store.
const FETCH_TIMEOUT_MS = 6000;

/** The Cloudflare KV binding ("KV" → the badjuju_config namespace), if present. */
function getKV(
	locals: App.Locals
): { get(key: string): Promise<string | null> } | null {
	const kv = (locals as any)?.runtime?.env?.KV;
	return kv && typeof kv.get === "function" ? kv : null;
}

/** Same-named runtime/process env var — used as a local-dev (.dev.vars) fallback. */
function getEnvVar(locals: App.Locals, key: string): string | null {
	const v = (locals as any)?.runtime?.env?.[key];
	if (typeof v === "string") return v;
	const p = (globalThis as any).process?.env?.[key];
	return typeof p === "string" ? p : null;
}

/**
 * Read a flag: KV first (production source of truth), falling back to an env var
 * of the same name so `.dev.vars` can drive the toasts during local `astro dev`,
 * where KV is an empty local store. An empty-string KV value is a real value
 * (e.g. Toast_Stock_Override="" means "auto") and is returned as-is.
 */
async function readFlag(
	locals: App.Locals,
	kv: ReturnType<typeof getKV>,
	key: string
): Promise<string | null> {
	if (kv) {
		try {
			const v = await kv.get(key);
			if (v !== null && v !== undefined) return v;
		} catch {
			/* fall through to env */
		}
	}
	return getEnvVar(locals, key);
}

/** Product <loc> URLs from the SumUp products sitemap. */
function extractProductUrls(xml: string): string[] {
	return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
		.map((m) => m[1].trim())
		.filter((u) => /\/product\//.test(u));
}

/**
 * A SumUp product is purchasable when its "Add to cart" button is rendered and
 * not carrying a real boolean `disabled` attribute. We must NOT match on page
 * text like "Sold out" — that lives in an i18n dictionary on every page — nor
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

/** Current calendar date in Amsterdam (handles CET/CEST DST) as a yyyymmdd int. */
export function amsterdamDateNumber(now: Date = new Date()): number {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Amsterdam",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
	return get("year") * 10000 + get("month") * 100 + get("day");
}

/** Parse a "dd/mm/yyyy" cutoff to a yyyymmdd int, or null if malformed. */
export function parseCutoffDate(raw: string): number | null {
	const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (!m) return null;
	const d = Number(m[1]);
	const mo = Number(m[2]);
	const y = Number(m[3]);
	if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
	return y * 10000 + mo * 100 + d;
}

export const GET: APIRoute = async ({ locals }) => {
	const base = SHOP_URL.replace(/\/+$/, "");
	const kv = getKV(locals);

	// --- Stock: Toast_Stock_Override -----------------------------------------
	//   ""/absent → auto-detect from the store · "0" → force hidden · "1" → show
	const ov = ((await readFlag(locals, kv, "Toast_Stock_Override")) ?? "").trim();
	let stockAvailable: boolean;
	if (ov === "1") stockAvailable = true;
	else if (ov === "0") stockAvailable = false;
	else stockAvailable = await getStockAvailable(base);

	// --- Customs: Toast_Customs_Open ------------------------------------------
	//   dd/mm/yyyy cutoff; open while today (Amsterdam) is on or before it.
	const customsRaw = await readFlag(locals, kv, "Toast_Customs_Open");
	const cutoff = customsRaw ? parseCutoffDate(customsRaw) : null;
	const customsOpen = cutoff !== null && amsterdamDateNumber() <= cutoff;

	// No-store so a KV change is reflected on the next page load. The expensive
	// stock scrape is still cached server-side inside getStockAvailable.
	return Response.json(
		{ stockAvailable, customsOpen },
		{ headers: { "Cache-Control": "no-store" } }
	);
};
