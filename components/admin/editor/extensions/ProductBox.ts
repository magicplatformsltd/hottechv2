import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ProductBoxNodeView } from "@/components/editor/nodes/ProductBoxNodeView";

export type ProductBoxImageType = "transparent" | "hero";

export type ProductBoxConfig = {
  showStarRating?: boolean;
  showProsCons?: boolean;
  showKeySpecs?: boolean;
  keySpecKeys?: string[];
  includeAffiliateButtons?: boolean;
  selectedAffiliates?: string[];
  showImage?: boolean;
  imageType?: ProductBoxImageType;
  descriptionOverride?: string;
  showReleaseDate?: boolean;
};

export const DEFAULT_PRODUCT_BOX_CONFIG: ProductBoxConfig = {
  showStarRating: true,
  showProsCons: true,
  showKeySpecs: true,
  keySpecKeys: [],
  includeAffiliateButtons: true,
  selectedAffiliates: [],
  showImage: true,
  imageType: "transparent",
  descriptionOverride: "",
  showReleaseDate: true,
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
    };
  } catch {
    return { ...DEFAULT_PRODUCT_BOX_CONFIG };
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    productBox: {
      setProductBox: (attrs: {
        productId: string;
        productName?: string;
        config?: ProductBoxConfig;
      }) => ReturnType;
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
        (attrs: { productId: string; productName?: string; config?: ProductBoxConfig }) =>
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
            },
          });
        },
    };
  },
});
