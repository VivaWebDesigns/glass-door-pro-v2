import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, AlertTriangle, Building2, CheckCircle, ChevronLeft, ChevronRight, Clock, DollarSign, DoorOpen, Droplets, Grid3X3, Home, Layers, Lock, Mail, MapPin, Paintbrush, Phone, Settings, Shield, Sparkles, Star, Store, Sun, Thermometer, Wrench, X } from "lucide-react";
import Layout from "@/components/layout";
import { CmsLeadForm } from "@/components/cms-lead-form";
import { CmsRichText } from "@/components/cms-rich-text";
import { CmsWidgetStack } from "@/components/cms-widgets";
import {
  BreadcrumbSchema,
  FAQSchema,
  LocalBusinessSchema,
  ServiceSchema,
  WebPageSchema,
} from "@/components/structured-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageMetaSuppressionProvider, usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, getPublicSiteSetting, publicCmsEnabled, usePublicSite } from "@/hooks/use-public-site";
import { isExternalCmsHref, safeCmsAssetUrl, safeCmsCanonicalUrl, safeCmsHref } from "@/lib/cms-safety";
import type { CmsBlogPost, CmsForm, CmsMedia, CmsPage, CmsSection, CmsSectionBlock, CmsSidebar } from "@shared/schema";

type CmsBlogPostSummary = CmsBlogPost & {
  featuredImage?: CmsMedia | null;
};

function cmsPagePublicPath(slug: string) {
  if (slug === "home") return "/";
  if (slug === "about" || slug === "contact" || slug === "gallery" || slug === "services" || slug.startsWith("services/")) {
    return `/${slug}`;
  }
  if (slug === "blog") return "/blog";
  return `/${slug.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function siteAbsoluteUrl(siteUrl: string, pathname: string) {
  return buildPublicUrl(siteUrl, pathname);
}

function cmsPageCanonicalUrl(page: CmsPage, siteUrl: string) {
  return safeCmsCanonicalUrl(page.seo.canonicalUrl, siteAbsoluteUrl(siteUrl, cmsPagePublicPath(page.slug)));
}

export const cmsTypeStyle = (token: "h1" | "h2" | "h3" | "body" | "small", fallback: string): React.CSSProperties => ({
  fontSize: `var(--cms-type-${token}, ${fallback})`,
});

function cmsResponsiveImageSources(url: string, sizes: string) {
  if (!url.startsWith("/cms-assets/images/") || !url.endsWith("-1280w.webp")) return null;
  const basePath = url.replace(/-1280w\.webp$/, "");

  return {
    webpSrcSet: `${basePath}-640w.webp 640w, ${basePath}-960w.webp 960w, ${basePath}-1280w.webp 1280w`,
    fallbackSrc: `${basePath}-1280w.jpg`,
    sizes,
  };
}

function CmsResponsiveImage({
  src,
  alt,
  className,
  loading,
  sizes,
}: {
  src: string;
  alt: string;
  className: string;
  loading: React.ImgHTMLAttributes<HTMLImageElement>["loading"];
  sizes: string;
}) {
  const responsiveImage = cmsResponsiveImageSources(src, sizes);

  if (responsiveImage) {
    return (
      <picture className="block h-full w-full">
        <source type="image/webp" srcSet={responsiveImage.webpSrcSet} sizes={responsiveImage.sizes} />
        <img src={responsiveImage.fallbackSrc} alt={alt} className={className} loading={loading} decoding="async" />
      </picture>
    );
  }

  return <img src={src} alt={alt} className={className} loading={loading} decoding="async" />;
}

function CmsVideoHeroBlock({ block }: { block: CmsSectionBlock }) {
  const props = block.props as Record<string, string | string[] | undefined>;
  const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoUrl = safeCmsAssetUrl(text(props.videoUrl));
  const posterUrl = safeCmsAssetUrl(text(props.posterUrl) ?? text(props.imageUrl));
  const shouldFadeVideo = Boolean(posterUrl);

  return (
    <section className="relative flex h-[70vh] min-h-[500px] items-center justify-center overflow-hidden bg-slate-900 px-4 text-center text-white">
      {posterUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${posterUrl})` }}
        />
      )}
      {videoUrl && (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedData={() => setVideoLoaded(true)}
          poster={posterUrl || undefined}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${!shouldFadeVideo || videoLoaded ? "opacity-100" : "opacity-0"}`}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-slate-900/50" />
      <div className="relative mx-auto max-w-4xl">
        {text(props.eyebrow) && <p className="mb-3 text-sm font-semibold uppercase tracking-wider">{text(props.eyebrow)}</p>}
        <h1 className="text-4xl font-bold leading-tight md:text-6xl" style={cmsTypeStyle("h1", "3.75rem")}>{text(props.title)}</h1>
        {text(props.body) && <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/90" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
        <CmsActionButton href={text(props.href)} label={text(props.label)} className="mt-8" />
      </div>
    </section>
  );
}

function cmsPageBreadcrumbItems(page: CmsPage, siteUrl: string) {
  const path = cmsPagePublicPath(page.slug);
  const parts = path.split("/").filter(Boolean);
  const items = [{ name: "Home", url: siteAbsoluteUrl(siteUrl, "/") }];

  if (page.slug === "home") return items;

  parts.forEach((part, index) => {
    const urlPath = `/${parts.slice(0, index + 1).join("/")}`;
    const isCurrentPage = index === parts.length - 1;
    items.push({
      name: isCurrentPage
        ? page.title
        : part
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
      url: siteAbsoluteUrl(siteUrl, urlPath),
    });
  });

  return items;
}

const cmsPageServiceSlugs = new Set([
  "services/frameless-showers",
  "services/window-installation",
  "services/door-installation",
  "services/window-repair",
  "services/commercial-glass",
  "services/showers",
  "services/windows",
  "services/doors",
]);

const primaryCmsPageSlugs = new Set([
  "home",
  "about",
  "contact",
  "gallery",
  "services",
  ...Array.from(cmsPageServiceSlugs),
]);

function cmsPageDescription(page: CmsPage) {
  return page.seo.metaDescription ?? page.excerpt ?? `${page.title} from Glass & Door Pro`;
}

function cmsPageApiPath(slug: string) {
  const encodedSlug = slug
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/cms/public/pages/${encodedSlug}`;
}

function findPageSidebar(sidebars: CmsSidebar[] = [], page: CmsPage) {
  const targetedLocations = [
    page.slug,
    `page:${page.slug}`,
    cmsPagePublicPath(page.slug),
  ];
  const fallbackLocations = primaryCmsPageSlugs.has(page.slug) ? [] : ["page", "default"];
  const locations = [
    ...targetedLocations,
    ...fallbackLocations,
  ];
  return locations
    .map((location) => sidebars.find((sidebar) => sidebar.location === location && sidebar.widgets.length > 0))
    .find(Boolean);
}

function CmsContactInfoCard({
  href,
  icon: Icon,
  label,
  value,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  const content = (
    <>
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary transition-transform group-hover:scale-110">
        <Icon className="h-7 w-7 text-white" />
      </div>
      <div>
        <h3 className="text-lg font-bold">{label}</h3>
        <p className="text-muted-foreground">{value}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <a href={href} className="group flex items-center gap-4 rounded-xl border-2 border-transparent bg-white p-6 transition-all hover:border-primary hover:shadow-lg">
        {content}
      </a>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border-2 border-transparent bg-white p-6">
      {content}
    </div>
  );
}

function CmsContactPageInfoItem({
  href,
  icon: Icon,
  title,
  description,
  children,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="rounded-full bg-primary/10 p-3">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        {description && <p className="mb-1 text-muted-foreground">{description}</p>}
        {href ? (
          <a href={href} className="font-bold transition-colors hover:text-primary">
            {children}
          </a>
        ) : (
          <p className="text-muted-foreground">{children}</p>
        )}
      </div>
    </div>
  );
}

function CmsFormBlock({
  slug,
  title,
  body,
  eyebrow,
  formTitle,
  variant,
}: {
  slug: string;
  title?: string;
  body?: string;
  eyebrow?: string;
  formTitle?: string;
  variant?: string;
}) {
  const { data: form } = useQuery<CmsForm | null>({
    queryKey: [`/api/cms/public/forms/${encodeURIComponent(slug)}`],
    retry: false,
    throwOnError: false,
  });
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const siteSetting = getPublicSiteSetting(siteData.settings, "site");
  const businessHours = typeof siteSetting.businessHours === "string" && siteSetting.businessHours.trim()
    ? siteSetting.businessHours.trim()
    : "Mon-Sat: 7am - 6pm";
  const serviceArea = typeof siteSetting.market === "string" && siteSetting.market.trim()
    ? siteSetting.market.trim()
    : identity.market;
  const layout = normalizeCmsLayout(variant);

  if (layout === "homecontact" || layout === "publichomecontact") {
    return (
      <section id="contact" className="bg-gradient-to-br from-primary/10 via-accent/30 to-primary/5 px-4 py-16 md:py-20">
        <div className="container mx-auto">
          <div className="mb-12 text-center">
            {eyebrow && <span className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</span>}
            <h2 className="mt-2 text-3xl font-heading font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{title || "Let us know how we can help!"}</h2>
            {body && <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{body}</p>}
          </div>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-8 shadow-xl">
              <h3 className="mb-6 text-2xl font-heading font-bold">{formTitle || "Send us a message"}</h3>
              <CmsLeadForm form={form} fieldPreset="originalHome" />
            </div>

            <div className="flex flex-col gap-4">
              <CmsContactInfoCard href={identity.phoneHref} icon={Phone} label="Call Us" value={identity.phone} />
              <CmsContactInfoCard href={`mailto:${identity.email}`} icon={Mail} label="Email Us" value={identity.email} />
              <CmsContactInfoCard icon={MapPin} label="Service Locations" value="Charlotte & Surrounding Areas" />
              <CmsContactInfoCard icon={Clock} label="Hours" value={businessHours} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === "contactpage" || layout === "publiccontactpage") {
    return (
      <section className="px-4 py-20">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-6 text-3xl font-heading font-bold text-primary" style={cmsTypeStyle("h2", "2.25rem")}>
                {title || "Get In Touch"}
              </h2>
              {body && <p className="mb-8 text-lg text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{body}</p>}

              <div className="space-y-8">
                <CmsContactPageInfoItem href={identity.phoneHref} icon={Phone} title="Phone" description="Call Doug for immediate assistance.">
                  {identity.phone}
                </CmsContactPageInfoItem>
                <CmsContactPageInfoItem href={`mailto:${identity.email}`} icon={Mail} title="Email" description="Send us your plans or questions.">
                  {identity.email}
                </CmsContactPageInfoItem>
                <CmsContactPageInfoItem icon={MapPin} title="Service Area">
                  Serving {serviceArea} including Myers Park, Dilworth, South Park, Ballantyne, Matthews, and Huntersville.
                </CmsContactPageInfoItem>
                <CmsContactPageInfoItem icon={Clock} title="Hours">
                  {businessHours}
                </CmsContactPageInfoItem>
              </div>
            </div>

            <div>
              <Card className="border-t-4 border-t-primary shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl">{formTitle || "Send a Message"}</CardTitle>
                  {form?.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
                </CardHeader>
                <CardContent>
                  <CmsLeadForm form={form} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-slate-50 px-4 py-16">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.85fr_1.15fr] md:items-start">
        <div>
          <h2 className="text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{title || form?.name || "Request a Quote"}</h2>
          {body && <p className="mt-4 leading-8 text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{body}</p>}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{form?.name ?? title ?? "Send a Message"}</CardTitle>
            {form?.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
          </CardHeader>
          <CardContent>
            <CmsLeadForm form={form} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function CmsPageRichText({ body, className = "mt-4" }: { body: string; className?: string }) {
  return (
    <CmsRichText
      body={body}
      className={className}
      paragraphClassName="text-muted-foreground"
      headingClassName="text-2xl text-foreground"
      subheadingClassName="text-xl text-foreground"
      smallHeadingClassName="text-lg text-foreground"
      listClassName="text-muted-foreground"
      numberedListClassName="text-muted-foreground"
      quoteClassName="text-muted-foreground"
    />
  );
}

function CmsActionButton({
  href,
  label,
  className,
  variant,
}: {
  href?: string;
  label?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const safeHref = safeCmsHref(href);
  const safeLabel = label?.trim();

  if (!safeHref || !safeLabel) return null;

  return (
    <Button asChild className={className} variant={variant}>
      {isExternalCmsHref(safeHref) ? (
        <a href={safeHref} target={safeHref.startsWith("http") ? "_blank" : undefined} rel={safeHref.startsWith("http") ? "noreferrer" : undefined}>
          {safeLabel}
        </a>
      ) : (
        <Link href={safeHref}>{safeLabel}</Link>
      )}
    </Button>
  );
}

const cmsMediaIsGalleryImage = (media: CmsMedia) => {
  const searchable = [media.url, media.name, media.caption ?? "", media.altText ?? "", media.category ?? "", ...(media.tags ?? [])]
    .join(" ")
    .toLowerCase();
  return media.mimeType.startsWith("image/") && (media.isGalleryReady || searchable.includes("gallery"));
};

const cmsGalleryCategories = [
  { id: "frameless-showers", label: "Frameless Showers", keywords: ["frameless", "shower", "bath"] },
  { id: "windows", label: "Windows", keywords: ["window", "windows", "sunroom", "glass replacement", "repair"] },
  { id: "doors", label: "Doors", keywords: ["door", "doors", "entry", "patio", "sliding"] },
  { id: "commercial-glass", label: "Commercial Glass", keywords: ["commercial", "storefront", "office", "business"] },
];

const cmsDefaultGalleryCategoryCards = [
  { id: "frameless-showers", title: "Frameless Showers", subtitle: "Recent installations", coverUrl: "" },
  { id: "windows", title: "Windows", subtitle: "Coming Soon", coverUrl: "" },
  { id: "doors", title: "Doors", subtitle: "Coming Soon", coverUrl: "" },
  { id: "commercial-glass", title: "Commercial Glass", subtitle: "Coming Soon", coverUrl: "" },
];

const cmsMediaGalleryText = (media: CmsMedia) =>
  [media.url, media.name, media.caption ?? "", media.altText ?? "", media.category ?? "", ...(media.tags ?? [])]
    .join(" ")
    .toLowerCase();

function cmsGalleryCategoryId(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "";
  return cmsGalleryCategories.find(
    (category) => category.id === normalized || category.label.toLowerCase() === normalized,
  )?.id ?? normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cmsGalleryCategoryIdForMedia(media: CmsMedia) {
  const explicitCategory = cmsGalleryCategoryId(media.category ?? undefined);
  if (explicitCategory) return explicitCategory;
  const searchable = cmsMediaGalleryText(media);
  return cmsGalleryCategories.find((category) => category.keywords.some((keyword) => searchable.includes(keyword)))?.id ?? "";
}

const cmsMediaMatchesGalleryCategory = (media: CmsMedia, category?: string) => {
  if (!category?.trim()) return true;
  const normalizedCategory = category.trim().toLowerCase();
  const matchedCategory = cmsGalleryCategories.find(
    (item) => item.id === normalizedCategory || item.label.toLowerCase() === normalizedCategory,
  );
  const explicitCategory = media.category?.trim().toLowerCase();
  const tags = media.tags?.map((tag) => tag.trim().toLowerCase()) ?? [];
  const searchable = [cmsMediaGalleryText(media), explicitCategory ?? "", ...tags].join(" ");

  if (!matchedCategory) return explicitCategory === normalizedCategory || tags.includes(normalizedCategory) || searchable.includes(normalizedCategory);
  return (
    explicitCategory === matchedCategory.label.toLowerCase() ||
    explicitCategory === matchedCategory.id ||
    tags.includes(matchedCategory.id) ||
    tags.includes(matchedCategory.label.toLowerCase()) ||
    matchedCategory.keywords.some((keyword) => searchable.includes(keyword))
  );
};

function normalizeCmsLayout(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function CmsMediaGalleryBlock({ block }: { block: CmsSectionBlock }) {
  const props = block.props as Record<string, string | string[] | number | boolean | undefined>;
  const text = (value: string | string[] | number | boolean | undefined) => (typeof value === "string" ? value : undefined);
  const textList = (value: string | string[] | number | boolean | undefined) => (Array.isArray(value) ? value : []);
  const truthy = (value: string | string[] | number | boolean | undefined) =>
    value === true || (typeof value === "string" && ["1", "true", "yes"].includes(value.trim().toLowerCase()));
  const category = text(props.category);
  const limitValue = Number(props.limit ?? text(props.count) ?? "");
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(Math.floor(limitValue), 24) : 0;
  const preferFallback = truthy(props.preferFallback) || text(props.source)?.trim().toLowerCase() === "fallback";
  const layout = normalizeCmsLayout(text(props.variant) ?? text(props.layout));
  const showCaptions = props.showCaptions === false || text(props.showCaptions)?.trim().toLowerCase() === "false"
    ? false
    : true;
  const mediaQueryUrl = category
    ? `/api/cms/public/media?gallery=1&category=${encodeURIComponent(category)}`
    : "/api/cms/public/media?gallery=1";
  const { data: mediaItems = [] } = useQuery<CmsMedia[]>({
    queryKey: [mediaQueryUrl],
    retry: false,
    throwOnError: false,
  });
  const [activeGalleryCategoryId, setActiveGalleryCategoryId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fallbackItems = textList(props.items)
    .map((item) => {
      const [url, caption, categoryId, alt] = item.split("|").map((part) => part.trim());
      const safeUrl = safeCmsAssetUrl(url);
      return safeUrl
        ? {
            url: safeUrl,
            caption: caption || "Glass and door project",
            alt: alt || caption || "Glass and door project",
            categoryId: cmsGalleryCategoryId(categoryId),
          }
        : null;
    })
    .filter((item): item is { url: string; caption: string; alt: string; categoryId: string } => Boolean(item));
  const galleryItems = mediaItems
    .filter(cmsMediaIsGalleryImage)
    .filter((media) => cmsMediaMatchesGalleryCategory(media, category))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((media) => ({
      url: safeCmsAssetUrl(media.url),
      caption: media.caption || media.name,
      alt: media.altText || media.caption || media.name,
      categoryId: cmsGalleryCategoryIdForMedia(media),
    }))
    .filter((item) => Boolean(item.url));
  const baseItems = preferFallback && fallbackItems.length > 0
    ? fallbackItems
    : galleryItems.length > 0
      ? galleryItems
      : fallbackItems;
  const items = limit > 0 ? baseItems.slice(0, limit) : baseItems;
  const categoryCards = textList(props.categories)
    .map((item) => {
      const [id, title, subtitle, coverUrl] = item.split("|").map((part) => part.trim());
      if (!id || !title) return null;
      return {
        id: cmsGalleryCategoryId(id),
        title,
        subtitle: subtitle || "Recent installations",
        coverUrl: safeCmsAssetUrl(coverUrl),
      };
    })
    .filter((item): item is { id: string; title: string; subtitle: string; coverUrl: string } => Boolean(item));
  const galleryCategoryCards = categoryCards.length > 0 ? categoryCards : cmsDefaultGalleryCategoryCards;

  if (items.length === 0) return null;

  if (layout === "homestrip" || layout === "compactstrip" || layout === "publichomegallery") {
    return (
      <section className="bg-muted/30 px-4 py-8">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((item, index) => {
              const loading = index < 4 ? "eager" : "lazy";

              return (
                <figure key={`${item.url}-${index}`} className="aspect-square cursor-pointer overflow-hidden rounded-lg shadow-md">
                  <CmsResponsiveImage
                    src={item.url}
                    alt={item.alt}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    loading={loading}
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </figure>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "servicepair" || layout === "serviceimagepair") {
    const limitValue = Number(props.limit ?? text(props.count) ?? "");
    const visibleLimit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(Math.floor(limitValue), items.length) : items.length;
    const visibleItems = items.slice(0, visibleLimit);
    const tone = normalizeCmsLayout(text(props.tone) ?? text(props.background) ?? text(props.sectionTone));
    const gridClass = visibleItems.length >= 3 ? "md:grid-cols-3 max-w-5xl" : "md:grid-cols-2 max-w-4xl";
    const sectionClass = tone === "default" || tone === "white" ? "px-4 py-16" : "bg-muted/50 px-4 py-16";
    const serviceImageSizes = visibleItems.length >= 3 ? "(max-width: 768px) 100vw, 33vw" : "(max-width: 768px) 100vw, 50vw";

    return (
      <section className={sectionClass}>
        <div className="container mx-auto">
          {text(props.title) && <h2 className="mb-12 text-center text-3xl font-heading font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
          <div className={`mx-auto grid grid-cols-1 gap-6 ${gridClass}`}>
            {visibleItems.map((item, index) => (
              <div key={`${item.url}-${index}`} className="aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
                <CmsResponsiveImage
                  src={item.url}
                  alt={item.alt}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  sizes={serviceImageSizes}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "categorycards" || layout === "publicgallerycategories") {
    const firstCategoryWithItems = galleryCategoryCards.find((galleryCategory) =>
      items.some((item) => item.categoryId === galleryCategory.id || (!item.categoryId && galleryCategory.id === "frameless-showers"))
    )?.id ?? galleryCategoryCards[0]?.id ?? "";
    const activeCategoryId = activeGalleryCategoryId;
    const activeCategory = galleryCategoryCards.find((galleryCategory) => galleryCategory.id === activeCategoryId);
    const activeItems = activeCategoryId
      ? items.filter((item) => item.categoryId === activeCategoryId || (!item.categoryId && activeCategoryId === firstCategoryWithItems))
      : [];
    const activeLightboxItem = lightboxIndex === null ? null : activeItems[lightboxIndex] ?? null;
    const closeLightbox = () => setLightboxIndex(null);
    const nextImage = () => setLightboxIndex((current) => current === null ? 0 : (current + 1) % activeItems.length);
    const previousImage = () => setLightboxIndex((current) => current === null ? 0 : (current - 1 + activeItems.length) % activeItems.length);

    return (
      <section className="px-4 py-16 md:py-20">
        <div className="container mx-auto">
          <div className="mb-12 text-center">
            {text(props.title) && (
              <h1 className="mb-4 text-3xl font-heading font-bold text-slate-900 md:text-4xl lg:text-5xl" style={cmsTypeStyle("h1", "3.75rem")}>
                {text(props.title)}
              </h1>
            )}
            {text(props.body) && (
              <p className="mx-auto max-w-2xl text-lg text-slate-600" style={cmsTypeStyle("body", "1rem")}>
                {text(props.body)}
              </p>
            )}
          </div>

          {!activeGalleryCategoryId ? (
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {galleryCategoryCards.map((galleryCategory) => {
                const categoryItems = items.filter((item) => item.categoryId === galleryCategory.id || (!item.categoryId && galleryCategory.id === firstCategoryWithItems));
                const coverUrl = galleryCategory.coverUrl || categoryItems[0]?.url || "";

                return categoryItems.length > 0 && coverUrl ? (
                  <button
                    key={galleryCategory.id}
                    type="button"
                    onClick={() => {
                      setActiveGalleryCategoryId(galleryCategory.id);
                      setLightboxIndex(null);
                    }}
                    className="group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-xl bg-slate-200 text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    <CmsResponsiveImage
                      src={coverUrl}
                      alt={galleryCategory.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading={galleryCategory.id === "frameless-showers" ? "eager" : "lazy"}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-300 group-hover:from-black/80" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h2 className="mb-1 text-xl font-heading font-bold text-white md:text-2xl" style={cmsTypeStyle("h2", "2.25rem")}>
                        {galleryCategory.title}
                      </h2>
                      <p className="text-sm text-white/80">{galleryCategory.subtitle}</p>
                      <p className="mt-2 text-xs text-white/60">
                        {categoryItems.length} photo{categoryItems.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </button>
                ) : (
                  <div
                    key={galleryCategory.id}
                    className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50 p-6 text-center"
                  >
                    <h2 className="mb-2 text-xl font-heading font-bold text-slate-900 md:text-2xl" style={cmsTypeStyle("h2", "2.25rem")}>
                      {galleryCategory.title}
                    </h2>
                    <p className="text-sm text-slate-500">{galleryCategory.subtitle}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => {
                  setActiveGalleryCategoryId(null);
                  setLightboxIndex(null);
                }}
                className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to categories
              </button>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
                {activeItems.map((item, index) => (
                  <div key={`${item.url}-${index}`} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(index)}
                      className="group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-lg bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                      <CmsResponsiveImage
                        src={item.url}
                        alt={item.alt}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading={index < 2 ? "eager" : "lazy"}
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
                    </button>
                    <p className="mt-2 text-center text-xs font-medium text-slate-600 md:text-sm">{item.caption}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeLightboxItem && activeCategory && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${activeCategory.title} image lightbox`}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
            onClick={closeLightbox}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                closeLightbox();
              }}
              className="absolute right-4 top-4 z-[110] text-white/80 transition-colors hover:text-white"
              aria-label="Close lightbox"
            >
              <X className="h-8 w-8" />
            </button>
            {activeItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    previousImage();
                  }}
                  className="absolute left-2 z-[110] p-2 text-white/70 transition-colors hover:text-white md:left-6"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-8 w-8 md:h-10 md:w-10" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    nextImage();
                  }}
                  className="absolute right-2 z-[110] p-2 text-white/70 transition-colors hover:text-white md:right-6"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-8 w-8 md:h-10 md:w-10" />
                </button>
              </>
            )}
            <div className="flex max-h-[85vh] max-w-[90vw] items-center justify-center" onClick={(event) => event.stopPropagation()}>
              <img src={activeLightboxItem.url} alt={activeLightboxItem.alt} className="max-h-[85vh] max-w-full select-none rounded-lg object-contain" draggable={false} />
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-5 py-2.5 text-center">
              <p className="text-sm font-medium text-white">{activeLightboxItem.caption}</p>
              <p className="mt-0.5 text-xs text-white/60">
                {(lightboxIndex ?? 0) + 1} / {activeItems.length}
              </p>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        {text(props.eyebrow) && <p className="text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
        {text(props.title) && <h2 className="mt-2 text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
        {text(props.body) && <p className="mt-4 max-w-3xl leading-8 text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <figure key={`${item.url}-${index}`} className="overflow-hidden rounded-md border bg-white">
              <CmsResponsiveImage
                src={item.url}
                alt={item.alt}
                className="aspect-[4/3] w-full object-cover"
                loading={index < 2 ? "eager" : "lazy"}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              {showCaptions && item.caption && <figcaption className="p-3 text-sm text-muted-foreground">{item.caption}</figcaption>}
            </figure>
          ))}
        </div>
        {galleryItems.length === 0 && text(props.fallbackNote) && (
          <p className="mt-4 text-sm text-muted-foreground">{text(props.fallbackNote)}</p>
        )}
      </div>
    </section>
  );
}

const cmsServiceIcons = [
  { keywords: ["shower", "frameless"], icon: Droplets },
  { keywords: ["window"], icon: Grid3X3 },
  { keywords: ["door"], icon: DoorOpen },
  { keywords: ["repair"], icon: Wrench },
  { keywords: ["commercial", "storefront"], icon: Building2 },
];

function CmsServiceIcon({ title }: { title: string }) {
  const normalizedTitle = title.toLowerCase();
  const Icon = cmsServiceIcons.find((item) => item.keywords.some((keyword) => normalizedTitle.includes(keyword)))?.icon ?? Building2;
  return (
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
      <Icon className="h-8 w-8 text-primary" />
    </div>
  );
}

const cmsBenefitIcons = [
  { keywords: ["broken", "storm", "emergency"], icon: AlertTriangle },
  { keywords: ["storefront", "store"], icon: Store },
  { keywords: ["office", "building", "local"], icon: Building2 },
  { keywords: ["curtain", "partition", "layer"], icon: Layers },
  { keywords: ["lock"], icon: Lock },
  { keywords: ["curb", "appearance", "home value"], icon: Home },
  { keywords: ["paint", "aesthetic"], icon: Paintbrush },
  { keywords: ["wide selection", "glass doors", "door"], icon: DoorOpen },
  { keywords: ["natural", "light", "sun"], icon: Sun },
  { keywords: ["temperature", "energy efficiency", "comfort"], icon: Thermometer },
  { keywords: ["lower", "bill", "cost", "affordable", "single pane"], icon: DollarSign },
  { keywords: ["seal", "repair"], icon: Wrench },
  { keywords: ["setting"], icon: Settings },
  { keywords: ["elegance", "modern", "luxury"], icon: Sparkles },
  { keywords: ["premium", "quality", "professional"], icon: Shield },
  { keywords: ["clean", "shower", "water"], icon: Droplets },
  { keywords: ["custom", "fit", "installation"], icon: CheckCircle },
  { keywords: ["value", "home"], icon: Clock },
];

function CmsBenefitIcon({ title }: { title: string }) {
  const normalizedTitle = title.toLowerCase();
  const Icon = cmsBenefitIcons.find((item) => item.keywords.some((keyword) => normalizedTitle.includes(keyword)))?.icon ?? CheckCircle;
  return (
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
      <Icon className="h-7 w-7 text-primary" />
    </div>
  );
}

function CmsColumnIcon({ title }: { title: string }) {
  const normalizedTitle = title.toLowerCase();
  const Icon = cmsBenefitIcons.find((item) => item.keywords.some((keyword) => normalizedTitle.includes(keyword)))?.icon ?? CheckCircle;
  return (
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white">
      <Icon className="h-8 w-8" />
    </div>
  );
}

function CmsTestimonialsBlock({ block }: { block: CmsSectionBlock }) {
  const props = block.props as Record<string, string | string[] | undefined>;
  const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
  const textList = (value: string | string[] | undefined) => (Array.isArray(value) ? value : []);
  const layout = normalizeCmsLayout(text(props.variant) ?? text(props.layout));
  const items = textList(props.items)
    .map((item) => {
      const [quote, author] = item.split("|").map((part) => part.trim());
      return quote ? { quote, author } : null;
    })
    .filter((item): item is { quote: string; author: string } => Boolean(item));
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    if (layout !== "homecarousel" || items.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setCurrentTestimonial((current) => (current + 1) % items.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [items.length, layout]);

  if (items.length === 0) return null;

  if (layout === "homecarousel" || layout === "publichomereviews") {
    const activeTestimonial = items[currentTestimonial] ?? items[0];
    const goToPrevious = () => setCurrentTestimonial((current) => (current - 1 + items.length) % items.length);
    const goToNext = () => setCurrentTestimonial((current) => (current + 1) % items.length);

    return (
      <section id={block.id || "reviews"} className="bg-muted/50 px-4 py-16 md:py-20">
        <div className="container mx-auto">
          <div className="mb-12 text-center">
            {text(props.eyebrow) && <span className="text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</span>}
            {text(props.title) && <h2 className="mt-2 text-3xl font-heading font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
            {text(props.body) && <p className="mx-auto mt-4 max-w-2xl text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          </div>

          <div className="relative mx-auto max-w-3xl">
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goToPrevious}
                  className="absolute left-0 top-1/2 z-10 -translate-x-4 -translate-y-1/2 rounded-full bg-white p-2 shadow-lg transition-colors hover:bg-gray-50 md:-translate-x-12"
                  aria-label="Previous review"
                >
                  <ChevronLeft className="h-6 w-6 text-gray-600" />
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-4 rounded-full bg-white p-2 shadow-lg transition-colors hover:bg-gray-50 md:translate-x-12"
                  aria-label="Next review"
                >
                  <ChevronRight className="h-6 w-6 text-gray-600" />
                </button>
              </>
            )}

            <div className="rounded-xl bg-white p-8 shadow-lg md:p-10">
              <div className="mb-6 flex justify-center gap-1 text-yellow-400">
                {[...Array(5)].map((_, index) => (
                  <Star key={index} className="h-6 w-6 fill-current" />
                ))}
              </div>
              <p className="mb-6 min-h-[100px] text-center text-lg italic leading-relaxed text-foreground md:text-xl" style={cmsTypeStyle("body", "1rem")}>
                "{activeTestimonial.quote}"
              </p>
              <div className="flex flex-col items-center gap-3">
                <svg className="h-6 w-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {activeTestimonial.author && <div className="text-lg font-bold">{activeTestimonial.author}</div>}
              </div>
            </div>

            {items.length > 1 && (
              <>
                <div className="mt-8 flex justify-center gap-2">
                  {items.map((item, index) => (
                    <button
                      key={`${item.author}-${index}`}
                      type="button"
                      onClick={() => setCurrentTestimonial(index)}
                      aria-label={`Go to review ${index + 1}`}
                      className={`h-3 w-3 rounded-full transition-colors ${
                        index === currentTestimonial ? "bg-primary" : "bg-gray-300 hover:bg-gray-400"
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  {currentTestimonial + 1} / {items.length}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-6xl">
        {text(props.eyebrow) && <p className="text-center text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
        {text(props.title) && <h2 className="mt-2 text-center text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
        {text(props.body) && <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((item, index) => (
            <Card key={`${item.quote}-${index}`}>
              <CardContent className="p-5">
                <p className="leading-7 text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>"{item.quote}"</p>
                {item.author && <p className="mt-4 text-sm font-semibold text-foreground" style={cmsTypeStyle("small", "0.875rem")}>{item.author}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function CmsRecentPostsBlock({ block }: { block: CmsSectionBlock }) {
  const props = block.props as Record<string, string | number | undefined>;
  const text = (value: string | number | undefined) => (typeof value === "string" ? value : undefined);
  const countValue = typeof props.count === "number" ? props.count : Number.parseInt(String(props.count ?? ""), 10);
  const count = Number.isFinite(countValue) ? Math.min(Math.max(countValue, 1), 6) : 3;
  const filter = text(props.category) || text(props.tag);
  const href = text(props.href) || "/blog";
  const label = text(props.label) || "View Blog";
  const { data: posts = [], isLoading } = useQuery<CmsBlogPostSummary[]>({
    queryKey: ["/api/cms/public/blog"],
    retry: false,
    throwOnError: false,
  });
  const visiblePosts = posts
    .filter((post) => !filter || post.category === filter || post.tags.includes(filter))
    .slice(0, count);

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        {text(props.eyebrow) && <p className="text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
        {text(props.title) && <h2 className="mt-2 text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
        {text(props.body) && <p className="mt-4 max-w-3xl leading-8 text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
        {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading posts...</p>}
        {!isLoading && visiblePosts.length === 0 && (
          <p className="mt-6 rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            Published CMS posts will appear here.
          </p>
        )}
        {visiblePosts.length > 0 && (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {visiblePosts.map((post) => {
              const imageUrl = post.featuredImage?.mimeType.startsWith("image/")
                ? safeCmsAssetUrl(post.featuredImage.url)
                : "";
              return (
                <Card key={post.id} className="flex h-full flex-col overflow-hidden">
                  {imageUrl && (
                    <Link href={`/blog/${encodeURIComponent(post.slug)}`} className="block bg-slate-100">
                      <CmsResponsiveImage
                        src={imageUrl}
                        alt={post.featuredImage?.altText ?? post.title}
                        className="aspect-[4/3] w-full object-cover"
                        loading="lazy"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </Link>
                  )}
                  <CardContent className="flex flex-1 flex-col p-5">
                    {post.category && <p className="text-xs font-semibold uppercase tracking-wider text-primary">{post.category}</p>}
                    <h3 className="mt-2 text-xl font-bold leading-tight" style={cmsTypeStyle("h3", "1.5rem")}>
                      <Link href={`/blog/${encodeURIComponent(post.slug)}`} className="hover:text-primary">
                        {post.title}
                      </Link>
                    </h3>
                    {post.excerpt && <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground" style={cmsTypeStyle("small", "0.875rem")}>{post.excerpt}</p>}
                    <CmsActionButton href={`/blog/${encodeURIComponent(post.slug)}`} label="Read Post" variant="outline" className="mt-5 w-fit" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <CmsActionButton href={href} label={label} className="mt-8" />
      </div>
    </section>
  );
}

const serviceHeroPresets: Record<string, {
  sectionClass: string;
  containerClass: string;
  contentClass: string;
  headingClass: string;
  paragraphClass: string;
  backgroundPosition?: string;
  mobileOverlay?: string;
  desktopOverlay?: string;
}> = {
  default: {
    sectionClass: "relative flex min-h-[70vh] items-center bg-cover bg-center bg-scroll lg:items-start lg:bg-fixed",
    containerClass: "container relative z-10 mx-auto px-6 py-12 lg:px-4 lg:pb-12 lg:pt-32",
    contentClass: "max-w-3xl lg:max-w-[600px]",
    headingClass: "mb-4 text-3xl font-heading font-bold text-white md:mb-6 md:text-5xl lg:text-6xl",
    paragraphClass: "mb-6 text-base font-medium leading-[1.6] text-white md:mb-8 md:text-xl md:font-normal md:leading-relaxed",
    backgroundPosition: "center center",
    mobileOverlay: "linear-gradient(to bottom, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.15) 100%)",
    desktopOverlay: "rgba(0,0,0,0.20)",
  },
  window: {
    sectionClass: "relative flex min-h-[90vh] items-center bg-cover bg-center bg-scroll md:items-start md:bg-fixed",
    containerClass: "container relative z-10 mx-auto px-6 pt-24 md:px-4 md:pt-28",
    contentClass: "max-w-xl",
    headingClass: "mb-4 text-4xl font-heading font-bold text-white md:mb-6 md:text-5xl lg:text-6xl",
    paragraphClass: "mb-6 text-base font-medium leading-[1.6] text-white md:mb-8 md:text-xl md:font-normal md:leading-relaxed",
    backgroundPosition: "center center",
    mobileOverlay: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)",
  },
  door: {
    sectionClass: "relative flex min-h-[70vh] items-center bg-cover bg-center bg-scroll lg:items-start lg:bg-fixed",
    containerClass: "container relative z-10 mx-auto px-6 pb-12 pt-28 lg:px-4 lg:pb-12 lg:pt-48",
    contentClass: "max-w-xl lg:max-w-[600px]",
    headingClass: "mb-4 text-3xl font-heading font-bold text-white md:mb-6 md:text-5xl lg:text-6xl",
    paragraphClass: "mb-6 text-base font-medium leading-[1.6] text-white md:mb-8 md:text-xl md:font-normal md:leading-relaxed",
    backgroundPosition: "center 20%",
    mobileOverlay: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)",
    desktopOverlay: "rgba(0,0,0,0.30)",
  },
  repair: {
    sectionClass: "relative flex min-h-[70vh] items-center bg-cover bg-[right_center] bg-scroll lg:items-start lg:bg-fixed",
    containerClass: "container relative z-10 mx-auto px-6 pb-12 pt-28 lg:px-4 lg:pb-12 lg:pt-32",
    contentClass: "max-w-xl lg:max-w-[600px]",
    headingClass: "mb-4 text-3xl font-heading font-bold text-white md:mb-6 md:text-5xl lg:text-6xl",
    paragraphClass: "mb-6 text-base font-medium leading-[1.6] text-white md:mb-8 md:text-xl md:font-normal md:leading-relaxed",
    backgroundPosition: "70% 50%",
    mobileOverlay: "linear-gradient(90deg, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.15) 100%)",
    desktopOverlay: "linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.10) 100%)",
  },
  commercial: {
    sectionClass: "relative flex min-h-[70vh] items-center overflow-hidden bg-cover bg-center bg-scroll lg:items-start lg:bg-fixed",
    containerClass: "container relative z-10 mx-auto px-6 pb-12 pt-28 lg:px-4 lg:pb-12 lg:pt-32",
    contentClass: "max-w-xl lg:max-w-[600px]",
    headingClass: "mb-4 text-3xl font-heading font-bold text-white md:mb-6 md:text-5xl lg:text-6xl",
    paragraphClass: "mb-6 text-base font-medium leading-[1.6] text-white md:mb-8 md:text-xl md:font-normal md:leading-relaxed",
    backgroundPosition: "center 25%",
    mobileOverlay: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)",
    desktopOverlay: "rgba(0,0,0,0.25)",
  },
};

export function CmsBlock({ block }: { block: CmsSectionBlock }) {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const props = block.props as Record<string, string | string[] | undefined>;
  const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
  const textList = (value: string | string[] | undefined) => (Array.isArray(value) ? value : []);

  if (block.type === "hero") {
    const imageUrl = safeCmsAssetUrl(text(props.imageUrl));
    const layout = normalizeCmsLayout(text(props.variant) ?? text(props.layout));

    if (layout === "simpleservicehero" || layout === "servicegrouphero") {
      return (
        <section className="relative flex h-[400px] items-center justify-center overflow-hidden">
          {imageUrl && (
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 z-10 bg-slate-900/60" />
              <CmsResponsiveImage
                src={imageUrl}
                alt={text(props.alt) ?? text(props.title) ?? ""}
                className="h-full w-full object-cover"
                loading="eager"
                sizes="100vw"
              />
            </div>
          )}
          <div className="relative z-20 p-4 text-center text-white">
            {text(props.eyebrow) && <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/80">{text(props.eyebrow)}</p>}
            <h1 className="mb-4 text-4xl font-heading font-bold md:text-6xl" style={cmsTypeStyle("h1", "3.75rem")}>
              {text(props.title)}
            </h1>
            {text(props.body) && (
              <p className="mx-auto max-w-2xl text-xl text-white/90" style={cmsTypeStyle("body", "1rem")}>
                {text(props.body)}
              </p>
            )}
          </div>
        </section>
      );
    }

    if (layout === "parallaxservicehero" || layout === "serviceparallaxhero") {
      const presetKey = normalizeCmsLayout(text(props.heroPreset) ?? text(props.preset) ?? "default") ?? "default";
      const preset = serviceHeroPresets[presetKey] ?? serviceHeroPresets.default;
      const heroStyle: React.CSSProperties | undefined = imageUrl
        ? { backgroundImage: `url(${imageUrl})`, backgroundPosition: preset.backgroundPosition }
        : undefined;

      return (
        <section
          className={preset.sectionClass}
          style={heroStyle}
        >
          {preset.mobileOverlay && (
            <div
              className="pointer-events-none absolute inset-0 lg:hidden"
              style={{ background: preset.mobileOverlay }}
            />
          )}
          {preset.desktopOverlay && (
            <div
              className="pointer-events-none absolute inset-0 hidden lg:block"
              style={{ background: preset.desktopOverlay }}
            />
          )}
          <div className={preset.containerClass}>
            <div className={preset.contentClass}>
              <h1
                className={preset.headingClass}
                style={{ ...cmsTypeStyle("h1", "3.75rem"), textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}
              >
                {text(props.title)}
              </h1>
              {text(props.body) && (
                <p
                  className={preset.paragraphClass}
                  style={{ ...cmsTypeStyle("body", "1rem"), textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}
                >
                  {text(props.body)}
                </p>
              )}
              <div className="relative z-20 flex flex-wrap gap-4">
                <Button asChild size="lg" className="h-12 px-8 text-lg">
                  <Link href={safeCmsHref(text(props.href)) || "/contact"}>{text(props.label) || "Request a Quote"} <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 border-white px-8 text-lg text-white hover:bg-white hover:text-primary" asChild>
                  <a href={identity.phoneHref}>
                    <Phone className="mr-2 h-5 w-5" />
                    Call {identity.phone}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section
        className={`relative overflow-hidden bg-slate-900 px-4 py-20 text-center text-white ${imageUrl ? "bg-cover bg-center" : ""}`}
        style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
      >
        {imageUrl && <div className="absolute inset-0 bg-slate-950/70" />}
        <div className="relative mx-auto max-w-4xl">
          {text(props.eyebrow) && <p className="mb-3 text-sm font-semibold uppercase">{text(props.eyebrow)}</p>}
          <h1 className="text-4xl font-bold md:text-6xl" style={cmsTypeStyle("h1", "3.75rem")}>{text(props.title)}</h1>
          {text(props.body) && <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-200" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          <CmsActionButton href={text(props.href)} label={text(props.label)} className="mt-8" />
        </div>
      </section>
    );
  }

  if (block.type === "videoHero") {
    return <CmsVideoHeroBlock block={block} />;
  }

  if (block.type === "cta") {
    const layout = normalizeCmsLayout(text(props.variant) ?? text(props.layout));

    if (layout === "serviceclosing" || layout === "serviceclosingcta") {
      return (
        <section className="bg-primary px-4 py-16 text-center text-white md:py-20">
          <div className="container mx-auto">
            {text(props.title) && <h2 className="mb-6 text-3xl font-heading font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
            {text(props.body) && <p className="mx-auto mb-8 max-w-2xl text-xl text-white/90" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" variant="secondary" className="h-12 px-8 text-lg">
                <Link href={safeCmsHref(text(props.href)) || "/contact"}>{text(props.label) || "Get Your Free Estimate"} <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 border-white px-8 text-lg text-white hover:bg-white hover:text-primary" asChild>
                <Link href={safeCmsHref(text(props.secondaryHref)) || "/"}>{text(props.secondaryLabel) || "Back to Home"}</Link>
              </Button>
            </div>
          </div>
        </section>
      );
    }

    if (layout === "aboutphonepair" || layout === "phonepair") {
      return (
        <section className="bg-primary px-4 py-20 text-center text-white">
          <div className="container mx-auto">
            <h2 className="mb-6 text-3xl font-heading font-bold" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>
            {text(props.body) && <p className="mx-auto mb-6 max-w-2xl text-primary-foreground/85" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-8 text-lg">
                <Link href={safeCmsHref(text(props.href)) || "/contact"}>{text(props.label) || "Contact Doug Today"} <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button variant="secondary" size="lg" className="h-12 px-8 text-lg font-bold text-primary" asChild>
                <a href={identity.phoneHref}>
                  <Phone className="mr-2 h-5 w-5" />
                  Call {identity.phone}
                </a>
              </Button>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="bg-primary px-4 py-14 text-primary-foreground">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>
            {text(props.body) && <p className="mt-2 text-primary-foreground/85" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          </div>
          <CmsActionButton href={text(props.href)} label={text(props.label)} variant="secondary" />
        </div>
      </section>
    );
  }

  if (block.type === "content") {
    const layout = normalizeCmsLayout(text(props.variant) ?? text(props.layout));

    if (layout === "centeredintro" || layout === "serviceintro") {
      const tone = normalizeCmsLayout(text(props.tone) ?? text(props.background) ?? text(props.sectionTone));
      const sectionClass = tone === "muted" ? "bg-muted/50 px-4 py-16 md:py-20" : "px-4 py-16 md:py-20";

      return (
        <section className={sectionClass}>
          <div className="container mx-auto">
            <div className="mx-auto max-w-3xl text-center">
              {text(props.title) && <h2 className="mb-6 text-3xl font-heading font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
              {text(props.body) && <p className="text-lg text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
            </div>
          </div>
        </section>
      );
    }

    if (layout === "servicearea" || layout === "serviceareaband") {
      return (
        <section className="px-4 py-16 text-center">
          <div className="container mx-auto">
            {text(props.title) && <h2 className="mb-6 text-2xl font-heading font-bold" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
            {text(props.body) && <p className="mx-auto max-w-3xl text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          </div>
        </section>
      );
    }

    return (
      <section className="px-4 py-14">
        <div className="mx-auto max-w-3xl">
          {text(props.eyebrow) && <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
          {text(props.title) && <h2 className="text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
          {text(props.body) && <CmsPageRichText body={text(props.body)!} />}
          <CmsActionButton href={text(props.href)} label={text(props.label)} className="mt-6" />
        </div>
      </section>
    );
  }

  if (block.type === "featureGrid") {
    const items = textList(props.items);
    const layout = normalizeCmsLayout(text(props.variant) ?? text(props.layout));

    if (layout === "benefitcards" || layout === "servicebenefits") {
      const tone = normalizeCmsLayout(text(props.tone) ?? text(props.background) ?? text(props.sectionTone));
      const sectionClass = tone === "muted" ? "bg-muted/50 px-4 py-16 md:py-20" : "px-4 py-16 md:py-20";

      return (
        <section className={sectionClass}>
          <div className="container mx-auto">
            {text(props.title) && <h2 className="mb-12 text-center text-3xl font-heading font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item, index) => {
                const [title, body] = item.split("|").map((part) => part.trim());
                if (!title) return null;
                return (
                  <Card key={`${title}-${index}`} className="border-none shadow-lg">
                    <CardContent className="px-6 pb-6 pt-8">
                      <CmsBenefitIcon title={title} />
                      <h3 className="mb-3 text-xl font-bold" style={cmsTypeStyle("h3", "1.5rem")}>{title}</h3>
                      {body && <p className="text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{body}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    if (layout === "iconcolumns" || layout === "serviceiconcolumns") {
      const tone = normalizeCmsLayout(text(props.tone) ?? text(props.background) ?? text(props.sectionTone));
      const sectionClass = tone === "muted" ? "bg-muted/50 px-4 py-16 md:py-20" : "px-4 py-16 md:py-20";

      return (
        <section className={sectionClass}>
          <div className="container mx-auto">
            {text(props.title) && <h2 className="mb-12 text-center text-3xl font-heading font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {items.map((item, index) => {
                const [title, body] = item.split("|").map((part) => part.trim());
                if (!title) return null;
                return (
                  <div key={`${title}-${index}`} className="text-center">
                    <CmsColumnIcon title={title} />
                    <h3 className="mb-2 text-xl font-bold" style={cmsTypeStyle("h3", "1.5rem")}>{title}</h3>
                    {body && <p className="text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{body}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    if (layout === "valuecards" || layout === "aboutvalues") {
      return (
        <section className="bg-muted/30 px-4 py-20">
          <div className="container mx-auto">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              {text(props.title) && <h2 className="mb-4 text-3xl font-heading font-bold" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
              {text(props.body) && <p className="text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {items.map((item, index) => {
                const [title, body] = item.split("|").map((part) => part.trim());
                if (!title) return null;
                return (
                  <Card key={`${title}-${index}`}>
                    <CardContent className="pt-6">
                      <h3 className="mb-3 text-xl font-bold text-primary" style={cmsTypeStyle("h3", "1.5rem")}>{title}</h3>
                      {body && <p className="text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{body}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    if (layout === "servicecards" || layout === "publichomeservices") {
      return (
        <section className="bg-muted/50 px-4 py-16">
          <div className="container mx-auto">
            <div className="mb-12 text-center">
              {text(props.eyebrow) && <span className="text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</span>}
              {text(props.title) && <h2 className="mt-2 text-3xl font-heading font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
              {text(props.body) && <p className="mx-auto mt-4 max-w-2xl text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {items.map((item, index) => {
                const [title, body, href, label] = item.split("|").map((part) => part.trim());
                const safeHref = safeCmsHref(href);
                if (!title) return null;
                return (
                  <Card key={`${title}-${index}`} className="flex flex-col border-none bg-white p-6 text-center transition-shadow hover:shadow-lg">
                    <CardContent className="flex flex-1 flex-col pt-4">
                      <CmsServiceIcon title={title} />
                      <h3 className="mb-3 text-xl font-heading font-bold" style={cmsTypeStyle("h3", "1.5rem")}>{title}</h3>
                      {body && <p className="mb-4 flex-1 text-sm text-muted-foreground" style={cmsTypeStyle("small", "0.875rem")}>{body}</p>}
                      {safeHref && (
                        <Button asChild className="mt-auto" size="sm" variant="outline">
                          {isExternalCmsHref(safeHref) ? (
                            <a href={safeHref} target={safeHref.startsWith("http") ? "_blank" : undefined} rel={safeHref.startsWith("http") ? "noreferrer" : undefined}>
                              {label || "Learn More"} <ArrowRight className="ml-1 h-4 w-4" />
                            </a>
                          ) : (
                            <Link href={safeHref}>
                              {label || "Learn More"} <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          {text(props.eyebrow) && <p className="text-center text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
          {text(props.title) && <h2 className="mt-2 text-center text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
          {text(props.body) && <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {items.map((item, index) => {
              const [title, body, href, label] = item.split("|").map((part) => part.trim());
              if (!title) return null;
              return (
                <Card key={`${title}-${index}`} className="flex h-full flex-col">
                  <CardContent className="flex h-full flex-col p-5">
                    <h3 className="text-xl font-bold" style={cmsTypeStyle("h3", "1.5rem")}>{title}</h3>
                    {body && <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground" style={cmsTypeStyle("small", "0.875rem")}>{body}</p>}
                    <CmsActionButton href={href} label={label || "Learn More"} variant="outline" className="mt-5 w-fit" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "linkGrid") {
    const items = textList(props.items);
    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          {text(props.eyebrow) && <p className="text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
          {text(props.title) && <h2 className="mt-2 text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
          {text(props.body) && <p className="mt-4 max-w-3xl leading-8 text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => {
              const [title, body, href, label] = item.split("|").map((part) => part.trim());
              if (!title) return null;
              return (
                <Card key={`${title}-${index}`} className="flex h-full flex-col">
                  <CardContent className="flex h-full flex-col p-5">
                    <h3 className="text-xl font-bold" style={cmsTypeStyle("h3", "1.5rem")}>{title}</h3>
                    {body && <p className="mt-3 flex-1 leading-7 text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{body}</p>}
                    <CmsActionButton href={href} label={label || "Learn More"} variant="outline" className="mt-5 w-fit" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "serviceList") {
    const items = textList(props.items)
      .map((item) => {
        const [label, href] = item.split("|").map((part) => part.trim());
        const safeHref = safeCmsHref(href);
        return label ? { label, href: safeHref } : null;
      })
      .filter((item): item is { label: string; href: string } => Boolean(item));

    if (items.length === 0) return null;

    return (
      <section className="bg-slate-50 px-4 py-14">
        <div className="mx-auto max-w-5xl">
          {text(props.eyebrow) && <p className="text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
          {text(props.title) && <h2 className="mt-2 text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
          {text(props.body) && <p className="mt-4 max-w-3xl leading-8 text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              !item.href ? (
                <span
                  key={`${item.label}-${item.href}-${index}`}
                  className="rounded-md border bg-white px-4 py-3 text-sm font-semibold text-muted-foreground"
                >
                  {item.label}
                </span>
              ) : isExternalCmsHref(item.href) ? (
                <a
                  key={`${item.label}-${item.href}-${index}`}
                  href={item.href}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                  className="rounded-md border bg-white px-4 py-3 text-sm font-semibold transition hover:border-primary hover:text-primary"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={`${item.label}-${item.href}-${index}`}
                  href={item.href}
                  className="rounded-md border bg-white px-4 py-3 text-sm font-semibold transition hover:border-primary hover:text-primary"
                >
                  {item.label}
                </Link>
              )
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "statGrid") {
    const items = textList(props.items);
    return (
      <section className="bg-slate-50 px-4 py-14">
        <div className="mx-auto max-w-5xl">
          {text(props.title) && <h2 className="text-center text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
          {text(props.body) && <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item, index) => {
              const [value, label] = item.split("|").map((part) => part.trim());
              if (!value) return null;
              return (
                <div key={`${value}-${index}`} className="rounded-md border bg-white p-5 text-center shadow-sm">
                  <div className="text-3xl font-bold text-primary" style={cmsTypeStyle("h2", "2.25rem")}>{value}</div>
                  {label && <p className="mt-2 text-sm font-medium text-muted-foreground" style={cmsTypeStyle("small", "0.875rem")}>{label}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "splitContent") {
    const imageUrl = safeCmsAssetUrl(text(props.imageUrl));
    const layout = normalizeCmsLayout(text(props.variant) ?? text(props.layout));
    const stats = textList(props.stats);

    if (layout === "simpleservicedetail" || layout === "servicegroupdetail") {
      const imagePosition = normalizeCmsLayout(text(props.imagePosition) ?? "right");
      const itemStyle = normalizeCmsLayout(text(props.itemStyle) ?? "checklist");
      const panelTitle = text(props.panelTitle);
      const panelItems = textList(props.panelItems)
        .map((item) => {
          const [title, body] = item.split("|").map((part) => part.trim());
          return title ? { title, body } : null;
        })
        .filter((item): item is { title: string; body: string } => Boolean(item));
      const bodyParagraphs = text(props.body)
        ?.split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean) ?? [];
      const items = textList(props.items)
        .map((item) => {
          const [title, body] = item.split("|").map((part) => part.trim());
          return title ? { title, body } : null;
        })
        .filter((item): item is { title: string; body: string } => Boolean(item));
      const quoteHref = safeCmsHref(text(props.href)) || "/contact";
      const quoteLabel = text(props.label) || "Request a Quote";
      const callLabel = text(props.secondaryLabel) || `Call ${identity.phone}`;
      const content = (
        <div className={imagePosition === "left" ? "order-1 md:order-2" : ""}>
          {text(props.eyebrow) && <span className="text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</span>}
          {text(props.title) && (
            <h2 className="mb-6 mt-2 text-3xl font-heading font-bold text-primary" style={cmsTypeStyle("h2", "2.25rem")}>
              {text(props.title)}
            </h2>
          )}
          {bodyParagraphs.map((paragraph) => (
            <p key={paragraph} className="mb-6 text-lg leading-relaxed text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>
              {paragraph}
            </p>
          ))}
          {items.length > 0 && itemStyle === "borderlist" && (
            <div className="space-y-6">
              {items.map((item, index) => (
                <div key={`${item.title}-${index}`} className="border-l-4 border-primary pl-4">
                  <h3 className="mb-2 text-xl font-bold" style={cmsTypeStyle("h3", "1.5rem")}>{item.title}</h3>
                  {item.body && <p className="text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{item.body}</p>}
                </div>
              ))}
            </div>
          )}
          {items.length > 0 && itemStyle !== "borderlist" && (
            <ul className={`${itemStyle === "checkgrid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : "space-y-3"} mt-8`}>
              {items.map((item, index) => (
                <li key={`${item.title}-${index}`} className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <span className={itemStyle === "checkgrid" ? "font-medium" : ""}>{item.title}</span>
                </li>
              ))}
            </ul>
          )}
          {!panelTitle && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href={quoteHref}>{quoteLabel}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={identity.phoneHref}>
                  <Phone className="mr-2 h-5 w-5" />
                  {callLabel}
                </a>
              </Button>
            </div>
          )}
        </div>
      );
      const visual = panelTitle ? (
        <div className="flex flex-col justify-center rounded-xl bg-muted p-8">
          <h3 className="mb-4 text-2xl font-bold" style={cmsTypeStyle("h3", "1.5rem")}>{panelTitle}</h3>
          <div className="space-y-6">
            {panelItems.map((item, index) => (
              <div key={`${item.title}-${index}`}>
                <h4 className="mb-2 text-lg font-bold">{item.title}</h4>
                {item.body && <p className="text-sm text-muted-foreground" style={cmsTypeStyle("small", "0.875rem")}>{item.body}</p>}
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
            <Button asChild className="w-full py-6 text-lg">
              <Link href={quoteHref}>{quoteLabel}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full py-6 text-lg">
              <a href={identity.phoneHref}>
                <Phone className="mr-2 h-5 w-5" />
                {callLabel}
              </a>
            </Button>
          </div>
        </div>
      ) : imageUrl ? (
        <div className={`${imagePosition === "left" ? "order-2 md:order-1" : ""} min-h-[400px] overflow-hidden rounded-xl bg-muted`}>
          <CmsResponsiveImage
            src={imageUrl}
            alt={text(props.alt) ?? text(props.title) ?? ""}
            className="h-full w-full object-cover"
            loading="lazy"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      ) : null;

      return (
        <section className="px-4 py-20">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
              {content}
              {visual}
            </div>
          </div>
        </section>
      );
    }

    if (layout === "aboutstory" || layout === "aboutstorywithstats") {
      return (
        <section className="px-4 py-20">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              {imageUrl && (
                <div className="order-2 lg:order-1">
                  <CmsResponsiveImage
                    src={imageUrl}
                    alt={text(props.alt) ?? text(props.title) ?? ""}
                    className="h-[500px] w-full rounded-xl object-cover shadow-xl"
                    loading="lazy"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              )}
              <div className="order-1 lg:order-2">
                {text(props.eyebrow) && <span className="text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</span>}
                {text(props.title) && <h2 className="mb-6 mt-2 text-3xl font-heading font-bold" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
                {text(props.body) && <CmsPageRichText body={text(props.body)!} className="space-y-4 leading-relaxed" />}
                {stats.length > 0 && (
                  <div className="mt-8 grid grid-cols-2 gap-6">
                    {stats.map((item, index) => {
                      const [value, label] = item.split("|").map((part) => part.trim());
                      if (!value) return null;
                      return (
                        <div key={`${value}-${index}`} className="rounded-lg bg-muted/50 p-4">
                          <h3 className="mb-1 text-2xl font-bold text-primary" style={cmsTypeStyle("h3", "1.5rem")}>{value}</h3>
                          {label && <p className="text-sm font-medium" style={cmsTypeStyle("small", "0.875rem")}>{label}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      );
    }

    const imagePosition = normalizeCmsLayout(text(props.imagePosition) ?? "right");
    const badgeValue = text(props.badgeValue) ?? text(props.statValue);
    const badgeLabel = text(props.badgeLabel) ?? text(props.statLabel);

    return (
      <section className="px-4 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 md:items-center">
          <div className={imagePosition === "left" ? "order-2 md:order-2" : ""}>
            {text(props.eyebrow) && <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
            {text(props.title) && <h2 className="text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
            {text(props.body) && <CmsPageRichText body={text(props.body)!} />}
            <CmsActionButton href={text(props.href)} label={text(props.label)} className="mt-6" />
          </div>
          {imageUrl && (
            <div className={`${imagePosition === "left" ? "order-1 md:order-1" : ""} relative`}>
              <CmsResponsiveImage
                src={imageUrl}
                alt={text(props.alt) ?? text(props.title) ?? ""}
                className="h-auto max-h-[520px] w-full rounded-xl object-cover shadow-xl"
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {badgeValue && (
                <div className="absolute -bottom-4 -right-4 rounded-lg bg-primary p-4 text-white shadow-lg">
                  <div className="text-2xl font-bold">{badgeValue}</div>
                  {badgeLabel && <div className="text-sm">{badgeLabel}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (block.type === "steps") {
    const items = textList(props.items);
    const layout = normalizeCmsLayout(text(props.variant) ?? text(props.layout));

    if (layout === "processcards" || layout === "servicegroupprocess") {
      return (
        <section className="bg-muted/30 px-4 py-20">
          <div className="container mx-auto text-center">
            {text(props.title) && <h2 className="mb-12 text-3xl font-heading font-bold" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {items.map((item, index) => {
                const [stepTitle, stepBody] = item.split("|").map((part) => part.trim());
                if (!stepTitle) return null;
                return (
                  <div key={`${stepTitle}-${index}`} className="rounded-lg bg-white p-8 shadow-sm">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                      {index + 1}
                    </div>
                    <h3 className="mb-2 text-xl font-bold" style={cmsTypeStyle("h3", "1.5rem")}>{stepTitle}</h3>
                    {stepBody && <p className="text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{stepBody}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    if (layout === "processnumbers" || layout === "serviceprocess") {
      const tone = normalizeCmsLayout(text(props.tone) ?? text(props.background) ?? text(props.sectionTone));
      const sectionClass = tone === "muted" ? "bg-muted/50 px-4 py-16 md:py-20" : "px-4 py-16 md:py-20";

      return (
        <section className={sectionClass}>
          <div className="container mx-auto">
            {text(props.title) && <h2 className="mb-12 text-center text-3xl font-heading font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {items.map((item, index) => {
                const [stepTitle, stepBody] = item.split("|").map((part) => part.trim());
                if (!stepTitle) return null;
                return (
                  <div key={`${stepTitle}-${index}`} className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
                      {index + 1}
                    </div>
                    <h3 className="mb-2 text-xl font-bold" style={cmsTypeStyle("h3", "1.5rem")}>{stepTitle}</h3>
                    {stepBody && <p className="text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{stepBody}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          {text(props.eyebrow) && <p className="text-center text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
          {text(props.title) && <h2 className="mt-2 text-center text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
          {text(props.body) && <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {items.map((item, index) => {
              const [stepTitle, stepBody] = item.split("|").map((part) => part.trim());
              if (!stepTitle) return null;
              return (
                <Card key={`${stepTitle}-${index}`}>
                  <CardContent className="p-5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </div>
                    {stepBody ? (
                      <>
                        <h3 className="mt-4 text-lg font-bold" style={cmsTypeStyle("h3", "1.5rem")}>{stepTitle}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground" style={cmsTypeStyle("small", "0.875rem")}>{stepBody}</p>
                      </>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-muted-foreground" style={cmsTypeStyle("small", "0.875rem")}>{stepTitle}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "form") {
    return (
      <CmsFormBlock
        slug={text(props.formSlug) ?? "website-quote-request"}
        title={text(props.title)}
        body={text(props.body)}
        eyebrow={text(props.eyebrow)}
        formTitle={text(props.formTitle)}
        variant={text(props.variant) ?? text(props.layout)}
      />
    );
  }

  if (block.type === "contactInfo") {
    const configuredItems = textList(props.items)
      .map((item) => {
        const [label, value, href] = item.split("|").map((part) => part.trim());
        return label && value ? { label, value, href: safeCmsHref(href) } : null;
      })
      .filter((item): item is { label: string; value: string; href: string } => Boolean(item));
    const defaultItems = [
      { label: "Phone", value: identity.phone, href: identity.phoneHref },
      { label: "Email", value: identity.email, href: `mailto:${identity.email}` },
      { label: "Service Area", value: identity.market, href: "" },
      { label: "Address", value: identity.address, href: "" },
    ].filter((item) => item.value.trim());
    const items = configuredItems.length > 0 ? configuredItems : defaultItems;

    return (
      <section className="bg-slate-50 px-4 py-14">
        <div className="mx-auto max-w-5xl">
          {text(props.eyebrow) && <p className="text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
          {text(props.title) && <h2 className="mt-2 text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
          {text(props.body) && <p className="mt-4 max-w-3xl leading-8 text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => {
              const safeHref = safeCmsHref(item.href);
              const content = (
                <>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</span>
                  <span className="mt-2 block break-words text-lg font-semibold text-foreground">{item.value}</span>
                </>
              );

              return safeHref ? (
                <a
                  key={`${item.label}-${item.value}`}
                  href={safeHref}
                  className="rounded-md border bg-white p-5 transition hover:border-primary hover:text-primary"
                >
                  {content}
                </a>
              ) : (
                <div key={`${item.label}-${item.value}`} className="rounded-md border bg-white p-5">
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "image") {
    const imageUrl = safeCmsAssetUrl(text(props.imageUrl));
    if (!imageUrl) return null;
    const layout = normalizeCmsLayout(text(props.variant) ?? text(props.layout));

    if (layout === "fullwidthband" || layout === "imageband" || layout === "publichomeband") {
      return (
        <section className="relative h-[50vh] min-h-[400px]">
          <CmsResponsiveImage
            src={imageUrl}
            alt={text(props.alt) ?? text(props.title) ?? ""}
            className="h-full w-full object-cover"
            loading="lazy"
            sizes="100vw"
          />
          {text(props.showOverlay)?.trim().toLowerCase() !== "false" && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          )}
        </section>
      );
    }

    return (
      <section className="px-4 py-12">
        <figure className="mx-auto max-w-5xl">
          <CmsResponsiveImage
            src={imageUrl}
            alt={text(props.alt) ?? text(props.title) ?? ""}
            className="h-auto max-h-[620px] w-full rounded-md object-cover shadow-sm"
            loading="lazy"
            sizes="(max-width: 1024px) 100vw, 1024px"
          />
          {(text(props.caption) || text(props.title)) && (
            <figcaption className="mt-3 text-sm text-muted-foreground">
              {text(props.caption) ?? text(props.title)}
            </figcaption>
          )}
        </figure>
      </section>
    );
  }

  if (block.type === "galleryGrid") {
    const items = textList(props.items);
    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          {text(props.eyebrow) && <p className="text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
          {text(props.title) && <h2 className="mt-2 text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
          {text(props.body) && <p className="mt-4 max-w-3xl leading-8 text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => {
              const [url, caption] = item.split("|").map((part) => part.trim());
              const safeUrl = safeCmsAssetUrl(url);
              if (!safeUrl) return null;
              return (
                <figure key={`${safeUrl}-${index}`} className="overflow-hidden rounded-md border bg-white">
                  <CmsResponsiveImage
                    src={safeUrl}
                    alt={caption || text(props.title) || "Glass and door project"}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {caption && <figcaption className="p-3 text-sm text-muted-foreground">{caption}</figcaption>}
                </figure>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "mediaGallery") {
    return <CmsMediaGalleryBlock block={block} />;
  }

  if (block.type === "recentPosts") {
    return <CmsRecentPostsBlock block={block} />;
  }

  if (block.type === "testimonials") {
    return <CmsTestimonialsBlock block={block} />;
  }

  if (block.type === "faq") {
    const items = textList(props.items);
    const layout = normalizeCmsLayout(text(props.variant) ?? text(props.layout));

    if (layout === "faqcards" || layout === "servicefaqcards") {
      return (
        <section className="bg-muted/50 px-4 py-16">
          <div className="container mx-auto">
            {text(props.title) && <h2 className="mb-12 text-center text-3xl font-heading font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
            <div className="mx-auto max-w-3xl space-y-6">
              {items.map((item, index) => {
                const [question, answer] = item.split("|").map((part) => part.trim());
                if (!question) return null;
                return (
                  <div key={`${question}-${index}`} className="rounded-xl bg-white p-6 shadow-sm">
                    <h3 className="mb-2 text-lg font-bold" style={cmsTypeStyle("h3", "1.5rem")}>{question}</h3>
                    {answer && <p className="text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{answer}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          {text(props.eyebrow) && <p className="text-sm font-semibold uppercase tracking-wider text-primary">{text(props.eyebrow)}</p>}
          {text(props.title) && <h2 className="mt-2 text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
          {text(props.body) && <p className="mt-4 max-w-3xl leading-8 text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{text(props.body)}</p>}
          <div className="mt-8 divide-y rounded-md border bg-white">
            {items.map((item, index) => {
              const [question, answer] = item.split("|").map((part) => part.trim());
              if (!question) return null;
              return (
                <details key={`${question}-${index}`} className="group p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold" style={cmsTypeStyle("body", "1rem")}>
                    {question}
                    <span className="text-xl leading-none text-primary group-open:rotate-45">+</span>
                  </summary>
                  {answer && <p className="mt-3 leading-7 text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>{answer}</p>}
                </details>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-3xl">
        {text(props.title) && <h2 className="text-3xl font-bold" style={cmsTypeStyle("h2", "2.25rem")}>{text(props.title)}</h2>}
        {text(props.body) && <CmsPageRichText body={text(props.body)!} />}
      </div>
    </section>
  );
}

function getCmsPageFaqItems(blocks: CmsSectionBlock[]) {
  return blocks.flatMap((block) => {
    if (block.type !== "faq") return [];
    const props = block.props as Record<string, unknown>;
    const items = Array.isArray(props.items) ? props.items : [];
    return items.flatMap((item) => {
      if (typeof item !== "string") return [];
      const [question, answer] = item.split("|").map((part) => part.trim());
      return question && answer ? [{ question, answer }] : [];
    });
  });
}

function cmsBlockAnchorId(block: CmsSectionBlock) {
  const props = block.props as Record<string, unknown>;
  const raw =
    typeof props.anchorId === "string" ? props.anchorId :
    typeof props.anchor === "string" ? props.anchor :
    block.id;
  const cleaned = raw
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || undefined;
}

export function CmsAnchoredBlock({ block }: { block: CmsSectionBlock }) {
  const anchorId = cmsBlockAnchorId(block);

  return (
    <div id={anchorId}>
      <CmsBlock block={block} />
    </div>
  );
}

export function CmsPageView({ page, preview = false }: { page: CmsPage; preview?: boolean }) {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const faqItems = getCmsPageFaqItems(page.content.sections);
  const pageSidebar = findPageSidebar(siteData.sidebars, page);
  const hasSidebar = Boolean(pageSidebar?.widgets.length);
  const canonicalUrl = cmsPageCanonicalUrl(page, identity.siteUrl);
  const shouldRenderStructuredData = !preview && !page.seo.noIndex;

  usePageMeta(
    page.seo.metaTitle ?? `${page.title} | ${identity.siteName}`,
    page.seo.metaDescription ?? page.excerpt ?? `${identity.siteName} CMS page`,
    {
      ogTitle: page.seo.ogTitle,
      ogDescription: page.seo.ogDescription,
      ogImage: safeCmsAssetUrl(page.seo.ogImage) || undefined,
      canonicalUrl: preview ? undefined : canonicalUrl,
      ogUrl: preview ? undefined : canonicalUrl,
      noIndex: preview || page.seo.noIndex,
    },
  );

  return (
    <Layout>
      {shouldRenderStructuredData && <BreadcrumbSchema items={cmsPageBreadcrumbItems(page, identity.siteUrl)} />}
      {shouldRenderStructuredData && (
        <WebPageSchema
          name={page.seo.ogTitle ?? page.seo.metaTitle ?? page.title}
          description={cmsPageDescription(page)}
          url={canonicalUrl}
        />
      )}
      {shouldRenderStructuredData && page.slug === "home" && <LocalBusinessSchema />}
      {shouldRenderStructuredData && cmsPageServiceSlugs.has(page.slug) && (
        <ServiceSchema
          name={page.title}
          description={cmsPageDescription(page)}
          url={canonicalUrl}
        />
      )}
      {shouldRenderStructuredData && <FAQSchema items={faqItems} />}
      {hasSidebar ? (
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_320px] lg:items-start">
          <main className="min-w-0 overflow-hidden">
            {page.content.sections.map((block, index) => (
              <CmsAnchoredBlock key={block.id ?? `${block.type}-${index}`} block={block} />
            ))}
          </main>
          <CmsWidgetStack widgets={pageSidebar?.widgets ?? []} />
        </div>
      ) : (
        page.content.sections.map((block, index) => (
          <CmsAnchoredBlock key={block.id ?? `${block.type}-${index}`} block={block} />
        ))
      )}
    </Layout>
  );
}

function CmsPageFallbackBridge({ page, fallback }: { page: CmsPage; fallback: React.ReactNode }) {
  const identity = getPublicBusinessIdentity(usePublicSite());
  const canonicalUrl = cmsPageCanonicalUrl(page, identity.siteUrl);

  usePageMeta(
    page.seo.metaTitle ?? `${page.title} | ${identity.siteName}`,
    page.seo.metaDescription ?? page.excerpt ?? `${identity.siteName} CMS page`,
    {
      ogTitle: page.seo.ogTitle,
      ogDescription: page.seo.ogDescription,
      ogImage: safeCmsAssetUrl(page.seo.ogImage) || undefined,
      canonicalUrl,
      ogUrl: canonicalUrl,
      noIndex: page.seo.noIndex,
      force: true,
    },
  );

  return <PageMetaSuppressionProvider>{fallback}</PageMetaSuppressionProvider>;
}

function CmsPageEmptyPreview({ page }: { page: CmsPage }) {
  const identity = getPublicBusinessIdentity(usePublicSite());

  usePageMeta(
    `Preview: ${page.title} | ${identity.siteName}`,
    page.excerpt ?? "This CMS page is ready for sections.",
    { noIndex: true },
  );

  return (
    <Layout>
      <section className="bg-slate-50 px-4 py-16">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">CMS Page Preview</p>
            <CardTitle className="text-3xl">{page.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              This page exists in the CMS, but it does not have sections yet. Add sections in the page editor before using it as migrated public content.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {page.excerpt && <p className="leading-7 text-muted-foreground">{page.excerpt}</p>}
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-md border bg-white p-3">
                <div className="text-xs text-muted-foreground">Slug</div>
                <div className="mt-1 font-semibold">{page.slug}</div>
              </div>
              <div className="rounded-md border bg-white p-3">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="mt-1 font-semibold">{page.status}</div>
              </div>
              <div className="rounded-md border bg-white p-3">
                <div className="text-xs text-muted-foreground">Sections</div>
                <div className="mt-1 font-semibold">0</div>
              </div>
            </div>
            <Button asChild>
              <Link href={`/admin?tool=pages&record=${encodeURIComponent(page.id)}`}>Open Page Editor</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}

function CmsSectionPreview({ section }: { section: CmsSection }) {
  const identity = getPublicBusinessIdentity(usePublicSite());

  usePageMeta(
    `Preview: ${section.name} | ${identity.siteName}`,
    `Reusable CMS section preview for ${identity.siteName}.`,
    { noIndex: true },
  );

  return (
    <Layout>
      <section className="border-b bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">CMS Section Preview</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl" style={cmsTypeStyle("h1", "2.5rem")}>{section.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{section.handle}</Badge>
            <Badge variant="secondary">{section.category}</Badge>
            <Badge variant={section.isReusable ? "default" : "outline"}>
              {section.isReusable ? "Reusable" : "Not reusable"}
            </Badge>
          </div>
        </div>
      </section>
      {section.blocks.length > 0 ? (
        section.blocks.map((block, index) => (
          <CmsAnchoredBlock key={block.id ?? `${block.type}-${index}`} block={block} />
        ))
      ) : (
        <section className="px-4 py-16">
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">No blocks yet</CardTitle>
              <p className="text-sm text-muted-foreground">
                Add blocks in the Section Library before using this reusable section on CMS pages.
              </p>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/admin?tool=sections&record=${encodeURIComponent(section.id)}`}>Open Section Editor</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
    </Layout>
  );
}

export function CmsPreviewUnavailable({
  editorHref,
  resourceLabel,
}: {
  editorHref: string;
  resourceLabel: string;
}) {
  const identity = getPublicBusinessIdentity(usePublicSite());

  usePageMeta(
    `Preview Unavailable | ${identity.siteName}`,
    `Sign in to the admin CMS to preview this ${resourceLabel}.`,
    { noIndex: true },
  );

  return (
    <Layout>
      <section className="bg-slate-50 px-4 py-16">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">CMS Preview</p>
            <CardTitle className="text-3xl">Preview Unavailable</CardTitle>
            <p className="text-sm text-muted-foreground">
              The preview could not be loaded. Sign in to the admin dashboard, then reopen the preview from the editor.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={editorHref}>Open Admin Editor</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}

export function CmsPageRoute({
  slug,
  fallback,
  deferFallback = false,
  preserveFallbackUntilCmsEnabled = false,
}: {
  slug: string;
  fallback: React.ReactNode;
  deferFallback?: boolean;
  preserveFallbackUntilCmsEnabled?: boolean;
}) {
  const siteData = usePublicSite();
  const shouldPreserveFallback = preserveFallbackUntilCmsEnabled && !siteData.isPublicCmsPreview && !publicCmsEnabled(siteData.settings);
  const { data: page, isLoading } = useQuery<CmsPage | null>({
    queryKey: [cmsPageApiPath(slug)],
    retry: false,
    throwOnError: false,
    enabled: !shouldPreserveFallback,
  });

  if (shouldPreserveFallback) {
    return <>{fallback}</>;
  }

  if (page?.content.sections?.length) {
    return <CmsPageView page={page} />;
  }

  if (page) {
    return <CmsPageFallbackBridge page={page} fallback={fallback} />;
  }

  if (deferFallback && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return <>{fallback}</>;
}

export function CmsPagePreviewRoute({ id, fallback }: { id: string; fallback: React.ReactNode }) {
  const { data: page, isError, isLoading } = useQuery<CmsPage | null>({
    queryKey: [`/api/admin/cms/pages/${encodeURIComponent(id)}/preview`],
    retry: false,
    throwOnError: false,
  });

  if (page?.content.sections?.length) {
    return <CmsPageView page={page} preview />;
  }

  if (page) {
    return <CmsPageEmptyPreview page={page} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-muted-foreground">
        Loading preview...
      </div>
    );
  }

  if (isError) {
    return (
      <CmsPreviewUnavailable
        resourceLabel="page"
        editorHref={`/admin?tool=pages&record=${encodeURIComponent(id)}`}
      />
    );
  }

  return <>{fallback}</>;
}

export function CmsSectionPreviewRoute({ id }: { id: string }) {
  const { data: section, isError, isLoading } = useQuery<CmsSection | null>({
    queryKey: [`/api/admin/cms/sections/${encodeURIComponent(id)}/preview`],
    retry: false,
    throwOnError: false,
  });

  if (section) {
    return <CmsSectionPreview section={section} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-muted-foreground">
        Loading preview...
      </div>
    );
  }

  if (isError) {
    return (
      <CmsPreviewUnavailable
        resourceLabel="section"
        editorHref={`/admin?tool=sections&record=${encodeURIComponent(id)}`}
      />
    );
  }

  return (
    <CmsPreviewUnavailable
      resourceLabel="section"
      editorHref={`/admin?tool=sections&record=${encodeURIComponent(id)}`}
    />
  );
}
