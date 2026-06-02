// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
	site: "https://example.com",
	integrations: [mdx(), sitemap(), icon({ include: { tabler: ["*"] } })],
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
	vite: {
		// Pre-bundle lenis on dev startup so it isn't lazily re-optimized
		// mid-session — that lazy re-optimization is what causes the
		// "Outdated Optimize Dep" 504 for lenis.js. Dev-only; build is unaffected.
		optimizeDeps: {
			include: ["lenis"],
		},
	},
});
