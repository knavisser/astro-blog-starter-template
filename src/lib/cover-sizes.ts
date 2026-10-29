// `sizes` for photos cropped to fill a box (object-fit: cover).
//
// The browser picks which file to download from `sizes`, which says how wide
// the image is drawn. A cropped photo that's wider than its box (a landscape
// shot in a portrait card, say) is drawn as tall as the box and wider than it,
// so it needs a correspondingly wider file than the box alone would suggest.

export interface Box {
	/** media condition for this entry; leave it off the last one */
	media?: string;
	/** the box's width at that screen size, e.g. "50vw" or "360px" */
	width: string;
	/** the box's shape there, width / height */
	ratio: number;
}

/** `sizes` for a photo of shape `photo` (width / height) cropped into these boxes. */
export function coverSizes(photo: number, boxes: Box[]): string {
	return boxes
		.map(({ media, width, ratio }) => {
			const drawn = scale(width, Math.max(1, photo / ratio));
			return media ? `${media} ${drawn}` : drawn;
		})
		.join(", ");
}

// "50vw" x 1.875 = "93.8vw"; anything that isn't a plain number and unit stays as it is
function scale(length: string, by: number): string {
	const match = /^(\d+(?:\.\d+)?)([a-z]+)$/.exec(length.trim());
	if (!match || by === 1) return length;
	return `${Math.round(Number(match[1]) * by * 10) / 10}${match[2]}`;
}
