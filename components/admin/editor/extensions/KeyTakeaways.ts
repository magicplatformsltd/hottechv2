import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { KeyTakeawaysNodeView } from "@/components/editor/nodes/KeyTakeawaysNodeView";
import type { KeyTakeawaysData } from "@/lib/types/post";
import { DEFAULT_KEY_TAKEAWAYS_DATA } from "@/lib/types/post";

function parseData(raw: string | undefined): KeyTakeawaysData {
  if (!raw || typeof raw !== "string") return { ...DEFAULT_KEY_TAKEAWAYS_DATA };
  try {
    const parsed = JSON.parse(raw) as Partial<KeyTakeawaysData>;
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter((i): i is string => typeof i === "string")
      : DEFAULT_KEY_TAKEAWAYS_DATA.items;
    return { items: items.length > 0 ? items : [""] };
  } catch {
    return { ...DEFAULT_KEY_TAKEAWAYS_DATA };
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    keyTakeaways: {
      setKeyTakeaways: (data: KeyTakeawaysData) => ReturnType;
    };
  }
}

export const KeyTakeawaysExtension = Node.create({
  name: "keyTakeaways",

  priority: 1000,

  group: "block",
  atom: false,

  addAttributes() {
    return {
      data: {
        default: JSON.stringify(DEFAULT_KEY_TAKEAWAYS_DATA),
        parseHTML: (element) =>
          element.getAttribute("data-key-takeaways") ?? JSON.stringify(DEFAULT_KEY_TAKEAWAYS_DATA),
        renderHTML: (attrs) => ({ "data-key-takeaways": attrs.data }),
      },
    };
  },

  addOptions() {
    return { HTMLAttributes: {} };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="key-takeaways"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const dataStr =
      HTMLAttributes["data-key-takeaways"] ?? node.attrs.data ?? JSON.stringify(DEFAULT_KEY_TAKEAWAYS_DATA);
    const data = parseData(dataStr);
    const items = data.items?.filter(Boolean) ?? [];

    const wrapperAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      "data-type": "key-takeaways",
      "data-key-takeaways": dataStr,
      class: "key-takeaways my-6 rounded-lg border-l-4 border-hot-white/30 bg-white/5 py-4 px-5",
    });

    const listItems = items.map((item) => ["li", { class: "font-sans text-sm text-hot-white/90" }, item]);
    return [
      "div",
      wrapperAttrs,
      ["h4", { class: "mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-gray-400" }, "Key Takeaways"],
      ["ul", { class: "list-disc space-y-1 pl-5" }, ...listItems],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KeyTakeawaysNodeView);
  },

  addCommands() {
    return {
      setKeyTakeaways:
        (data: KeyTakeawaysData) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              data: JSON.stringify({
                items: Array.isArray(data.items) && data.items.length > 0 ? data.items : [""],
              }),
            },
          }),
    };
  },
});
