/** Single sponsor/partner logo and optional link + label. */
export type SponsorItem = {
  id: string;
  imageUrl: string;
  linkUrl?: string;
  altText?: string;
  partnerLabel?: string;
};

/** Sponsor block configuration (title, layout, list of items). */
export type SponsorBlockData = {
  title?: string;
  titleTag: "h2" | "h3" | "h4" | "p";
  titleColor: "default" | "primary" | "muted" | "gold" | "red";
  items: SponsorItem[];
  columns: "1" | "2" | "3" | "4" | "5" | "6";
  size: "sm" | "md" | "lg" | "xl";
  alignment: "left" | "center" | "right";
  grayscale: boolean;
};

export const DEFAULT_SPONSOR_BLOCK_DATA: SponsorBlockData = {
  title: "",
  titleTag: "h3",
  titleColor: "default",
  items: [],
  columns: "3",
  size: "md",
  alignment: "center",
  grayscale: false,
};

/** Image gallery block (Grid, Masonry, Slideshow). */
export type ImageGalleryLayout = "grid" | "masonry" | "slideshow";

export type ImageGalleryItem = {
  id: string;
  url: string;
  alt?: string;
};

export type ImageGalleryData = {
  layout: ImageGalleryLayout;
  images: ImageGalleryItem[];
};

/** Image comparison block (Before/After slider). */
export type ImageComparisonData = {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
};

/** Pull quote block: quote text + attribution, with alignment. */
export type PullQuoteAlignment = "left" | "right" | "full";

export type PullQuoteData = {
  quoteText: string;
  attribution: string;
  alignment: PullQuoteAlignment;
};

export const DEFAULT_PULL_QUOTE_DATA: PullQuoteData = {
  quoteText: "",
  attribution: "",
  alignment: "full",
};

/** Key Takeaways (TL;DR) block: fixed header + bullet list. */
export type KeyTakeawaysData = {
  items: string[];
};

export const DEFAULT_KEY_TAKEAWAYS_DATA: KeyTakeawaysData = {
  items: [""],
};
