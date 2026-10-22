/**
 * Indian mobile number from what was typed: spaces, dashes, +91 or a leading 0 are dropped.
 * Returns the 10 digits, "" when nothing was typed, or null when it isn't a real mobile number.
 */
export function cleanPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "").replace(/^(\+?91|0)(?=\d{10}$)/, "");
  if (!digits) return "";
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const PHONE_ERROR = "Phone should be a 10-digit mobile number";
