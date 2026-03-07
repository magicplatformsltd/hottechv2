"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Database } from "lucide-react";
import { searchProducts, getProductById } from "@/lib/actions/product";
import { getTemplates } from "@/lib/actions/template";
import { getCategories } from "@/lib/actions/categories";
import { getAwards, getAwardById } from "@/lib/actions/award";
import type { ProductAwardRecord } from "@/lib/types/award";
import type { Product } from "@/lib/types/product";
import { getFlattenedSpecs } from "@/lib/types/product";
import type { ProductBoxConfig, ProductBoxImageType, ProductBoxTemplate } from "./extensions/ProductBox";
import { DEFAULT_PRODUCT_BOX_CONFIG } from "./extensions/ProductBox";
import { ProductForm } from "@/components/admin/ProductForm";
import { CURRENCY_OPTIONS } from "@/lib/constants/currencies";

const SEARCH_DEBOUNCE_MS = 300;

/** Full product context: from search selection or from fetch in edit mode. */
function getSpecKeys(product: Product | null): string[] {
  const flat = getFlattenedSpecs(product?.specs);
  return Object.keys(flat).filter(Boolean);
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

/** Strictly parse boolean from node attrs (handles string "true"/"false" from HTML). */
function isTrue(val: unknown, defaultVal: boolean): boolean {
  return val === undefined ? defaultVal : val === true || val === "true";
}

export type ProductBoxInsertPayload = {
  productId: string;
  productName: string;
  config: ProductBoxConfig;
  template?: ProductBoxTemplate;
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
};

type ProductInjectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (payload: ProductBoxInsertPayload) => void;
  /** When set, open in "edit" mode with this node's data (config step only). */
  editState?: ProductBoxInsertPayload | null;
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
  const [template, setTemplate] = useState<ProductBoxTemplate>("full_card");
  const [show_image, setShow_image] = useState(true);
  const [show_award, setShow_award] = useState(true);
  const [show_specs, setShow_specs] = useState(true);
  const [show_breakdown, setShow_breakdown] = useState(true);
  const [show_pros_cons, setShow_pros_cons] = useState(true);
  const [custom_pros, setCustom_pros] = useState("");
  const [custom_cons, setCustom_cons] = useState("");
  const [show_buy_if, setShow_buy_if] = useState(false);
  const [show_bottom_line, setShow_bottom_line] = useState(true);
  const [show_star_rating, setShow_star_rating] = useState(true);
  const [custom_buy_if, setCustom_buy_if] = useState("");
  const [custom_dont_buy_if, setCustom_dont_buy_if] = useState("");
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
      setTemplate(editState.template ?? "full_card");
      setShow_image(isTrue(editState.show_image, true));
      setShow_award(isTrue(editState.show_award, true));
      setShow_specs(isTrue(editState.show_specs, true));
      setShow_breakdown(isTrue(editState.show_breakdown, true));
      setShow_pros_cons(isTrue(editState.show_pros_cons, true));
      setShow_buy_if(isTrue(editState.show_buy_if, false));
      setShow_bottom_line(isTrue(editState.show_bottom_line, true));
      setShow_star_rating(isTrue(editState.show_star_rating, true));
      try {
        const rawBuyIf = editState.custom_buy_if;
        if (Array.isArray(rawBuyIf)) {
          setCustom_buy_if(rawBuyIf.join("\n"));
        } else if (typeof rawBuyIf === "string") {
          const parsed = JSON.parse(rawBuyIf);
          setCustom_buy_if(Array.isArray(parsed) ? parsed.join("\n") : rawBuyIf);
        } else {
          setCustom_buy_if("");
        }
      } catch {
        setCustom_buy_if(typeof editState.custom_buy_if === "string" ? editState.custom_buy_if : "");
      }
      try {
        const rawDontBuyIf = editState.custom_dont_buy_if;
        if (Array.isArray(rawDontBuyIf)) {
          setCustom_dont_buy_if(rawDontBuyIf.join("\n"));
        } else if (typeof rawDontBuyIf === "string") {
          const parsed = JSON.parse(rawDontBuyIf);
          setCustom_dont_buy_if(Array.isArray(parsed) ? parsed.join("\n") : rawDontBuyIf);
        } else {
          setCustom_dont_buy_if("");
        }
      } catch {
        setCustom_dont_buy_if(typeof editState.custom_dont_buy_if === "string" ? editState.custom_dont_buy_if : "");
      }
      try {
        const rawPros = editState.custom_pros;
        if (Array.isArray(rawPros)) {
          setCustom_pros(rawPros.join("\n"));
        } else if (typeof rawPros === "string") {
          const parsed = JSON.parse(rawPros);
          setCustom_pros(Array.isArray(parsed) ? parsed.join("\n") : rawPros);
        } else {
          setCustom_pros("");
        }
      } catch {
        setCustom_pros(typeof editState.custom_pros === "string" ? editState.custom_pros : "");
      }
      try {
        const rawCons = editState.custom_cons;
        if (Array.isArray(rawCons)) {
          setCustom_cons(rawCons.join("\n"));
        } else if (typeof rawCons === "string") {
          const parsed = JSON.parse(rawCons);
          setCustom_cons(Array.isArray(parsed) ? parsed.join("\n") : rawCons);
        } else {
          setCustom_cons("");
        }
      } catch {
        setCustom_cons(typeof editState.custom_cons === "string" ? editState.custom_cons : "");
      }
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
      setTemplate("full_card");
      setShow_image(true);
      setShow_award(true);
      setShow_specs(true);
      setShow_breakdown(true);
      setShow_pros_cons(true);
      setShow_buy_if(false);
      setShow_bottom_line(true);
      setShow_star_rating(true);
      setCustom_pros("");
      setCustom_cons("");
      setCustom_buy_if("");
      setCustom_dont_buy_if("");
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
    setTemplate("full_card");
    setShow_image(true);
    setShow_award(true);
    setShow_specs(true);
    setShow_breakdown(true);
    setShow_pros_cons(true);
    setShow_buy_if(false);
    setShow_bottom_line(true);
    setShow_star_rating(true);
    setCustom_pros("");
    setCustom_cons("");
    setCustom_buy_if("");
    setCustom_dont_buy_if("");
    setStep("configure");
  }, []);

  const handleTemplateChange = useCallback((templateId: ProductBoxTemplate) => {
    setTemplate(templateId);
    if (templateId === "full_card") {
      setShow_image(true);
      setShow_award(true);
      setShow_specs(true);
      setShow_breakdown(true);
      setShow_pros_cons(true);
      setShow_buy_if(false);
    } else if (templateId === "compact") {
      setShow_image(true);
      setShow_award(true);
      setShow_specs(false);
      setShow_breakdown(false);
      setShow_pros_cons(false);
      setShow_buy_if(false);
    } else if (templateId === "spec_sheet") {
      setShow_image(false);
      setShow_award(false);
      setShow_specs(true);
      setShow_breakdown(false);
      setShow_pros_cons(false);
      setShow_buy_if(false);
    } else if (templateId === "buy_if_block") {
      setShow_image(false);
      setShow_award(false);
      setShow_specs(false);
      setShow_breakdown(false);
      setShow_pros_cons(false);
      setShow_buy_if(true);
      setShow_bottom_line(false);
      setShow_star_rating(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    setStep("search");
    setSelectedProduct(null);
    setConfig({ ...DEFAULT_PRODUCT_BOX_CONFIG });
  }, []);

  const handleInsert = useCallback(() => {
    const product = productContext ?? selectedProduct;
    if (!product) return;
    const prosTrimmed = custom_pros.trim();
    const consTrimmed = custom_cons.trim();
    const buyIfTrimmed = custom_buy_if.trim();
    const dontBuyIfTrimmed = custom_dont_buy_if.trim();
    onInsert({
      productId: product.id,
      productName: product.name ?? editState?.productName ?? "",
      config,
      template,
      show_image,
      show_award,
      show_specs,
      show_breakdown,
      show_pros_cons,
      show_buy_if,
      show_bottom_line,
      show_star_rating,
      custom_pros: prosTrimmed ? JSON.stringify(prosTrimmed.split(/\n/).map((s) => s.trim()).filter(Boolean)) : null,
      custom_cons: consTrimmed ? JSON.stringify(consTrimmed.split(/\n/).map((s) => s.trim()).filter(Boolean)) : null,
      custom_buy_if: buyIfTrimmed ? JSON.stringify(buyIfTrimmed.split(/\n/).map((s) => s.trim()).filter(Boolean)) : null,
      custom_dont_buy_if: dontBuyIfTrimmed ? JSON.stringify(dontBuyIfTrimmed.split(/\n/).map((s) => s.trim()).filter(Boolean)) : null,
    });
    onClose();
  }, [productContext, selectedProduct, editState?.productName, config, template, show_image, show_award, show_specs, show_breakdown, show_pros_cons, show_buy_if, show_bottom_line, show_star_rating, custom_pros, custom_cons, custom_buy_if, custom_dont_buy_if, onInsert, onClose]);

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

              <div>
                <label className="block font-sans text-sm font-medium text-gray-400 mb-1">
                  Display Template
                </label>
                <select
                  value={template}
                  onChange={(e) => handleTemplateChange(e.target.value as ProductBoxTemplate)}
                  className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white focus:border-hot-white/50 focus:outline-none"
                >
                  <option value="full_card">Full Review</option>
                  <option value="compact">Compact Deal</option>
                  <option value="spec_sheet">Spec Sheet</option>
                  <option value="buy_if_block">Buy If / Don&apos;t Buy If Block</option>
                </select>
              </div>

              <details className="w-full border border-white/10 rounded-lg mt-4 overflow-hidden" open>
                <summary className="font-bold cursor-pointer p-4 bg-white/5 hover:bg-white/10 list-none flex items-center gap-2">
                  <span>⚙️ Customize Fields & Overrides</span>
                </summary>
                <div className="p-4 pt-0 space-y-3 border-t border-white/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={show_image}
                        onChange={(e) => setShow_image(e.target.checked)}
                        className="rounded border-white/20"
                      />
                      <span className="font-sans text-sm text-hot-white">Show Image</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={show_award}
                        onChange={(e) => setShow_award(e.target.checked)}
                        className="rounded border-white/20"
                      />
                      <span className="font-sans text-sm text-hot-white">Show Award</span>
                      {productAward && <span className="text-xs text-gray-500">({productAward.name})</span>}
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={show_specs}
                        onChange={(e) => setShow_specs(e.target.checked)}
                        className="rounded border-white/20"
                      />
                      <span className="font-sans text-sm text-hot-white">Show Specs</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={show_breakdown}
                        onChange={(e) => setShow_breakdown(e.target.checked)}
                        className="rounded border-white/20"
                      />
                      <span className="font-sans text-sm text-hot-white">Show Breakdown</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={show_pros_cons}
                        onChange={(e) => setShow_pros_cons(e.target.checked)}
                        className="rounded border-white/20"
                      />
                      <span className="font-sans text-sm text-hot-white">Show Pros/Cons</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={show_star_rating}
                        onChange={(e) => setShow_star_rating(e.target.checked)}
                        className="rounded border-white/20"
                      />
                      <span className="font-sans text-sm text-hot-white">Show Star Rating</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={show_buy_if}
                        onChange={(e) => setShow_buy_if(e.target.checked)}
                        className="rounded border-white/20"
                      />
                      <span className="font-sans text-sm text-hot-white">Show Buying Advice</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={show_bottom_line}
                        onChange={(e) => setShow_bottom_line(e.target.checked)}
                        className="rounded border-white/20"
                      />
                      <span className="font-sans text-sm text-hot-white">Show Bottom Line</span>
                    </label>
                  </div>

                  {show_image && (
                    <div className="ml-0 flex gap-4">
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

                  {show_specs && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-500">Key specs to include:</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
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
                        {specKeys.length === 0 && <span className="text-xs text-gray-500">No specs on product.</span>}
                      </div>
                    </div>
                  )}

                  <div>
                    {productContext?.editorial_data?.bottom_line != null &&
                      String(productContext.editorial_data.bottom_line).trim() !== "" && (
                      <div className="mb-2 rounded-md border border-white/10 bg-white/5 overflow-hidden">
                        <div className="flex items-center justify-end gap-2 border-b border-white/10 bg-white/5 px-2 py-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                            Global Reference (Read-only)
                          </span>
                        </div>
                        <div className="max-h-24 overflow-y-auto px-3 py-2 font-mono text-xs italic text-gray-400" aria-readonly>
                          {productContext.editorial_data.bottom_line}
                        </div>
                      </div>
                    )}
                    <label className="block font-sans text-sm font-medium text-gray-400 mb-1">Post-Specific Bottom Line</label>
                    <textarea
                      value={config.descriptionOverride ?? ""}
                      onChange={(e) => setConfig((c) => ({ ...c, descriptionOverride: e.target.value }))}
                      placeholder="Override for this post only…"
                      rows={2}
                      className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none resize-y"
                    />
                  </div>

                  {show_pros_cons && (
                    <>
                      <div>
                        <label className="block font-sans text-sm font-medium text-gray-400 mb-1">Custom Pros Override</label>
                        <textarea
                          value={custom_pros}
                          onChange={(e) => setCustom_pros(e.target.value)}
                          placeholder="One per line (leave blank to use global pros)"
                          rows={2}
                          className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none resize-y"
                        />
                      </div>
                      <div>
                        <label className="block font-sans text-sm font-medium text-gray-400 mb-1">Custom Cons Override</label>
                        <textarea
                          value={custom_cons}
                          onChange={(e) => setCustom_cons(e.target.value)}
                          placeholder="One per line (leave blank to use global cons)"
                          rows={2}
                          className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none resize-y"
                        />
                      </div>
                    </>
                  )}

                  {show_buy_if && (
                    <>
                      {(productContext?.editorial_data?.buy_if?.length || productContext?.editorial_data?.dont_buy_if?.length) ? (
                        <div className="rounded-md border border-white/10 bg-white/5 overflow-hidden">
                          <div className="flex items-center justify-end gap-2 border-b border-white/10 bg-white/5 px-2 py-1">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                              GLOBAL REFERENCE
                            </span>
                          </div>
                          <div className="px-3 py-2 space-y-2">
                            {productContext?.editorial_data?.buy_if?.length ? (
                              <div>
                                <span className="text-[10px] font-medium uppercase text-gray-500">Buy If:</span>
                                <ul className="mt-0.5 font-mono text-xs italic text-gray-400 list-disc list-inside">
                                  {productContext.editorial_data.buy_if.map((s, i) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {productContext?.editorial_data?.dont_buy_if?.length ? (
                              <div>
                                <span className="text-[10px] font-medium uppercase text-gray-500">Don&apos;t Buy If:</span>
                                <ul className="mt-0.5 font-mono text-xs italic text-gray-400 list-disc list-inside">
                                  {productContext.editorial_data.dont_buy_if.map((s, i) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      <div>
                        <label className="block font-sans text-sm font-medium text-gray-400 mb-1">Custom &quot;Buy If&quot; Override</label>
                        <textarea
                          value={custom_buy_if}
                          onChange={(e) => setCustom_buy_if(e.target.value)}
                          placeholder="One per line (leave blank to use global Buy If)"
                          rows={2}
                          className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none resize-y"
                        />
                      </div>
                      <div>
                        <label className="block font-sans text-sm font-medium text-gray-400 mb-1">Custom &quot;Don&apos;t Buy If&quot; Override</label>
                        <textarea
                          value={custom_dont_buy_if}
                          onChange={(e) => setCustom_dont_buy_if(e.target.value)}
                          placeholder="One per line (leave blank to use global Don't Buy If)"
                          rows={2}
                          className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 font-sans text-sm text-hot-white placeholder:text-gray-500 focus:border-hot-white/50 focus:outline-none resize-y"
                        />
                      </div>
                    </>
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
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Optional: price, currency, CTA text, and visibility per retailer.</p>
                      {affiliateKeys.map((key) => {
                        const selected = (config.selectedAffiliates ?? []).includes(key);
                        const row = (config.affiliatePriceOverrides ?? {})[key] ?? {};
                        const showPrice = row.show_price !== false;
                        const showRetailer = row.show_retailer !== false;
                        return (
                          <div key={key} className="rounded border border-white/10 bg-white/5 p-2 space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleAffiliate(key)}
                                className="rounded border-white/20"
                              />
                              <span className="font-sans text-sm text-gray-300">{key}</span>
                            </label>
                            {selected && (
                              <div className="pl-6 space-y-2">
                                <input
                                  type="text"
                                  value={row.cta_text ?? ""}
                                  onChange={(e) =>
                                    setConfig((c) => ({
                                      ...c,
                                      affiliatePriceOverrides: {
                                        ...(c.affiliatePriceOverrides ?? {}),
                                        [key]: { ...(c.affiliatePriceOverrides?.[key] ?? {}), cta_text: e.target.value },
                                      },
                                    }))
                                  }
                                  placeholder="CTA text (e.g. Buy now)"
                                  className="w-full rounded border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-hot-white placeholder:text-gray-500"
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="text"
                                    value={row.price_amount ?? ""}
                                    onChange={(e) =>
                                      setConfig((c) => ({
                                        ...c,
                                        affiliatePriceOverrides: {
                                          ...(c.affiliatePriceOverrides ?? {}),
                                          [key]: { ...(c.affiliatePriceOverrides?.[key] ?? {}), price_amount: e.target.value },
                                        },
                                      }))
                                    }
                                    placeholder="Price (e.g. 49.99)"
                                    className="flex-1 min-w-[80px] rounded border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-hot-white placeholder:text-gray-500"
                                  />
                                  <select
                                    value={row.price_currency ?? ""}
                                    onChange={(e) =>
                                      setConfig((c) => ({
                                        ...c,
                                        affiliatePriceOverrides: {
                                          ...(c.affiliatePriceOverrides ?? {}),
                                          [key]: { ...(c.affiliatePriceOverrides?.[key] ?? {}), price_currency: e.target.value },
                                        },
                                      }))
                                    }
                                    className="rounded border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-hot-white"
                                    title="Currency"
                                  >
                                    <option value="">Currency</option>
                                    {CURRENCY_OPTIONS.map((opt) => (
                                      <option key={opt.code} value={opt.code}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={showPrice}
                                      onChange={(e) =>
                                        setConfig((c) => ({
                                          ...c,
                                          affiliatePriceOverrides: {
                                            ...(c.affiliatePriceOverrides ?? {}),
                                            [key]: { ...(c.affiliatePriceOverrides?.[key] ?? {}), show_price: e.target.checked },
                                          },
                                        }))
                                      }
                                      className="rounded border-white/20"
                                    />
                                    <span className="font-sans text-xs text-gray-400">Show price</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={showRetailer}
                                      onChange={(e) =>
                                        setConfig((c) => ({
                                          ...c,
                                          affiliatePriceOverrides: {
                                            ...(c.affiliatePriceOverrides ?? {}),
                                            [key]: { ...(c.affiliatePriceOverrides?.[key] ?? {}), show_retailer: e.target.checked },
                                          },
                                        }))
                                      }
                                      className="rounded border-white/20"
                                    />
                                    <span className="font-sans text-xs text-gray-400">Show retailer</span>
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

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
              </details>
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
