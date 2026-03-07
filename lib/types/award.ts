/**
 * Types for the product_awards table (dynamic award badges).
 */

export type AwardTier = "GOLD" | "SILVER" | "BRONZE" | "FLAT";

/** Shape is independent of theme. */
export type AwardShape = "circle" | "hexagon" | "square" | "diamond";

export type AwardStyleSettings = {
  bg_color?: string;
  text_color?: string;
  border_style?: string;
  /** Use hexagonal (trophy) shape; legacy, prefer shape. */
  is_hexagon?: boolean;
  /** Shape: circle, hexagon, square, diamond. Saved independently of theme. */
  shape?: AwardShape;
  /** When isCustom: outer frame color. */
  bezel_color?: string;
  /** When isCustom: inner shield color. Theme mode uses 65% darker than bezel. */
  shield_color?: string;
  /** Outer 3D extrusion (0–10). Stacked drop-shadow layers. */
  outer_depth?: number;
  /** Inner recession / sink (0–10). Inset shadow depth into the shield. */
  inner_depth?: number;
  /** @deprecated Use outer_depth. Kept for migration. */
  depth?: number;
  /** When true, use bezel_color and shield_color (and text_color) from DB. */
  isCustom?: boolean;
  /** Label font size: 0 = auto (scale by length), 1–10 = manual scale. */
  label_font_size?: number;
  /** Logo scale factor (0.5–1.5). Default 1.0. */
  logo_scale?: number;
  /** Logo vertical offset in pixels (-20 to 50). Default 0. */
  logo_y_offset?: number;
  /** Label vertical offset in pixels (-30 to 30). Default 0. */
  label_y_offset?: number;
};

export type ProductAwardRecord = {
  id: string;
  name: string;
  slug: string;
  tier: AwardTier;
  icon: string;
  logo_url?: string | null;
  style_settings: AwardStyleSettings;
  created_at: string;
  updated_at: string;
};
