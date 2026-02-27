"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { subscribe, type SubscribeState } from "@/lib/actions/subscribe";
import type {
  FooterConfig,
  FooterBlock,
  FooterTextBlockData,
  FooterNewsletterBlockData,
  FooterMenuBlockData,
  FooterSocialBlockData,
  SiteSettings,
} from "@/lib/types";

type FooterProps = {
  config?: FooterConfig | null;
  settings?: SiteSettings | null;
};

export function Footer({ config, settings }: FooterProps) {
  const year = new Date().getFullYear();
  const copyrightOwner =
    settings?.copyright_text?.trim() || settings?.site_name?.trim() || "House of Tech";
  const columns = config?.columns ?? [[], [], []];
  const hasAnyBlock = columns.some((col) => col.length > 0);

  return (
    <footer className="border-t border-hot-gray bg-hot-black">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {hasAnyBlock ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {columns.map((blocks, colIndex) => (
              <div key={colIndex} className="flex flex-col gap-4">
                {blocks.map((block) => (
                  <FooterBlockRenderer key={block.id} block={block} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-hot-white">
              <span className="font-medium">House of Tech</span>
            </div>
          </div>
        )}

        <p className="mt-8 border-t border-hot-gray pt-8 text-center text-sm text-hot-white/60">
          © {year} {copyrightOwner}
        </p>
      </div>
    </footer>
  );
}

function FooterBlockRenderer({ block }: { block: FooterBlock }) {
  switch (block.type) {
    case "text":
      return (
        <FooterTextBlock
          content={(block.data as FooterTextBlockData)?.content ?? ""}
        />
      );
    case "newsletter":
      return (
        <FooterNewsletterBlock
          title={(block.data as FooterNewsletterBlockData)?.title ?? "Stay updated"}
          placeholder={
            (block.data as FooterNewsletterBlockData)?.placeholder ?? "Your email"
          }
          buttonText={
            (block.data as FooterNewsletterBlockData)?.buttonText ?? "Subscribe"
          }
        />
      );
    case "menu":
      return (
        <FooterMenuBlock
          links={(block.data as FooterMenuBlockData)?.links ?? []}
        />
      );
    case "social":
      return (
        <FooterSocialBlock
          links={(block.data as FooterSocialBlockData)?.links ?? []}
        />
      );
    default:
      return null;
  }
}

function FooterTextBlock({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <div
      className="font-sans text-sm text-hot-white/90 prose prose-invert max-w-none prose-p:my-1"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

function SubmitButton({ buttonText }: { buttonText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 shrink-0 rounded-md bg-white px-6 font-sans text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-70"
    >
      {pending ? "…" : buttonText}
    </button>
  );
}

function FooterNewsletterBlock({
  title,
  placeholder,
  buttonText,
}: {
  title: string;
  placeholder: string;
  buttonText: string;
}) {
  const [state, formAction] = useActionState<SubscribeState | null, FormData>(
    subscribe,
    null
  );

  if (state?.success) {
    return (
      <div>
        {title && (
          <p className="mb-2 font-sans text-sm font-medium text-hot-white">
            {title}
          </p>
        )}
        <p className="font-sans text-sm font-medium text-green-500">
          You&apos;re in! Check your inbox.
        </p>
      </div>
    );
  }

  return (
    <div>
      {title && (
        <p className="mb-2 font-sans text-sm font-medium text-hot-white">
          {title}
        </p>
      )}
      <form
        action={formAction}
        className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="source" value="footer" />
        <input type="hidden" name="tags" value="newsletter" />
        <input
          type="email"
          name="email"
          placeholder={placeholder}
          required
          className="h-12 w-full flex-1 rounded-md border border-white/10 bg-white/5 px-4 font-sans text-hot-white placeholder-gray-500 focus:border-white/30 focus:outline-none focus:ring-0"
          aria-label="Email for newsletter"
        />
        <SubmitButton buttonText={buttonText} />
      </form>
      {state && !state.success && state.message && (
        <p className="mt-2 font-sans text-sm text-red-400" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}

function FooterMenuBlock({
  links,
}: {
  links: { label: string; url: string }[];
}) {
  if (!links.length) return null;
  return (
    <nav className="flex flex-col gap-2">
      {links.map((link, i) => (
        <Link
          key={i}
          href={link.url || "#"}
          className="font-sans text-sm text-hot-white/80 transition-colors hover:text-hot-white"
        >
          {link.label || "Link"}
        </Link>
      ))}
    </nav>
  );
}

function FooterSocialBlock({
  links,
}: {
  links: { platform: string; url: string }[];
}) {
  const withUrl = links.filter((l) => l.url?.trim());
  if (!withUrl.length) return null;

  const iconFor = (platform: string) => {
    const p = platform.toLowerCase();
    if (p === "twitter" || p === "x") return "𝕏";
    if (p === "linkedin") return "in";
    if (p === "youtube") return "▶";
    if (p === "instagram") return "📷";
    if (p === "github") return "⌘";
    return "↗";
  };

  return (
    <div className="flex flex-wrap gap-3">
      {withUrl.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-white/5 font-sans text-sm text-hot-white transition-colors hover:bg-white/10 hover:text-hot-white"
          aria-label={link.platform}
        >
          {iconFor(link.platform)}
        </a>
      ))}
    </div>
  );
}
