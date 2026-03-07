/**
 * Global currency options and defaults for pricing and affiliate links.
 * USD is the hardcoded default when currency is missing or empty.
 */

export const DEFAULT_CURRENCY_CODE = "USD";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  CAD: "C$",
  CNY: "¥",
  JPY: "¥",
  INR: "₹",
  AED: "د.إ",
};

export type CurrencyOption = { symbol: string; code: string; label: string };

/** Options for dropdowns: display label includes symbol and code (no duplicate labels). */
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { symbol: "$", code: "USD", label: "$ (USD)" },
  { symbol: "£", code: "GBP", label: "£ (GBP)" },
  { symbol: "€", code: "EUR", label: "€ (EUR)" },
  { symbol: "C$", code: "CAD", label: "C$ (CAD)" },
  { symbol: "¥", code: "CNY", label: "¥ (CNY)" },
  { symbol: "¥", code: "JPY", label: "¥ (JPY)" },
  { symbol: "₹", code: "INR", label: "₹ (INR)" },
  { symbol: "د.إ", code: "AED", label: "د.إ (AED)" },
];

/** Symbol for display; defaults to $ (USD) when code is missing or empty. */
export function getCurrencySymbol(code: string | undefined): string {
  const c = (code ?? "").trim();
  if (!c) return CURRENCY_SYMBOLS[DEFAULT_CURRENCY_CODE] ?? "$";
  return CURRENCY_SYMBOLS[c] ?? c + " ";
}
