# Rename `/archive` → `/products` with two sections

**Date:** 2026-05-27
**Status:** Approved, ready for implementation plan

## Goal

Rename the `/archive` section to `/products` and split it into two stacked sections on one page:

1. **Available Products** — currently for-sale hoodies (typically 0–2 at a time)
2. **Archive** — sold/retired pieces, with `featured` items promoted to the top

The Available section must feel scarce and event-like: 60%+ of the time it will be empty and should communicate that intentionally rather than look broken.

## Context

The current `/archive` page lists all 12 pieces in a single mosaic grid regardless of status. Pieces have a `status` field in their frontmatter: `available | featured | archive`. Status distribution at time of writing: 4 available, 7 featured, 1 archive. Going forward, `featured` is reinterpreted as a highlight flag on archive pieces (not a separate state), and `available` will be reserved for the small set of pieces currently for sale.

## Routing

- Move `src/pages/archive.astro` → `src/pages/products.astro`
- Move `src/pages/archive/[slug].astro` → `src/pages/products/[slug].astro`
- No redirects. All internal links are updated in the same change.

Internal links to update:
- `src/components/Header.astro` — nav link `/archive` → `/products`, label `ARCHIVE` → `PRODUCTS`
- `src/components/Footer.astro` — same nav update
- `src/components/home/FeaturedDrop.astro` — card CTA `/archive/${piece.id}` → `/products/${piece.id}`
- `src/pages/products/[slug].astro` (renamed) — back-link `/archive` → `/products`, label `BACK TO ARCHIVE` → `BACK TO PRODUCTS`

## Page structure: `/products`

### Hero strip (kept from current `/archive`)

- Kicker: `// PORTFOLIO · PRODUCTS`
- Title: `THE · COLLECTION` (replaces `EVERY · PIECE · EVER`)
- Lede: rewritten to reflect the two-section model — "Currently available pieces below. Past pieces in the archive — one of one, no restocks."
- Stats: keep `TOTAL` / `AVAILABLE` / `ARCHIVED`. `ARCHIVED` stat counts `archive + featured` pieces (since featured is now a flag on archive pieces).

### Section A — Available Products

**Filter:** `status === 'available'`
**Sort:** by `index` ascending

Three render modes based on count:

- **0 pieces (default, 60%+ of the time):** Render an empty-state block, centered, framed (subtle 1px border + generous padding). Content:
  - Small mono label: `// CURRENTLY AVAILABLE`
  - Large display text: `NO PIECES AVAILABLE`
  - Smaller line: `NEXT DROP BY INQUIRY`
  - CTA button styled like the existing `.card__cta` (acid accent on hover): `REQUEST A PIECE →` linking to `/custom#summon`
- **1–2 pieces:** Hero-style grid — larger tiles than the archive grid (aspect-ratio 4/5, larger captions).
  - 1 piece: centered, max-width ~520px so it reads as a featured object rather than a sparse grid cell.
  - 2 pieces: 2 equal columns on desktop, stacked single-column on mobile.
- **3+ pieces (rare):** Fall back to the standard archive-style mosaic grid.

Section header (always rendered when section visible):
- Kicker: `// I. CURRENTLY AVAILABLE`
- Title: `AVAILABLE · PIECES`

### Section B — Archive

**Filter:** `status === 'archive' || status === 'featured'`
**Sort:** featured first (by `index` asc), then archive (by `index` asc)

- Reuses the existing mosaic grid (`grid-template-columns: repeat(6, 1fr)`, `tile--tall`, `tile--wide`).
- `featured` pieces show a `FEATURED` status pill instead of `ARCHIVE`.

Section header:
- Kicker: `// II. ARCHIVE`
- Title: `ARCHIVE · PIECES`

## Status pill styles (`.tile__status`)

Existing:
- `.is-available` — acid background, ink text (kept as-is)
- `.is-archive` — dark background, bone text (kept as-is)

New:
- `.is-featured` — bone background, ink text, 1px acid border. Distinct from `is-available` (solid acid fill, more vivid) and `is-archive` (dark/muted). Communicates "notable archive piece" without competing with the available pill's intensity.

## Schema

No changes to `src/content.config.ts`. The `status` enum stays `["archive", "featured", "available"]`. Semantics shift in the UI:
- `available` → buyable now (rare)
- `featured` → notable archive piece (promoted in archive section)
- `archive` → standard archive piece

## Files touched

**Renamed:**
- `src/pages/archive.astro` → `src/pages/products.astro`
- `src/pages/archive/[slug].astro` → `src/pages/products/[slug].astro`

**Edited:**
- `src/components/Header.astro` — nav label + href
- `src/components/Footer.astro` — nav label + href
- `src/components/home/FeaturedDrop.astro` — card CTA href
- `src/pages/products.astro` (renamed) — split into Available + Archive sections, empty-state, hero-mode for 1–2 available, new `.is-featured` pill style, sort featured-first within archive
- `src/pages/products/[slug].astro` (renamed) — back-link href + label

**Not touched:**
- Content schema (`src/content.config.ts`)
- Piece markdown files (`src/content/pieces/*.md`)
- Detail page body, layout, styling
- Any other component

## Non-goals

- Adding e-commerce / cart / checkout (out of scope — Request A Piece CTA only)
- Filtering / tabs / URL params for the products page
- Adding redirects from old `/archive` routes
- Changing the home page's `FeaturedDrop` behavior beyond the link href
- Re-tagging piece statuses
