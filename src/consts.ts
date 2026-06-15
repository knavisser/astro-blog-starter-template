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

// Pieces are identified by number only. Build the display label from a piece's
// index, e.g. objectLabel(1) === "OBJECT 001".
export const objectLabel = (index: number) =>
	`OBJECT ${String(index).padStart(3, "0")}`;
