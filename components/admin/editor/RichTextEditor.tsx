"use client";

import { useCallback, useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { PostCard } from "./extensions/PostCard";
import { SocialCard } from "./extensions/SocialCard";
import { SponsorBlockExtension, SPONSOR_BLOCK_EDIT_EVENT } from "./extensions/SponsorBlock";
import { ImageGalleryExtension } from "./extensions/ImageGallery";
import { ImageComparisonExtension } from "./extensions/ImageComparison";
import { PullQuoteExtension } from "./extensions/PullQuote";
import { KeyTakeawaysExtension } from "./extensions/KeyTakeaways";
import { ProductBoxExtension, PRODUCT_BOX_EDIT_EVENT, DEFAULT_PRODUCT_BOX_CONFIG, type ProductBoxConfig, type ProductBoxTemplate } from "./extensions/ProductBox";
import { ProductInjectionModal } from "./ProductInjectionModal";
import type { ProductBoxInsertPayload } from "./ProductInjectionModal";
import {
  Bold,
  Italic,
  List,
  ListChecks,
  Quote,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  ImageIcon,
  Youtube,
  FileText,
  Share2,
  Handshake,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaPickerModal } from "@/app/components/admin/media/MediaPickerModal";
import { PostPickerModal } from "@/components/admin/media/PostPickerModal";
import { SponsorBlockModal } from "@/app/components/admin/posts/SponsorBlockModal";
import type { PostPickerPost } from "@/lib/actions/post-picker";
import type { SponsorBlockData } from "@/lib/types/post";
import { DEFAULT_SPONSOR_BLOCK_DATA, DEFAULT_PULL_QUOTE_DATA, DEFAULT_KEY_TAKEAWAYS_DATA } from "@/lib/types/post";
import { linkProductToPost } from "@/lib/actions/product";

function getYoutubeId(url: string): string | null {
  const trimmed = url.trim();
  const m = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

type SocialPlatform = "tiktok" | "instagram" | "x" | "unknown";

function getSocialPlatform(url: string): { platform: SocialPlatform; label: string; emoji: string } {
  const u = url.toLowerCase();
  if (u.includes("tiktok.com")) return { platform: "tiktok", label: "View post on TikTok", emoji: "📱" };
  if (u.includes("instagram.com")) return { platform: "instagram", label: "View post on Instagram", emoji: "📷" };
  if (u.includes("twitter.com") || u.includes("x.com")) return { platform: "x", label: "View post on X", emoji: "𝕏" };
  return { platform: "unknown", label: "View link", emoji: "🔗" };
}

const ToolbarButton = ({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      "rounded p-2 transition-colors",
      active ? "bg-white/20 text-hot-white" : "text-gray-400 hover:bg-white/10 hover:text-hot-white",
      disabled && "opacity-50 cursor-not-allowed"
    )}
  >
    {children}
  </button>
);

export type RichTextEditorHandle = {
  getHTML: () => string;
};

type RichTextEditorProps = {
  content?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** When set (e.g. in post editor), product box insert/update will also link this product to the post. */
  postId?: string | null;
};

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor({
  content = "",
  onChange,
  placeholder = "Write your story…",
  className,
  postId,
}, ref) {
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [postPickerOpen, setPostPickerOpen] = useState(false);
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);
  const [sponsorModalInitialData, setSponsorModalInitialData] = useState<SponsorBlockData>(DEFAULT_SPONSOR_BLOCK_DATA);
  const sponsorEditPositionRef = useRef<number | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productEditState, setProductEditState] = useState<ProductBoxInsertPayload | null>(null);
  const productEditPositionRef = useRef<number | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      Image.configure({ inline: false, allowBase64: false }),
      PostCard,
      SocialCard,
      SponsorBlockExtension,
      ImageGalleryExtension,
      ImageComparisonExtension,
      PullQuoteExtension,
      KeyTakeawaysExtension,
      ProductBoxExtension,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-hot-blue underline" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: content || "<p></p>",
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none min-h-[240px] px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useImperativeHandle(ref, () => ({
    getHTML: () => editor?.getHTML() ?? "",
  }), [editor]);

  const handleImageSelect = useCallback(
    (url: string, alt?: string) => {
      if (editor && url) {
        editor.chain().focus().setImage({ src: url, alt: alt ?? "" }).run();
      }
      setImagePickerOpen(false);
    },
    [editor]
  );

  const handleMediaInsert = useCallback(
    (params: { mode: "single" | "grid" | "masonry" | "slideshow" | "comparison"; items: { id: string; url: string; alt_text?: string | null }[] }) => {
      if (!editor) return;
      const { mode, items } = params;
      if (mode === "single" && items[0]) {
        editor.chain().focus().setImage({ src: items[0].url, alt: items[0].alt_text ?? "" }).run();
      } else if ((mode === "grid" || mode === "masonry" || mode === "slideshow") && items.length >= 1) {
        const galleryItems = items.map((i, idx) => ({
          id: i.id || `img-${Date.now()}-${idx}`,
          url: i.url,
          alt: i.alt_text ?? undefined,
        }));
        editor.chain().focus().setImageGallery({ layout: mode, images: galleryItems }).run();
      } else if (mode === "comparison" && items.length >= 2) {
        editor.chain().focus().setImageComparison({
          beforeUrl: items[0].url,
          afterUrl: items[1].url,
          beforeLabel: items[0].alt_text ?? undefined,
          afterLabel: items[1].alt_text ?? undefined,
        }).run();
      }
      setImagePickerOpen(false);
    },
    [editor]
  );

  const handleYoutube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("YouTube video URL:");
    if (!url) return;
    const id = getYoutubeId(url);
    if (!id) {
      window.alert("Could not parse YouTube URL. Use a link like https://www.youtube.com/watch?v=... or https://youtu.be/...");
      return;
    }
    const embedHtml = `<div class="youtube-embed" style="margin: 16px 0;"><iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe></div>`;
    editor.chain().focus().insertContent(embedHtml).run();
  }, [editor]);

  const handleSocialEmbed = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Enter social URL (TikTok, Instagram, X):");
    if (!url || !url.trim()) return;
    const href = url.trim();
    const platform = href.includes("tiktok")
      ? "tiktok"
      : href.includes("instagram")
        ? "instagram"
        : href.includes("twitter") || href.includes("x.com")
          ? "x"
          : "link";
    editor.chain().focus().setSocialCard({ platform, url: href }).run();
  }, [editor]);

  const handlePostSelect = useCallback(
    (post: PostPickerPost) => {
      if (!editor) return;
      const image =
        post.image && post.image.trim()
          ? post.image.trim()
          : "https://placehold.co/600x200/1a1a1a/666?text=No+image";
      const title = post.title ?? "";
      const excerpt = (post.excerpt ?? "").slice(0, 160);
      const postUrl = `/blog/${post.slug}`;
      editor
        .chain()
        .focus()
        .setPostCard({
          title,
          excerpt,
          image,
          url: postUrl,
          date: post.published_at ?? undefined,
        })
        .run();
      setPostPickerOpen(false);
    },
    [editor]
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ data: SponsorBlockData; position: number }>;
      const { data, position } = ev.detail ?? {};
      if (data == null || typeof position !== "number") return;
      setSponsorModalInitialData(data);
      sponsorEditPositionRef.current = position;
      setSponsorModalOpen(true);
    };
    window.addEventListener(SPONSOR_BLOCK_EDIT_EVENT, handler);
    return () => window.removeEventListener(SPONSOR_BLOCK_EDIT_EVENT, handler);
  }, []);

  const handleSponsorSave = useCallback(
    (data: SponsorBlockData) => {
      if (!editor) return;
      const pos = sponsorEditPositionRef.current;
      if (pos !== null) {
        editor.chain().focus().setNodeSelection(pos).updateAttributes("sponsorBlock", { data: JSON.stringify(data) }).run();
        sponsorEditPositionRef.current = null;
      } else {
        editor.chain().focus().setSponsorBlock(data).run();
      }
      setSponsorModalOpen(false);
    },
    [editor]
  );

  const openSponsorModalForInsert = useCallback(() => {
    sponsorEditPositionRef.current = null;
    setSponsorModalInitialData(DEFAULT_SPONSOR_BLOCK_DATA);
    setSponsorModalOpen(true);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{
        productId: string;
        productName: string;
        config: ProductBoxConfig;
        template?: string;
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
        position: number;
      }>;
      const detail = ev.detail ?? {};
      const { productId, position } = detail;
      if (productId == null || typeof position !== "number") return;
      setProductEditState({
        productId,
        productName: detail.productName ?? "",
        config: detail.config ?? {},
        template: detail.template as ProductBoxTemplate | undefined,
        show_image: detail.show_image,
        show_award: detail.show_award,
        show_specs: detail.show_specs,
        show_breakdown: detail.show_breakdown,
        show_pros_cons: detail.show_pros_cons,
        show_buy_if: detail.show_buy_if,
        show_bottom_line: detail.show_bottom_line,
        show_star_rating: detail.show_star_rating,
        custom_pros: detail.custom_pros ?? null,
        custom_cons: detail.custom_cons ?? null,
        custom_buy_if: detail.custom_buy_if ?? null,
        custom_dont_buy_if: detail.custom_dont_buy_if ?? null,
      });
      productEditPositionRef.current = position;
      setProductModalOpen(true);
    };
    window.addEventListener(PRODUCT_BOX_EDIT_EVENT, handler);
    return () => window.removeEventListener(PRODUCT_BOX_EDIT_EVENT, handler);
  }, []);

  const handleProductInsert = useCallback(
    async (payload: ProductBoxInsertPayload) => {
      if (!editor) return;
      const pos = productEditPositionRef.current;
      const attrs = {
        productId: payload.productId,
        productName: payload.productName ?? "",
        config: JSON.stringify({ ...DEFAULT_PRODUCT_BOX_CONFIG, ...payload.config }),
        template: payload.template ?? "full_card",
        show_image: payload.show_image ?? true,
        show_award: payload.show_award ?? true,
        show_specs: payload.show_specs ?? true,
        show_breakdown: payload.show_breakdown ?? true,
        show_pros_cons: payload.show_pros_cons ?? true,
        show_buy_if: payload.show_buy_if ?? false,
        show_bottom_line: payload.show_bottom_line ?? true,
        show_star_rating: payload.show_star_rating ?? true,
        custom_pros: payload.custom_pros ?? null,
        custom_cons: payload.custom_cons ?? null,
        custom_buy_if: payload.custom_buy_if ?? null,
        custom_dont_buy_if: payload.custom_dont_buy_if ?? null,
      };
      if (pos != null) {
        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .updateAttributes("productBox", attrs)
          .run();
        productEditPositionRef.current = null;
      } else {
        editor.chain().focus().setProductBox({ ...payload, config: payload.config }).run();
      }
      setProductModalOpen(false);
      setProductEditState(null);
      if (postId?.trim() && payload.productId?.trim()) {
        await linkProductToPost(postId.trim(), payload.productId.trim());
      }
    },
    [editor, postId]
  );

  if (!editor) return null;

  return (
    <div className={cn("rounded-lg border border-white/10 bg-hot-gray overflow-hidden", className)}>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-white/10 bg-hot-gray/95 p-1 backdrop-blur">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Align left"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Align center"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="Align right"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <ToolbarButton
          onClick={() => {
            const url = window.prompt("Link URL:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          active={editor.isActive("link")}
          title="Link"
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setImagePickerOpen(true)} title="Insert image from Media Library">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleYoutube} title="Insert YouTube video">
          <Youtube className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setPostPickerOpen(true)} title="Embed post card">
          <FileText className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleSocialEmbed} title="Social embed (TikTok, Instagram, X)">
          <Share2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={openSponsorModalForInsert} title="Sponsor block">
          <Handshake className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            productEditPositionRef.current = null;
            setProductEditState(null);
            setProductModalOpen(true);
          }}
          title="Product box"
        >
          <Package className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setPullQuote(DEFAULT_PULL_QUOTE_DATA).run()}
          title="Pull quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setKeyTakeaways(DEFAULT_KEY_TAKEAWAYS_DATA).run()}
          title="Key Takeaways (TL;DR)"
        >
          <ListChecks className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:h-auto [&_.ProseMirror_img]:rounded-md [&_.content-card]:my-4 [&_.youtube-embed]:my-4 [&_[data-type=sponsor-block]]:my-4 [&_[data-type=image-gallery]]:my-4 [&_[data-type=image-comparison]]:my-4 [&_[data-type=pull-quote]]:my-4 [&_[data-type=key-takeaways]]:my-4 [&_[data-type=product-box]]:my-4"
      />

      <MediaPickerModal
        isOpen={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={handleImageSelect}
        context="editor"
        onInsert={(params) =>
          handleMediaInsert({
            mode: params.mode,
            items: params.items.map((i) => ({
              id: i.id,
              url: i.url,
              alt_text: i.alt_text ?? undefined,
            })),
          })
        }
      />
      <PostPickerModal
        isOpen={postPickerOpen}
        onClose={() => setPostPickerOpen(false)}
        onSelect={handlePostSelect}
      />
      <SponsorBlockModal
        isOpen={sponsorModalOpen}
        onClose={() => {
          setSponsorModalOpen(false);
          sponsorEditPositionRef.current = null;
        }}
        onSave={handleSponsorSave}
        initialData={sponsorModalInitialData}
      />
      <ProductInjectionModal
        isOpen={productModalOpen}
        onClose={() => {
          setProductModalOpen(false);
          setProductEditState(null);
          productEditPositionRef.current = null;
        }}
        onInsert={handleProductInsert}
        editState={productEditState}
      />
    </div>
  );
});
