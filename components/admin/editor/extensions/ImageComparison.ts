import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageComparisonNodeView } from "@/components/editor/nodes/ImageComparisonNodeView";

export type ImageComparisonData = {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
};

const DEFAULT_IMAGE_COMPARISON_DATA: ImageComparisonData = {
  beforeUrl: "",
  afterUrl: "",
  beforeLabel: "",
  afterLabel: "",
};

function parseData(raw: string | undefined): ImageComparisonData {
  if (!raw || typeof raw !== "string") return DEFAULT_IMAGE_COMPARISON_DATA;
  try {
    const parsed = JSON.parse(raw) as ImageComparisonData;
    return {
      beforeUrl: parsed.beforeUrl ?? "",
      afterUrl: parsed.afterUrl ?? "",
      beforeLabel: parsed.beforeLabel ?? "",
      afterLabel: parsed.afterLabel ?? "",
    };
  } catch {
    return DEFAULT_IMAGE_COMPARISON_DATA;
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageComparison: {
      setImageComparison: (data: ImageComparisonData) => ReturnType;
    };
  }
}

export const ImageComparisonExtension = Node.create({
  name: "imageComparison",

  priority: 1000,

  group: "block",
  atom: true,

  addAttributes() {
    return {
      data: {
        default: JSON.stringify(DEFAULT_IMAGE_COMPARISON_DATA),
        parseHTML: (element) =>
          element.getAttribute("data-comparison") ?? JSON.stringify(DEFAULT_IMAGE_COMPARISON_DATA),
        renderHTML: (attrs) => ({ "data-comparison": attrs.data }),
      },
    };
  },

  addOptions() {
    return { HTMLAttributes: {} };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-comparison"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const dataStr = HTMLAttributes.data ?? node.attrs.data ?? JSON.stringify(DEFAULT_IMAGE_COMPARISON_DATA);
    const data = parseData(dataStr);
    const hasImages = !!(data.beforeUrl && data.afterUrl);

    const wrapperAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      "data-type": "image-comparison",
      "data-comparison": dataStr,
    });

    return [
      "div",
      wrapperAttrs,
      [
        "div",
        {
          style:
            "padding:12px 16px; border:1px dashed #6b7280; border-radius:8px; background:rgba(255,255,255,0.05); color:#9ca3af; font-size:14px; cursor:pointer;",
          "data-comparison-preview": "true",
        },
        hasImages
          ? `Before/After: ${data.beforeLabel || "Before"} vs ${data.afterLabel || "After"}`
          : "Image Comparison: Add two images",
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageComparisonNodeView);
  },

  addCommands() {
    return {
      setImageComparison:
        (data: ImageComparisonData) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              data: JSON.stringify({ ...DEFAULT_IMAGE_COMPARISON_DATA, ...data }),
            },
          });
        },
    };
  },
});
