import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const pieces = defineCollection({
	loader: glob({ base: "./src/content/pieces", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		name: z.string(),
		index: z.number(),
		earStyle: z.string().min(1).max(60),
		materials: z.array(z.string()),
		heroImage: z.string(),
		gallery: z.array(z.string()).optional(),
		summary: z.string(),
		status: z.enum(["archive", "featured", "available"]),
		dateCompleted: z.coerce.date().optional(),
	}),
});

export const collections = { pieces };
