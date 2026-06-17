// One-off image optimizer. Re-compresses the heavy source JPEGs in place
// (same filenames/paths, so no code or content references need to change) so
// the site ships a few MB of images instead of ~40 MB.
//
// Run with: npm run optimize:images
// Originals are recoverable via git if a result ever looks wrong.

import { readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");

// Heavy JPEGs only. PNG logos are small and need transparency/crispness, so
// they are intentionally left alone.
const targets = [
	...Array.from({ length: 12 }, (_, i) => `public/images/hoodie${i + 1}.jpg`),
	...Array.from({ length: 4 }, (_, i) => `public/images/WIP${i + 1}.jpg`),
	"public/png/map_bg.jpg",
];

const MAX_WIDTH = 2000; // only downscale; never enlarge
const QUALITY = 80; // mozjpeg, visually indistinguishable at display sizes

const kb = (bytes) => (bytes / 1024).toFixed(0).padStart(6) + " KB";

let totalBefore = 0;
let totalAfter = 0;

for (const rel of targets) {
	const abs = path.join(root, rel);
	if (!existsSync(abs)) {
		console.warn(`skip (missing): ${rel}`);
		continue;
	}

	const before = (await stat(abs)).size;
	// Read into a buffer first — sharp cannot safely read and overwrite the
	// same path in a single streamed pipeline.
	const input = await readFile(abs);
	const output = await sharp(input)
		.resize({ width: MAX_WIDTH, withoutEnlargement: true })
		.jpeg({ quality: QUALITY, mozjpeg: true })
		.toBuffer();

	// Guard against the rare case where re-encoding grows the file.
	if (output.length >= before) {
		console.log(`keep (already small): ${rel}  ${kb(before)}`);
		totalBefore += before;
		totalAfter += before;
		continue;
	}

	await writeFile(abs, output);
	totalBefore += before;
	totalAfter += output.length;
	const saved = (100 * (1 - output.length / before)).toFixed(0);
	console.log(`${rel.padEnd(28)} ${kb(before)} -> ${kb(output.length)}  (-${saved}%)`);
}

console.log("\n" + "-".repeat(60));
console.log(`TOTAL  ${kb(totalBefore)} -> ${kb(totalAfter)}  (-${(100 * (1 - totalAfter / totalBefore)).toFixed(0)}%)`);
