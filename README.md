# bad juju

Marketing site for **bad juju** — one of one, made-to-order hoodies stitched with ears, horns, and other modifications. Built on Astro 5 + Cloudflare Workers.

> "bad juju" is a working name placeholder. Swap it globally in [src/consts.ts](src/consts.ts) when the real name lands.

## Stack

- **Astro 5** with the **Cloudflare Workers** adapter
- **Photo folders** drive `/portfolio` and the featured slider: each hoodie is one numbered folder of photos (see [Adding a hoodie](#adding-a-hoodie))
- **astro:assets** builds responsive WebP sizes of every photo at build time
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

- `/` — single-scroll marketing page (hero, featured drop slider, manifesto, summon CTA, NDSM reel, process, lookbook)
- `/portfolio` — full archive grid, filterable by collection (`/portfolio?collection=ndsm`)
- `/portfolio/[slug]` — individual piece page with all of its photos
- `/custom` — inquiry form + atelier info

## Adding a hoodie

Photos live in two places:

- `photos/` holds the full-size originals. It's git-ignored (hundreds of MB), so keep your own backup.
  - `photos/hoodies/` has one folder per hoodie, named `<number> - <anything>`, e.g. `27 - Red hoodie with horns`
  - `photos/other/` is for everything that isn't a finished hoodie (work in progress, behind the scenes)
  - folders starting with `_` (like `photos/_excluded/`) are never exported: a place for photos that must stay off the site
- `src/assets/` holds web-size copies (max 2560px) of the same folders. These are committed and are what the site uses.

To add a hoodie:

1. Make a new numbered folder in `photos/hoodies/` and drop the photos in.
2. Run `npm run photos`. It exports new or changed photos to `src/assets/` and removes copies whose original is gone. `--dry-run` shows what it would do, `--force` re-exports everything.
3. Add a line for it in [src/data/hoodies.ts](src/data/hoodies.ts): status, completion date, collection and (optionally) which photo is the cover. `onHomePage: false` keeps a hoodie off the home page while it stays in the portfolio. Without a line it still shows up, as archive with no date or collection.

The folder number is the object number: folder `27 - ...` becomes `OBJECT 027` at `/portfolio/027`. Every photo in the folder shows on its page, cover first, then by file name. Collections are listed at the top of the same file.

### Homepage photos

- the featured slider shows the hoodies of one collection, set in [src/pages/index.astro](src/pages/index.astro) (`<FeaturedDrop collection="ndsm" />`)
- the hero slides through `HERO_PHOTOS` in [src/consts.ts](src/consts.ts) (the first one is also the intro's photo and the share image); phones and tablets held upright slide through `HERO_PHOTOS_MOBILE` instead, each with an optional `x` for where it sits on a phone screen

The reel and the lookbook pick specific photos as `<object number>/<file name>`, e.g. `18/_DSC9833.jpg`:

- the NDSM reel lists its frames in [src/pages/index.astro](src/pages/index.astro). In the page it's a row of overlapping prints in the same order, with a button on top; the button slides them out into a full-screen strip where every scroll, swipe or arrow key moves exactly one photo. The X, Esc, or scrolling past either end slides them back into the row. `CollectionReel` works for any collection, so a new one only needs another `<CollectionReel collection="..." frames={[...]} />`
- the lookbook lists its four photos in [src/components/home/Lookbook.astro](src/components/home/Lookbook.astro)

A reference that doesn't match a photo, or points at a hoodie with `onHomePage: false`, fails the build and names the bad reference.

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
- `astro.config.mjs` `site:` URL — currently `https://example.com`

## Commands

| Command                           | Action                                           |
| :-------------------------------- | :----------------------------------------------- |
| `npm install`                     | Install dependencies                             |
| `npm run dev`                     | Start local dev server at `localhost:4321`       |
| `npm run build`                   | Build the production site to `./dist/`           |
| `npm run preview`                 | Preview the build locally via Wrangler           |
| `npm run check`                   | Build + TS check + Wrangler dry-run              |
| `npm run photos`                  | Export photos from `photos/` to `src/assets/`    |
| `npm test`                        | Run the unit tests                               |
| `npm run deploy`                  | Deploy to Cloudflare Workers                     |
| `npx wrangler tail`               | Stream live logs (see inquiry submissions)       |
