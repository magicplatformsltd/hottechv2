import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PullQuoteNodeView } from "@/components/editor/nodes/PullQuoteNodeView";
import type { PullQuoteData } from "@/lib/types/post";
import { DEFAULT_PULL_QUOTE_DATA } from "@/lib/types/post";

function parseData(raw: string | undefined): PullQuoteData {
  if (!raw || typeof raw !== "string") return { ...DEFAULT_PULL_QUOTE_DATA };
  try {
    const parsed = JSON.parse(raw) as Partial<PullQuoteData>;
    return {
      quoteText: typeof parsed.quoteText === "string" ? parsed.quoteText : DEFAULT_PULL_QUOTE_DATA.quoteText,
      attribution: typeof parsed.attribution === "string" ? parsed.attribution : DEFAULT_PULL_QUOTE_DATA.attribution,
      alignment:
        parsed.alignment === "left" || parsed.alignment === "right" || parsed.alignment === "full"
          ? parsed.alignment
          : DEFAULT_PULL_QUOTE_DATA.alignment,
    };
  } catch {
    return { ...DEFAULT_PULL_QUOTE_DATA };
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pullQuote: {
      setPullQuote: (data: PullQuoteData) => ReturnType;
    };
  }
}

export const PullQuoteExtension = Node.create({
  name: "pullQuote",

  priority: 1000,

  group: "block",
  atom: false,

  addAttributes() {
    return {
      data: {
        default: JSON.stringify(DEFAULT_PULL_QUOTE_DATA),
        parseHTML: (element) =>
          element.getAttribute("data-pull-quote") ?? JSON.stringify(DEFAULT_PULL_QUOTE_DATA),
        renderHTML: (attrs) => ({ "data-pull-quote": attrs.data }),
      },
    };
  },

  addOptions() {
    return { HTMLAttributes: {} };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="pull-quote"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const dataStr = HTMLAttributes["data-pull-quote"] ?? node.attrs.data ?? JSON.stringify(DEFAULT_PULL_QUOTE_DATA);
    const data = parseData(dataStr);
    const alignment = data.alignment ?? "full";

    const wrapperAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      "data-type": "pull-quote",
      "data-pull-quote": dataStr,
      class:
        alignment === "full"
          ? "pull-quote-full my-6 w-full text-center"
          : alignment === "right"
            ? "pull-quote-right float-right w-1/3 ml-6 mb-4"
            : "pull-quote-left float-left w-1/3 mr-6 mb-4",
    });

    const children: unknown[] = [
      ["blockquote", { class: "font-serif text-xl" }, data.quoteText || "Quote"],
    ];
    if (data.attribution) {
      children.push(["footer", { class: "mt-2 font-sans text-sm text-gray-400" }, `— ${data.attribution}`]);
    }
    return ["div", wrapperAttrs, ...children];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PullQuoteNodeView);
  },

  addCommands() {
    return {
      setPullQuote:
        (data: PullQuoteData) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { data: JSON.stringify({ ...DEFAULT_PULL_QUOTE_DATA, ...data }) },
          }),
    };
  },
});
