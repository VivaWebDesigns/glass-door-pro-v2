import type { CmsBranding, CmsSetting } from "@shared/schema";
import { storage } from "./storage";

export const PUBLIC_IDENTITY_DEFAULTS = {
  siteName: "Glass & Door Pro",
  siteUrl: "https://glassanddoorpro.com",
  market: "Charlotte, NC",
  phone: "(704) 771-6111",
  email: "Doug@GlassandDoorPro.com",
  address: "2341 Waverly Dr, Monroe, NC 28112",
  description:
    "Specializing in frameless glass shower doors, residential window replacements and repairs, door installations, and commercial glass replacements and installations in the greater Charlotte area.",
};

export type PublicBusinessIdentity = {
  siteName: string;
  businessName: string;
  siteUrl: string;
  market: string;
  description: string;
  phone: string;
  email: string;
  address: string;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function buildPublicBusinessIdentity({
  branding,
  settings,
}: {
  branding?: CmsBranding | null;
  settings?: CmsSetting[];
} = {}): PublicBusinessIdentity {
  const siteSettings = settings?.find((setting) => setting.key === "site")?.value ?? {};
  const businessName =
    stringValue(siteSettings.businessName) ||
    stringValue(branding?.siteName) ||
    PUBLIC_IDENTITY_DEFAULTS.siteName;
  const description =
    stringValue(branding?.tagline) ||
    PUBLIC_IDENTITY_DEFAULTS.description.replace(PUBLIC_IDENTITY_DEFAULTS.siteName, businessName);

  return {
    businessName,
    siteName: businessName,
    siteUrl: stringValue(siteSettings.siteUrl) || PUBLIC_IDENTITY_DEFAULTS.siteUrl,
    market: stringValue(siteSettings.market) || PUBLIC_IDENTITY_DEFAULTS.market,
    description,
    phone: stringValue(branding?.phone) || PUBLIC_IDENTITY_DEFAULTS.phone,
    email: stringValue(branding?.email) || PUBLIC_IDENTITY_DEFAULTS.email,
    address: stringValue(branding?.address) || PUBLIC_IDENTITY_DEFAULTS.address,
  };
}

export async function getPublicBusinessIdentity() {
  const [brandingRecords, settings] = await Promise.all([
    storage.listCms("branding"),
    storage.getPublicSettings(),
  ]);

  return buildPublicBusinessIdentity({
    branding: brandingRecords[0] ?? null,
    settings,
  });
}
