import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { isCustomsOpen } from "../../lib/site-flags";

export const prerender = false;

const InquirySchema = z.object({
	name: z.string().trim().min(1).max(160),
	telegram: z.string().trim().min(2).max(80),
	country: z.string().trim().min(1).max(80),
	basedOnCharacter: z.string().trim().max(10).optional().default(""),
	earStyle: z.string().trim().max(40).optional().default(""),
	size: z.string().trim().max(8).optional().default(""),
	modifications: z.string().trim().max(4000).optional().default(""),
	budget: z.string().trim().max(40).optional().default(""),
	notes: z.string().trim().max(4000).optional().default(""),
});

const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const ATTACHMENT_FIELDS = new Set(["characterRefs", "modificationRefs"]);

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function renderHtml(
	data: z.infer<typeof InquirySchema>,
	attachmentNames: string[]
): string {
	const rows: Array<[string, string]> = [
		["Name", data.name],
		["Telegram", data.telegram],
		["Country", data.country],
		["Based on character", data.basedOnCharacter === "yes" ? "Yes" : "No"],
		["Ear shape", data.earStyle || "n/a"],
		["Size", data.size || "n/a"],
		["Budget tier", data.budget || "n/a"],
		["Modifications", data.modifications || "n/a"],
		["Notes", data.notes || "n/a"],
		["Attachments", attachmentNames.length ? attachmentNames.join(", ") : "n/a"],
	];
	return `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
		<h2 style="font-family:'Michroma',sans-serif;letter-spacing:.18em;">NEW SUMMONS</h2>
		<table style="border-collapse:collapse;width:100%;">${rows
			.map(
				([k, v]) =>
					`<tr><td style="padding:8px 0;color:#666;font-size:12px;letter-spacing:.06em;text-transform:uppercase;width:140px;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:8px 0;font-size:14px;white-space:pre-wrap;">${escapeHtml(v)}</td></tr>`
			)
			.join("")}</table>
	</body></html>`;
}

function getEnv(locals: App.Locals, key: string): string | undefined {
	// Cloudflare runtime via @astrojs/cloudflare exposes env on locals.runtime.env
	const cf = (locals as any)?.runtime?.env as Record<string, string> | undefined;
	if (cf && typeof cf[key] === "string") return cf[key];
	const proc = (globalThis as any).process?.env as
		| Record<string, string>
		| undefined;
	return proc?.[key];
}

// Reads a secret that may be either a plain Worker secret/var (a string) or a
// Cloudflare Secrets Store binding (an object whose value you fetch via .get()).
async function getSecret(
	locals: App.Locals,
	key: string
): Promise<string | undefined> {
	const v = (locals as any)?.runtime?.env?.[key];
	if (typeof v === "string") return v;
	if (v && typeof v.get === "function") {
		try {
			const resolved = await v.get();
			return typeof resolved === "string" ? resolved : undefined;
		} catch {
			return undefined;
		}
	}
	const proc = (globalThis as any).process?.env as
		| Record<string, string>
		| undefined;
	return proc?.[key];
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = "";
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode.apply(
			null,
			Array.from(bytes.subarray(i, i + chunk))
		);
	}
	return btoa(binary);
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return Response.json(
			{ ok: false, error: "Invalid form payload." },
			{ status: 400 }
		);
	}

	const text: Record<string, string> = {};
	const files: File[] = [];
	let totalBytes = 0;

	for (const [key, value] of form.entries()) {
		if (value instanceof File) {
			if (!ATTACHMENT_FIELDS.has(key)) continue;
			if (value.size === 0) continue;
			totalBytes += value.size;
			files.push(value);
		} else {
			text[key] = value;
		}
	}

	if (totalBytes > MAX_TOTAL_BYTES) {
		return Response.json(
			{ ok: false, error: "Attachments exceed 25MB total." },
			{ status: 413 }
		);
	}

	// Honeypot, a hidden field real users never see. If a bot (or aggressive
	// browser autofill) fills it, silently accept and drop. Checked on the raw
	// payload BEFORE validation so it can never cause a false "invalid fields" 400.
	if ((text.hpot ?? "").trim().length > 0) {
		return Response.json({ ok: true }, { status: 200 });
	}

	// Customs window (Toast_Customs_Open). The form disables its submit button
	// while closed; this is the server-side guard so it can't be bypassed.
	if (!(await isCustomsOpen(locals))) {
		return Response.json(
			{ ok: false, error: "Customs are closed right now." },
			{ status: 403 }
		);
	}

	const parsed = InquirySchema.safeParse(text);
	if (!parsed.success) {
		const fields = parsed.error.issues.map((i) => i.path.join("."));
		console.warn("[INQUIRY] validation failed:", fields.join(", "));
		return Response.json(
			{ ok: false, error: "Missing or invalid fields.", fields },
			{ status: 400 }
		);
	}

	const data = parsed.data;

	const ip = clientAddress || "unknown";
	const attachmentNames = files.map((f) => f.name || "attachment");

	console.log(
		"[INQUIRY]",
		JSON.stringify(
			{ ...data, _ip: ip, _attachments: attachmentNames, _bytes: totalBytes },
			null,
			2
		)
	);

	const apiKey = await getSecret(locals, "RESEND_API_KEY");
	const toAddress = getEnv(locals, "INQUIRY_TO_EMAIL") || "orders@badjuju.net";
	const fromAddress =
		getEnv(locals, "INQUIRY_FROM_EMAIL") || "bad juju <orders@badjuju.net>";

	if (apiKey && toAddress) {
		const attachments = await Promise.all(
			files.map(async (f) => ({
				filename: f.name || "attachment",
				content: arrayBufferToBase64(await f.arrayBuffer()),
			}))
		);
		try {
			const resendRes = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: fromAddress,
					to: [toAddress],
					subject: `// NEW SUMMONS: ${data.name}`,
					html: renderHtml(data, attachmentNames),
					attachments: attachments.length ? attachments : undefined,
				}),
			});
			if (!resendRes.ok) {
				const errText = await resendRes.text();
				console.error("[INQUIRY] resend error", resendRes.status, errText);
				return Response.json(
					{ ok: false, error: "Email send failed." },
					{ status: 502 }
				);
			}
		} catch (err) {
			console.error("[INQUIRY] resend exception", err);
			return Response.json(
				{ ok: false, error: "Email send failed." },
				{ status: 502 }
			);
		}
	}

	return Response.json({ ok: true }, { status: 200 });
};

export const GET: APIRoute = () =>
	Response.json({ ok: false, error: "POST only." }, { status: 405 });
