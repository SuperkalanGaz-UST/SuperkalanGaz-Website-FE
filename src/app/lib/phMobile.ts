/**
 * Philippine mobile-number helpers (AGENTS.md §16).
 *
 * Canonical stored form is E.164: `+63` + the 10-digit national number (which
 * always starts with 9), matching `^\+639\d{9}$` — no spaces, dashes, leading 0,
 * or doubled +63. The UI masks input to `+63 9XX XXX XXXX` for readability, then
 * converts to E.164 via {@link toE164PhMobile} before sending to the API.
 */

/**
 * Normalizes any Philippine mobile input to the canonical +63 country-code form.
 *
 * Accepts whatever the user (or a paste) throws at it — `0917…`, `917…`,
 * `+63 917…`, `63917…` — strips everything down to the 10 national digits
 * (which always start with 9), then re-emits it grouped as `+63 9XX XXX XXXX`.
 * Typing `09` therefore becomes `+63 9…` live in the field. The stored value is
 * just this string; strip the spaces at submit time if the API wants raw digits.
 */
export function formatPHMobile(raw: string): string {
  let digits = raw.replace(/\D/g, ''); // keep digits only

  // Peel off a leading country code (63) or trunk prefix (0) so we're always
  // left with the 10-digit national number.
  if (digits.startsWith('63')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  digits = digits.slice(0, 10); // PH mobile national numbers are exactly 10 digits
  if (digits === '') return '';

  // Group as +63 9XX XXX XXXX, dropping trailing empty groups while still typing.
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
  return `+63 ${groups.join(' ')}`.trimEnd();
}

/**
 * Reduces any PH mobile input to its 10 national digits (the +63 prefix is NOT
 * part of them). Strips spaces/dashes and peels a leading +63 / 63 / 0 so a
 * pasted full number collapses to the same digits as a hand-typed one. Does not
 * validate — callers gate on the ^9\d{9}$ shape.
 */
export function nationalPhDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('63')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10); // PH mobile national numbers are exactly 10 digits
}

/**
 * Normalizes a PH mobile input to its canonical national digits, or null if it
 * isn't a valid PH mobile number. Store E.164 as `+63` + this result.
 */
export function normalizePhMobile(raw: string): string | null {
  const digits = nationalPhDigits(raw);
  return /^9\d{9}$/.test(digits) ? digits : null;
}

/**
 * Cosmetic live formatter for the editable part of the mobile field: national
 * digits only, capped at 10, grouped as `9XX XXX XXXX`. The fixed `+63` prefix
 * is rendered separately, so it is deliberately absent here.
 */
export function formatPhMobileNational(raw: string): string {
  const digits = nationalPhDigits(raw);
  if (digits === '') return '';
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
  return groups.join(' ');
}

/**
 * Converts any PH mobile input to canonical E.164 (`+639XXXXXXXXX`), or null if
 * the input isn't a valid PH mobile number. This — not the spaced display
 * string — is what the API expects (server validates `^\+639\d{9}$`).
 */
export function toE164PhMobile(raw: string): string | null {
  const digits = normalizePhMobile(raw);
  return digits ? `+63${digits}` : null;
}
