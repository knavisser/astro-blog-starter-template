import type { APIRoute } from "astro";
import { z } from "astro/zod";

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
	company: z.string().max(0).optional().default(""), // honeypot — must be empty
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
		["Ear shape", data.earStyle || "—"],
		["Size", data.size || "—"],
		["Budget tier", data.budget || "—"],
		["Modifications", data.modifications || "—"],
		["Notes", data.notes || "—"],
		["Attachments", attachmentNames.length ? attachmentNames.join(", ") : "—"],
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

	const parsed = InquirySchema.safeParse(text);
	if (!parsed.success) {
		return Response.json(
			{ ok: false, error: "Missing or invalid fields." },
			{ status: 400 }
		);
	}

	const data = parsed.data;

	// honeypot
	if (data.company && data.company.length > 0) {
		return Response.json({ ok: true }, { status: 200 });
	}

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

	const apiKey = getEnv(locals, "RESEND_API_KEY");
	const toAddress = getEnv(locals, "INQUIRY_TO_EMAIL");
	const fromAddress =
		getEnv(locals, "INQUIRY_FROM_EMAIL") || "bad juju <inquiry@badjuju.dev>";

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
					subject: `// NEW SUMMONS — ${data.name}`,
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
