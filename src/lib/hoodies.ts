// The hoodies and collections the site renders. Each folder in
// src/assets/hoodies is one hoodie (see hoodie-core.ts for the rules); status,
// dates, collections and covers come from src/data/hoodies.ts.
import type { ImageMetadata } from "astro";
import {
	buildHoodies,
	parsePhotoRef,
	splitPhotoPath,
	type Collection,
	type Hoodie,
	type Photo,
} from "./hoodie-core";
import { collections as collectionInfo, hoodieInfo } from "../data/hoodies";

export type { Status } from "./hoodie-core";
export type HoodieEntry = Hoodie<ImageMetadata>;
export type CollectionEntry = Collection<ImageMetadata>;

const ROOT = "/src/assets/hoodies/";

const images = import.meta.glob<ImageMetadata>("/src/assets/hoodies/*/*.{jpg,jpeg,png,webp}", {
	eager: true,
	import: "default",
});

const photos: Photo<ImageMetadata>[] = Object.entries(images).flatMap(([path, image]) => {
	const parts = splitPhotoPath(path, ROOT);
	return parts ? [{ ...parts, image }] : [];
});

const built = buildHoodies(photos, hoodieInfo, collectionInfo);
for (const warning of built.warnings) console.warn(`[hoodies] ${warning}`);

/** Every hoodie, ordered by number. */
export const hoodies: HoodieEntry[] = built.hoodies;

/** Collections that have at least one hoodie, in the order they're listed. */
export const collections: CollectionEntry[] = built.collections.filter((c) => c.count > 0);

export function getHoodie(number: number): HoodieEntry {
	const hoodie = hoodies.find((h) => h.number === number);
	if (!hoodie) throw new Error(`There's no hoodie folder numbered ${number}.`);
	return hoodie;
}

export function collectionOf(hoodie: HoodieEntry): CollectionEntry | undefined {
	return collections.find((c) => c.key === hoodie.collection);
}

/** One specific photo, e.g. getPhoto("17/_DSC9696.jpg"), plus the hoodie it belongs to. */
export function getPhoto(ref: string): { hoodie: HoodieEntry; image: ImageMetadata } {
	const parsed = parsePhotoRef(ref);
	const hoodie = parsed ? hoodies.find((h) => h.number === parsed.number) : undefined;
	const image = parsed && hoodie ? images[`${ROOT}${hoodie.folder}/${parsed.file}`] : undefined;
	if (!hoodie || !image) {
		throw new Error(`There's no hoodie photo "${ref}" (expected "<object number>/<file name>").`);
	}
	return { hoodie, image };
}

/** Like getPhoto, for photos picked for the home page: fails if the hoodie is kept off it. */
export function getHomePagePhoto(ref: string): { hoodie: HoodieEntry; image: ImageMetadata } {
	const photo = getPhoto(ref);
	if (!photo.hoodie.onHomePage) {
		throw new Error(`"${ref}" can't be used on the home page: hoodie ${photo.hoodie.id} is set to onHomePage: false.`);
	}
	return photo;
}
