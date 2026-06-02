const SAFE_HREF_PATTERN = /^(\/(?!\/)|#|https:\/\/|http:\/\/|mailto:|tel:)/i;
const SAFE_ASSET_URL_PATTERN = /^(\/(?!\/)|https:\/\/|http:\/\/)/i;
const UNSAFE_HTML_PATTERN = /<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi;
const EVENT_ATTR_PATTERN = /\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const STYLE_ATTR_PATTERN = /\s+style\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const UNSAFE_ATTR_PATTERN = /\s+(href|src|srcset|formaction|poster|xlink:href)\s*=\s*(['"]?)\s*(javascript:|data:text\/html|vbscript:)[^'"\s>]*/gi;

export function safeCmsHref(href: string | null | undefined) {
  const value = href?.trim() ?? "";
  return SAFE_HREF_PATTERN.test(value) ? value : "";
}

export function isExternalCmsHref(href: string) {
  return /^(https?:|mailto:|tel:)/i.test(href);
}

export function safeCmsAssetUrl(url: string | null | undefined) {
  const value = url?.trim() ?? "";
  return SAFE_ASSET_URL_PATTERN.test(value) ? value : "";
}

export function safeCmsCanonicalUrl(url: string | null | undefined, fallbackUrl: string) {
  const value = url?.trim() ?? "";

  if (!value) return fallbackUrl;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

export function sanitizeCmsHtml(html: string | null | undefined) {
  const value = html ?? "";
  return value
    .replace(UNSAFE_HTML_PATTERN, "")
    .replace(EVENT_ATTR_PATTERN, "")
    .replace(STYLE_ATTR_PATTERN, "")
    .replace(UNSAFE_ATTR_PATTERN, "");
}
