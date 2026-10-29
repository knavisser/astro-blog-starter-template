// Decides what `npm run photos` has to do: which originals in photos/ need a
// (new) web copy in src/assets/ and which web copies are stale. Pure on purpose
// (no filesystem access) so tests/photo-sync.test.mjs can cover the rules.
//
// Paths are relative and use forward slashes. Sources are relative to photos/,
// targets to src/assets/. The first folder in a path (hoodies, other) is its
// "root"; loose files directly inside photos/ are ignored, and so is anything in
// a folder whose name starts with "_" (e.g. photos/_excluded).

const PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);

const extensionOf = (p) => {
	const dot = p.lastIndexOf(".");
	return dot > p.lastIndexOf("/") ? p.slice(dot).toLowerCase() : "";
};

const rootOf = (p) => {
	const slash = p.indexOf("/");
	return slash === -1 ? null : p.slice(0, slash);
};

const inExcludedFolder = (p) =>
	p
		.split("/")
		.slice(0, -1)
		.some((folder) => folder.startsWith("_"));

export const isPhoto = (p) =>
	PHOTO_EXTENSIONS.has(extensionOf(p)) && rootOf(p) !== null && !inExcludedFolder(p);

// Web copies keep the folder and file name but are always JPEGs.
export const webCopyPath = (sourcePath) => {
	const ext = extensionOf(sourcePath);
	return (ext ? sourcePath.slice(0, -ext.length) : sourcePath) + ".jpg";
};

/**
 * @param {{
 *   sources: Array<{ path: string, mtimeMs: number }>,
 *   targets: Array<{ path: string, mtimeMs: number }>,
 *   force?: boolean,
 * }} input
 */
export function planSync({ sources, targets, force = false }) {
	const photos = sources.filter((s) => isPhoto(s.path));

	// Only roots that actually contain originals are mirrored. A missing or
	// empty photos/other must never delete the committed web copies.
	const roots = new Set(photos.map((s) => rootOf(s.path)));

	const byTarget = new Map();
	for (const source of photos) {
		const target = webCopyPath(source.path);
		byTarget.set(target, [...(byTarget.get(target) ?? []), source]);
	}

	const conflicts = [...byTarget.values()]
		.filter((group) => group.length > 1)
		.map((group) => group.map((s) => s.path).sort());

	const existing = new Map(
		targets.filter((t) => isPhoto(t.path) && roots.has(rootOf(t.path))).map((t) => [t.path, t])
	);

	const write = [];
	const unchanged = [];
	for (const [target, group] of byTarget) {
		if (group.length > 1) continue;
		const [source] = group;
		const copy = existing.get(target);
		if (force || !copy || source.mtimeMs > copy.mtimeMs) {
			write.push({ source: source.path, target });
		} else {
			unchanged.push(target);
		}
	}

	const remove = [...existing.keys()].filter((target) => !byTarget.has(target));

	const skippedRoots = [
		...new Set(targets.filter((t) => isPhoto(t.path)).map((t) => rootOf(t.path))),
	].filter((root) => !roots.has(root));

	const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
	return {
		write: write.sort((a, b) => byPath(a.target, b.target)),
		remove: remove.sort(byPath),
		unchanged: unchanged.sort(byPath),
		skippedRoots: skippedRoots.sort(byPath),
		conflicts,
	};
}
