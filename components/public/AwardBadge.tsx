"use client";

import Image from "next/image";
import { Award, Star, Trophy, Medal, Gem } from "lucide-react";
import type { ProductAwardRecord, AwardStyleSettings, AwardTier, AwardShape } from "@/lib/types/award";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  Award,
  Star,
  Trophy,
  Medal,
  Gem,
};

function getLucideIcon(iconName: string): React.ComponentType<{ className?: string; size?: number }> {
  const key = (iconName?.trim() || "Award").replace(/-/g, "");
  const Pascal = key.charAt(0).toUpperCase() + key.slice(1);
  return ICON_MAP[Pascal] ?? Award;
}

/** Resolve shape from style (shape or legacy is_hexagon). */
function getShape(style: AwardStyleSettings | undefined): AwardShape {
  const s = style?.shape ?? (style?.is_hexagon ? "hexagon" : "circle");
  return s === "hexagon" || s === "square" || s === "diamond" ? s : "circle";
}

/** Use bezel_color/shield_color when isCustom. */
function useCustomColors(tier: AwardTier, style: AwardStyleSettings | undefined): boolean {
  return tier === "FLAT" || Boolean(style?.isCustom);
}

/** Bezel (outer frame): theme gradient or user bezel_color when isCustom. */
function getBezelBackground(tier: AwardTier, style: AwardStyleSettings | undefined): string {
  if (useCustomColors(tier, style))
    return style?.bezel_color ?? style?.bg_color ?? "rgba(234,179,8,0.2)";
  switch (tier) {
    case "GOLD":
      return "linear-gradient(135deg, #BF953F 0%, #FCF6BA 25%, #B38728 50%, #FBF5B7 75%, #AA771C 100%)";
    case "SILVER":
      return "linear-gradient(135deg, #e2e8f0 0%, #bdc3c7 40%, #94a3b8 70%, #2c3e50 100%)";
    case "BRONZE":
      return "linear-gradient(135deg, #d4a574 0%, #cd7f32 40%, #8b5a2b 70%, #5d4037 100%)";
    default:
      return style?.bezel_color ?? style?.bg_color ?? "rgba(234,179,8,0.2)";
  }
}

/** Shield (inner): user shield_color when isCustom, else 65% darker (dark overlay). */
function getShieldBackground(tier: AwardTier, style: AwardStyleSettings | undefined): string {
  if (useCustomColors(tier, style))
    return style?.shield_color ?? "rgba(0,0,0,0.65)";
  return DARK_OVERLAY;
}

/** Text color on dark center: white or high-brightness gold for contrast; otherwise user text_color. */
function getInnerTextColor(
  tier: AwardTier,
  style: AwardStyleSettings | undefined,
  hasDarkCenter: boolean
): string {
  const userColor = style?.text_color ?? "#eab308";
  if (!hasDarkCenter) return userColor;
  return tier === "GOLD" ? "#fef08a" : "rgba(255,255,255,0.95)";
}

/** Clip-path and border-radius by shape. Square uses no clip. */
function getShapeClipPath(shape: AwardShape): string | undefined {
  if (shape === "hexagon") return HEXAGON_CLIP;
  if (shape === "diamond") return DIAMOND_CLIP;
  return undefined;
}
function getShapeBorderRadius(shape: AwardShape): string | number {
  if (shape === "hexagon" || shape === "diamond") return 0;
  if (shape === "square") return 0;
  return "9999px";
}

/** Label font size and wrap: auto by length, or manual scale 1–10. */
function getLabelFontSize(
  name: string,
  labelFontSize: number | undefined,
  context: "badge" | "preview"
): { fontSize: string; whiteSpace: "normal" | "nowrap" } {
  const len = name.length;
  const isAuto = labelFontSize === undefined || labelFontSize === 0;
  if (!isAuto && typeof labelFontSize === "number") {
    const scale = Math.min(10, Math.max(1, labelFontSize));
    const rem = context === "badge" ? 0.5 + (scale / 10) * 1 : 0.75 + (scale / 10) * 2;
    return { fontSize: `${rem}rem`, whiteSpace: len > 8 ? "normal" : "nowrap" };
  }
  if (len <= 4) {
    const size = context === "badge" ? "1rem" : "1.75rem";
    return { fontSize: size, whiteSpace: "nowrap" };
  }
  if (len > 8) {
    const size = context === "badge" ? "0.6rem" : "1rem";
    return { fontSize: size, whiteSpace: "normal" };
  }
  const size = context === "badge" ? "0.7rem" : "1.25rem";
  return { fontSize: size, whiteSpace: "nowrap" };
}

/** Lighter metal edge for inner bevel (frame meets center). */
function getInnerBevelColor(tier: AwardTier, _style: AwardStyleSettings | undefined): string {
  switch (tier) {
    case "GOLD": return "rgba(255,235,180,0.55)";
    case "SILVER": return "rgba(255,255,255,0.4)";
    case "BRONZE": return "rgba(210,180,140,0.5)";
    default: return "rgba(255,255,255,0.3)";
  }
}

/** Depth scale by tier: GOLD thickest (1), SILVER 0.7, BRONZE 0.4, FLAT 0. */
function getDepthScale(tier: AwardTier): number {
  switch (tier) {
    case "GOLD": return 1;
    case "SILVER": return 0.7;
    case "BRONZE": return 0.4;
    default: return 0;
  }
}

/** Outer 3D: 8–10 layers, 1px shift each, darker as it goes deeper. Uses outer_depth. */
function buildHardEdgeFilter(outerDepth: number, scale: number): string {
  if (scale <= 0) return "none";
  const layers = Math.min(10, Math.max(8, Math.round(outerDepth * scale)));
  const shadows: string[] = [];
  for (let i = 1; i <= layers; i++) {
    const alpha = 0.18 + (i - 1) * 0.04;
    shadows.push(`drop-shadow(0 ${i}px 0 rgba(0,0,0,${Math.min(0.55, alpha)}))`);
  }
  return shadows.join(" ");
}

/** Inner recession: multi-layer inset box-shadow; darker and more spread as value (0–10) increases. */
function buildInnerDepthShadow(innerDepth: number): string {
  if (innerDepth <= 0) return "";
  const layers = Math.min(6, Math.max(2, Math.ceil(innerDepth * 0.6)));
  const shadows: string[] = [];
  for (let i = 1; i <= layers; i++) {
    const spread = 2 + i * 2;
    const blur = 4 + i * 3;
    const alpha = 0.4 + (i / layers) * 0.4;
    shadows.push(`inset 0 ${spread}px ${blur}px rgba(0,0,0,${Math.min(0.9, alpha)})`);
  }
  return shadows.join(", ");
}

const HEXAGON_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
const DIAMOND_CLIP = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
const GOLD_OUTER_BORDER = "rgba(255,248,220,0.95)";
const INSET_BEVEL = "inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)";
const DARK_OVERLAY = "rgba(0,0,0,0.65)"; // 65% darker than bezel in theme mode
const INNER_CLIFF_SHADOW = "inset 0 6px 10px rgba(0,0,0,0.8), inset 0 2px 4px rgba(0,0,0,0.9)";
const SHIMMER_GRADIENT = "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%)";
const ENGRAVE_SHADOW = "0 1px 1px rgba(255,255,255,0.1), 0 -1px 0 rgba(0,0,0,0.9)";
const LOGO_DROP_SHADOW = "drop-shadow(0 2px 4px rgba(0,0,0,0.5))";

type AwardBadgeProps = {
  award: ProductAwardRecord;
  className?: string;
};

/**
 * Medallion: deep recessed center (dark overlay + inner bevel), thick bezel,
 * aggressive 3D extrusion, engraved label. FLAT / isCustom use DB bg_color and text_color.
 */
export function AwardBadge({ award, className = "" }: AwardBadgeProps) {
  const style = award.style_settings as AwardStyleSettings | undefined;
  const tier: AwardTier =
    award.tier === "GOLD" || award.tier === "SILVER" || award.tier === "BRONZE" ? award.tier : "FLAT";
  const shape = getShape(style);
  const clipPath = getShapeClipPath(shape);
  const borderRadius = getShapeBorderRadius(shape);
  const bezelBackground = getBezelBackground(tier, style);
  const shieldBackground = getShieldBackground(tier, style);
  const borderStyle = style?.border_style ?? "solid";
  const outerDepth =
    typeof style?.outer_depth === "number"
      ? style.outer_depth
      : typeof style?.depth === "number"
        ? style.depth
        : 8;
  const innerDepth = typeof style?.inner_depth === "number" ? style.inner_depth : 6;
  const depthScale = getDepthScale(tier);
  const useEffects = tier !== "FLAT" || Boolean(style?.isCustom);
  const hasDarkCenter = useEffects;
  const innerDepthShadow = buildInnerDepthShadow(innerDepth);
  const innerShieldShadow =
    hasDarkCenter && innerDepthShadow
      ? `${INNER_CLIFF_SHADOW}, ${innerDepthShadow}`
      : hasDarkCenter
        ? INNER_CLIFF_SHADOW
        : undefined;
  const filter = tier === "FLAT" && !style?.isCustom ? "none" : buildHardEdgeFilter(outerDepth, depthScale);
  const innerTextColor = getInnerTextColor(tier, style, hasDarkCenter);
  const innerBevelColor = getInnerBevelColor(tier, style);
  const outerBorderColor = tier === "GOLD" && !useCustomColors(tier, style) ? GOLD_OUTER_BORDER : innerBevelColor;
  const logoUrl = award.logo_url?.trim() || null;
  const IconComponent = getLucideIcon(award.icon ?? "Award");
  const isAngular = shape === "hexagon" || shape === "diamond" || shape === "square";
  const labelSize = getLabelFontSize(award.name ?? "—", style?.label_font_size, "badge");
  const logoScale =
    typeof style?.logo_scale === "number"
      ? Math.min(1.5, Math.max(0.5, style.logo_scale))
      : 1;
  const logoYOffset =
    typeof style?.logo_y_offset === "number"
      ? Math.min(50, Math.max(-20, style.logo_y_offset))
      : 0;
  const labelYOffset =
    typeof style?.label_y_offset === "number"
      ? Math.min(30, Math.max(-30, style.label_y_offset))
      : 0;

  return (
    <span className={`inline-flex shrink-0 ${className}`} title={award.name}>
      <div style={{ filter }}>
        <div
          className="relative flex h-14 w-12 overflow-hidden sm:h-16 sm:w-14"
          style={{
            background: bezelBackground,
            borderWidth: 1,
            borderStyle: borderStyle as React.CSSProperties["borderStyle"],
            borderColor: outerBorderColor,
            ...(useEffects
              ? {
                  borderBottomColor: "rgba(255,255,255,0.2)",
                  borderRightColor: "rgba(255,255,255,0.1)",
                }
              : {}),
            clipPath,
            borderRadius,
            boxShadow: useEffects ? INSET_BEVEL : undefined,
          }}
        >
          {useEffects && (
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden
              style={{
                background: SHIMMER_GRADIENT,
                clipPath: clipPath ?? "border-box",
                borderRadius,
              }}
            />
          )}
          {/* Inner shield: top-seal layout — logo top 20%, label middle (safe zone), justify-center for balance */}
          <div
            className="absolute inset-4 flex flex-col justify-center pt-6 sm:inset-5 sm:pt-8"
            style={{
              background: hasDarkCenter ? shieldBackground : "transparent",
              borderWidth: hasDarkCenter ? 1 : 0,
              borderStyle: "solid",
              borderColor: hasDarkCenter ? innerBevelColor : "transparent",
              boxShadow: innerShieldShadow,
              clipPath: clipPath ?? "border-box",
              borderRadius: isAngular ? 0 : "9999px",
            }}
          >
            {/* Logo area: top 20% like official stamp, with top spacing */}
            <div className="flex min-h-0 flex-[0_0_20%] items-center justify-center">
              <div
                className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden sm:h-6 sm:w-6"
                style={{
                  clipPath: clipPath ?? "circle(50%)",
                  borderRadius: isAngular ? 0 : "50%",
                  filter: logoUrl ? LOGO_DROP_SHADOW : undefined,
                  transform: `translateY(${logoYOffset}px) scale(${logoScale})`,
                }}
              >
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt=""
                    fill
                    className="object-contain"
                    sizes="24px"
                  />
                ) : (
                  <IconComponent
                    className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
                    style={{ color: hasDarkCenter ? innerTextColor : (style?.text_color ?? "#eab308") }}
                  />
                )}
              </div>
            </div>
            {/* Label area: primary middle, safe zone (overflow hidden), translateY for offset */}
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-0.5 py-0">
              <span
                className="max-w-full text-center font-bold uppercase leading-tight"
                style={{
                  color: hasDarkCenter ? innerTextColor : (style?.text_color ?? "#eab308"),
                  fontFamily: '"Inter Tight", "ui-sans-serif", system-ui, sans-serif',
                  letterSpacing: "0.02em",
                  fontSize: labelSize.fontSize,
                  whiteSpace: labelSize.whiteSpace,
                  textShadow: hasDarkCenter ? ENGRAVE_SHADOW : undefined,
                  transform: `translateY(${labelYOffset}px)`,
                }}
              >
                {award.name || "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </span>
  );
}
