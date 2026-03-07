import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ProductBoxNodeView } from "@/components/editor/nodes/ProductBoxNodeView";

export type ProductBoxImageType = "transparent" | "hero";

export type AffiliatePriceOverride = {
  price_amount?: string;
  price_currency?: string;
  cta_text?: string;
  show_price?: boolean;
  show_retailer?: boolean;
};

export type ProductBoxConfig = {
  showStarRating?: boolean;
  showProsCons?: boolean;
  showKeySpecs?: boolean;
  keySpecKeys?: string[];
  includeAffiliateButtons?: boolean;
  selectedAffiliates?: string[];
  /** Post-specific price/currency per retailer (key = retailer name). */
  affiliatePriceOverrides?: Record<string, AffiliatePriceOverride>;
  showImage?: boolean;
  imageType?: ProductBoxImageType;
  descriptionOverride?: string;
  showReleaseDate?: boolean;
  showAward?: boolean;
};

export const DEFAULT_PRODUCT_BOX_CONFIG: ProductBoxConfig = {
  showStarRating: true,
  showProsCons: true,
  showKeySpecs: true,
  keySpecKeys: [],
  includeAffiliateButtons: true,
  selectedAffiliates: [],
  affiliatePriceOverrides: {},
  showImage: true,
  imageType: "transparent",
  descriptionOverride: "",
  showReleaseDate: true,
  showAward: true,
};

export const PRODUCT_BOX_EDIT_EVENT = "edit-product-box";

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

export type ProductBoxTemplate = "full_card" | "compact" | "spec_sheet";

export type ProductBoxAttrs = {
  productId: string;
  productName?: string;
  config?: ProductBoxConfig;
  template?: ProductBoxTemplate;
  show_image?: boolean;
  show_award?: boolean;
  show_specs?: boolean;
  show_breakdown?: boolean;
  show_pros_cons?: boolean;
  custom_pros?: string | null;
  custom_cons?: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    productBox: {
      setProductBox: (attrs: ProductBoxAttrs) => ReturnType;
    };
  }
}

export const ProductBoxExtension = Node.create({
  name: "productBox",

  priority: 1000,

  group: "block",
  atom: true,

  addAttributes() {
    return {
      productId: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-product-id") ?? "",
        renderHTML: (attrs) => (attrs.productId ? { "data-product-id": attrs.productId } : {}),
      },
      productName: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-product-name") ?? "",
        renderHTML: (attrs) => (attrs.productName ? { "data-product-name": attrs.productName } : {}),
      },
      config: {
        default: JSON.stringify(DEFAULT_PRODUCT_BOX_CONFIG),
        parseHTML: (el) => el.getAttribute("data-product-config") ?? JSON.stringify(DEFAULT_PRODUCT_BOX_CONFIG),
        renderHTML: (attrs) => ({ "data-product-config": attrs.config }),
      },
      template: {
        default: "full_card",
        parseHTML: (el) => (el.getAttribute("data-template") as "full_card" | "compact" | "spec_sheet") ?? "full_card",
        renderHTML: (attrs) => ({ "data-template": attrs.template ?? "full_card" }),
      },
      show_image: {
        default: true,
        parseHTML: (el) => el.getAttribute("data-show-image") !== "false",
        renderHTML: (attrs) => ({ "data-show-image": attrs.show_image === false ? "false" : "true" }),
      },
      show_award: {
        default: true,
        parseHTML: (el) => el.getAttribute("data-show-award") !== "false",
        renderHTML: (attrs) => ({ "data-show-award": attrs.show_award === false ? "false" : "true" }),
      },
      show_specs: {
        default: true,
        parseHTML: (el) => el.getAttribute("data-show-specs") !== "false",
        renderHTML: (attrs) => ({ "data-show-specs": attrs.show_specs === false ? "false" : "true" }),
      },
      show_breakdown: {
        default: true,
        parseHTML: (el) => el.getAttribute("data-show-breakdown") !== "false",
        renderHTML: (attrs) => ({ "data-show-breakdown": attrs.show_breakdown === false ? "false" : "true" }),
      },
      show_pros_cons: {
        default: true,
        parseHTML: (el) => el.getAttribute("data-show-pros-cons") !== "false",
        renderHTML: (attrs) => ({ "data-show-pros-cons": attrs.show_pros_cons === false ? "false" : "true" }),
      },
      custom_pros: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-custom-pros") ?? null,
        renderHTML: (attrs) =>
          attrs.custom_pros != null && attrs.custom_pros !== ""
            ? { "data-custom-pros": typeof attrs.custom_pros === "string" ? attrs.custom_pros : JSON.stringify(attrs.custom_pros) }
            : {},
      },
      custom_cons: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-custom-cons") ?? null,
        renderHTML: (attrs) =>
          attrs.custom_cons != null && attrs.custom_cons !== ""
            ? { "data-custom-cons": typeof attrs.custom_cons === "string" ? attrs.custom_cons : JSON.stringify(attrs.custom_cons) }
            : {},
      },
    };
  },

  addOptions() {
    return { HTMLAttributes: {} };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="product-box"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = HTMLAttributes["data-product-name"] ?? node.attrs.productName ?? "Product";
    const wrapperAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      "data-type": "product-box",
      "data-product-id": node.attrs.productId,
      "data-product-name": node.attrs.productName,
      "data-product-config": node.attrs.config,
      "data-template": node.attrs.template ?? "full_card",
      "data-show-image": node.attrs.show_image === false ? "false" : "true",
      "data-show-award": node.attrs.show_award === false ? "false" : "true",
      "data-show-specs": node.attrs.show_specs === false ? "false" : "true",
      "data-show-breakdown": node.attrs.show_breakdown === false ? "false" : "true",
      "data-show-pros-cons": node.attrs.show_pros_cons === false ? "false" : "true",
      ...(node.attrs.custom_pros != null && node.attrs.custom_pros !== ""
        ? { "data-custom-pros": typeof node.attrs.custom_pros === "string" ? node.attrs.custom_pros : JSON.stringify(node.attrs.custom_pros) }
        : {}),
      ...(node.attrs.custom_cons != null && node.attrs.custom_cons !== ""
        ? { "data-custom-cons": typeof node.attrs.custom_cons === "string" ? node.attrs.custom_cons : JSON.stringify(node.attrs.custom_cons) }
        : {}),
    });

    return [
      "div",
      wrapperAttrs,
      [
        "div",
        {
          style:
            "padding:12px 16px; border:1px dashed #6b7280; border-radius:8px; background:rgba(255,255,255,0.05); color:#9ca3af; font-size:14px; cursor:pointer;",
          "data-product-preview": "true",
        },
        `Product: ${name || "—"}`,
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ProductBoxNodeView);
  },

  addCommands() {
    return {
      setProductBox:
        (attrs: ProductBoxAttrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              productId: attrs.productId,
              productName: attrs.productName ?? "",
              config: JSON.stringify({
                ...DEFAULT_PRODUCT_BOX_CONFIG,
                ...attrs.config,
              }),
              template: attrs.template ?? "full_card",
              show_image: attrs.show_image ?? true,
              show_award: attrs.show_award ?? true,
              show_specs: attrs.show_specs ?? true,
              show_breakdown: attrs.show_breakdown ?? true,
              show_pros_cons: attrs.show_pros_cons ?? true,
              custom_pros: attrs.custom_pros ?? null,
              custom_cons: attrs.custom_cons ?? null,
            },
          });
        },
    };
  },
});
