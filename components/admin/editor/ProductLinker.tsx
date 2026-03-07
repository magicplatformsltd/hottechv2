"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Star, X } from "lucide-react";
import type { Product } from "@/lib/types/product";
import {
  searchProducts,
  linkProductToPost,
  unlinkProduct,
  setPrimaryProduct,
  type LinkedProduct,
} from "@/lib/actions/product";

const SEARCH_DEBOUNCE_MS = 300;

type ProductLinkerProps = {
  postId: string;
  initialLinked: LinkedProduct[];
};

export function ProductLinker({ postId, initialLinked }: ProductLinkerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [linked, setLinked] = useState<LinkedProduct[]>(initialLinked);
  const [actionError, setActionError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const linkedIds = new Set(linked.map((l) => l.product.id));

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const results = await searchProducts(trimmed);
    setSearchResults(results);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(searchQuery);
      debounceRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, runSearch]);

  const handleSelectResult = useCallback(
    async (product: Product) => {
      setActionError("");
      const res = await linkProductToPost(postId, product.id);
      if (res.error) {
        setActionError(res.error);
        return;
      }
      setLinked((prev) => {
        const isFirst = prev.length === 0;
        return [...prev, { product, is_primary: isFirst }];
      });
      setSearchQuery("");
      setSearchResults([]);
    },
    [postId]
  );

  const handleUnlink = useCallback(
    async (productId: string) => {
      setActionError("");
      const res = await unlinkProduct(postId, productId);
      if (res.error) {
        setActionError(res.error);
        return;
      }
      setLinked((prev) => prev.filter((l) => l.product.id !== productId));
    },
    [postId]
  );

  const handleSetPrimary = useCallback(
    async (productId: string) => {
      setActionError("");
      const res = await setPrimaryProduct(postId, productId);
      if (res.error) {
        setActionError(res.error);
        return;
      }
      setLinked((prev) =>
        prev.map((l) => ({
          ...l,
          is_primary: l.product.id === productId,
        }))
      );
    },
    [postId]
  );

  const availableResults = searchResults.filter((p) => !linkedIds.has(p.id));
  const showDropdown = searchQuery.trim() && (searching || availableResults.length > 0);

  return (
    <div className="space-y-3">
      {actionError && (
        <p className="text-xs text-red-400">{actionError}</p>
      )}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products by name or brand…"
          className="w-full rounded-md border border-white/10 bg-hot-black px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/30 focus:outline-none"
          aria-label="Search products"
        />
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-white/10 bg-hot-gray shadow-lg"
          >
            {searching ? (
              <div className="px-3 py-2 text-sm text-gray-400">Searching…</div>
            ) : availableResults.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">No products found.</div>
            ) : (
              <ul className="py-1">
                {availableResults.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectResult(product)}
                      className="w-full px-3 py-2 text-left text-sm text-hot-white hover:bg-white/10"
                    >
                      <span className="font-medium">{product.name}</span>
                      {product.brand && (
                        <span className="ml-2 text-gray-400">{product.brand}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="font-sans text-xs font-medium text-gray-500">Linked products</p>
        {linked.length === 0 ? (
          <p className="text-sm text-gray-400">No products linked. Search and click to add.</p>
        ) : (
          <ul className="space-y-1.5">
            {linked.map(({ product, is_primary }) => (
              <li
                key={product.id}
                className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => handleSetPrimary(product.id)}
                  className="shrink-0 rounded p-0.5 text-gray-400 hover:text-amber-400"
                  title={is_primary ? "Primary product" : "Set as primary"}
                  aria-label={is_primary ? "Primary product" : "Set as primary"}
                >
                  <Star
                    className={`h-4 w-4 ${is_primary ? "fill-amber-400 text-amber-400" : ""}`}
                  />
                </button>
                <span className="min-w-0 flex-1 truncate font-sans text-sm text-hot-white">
                  {product.name}
                  {product.brand && (
                    <span className="ml-1 text-gray-400">· {product.brand}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleUnlink(product.id)}
                  className="shrink-0 rounded p-0.5 text-gray-400 hover:text-red-400"
                  aria-label="Remove product"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
