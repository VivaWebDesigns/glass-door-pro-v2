import { getPublicBusinessIdentity, usePublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";

const DEFAULT_SCHEMA_BASE_URL = "https://glassanddoorpro.com";

const BUSINESS_BASE = {
  "@type": "LocalBusiness",
  "@id": "https://glassanddoorpro.com/#business",
  name: "Glass & Door Pro",
  url: "https://glassanddoorpro.com",
  telephone: "+1-704-771-6111",
  email: "Doug@GlassandDoorPro.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Charlotte",
    addressRegion: "NC",
    addressCountry: "US",
  },
  founder: {
    "@type": "Person",
    name: "Doug Adams",
  },
  areaServed: [
    { "@type": "City", name: "Charlotte", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Monroe", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Matthews", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Mint Hill", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Pineville", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Huntersville", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Cornelius", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Davidson", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Concord", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Waxhaw", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Indian Trail", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Stallings", containedInPlace: { "@type": "State", name: "North Carolina" } },
    { "@type": "City", name: "Fort Mill", containedInPlace: { "@type": "State", name: "South Carolina" } },
    { "@type": "City", name: "Rock Hill", containedInPlace: { "@type": "State", name: "South Carolina" } },
    { "@type": "City", name: "Tega Cay", containedInPlace: { "@type": "State", name: "South Carolina" } },
  ],
  description:
    "Professional glass and door installation company serving the Charlotte, NC metro area. Specializing in frameless glass shower doors, residential window installation, door installation, window repair, and commercial glass services. Over 15 years of experience.",
  knowsAbout: [
    "Frameless glass shower doors",
    "Window installation",
    "Door installation",
    "Window repair",
    "Commercial glass",
  ],
  priceRange: "$$",
};

function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const jsonLd = Array.isArray(data)
    ? data.map((d) => ({ "@context": "https://schema.org", ...d }))
    : { "@context": "https://schema.org", ...data };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

function schemaBaseUrl(siteUrl: string) {
  try {
    const parsed = new URL(siteUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString().replace(/\/$/, "")
      : DEFAULT_SCHEMA_BASE_URL;
  } catch {
    return DEFAULT_SCHEMA_BASE_URL;
  }
}

const businessSchemaId = (siteUrl: string) => `${schemaBaseUrl(siteUrl)}/#business`;

function normalizeSiteUrl(url: string, siteUrl: string) {
  const base = `${schemaBaseUrl(siteUrl)}/`;
  try {
    const parsed = new URL(url, base);
    if (parsed.hostname === "glassanddoorpro.com" || parsed.hostname === "www.glassanddoorpro.com") {
      return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, base).toString();
    }
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : base;
  } catch {
    return base;
  }
}

function normalizeOptionalSchemaUrl(url: string | null | undefined, siteUrl: string, allowRelative = true) {
  const value = url?.trim();
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
  } catch {
    if (!allowRelative) return undefined;
  }

  const normalized = normalizeSiteUrl(value, siteUrl);

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function LocalBusinessSchema() {
  const siteData = usePublicSite();
  const branding = siteData.branding;
  const identity = getPublicBusinessIdentity(siteData);
  const socialLinks = Object.values(branding?.socialLinks ?? {})
    .map((url) => normalizeOptionalSchemaUrl(url, identity.siteUrl, false))
    .filter((url): url is string => Boolean(url));
  const businessUrl = schemaBaseUrl(identity.siteUrl);
  const logoUrl = normalizeOptionalSchemaUrl(branding?.logoUrl, identity.siteUrl);
  const imageUrl = logoUrl ?? normalizeOptionalSchemaUrl(branding?.faviconUrl, identity.siteUrl);

  return (
    <JsonLd
      data={{
        ...BUSINESS_BASE,
        "@id": businessSchemaId(identity.siteUrl),
        name: identity.businessName,
        url: businessUrl,
        telephone: identity.phoneHref.replace("tel:", ""),
        email: identity.email,
        description: identity.description || BUSINESS_BASE.description,
        ...(logoUrl ? { logo: logoUrl } : {}),
        ...(imageUrl ? { image: imageUrl } : {}),
        ...(identity.address
          ? {
              address: {
                ...BUSINESS_BASE.address,
                streetAddress: identity.address,
              },
            }
          : {}),
        ...(socialLinks.length ? { sameAs: socialLinks } : {}),
      }}
    />
  );
}

export function ServiceSchema({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  const identity = usePublicBusinessIdentity();
  const businessId = businessSchemaId(identity.siteUrl);
  const serviceUrl = normalizeSiteUrl(url, identity.siteUrl);

  return (
    <JsonLd
      data={{
        "@type": "Service",
        name,
        description,
        url: serviceUrl,
        provider: {
          "@type": "LocalBusiness",
          "@id": businessId,
          name: identity.businessName,
        },
        areaServed: {
          "@type": "Place",
          name: identity.market,
        },
      }}
    />
  );
}

export function WebPageSchema({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  const identity = usePublicBusinessIdentity();
  const pageUrl = normalizeSiteUrl(url, identity.siteUrl);
  const businessId = businessSchemaId(identity.siteUrl);

  return (
    <JsonLd
      data={{
        "@type": "WebPage",
        name,
        description,
        url: pageUrl,
        isPartOf: {
          "@type": "WebSite",
          name: identity.siteName,
          url: schemaBaseUrl(identity.siteUrl),
        },
        about: {
          "@type": "LocalBusiness",
          "@id": businessId,
          name: identity.businessName,
        },
        publisher: {
          "@type": "LocalBusiness",
          "@id": businessId,
          name: identity.businessName,
        },
      }}
    />
  );
}

export function BreadcrumbSchema({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const identity = usePublicBusinessIdentity();

  return (
    <JsonLd
      data={{
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: normalizeSiteUrl(item.url, identity.siteUrl),
        })),
      }}
    />
  );
}

export function FAQSchema({ items }: { items: { question: string; answer: string }[] }) {
  if (!items.length) return null;

  return (
    <JsonLd
      data={{
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }}
    />
  );
}

export function BlogPostingSchema({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
}: {
  title: string;
  description?: string | null;
  url: string;
  image?: string | null;
  datePublished: string;
  dateModified: string;
}) {
  const identity = usePublicBusinessIdentity();
  const businessId = businessSchemaId(identity.siteUrl);
  const postUrl = normalizeSiteUrl(url, identity.siteUrl);
  const postImage = normalizeOptionalSchemaUrl(image, identity.siteUrl);

  return (
    <JsonLd
      data={{
        "@type": "BlogPosting",
        headline: title,
        description: description ?? undefined,
        url: postUrl,
        image: postImage,
        datePublished,
        dateModified,
        author: {
          "@type": "Organization",
          name: identity.businessName,
        },
        publisher: {
          "@type": "Organization",
          "@id": businessId,
          name: identity.businessName,
        },
      }}
    />
  );
}
