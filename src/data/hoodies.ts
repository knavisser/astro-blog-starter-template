import type { CollectionInfo, HoodieInfo } from "../lib/hoodie-core";

// Collections a hoodie can belong to. The key is what a hoodie's `collection`
// points at, and what the portfolio filter link uses: /portfolio?collection=ndsm
//   date:  yyyy-mm-dd, also the completion date of its hoodies unless they set their own
//   cover: "<object number>/<file name>", the photo on the collection's card
export const collections: Record<string, CollectionInfo> = {
	ndsm: { name: "NDSM", date: "2026-07-25", cover: "2/_DSC9884.jpg" },
};

// One line per folder in photos/hoodies, keyed by the folder's number. A folder
// without a line still shows up, as archive, with no date or collection.
//   status:     "archive" | "featured" | "available"
//   completed:  yyyy-mm-dd (falls back to the collection's date)
//   collection: a key from `collections` above
//   cover:      file name of the cover photo (default: the first photo by file name)
//   onHomePage: false keeps it off the home page; it still shows in the portfolio
export const hoodieInfo: Record<number, HoodieInfo> = {
	1: { status: "featured", completed: "2026-02-14" },
	2: { status: "featured", completed: "2026-01-22", collection: "ndsm", cover: "_DSC9876.jpg" },
	3: { status: "featured", completed: "2026-03-02" },
	4: { status: "featured", completed: "2026-04-08" },
	5: { status: "archive", completed: "2026-02-28" },
	6: { status: "archive", completed: "2025-11-19" },
	7: { status: "archive", completed: "2026-04-29" },
	8: { status: "archive", completed: "2026-05-04" },
	9: { status: "archive", completed: "2026-05-12" },
	10: { status: "archive", completed: "2026-05-18" },
	11: { status: "featured", completed: "2026-05-22", collection: "ndsm", cover: "_DSC7036.jpg" },
	12: { status: "archive", completed: "2026-05-25" },
	13: { status: "archive", collection: "ndsm" },
	14: { status: "archive", collection: "ndsm", cover: "BadJujuShoot-21.jpg" },
	15: { status: "archive", collection: "ndsm", cover: "BadJujuShoot-09.jpg" },
	16: { status: "archive", collection: "ndsm" },
	17: { status: "archive", collection: "ndsm", cover: "BadJujuShoot-28.jpg" },
	18: { status: "archive", collection: "ndsm", cover: "BadJujuShoot-30.jpg" },
	19: { status: "archive", collection: "ndsm", cover: "_DSC9580.jpg" },
	20: { status: "archive", collection: "ndsm" },
	21: { status: "archive", collection: "ndsm" },
	22: { status: "archive", collection: "ndsm", cover: "_DSC9726.jpg" },
	// Portfolio only: keep 23 off the home page (and its photos with a visible
	// face are in photos/_excluded, not on the site).
	23: { status: "archive", collection: "ndsm", onHomePage: false },
	24: { status: "archive", collection: "ndsm" },
	25: { status: "archive", collection: "ndsm" },
};
