"use client";

import type { AwardStyleSettings, AwardTier } from "@/lib/types/award";
import type { ProductAwardRecord } from "@/lib/types/award";
import { AwardBadge } from "@/components/public/AwardBadge";

const NATIVE_BADGE_SIZE_PX = 240;

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
  const isLarge = previewSize === "large";
  const scale = isLarge ? 1.5 : 0.25;
  const containerSizePx = NATIVE_BADGE_SIZE_PX * scale;

  const awardRecord: ProductAwardRecord = {
    id: "preview",
    name: name || "Award",
    slug: slug || "preview",
    tier,
    icon: icon ?? "Award",
    logo_url: logo_url ?? null,
    style_settings,
    created_at: "",
    updated_at: "",
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: containerSizePx,
          height: containerSizePx,
          background:
            previewBackground === "dark"
              ? "rgba(0,0,0,0.3)"
              : previewBackground === "light"
                ? "rgba(255,255,255,0.5)"
                : "transparent",
          borderRadius: 8,
        }}
      >
        <AwardBadge award={awardRecord} scale={scale} />
      </div>
    </div>
  );
}
