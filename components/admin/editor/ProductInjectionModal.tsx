"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Database } from "lucide-react";
import { searchProducts, getProductById } from "@/lib/actions/product";
import { getTemplates } from "@/lib/actions/template";
import { getCategories } from "@/lib/actions/categories";
import { getAwards, getAwardById } from "@/lib/actions/award";
import type { ProductAwardRecord } from "@/lib/types/award";
import type { Product } from "@/lib/types/product";
import type { ProductBoxConfig, ProductBoxImageType } from "./extensions/ProductBox";
import { DEFAULT_PRODUCT_BOX_CONFIG } from "./extensions/ProductBox";
import { ProductForm } from "@/components/admin/ProductForm";

const SEARCH_DEBOUNCE_MS = 300;

/** Full product context: from search selection or from fetch in edit mode. */
function getSpecKeys(product: Product | null): string[] {
  if (!product?.specs || typeof product.specs !== "object") return [];
  return Object.keys(product.specs).filter(Boolean);
}

/** Affiliate retailer keys for checklist (array: retailer; record: key). */
function getAffiliateKeys(product: Product | null): string[] {
  if (!product?.affiliate_links) return [];
  const links = product.affiliate_links;
  if (Array.isArray(links)) {
    return links
      .map((item) => (typeof item === "object" && item && "retailer" in item ? String((item as { retailer: string }).retailer) : ""))
      .filter(Boolean);
  }
  if (typeof links === "object") return Object.keys(links).filter(Boolean);
  return [];
}

export type ProductBoxInsertPayload = {
  productId: string;
  productName: string;
  config: ProductBoxConfig;
};

type ProductInjectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (payload: ProductBoxInsertPayload) => void;
  /** When set, open in "edit" mode with this node's data (config step only). */
  editState?: {
    productId: string;
    productName: string;
    config: ProductBoxConfig;
  } | null;
};

export function ProductInjectionModal({
  isOpen,
  onClose,
  onInsert,
  editState = null,
}: ProductInjectionModalProps) {
  const [step, setStep] = useState<"search" | "configure">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  /** In edit mode, full product fetched by id so we have specs. */
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [fetchingProduct, setFetchingProduct] = useState(false);
  const [config, setConfig] = useState<ProductBoxConfig>({ ...DEFAULT_PRODUCT_BOX_CONFIG });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTemplates, setDrawerTemplates] = useState<Awaited<ReturnType<typeof getTemplates>>>([]);
  const [drawerCategories, setDrawerCategories] = useState<Awaited<ReturnType<typeof getCategories>>>([]);
  const [drawerAwards, setDrawerAwards] = useState<Awaited<ReturnType<typeof getAwards>>>([]);
  const [productAward, setProductAward] = useState<ProductAwardRecord | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productContext = fetchedProduct ?? selectedProduct;
  const specKeys = getSpecKeys(productContext);
  const affiliateKeys = getAffiliateKeys(productContext);

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
    if (!isOpen) return;
    if (editState) {
      setStep("configure");
      setSelectedProduct({ id: editState.productId, name: editState.productName } as Product);
      setConfig({ ...DEFAULT_PRODUCT_BOX_CONFIG, ...editState.config });
      setSearchQuery("");
      setSearchResults([]);
      setFetchedProduct(null);
      setFetchingProduct(true);
    } else {
      setStep("search");
      setSelectedProduct(null);
      setFetchedProduct(null);
      setFetchingProduct(false);
      setConfig({ ...DEFAULT_PRODUCT_BOX_CONFIG });
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [isOpen, editState]);

  useEffect(() => {
    if (!isOpen || !editState?.productId) return;
    let cancelled = false;
    setFetchingProduct(true);
    getProductById(editState.productId).then((product) => {
      if (cancelled) return;
      setFetchedProduct(product ?? null);
      setFetchingProduct(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, editState?.productId]);

  useEffect(() => {
    if (!productContext?.award_id) {
      setProductAward(null);
      return;
    }
    let cancelled = false;
    getAwardById(productContext.award_id).then((a) => {
      if (!cancelled) setProductAward(a ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [productContext?.award_id]);

  useEffect(() => {
    if (!isOpen || editState) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(searchQuery);
      debounceRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isOpen, editState, searchQuery, runSearch]);

  const handleSelectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    const keys = getSpecKeys(product);
    const affKeys = getAffiliateKeys(product);
    setConfig({
      ...DEFAULT_PRODUCT_BOX_CONFIG,
      showKeySpecs: true,
      keySpecKeys: keys,
      showImage: true,
      imageType: "transparent",
      showReleaseDate: true,
      showAward: true,
      includeAffiliateButtons: true,
      selectedAffiliates: affKeys,
    });
    setStep("configure");
  }, []);

  const handleBack = useCallback(() => {
    setStep("search");
    setSelectedProduct(null);
    setConfig({ ...DEFAULT_PRODUCT_BOX_CONFIG });
  }, []);

  const handleInsert = useCallback(() => {
    const product = productContext ?? selectedProduct;
    if (!product) return;
    onInsert({
      productId: product.id,
      productName: product.name ?? editState?.productName ?? "",
      config,
    });
    onClose();
  }, [productContext, selectedProduct, editState?.productName, config, onInsert, onClose]);

  const toggleKeySpec = useCallback((key: string) => {
    setConfig((prev) => {
      const current = prev.keySpecKeys ?? [];
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...prev, keySpecKeys: next };
    });
  }, []);

  const handleInsertSpecsChange = useCallback(
    (checked: boolean) => {
      setConfig((prev) => ({
        ...prev,
        showKeySpecs: checked,
        keySpecKeys: checked ? specKeys : [],
      }));
    },
    [specKeys]
  );

  const handleIncludeAffiliateButtonsChange = useCallback(
    (checked: boolean) => {
      setConfig((prev) => ({
        ...prev,
        includeAffiliateButtons: checked,
        selectedAffiliates: checked ? affiliateKeys : [],
      }));
    },
    [affiliateKeys]
  );

  const toggleAffiliate = useCallback((key: string) => {
    setConfig((prev) => {
      const current = prev.selectedAffiliates ?? [];
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...prev, selectedAffiliates: next };
    });
  }, []);

  const openGlobalEditDrawer = useCallback(async () => {
    if (!productContext) return;
    setDrawerOpen(true);
    const [templates, categories, awards] = await Promise.all([
      getTemplates(),
      getCategories(),
      getAwards(),
    ]);
    setDrawerTemplates(templates);
    setDrawerCategories(categories);
    setDrawerAwards(awards);
  }, [productContext]);

  const handleGlobalEditSaved = useCallback(() => {
    if (!productContext?.id) return;
    getProductById(productContext.id).then((p) => {
      setFetchedProduct(p ?? null);
      setDrawerOpen(false);
    });
  }, [productContext?.id]);

  if (!isOpen) return null;

  const productName = productContext?.name ?? editState?.productName ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-lg border border-white/10 bg-hot-gray shadow-xl">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="font-sans text-lg font-semibold text-hot-white">
            {step === "search" ? "Insert Product Box" : "Configure Product Box"}
          </h2>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
          {step === "search" && (
            <>
              <div>
                <label className="block font-sans text-sm font-medium text-gray-400 mb-1">
                  Search products
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Name or brand…"
                  className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="min-h-[120px] rounded-md border border-white/10 bg-white/5">
                {searching ? (
                  <div className="px-3 py-6 text-center text-sm text-gray-400">Searching…</div>
                ) : searchQuery.trim() ? (
                  searchResults.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-gray-400">No products found.</div>
                  ) : (
                    <ul className="divide-y divide-white/10 max-h-48 overflow-y-auto">
                      {searchResults.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectProduct(p)}
                            className="w-full px-3 py-2.5 text-left text-sm text-hot-white hover:bg-white/10"
                          >
                            <span className="font-medium">{p.name}</span>
                            {p.brand && (
                              <span className="ml-2 text-gray-400">{p.brand}</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-gray-400">
                    Type to search for a product.
                  </div>
                )}
              </div>
            </>
          )}

          {step === "configure" && (
            <>
              <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-3">
                <div>
                  <p className="font-sans text-base font-semibold text-hot-white">
                    {fetchingProduct ? "Loading product…" : productName || "Product"}
                  </p>
                  {!editState && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="mt-1 text-xs text-gray-400 hover:text-hot-white"
                    >
                      ← Change product
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openGlobalEditDrawer}
                  disabled={!productContext}
                  className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                  title="Edit global product data"
                >
                  <Database className="h-3.5 w-3.5" />
                  Edit Global Product Data
                </button>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showImage ?? true}
                    onChange={(e) => setConfig((c) => ({ ...c, showImage: e.target.checked }))}
                    className="rounded border-white/20"
                  />
                  <span className="font-sans text-sm text-hot-white">Show Image</span>
                </label>
                {(config.showImage ?? true) && (
                  <div className="ml-6 flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="imageType"
                        checked={(config.imageType ?? "transparent") === "transparent"}
                        onChange={() => setConfig((c) => ({ ...c, imageType: "transparent" as ProductBoxImageType }))}
                        className="rounded-full border-white/20"
                      />
                      <span className="font-sans text-sm text-gray-300">Product (Transparent)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="imageType"
                        checked={(config.imageType ?? "transparent") === "hero"}
                        onChange={() => setConfig((c) => ({ ...c, imageType: "hero" as ProductBoxImageType }))}
                        className="rounded-full border-white/20"
                      />
                      <span className="font-sans text-sm text-gray-300">Lifestyle (Hero)</span>
                    </label>
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showAward ?? true}
                    onChange={(e) => setConfig((c) => ({ ...c, showAward: e.target.checked }))}
                    className="rounded border-white/20"
                  />
                  <span className="font-sans text-sm text-hot-white">Show Award Badge</span>
                  {productAward && (
                    <span className="text-xs text-gray-500">
                      ({productAward.name})
                    </span>
                  )}
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showStarRating ?? true}
                    onChange={(e) => setConfig((c) => ({ ...c, showStarRating: e.target.checked }))}
                    className="rounded border-white/20"
                  />
                  <span className="font-sans text-sm text-hot-white">Show Star Rating</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showProsCons ?? true}
                    onChange={(e) => setConfig((c) => ({ ...c, showProsCons: e.target.checked }))}
                    className="rounded border-white/20"
                  />
                  <span className="font-sans text-sm text-hot-white">Show Pros & Cons</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showKeySpecs ?? true}
                    onChange={(e) => handleInsertSpecsChange(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  <span className="font-sans text-sm text-hot-white">Insert Specs</span>
                </label>
                {config.showKeySpecs && specKeys.length > 0 && (
                  <div className="ml-6 space-y-1.5">
                    <p className="text-xs text-gray-500">Uncheck specs to hide them:</p>
                    {specKeys.map((key) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(config.keySpecKeys ?? []).includes(key)}
                          onChange={() => toggleKeySpec(key)}
                          className="rounded border-white/20"
                        />
                        <span className="font-sans text-sm text-gray-300">{key}</span>
                      </label>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeAffiliateButtons ?? true}
                    onChange={(e) => handleIncludeAffiliateButtonsChange(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  <span className="font-sans text-sm text-hot-white">Include Affiliate &quot;Buy&quot; Buttons</span>
                </label>
                {(config.includeAffiliateButtons ?? true) && affiliateKeys.length > 0 && (
                  <div className="ml-6 space-y-1.5">
                    <p className="text-xs text-gray-500">Uncheck to hide:</p>
                    {affiliateKeys.map((key) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(config.selectedAffiliates ?? []).includes(key)}
                          onChange={() => toggleAffiliate(key)}
                          className="rounded border-white/20"
                        />
                        <span className="font-sans text-sm text-gray-300">{key}</span>
                      </label>
                    ))}
                  </div>
                )}

                <div>
                  {productContext?.editorial_data?.bottom_line != null &&
                    String(productContext.editorial_data.bottom_line).trim() !== "" && (
                    <div className="mb-3 rounded-md border border-white/10 bg-white/5 overflow-hidden">
                      <div className="flex items-center justify-end gap-2 border-b border-white/10 bg-white/5 px-2 py-1">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                          Global Reference (Read-only)
                        </span>
                      </div>
                      <div
                        className="max-h-24 overflow-y-auto px-3 py-2 font-mono text-xs italic text-gray-400"
                        aria-readonly
                      >
                        {productContext.editorial_data.bottom_line}
                      </div>
                    </div>
                  )}
                  <label className="block font-sans text-sm font-medium text-gray-400 mb-1">
                    Post-Specific Bottom Line
                  </label>
                  <textarea
                    value={config.descriptionOverride ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, descriptionOverride: e.target.value }))}
                    placeholder="Override for this post only…"
                    rows={3}
                    className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none resize-y"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    If left blank, the global &quot;Bottom Line&quot; from the database will be used.
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showReleaseDate ?? true}
                    onChange={(e) => setConfig((c) => ({ ...c, showReleaseDate: e.target.checked }))}
                    className="rounded border-white/20"
                  />
                  <span className="font-sans text-sm text-hot-white">Show Release Date</span>
                </label>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/20 px-3 py-2 font-sans text-sm text-gray-400 hover:bg-white/5 hover:text-hot-white"
          >
            Cancel
          </button>
          {step === "configure" && (
            <button
              type="button"
              onClick={handleInsert}
              className="rounded-md bg-hot-white px-3 py-2 font-sans text-sm font-medium text-hot-black hover:bg-hot-white/90"
            >
              {editState ? "Update" : "Insert"}
            </button>
          )}
        </div>
      </div>

      {drawerOpen && productContext && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="relative ml-auto w-full max-w-2xl max-h-full overflow-hidden flex flex-col bg-hot-gray border-l border-white/10 shadow-2xl">
            <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2">
              <p className="font-sans text-sm font-medium text-amber-200">
                Caution: You are editing the Global Master Entry. Changes here reflect across the entire site.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ProductForm
                product={productContext}
                templates={drawerTemplates}
                categories={drawerCategories}
                awards={drawerAwards}
                onSuccess={handleGlobalEditSaved}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
