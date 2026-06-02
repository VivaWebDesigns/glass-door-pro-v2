import { storage } from "./storage";
import { getPublicBusinessIdentity, type PublicBusinessIdentity } from "./public-identity";

type PageMeta = {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  noIndex?: boolean;
  type?: "website" | "article";
};

const AREAS_SERVED = [
  "Charlotte, NC",
  "Monroe, NC",
  "Indian Trail, NC",
  "Matthews, NC",
  "Mint Hill, NC",
  "Waxhaw, NC",
  "Huntersville, NC",
  "Cornelius, NC",
  "Davidson, NC",
  "Concord, NC",
  "Pineville, NC",
  "Stallings, NC",
  "Tega Cay, SC",
  "Fort Mill, SC",
  "Rock Hill, SC",
];

const FAQ_AREAS_ANSWER =
  "We serve Charlotte, Matthews, Mint Hill, Monroe, Pineville, Huntersville, Cornelius, Davidson, Concord, Tega Cay, Waxhaw, Indian Trail, Stallings, Fort Mill, Rock Hill, and surrounding areas.";

const LOCAL_BUSINESS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Glass and Door Pro",
  url: "https://glassanddoorpro.com",
  telephone: "+17047716111",
  email: "Doug@GlassandDoorPro.com",
  description:
    "Glass and door installation company serving Charlotte, Monroe, Indian Trail, Matthews, Waxhaw, and the greater Charlotte metro. Specializing in frameless shower doors, window installation, window repair, door installation, and commercial glass.",
  areaServed: AREAS_SERVED,
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "07:00",
      closes: "18:00",
    },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Glass and Door Services",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Frameless Shower Door Installation" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Window Installation" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Window Repair" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Door Installation" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Commercial Glass Installation" } },
    ],
  },
  sameAs: [
    "https://www.thumbtack.com/nc/monroe/doors/glass-door-pro/service/425943249063460866",
    "https://nextdoor.com/pages/glass-and-door-pro-monroe-nc/",
  ],
};

type FaqEntry = { q: string; a: string };

const SERVICE_STRUCTURED_DATA: Record<
  string,
  { service: object; faq: FaqEntry[] }
> = {
  "/services/frameless-showers": {
    service: {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: "Frameless Shower Door Installation",
      provider: { "@type": "LocalBusiness", name: "Glass and Door Pro" },
      areaServed: "Charlotte, NC and greater Charlotte metro",
      description:
        "Custom frameless glass shower door installation using precision-measured tempered safety glass and premium hardware. Serving Charlotte, Monroe, Indian Trail, Waxhaw, and surrounding areas.",
    },
    faq: [
      {
        q: "How long does installation take?",
        a: "Most frameless shower installations are completed in 2-4 hours, depending on the complexity of your design.",
      },
      {
        q: "What thickness of glass do you use?",
        a: 'We typically use 3/8" or 1/2" thick tempered safety glass, which provides excellent durability and a premium look.',
      },
      {
        q: "Do you offer different hardware finishes?",
        a: "Yes! We offer chrome, brushed nickel, oil-rubbed bronze, matte black, gold, and other finishes to match your bathroom.",
      },
      {
        q: "How do I maintain my frameless shower?",
        a: "Simply squeegee after each use and clean weekly with a non-abrasive glass cleaner. We can also apply protective coatings.",
      },
      { q: "What areas do you serve?", a: FAQ_AREAS_ANSWER },
    ],
  },
  "/services/window-installation": {
    service: {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: "Residential Window Installation",
      provider: { "@type": "LocalBusiness", name: "Glass and Door Pro" },
      areaServed: "Charlotte, NC and greater Charlotte metro",
      description:
        "Energy-efficient residential window installation and replacement serving Charlotte, Monroe, Indian Trail, Matthews, and surrounding areas. Double-hung, casement, sliding, bay, and picture windows.",
    },
    faq: [
      {
        q: "How long does window replacement take?",
        a: "Most single window replacements take 30-60 minutes. A full home can typically be completed in 1-2 days.",
      },
      {
        q: "What types of windows do you install?",
        a: "We install double-hung, casement, sliding, bay, bow, picture windows, and more in various materials including vinyl, wood, and fiberglass.",
      },
      {
        q: "Do you remove and dispose of old windows?",
        a: "Yes, we handle complete removal and disposal of your old windows, leaving your home clean and tidy.",
      },
      {
        q: "Are your windows energy efficient?",
        a: "We offer ENERGY STAR certified windows with Low-E glass, argon gas fills, and insulated frames for maximum efficiency.",
      },
      { q: "What areas do you serve?", a: FAQ_AREAS_ANSWER },
    ],
  },
  "/services/door-installation": {
    service: {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: "Door Installation",
      provider: { "@type": "LocalBusiness", name: "Glass and Door Pro" },
      areaServed: "Charlotte, NC and greater Charlotte metro",
      description:
        "Entry door, patio door, French door, sliding glass door, and storm door installation serving Charlotte, Monroe, Indian Trail, and surrounding areas.",
    },
    faq: [
      {
        q: "What types of doors do you install?",
        a: "We install entry doors, French doors, patio doors, sliding glass doors, storm doors, and interior doors in various materials.",
      },
      {
        q: "How long does door installation take?",
        a: "Most single door installations are completed in 2-4 hours. Complex installations like French or patio doors may take longer.",
      },
      {
        q: "What door materials are available?",
        a: "We offer fiberglass, steel, wood, and composite doors. Each has benefits for durability, insulation, and aesthetics.",
      },
      {
        q: "Do you install door hardware?",
        a: "Yes, we install all hardware including handles, locks, deadbolts, hinges, and smart lock systems.",
      },
      { q: "What areas do you serve?", a: FAQ_AREAS_ANSWER },
    ],
  },
  "/services/window-repair": {
    service: {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: "Window Glass Repair",
      provider: { "@type": "LocalBusiness", name: "Glass and Door Pro" },
      areaServed: "Charlotte, NC and greater Charlotte metro",
      description:
        "Fast window glass repair for broken panes, foggy windows, failed seals, and storm damage. Serving Charlotte, Monroe, Indian Trail, and surrounding areas. Same-week service available.",
    },
    faq: [
      {
        q: "How much does window repair cost?",
        a: "Costs vary depending on window size, glass type, and repair complexity. We provide free estimates so you know the exact cost before we begin.",
      },
      {
        q: "Can you repair just the glass without replacing the whole window?",
        a: "Yes! In many cases, we can replace just the glass pane or insulated glass unit, saving you money compared to full window replacement.",
      },
      {
        q: "How long does window repair take?",
        a: "Most single-window repairs are completed in under an hour. Larger projects or custom glass may require 1-2 days for fabrication.",
      },
      {
        q: "Do you offer emergency window repair?",
        a: "Yes, we offer priority scheduling for emergency situations like broken windows that compromise your home's security.",
      },
      { q: "What areas do you serve?", a: FAQ_AREAS_ANSWER },
    ],
  },
  "/services/commercial-glass": {
    service: {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: "Commercial Glass Installation",
      provider: { "@type": "LocalBusiness", name: "Glass and Door Pro" },
      areaServed: "Charlotte, NC and greater Charlotte metro",
      description:
        "Commercial storefront glass, office partitions, curtain wall systems, and emergency glass repair for Charlotte-area businesses. Fast response, licensed and insured.",
    },
    faq: [
      {
        q: "What types of commercial properties do you serve?",
        a: "We serve retail stores, restaurants, office buildings, medical facilities, warehouses, and all types of commercial properties in the Charlotte area.",
      },
      {
        q: "Do you offer emergency board-up services?",
        a: "Yes, we provide emergency board-up and temporary glazing services to secure your property until permanent repairs can be completed.",
      },
      {
        q: "Can you work after business hours?",
        a: "Absolutely. We offer flexible scheduling including evenings and weekends to minimize disruption to your business operations.",
      },
      {
        q: "Do you handle insurance claims?",
        a: "We can work with your insurance company and provide detailed documentation to help streamline your claim process.",
      },
      { q: "What areas do you serve?", a: FAQ_AREAS_ANSWER },
    ],
  },
};

function buildStaticPageMeta(identity: PublicBusinessIdentity): Record<string, PageMeta> {
  return {
    "/": {
      title: "Glass and Door Pro | Charlotte, NC | Monroe & Surrounding Areas",
      description:
        "Glass and door installation serving Charlotte, Monroe, and the greater Charlotte metro. Frameless showers, windows, doors, and commercial glass. Call (704) 771-6111.",
    },
    "/services": {
      title: `Glass & Door Services | ${identity.siteName}`,
      description:
        `Explore ${identity.siteName} services for frameless shower doors, window installation, door installation, window repair, and commercial glass in ${identity.market}. Call ${identity.phone} for a free quote.`,
    },
    "/about": {
      title: `About ${identity.siteName} | ${identity.market}`,
      description:
        `Meet Doug Adams and learn about ${identity.siteName}'s glass, shower, window, and door installation work in ${identity.market}.`,
    },
    "/contact": {
      title: `Contact ${identity.siteName} | Free Quote | ${identity.market}`,
      description:
        `Request a free quote from ${identity.siteName}. Serving ${identity.market} for shower glass, windows, doors, repairs, and commercial glass. Call ${identity.phone}.`,
    },
    "/blog": {
      title: `Blog | ${identity.siteName}`,
      description: identity.description,
    },
    "/services/frameless-showers": {
      title: "Frameless Shower Doors Charlotte NC | Monroe, Indian Trail & Surrounding Areas | Glass and Door Pro",
      description:
        "Custom frameless glass shower doors in Charlotte, Monroe, and Indian Trail NC. Precision-measured, premium hardware, 15+ years experience. Call (704) 771-6111.",
    },
    "/services/showers": {
      title: `Frameless Glass Showers | ${identity.siteName}`,
      description:
        `Custom-cut frameless shower glass and heavy glass enclosures from ${identity.siteName}. Call ${identity.phone} to request a shower quote.`,
    },
    "/services/window-installation": {
      title: "Window Installation Charlotte NC | Monroe, Indian Trail & Surrounding Areas | Glass and Door Pro",
      description:
        "Energy-efficient window replacement in Charlotte, Monroe, and Indian Trail NC. All styles and materials. Free estimates. Call Glass and Door Pro: (704) 771-6111.",
    },
    "/services/windows": {
      title: `Residential Windows | ${identity.siteName}`,
      description:
        `Residential window replacement and professional installation from ${identity.siteName}. Call ${identity.phone} to request a window quote.`,
    },
    "/services/door-installation": {
      title: "Door Installation Charlotte NC | Monroe, Indian Trail & Surrounding Areas | Glass and Door Pro",
      description:
        "Entry, patio, and French door installation in Charlotte and Monroe NC. Licensed installer, all door types. Free quote — call (704) 771-6111.",
    },
    "/services/doors": {
      title: `Professional Door Installation | ${identity.siteName}`,
      description:
        `Exterior, patio, and interior door installation from ${identity.siteName}. Call ${identity.phone} to request a door quote.`,
    },
    "/services/window-repair": {
      title: "Window Repair Charlotte NC | Monroe, Indian Trail & Surrounding Areas | Glass and Door Pro",
      description:
        "Broken panes, foggy glass, and seal failures repaired in Charlotte and Monroe NC. Same-week service available. Free estimates. Call (704) 771-6111.",
    },
    "/services/commercial-glass": {
      title: "Commercial Glass Charlotte NC | Monroe, Indian Trail & Surrounding Areas | Glass and Door Pro",
      description:
        "Storefront glass, office partitions, and emergency repairs in Charlotte and Monroe NC. Fast response, licensed and insured. Call (704) 771-6111.",
    },
    "/gallery": {
      title: "Project Gallery | Glass and Door Pro | Charlotte, NC & Surrounding Areas",
      description:
        `Browse frameless shower door installations, window projects, and door work completed by ${identity.siteName} across ${identity.market}.`,
    },
  };
}

function buildStructuredData(pathname: string): string {
  const blocks: object[] = [LOCAL_BUSINESS_SCHEMA];
  const serviceData = SERVICE_STRUCTURED_DATA[pathname];
  if (serviceData) {
    blocks.push(serviceData.service);
    blocks.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: serviceData.faq.map((entry) => ({
        "@type": "Question",
        name: entry.q,
        acceptedAnswer: { "@type": "Answer", text: entry.a },
      })),
    });
  }
  return blocks
    .map((block) => `<script type="application/ld+json">\n${JSON.stringify(block, null, 2)}\n</script>`)
    .join("\n    ");
}

function normalisePath(requestUrl: string) {
  const pathname = requestUrl.split("?")[0];
  return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
}

function cmsPageUrl(slug: string) {
  if (slug === "home") return "/";
  if (
    slug === "about" ||
    slug === "contact" ||
    slug === "gallery" ||
    slug === "blog" ||
    slug === "services" ||
    slug.startsWith("services/")
  ) return `/${slug}`;
  return `/page/${slug.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function siteUrl(identity: PublicBusinessIdentity) {
  return identity.siteUrl.replace(/\/$/, "");
}

function absoluteSiteUrl(identity: PublicBusinessIdentity, pathname: string) {
  return `${siteUrl(identity)}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function absoluteMetaAssetUrl(identity: PublicBusinessIdentity, value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return absoluteSiteUrl(identity, value);
}

function pathToCmsPageSlug(pathname: string) {
  if (pathname === "/") return "home";
  if (pathname === "/about") return "about";
  if (pathname === "/contact") return "contact";
  if (pathname === "/gallery") return "gallery";
  if (pathname === "/blog") return "blog";
  if (pathname === "/services") return "services";
  if (pathname.startsWith("/services/")) return decodeURIComponent(pathname.slice(1));
  if (pathname.startsWith("/page/")) return decodeURIComponent(pathname.replace(/^\/page\//, ""));
  if (pathname.startsWith("/") && pathname.length > 1) return decodeURIComponent(pathname.slice(1));
  return null;
}

async function getCmsPageMeta(pathname: string, identity: PublicBusinessIdentity): Promise<PageMeta | null> {
  const slug = pathToCmsPageSlug(pathname);
  if (!slug) return null;
  const page = await storage.getPageBySlug(slug);
  if (!page || page.status !== "published") return null;

  const description = page.seo.metaDescription ?? page.excerpt ?? `${identity.siteName} CMS page`;
  return {
    title: page.seo.metaTitle ?? `${page.title} | ${identity.siteName}`,
    description,
    canonical: page.seo.canonicalUrl || absoluteSiteUrl(identity, cmsPageUrl(page.slug)),
    image: page.seo.ogImage,
    noIndex: page.seo.noIndex,
    type: "website",
  };
}

async function getCmsBlogPostMeta(pathname: string, identity: PublicBusinessIdentity): Promise<PageMeta | null> {
  if (!pathname.startsWith("/blog/")) return null;
  const slug = decodeURIComponent(pathname.replace(/^\/blog\//, ""));
  if (!slug) return null;
  const post = await storage.getPostBySlug(slug);
  if (!post || post.status !== "published") return null;
  const featuredImage = post.featuredImageId ? await storage.getCms("media", post.featuredImageId) : null;
  const image =
    post.seo.ogImage ||
    (featuredImage?.mimeType.startsWith("image/") ? featuredImage.url : undefined);

  const description = post.seo.metaDescription ?? post.excerpt ?? `${identity.siteName} blog post`;
  return {
    title: post.seo.metaTitle ?? `${post.title} | ${identity.siteName}`,
    description,
    canonical: post.seo.canonicalUrl || absoluteSiteUrl(identity, `/blog/${encodeURIComponent(post.slug)}`),
    image,
    noIndex: post.seo.noIndex,
    type: "article",
  };
}

async function getCmsRouteMeta(pathname: string, identity: PublicBusinessIdentity) {
  try {
    return (await getCmsBlogPostMeta(pathname, identity)) ?? (await getCmsPageMeta(pathname, identity));
  } catch (error) {
    console.warn("CMS metadata lookup failed, falling back to static metadata:", error);
    return null;
  }
}

export async function buildHeadTags(requestUrl: string): Promise<string> {
  const normalised = normalisePath(requestUrl);
  const identity = await getPublicBusinessIdentity();
  const staticMeta = buildStaticPageMeta(identity);
  const routeMeta = await getCmsRouteMeta(normalised, identity);
  const adminMeta: PageMeta | null = normalised === "/admin" || normalised.startsWith("/admin/")
    ? {
        title: `${identity.siteName} Admin CMS`,
        description: `Administrative workspace for ${identity.siteName}.`,
        canonical: absoluteSiteUrl(identity, "/admin"),
        noIndex: true,
      }
    : null;
  const meta =
    adminMeta ??
    routeMeta ??
    staticMeta[normalised] ??
    {
      title: `Page Not Found | ${identity.siteName}`,
      description: `This ${identity.siteName} page is not available yet.`,
      canonical: absoluteSiteUrl(identity, "/"),
      noIndex: true,
    };
  const canonical =
    meta.canonical ?? absoluteSiteUrl(identity, normalised === "/" ? "/" : normalised);
  const image = absoluteMetaAssetUrl(identity, meta.image ?? "/opengraph.jpg");

  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const metaTags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:type" content="${meta.type ?? "website"}" />`,
    `<meta property="og:site_name" content="${esc(identity.siteName)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    ...(meta.noIndex ? [`<meta name="robots" content="noindex,nofollow" />`] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ].join("\n    ");

  const structuredData = adminMeta ? "" : buildStructuredData(normalised);

  return structuredData ? `${metaTags}\n    ${structuredData}` : metaTags;
}
