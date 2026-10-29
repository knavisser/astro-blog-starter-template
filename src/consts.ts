export const SITE_TITLE = "bad juju";
export const SITE_DESCRIPTION =
	"one of one hoodies. stitched to be summoned. made to order in the lowlands.";
export const ATELIER_COORDS = "LAT 51.9125°N · LON 4.4351°E";
export const ATELIER_LABEL = "SYS//ATELIER 2026";
export const CONTACT_EMAIL = "info@badjuju.net";
// SumUp Online Store, the shop is the single source of truth for sellable
// hoodies. Point this at the brand subdomain once SumUp's custom domain is
// connected; until then it can hold the raw SumUp store URL.
export const SHOP_URL = "https://shop.badjuju.net";
// Where visitors land when we link to the shop. The bare SHOP_URL origin is
// kept for server-side stock detection (sitemap crawl); every outbound link
// should use this so people land on the product grid, not the storefront home.
export const SHOP_PRODUCTS_URL = `${SHOP_URL}/products`;

// Pieces are identified by number only. Build the display label from a piece's
// index, e.g. objectLabel(1) === "OBJECT 001".
export const objectLabel = (index: number) =>
	`OBJECT ${String(index).padStart(3, "0")}`;

// The photos the home hero slides through, in order, as "<object number>/<file
// name>". The first one also fills the intro hand-off and is the default share
// image.
export const HERO_PHOTOS = ["19/_DSC9579.jpg", "15/_DSC7129.jpg", "18/_DSC9846.jpg"];
// Phones and tablets held upright (HERO_MOBILE_MEDIA) slide through these
// portrait shots instead. x is where a photo sits on a phone screen, as an
// object-position x in %: 50 (the default) is centred, 100 lines up its right
// edge. The two lists don't need to be the same length.
export const HERO_PHOTOS_MOBILE: { photo: string; x?: number }[] = [
	{ photo: "25/_DSC7033.jpg", x: 100 },
	{ photo: "17/BadJujuShoot-28.jpg", x: 35 },
	{ photo: "15/_DSC7143.jpg" },
];
export const HERO_MOBILE_MEDIA = "(max-width: 1024px) and (orientation: portrait)";
// The hero's shape on those screens (width / height). A phone screen is far
// narrower than a portrait photo, so the photo is cropped and drawn wider than
// the screen and needs a wider file; on a tablet only a little.
export const HERO_MOBILE_BOXES = [
	{ media: "(max-width: 720px)", width: "100vw", ratio: 0.46 },
	{ width: "100vw", ratio: 0.72 },
];

// Every photo is offered at these widths wherever it appears (only `sizes`
// differs per spot), so a cover seen in the home slider is the same cached
// file in the portfolio grid and on its hoodie page.
export const PHOTO_WIDTHS = [360, 640, 960, 1280, 1600, 2000, 2560];
