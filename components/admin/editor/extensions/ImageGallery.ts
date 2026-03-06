import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageGalleryNodeView } from "@/components/editor/nodes/ImageGalleryNodeView";

export type ImageGalleryLayout = "grid" | "masonry" | "slideshow";

export type ImageGalleryItem = {
  id: string;
  url: string;
  alt?: string;
};

export type ImageGalleryData = {
  layout: ImageGalleryLayout;
  images: ImageGalleryItem[];
};

const DEFAULT_IMAGE_GALLERY_DATA: ImageGalleryData = {
  layout: "grid",
  images: [],
};

function parseData(raw: string | undefined): ImageGalleryData {
  if (!raw || typeof raw !== "string") return DEFAULT_IMAGE_GALLERY_DATA;
  try {
    const parsed = JSON.parse(raw) as ImageGalleryData;
    return {
      layout: parsed.layout ?? "grid",
      images: Array.isArray(parsed.images)
        ? parsed.images.filter((i: unknown) => i && typeof i === "object" && "url" in i && typeof (i as { url: unknown }).url === "string")
        : [],
    };
  } catch {
    return DEFAULT_IMAGE_GALLERY_DATA;
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageGallery: {
      setImageGallery: (data: ImageGalleryData) => ReturnType;
    };
  }
}

export const ImageGalleryExtension = Node.create({
  name: "imageGallery",

  priority: 1000,

  group: "block",
  atom: true,

  addAttributes() {
    return {
      data: {
        default: JSON.stringify(DEFAULT_IMAGE_GALLERY_DATA),
        parseHTML: (element) =>
          element.getAttribute("data-gallery") ?? JSON.stringify(DEFAULT_IMAGE_GALLERY_DATA),
        renderHTML: (attrs) => ({ "data-gallery": attrs.data }),
      },
    };
  },

  addOptions() {
    return { HTMLAttributes: {} };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-gallery"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const dataStr = HTMLAttributes.data ?? node.attrs.data ?? JSON.stringify(DEFAULT_IMAGE_GALLERY_DATA);
    const data = parseData(dataStr);
    const count = data.images?.length ?? 0;

    const wrapperAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      "data-type": "image-gallery",
      "data-gallery": dataStr,
    });

    return [
      "div",
      wrapperAttrs,
      [
        "div",
        {
          style:
            "padding:12px 16px; border:1px dashed #6b7280; border-radius:8px; background:rgba(255,255,255,0.05); color:#9ca3af; font-size:14px; cursor:pointer;",
          "data-gallery-preview": "true",
        },
        `Image Gallery (${data.layout}): ${count} image${count !== 1 ? "s" : ""}`,
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGalleryNodeView);
  },

  addCommands() {
    return {
      setImageGallery:
        (data: ImageGalleryData) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              data: JSON.stringify({ ...DEFAULT_IMAGE_GALLERY_DATA, ...data }),
            },
          });
        },
    };
  },
});
