// Shared readers for the site's KV-backed feature flags. Used by the
// /api/site-flags route (toasts + form state) and by /api/inquiry, which must
// refuse submissions while customs are closed.

/** The Cloudflare KV binding ("KV" → the badjuju_config namespace), if present. */
export function getKV(
	locals: App.Locals
): { get(key: string): Promise<string | null> } | null {
	const kv = (locals as any)?.runtime?.env?.KV;
	return kv && typeof kv.get === "function" ? kv : null;
}

/** Same-named runtime/process env var, used as a local-dev (.dev.vars) fallback. */
function getEnvVar(locals: App.Locals, key: string): string | null {
	const v = (locals as any)?.runtime?.env?.[key];
	if (typeof v === "string") return v;
	const p = (globalThis as any).process?.env?.[key];
	return typeof p === "string" ? p : null;
}

/**
 * Read a flag: KV first (production source of truth), falling back to an env var
 * of the same name so `.dev.vars` can drive the flags during local `astro dev`,
 * where KV is an empty local store. An empty-string KV value is a real value
 * (e.g. Toast_Stock_Override="" means "auto") and is returned as-is.
 */
export async function readFlag(
	locals: App.Locals,
	key: string
): Promise<string | null> {
	const kv = getKV(locals);
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

/**
 * Customs: Toast_Customs_Open holds a dd/mm/yyyy cutoff; customs are open while
 * today (Amsterdam) is on or before it. Absent or malformed → closed.
 */
export async function isCustomsOpen(locals: App.Locals): Promise<boolean> {
	const raw = await readFlag(locals, "Toast_Customs_Open");
	const cutoff = raw ? parseCutoffDate(raw) : null;
	return cutoff !== null && amsterdamDateNumber() <= cutoff;
}
