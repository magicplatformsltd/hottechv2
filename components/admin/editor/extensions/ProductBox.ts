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

export type ProductBoxTemplate = "full_card" | "compact" | "spec_sheet" | "buy_if_block";

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
  show_buy_if?: boolean;
  show_bottom_line?: boolean;
  show_star_rating?: boolean;
  custom_pros?: string | null;
  custom_cons?: string | null;
  custom_buy_if?: string | null;
  custom_dont_buy_if?: string | null;
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
        parseHTML: (el) => (el.getAttribute("data-template") as ProductBoxTemplate) ?? "full_card",
        renderHTML: (attrs) => ({ "data-template": attrs.template ?? "full_card" }),
      },
      show_image: {
        default: true,
        parseHTML: (element) => {
          const attr = element.getAttribute("data-show-image");
          if (attr === "false") return false;
          if (attr === "true") return true;
          return true;
        },
        renderHTML: (attributes) => ({ "data-show-image": String(attributes.show_image) }),
      },
      show_award: {
        default: true,
        parseHTML: (element) => {
          const attr = element.getAttribute("data-show-award");
          if (attr === "false") return false;
          if (attr === "true") return true;
          return true;
        },
        renderHTML: (attributes) => ({ "data-show-award": String(attributes.show_award) }),
      },
      show_specs: {
        default: true,
        parseHTML: (element) => {
          const attr = element.getAttribute("data-show-specs");
          if (attr === "false") return false;
          if (attr === "true") return true;
          return true;
        },
        renderHTML: (attributes) => ({ "data-show-specs": String(attributes.show_specs) }),
      },
      show_breakdown: {
        default: true,
        parseHTML: (element) => {
          const attr = element.getAttribute("data-show-breakdown");
          if (attr === "false") return false;
          if (attr === "true") return true;
          return true;
        },
        renderHTML: (attributes) => ({ "data-show-breakdown": String(attributes.show_breakdown) }),
      },
      show_pros_cons: {
        default: true,
        parseHTML: (element) => {
          const attr = element.getAttribute("data-show-pros-cons");
          if (attr === "false") return false;
          if (attr === "true") return true;
          return true;
        },
        renderHTML: (attributes) => ({ "data-show-pros-cons": String(attributes.show_pros_cons) }),
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
      show_buy_if: {
        default: false,
        parseHTML: (element) => {
          const attr = element.getAttribute("data-show-buy-if");
          if (attr === "false") return false;
          if (attr === "true") return true;
          return false;
        },
        renderHTML: (attributes) => ({ "data-show-buy-if": String(attributes.show_buy_if) }),
      },
      show_bottom_line: {
        default: true,
        parseHTML: (element) => {
          const attr = element.getAttribute("data-show-bottom-line");
          if (attr === "false") return false;
          if (attr === "true") return true;
          return true;
        },
        renderHTML: (attributes) => ({ "data-show-bottom-line": String(attributes.show_bottom_line) }),
      },
      show_star_rating: {
        default: true,
        parseHTML: (element) => {
          const attr = element.getAttribute("data-show-star-rating");
          if (attr === "false") return false;
          if (attr === "true") return true;
          return true;
        },
        renderHTML: (attributes) => ({ "data-show-star-rating": String(attributes.show_star_rating) }),
      },
      custom_buy_if: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-custom-buy-if") ?? null,
        renderHTML: (attrs) =>
          attrs.custom_buy_if != null && attrs.custom_buy_if !== ""
            ? { "data-custom-buy-if": typeof attrs.custom_buy_if === "string" ? attrs.custom_buy_if : JSON.stringify(attrs.custom_buy_if) }
            : {},
      },
      custom_dont_buy_if: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-custom-dont-buy-if") ?? null,
        renderHTML: (attrs) =>
          attrs.custom_dont_buy_if != null && attrs.custom_dont_buy_if !== ""
            ? { "data-custom-dont-buy-if": typeof attrs.custom_dont_buy_if === "string" ? attrs.custom_dont_buy_if : JSON.stringify(attrs.custom_dont_buy_if) }
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
      "data-show-image": String(node.attrs.show_image),
      "data-show-award": String(node.attrs.show_award),
      "data-show-specs": String(node.attrs.show_specs),
      "data-show-breakdown": String(node.attrs.show_breakdown),
      "data-show-pros-cons": String(node.attrs.show_pros_cons),
      ...(node.attrs.custom_pros != null && node.attrs.custom_pros !== ""
        ? { "data-custom-pros": typeof node.attrs.custom_pros === "string" ? node.attrs.custom_pros : JSON.stringify(node.attrs.custom_pros) }
        : {}),
      ...(node.attrs.custom_cons != null && node.attrs.custom_cons !== ""
        ? { "data-custom-cons": typeof node.attrs.custom_cons === "string" ? node.attrs.custom_cons : JSON.stringify(node.attrs.custom_cons) }
        : {}),
      "data-show-buy-if": String(node.attrs.show_buy_if),
      "data-show-bottom-line": String(node.attrs.show_bottom_line),
      "data-show-star-rating": String(node.attrs.show_star_rating),
      ...(node.attrs.custom_buy_if != null && node.attrs.custom_buy_if !== ""
        ? { "data-custom-buy-if": typeof node.attrs.custom_buy_if === "string" ? node.attrs.custom_buy_if : JSON.stringify(node.attrs.custom_buy_if) }
        : {}),
      ...(node.attrs.custom_dont_buy_if != null && node.attrs.custom_dont_buy_if !== ""
        ? { "data-custom-dont-buy-if": typeof node.attrs.custom_dont_buy_if === "string" ? node.attrs.custom_dont_buy_if : JSON.stringify(node.attrs.custom_dont_buy_if) }
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
              show_buy_if: attrs.show_buy_if ?? false,
              show_bottom_line: attrs.show_bottom_line ?? true,
              show_star_rating: attrs.show_star_rating ?? true,
              custom_pros: attrs.custom_pros ?? null,
              custom_cons: attrs.custom_cons ?? null,
              custom_buy_if: attrs.custom_buy_if ?? null,
              custom_dont_buy_if: attrs.custom_dont_buy_if ?? null,
            },
          });
        },
    };
  },
});
