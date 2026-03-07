"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { upsertAward } from "@/lib/actions/award";
import type { ProductAwardRecord, AwardStyleSettings, AwardTier, AwardShape } from "@/lib/types/award";
import { AwardLivePreview } from "./AwardLivePreview";
import { UniversalImagePicker } from "@/app/components/admin/shared/UniversalImagePicker";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "award";
}

type AwardFormProps = {
  award: ProductAwardRecord | null;
};

const GOLD_GRADIENT =
  "linear-gradient(135deg, #BF953F 0%, #FCF6BA 25%, #B38728 50%, #FBF5B7 75%, #AA771C 100%)";
const SILVER_GRADIENT =
  "linear-gradient(135deg, #e2e8f0 0%, #bdc3c7 40%, #94a3b8 70%, #2c3e50 100%)";
const BRONZE_GRADIENT =
  "linear-gradient(135deg, #d4a574 0%, #cd7f32 40%, #8b5a2b 70%, #5d4037 100%)";

const DEFAULT_STYLE: AwardStyleSettings = {
  bg_color: "rgba(234,179,8,0.2)",
  text_color: "#eab308",
  border_style: "solid",
  is_hexagon: false,
  shape: "circle",
  bezel_color: "rgba(234,179,8,0.3)",
  shield_color: "rgba(0,0,0,0.65)",
  outer_depth: 8,
  inner_depth: 6,
  isCustom: false,
  label_font_size: 0,
  logo_scale: 1,
  logo_y_offset: 0,
  label_y_offset: 0,
};

/** Full theme defaults for Reset-to-Theme. */
const THEME_DEFAULTS: Record<
  AwardTier,
  Required<Pick<AwardStyleSettings, "bezel_color" | "shield_color" | "text_color" | "shape" | "outer_depth" | "inner_depth" | "border_style" | "label_font_size" | "logo_scale" | "logo_y_offset" | "label_y_offset">> & { is_hexagon: boolean }
> = {
  GOLD: {
    bezel_color: GOLD_GRADIENT,
    shield_color: "rgba(0,0,0,0.65)",
    text_color: "#1c1917",
    shape: "hexagon",
    is_hexagon: true,
    outer_depth: 8,
    inner_depth: 6,
    border_style: "solid",
    label_font_size: 0,
    logo_scale: 1,
    logo_y_offset: 0,
    label_y_offset: 0,
  },
  SILVER: {
    bezel_color: SILVER_GRADIENT,
    shield_color: "rgba(0,0,0,0.65)",
    text_color: "#334155",
    shape: "circle",
    is_hexagon: false,
    outer_depth: 5,
    inner_depth: 4,
    border_style: "solid",
    label_font_size: 0,
    logo_scale: 1,
    logo_y_offset: 0,
    label_y_offset: 0,
  },
  BRONZE: {
    bezel_color: BRONZE_GRADIENT,
    shield_color: "rgba(0,0,0,0.65)",
    text_color: "#292524",
    shape: "circle",
    is_hexagon: false,
    outer_depth: 4,
    inner_depth: 3,
    border_style: "solid",
    label_font_size: 0,
    logo_scale: 1,
    logo_y_offset: 0,
    label_y_offset: 0,
  },
  FLAT: {
    bezel_color: "#6b7280",
    shield_color: "#4b5563",
    text_color: "#eab308",
    shape: "circle",
    is_hexagon: false,
    outer_depth: 0,
    inner_depth: 0,
    border_style: "solid",
    label_font_size: 0,
    logo_scale: 1,
    logo_y_offset: 0,
    label_y_offset: 0,
  },
};

function getThemeDefault<K extends keyof typeof THEME_DEFAULTS.GOLD>(
  tier: AwardTier,
  key: K
): (typeof THEME_DEFAULTS.GOLD)[K] {
  return THEME_DEFAULTS[tier][key];
}

function isModified(
  tier: AwardTier,
  key: keyof typeof THEME_DEFAULTS.GOLD,
  current: AwardStyleSettings
): boolean {
  const def = getThemeDefault(tier, key);
  if (key === "shape") {
    const cur = current.shape ?? (current.is_hexagon ? "hexagon" : "circle");
    return cur !== def;
  }
  if (key === "is_hexagon") return (current.is_hexagon ?? false) !== def;
  if (key === "outer_depth") {
    const cur = typeof current.outer_depth === "number" ? current.outer_depth : (current as { depth?: number }).depth;
    const effective = typeof cur === "number" ? cur : def;
    return effective !== def;
  }
  if (key === "inner_depth") {
    const cur = current.inner_depth;
    const effective = typeof cur === "number" ? cur : def;
    return effective !== def;
  }
  if (key === "label_font_size") {
    const cur = current.label_font_size;
    const effective = typeof cur === "number" ? cur : 0;
    return effective !== def;
  }
  if (key === "logo_scale") {
    const cur = current.logo_scale;
    const effective = typeof cur === "number" ? cur : 1;
    return Math.abs(effective - (def as number)) > 0.01;
  }
  if (key === "logo_y_offset") {
    const cur = current.logo_y_offset;
    const effective = typeof cur === "number" ? cur : 0;
    return effective !== def;
  }
  if (key === "label_y_offset") {
    const cur = current.label_y_offset;
    const effective = typeof cur === "number" ? cur : 0;
    return effective !== def;
  }
  const cur = (current as Record<string, unknown>)[key];
  if (cur === undefined && (def === undefined || def === "")) return false;
  return String(cur) !== String(def);
}

const SHAPE_OPTIONS: { value: AwardShape; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "hexagon", label: "Hexagon (Trophy)" },
  { value: "square", label: "Square" },
  { value: "diamond", label: "Diamond" },
];

const ICON_OPTIONS = ["Award", "Star", "Trophy", "Medal", "Gem"];

export function AwardForm({ award }: AwardFormProps) {
  const router = useRouter();
  const isNew = !award;

  const [name, setName] = useState(award?.name ?? "");
  const [slug, setSlug] = useState(award?.slug ?? "");
  const [tier, setTier] = useState<AwardTier>(
    award?.tier === "GOLD" || award?.tier === "SILVER" || award?.tier === "BRONZE" ? award.tier : "FLAT"
  );
  const [icon, setIcon] = useState(award?.icon ?? "Award");
  const [logoUrl, setLogoUrl] = useState<string | null>(award?.logo_url ?? null);
  const [styleSettings, setStyleSettings] = useState<AwardStyleSettings>(() => {
    const base = award?.style_settings ? { ...DEFAULT_STYLE, ...award.style_settings } : { ...DEFAULT_STYLE };
    if (award?.style_settings) {
      if (typeof base.outer_depth !== "number" && typeof (award.style_settings as { depth?: number }).depth === "number")
        base.outer_depth = (award.style_settings as { depth?: number }).depth;
      if (typeof base.inner_depth !== "number") base.inner_depth = DEFAULT_STYLE.inner_depth ?? 6;
    }
    return base;
  });
  const [previewBg, setPreviewBg] = useState<"dark" | "light" | "transparent">("dark");
  const [colorsOpen, setColorsOpen] = useState(false);
  const [depthOpen, setDepthOpen] = useState(false);
  const [typographyOpen, setTypographyOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNew && name.trim()) {
      setSlug(slugify(name));
    }
  }, [isNew, name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const result = await upsertAward({
      ...(award?.id ? { id: award.id } : {}),
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      tier,
      icon: icon.trim() || "Award",
      logo_url: logoUrl?.trim() || null,
      style_settings: styleSettings,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/admin/products/awards");
  }

  const inputClass =
    "w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none focus:ring-1 focus:ring-hot-white/30";
  const labelClass = "block font-sans text-sm font-medium text-gray-400 mb-1";

  function resetToTheme(
    key: keyof typeof THEME_DEFAULTS.GOLD
  ) {
    const def = getThemeDefault(tier, key);
    setStyleSettings((s) => {
      const next = { ...s, [key]: def };
      if (key === "shape") {
        next.is_hexagon = def === "hexagon";
      }
      return next;
    });
  }

  const accordionBtnClass =
    "flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left font-sans text-sm text-gray-300 hover:bg-white/10";
  const resetBtnClass = (modified: boolean) =>
    `rounded p-1.5 transition-colors ${modified ? "text-amber-400 hover:text-amber-300" : "text-gray-500 hover:text-gray-400"}`;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="space-y-4">
            <h2 className="font-sans text-lg font-medium text-hot-white">Basic info</h2>
            <div>
              <label className={labelClass}>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Best Pick"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className={inputClass}
                placeholder="e.g. best-pick"
              />
              {isNew && (
                <p className="mt-1 text-xs text-gray-500">Auto-generated from name if blank.</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Award Theme</label>
              <select
                value={tier}
                onChange={(e) => {
                  const t = e.target.value as AwardTier;
                  setTier(t);
                  const defaults = THEME_DEFAULTS[t];
                  if (defaults) {
                    setStyleSettings((s) => ({ ...s, ...defaults }));
                  }
                }}
                className={inputClass}
              >
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
                <option value="BRONZE">Bronze</option>
                <option value="FLAT">Flat</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Theme sets smart defaults; customize below if needed.</p>
            </div>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <label className={labelClass}>Shape</label>
                <select
                  value={styleSettings.shape ?? (styleSettings.is_hexagon ? "hexagon" : "circle")}
                  onChange={(e) => {
                    const v = e.target.value as AwardShape;
                    setStyleSettings((s) => ({
                      ...s,
                      shape: v,
                      is_hexagon: v === "hexagon",
                    }));
                  }}
                  className={inputClass}
                >
                  {SHAPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Independent of theme; reset restores theme default.</p>
              </div>
              <button
                type="button"
                onClick={() => resetToTheme("shape")}
                className={resetBtnClass(isModified(tier, "shape", styleSettings))}
                title="Reset to theme default"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className={labelClass}>Icon (Lucide name)</label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className={inputClass}
              >
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Used when no logo is set.</p>
            </div>
            <UniversalImagePicker
              label="Logo (badge image)"
              value={logoUrl}
              onChange={(url) => setLogoUrl(url || null)}
            />
          </section>

          <section className="space-y-2">
            <button
              type="button"
              onClick={() => setColorsOpen((o) => !o)}
              className={accordionBtnClass}
            >
              <span className="font-medium">Customize Colors</span>
              <span className="text-gray-500">{colorsOpen ? "▼" : "▶"}</span>
            </button>
            {colorsOpen && (
              <div className="space-y-4 rounded-md border border-white/10 bg-white/5 p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={styleSettings.isCustom ?? false}
                    onChange={(e) =>
                      setStyleSettings((s) => ({ ...s, isCustom: e.target.checked }))
                    }
                    className="rounded border-white/20"
                  />
                  <span className="font-sans text-sm text-hot-white">Use custom colors (ignore theme)</span>
                </label>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={labelClass}>Bezel color (outer frame)</label>
                    <input
                      type="text"
                      value={styleSettings.bezel_color ?? ""}
                      onChange={(e) =>
                        setStyleSettings((s) => ({ ...s, bezel_color: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="e.g. rgba(234,179,8,0.3) or #d4a574"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => resetToTheme("bezel_color")}
                    className={resetBtnClass(isModified(tier, "bezel_color", styleSettings))}
                    title="Reset to theme default"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={labelClass}>Shield color (inner)</label>
                    <input
                      type="text"
                      value={styleSettings.shield_color ?? ""}
                      onChange={(e) =>
                        setStyleSettings((s) => ({ ...s, shield_color: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="e.g. rgba(0,0,0,0.65)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => resetToTheme("shield_color")}
                    className={resetBtnClass(isModified(tier, "shield_color", styleSettings))}
                    title="Reset to theme default"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={labelClass}>Text color</label>
                    <input
                      type="text"
                      value={styleSettings.text_color ?? ""}
                      onChange={(e) =>
                        setStyleSettings((s) => ({ ...s, text_color: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="e.g. #eab308"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => resetToTheme("text_color")}
                    className={resetBtnClass(isModified(tier, "text_color", styleSettings))}
                    title="Reset to theme default"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={labelClass}>Border style</label>
                    <select
                      value={styleSettings.border_style ?? "solid"}
                      onChange={(e) =>
                        setStyleSettings((s) => ({ ...s, border_style: e.target.value }))
                      }
                      className={inputClass}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => resetToTheme("border_style")}
                    className={resetBtnClass(
                      isModified(tier, "border_style", styleSettings)
                    )}
                    title="Reset to theme default"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setDepthOpen((o) => !o)}
              className={accordionBtnClass}
            >
              <span className="font-medium">Customize Depth</span>
              <span className="text-gray-500">{depthOpen ? "▼" : "▶"}</span>
            </button>
            {depthOpen && (
              <div className="space-y-4 rounded-md border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={labelClass}>Outer thickness (extrusion)</label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={
                        typeof styleSettings.outer_depth === "number"
                          ? styleSettings.outer_depth
                          : typeof styleSettings.depth === "number"
                            ? styleSettings.depth
                            : 8
                      }
                      onChange={(e) =>
                        setStyleSettings((s) => ({
                          ...s,
                          outer_depth: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-hot-white"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {typeof styleSettings.outer_depth === "number"
                        ? styleSettings.outer_depth
                        : typeof styleSettings.depth === "number"
                          ? styleSettings.depth
                          : 8}{" "}
                      — bezel extrusion
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resetToTheme("outer_depth")}
                    className={resetBtnClass(isModified(tier, "outer_depth", styleSettings))}
                    title="Reset to theme default"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={labelClass}>Inner recession (sink)</label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={
                        typeof styleSettings.inner_depth === "number"
                          ? styleSettings.inner_depth
                          : 6
                      }
                      onChange={(e) =>
                        setStyleSettings((s) => ({
                          ...s,
                          inner_depth: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-hot-white"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {typeof styleSettings.inner_depth === "number"
                        ? styleSettings.inner_depth
                        : 6}{" "}
                      — shield sink depth
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resetToTheme("inner_depth")}
                    className={resetBtnClass(isModified(tier, "inner_depth", styleSettings))}
                    title="Reset to theme default"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setTypographyOpen((o) => !o)}
              className={accordionBtnClass}
            >
              <span className="font-medium">Customize Logo & Text</span>
              <span className="text-gray-500">{typographyOpen ? "▼" : "▶"}</span>
            </button>
            {typographyOpen && (
              <div className="space-y-4 rounded-md border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={labelClass}>Logo scale</label>
                    <input
                      type="range"
                      min={0.5}
                      max={1.5}
                      step={0.1}
                      value={
                        typeof styleSettings.logo_scale === "number"
                          ? styleSettings.logo_scale
                          : 1
                      }
                      onChange={(e) =>
                        setStyleSettings((s) => ({
                          ...s,
                          logo_scale: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-hot-white"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {typeof styleSettings.logo_scale === "number"
                        ? styleSettings.logo_scale.toFixed(1)
                        : "1.0"}{" "}
                      — 1.0 = default size
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resetToTheme("logo_scale")}
                    className={resetBtnClass(
                      isModified(tier, "logo_scale", styleSettings)
                    )}
                    title="Reset to theme default (1.0)"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={labelClass}>Logo vertical position</label>
                    <input
                      type="range"
                      min={-20}
                      max={50}
                      step={1}
                      value={
                        typeof styleSettings.logo_y_offset === "number"
                          ? styleSettings.logo_y_offset
                          : 0
                      }
                      onChange={(e) =>
                        setStyleSettings((s) => ({
                          ...s,
                          logo_y_offset: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-hot-white"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {typeof styleSettings.logo_y_offset === "number"
                        ? styleSettings.logo_y_offset
                        : 0}{" "}
                      px — fine-tune vertical centering
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resetToTheme("logo_y_offset")}
                    className={resetBtnClass(
                      isModified(tier, "logo_y_offset", styleSettings)
                    )}
                    title="Reset to theme default (0)"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={labelClass}>Label font size</label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={
                        typeof styleSettings.label_font_size === "number"
                          ? styleSettings.label_font_size
                          : 0
                      }
                      onChange={(e) =>
                        setStyleSettings((s) => ({
                          ...s,
                          label_font_size: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-hot-white"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {typeof styleSettings.label_font_size === "number" &&
                      styleSettings.label_font_size > 0
                        ? styleSettings.label_font_size
                        : "Auto"}{" "}
                      — 0 = auto scale by length
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resetToTheme("label_font_size")}
                    className={resetBtnClass(
                      isModified(tier, "label_font_size", styleSettings)
                    )}
                    title="Reset to theme default (Auto)"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={labelClass}>Label vertical position</label>
                    <input
                      type="range"
                      min={-30}
                      max={30}
                      step={1}
                      value={
                        typeof styleSettings.label_y_offset === "number"
                          ? styleSettings.label_y_offset
                          : 0
                      }
                      onChange={(e) =>
                        setStyleSettings((s) => ({
                          ...s,
                          label_y_offset: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-hot-white"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {typeof styleSettings.label_y_offset === "number"
                        ? styleSettings.label_y_offset
                        : 0}{" "}
                      px — fine-tune label position
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resetToTheme("label_y_offset")}
                    className={resetBtnClass(
                      isModified(tier, "label_y_offset", styleSettings)
                    )}
                    title="Reset to theme default (0)"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-3 lg:pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Live Preview
            </p>
            <button
              type="button"
              onClick={() =>
                setPreviewBg((b) =>
                  b === "dark" ? "light" : b === "light" ? "transparent" : "dark"
                )
              }
              className="rounded border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-hot-white"
            >
              Toggle Background ({previewBg})
            </button>
          </div>
          <div className="flex min-h-[400px] w-full max-w-[340px] items-center justify-center self-center rounded-lg border border-white/10 p-8"
            style={{
              backgroundColor:
                previewBg === "dark"
                  ? "var(--bg-hot-gray, #1a1a1a)"
                  : previewBg === "light"
                    ? "#f5f5f5"
                    : "transparent",
            }}
          >
            <AwardLivePreview
              name={name || "Award"}
              slug={slug}
              tier={tier}
              icon={icon}
              logo_url={logoUrl}
              style_settings={styleSettings}
              previewSize="large"
              previewBackground={previewBg}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-black hover:bg-hot-white/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : award ? "Update Award" : "Create Award"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/products/awards")}
          className="rounded-md border border-white/20 px-4 py-2 font-sans text-sm text-gray-400 hover:bg-white/5 hover:text-hot-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
