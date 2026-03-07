"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Settings2 } from "lucide-react";
import type { ProductBoxConfig, ProductBoxTemplate } from "@/components/admin/editor/extensions/ProductBox";
import {
  DEFAULT_PRODUCT_BOX_CONFIG,
  PRODUCT_BOX_EDIT_EVENT,
} from "@/components/admin/editor/extensions/ProductBox";

function parseConfig(raw: string | undefined): ProductBoxConfig {
  if (!raw || typeof raw !== "string") return { ...DEFAULT_PRODUCT_BOX_CONFIG };
  try {
    const parsed = JSON.parse(raw) as ProductBoxConfig;
    return {
      ...DEFAULT_PRODUCT_BOX_CONFIG,
      ...parsed,
      keySpecKeys: Array.isArray(parsed.keySpecKeys)
        ? parsed.keySpecKeys.filter((k): k is string => typeof k === "string")
        : [],
      selectedAffiliates: Array.isArray(parsed.selectedAffiliates)
        ? parsed.selectedAffiliates.filter((k): k is string => typeof k === "string")
        : [],
      imageType:
        parsed.imageType === "hero" || parsed.imageType === "transparent"
          ? parsed.imageType
          : "transparent",
      descriptionOverride: typeof parsed.descriptionOverride === "string" ? parsed.descriptionOverride : "",
      showAward: typeof parsed.showAward === "boolean" ? parsed.showAward : true,
      affiliatePriceOverrides:
        parsed.affiliatePriceOverrides && typeof parsed.affiliatePriceOverrides === "object"
          ? parsed.affiliatePriceOverrides
          : {},
    };
  } catch {
    return { ...DEFAULT_PRODUCT_BOX_CONFIG };
  }
}

export function ProductBoxNodeView({ node, getPos, editor }: NodeViewProps) {
  const productId = node.attrs.productId ?? "";
  const productName = node.attrs.productName ?? "";
  const config = parseConfig(node.attrs.config);

  const handleConfigure = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (pos === undefined) return;
    editor.commands.setNodeSelection(pos);
    window.dispatchEvent(
      new CustomEvent(PRODUCT_BOX_EDIT_EVENT, {
        detail: {
          productId,
          productName,
          config,
          template: (node.attrs.template as ProductBoxTemplate) ?? "full_card",
          show_image: node.attrs.show_image !== false,
          show_award: node.attrs.show_award !== false,
          show_specs: node.attrs.show_specs !== false,
          show_breakdown: node.attrs.show_breakdown !== false,
          show_pros_cons: node.attrs.show_pros_cons !== false,
          show_buy_if: node.attrs.show_buy_if === true,
          show_bottom_line: node.attrs.show_bottom_line !== false,
          show_star_rating: node.attrs.show_star_rating !== false,
          custom_pros: node.attrs.custom_pros ?? null,
          custom_cons: node.attrs.custom_cons ?? null,
          custom_buy_if: node.attrs.custom_buy_if ?? null,
          custom_dont_buy_if: node.attrs.custom_dont_buy_if ?? null,
          position: pos,
        },
      })
    );
  };

  return (
    <NodeViewWrapper className="my-4 block" data-drag-handle>
      <div className="relative group rounded-lg border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <span className="font-sans text-sm font-medium text-hot-white">
              {productName || "Product"}
            </span>
            {productId && (
              <span className="ml-2 font-mono text-xs text-gray-500 truncate block">
                {productId}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleConfigure}
            className="shrink-0 flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-hot-white"
            aria-label="Configure product box"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Configure
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
