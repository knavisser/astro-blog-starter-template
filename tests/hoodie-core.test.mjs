import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./load-ts.mjs";

const { buildHoodies, splitPhotoPath, folderNumber, parsePhotoRef } = await importTs("src/lib/hoodie-core.ts");

// In the site the image is Astro's ImageMetadata; here a readable string will do.
const photo = (folder, file) => ({ folder, file, image: `${folder}/${file}` });

test("splitPhotoPath reads the folder and file from a glob key", () => {
	assert.deepEqual(splitPhotoPath("/src/assets/hoodies/13 - Grey panel/BadJujuShoot-01.jpg", "/src/assets/hoodies/"), {
		folder: "13 - Grey panel",
		file: "BadJujuShoot-01.jpg",
	});
	assert.equal(splitPhotoPath("/src/assets/hoodies/13 - Grey/extra/a.jpg", "/src/assets/hoodies/"), null);
	assert.equal(splitPhotoPath("/src/assets/other/a/b.jpg", "/src/assets/hoodies/"), null);
});

test("folderNumber takes the leading number of a folder name", () => {
	assert.equal(folderNumber("13 - Grey panel hoodie"), 13);
	assert.equal(folderNumber("07 - Black"), 7);
	assert.equal(folderNumber("Grey panel hoodie"), null);
});

test("parsePhotoRef reads '<object number>/<file name>'", () => {
	assert.deepEqual(parsePhotoRef("22/_DSC9696.jpg"), { number: 22, file: "_DSC9696.jpg" });
	assert.deepEqual(parsePhotoRef("013/BadJujuShoot-07.jpg"), { number: 13, file: "BadJujuShoot-07.jpg" });
	assert.equal(parsePhotoRef("_DSC9696.jpg"), null);
	assert.equal(parsePhotoRef("22/"), null);
	assert.equal(parsePhotoRef("22/a/b.jpg"), null);
});

test("every numbered folder becomes a hoodie, ordered by number, with a padded id", () => {
	const { hoodies } = buildHoodies([photo("13 - Grey", "a.jpg"), photo("02 - Navy", "b.jpg")], {}, {});
	assert.deepEqual(
		hoodies.map((h) => [h.number, h.id, h.folder]),
		[
			[2, "002", "02 - Navy"],
			[13, "013", "13 - Grey"],
		]
	);
});

test("photos follow natural file name order and the first one is the cover", () => {
	const { hoodies } = buildHoodies(
		[photo("13 - Grey", "shot-10.jpg"), photo("13 - Grey", "shot-2.jpg"), photo("13 - Grey", "shot-1.jpg")],
		{},
		{}
	);
	assert.deepEqual(hoodies[0].photos, ["13 - Grey/shot-1.jpg", "13 - Grey/shot-2.jpg", "13 - Grey/shot-10.jpg"]);
	assert.equal(hoodies[0].cover, "13 - Grey/shot-1.jpg");
});

test("a cover picked in the list moves to the front", () => {
	const { hoodies } = buildHoodies(
		[photo("13 - Grey", "a.jpg"), photo("13 - Grey", "b.jpg"), photo("13 - Grey", "c.jpg")],
		{ 13: { cover: "c.jpg" } },
		{}
	);
	assert.equal(hoodies[0].cover, "13 - Grey/c.jpg");
	assert.deepEqual(hoodies[0].photos, ["13 - Grey/c.jpg", "13 - Grey/a.jpg", "13 - Grey/b.jpg"]);
});

test("a cover that isn't in the folder fails the build", () => {
	assert.throws(
		() => buildHoodies([photo("13 - Grey", "a.jpg")], { 13: { cover: "typo.jpg" } }, {}),
		/typo\.jpg/
	);
});

test("status defaults to archive and completed falls back to the collection date", () => {
	const { hoodies } = buildHoodies(
		[photo("13 - Grey", "a.jpg"), photo("01 - Yellow", "b.jpg")],
		{ 13: { collection: "ndsm" } },
		{ ndsm: { name: "NDSM", date: "2026-07-25" } }
	);
	const [studio, ndsm] = hoodies;
	assert.equal(studio.status, "archive");
	assert.equal(studio.completed, undefined);
	assert.equal(studio.collection, undefined);
	assert.equal(ndsm.collection, "ndsm");
	assert.equal(ndsm.completed, "2026-07-25");
});

test("an explicit completed date wins over the collection date", () => {
	const { hoodies } = buildHoodies(
		[photo("13 - Grey", "a.jpg")],
		{ 13: { status: "featured", collection: "ndsm", completed: "2026-06-01" } },
		{ ndsm: { name: "NDSM", date: "2026-07-25" } }
	);
	assert.equal(hoodies[0].status, "featured");
	assert.equal(hoodies[0].completed, "2026-06-01");
});

test("hoodies show on the home page unless the list turns it off", () => {
	const { hoodies } = buildHoodies(
		[photo("13 - Grey", "a.jpg"), photo("23 - Black", "b.jpg")],
		{ 23: { onHomePage: false } },
		{}
	);
	assert.deepEqual(
		hoodies.map((h) => [h.number, h.onHomePage]),
		[
			[13, true],
			[23, false],
		]
	);
});

test("a malformed completed date fails the build", () => {
	assert.throws(() => buildHoodies([photo("13 - Grey", "a.jpg")], { 13: { completed: "25-07-2026" } }, {}), /25-07-2026/);
});

test("an unknown collection fails the build", () => {
	assert.throws(() => buildHoodies([photo("13 - Grey", "a.jpg")], { 13: { collection: "nsdm" } }, {}), /nsdm/);
});

test("two folders with the same number fail the build", () => {
	assert.throws(() => buildHoodies([photo("13 - Grey", "a.jpg"), photo("13 - Blue", "b.jpg")], {}, {}), /13/);
});

test("folders without a number are skipped with a warning", () => {
	const { hoodies, warnings } = buildHoodies([photo("New hoodie", "a.jpg"), photo("13 - Grey", "b.jpg")], {}, {});
	assert.deepEqual(
		hoodies.map((h) => h.number),
		[13]
	);
	assert.match(warnings.join("\n"), /New hoodie/);
});

test("list entries without a folder produce a warning", () => {
	const { warnings } = buildHoodies([photo("13 - Grey", "a.jpg")], { 14: { status: "featured" } }, {});
	assert.match(warnings.join("\n"), /14/);
});

test("collections report their piece count and cover", () => {
	const { collections } = buildHoodies(
		[photo("13 - Grey", "a.jpg"), photo("14 - Black", "b.jpg"), photo("14 - Black", "c.jpg"), photo("01 - Yellow", "d.jpg")],
		{ 13: { collection: "ndsm" }, 14: { collection: "ndsm" } },
		{ ndsm: { name: "NDSM", date: "2026-07-25", cover: "14/c.jpg" }, later: { name: "LATER" } }
	);
	assert.deepEqual(collections, [
		{ key: "ndsm", name: "NDSM", date: "2026-07-25", count: 2, cover: "14 - Black/c.jpg" },
		{ key: "later", name: "LATER", date: undefined, count: 0, cover: undefined },
	]);
});

test("a collection without a picked cover uses its first hoodie's cover", () => {
	const { collections } = buildHoodies(
		[photo("14 - Black", "b.jpg"), photo("13 - Grey", "a.jpg")],
		{ 13: { collection: "ndsm" }, 14: { collection: "ndsm" } },
		{ ndsm: { name: "NDSM" } }
	);
	assert.equal(collections[0].cover, "13 - Grey/a.jpg");
});

test("a collection cover that doesn't exist fails the build", () => {
	assert.throws(
		() =>
			buildHoodies([photo("13 - Grey", "a.jpg")], { 13: { collection: "ndsm" } }, { ndsm: { name: "NDSM", cover: "13/nope.jpg" } }),
		/13\/nope\.jpg/
	);
});
