import { test } from "node:test";
import assert from "node:assert/strict";
import { planSync, webCopyPath } from "../scripts/photo-sync.mjs";

const file = (path, mtimeMs = 1000) => ({ path, mtimeMs });

test("webCopyPath keeps the folders and always ends in .jpg", () => {
	assert.equal(webCopyPath("hoodies/13 - Grey/BadJujuShoot-01.jpg"), "hoodies/13 - Grey/BadJujuShoot-01.jpg");
	assert.equal(webCopyPath("hoodies/13 - Grey/IMG_1.JPEG"), "hoodies/13 - Grey/IMG_1.jpg");
	assert.equal(webCopyPath("other/Behind the scenes/shot.png"), "other/Behind the scenes/shot.jpg");
});

test("a new photo gets a web copy", () => {
	const plan = planSync({ sources: [file("hoodies/13 - Grey/a.jpg")], targets: [] });
	assert.deepEqual(plan.write, [{ source: "hoodies/13 - Grey/a.jpg", target: "hoodies/13 - Grey/a.jpg" }]);
	assert.deepEqual(plan.remove, []);
});

test("an up to date web copy is left alone", () => {
	const plan = planSync({
		sources: [file("hoodies/13 - Grey/a.jpg", 1000)],
		targets: [file("hoodies/13 - Grey/a.jpg", 2000)],
	});
	assert.deepEqual(plan.write, []);
	assert.deepEqual(plan.unchanged, ["hoodies/13 - Grey/a.jpg"]);
});

test("a photo edited after its web copy was made is exported again", () => {
	const plan = planSync({
		sources: [file("hoodies/13 - Grey/a.jpg", 3000)],
		targets: [file("hoodies/13 - Grey/a.jpg", 2000)],
	});
	assert.equal(plan.write.length, 1);
});

test("force re-exports everything", () => {
	const plan = planSync({
		sources: [file("hoodies/13 - Grey/a.jpg", 1000)],
		targets: [file("hoodies/13 - Grey/a.jpg", 2000)],
		force: true,
	});
	assert.equal(plan.write.length, 1);
	assert.deepEqual(plan.unchanged, []);
});

test("web copies whose original is gone are removed, e.g. after renumbering a folder", () => {
	const plan = planSync({
		sources: [file("hoodies/14 - Grey/a.jpg")],
		targets: [file("hoodies/13 - Grey/a.jpg", 2000)],
	});
	assert.deepEqual(plan.remove, ["hoodies/13 - Grey/a.jpg"]);
	assert.deepEqual(plan.write, [{ source: "hoodies/14 - Grey/a.jpg", target: "hoodies/14 - Grey/a.jpg" }]);
});

test("a top-level folder with no originals is never pruned", () => {
	// photos/other is missing or empty: its web copies must survive, so a
	// half-restored photos/ folder can't wipe the committed copies.
	const plan = planSync({
		sources: [file("hoodies/13 - Grey/a.jpg")],
		targets: [file("hoodies/13 - Grey/a.jpg", 2000), file("other/Behind the scenes/b.jpg", 2000)],
	});
	assert.deepEqual(plan.remove, []);
	assert.deepEqual(plan.skippedRoots, ["other"]);
});

test("non-photo files are ignored on both sides", () => {
	const plan = planSync({
		sources: [file("hoodies/13 - Grey/a.jpg"), file("hoodies/13 - Grey/Thumbs.db"), file("hoodies/13 - Grey/a.xmp")],
		targets: [file("hoodies/13 - Grey/a.jpg", 2000), file("hoodies/13 - Grey/desktop.ini", 2000)],
	});
	assert.deepEqual(plan.write, []);
	assert.deepEqual(plan.remove, []);
});

test("folders starting with an underscore are never exported", () => {
	const plan = planSync({
		sources: [file("_excluded/23 - Black/_DSC9761.jpg"), file("hoodies/_drafts/a.jpg")],
		targets: [],
	});
	assert.deepEqual(plan.write, []);
});

test("file names starting with an underscore are exported as usual", () => {
	const plan = planSync({ sources: [file("hoodies/23 - Black/_DSC9737.jpg")], targets: [] });
	assert.deepEqual(plan.write, [{ source: "hoodies/23 - Black/_DSC9737.jpg", target: "hoodies/23 - Black/_DSC9737.jpg" }]);
});

test("loose files directly inside photos/ are ignored", () => {
	const plan = planSync({ sources: [file("notes.jpg")], targets: [] });
	assert.deepEqual(plan.write, []);
});

test("two originals that would share one web copy are reported, not guessed", () => {
	const plan = planSync({
		sources: [file("hoodies/13 - Grey/a.jpg"), file("hoodies/13 - Grey/a.png")],
		targets: [],
	});
	assert.deepEqual(plan.conflicts, [["hoodies/13 - Grey/a.jpg", "hoodies/13 - Grey/a.png"]]);
});
