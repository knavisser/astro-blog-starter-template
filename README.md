# bad juju

Marketing site for **bad juju** — one of one, made-to-order hoodies stitched with ears, horns, and other modifications. Built on Astro 5 + Cloudflare Workers.

> "bad juju" is a working name placeholder. Swap it globally in [src/consts.ts](src/consts.ts) when the real name lands.

## Stack

- **Astro 5** with the **Cloudflare Workers** adapter
- **Content collections** drive `/portfolio` and the featured slider — each hoodie is one markdown file in `src/content/pieces/`
- **Self-hosted Google Fonts** via `@fontsource` — Michroma (display), Space Grotesk (body), Space Mono (system)
- **astro-icon + Tabler** for utility icons
- **Lenis** for smooth scroll
- **Native View Transitions** for page navigation
- **Custom CSS cursor** with `mix-blend-mode: difference`
- **Inquiry form** posts to a Cloudflare Worker endpoint at `/api/inquiry` and (optionally) sends email via [Resend](https://resend.com)

All animations honor `prefers-reduced-motion`.

## Local development

```bash
npm install
npm run dev    # http://localhost:4321
```

## Routes

- `/` — single-scroll marketing page (hero, featured drop slider, manifesto, summon CTA, process, lookbook)
- `/portfolio` — full archive grid
- `/portfolio/[slug]` — individual piece detail page
- `/contact` — inquiry form + atelier info

## Adding a new piece

Create a markdown file in `src/content/pieces/` following the existing schema in [src/content.config.ts](src/content.config.ts):

```md
---
index: 8
earStyle: bunny       # demon | bunny | fox | cat | custom
materials:
  - "..."
heroImage: "/images/your-new-photo.jpg"
summary: "one-line description used in cards and meta tags"
status: featured      # featured | available | archive
dateCompleted: 2026-05-20
---

Long-form body copy goes here.
```

Pieces have no name — the display label (`OBJECT 008`) is derived from `index` via `objectLabel()` in [src/consts.ts](src/consts.ts). Drop the photo into `public/images/`. Name the file with the zero-padded number only; the slug is the filename (`008.md` → `/portfolio/008`).

Mark `status: featured` or `status: available` to surface a piece in the home page slider.

## Wiring up real email (optional)

The inquiry form already works in dev — every submission is logged via `console.log` so you can see it with `npx wrangler tail` after deploying. To send real emails on submission:

1. Sign up at [resend.com](https://resend.com), grab an API key
2. Add as a Wrangler secret:
   ```bash
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put INQUIRY_TO_EMAIL     # e.g. you@yourdomain.com
   npx wrangler secret put INQUIRY_FROM_EMAIL   # e.g. "bad juju <inquiry@yourdomain.com>"
   ```
3. For local dev, you can set these in `.dev.vars` (gitignored).

The endpoint also accepts a honeypot field (`company`) to filter bots.

## Things to swap before launch

- [src/consts.ts](src/consts.ts) — site title, description, atelier coords, contact email, Instagram URL
- [public/favicon.svg](public/favicon.svg) — currently the Astro default
- All copy in the home sections — they're written in-voice as placeholders, not Lorem ipsum, but they're still placeholder
- The 7 piece markdown files in `src/content/pieces/` — names, descriptions, materials
- `astro.config.mjs` `site:` URL — currently `https://example.com`

## Commands

| Command                           | Action                                           |
| :-------------------------------- | :----------------------------------------------- |
| `npm install`                     | Install dependencies                             |
| `npm run dev`                     | Start local dev server at `localhost:4321`       |
| `npm run build`                   | Build the production site to `./dist/`           |
| `npm run preview`                 | Preview the build locally via Wrangler           |
| `npm run check`                   | Build + TS check + Wrangler dry-run              |
| `npm run deploy`                  | Deploy to Cloudflare Workers                     |
| `npx wrangler tail`               | Stream live logs (see inquiry submissions)       |
