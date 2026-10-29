// Mirrors photos/ (full-size originals, git-ignored) into src/assets/ as
// web-size JPEGs. Astro then builds the responsive sizes from those copies.
//
//   npm run photos                 export new or changed photos, drop deleted ones
//   npm run photos -- --dry-run    only show what would change
//   npm run photos -- --force      re-export everything
//
// Folder names carry over unchanged, so photos/hoodies/13 - Grey panel hoodie/
// becomes src/assets/hoodies/13 - Grey panel hoodie/.

import { readdir, readFile, writeFile, rename, rm, mkdir, stat, rmdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { planSync } from "./photo-sync.mjs";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const SOURCE = path.join(root, "photos");
const TARGET = path.join(root, "src", "assets");

const MAX_EDGE = 2560; // px on the longest side, enough for a full-screen photo
const QUALITY = 80; // mozjpeg
const PARALLEL = 4;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");

const toPosix = (p) => p.split(path.sep).join("/");
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function listFiles(dir) {
	if (!existsSync(dir)) return [];
	const entries = await readdir(dir, { recursive: true, withFileTypes: true });
	return Promise.all(
		entries
			.filter((e) => e.isFile())
			.map(async (e) => {
				const abs = path.join(e.parentPath ?? e.path, e.name);
				return { path: toPosix(path.relative(dir, abs)), mtimeMs: (await stat(abs)).mtimeMs };
			})
	);
}

// A JPEG that is already small enough and carries no camera metadata is copied
// as-is, so we never re-compress an already compressed photo. Everything else is
// rotated upright, scaled down and saved without metadata (no GPS on the site).
async function exportPhoto(from, to) {
	const input = await readFile(from);
	const meta = await sharp(input).metadata();
	const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
	const webReady =
		meta.format === "jpeg" && longEdge <= MAX_EDGE && !meta.exif && (meta.orientation ?? 1) === 1;

	const output = webReady
		? input
		: await sharp(input)
				.rotate()
				.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
				.jpeg({ quality: QUALITY, mozjpeg: true })
				.toBuffer();

	await mkdir(path.dirname(to), { recursive: true });
	// write next to the target first so an interrupted run never leaves a
	// half-written file that looks up to date
	const tmp = `${to}.partial`;
	await writeFile(tmp, output);
	await rename(tmp, to);
	return { copied: webReady, bytes: output.length };
}

async function removeEmptyDirs(dir) {
	if (!existsSync(dir)) return;
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) await removeEmptyDirs(path.join(dir, entry.name));
	}
	if (dir !== TARGET && (await readdir(dir)).length === 0) await rmdir(dir);
}

if (!existsSync(SOURCE)) {
	console.error(
		"No photos/ folder found. It holds the full-size originals and is not in git,\n" +
			"so it only exists on the machine the photos were added from."
	);
	process.exit(1);
}

const plan = planSync({ sources: await listFiles(SOURCE), targets: await listFiles(TARGET), force });

if (plan.conflicts.length) {
	console.error("These originals would end up as the same web copy. Rename one of each pair:");
	for (const group of plan.conflicts) console.error(`  ${group.join("  <>  ")}`);
	process.exit(1);
}

for (const skipped of plan.skippedRoots) {
	console.warn(`photos/${skipped} has no photos, so src/assets/${skipped} was left alone.`);
}

console.log(
	`${plan.write.length} to export, ${plan.remove.length} to remove, ${plan.unchanged.length} up to date` +
		(dryRun ? " (dry run)" : "")
);
for (const target of plan.remove) console.log(`  - ${target}`);
if (dryRun) {
	for (const { target } of plan.write) console.log(`  + ${target}`);
	process.exit(0);
}

for (const target of plan.remove) await rm(path.join(TARGET, target));
await removeEmptyDirs(TARGET);

let written = 0;
const queue = [...plan.write];
await Promise.all(
	Array.from({ length: PARALLEL }, async () => {
		for (let job = queue.shift(); job; job = queue.shift()) {
			const result = await exportPhoto(path.join(SOURCE, job.source), path.join(TARGET, job.target));
			written += result.bytes;
			console.log(`  + ${job.target}  ${mb(result.bytes)}${result.copied ? "  (copied)" : ""}`);
		}
	})
);

if (plan.write.length) console.log(`Wrote ${mb(written)} of web copies.`);
