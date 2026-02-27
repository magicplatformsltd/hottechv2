"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClearCacheButton } from "@/app/components/admin/ClearCacheButton";
import { SyncButton } from "@/app/components/admin/SyncButton";
import { signOut } from "./actions";
import { cn } from "@/lib/utils";

const contentLinks = [
  { href: "/admin/posts", label: "All Posts" },
  { href: "/admin/posts/new", label: "Add New" },
] as const;

const otherLinks = [
  { href: "/admin/homepage", label: "Homepage" },
  { href: "/admin/footer", label: "Footer" },
  { href: "/admin/menus", label: "Menu Manager" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/tags", label: "Tags" },
  { href: "/admin/content-types", label: "Content Types" },
  { href: "/admin/newsletters", label: "Newsletters" },
  { href: "/admin/reporting", label: "Reporting" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/subscribers", label: "Subscribers" },
] as const;

export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-white/10 bg-hot-gray">
      <div className="flex h-14 items-center border-b border-white/10 px-4">
        <Link
          href="/admin"
          className="font-serif text-lg font-semibold text-hot-white"
        >
          Hot Tech Admin
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        <Link
          href="/admin"
          className={cn(
            "rounded-md px-3 py-2 font-sans text-sm transition-colors",
            pathname === "/admin"
              ? "bg-white/10 text-hot-white"
              : "text-gray-400 hover:bg-white/5 hover:text-hot-white"
          )}
        >
          Dashboard
        </Link>
        <div className="mt-2">
          <p className="px-3 py-1 font-sans text-xs font-medium uppercase tracking-wider text-gray-500">
            Content
          </p>
          {contentLinks.map(({ href, label }) => {
            const isActive =
              pathname === href ||
              (href === "/admin/posts" && pathname.startsWith("/admin/posts/") && pathname !== "/admin/posts/new");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "block rounded-md px-3 py-2 font-sans text-sm transition-colors",
                  isActive
                    ? "bg-white/10 text-hot-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-hot-white"
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div className="mt-2">
          {otherLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "block rounded-md px-3 py-2 font-sans text-sm transition-colors",
                pathname.startsWith(href)
                  ? "bg-white/10 text-hot-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-hot-white"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="border-t border-white/10 p-3 space-y-2">
        <SyncButton />
        <ClearCacheButton />
        <p className="mt-3 truncate px-3 py-1 font-sans text-xs text-gray-400">
          {userEmail}
        </p>
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left font-sans text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-hot-white"
          >
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
