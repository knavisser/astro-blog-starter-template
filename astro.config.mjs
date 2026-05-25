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
});
