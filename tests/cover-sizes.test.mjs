import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./load-ts.mjs";

const { coverSizes } = await importTs("src/lib/cover-sizes.ts");

test("a photo no wider than its box asks for the box width", () => {
	// portrait 4:5 photo in a 4:5 card, and a narrower 2:3 one: both drawn box-wide
	assert.equal(coverSizes(0.8, [{ width: "360px", ratio: 0.8 }]), "360px");
	assert.equal(coverSizes(2 / 3, [{ width: "360px", ratio: 0.8 }]), "360px");
});

test("a photo wider than its box asks for as much wider as it's drawn", () => {
	// landscape 3:2 in a 4:5 card is drawn 1.875x the card's width
	assert.equal(coverSizes(1.5, [{ width: "360px", ratio: 0.8 }]), "675px");
	assert.equal(coverSizes(1.5, [{ width: "50vw", ratio: 0.8 }]), "93.8vw");
});

test("each screen size scales by its own box shape", () => {
	const tall = [
		{ media: "(max-width: 720px)", width: "100vw", ratio: 4 / 7 },
		{ media: "(max-width: 1100px)", width: "50vw", ratio: 0.36 },
		{ width: "33vw", ratio: 0.36 },
	];
	assert.equal(coverSizes(1.5, tall), "(max-width: 720px) 262.5vw, (max-width: 1100px) 208.3vw, 137.5vw");
	assert.equal(coverSizes(0.5, tall), "(max-width: 720px) 100vw, (max-width: 1100px) 69.4vw, 45.8vw");
});

test("calc() and other lengths it can't scale are left alone rather than guessed", () => {
	assert.equal(coverSizes(1.5, [{ width: "calc(100vw - 2rem)", ratio: 0.8 }]), "calc(100vw - 2rem)");
});
