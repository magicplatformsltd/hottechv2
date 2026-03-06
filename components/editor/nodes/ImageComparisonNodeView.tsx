"use client";

import { useState, useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { Pencil, ImagePlus } from "lucide-react";
import { MediaPickerModal } from "@/app/components/admin/media/MediaPickerModal";
import type { ImageComparisonData } from "@/components/admin/editor/extensions/ImageComparison";

function parseData(raw: string | undefined): ImageComparisonData {
  if (!raw || typeof raw !== "string") return { beforeUrl: "", afterUrl: "" };
  try {
    const parsed = JSON.parse(raw) as ImageComparisonData;
    return {
      beforeUrl: parsed.beforeUrl ?? "",
      afterUrl: parsed.afterUrl ?? "",
      beforeLabel: parsed.beforeLabel ?? "",
      afterLabel: parsed.afterLabel ?? "",
    };
  } catch {
    return { beforeUrl: "", afterUrl: "" };
  }
}

export function ImageComparisonNodeView({ node, getPos, editor }: NodeViewProps) {
  const data = parseData(node.attrs.data);
  const [pickerSlot, setPickerSlot] = useState<"before" | "after" | null>(null);

  const updateNode = useCallback(
    (updates: Partial<ImageComparisonData>) => {
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (pos === undefined) return;
      const merged: ImageComparisonData = {
        beforeUrl: updates.beforeUrl ?? data.beforeUrl,
        afterUrl: updates.afterUrl ?? data.afterUrl,
        beforeLabel: updates.beforeLabel ?? data.beforeLabel,
        afterLabel: updates.afterLabel ?? data.afterLabel,
      };
      editor.commands.setNodeSelection(pos);
      editor.commands.updateAttributes("imageComparison", {
        data: JSON.stringify(merged),
      });
      setPickerSlot(null);
    },
    [editor, getPos, data]
  );

  const handleSelect = useCallback(
    (url: string, alt?: string) => {
      if (pickerSlot === "before") {
        updateNode({ beforeUrl: url, beforeLabel: data.beforeLabel || alt });
      } else if (pickerSlot === "after") {
        updateNode({ afterUrl: url, afterLabel: data.afterLabel || alt });
      }
    },
    [pickerSlot, updateNode, data.beforeLabel, data.afterLabel]
  );

  const hasBoth = !!(data.beforeUrl && data.afterUrl);

  return (
    <NodeViewWrapper className="my-4 block">
      <div className="relative rounded-lg border border-white/10 bg-hot-gray/30 p-4">
        {hasBoth ? (
          <div className="group relative aspect-video w-full overflow-hidden rounded-lg">
            <ReactCompareSlider
              className="!h-full !w-full"
              itemOne={
                <div className="relative h-full w-full">
                  <ReactCompareSliderImage
                    src={data.beforeUrl}
                    alt={data.beforeLabel || "Before"}
                    style={{ objectFit: "cover", width: "100%", height: "100%" }}
                  />
                  {data.beforeLabel && (
                    <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 font-sans text-xs text-white">
                      {data.beforeLabel}
                    </span>
                  )}
                </div>
              }
              itemTwo={
                <div className="relative h-full w-full">
                  <ReactCompareSliderImage
                    src={data.afterUrl}
                    alt={data.afterLabel || "After"}
                    style={{ objectFit: "cover", width: "100%", height: "100%" }}
                  />
                  {data.afterLabel && (
                    <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 font-sans text-xs text-white">
                      {data.afterLabel}
                    </span>
                  )}
                </div>
              }
            />
            <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPickerSlot("before");
                }}
                className="flex items-center gap-1.5 rounded-md border border-white/20 bg-hot-black/90 px-2.5 py-1.5 text-xs text-hot-white shadow-md hover:bg-white/10"
                aria-label="Change before image"
              >
                <Pencil className="h-3.5 w-3.5" />
                Before
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPickerSlot("after");
                }}
                className="flex items-center gap-1.5 rounded-md border border-white/20 bg-hot-black/90 px-2.5 py-1.5 text-xs text-hot-white shadow-md hover:bg-white/10"
                aria-label="Change after image"
              >
                <Pencil className="h-3.5 w-3.5" />
                After
              </button>
            </div>
          </div>
        ) : (
          <div className="flex aspect-video w-full gap-2 rounded-lg">
            <button
              type="button"
              onClick={() => setPickerSlot("before")}
              className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 text-gray-400 transition hover:border-white/40 hover:text-hot-white"
            >
              {data.beforeUrl ? (
                <img src={data.beforeUrl} alt="" className="h-full w-full object-cover rounded-lg" />
              ) : (
                <>
                  <ImagePlus className="h-8 w-8" />
                  <span className="font-sans text-sm">Before</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPickerSlot("after")}
              className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/20 text-gray-400 transition hover:border-white/40 hover:text-hot-white"
            >
              {data.afterUrl ? (
                <img src={data.afterUrl} alt="" className="h-full w-full object-cover rounded-lg" />
              ) : (
                <>
                  <ImagePlus className="h-8 w-8" />
                  <span className="font-sans text-sm">After</span>
                </>
              )}
            </button>
          </div>
        )}

        {hasBoth && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Before label (e.g. iPhone 15)"
              value={data.beforeLabel ?? ""}
              onChange={(e) => updateNode({ beforeLabel: e.target.value })}
              className="flex-1 min-w-[120px] rounded border border-white/10 bg-white/5 px-2 py-1.5 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-white/30 focus:outline-none"
            />
            <input
              type="text"
              placeholder="After label (e.g. Pixel 8)"
              value={data.afterLabel ?? ""}
              onChange={(e) => updateNode({ afterLabel: e.target.value })}
              className="flex-1 min-w-[120px] rounded border border-white/10 bg-white/5 px-2 py-1.5 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-white/30 focus:outline-none"
            />
          </div>
        )}

        <MediaPickerModal
          isOpen={pickerSlot !== null}
          onClose={() => setPickerSlot(null)}
          onSelect={handleSelect}
        />
      </div>
    </NodeViewWrapper>
  );
}
