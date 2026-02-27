"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { MediaPicker } from "@/app/components/admin/MediaPicker";
import { SeoSettings } from "@/app/components/admin/settings/SeoSettings";

type CtaSettings = {
  type: string;
  label: string;
  url: string;
};

type SiteSettingsRow = {
  id: number;
  site_name: string;
  site_description: string | null;
  logo_url: string | null;
  headshot_url: string | null;
  show_logo: boolean;
  navigation_menu: unknown;
  cta_settings: CtaSettings;
  social_links: unknown;
  timezone: string | null;
  updated_at: string;
};

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern (America/New_York)" },
  { value: "America/Chicago", label: "Central (America/Chicago)" },
  { value: "America/Denver", label: "Mountain (America/Denver)" },
  { value: "America/Los_Angeles", label: "Pacific (America/Los_Angeles)" },
  { value: "Europe/London", label: "London (Europe/London)" },
  { value: "UTC", label: "UTC" },
] as const;

const DEFAULT_CTA: CtaSettings = {
  type: "subscribe",
  label: "Subscribe",
  url: "",
};

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [headshotPickerOpen, setHeadshotPickerOpen] = useState(false);

  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [showLogo, setShowLogo] = useState(false);
  const [ctaType, setCtaType] = useState("subscribe");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");

  const supabase = getSupabase();

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!error && data) {
      const row = data as SiteSettingsRow;
      setSiteName(row.site_name ?? "");
      setSiteDescription(row.site_description ?? "");
      setLogoUrl(row.logo_url ?? null);
      setHeadshotUrl(row.headshot_url ?? null);
      setShowLogo(row.show_logo ?? false);
      const cta = (row.cta_settings as CtaSettings) ?? DEFAULT_CTA;
      setCtaType(cta.type ?? "subscribe");
      setCtaLabel(cta.label ?? "Subscribe");
      setCtaUrl(cta.url ?? "");
      setTimezone(row.timezone?.trim() || "America/New_York");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (!savedMessage) return;
    const t = setTimeout(() => setSavedMessage(null), 3000);
    return () => clearTimeout(t);
  }, [savedMessage]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        site_name: siteName || "Hot Tech",
        site_description: siteDescription || null,
        logo_url: logoUrl || null,
        headshot_url: headshotUrl || null,
        show_logo: showLogo,
        cta_settings: {
          type: ctaType,
          label: ctaLabel || "Subscribe",
          url: ctaType === "custom" ? ctaUrl : "",
        },
        timezone: timezone || "America/New_York",
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      setSavedMessage("Error saving. Check console.");
      console.error(error);
    } else {
      setSavedMessage("Settings saved.");
    }
  }, [
    supabase,
    siteName,
    siteDescription,
    logoUrl,
    headshotUrl,
    showLogo,
    ctaType,
    ctaLabel,
    ctaUrl,
    timezone,
  ]);

  if (loading) {
    return (
      <div className="flex-1 h-[calc(100vh-100px)] overflow-y-auto pb-24 px-6">
        <div className="space-y-6 py-6 lg:py-10">
          <h1 className="font-serif text-2xl font-bold text-hot-white">
            Global Settings
          </h1>
          <p className="font-sans text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-[calc(100vh-100px)] overflow-y-auto pb-24 px-6">
      <div className="space-y-8 py-6 lg:py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-hot-white">
          Global Settings
        </h1>
        {savedMessage && (
          <p
            className={
              savedMessage.startsWith("Error")
                ? "font-sans text-sm text-red-400"
                : "font-sans text-sm text-green-400"
            }
          >
            {savedMessage}
          </p>
        )}
      </div>

      {/* Section 1: Identity */}
      <section className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-6">
        <h2 className="font-sans text-lg font-semibold text-hot-white">
          Identity
        </h2>
        <div>
          <label className="mb-1 block font-sans text-sm text-gray-400">
            Site Name
          </label>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            className="w-full max-w-md rounded-md border border-white/20 bg-black px-3 py-2 font-sans text-hot-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
            placeholder="Hot Tech"
          />
        </div>
        <div>
          <label className="mb-1 block font-sans text-sm text-gray-400">
            Site Description
          </label>
          <textarea
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
            rows={3}
            className="w-full max-w-md rounded-md border border-white/20 bg-black px-3 py-2 font-sans text-hot-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
            placeholder="Brief description of your site"
          />
        </div>
        <div>
          <label className="mb-1 block font-sans text-sm text-gray-400">
            Site Logo
          </label>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-black">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Site logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="font-sans text-xs text-gray-500">
                  No logo
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLogoPickerOpen(true)}
              className="rounded-md border border-white/20 px-3 py-2 font-sans text-sm text-hot-white transition hover:bg-white/10"
            >
              Select Image
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block font-sans text-sm text-gray-400">
            Author Headshot
          </label>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-black">
              {headshotUrl ? (
                <img
                  src={headshotUrl}
                  alt="Author headshot"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-sans text-xs text-gray-500">
                  No image
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setHeadshotPickerOpen(true)}
              className="rounded-md border border-white/20 px-3 py-2 font-sans text-sm text-hot-white transition hover:bg-white/10"
            >
              Select Image
            </button>
          </div>
        </div>
      </section>

      {/* Section 2: Navigation & Actions */}
      <section className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-6">
        <h2 className="font-sans text-lg font-semibold text-hot-white">
          Navigation & Actions
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="show-logo"
            checked={showLogo}
            onChange={(e) => setShowLogo(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-black text-hot-white focus:ring-0"
          />
          <label htmlFor="show-logo" className="font-sans text-sm text-gray-300">
            Show Logo in Header
          </label>
        </div>
        <div>
          <label className="mb-2 block font-sans text-sm text-gray-400">
            CTA Button
          </label>
          <div className="flex flex-col gap-2">
            {[
              { value: "subscribe", label: "Subscribe Modal" },
              { value: "contact", label: "Contact Modal" },
              { value: "custom", label: "Custom Link" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cta-type"
                  checked={ctaType === opt.value}
                  onChange={() => setCtaType(opt.value)}
                  className="border-white/20 bg-black text-hot-white focus:ring-0"
                />
                <span className="font-sans text-sm text-gray-300">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block font-sans text-sm text-gray-400">
            Button Label
          </label>
          <input
            type="text"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className="w-full max-w-md rounded-md border border-white/20 bg-black px-3 py-2 font-sans text-hot-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
            placeholder="Subscribe"
          />
        </div>
        {ctaType === "custom" && (
          <div>
            <label className="mb-1 block font-sans text-sm text-gray-400">
              Custom URL
            </label>
            <input
              type="url"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              className="w-full max-w-md rounded-md border border-white/20 bg-black px-3 py-2 font-sans text-hot-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
              placeholder="https://..."
            />
          </div>
        )}
      </section>

      {/* Section 3: Localization */}
      <section className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-6">
        <h2 className="font-sans text-lg font-semibold text-hot-white">
          Localization
        </h2>
        <div>
          <label className="mb-1 block font-sans text-sm text-gray-400">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full max-w-md rounded-md border border-white/20 bg-black px-3 py-2 font-sans text-hot-white focus:border-white/40 focus:outline-none"
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 font-sans text-xs text-gray-500">
            Used for publishing dates and schedule display across the CMS.
          </p>
        </div>
      </section>

      <SeoSettings />

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-hot-white px-4 py-2 font-sans text-sm font-medium text-hot-black transition-colors hover:bg-hot-white/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
      </div>

      {logoPickerOpen && (
        <MediaPicker
          onSelect={(url) => {
            setLogoUrl(url);
            setLogoPickerOpen(false);
          }}
          onCancel={() => setLogoPickerOpen(false)}
        />
      )}
      {headshotPickerOpen && (
        <MediaPicker
          onSelect={(url) => {
            setHeadshotUrl(url);
            setHeadshotPickerOpen(false);
          }}
          onCancel={() => setHeadshotPickerOpen(false)}
        />
      )}
    </div>
  );
}
