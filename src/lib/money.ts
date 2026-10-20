/** "1,23,456.78" → 12345678 paise. Returns null for empty, negative, non-numeric or >2 decimals. */
export function rupeesToPaise(input: string): number | null {
  const s = input.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 12345678 → "₹1,23,456.78"; negatives as "-₹198.00". */
export function formatINR(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  return `${sign}₹${fmt.format(Math.abs(paise) / 100)}`;
}
