import { createContext, createElement, useContext, useEffect, type ReactNode } from "react";

type PageMetaOptions = {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  twitterCard?: "summary" | "summary_large_image";
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  force?: boolean;
};

const PageMetaSuppressionContext = createContext(false);

export function PageMetaSuppressionProvider({ children }: { children: ReactNode }) {
  return createElement(PageMetaSuppressionContext.Provider, { value: true }, children);
}

function ensureMeta(selector: string, attributes: Record<string, string>) {
  let meta = document.querySelector(selector) as HTMLMetaElement | null;
  const existed = Boolean(meta);
  const previousContent = meta?.content || "";

  if (!meta) {
    meta = document.createElement("meta");
    for (const [name, value] of Object.entries(attributes)) {
      meta.setAttribute(name, value);
    }
    document.head.appendChild(meta);
  }

  return {
    set: (content: string) => {
      if (meta) meta.content = content;
    },
    restore: () => {
      if (!meta) return;
      if (existed) {
        meta.content = previousContent;
      } else {
        meta.remove();
      }
    },
  };
}

function safeMetaUrl(value: string | null | undefined, fallback = "") {
  const candidate = value?.trim();
  if (!candidate && !fallback) return "";

  try {
    const parsed = new URL(candidate || fallback, window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function usePageMeta(title: string, description: string, options: PageMetaOptions = {}) {
  const suppressPageMeta = useContext(PageMetaSuppressionContext);

  useEffect(() => {
    if (suppressPageMeta && !options.force) return;

    const prev = document.title;
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const previousCanonical = canonical?.href || "";
    const canonicalExisted = Boolean(canonical);
    const currentPageUrl = `${window.location.origin}${window.location.pathname}`;
    const canonicalOrigin = previousCanonical
      ? new URL(safeMetaUrl(previousCanonical, window.location.origin)).origin
      : window.location.origin;
    const inferredCanonicalUrl = new URL(window.location.pathname, `${canonicalOrigin}/`).toString();
    const canonicalUrl = safeMetaUrl(options.canonicalUrl, inferredCanonicalUrl) || currentPageUrl;
    const ogTitle = options.ogTitle ?? title;
    const ogDescription = options.ogDescription ?? description;
    const ogUrl = safeMetaUrl(options.ogUrl, canonicalUrl);
    const ogImage = safeMetaUrl(options.ogImage);
    const twitterImage = safeMetaUrl(options.twitterImage) || ogImage;
    const twitterCard = options.twitterCard ?? (twitterImage ? "summary_large_image" : "summary");

    document.title = title;

    const managed = [
      ensureMeta('meta[name="description"]', { name: "description" }),
      ensureMeta('meta[property="og:title"]', { property: "og:title" }),
      ensureMeta('meta[property="og:description"]', { property: "og:description" }),
      ensureMeta('meta[property="og:type"]', { property: "og:type" }),
      ensureMeta('meta[property="og:url"]', { property: "og:url" }),
      ensureMeta('meta[name="twitter:card"]', { name: "twitter:card" }),
      ensureMeta('meta[name="twitter:title"]', { name: "twitter:title" }),
      ensureMeta('meta[name="twitter:description"]', { name: "twitter:description" }),
    ];

    managed[0].set(description);
    managed[1].set(ogTitle);
    managed[2].set(ogDescription);
    managed[3].set(options.ogType ?? "website");
    managed[4].set(ogUrl);
    managed[5].set(twitterCard);
    managed[6].set(options.twitterTitle ?? ogTitle);
    managed[7].set(options.twitterDescription ?? ogDescription);

    if (ogImage) {
      const imageMeta = ensureMeta('meta[property="og:image"]', { property: "og:image" });
      imageMeta.set(ogImage);
      managed.push(imageMeta);
    }

    if (twitterImage) {
      const imageMeta = ensureMeta('meta[name="twitter:image"]', { name: "twitter:image" });
      imageMeta.set(twitterImage);
      managed.push(imageMeta);
    }

    if (options.noIndex) {
      const robotsMeta = ensureMeta('meta[name="robots"]', { name: "robots" });
      robotsMeta.set("noindex,nofollow");
      managed.push(robotsMeta);
    }

    let canonicalLink = canonical;
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;

    return () => {
      document.title = prev;
      managed.forEach((item) => item.restore());
      if (canonicalLink) {
        if (canonicalExisted) {
          canonicalLink.href = previousCanonical;
        } else {
          canonicalLink.remove();
        }
      }
    };
  }, [
    description,
    options.canonicalUrl,
    options.noIndex,
    options.ogDescription,
    options.ogImage,
    options.ogTitle,
    options.ogType,
    options.ogUrl,
    options.twitterCard,
    options.twitterDescription,
    options.force,
    options.twitterImage,
    options.twitterTitle,
    suppressPageMeta,
    title,
  ]);
}
