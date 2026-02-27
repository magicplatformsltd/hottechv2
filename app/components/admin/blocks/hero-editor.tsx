"use client";

import type { HomepageBlock } from "@/lib/types";
import type { HeroBlockData } from "@/lib/types";
import { UniversalImagePicker } from "@/app/components/admin/shared/UniversalImagePicker";

type HeroEditorProps = {
  block: HomepageBlock;
  onChange: (data: HeroBlockData) => void;
};

const emptyData: HeroBlockData = {
  title: "",
  subtitle: "",
  description: "",
  headshot_url: "",
  shape: "circle",
};

export function HeroEditor({ block, onChange }: HeroEditorProps) {
  const data = (block.data as HeroBlockData | undefined) ?? emptyData;

  function update<K extends keyof HeroBlockData>(key: K, value: HeroBlockData[K]) {
    onChange({ ...data, [key]: value });
  }

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-hot-gray/50 p-4">
      <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-gray-400">
        Hero Block
      </h3>
      <div className="grid gap-4 sm:grid-cols-1">
        <div>
          <label className="block font-sans text-sm font-medium text-gray-400">
            Title
          </label>
          <input
            type="text"
            value={data.title ?? ""}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Nirave Gondhia."
            className="mt-1 w-full rounded-md border border-white/10 bg-hot-gray px-3 py-2 font-sans text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none focus:ring-1 focus:ring-hot-white/20"
          />
        </div>
        <div>
          <label className="block font-sans text-sm font-medium text-gray-400">
            Subtitle
          </label>
          <input
            type="text"
            value={data.subtitle ?? ""}
            onChange={(e) => update("subtitle", e.target.value)}
            placeholder="e.g. Journalist, Host & Creator."
            className="mt-1 w-full rounded-md border border-white/10 bg-hot-gray px-3 py-2 font-sans text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none focus:ring-1 focus:ring-hot-white/20"
          />
        </div>
        <div>
          <label className="block font-sans text-sm font-medium text-gray-400">
            Description
          </label>
          <textarea
            value={data.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
            placeholder="e.g. Seen in: Forbes, TechRadar, Android Central"
            rows={3}
            className="mt-1 w-full rounded-md border border-white/10 bg-hot-gray px-3 py-2 font-sans text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none focus:ring-1 focus:ring-hot-white/20"
          />
        </div>
        <div>
          <UniversalImagePicker
            label="Headshot"
            value={data.headshot_url}
            onChange={(url) => update("headshot_url", url)}
          />
        </div>
        <div>
          <label className="block font-sans text-sm font-medium text-gray-400">
            Newsletter Description
          </label>
          <input
            type="text"
            value={data.newsletterDescription ?? ""}
            onChange={(e) => update("newsletterDescription", e.target.value)}
            placeholder="Brief message above the email field"
            className="mt-1 w-full rounded-md border border-white/10 bg-hot-gray px-3 py-2 font-sans text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none focus:ring-1 focus:ring-hot-white/20"
          />
        </div>
        <div>
          <label className="block font-sans text-sm font-medium text-gray-400">
            Button Text
          </label>
          <input
            type="text"
            value={data.newsletterButtonText ?? ""}
            onChange={(e) => update("newsletterButtonText", e.target.value)}
            placeholder="Join"
            className="mt-1 w-full rounded-md border border-white/10 bg-hot-gray px-3 py-2 font-sans text-hot-white placeholder-gray-500 focus:border-hot-white/30 focus:outline-none focus:ring-1 focus:ring-hot-white/20"
          />
        </div>
        <div>
          <label className="block font-sans text-sm font-medium text-gray-400">
            Shape
          </label>
          <div className="mt-2 flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`${block.id}-shape`}
                checked={(data.shape ?? "circle") === "circle"}
                onChange={() => update("shape", "circle")}
                className="rounded-full border-white/20 text-hot-white focus:ring-hot-white/20"
              />
              <span className="font-sans text-sm text-gray-300">Circle</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`${block.id}-shape`}
                checked={(data.shape ?? "circle") === "square"}
                onChange={() => update("shape", "square")}
                className="rounded-full border-white/20 text-hot-white focus:ring-hot-white/20"
              />
              <span className="font-sans text-sm text-gray-300">Square</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
