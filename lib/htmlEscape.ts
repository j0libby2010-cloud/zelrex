/**
 * XSS protection helpers for buildPreviewHtml in ChatPageClient.tsx
 * and any other code that interpolates user/AI content into HTML strings.
 *
 * Import these into ChatPageClient.tsx:
 *   import { esc, escUrl, escColor, escJs } from '@/lib/htmlEscape';
 */

/**
 * Escape user content for safe HTML interpolation.
 * Handles all 5 critical characters: & < > " '
 *
 * Use for any text content that goes between HTML tags or into HTML attributes.
 *
 * Example:
 *   `<div>${esc(item.title)}</div>`
 *   `<input value="${esc(input.value)}">`
 */
export function esc(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape a URL for safe interpolation into href/src attributes.
 * Rejects javascript:, vbscript:, file:, and non-image data: URLs.
 *
 * Example:
 *   `<a href="${escUrl(method.href)}">`
 *   `<a href="mailto:${escUrl(email)}">`
 */
export function escUrl(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  // Block dangerous URL schemes
  if (/^(?:javascript|vbscript|file):/i.test(str)) return "";
  if (/^data:(?!image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);)/i.test(str)) return "";
  // Encode the dangerous characters that could break out of attribute
  return str
    .replace(/\"/g, "%22")
    .replace(/'/g, "%27")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E");
}

/**
 * Validate and return a hex color, or fall back to a safe default.
 * Use this ONCE per color value, then it's safe to interpolate raw.
 *
 * Example:
 *   const accent = escColor(site.branding?.primaryColor, '#4A90FF');
 *   // Now `${accent}` is safe in any context
 */
export function escColor(val: any, fallback = "#4A90FF"): string {
  if (typeof val !== "string") return fallback;
  const trimmed = val.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return fallback;
  return trimmed;
}

/**
 * Escape user content for safe interpolation into a JavaScript string literal.
 * Use ONLY inside <script> tags. For HTML interpolation, use esc() instead.
 *
 * BEST PRACTICE: When possible, use JSON.stringify(value) instead of escJs().
 * JSON.stringify produces a properly quoted JS string and handles all edge
 * cases including unicode.
 *
 * Example with JSON.stringify (preferred):
 *   `<script>var name = ${JSON.stringify(name)};</script>`
 *
 * Example with escJs (when you need to interpolate INSIDE quotes):
 *   `<script>var name = '${escJs(name)}';</script>`
 */
export function escJs(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/<\/script>/gi, "<\\/script>")
    .replace(/<!--/g, "<\\!--");
}

/**
 * Escape an entire object's string values for safe interpolation.
 * Useful when you have a complex object and want to escape it all at once
 * before passing to template literals.
 *
 * Returns a new object with all string values escaped (deep, recursive).
 *
 * Example:
 *   const safeCopy = escDeep(websiteCopy);
 *   `<h1>${safeCopy.home.hero.headline}</h1>`
 */
export function escDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return esc(obj) as any;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => escDeep(item)) as any;
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = escDeep((obj as any)[key]);
    }
  }
  return result;
}
