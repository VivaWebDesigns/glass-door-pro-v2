import { useQuery } from "@tanstack/react-query";
import type { CmsBranding, CmsColorPalette, CmsMenu, CmsSetting, CmsSidebar, CmsTypography } from "@shared/schema";

const DEFAULT_SITE_NAME = "Glass & Door Pro";
const DEFAULT_SITE_URL = "https://glassanddoorpro.com";
const DEFAULT_MARKET = "Charlotte, NC";
const DEFAULT_DESCRIPTION =
  "Specializing in frameless glass shower doors, residential window replacements and repairs, door installations, and commercial glass replacements and installations in the greater Charlotte area.";

export type PublicBusinessIdentity = {
  businessName: string;
  siteName: string;
  siteUrl: string;
  market: string;
  description: string;
  phone: string;
  phoneHref: string;
  email: string;
  address: string;
};

export type PublicSiteData = {
  branding: CmsBranding | null;
  menus: CmsMenu[];
  sidebars: CmsSidebar[];
  colorPalette: CmsColorPalette | null;
  typography: CmsTypography | null;
  settings: CmsSetting[];
  identity?: Omit<PublicBusinessIdentity, "phoneHref">;
};

export const fallbackPublicContact = {
  phone: "(704) 771-6111",
  email: "Doug@GlassandDoorPro.com",
  address: "2341 Waverly Dr, Monroe, NC 28112",
};

function settingString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function settingBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

export function getPublicSiteSetting(settings: CmsSetting[] | undefined, key: string) {
  return settings?.find((setting) => setting.key === key)?.value ?? {};
}

export function publicCmsEnabled(settings: CmsSetting[] | undefined) {
  const siteSettings = getPublicSiteSetting(settings, "site");
  return settingBoolean(siteSettings.publicCmsEnabled);
}

function publicCmsPreviewRequested() {
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search);
    const previewParam = params.get("cms-preview") ?? params.get("cmsPreview");
    const normalizedParam = previewParam?.trim().toLowerCase();

    return normalizedParam === "1" || normalizedParam === "true";
  } catch {
    return false;
  }
}

export function phoneToTelHref(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `tel:+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `tel:+${digits}`;
  }

  return "tel:+17047716111";
}

export function buildPublicUrl(siteUrl: string | null | undefined, path = "/") {
  const fallbackBase = DEFAULT_SITE_URL.endsWith("/") ? DEFAULT_SITE_URL : `${DEFAULT_SITE_URL}/`;
  const configuredBase = settingString(siteUrl);
  const base = configuredBase ? (configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`) : fallbackBase;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  try {
    return new URL(normalizedPath, base).toString();
  } catch {
    return new URL(normalizedPath, fallbackBase).toString();
  }
}

export function getPublicBusinessIdentity(siteData: {
  branding?: CmsBranding | null;
  settings?: CmsSetting[];
  identity?: Omit<PublicBusinessIdentity, "phoneHref">;
  phone?: string;
  email?: string;
  address?: string;
}): PublicBusinessIdentity {
  if (siteData.identity) {
    return {
      ...siteData.identity,
      phoneHref: phoneToTelHref(siteData.identity.phone),
    };
  }

  const branding = siteData.branding;
  const siteSettings = getPublicSiteSetting(siteData.settings, "site");
  const businessName =
    settingString(siteSettings.businessName) ||
    settingString(branding?.siteName) ||
    DEFAULT_SITE_NAME;
  const market = settingString(siteSettings.market) || DEFAULT_MARKET;
  const description = settingString(branding?.tagline) || DEFAULT_DESCRIPTION.replace(DEFAULT_SITE_NAME, businessName);
  const phone = settingString(siteData.phone) || settingString(branding?.phone) || fallbackPublicContact.phone;
  const email = settingString(siteData.email) || settingString(branding?.email) || fallbackPublicContact.email;
  const address = settingString(siteData.address) || settingString(branding?.address) || fallbackPublicContact.address;

  return {
    businessName,
    siteName: businessName,
    siteUrl: settingString(siteSettings.siteUrl) || DEFAULT_SITE_URL,
    market,
    description,
    phone,
    phoneHref: phoneToTelHref(phone),
    email,
    address,
  };
}

export function usePublicSite() {
  const query = useQuery<PublicSiteData>({
    queryKey: ["/api/cms/public/site"],
    retry: false,
    throwOnError: false,
  });
  const rawSettings = query.data?.settings ?? [];
  const isPublicCmsPreview = publicCmsPreviewRequested();
  const isPublicCmsEnabled = publicCmsEnabled(rawSettings);
  const publicSettings = isPublicCmsEnabled ? rawSettings : [];
  const branding = isPublicCmsEnabled ? query.data?.branding : null;
  const identity = isPublicCmsEnabled ? query.data?.identity : undefined;
  const phone = identity?.phone?.trim() || branding?.phone?.trim() || fallbackPublicContact.phone;
  const email = identity?.email?.trim() || branding?.email?.trim() || fallbackPublicContact.email;
  const address = identity?.address?.trim() || branding?.address?.trim() || fallbackPublicContact.address;

  return {
    ...query,
    isPublicCmsPreview,
    isPublicCmsEnabled,
    branding,
    menus: isPublicCmsEnabled ? query.data?.menus ?? [] : [],
    sidebars: isPublicCmsEnabled ? query.data?.sidebars ?? [] : [],
    colorPalette: isPublicCmsEnabled ? query.data?.colorPalette ?? null : null,
    typography: isPublicCmsEnabled ? query.data?.typography ?? null : null,
    settings: publicSettings,
    identity,
    phone,
    email,
    address,
    phoneHref: phoneToTelHref(phone),
  };
}

export function usePublicBusinessIdentity() {
  return getPublicBusinessIdentity(usePublicSite());
}
