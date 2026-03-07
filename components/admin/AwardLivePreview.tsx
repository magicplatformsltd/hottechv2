"use client";

import Image from "next/image";
import { Award, Star, Trophy, Medal, Gem } from "lucide-react";
import type { AwardStyleSettings, AwardTier, AwardShape } from "@/lib/types/award";

type AwardLivePreviewProps = {
  name: string;
  slug: string;
  tier: AwardTier;
  icon: string;
  logo_url?: string | null;
  style_settings: AwardStyleSettings;
  previewSize?: "normal" | "large";
  previewBackground?: "dark" | "light" | "transparent";
};

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

function getShape(style: AwardStyleSettings | undefined): AwardShape {
  const s = style?.shape ?? (style?.is_hexagon ? "hexagon" : "circle");
  return s === "hexagon" || s === "square" || s === "diamond" ? s : "circle";
}

function useCustomColors(tier: AwardTier, style: AwardStyleSettings | undefined): boolean {
  return tier === "FLAT" || Boolean(style?.isCustom);
}

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

const DARK_OVERLAY = "rgba(0,0,0,0.65)";
function getShieldBackground(tier: AwardTier, style: AwardStyleSettings | undefined): string {
  if (useCustomColors(tier, style))
    return style?.shield_color ?? DARK_OVERLAY;
  return DARK_OVERLAY;
}

function getShapeClipPath(shape: AwardShape): string | undefined {
  if (shape === "hexagon") return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
  if (shape === "diamond") return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
  return undefined;
}
function getShapeBorderRadius(shape: AwardShape): string | number {
  if (shape === "hexagon" || shape === "diamond" || shape === "square") return 0;
  return "9999px";
}

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

function getInnerBevelColor(tier: AwardTier): string {
  switch (tier) {
    case "GOLD": return "rgba(255,235,180,0.55)";
    case "SILVER": return "rgba(255,255,255,0.4)";
    case "BRONZE": return "rgba(210,180,140,0.5)";
    default: return "rgba(255,255,255,0.3)";
  }
}

function getDepthScale(tier: AwardTier): number {
  switch (tier) {
    case "GOLD": return 1;
    case "SILVER": return 0.7;
    case "BRONZE": return 0.4;
    default: return 0;
  }
}

/** Outer 3D: uses outer_depth. */
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

const GOLD_OUTER_BORDER = "rgba(255,248,220,0.95)";
const INSET_BEVEL = "inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)";
const INNER_CLIFF_SHADOW = "inset 0 6px 10px rgba(0,0,0,0.8), inset 0 2px 4px rgba(0,0,0,0.9)";
const ENGRAVE_SHADOW = "0 1px 1px rgba(255,255,255,0.1), 0 -1px 0 rgba(0,0,0,0.9)";
const LOGO_DROP_SHADOW = "drop-shadow(0 2px 4px rgba(0,0,0,0.5))";
const SHIMMER_GRADIENT = "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%)";

export function AwardLivePreview({
  name,
  slug,
  tier,
  icon,
  logo_url,
  style_settings,
  previewSize = "normal",
  previewBackground = "dark",
}: AwardLivePreviewProps) {
  const shape = getShape(style_settings);
  const clipPath = getShapeClipPath(shape);
  const borderRadius = getShapeBorderRadius(shape);
  const bezelBackground = getBezelBackground(tier, style_settings);
  const shieldBackground = getShieldBackground(tier, style_settings);
  const borderStyle = style_settings?.border_style ?? "solid";
  const outerDepth =
    typeof style_settings?.outer_depth === "number"
      ? style_settings.outer_depth
      : typeof style_settings?.depth === "number"
        ? style_settings.depth
        : 8;
  const innerDepth =
    typeof style_settings?.inner_depth === "number" ? style_settings.inner_depth : 6;
  const depthScale = getDepthScale(tier);
  const useEffects = tier !== "FLAT" || Boolean(style_settings?.isCustom);
  const hasDarkCenter = useEffects;
  const innerTextColor = hasDarkCenter
    ? (tier === "GOLD" ? "#fef08a" : "rgba(255,255,255,0.95)")
    : (style_settings?.text_color ?? "#eab308");
  const innerBevelColor = getInnerBevelColor(tier);
  const outerBorderColor =
    tier === "GOLD" && !useCustomColors(tier, style_settings) ? GOLD_OUTER_BORDER : innerBevelColor;
  const filter =
    tier === "FLAT" && !style_settings?.isCustom ? "none" : buildHardEdgeFilter(outerDepth, depthScale);
  const innerDepthShadow = buildInnerDepthShadow(innerDepth);
  const innerShieldShadow =
    hasDarkCenter && innerDepthShadow
      ? `${INNER_CLIFF_SHADOW}, ${innerDepthShadow}`
      : hasDarkCenter
        ? INNER_CLIFF_SHADOW
        : undefined;
  const IconComponent = getLucideIcon(icon ?? "Award");
  const isAngular = shape === "hexagon" || shape === "diamond" || shape === "square";
  const iconColor = hasDarkCenter ? innerTextColor : (style_settings?.text_color ?? "#eab308");
  const labelSize = getLabelFontSize(name || "Award", style_settings?.label_font_size, "preview");
  const logoScale =
    typeof style_settings?.logo_scale === "number"
      ? Math.min(1.5, Math.max(0.5, style_settings.logo_scale))
      : 1;
  const logoYOffset =
    typeof style_settings?.logo_y_offset === "number"
      ? Math.min(50, Math.max(-20, style_settings.logo_y_offset))
      : 0;
  const labelYOffset =
    typeof style_settings?.label_y_offset === "number"
      ? Math.min(30, Math.max(-30, style_settings.label_y_offset))
      : 0;

  const isLarge = previewSize === "large";
  const width = isLarge ? 280 : 48;
  const height = isLarge ? 320 : 56;
  const iconSize = isLarge ? 80 : 20;
  const innerInset = isLarge ? 28 : 12;
  const shieldPaddingTop = isLarge ? 24 : 10;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="shrink-0" style={{ filter }}>
        <div
          className="relative flex overflow-hidden"
          style={{
            width,
            height,
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
          <div
            className="absolute flex flex-col justify-center"
            style={{
              inset: innerInset,
              paddingTop: shieldPaddingTop,
              background: hasDarkCenter ? shieldBackground : "transparent",
              borderWidth: hasDarkCenter ? 1 : 0,
              borderStyle: "solid",
              borderColor: hasDarkCenter ? innerBevelColor : "transparent",
              boxShadow: innerShieldShadow,
              clipPath: clipPath ?? "border-box",
              borderRadius: isAngular ? 0 : "9999px",
            }}
          >
            <div className="flex min-h-0 flex-[0_0_20%] items-center justify-center">
              <div
                className="relative flex flex-shrink-0 items-center justify-center overflow-hidden"
                style={{
                  width: iconSize,
                  height: iconSize,
                  clipPath: clipPath ?? "circle(50%)",
                  borderRadius: isAngular ? 0 : "50%",
                  filter: logo_url ? LOGO_DROP_SHADOW : undefined,
                  transform: `translateY(${logoYOffset}px) scale(${logoScale})`,
                }}
              >
                {logo_url ? (
                  <Image src={logo_url} alt="" fill className="object-contain" sizes="96px" />
                ) : (
                  <IconComponent
                    className="shrink-0"
                    style={{ width: iconSize * 0.7, height: iconSize * 0.7, color: iconColor }}
                  />
                )}
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-1 py-0">
              <span
                className="max-w-full text-center font-bold uppercase leading-tight"
                style={{
                  color: hasDarkCenter ? innerTextColor : (style_settings?.text_color ?? "#eab308"),
                  fontFamily: '"Inter Tight", "ui-sans-serif", system-ui, sans-serif',
                  letterSpacing: "0.04em",
                  fontSize: labelSize.fontSize,
                  whiteSpace: labelSize.whiteSpace,
                  textShadow: hasDarkCenter ? ENGRAVE_SHADOW : undefined,
                  transform: `translateY(${labelYOffset}px)`,
                }}
              >
                {name || "Award"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
