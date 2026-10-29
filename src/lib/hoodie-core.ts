// Turns the hoodie photo folders into portfolio entries. Every folder in
// src/assets/hoodies (mirrored from photos/hoodies by `npm run photos`) is one
// hoodie; its leading number is the OBJECT number.
//
// Kept free of imports (and of import.meta.glob, which lives in hoodies.ts) so
// tests/hoodie-core.test.mjs can load it directly. Mistakes in the hoodie list
// (src/data/hoodies.ts) throw, so they fail the build instead of shipping.

export type Status = "archive" | "featured" | "available";

export interface HoodieInfo {
	/** Defaults to "archive". */
	status?: Status;
	/** yyyy-mm-dd. Defaults to the collection's date. */
	completed?: string;
	/** Key of an entry in `collections`. */
	collection?: string;
	/** File name of the cover photo. Defaults to the first photo by file name. */
	cover?: string;
	/** false keeps the hoodie off the home page (it stays in the portfolio). Defaults to true. */
	onHomePage?: boolean;
}

export interface CollectionInfo {
	name: string;
	/** yyyy-mm-dd, also the default completion date of its hoodies. */
	date?: string;
	/** "<object number>/<file name>", e.g. "2/_DSC9884.jpg". Defaults to the first hoodie's cover. */
	cover?: string;
}

export interface Photo<T> {
	folder: string;
	file: string;
	image: T;
}

export interface Hoodie<T> {
	number: number;
	/** Zero-padded number, also the URL slug: /portfolio/013 */
	id: string;
	folder: string;
	status: Status;
	completed?: string;
	collection?: string;
	onHomePage: boolean;
	cover: T;
	/** Cover first, then the rest in file name order. */
	photos: T[];
}

export interface Collection<T> {
	key: string;
	name: string;
	date?: string;
	count: number;
	cover?: T;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "/src/assets/hoodies/13 - Grey/a.jpg" -> { folder: "13 - Grey", file: "a.jpg" } */
export function splitPhotoPath(path: string, root: string): { folder: string; file: string } | null {
	if (!path.startsWith(root)) return null;
	const parts = path.slice(root.length).split("/");
	return parts.length === 2 ? { folder: parts[0], file: parts[1] } : null;
}

/** "13 - Grey panel hoodie" -> 13 */
export function folderNumber(folder: string): number | null {
	const match = /^\s*(\d+)/.exec(folder);
	return match ? Number(match[1]) : null;
}

/** A specific photo of a hoodie: "22/_DSC9696.jpg" -> { number: 22, file: "_DSC9696.jpg" } */
export function parsePhotoRef(ref: string): { number: number; file: string } | null {
	const match = /^(\d+)\/([^/]+)$/.exec(ref);
	return match ? { number: Number(match[1]), file: match[2] } : null;
}

/** Natural order, so "shot-2" comes before "shot-10". */
const byFileName = (a: string, b: string) =>
	a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

export function buildHoodies<T>(
	photos: Photo<T>[],
	info: Record<number, HoodieInfo>,
	collections: Record<string, CollectionInfo>
): { hoodies: Hoodie<T>[]; collections: Collection<T>[]; warnings: string[] } {
	const warnings: string[] = [];

	const folders = new Map<string, Photo<T>[]>();
	for (const photo of photos) {
		folders.set(photo.folder, [...(folders.get(photo.folder) ?? []), photo]);
	}

	const byNumber = new Map<number, { folder: string; photos: Photo<T>[] }>();
	for (const [folder, folderPhotos] of folders) {
		const number = folderNumber(folder);
		if (number === null) {
			warnings.push(`Skipped hoodie folder "${folder}": its name doesn't start with a number.`);
			continue;
		}
		const taken = byNumber.get(number);
		if (taken) {
			throw new Error(`Hoodie folders "${taken.folder}" and "${folder}" both use number ${number}.`);
		}
		byNumber.set(number, { folder, photos: folderPhotos });
	}

	for (const key of Object.keys(info)) {
		if (!byNumber.has(Number(key))) {
			warnings.push(`The hoodie list has an entry for ${key}, but there's no folder with that number.`);
		}
	}

	const hoodies = [...byNumber.entries()]
		.sort(([a], [b]) => a - b)
		.map(([number, { folder, photos: folderPhotos }]): Hoodie<T> => {
			const details = info[number] ?? {};
			const sorted = [...folderPhotos].sort((a, b) => byFileName(a.file, b.file));

			let coverIndex = 0;
			if (details.cover) {
				coverIndex = sorted.findIndex((p) => p.file === details.cover);
				if (coverIndex === -1) {
					throw new Error(`Hoodie ${number}: cover "${details.cover}" isn't a photo in "${folder}".`);
				}
			}
			const ordered = [sorted[coverIndex], ...sorted.filter((_, i) => i !== coverIndex)];

			if (details.collection && !collections[details.collection]) {
				throw new Error(`Hoodie ${number}: unknown collection "${details.collection}".`);
			}
			const completed = details.completed ?? (details.collection ? collections[details.collection].date : undefined);
			if (completed && !DATE.test(completed)) {
				throw new Error(`Hoodie ${number}: completed date "${completed}" should look like 2026-07-25.`);
			}

			return {
				number,
				id: String(number).padStart(3, "0"),
				folder,
				status: details.status ?? "archive",
				completed,
				collection: details.collection,
				onHomePage: details.onHomePage ?? true,
				cover: ordered[0].image,
				photos: ordered.map((p) => p.image),
			};
		});

	const resolvedCollections = Object.entries(collections).map(([key, collection]): Collection<T> => {
		const members = hoodies.filter((h) => h.collection === key);
		let cover = members[0]?.cover;
		if (collection.cover) {
			const ref = parsePhotoRef(collection.cover);
			const photo = ref && byNumber.get(ref.number)?.photos.find((p) => p.file === ref.file);
			if (!photo) {
				throw new Error(`Collection "${key}": cover "${collection.cover}" doesn't match a hoodie photo.`);
			}
			cover = photo.image;
		}
		return { key, name: collection.name, date: collection.date, count: members.length, cover };
	});

	return { hoodies, collections: resolvedCollections, warnings };
}
