"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ClearCacheButton } from "@/app/components/admin/ClearCacheButton";
import { SyncButton } from "@/app/components/admin/SyncButton";
import { signOut } from "./actions";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; children: NavLink[] };

const navGroups: NavGroup[] = [
  {
    label: "Content",
    children: [
      { href: "/admin/posts", label: "All Posts" },
      { href: "/admin/posts/new", label: "Add New" },
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/tags", label: "Tags" },
      { href: "/admin/content-types", label: "Content Types" },
    ],
  },
  {
    label: "Products & Reviews",
    children: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/products/new", label: "Add New Product" },
      { href: "/admin/products/templates", label: "Templates" },
      { href: "/admin/products/awards", label: "Awards" },
    ],
  },
  {
    label: "Appearance",
    children: [
      { href: "/admin/homepage", label: "Homepage" },
      { href: "/admin/footer", label: "Footer" },
      { href: "/admin/menus", label: "Menu Manager" },
    ],
  },
  {
    label: "Audience",
    children: [
      { href: "/admin/subscribers", label: "Subscribers" },
      { href: "/admin/newsletters", label: "Newsletters" },
    ],
  },
  {
    label: "System",
    children: [
      { href: "/admin/media", label: "Media" },
      { href: "/admin/reporting", label: "Reporting" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

const EXACT_MATCH_HREFS = new Set(["/admin/products"]);

function isChildActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (EXACT_MATCH_HREFS.has(href)) return false;
  // Parent-style links (e.g. /admin/posts, /admin/products): active when pathname is a subpath
  // but not when pathname is another child’s exact path (e.g. /admin/posts/new)
  if (pathname.startsWith(href + "/")) {
    const rest = pathname.slice(href.length + 1);
    // Consider active only if it looks like an id (e.g. uuid) not a known segment
    if (rest === "new" || rest === "templates" || rest.startsWith("new/") || rest.startsWith("templates/")) {
      return false;
    }
    return true;
  }
  return false;
}

function isGroupOpenForPathname(group: NavGroup, pathname: string): boolean {
  return group.children.some(
    (child) => pathname === child.href || pathname.startsWith(child.href + "/")
  );
}

function getInitialOpenGroups(pathname: string): Set<string> {
  const set = new Set<string>();
  for (const group of navGroups) {
    if (isGroupOpenForPathname(group, pathname)) {
      set.add(group.label);
    }
  }
  return set;
}

export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() =>
    getInitialOpenGroups(pathname)
  );

  useEffect(() => {
    setOpenGroups((prev) => {
      const forPath = getInitialOpenGroups(pathname);
      if (forPath.size === 0) return prev;
      const next = new Set(prev);
      forPath.forEach((label) => next.add(label));
      return next;
    });
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

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
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
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
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md px-3 py-2 font-sans text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-hot-white"
        >
          View Site
        </Link>

        {navGroups.map((group) => {
          const isOpen = openGroups.has(group.label);
          return (
            <div key={group.label} className="mt-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 font-sans text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-hot-white"
              >
                <span>{group.label}</span>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="ml-2 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                  {group.children.map((child) => {
                    const active = isChildActive(child.href, pathname);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "block rounded-md px-2 py-1.5 font-sans text-sm transition-colors",
                          active
                            ? "bg-white/10 text-hot-white"
                            : "text-gray-400 hover:bg-white/5 hover:text-hot-white"
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
