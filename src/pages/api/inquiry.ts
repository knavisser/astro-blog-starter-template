import type { APIRoute } from "astro";
import { z } from "astro/zod";

export const prerender = false;

const InquirySchema = z.object({
	name: z.string().trim().min(1).max(160),
	email: z.string().trim().email().max(320),
	reference: z.string().trim().max(120).optional().default(""),
	earStyle: z.string().trim().max(40).optional().default(""),
	size: z.string().trim().max(8).optional().default(""),
	deadline: z.string().trim().max(20).optional().default(""),
	modifications: z.string().trim().max(4000).optional().default(""),
	budget: z.string().trim().max(40).optional().default(""),
	notes: z.string().trim().max(4000).optional().default(""),
	company: z.string().max(0).optional().default(""), // honeypot — must be empty
});

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function renderHtml(data: z.infer<typeof InquirySchema>): string {
	const rows: Array<[string, string]> = [
		["Name", data.name],
		["Email", data.email],
		["Reference piece", data.reference || "—"],
		["Ear style", data.earStyle || "—"],
		["Size", data.size || "—"],
		["Deadline", data.deadline || "—"],
		["Budget tier", data.budget || "—"],
		["Modifications", data.modifications || "—"],
		["Notes", data.notes || "—"],
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

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
	}

	const parsed = InquirySchema.safeParse(raw);
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

	// always log so dev users can see inquiries in `wrangler tail`
	console.log("[INQUIRY]", JSON.stringify({ ...data, _ip: ip }, null, 2));

	const apiKey = getEnv(locals, "RESEND_API_KEY");
	const toAddress = getEnv(locals, "INQUIRY_TO_EMAIL");
	const fromAddress =
		getEnv(locals, "INQUIRY_FROM_EMAIL") || "bad juju <inquiry@badjuju.dev>";

	if (apiKey && toAddress) {
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
					reply_to: data.email,
					subject: `// NEW SUMMONS — ${data.name}`,
					html: renderHtml(data),
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
