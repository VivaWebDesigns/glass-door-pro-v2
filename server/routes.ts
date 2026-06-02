import type { Express } from "express";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { createServer, type Server } from "http";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { z } from "zod";
import {
  type CmsBlogPost,
  type CmsBranding,
  type CmsColorPalette,
  type CmsDocumentation,
  type CmsMenu,
  type CmsMenuItem,
  type CmsMedia,
  type CmsPage,
  type CmsForm,
  type CmsFormField,
  type CmsFormSubmission,
  type CmsSection,
  type CmsSectionBlock,
  type CmsSetting,
  type CmsSidebar,
  type CmsSystemBackup,
  type CmsSystemUser,
  type CmsTypography,
  type CmsWidget,
  type CrmLead,
  type InsertCrmLead,
  insertCmsBlogPostSchema,
  insertCmsBrandingSchema,
  insertCmsColorPaletteSchema,
  insertCmsDocumentationSchema,
  insertCmsFormSchema,
  insertCmsFormSubmissionSchema,
  insertCmsMediaSchema,
  insertCmsMenuSchema,
  insertCmsPageSchema,
  insertCmsSectionSchema,
  insertCmsSettingSchema,
  insertCmsSidebarSchema,
  insertCmsSystemBackupSchema,
  insertCmsSystemUserSchema,
  insertCmsTypographySchema,
  insertCrmLeadSchema,
} from "@shared/schema";
import { getDatabaseProvisioningStatus, hasDatabase } from "./db";
import { buildPublicBusinessIdentity } from "./public-identity";
import { getDefaultCmsPageForSlug, getStarterCmsPageRepairPayload, seedStorageDefaults, storage } from "./storage";

const cmsSchemas = {
  pages: insertCmsPageSchema,
  forms: insertCmsFormSchema,
  formSubmissions: insertCmsFormSubmissionSchema,
  blogPosts: insertCmsBlogPostSchema,
  media: insertCmsMediaSchema,
  sections: insertCmsSectionSchema,
  branding: insertCmsBrandingSchema,
  colorPalettes: insertCmsColorPaletteSchema,
  typography: insertCmsTypographySchema,
  menus: insertCmsMenuSchema,
  sidebars: insertCmsSidebarSchema,
  documentation: insertCmsDocumentationSchema,
  systemBackups: insertCmsSystemBackupSchema,
  systemUsers: insertCmsSystemUserSchema,
  settings: insertCmsSettingSchema,
} as const;

const cmsCollectionNames = [
  "pages",
  "forms",
  "formSubmissions",
  "blogPosts",
  "media",
  "sections",
  "branding",
  "colorPalettes",
  "typography",
  "menus",
  "sidebars",
  "documentation",
  "systemBackups",
  "systemUsers",
  "settings",
] as const;

type CmsCollectionName = (typeof cmsCollectionNames)[number];

const collectionParamSchema = z.enum(cmsCollectionNames);
const crmLeadStatuses = new Set(["new", "open", "quoted", "closed"]);
const crmLeadPriorities = new Set(["low", "normal", "high"]);
const systemUserRoles = new Set(["owner", "admin", "editor", "viewer"]);
const systemUserStatuses = new Set(["active", "invited", "disabled"]);
const systemBackupStatuses = new Set(["ready", "pending", "failed", "archived", "restored"]);
const pageStatuses = new Set(["draft", "published", "archived"]);
const blogPostStatuses = new Set(["draft", "published", "archived"]);
const knownLeadFieldNames = new Set(["name", "email", "phone", "service", "message", "website"]);
const supportedFormFieldTypes = new Set(["text", "email", "tel", "textarea", "select", "checkbox"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const leadTrackingParamLabels: Record<string, string> = {
  utm_source: "UTM Source",
  utm_medium: "UTM Medium",
  utm_campaign: "UTM Campaign",
  utm_term: "UTM Term",
  utm_content: "UTM Content",
  gclid: "Google Click ID",
  fbclid: "Facebook Click ID",
};
const leadAttributionFieldLabels: Record<string, string> = {
  landingPage: "Landing Page",
  landingReferrer: "Landing Referrer",
  ...Object.fromEntries(Object.entries(leadTrackingParamLabels).map(([key, label]) => [key, `Landing ${label}`])),
};

declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
    adminUserId?: string;
  }
}

const loginSchema = z.object({
  password: z.string().min(1),
});

const createBackupSnapshotSchema = z.object({
  name: z.string().trim().optional(),
  createdBy: z.string().trim().optional(),
  includeData: z.boolean().optional().default(true),
});

const restoreBackupSchema = z.object({
  confirmation: z.string().trim().min(1),
  includeCrm: z.boolean().optional().default(false),
});

const bulkCreateSubmissionLeadsSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(200),
});

const bulkFormSubmissionStatusSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(200),
  status: z.enum(["new", "reviewed", "archived", "spam"]),
});

const uploadMediaSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  dataUrl: z.string().min(1),
  altText: z.string().optional(),
  caption: z.string().optional(),
});

const leadActivitySchema = z.object({
  note: z.string().trim().min(1),
  pipelineStage: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  assignedTo: z.string().trim().optional(),
  priority: z.string().trim().optional(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
});

const bulkLeadActivitySchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(200),
  activity: leadActivitySchema,
});

const mergeLeadSchema = z.object({
  sourceId: z.string().trim().min(1),
});

const publicLeadSchema = insertCrmLeadSchema.extend({
  website: z.string().max(500).optional(),
  fields: z.record(z.unknown()).optional(),
  fieldLabels: z.record(z.string().max(120)).optional(),
  sourceUrl: z.string().max(1000).nullable().optional(),
  referrer: z.string().max(1000).nullable().optional(),
});

const mediaImportExtensions = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".pdf", "application/pdf"],
  [".mp4", "video/mp4"],
]);

const uploadMimeExtensions = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/svg+xml", ".svg"],
  ["application/pdf", ".pdf"],
  ["video/mp4", ".mp4"],
]);

const primaryCmsRouteSlugs = [
  "home",
  "services",
  "about",
  "contact",
  "gallery",
  "blog",
  "services/frameless-showers",
  "services/window-installation",
  "services/door-installation",
  "services/window-repair",
  "services/commercial-glass",
  "services/showers",
  "services/windows",
  "services/doors",
] as const;
const primaryCmsRouteSlugSet = new Set<string>(primaryCmsRouteSlugs);
const hardCodedPublicRouteSlugs = primaryCmsRouteSlugs.filter((slug) => slug !== "services" && slug !== "blog");
const publicCmsVisualParityRouteStatuses = new Set(["approved", "changes-needed"]);

type PublicCmsVisualParityRouteReview = {
  slug: string;
  path: string;
  reviewedAt: string;
  status?: string;
  notes?: string;
};

function normalizePublicCmsVisualParityRouteReviews(value: unknown): PublicCmsVisualParityRouteReview[] {
  if (!Array.isArray(value)) return [];

  const reviews = new Map<string, PublicCmsVisualParityRouteReview>();
  value.forEach((item) => {
    if (!item || Array.isArray(item) || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const slug = typeof record.slug === "string" ? record.slug.trim() : "";
    const reviewedAt = typeof record.reviewedAt === "string" && !Number.isNaN(Date.parse(record.reviewedAt))
      ? new Date(record.reviewedAt).toISOString()
      : "";
    if (!slug || !primaryCmsRouteSlugSet.has(slug) || !reviewedAt) return;

    reviews.set(slug, {
      slug,
      path: typeof record.path === "string" && record.path.trim() ? record.path.trim() : cmsPageUrl(slug),
      reviewedAt,
      status:
        typeof record.status === "string" && publicCmsVisualParityRouteStatuses.has(record.status.trim())
          ? record.status.trim()
          : "approved",
      ...(typeof record.notes === "string" && record.notes.trim() ? { notes: record.notes.trim() } : {}),
    });
  });

  return primaryCmsRouteSlugs
    .map((slug) => reviews.get(slug))
    .filter((review): review is PublicCmsVisualParityRouteReview => Boolean(review));
}

function publicCmsVisualParityRouteReviewIssues(value: unknown) {
  const issues: string[] = [];
  if (value === undefined || value === null || value === "") return issues;
  if (!Array.isArray(value)) return ["Site setting publicCmsVisualParityRouteReviews must be an array."];

  value.forEach((item, index) => {
    if (!item || Array.isArray(item) || typeof item !== "object") {
      issues.push(`Visual parity route review ${index + 1} must be an object.`);
      return;
    }
    const record = item as Record<string, unknown>;
    const slug = typeof record.slug === "string" ? record.slug.trim() : "";
    if (!slug || !primaryCmsRouteSlugSet.has(slug)) {
      issues.push(`Visual parity route review ${index + 1} must use a primary route slug.`);
    }
    if (typeof record.reviewedAt !== "string" || Number.isNaN(Date.parse(record.reviewedAt))) {
      issues.push(`Visual parity route review ${index + 1} needs a valid reviewedAt timestamp.`);
    }
    if (
      typeof record.status === "string" &&
      record.status.trim() &&
      !publicCmsVisualParityRouteStatuses.has(record.status.trim())
    ) {
      issues.push(`Visual parity route review ${index + 1} status must be approved or changes-needed.`);
    }
  });

  return issues;
}

function publicCmsVisualParityRouteChecklistComplete(value: unknown) {
  const reviews = normalizePublicCmsVisualParityRouteReviews(value);
  return reviews.length === primaryCmsRouteSlugs.length && reviews.every((review) => review.status === "approved");
}

const adminScopeGuardrails = {
  status: "standard-admin-only",
  sections: ["Content", "Design", "CRM", "System"],
  collections: cmsCollectionNames,
  excludedModuleFamilies: [
    "listing directories",
    "application intake",
    "public calendars",
    "customer account portals",
    "agreement-gated onboarding",
    "RSVP flows",
    "ticketing",
    "venue schedules",
    "attendee management",
  ],
  documentationSlug: "admin-scope-guardrails",
} as const;

const leadRateLimitWindowMs = 15 * 60 * 1000;
const leadRateLimitMax = 8;
const leadRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const maxPublicLeadFieldCount = 30;
const maxPublicLeadFieldTextLength = 500;
const maxPublicLeadNoteTextLength = 1000;
const defaultLeadPipelineStages = ["new", "contacted", "estimate", "won", "lost"];
const formSubmissionStatuses = new Set(["new", "lead-created", "reviewed", "archived", "spam"]);
const nonConvertibleFormSubmissionStatuses = new Set(["lead-created", "reviewed", "archived", "spam"]);
const mediaGalleryCategoryValues = ["Frameless Showers", "Windows", "Doors", "Commercial Glass"] as const;
const mediaGalleryCategories = new Set<string>(mediaGalleryCategoryValues);
const supportedCmsSectionBlockTypes = new Set([
  "hero",
  "videoHero",
  "content",
  "featureGrid",
  "linkGrid",
  "serviceList",
  "statGrid",
  "splitContent",
  "steps",
  "form",
  "contactInfo",
  "image",
  "galleryGrid",
  "mediaGallery",
  "recentPosts",
  "testimonials",
  "faq",
  "sectionRef",
  "cta",
]);
const maxReusableSectionDepth = 4;

const bulkMediaIdsSchema = z.array(z.string().trim().min(1)).min(1).max(200);
const bulkMediaActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("fill-alt"), ids: bulkMediaIdsSchema }),
  z.object({ action: z.literal("refresh-metadata"), ids: bulkMediaIdsSchema }),
  z.object({ action: z.literal("gallery-ready"), ids: bulkMediaIdsSchema }),
  z.object({ action: z.literal("remove-gallery"), ids: bulkMediaIdsSchema }),
  z.object({ action: z.literal("category"), ids: bulkMediaIdsSchema, category: z.enum(mediaGalleryCategoryValues) }),
]);

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.isAdmin) return next();
  return res.status(401).json({ message: "Admin login required" });
}

function getRequestIp(req: Request) {
  const forwardedFor = req.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || req.ip || req.socket.remoteAddress || "unknown";
}

function checkLeadRateLimit(req: Request) {
  const key = getRequestIp(req);
  const now = Date.now();
  const bucket = leadRateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    leadRateLimitBuckets.set(key, { count: 1, resetAt: now + leadRateLimitWindowMs });
    return true;
  }

  if (bucket.count >= leadRateLimitMax) {
    return false;
  }

  bucket.count += 1;
  return true;
}

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function completionPercent(complete: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((complete / total) * 100)));
}

function getLeadSourceDetails(lead: CrmLead) {
  const lines = (lead.notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const page = lines.find((line) => line.toLowerCase().startsWith("page:"))?.replace(/^page:\s*/i, "").trim() ?? "";
  const referrer = lines.find((line) => line.toLowerCase().startsWith("referrer:"))?.replace(/^referrer:\s*/i, "").trim() ?? "";
  const landingPage = lines.find((line) => line.toLowerCase().startsWith("landing page:"))?.replace(/^landing page:\s*/i, "").trim() ?? "";
  const landingReferrer = lines
    .find((line) => line.toLowerCase().startsWith("landing referrer:"))
    ?.replace(/^landing referrer:\s*/i, "")
    .trim() ?? "";
  const tracking = lines
    .filter((line) => /^(utm source|utm medium|utm campaign|utm term|utm content|google click id|facebook click id):\s*/i.test(line))
    .join("; ");
  const landingTracking = lines
    .filter((line) => /^landing (utm source|utm medium|utm campaign|utm term|utm content|google click id|facebook click id):\s*/i.test(line))
    .join("; ");
  const activity = lines.filter((line) => /^\[[^\]]+\]/.test(line)).join("; ");
  return { page, referrer, landingPage, landingReferrer, tracking, landingTracking, activity };
}

function leadTrackingValue(details: ReturnType<typeof getLeadSourceDetails>, label: string) {
  const normalizedLabel = label.toLowerCase();
  return `${details.tracking}; ${details.landingTracking}`
    .split(";")
    .map((part) => part.trim())
    .find((part) => {
      const normalizedPart = part.toLowerCase();
      return normalizedPart.startsWith(`${normalizedLabel}:`) || normalizedPart.startsWith(`landing ${normalizedLabel}:`);
    })
    ?.replace(new RegExp(`^(landing\\s+)?${label}:\\s*`, "i"), "")
    .trim() ?? "";
}

function sourceTrackingNotes(sourceUrl: string | null | undefined) {
  if (!sourceUrl?.trim()) return [];

  try {
    const url = new URL(sourceUrl, "https://glassanddoorpro.com");
    return Object.entries(leadTrackingParamLabels)
      .map(([key, label]) => {
        const value = url.searchParams.get(key)?.trim();
        return value ? `${label}: ${value}` : "";
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function publicLeadText(value: unknown, maxLength = maxPublicLeadFieldTextLength): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((item) => publicLeadText(item, maxLength)).filter(Boolean).join(", ").slice(0, maxLength);
  }
  if (typeof value === "object") return "";
  return String(value).trim().slice(0, maxLength);
}

function isSafePublicLeadFieldKey(key: string) {
  return /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key);
}

function normalizeSubmittedLeadFieldLabels(labels: Record<string, unknown> | undefined) {
  if (!labels) return {};

  return Object.fromEntries(
    Object.entries(labels)
      .map(([key, label]) => [key.trim(), publicLeadText(label, 120)] as const)
      .filter(([key, label]) => isSafePublicLeadFieldKey(key) && label),
  );
}

function submittedFieldNotes(fields: Record<string, unknown> | undefined, fieldLabels: Record<string, string> = {}) {
  if (!fields) return [];

  return Object.entries(fields)
    .map(([key, value]) => [key.trim(), value] as const)
    .filter(([key]) => !knownLeadFieldNames.has(key) && isSafePublicLeadFieldKey(key))
    .slice(0, maxPublicLeadFieldCount)
    .map(([key, value]) => {
      const text = publicLeadText(value);
      const label = fieldLabels[key] || key;
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean);
}

function normalizeSubmittedLeadFields(fields: Record<string, unknown> | undefined) {
  if (!fields) return {};

  return Object.fromEntries(
    Object.entries(fields)
      .map(([key, value]) => [key.trim(), value] as const)
      .filter(([key]) => key !== "website" && isSafePublicLeadFieldKey(key))
      .slice(0, maxPublicLeadFieldCount)
      .map(([key, value]) => [key, publicLeadText(value)])
      .filter(([_key, value]) => value !== ""),
  );
}

function normalizePublicLeadNoteText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().slice(0, maxPublicLeadNoteTextLength) : "";
}

function normalizeLeadPayload<T extends Partial<InsertCrmLead>>(lead: T): T {
  const next = { ...lead } as Record<string, unknown>;
  const nullableTextFields = ["email", "phone", "service", "notes", "assignedTo"];
  const requiredTextFields = ["name", "message", "source", "status", "pipelineStage", "priority"];

  nullableTextFields.forEach((field) => {
    if (typeof next[field] !== "string") return;
    const value = next[field].trim();
    next[field] = value || null;
  });

  requiredTextFields.forEach((field) => {
    if (typeof next[field] === "string") next[field] = next[field].trim();
  });

  if (typeof next.email === "string") {
    next.email = next.email.toLowerCase();
  }

  return next as T;
}

function buildLeadSourceNotes(
  notes: string | null | undefined,
  sourceUrl: string | null | undefined,
  referrer: string | null | undefined,
  fields: Record<string, unknown> | undefined,
  fieldLabels: Record<string, string> = {},
) {
  const lines = (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const hasPage = lines.some((line) => /^page:\s*/i.test(line));
  const hasReferrer = lines.some((line) => /^referrer:\s*/i.test(line));
  const existing = new Set(lines.map((line) => line.toLowerCase()));
  const safeSourceUrl = normalizePublicLeadNoteText(sourceUrl);
  const safeReferrer = normalizePublicLeadNoteText(referrer);
  const additions = [
    !hasPage && safeSourceUrl ? `Page: ${safeSourceUrl}` : "",
    !hasReferrer && safeReferrer ? `Referrer: ${safeReferrer}` : "",
    ...sourceTrackingNotes(safeSourceUrl),
    ...submittedFieldNotes(fields, fieldLabels),
  ].filter((line) => line && !existing.has(line.toLowerCase()));

  const combined = [...lines, ...additions];
  return combined.length > 0 ? combined.join("\n") : null;
}

function submissionFieldString(submission: CmsFormSubmission, key: string) {
  const value = submission.fields?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function submissionLandingTrackingNotes(submission: CmsFormSubmission) {
  return Object.entries(leadTrackingParamLabels)
    .map(([key, label]) => {
      const value = submissionFieldString(submission, key);
      return value ? `Landing ${label}: ${value}` : "";
    })
    .filter(Boolean);
}

function leadAgeHours(date: Date | string) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 36e5));
}

function leadAgeBucketLabel(date: Date | string) {
  const hours = leadAgeHours(date);
  if (hours < 4) return "0-4 hours";
  if (hours < 24) return "4-24 hours";
  if (hours < 72) return "1-3 days";
  if (hours < 168) return "3-7 days";
  return "7+ days";
}

function leadNeedsFollowUp(lead: CrmLead) {
  if (lead.pipelineStage === "won" || lead.pipelineStage === "lost" || lead.status === "closed") {
    return false;
  }

  if (lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() <= Date.now()) {
    return true;
  }

  const hoursSinceUpdate = leadAgeHours(lead.updatedAt);
  if (lead.pipelineStage === "new") return hoursSinceUpdate >= 4;
  if (lead.pipelineStage === "contacted") return hoursSinceUpdate >= 24;
  if (lead.pipelineStage === "estimate") return hoursSinceUpdate >= 48;
  return hoursSinceUpdate >= 72;
}

function leadFollowUpLabel(lead: CrmLead) {
  if (lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() <= Date.now()) {
    return `Scheduled follow-up due ${new Date(lead.nextFollowUpAt).toLocaleString("en-US", { timeZone: "America/New_York" })}`;
  }
  if (lead.pipelineStage === "new") return "Initial outreach needed";
  if (lead.pipelineStage === "contacted") return "Follow up after first contact";
  if (lead.pipelineStage === "estimate") return "Check estimate decision";
  if (lead.pipelineStage === "won") return "Won project";
  if (lead.pipelineStage === "lost") return "Lost opportunity";
  return "Review next step";
}

function leadFollowUpSortTime(lead: CrmLead) {
  const scheduledTime = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).getTime() : Number.NaN;
  if (Number.isFinite(scheduledTime)) return scheduledTime;
  return new Date(lead.updatedAt).getTime();
}

function leadIsOpen(lead: CrmLead) {
  return lead.pipelineStage !== "won" && lead.pipelineStage !== "lost" && lead.status !== "closed";
}

function leadCreatedToday(lead: CrmLead) {
  return lead.createdAt.toDateString() === new Date().toDateString();
}

async function getConfiguredLeadPipelineStages() {
  const settings = await storage.listCms("settings");
  const configuredStages = settings.find((setting) => setting.key === "site")?.value.leadPipelineStages;
  return normalizeLeadPipelineStages(configuredStages);
}

function normalizeLeadPipelineStages(configuredStages: unknown) {
  if (!Array.isArray(configuredStages)) return defaultLeadPipelineStages;

  const stages = configuredStages
    .map((stage) => String(stage).trim())
    .filter(Boolean);

  return stages.length > 0 ? Array.from(new Set(stages)) : defaultLeadPipelineStages;
}

function getSiteSettingIssues(value: unknown) {
  const issues: string[] = [];
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return ["The site setting value must be a JSON object."];
  }

  const siteValue = value as Record<string, unknown>;
  if (typeof siteValue.businessName !== "string" || !siteValue.businessName.trim()) {
    issues.push("Site setting needs a businessName value.");
  }
  if ("siteUrl" in siteValue) {
    if (typeof siteValue.siteUrl !== "string") {
      issues.push("Site setting siteUrl must be a text value.");
    } else if (siteValue.siteUrl.trim()) {
      try {
        const parsed = new URL(siteValue.siteUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          issues.push("Site setting siteUrl must be an http or https URL.");
        }
      } catch {
        issues.push("Site setting siteUrl must be a valid URL.");
      }
    }
  }
  if ("market" in siteValue && typeof siteValue.market !== "string") {
    issues.push("Site setting market must be a text value.");
  }
  if ("businessHours" in siteValue && typeof siteValue.businessHours !== "string") {
    issues.push("Site setting businessHours must be a text value.");
  }
  if ("publicCmsEnabled" in siteValue && typeof siteValue.publicCmsEnabled !== "boolean") {
    issues.push("Site setting publicCmsEnabled must be true or false.");
  }
  if (
    "publicCmsVisualParityApprovedAt" in siteValue &&
    siteValue.publicCmsVisualParityApprovedAt !== null &&
    siteValue.publicCmsVisualParityApprovedAt !== ""
  ) {
    if (typeof siteValue.publicCmsVisualParityApprovedAt !== "string" || Number.isNaN(Date.parse(siteValue.publicCmsVisualParityApprovedAt))) {
      issues.push("Site setting publicCmsVisualParityApprovedAt must be a valid timestamp or blank.");
    }
    if (!publicCmsVisualParityRouteChecklistComplete(siteValue.publicCmsVisualParityRouteReviews)) {
      issues.push("Approve every primary route in publicCmsVisualParityRouteReviews before approving CMS visual parity.");
    }
  }
  issues.push(...publicCmsVisualParityRouteReviewIssues(siteValue.publicCmsVisualParityRouteReviews));
  if (!Array.isArray(siteValue.leadPipelineStages)) {
    issues.push("Site setting leadPipelineStages must be an array.");
  } else {
    const stages = siteValue.leadPipelineStages.map((stage) => String(stage).trim()).filter(Boolean);
    if (stages.length === 0) {
      issues.push("Site setting leadPipelineStages must include at least one stage.");
    }
    if (new Set(stages).size !== stages.length) {
      issues.push("Site setting leadPipelineStages must not include duplicates.");
    }
  }

  return issues;
}

function getSettingSaveIssues(candidate: Partial<CmsSetting>) {
  const issues: string[] = [];
  const key = candidate.key?.trim();
  if (candidate.key !== undefined && !key) {
    issues.push("Setting key is required.");
  }
  if (key === "site") {
    issues.push(...getSiteSettingIssues(candidate.value));
  }
  return issues;
}

function normalizeSiteSettingValueForSave(value: Record<string, unknown>) {
  const allowedKeys = [
    "businessName",
    "siteUrl",
    "market",
    "businessHours",
    "publicCmsEnabled",
    "publicCmsVisualParityRouteReviews",
    "publicCmsVisualParityApprovedAt",
    "leadPipelineStages",
    "publicCmsLaunchConfirmedAt",
  ] as const;

  const next = allowedKeys.reduce((acc, key) => {
    if (key in value) {
      acc[key] = value[key];
    }
    return acc;
  }, {} as Record<string, unknown>);

  ["businessName", "market", "businessHours"].forEach((field) => {
    if (typeof next[field] === "string") next[field] = next[field].trim();
  });

  if (typeof next.siteUrl === "string") {
    const siteUrl = next.siteUrl.trim();
    if (siteUrl) {
      try {
        const parsed = new URL(siteUrl);
        next.siteUrl = parsed.protocol === "http:" || parsed.protocol === "https:"
          ? parsed.toString().replace(/\/$/, "")
          : siteUrl;
      } catch {
        next.siteUrl = siteUrl;
      }
    } else {
      next.siteUrl = "";
    }
  }

  if (Array.isArray(next.leadPipelineStages)) {
    const stages = next.leadPipelineStages.map((stage) => String(stage).trim()).filter(Boolean);
    next.leadPipelineStages = stages;
  }
  const routeReviews = normalizePublicCmsVisualParityRouteReviews(next.publicCmsVisualParityRouteReviews);
  if (routeReviews.length > 0) {
    next.publicCmsVisualParityRouteReviews = routeReviews;
  } else {
    delete next.publicCmsVisualParityRouteReviews;
  }
  if (typeof next.publicCmsVisualParityApprovedAt === "string" && !Number.isNaN(Date.parse(next.publicCmsVisualParityApprovedAt))) {
    next.publicCmsVisualParityApprovedAt = new Date(next.publicCmsVisualParityApprovedAt).toISOString();
  } else {
    delete next.publicCmsVisualParityApprovedAt;
  }
  next.publicCmsEnabled = next.publicCmsEnabled === true;
  if (next.publicCmsEnabled) {
    next.publicCmsLaunchConfirmedAt =
      typeof next.publicCmsLaunchConfirmedAt === "string" && !Number.isNaN(Date.parse(next.publicCmsLaunchConfirmedAt))
        ? next.publicCmsLaunchConfirmedAt
        : new Date().toISOString();
  } else {
    delete next.publicCmsLaunchConfirmedAt;
  }

  return next;
}

async function getLeadPipelineStageIssue(stage: string | null | undefined) {
  if (!stage) return "";
  const stages = await getConfiguredLeadPipelineStages();
  return stages.includes(stage)
    ? ""
    : `Pipeline stage "${stage}" is not configured. Available stages: ${stages.join(", ")}.`;
}

async function getLeadAssigneeIssue(assignedTo: string | null | undefined) {
  const userId = assignedTo?.trim();
  if (!userId) return "";

  const users = await storage.listCms("systemUsers");
  const user = users.find((item) => item.id === userId);
  if (!user) return "Assigned user must reference an existing system user.";
  return user.status === "active" ? "" : "Assigned user must be active.";
}

function getLeadSaveIssues(candidate: Partial<Pick<CrmLead, "email" | "phone" | "status" | "priority">>, requireContact = false) {
  const issues: string[] = [];
  const email = candidate.email?.trim();
  const phone = candidate.phone?.trim();
  const status = candidate.status?.trim();
  const priority = candidate.priority?.trim();

  if (requireContact && !email && !phone) {
    issues.push("Email or phone is required.");
  }
  if (status && !crmLeadStatuses.has(status)) {
    issues.push(`Lead status "${status}" is not supported. Use ${Array.from(crmLeadStatuses).join(", ")}.`);
  }
  if (priority && !crmLeadPriorities.has(priority)) {
    issues.push(`Lead priority "${priority}" is not supported. Use ${Array.from(crmLeadPriorities).join(", ")}.`);
  }

  return issues;
}

function getLeadRecordReadinessIssues(lead: CrmLead, pipelineStages: string[], systemUsers: CmsSystemUser[]) {
  const issues: string[] = [];
  const name = lead.name?.trim();
  const status = lead.status?.trim();
  const priority = lead.priority?.trim();
  const pipelineStage = lead.pipelineStage?.trim();
  const assignedTo = lead.assignedTo?.trim();

  if (!name) issues.push("Lead name is required.");
  issues.push(...getLeadSaveIssues(lead, true));
  if (!status) issues.push("Lead status is required.");
  if (!priority) issues.push("Lead priority is required.");
  if (!pipelineStage) {
    issues.push("Pipeline stage is required.");
  } else if (!pipelineStages.includes(pipelineStage)) {
    issues.push(`Pipeline stage "${pipelineStage}" is not configured. Available stages: ${pipelineStages.join(", ")}.`);
  }
  if (lead.nextFollowUpAt && Number.isNaN(new Date(lead.nextFollowUpAt).getTime())) {
    issues.push("Next follow-up date is invalid.");
  }
  if (assignedTo) {
    const user = systemUsers.find((item) => item.id === assignedTo);
    if (!user) {
      issues.push("Assigned user must reference an existing system user.");
    } else if (user.status !== "active") {
      issues.push("Assigned user must be active.");
    }
  }

  return issues;
}

function getSystemUserSaveIssues(candidate: Partial<CmsSystemUser>) {
  const issues: string[] = [];
  const name = candidate.name?.trim();
  const email = candidate.email?.trim();
  const role = candidate.role?.trim();
  const status = candidate.status?.trim();

  if (candidate.name !== undefined && !name) {
    issues.push("System user name is required.");
  }
  if (candidate.email !== undefined && !email) {
    issues.push("System user email is required.");
  }
  if (email && !emailPattern.test(email)) {
    issues.push("System user email must be valid.");
  }
  if (role && !systemUserRoles.has(role)) {
    issues.push(`System user role "${role}" is not supported. Use ${Array.from(systemUserRoles).join(", ")}.`);
  }
  if (status && !systemUserStatuses.has(status)) {
    issues.push(`System user status "${status}" is not supported. Use ${Array.from(systemUserStatuses).join(", ")}.`);
  }

  return issues;
}

function getDocumentationSaveIssues(candidate: Partial<CmsDocumentation>) {
  const issues: string[] = [];
  const title = candidate.title?.trim();
  const slug = candidate.slug?.trim();
  const category = candidate.category?.trim();

  if (candidate.title !== undefined && !title) {
    issues.push("Documentation title is required.");
  }
  if (candidate.slug !== undefined && !slug) {
    issues.push("Documentation slug is required.");
  }
  if (candidate.category !== undefined && !category) {
    issues.push("Documentation category is required.");
  }

  return issues;
}

function getSystemBackupSaveIssues(candidate: Partial<CmsSystemBackup>) {
  const issues: string[] = [];
  const name = candidate.name?.trim();
  const status = candidate.status?.trim();

  if (candidate.name !== undefined && !name) {
    issues.push("Backup name is required.");
  }
  if (candidate.status !== undefined && !status) {
    issues.push("Backup status is required.");
  }
  if (status && !systemBackupStatuses.has(status)) {
    issues.push(`Backup status "${status}" is not supported. Use ${Array.from(systemBackupStatuses).join(", ")}.`);
  }
  if (candidate.manifest !== undefined && !isPlainRecord(candidate.manifest)) {
    issues.push("Backup manifest must be a JSON object.");
  }

  return issues;
}

async function getFormSubmissionIssues(candidate: Partial<CmsFormSubmission>) {
  const issues: string[] = [];
  const status = candidate.status?.trim();

  if (status && !formSubmissionStatuses.has(status)) {
    issues.push(`Submission status "${status}" is not supported.`);
  }

  if (candidate.formSlug || candidate.formId) {
    const forms = await storage.listCms("forms");
    const matchingForm = forms.find((form) => form.id === candidate.formId || form.slug === candidate.formSlug);
    if (!matchingForm) {
      issues.push("Submission must reference an existing CMS form.");
    }
  }

  if (candidate.leadId) {
    const leads = await storage.listLeads();
    if (!leads.some((lead) => lead.id === candidate.leadId)) {
      issues.push("Submission leadId must reference an existing CRM lead.");
    }
  }

  return issues;
}

function getMediaSaveIssues(candidate: Partial<CmsMedia>) {
  const issues: string[] = [];
  const name = candidate.name?.trim() ?? "";
  const mimeType = candidate.mimeType?.trim() ?? "";
  const category = candidate.category?.trim();
  const tags = candidate.tags;
  const positiveIntegerFields: Array<[keyof Pick<CmsMedia, "width" | "height" | "sizeBytes">, string]> = [
    ["width", "Media width"],
    ["height", "Media height"],
    ["sizeBytes", "Media size"],
  ];

  if (!name) issues.push("Media name is required.");
  if (!candidate.url?.trim()) issues.push("Media URL is required.");
  if (!mimeType) issues.push("Media MIME type is required.");
  const urlIssue = unsafeCmsAssetUrlMessage("Media URL", candidate.url);
  if (urlIssue) issues.push(urlIssue);
  if (category && !mediaGalleryCategories.has(category)) {
    issues.push(`Media category "${category}" is not supported.`);
  }
  if (tags && !tags.every((tag) => typeof tag === "string" && tag.trim())) {
    issues.push("Media tags must be non-empty strings.");
  }
  positiveIntegerFields.forEach(([field, label]) => {
    const value = candidate[field];
    if (value !== undefined && value !== null && (!Number.isInteger(value) || value <= 0)) {
      issues.push(`${label} must be a positive whole number.`);
    }
  });
  if (candidate.isGalleryReady && !mimeType.startsWith("image/")) {
    issues.push("Only image media can be marked gallery-ready.");
  }
  if (candidate.isGalleryReady && !candidate.altText?.trim()) {
    issues.push("Gallery-ready images need alt text.");
  }

  return issues;
}

function getBrandingSaveIssues(candidate: Partial<CmsBranding>, mediaItems: unknown[] = []) {
  const issues: string[] = [];
  if (!candidate.siteName?.trim()) issues.push("Site name is required.");

  const logoIssue =
    unsafeCmsAssetUrlMessage("Logo URL", candidate.logoUrl) ||
    legacyCmsAssetMessage("Logo URL", candidate.logoUrl);
  const faviconIssue =
    unsafeCmsAssetUrlMessage("Favicon URL", candidate.faviconUrl) ||
    legacyCmsAssetMessage("Favicon URL", candidate.faviconUrl);
  const logoMediaIssue = logoIssue ? "" : missingMediaLibraryAssetMessage("Logo URL", candidate.logoUrl, mediaItems);
  const faviconMediaIssue = faviconIssue ? "" : missingMediaLibraryAssetMessage("Favicon URL", candidate.faviconUrl, mediaItems);

  if (logoIssue) issues.push(logoIssue);
  if (faviconIssue) issues.push(faviconIssue);
  if (logoMediaIssue) issues.push(logoMediaIssue);
  if (faviconMediaIssue) issues.push(faviconMediaIssue);

  if (candidate.socialLinks && typeof candidate.socialLinks === "object" && !Array.isArray(candidate.socialLinks)) {
    Object.entries(candidate.socialLinks).forEach(([label, href]) => {
      const cleanLabel = label.trim();
      if (!cleanLabel) {
        issues.push("Social link labels are required.");
      }
      if (typeof href !== "string") {
        issues.push(`Social link "${cleanLabel || label}" must be a URL string.`);
        return;
      }
      if (!href.trim()) {
        issues.push(`Social link "${cleanLabel || label}" must include a URL.`);
        return;
      }
      const issue = unsafeCmsHrefMessage(`Social link "${cleanLabel}"`, href);
      if (issue) issues.push(issue);
    });
  }

  return issues;
}

function getBrandingCollectionIssues(records: CmsBranding[]) {
  if (records.length === 0) return ["One Glass & Door Pro brand profile is required."];
  if (records.length > 1) return [`Exactly one Glass & Door Pro brand profile is required; found ${records.length}.`];
  return [];
}

function crmActivityTimestamp() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date());
}

function appendCrmActivityNote(notes: string | null | undefined, note: string) {
  const current = (notes ?? "").trim();
  const stampedNote = `[${crmActivityTimestamp()}] ${note.trim()}`;
  return [current, stampedNote].filter(Boolean).join("\n");
}

function leadsShareContact(a: Pick<CrmLead, "email" | "phone">, b: Pick<CrmLead, "email" | "phone">) {
  const emailA = normalizedLeadEmail(a);
  const emailB = normalizedLeadEmail(b);
  const phoneA = normalizedLeadPhone(a);
  const phoneB = normalizedLeadPhone(b);
  return Boolean((emailA && emailA === emailB) || (phoneA && phoneA === phoneB));
}

const crmPriorityRank = { low: 0, normal: 1, high: 2 } as const;

function crmLeadPriorityRank(priority: string) {
  return priority in crmPriorityRank
    ? crmPriorityRank[priority as keyof typeof crmPriorityRank]
    : crmPriorityRank.normal;
}

function mergedLeadPriority(target: CrmLead, source: CrmLead) {
  return crmLeadPriorityRank(source.priority) > crmLeadPriorityRank(target.priority) ? source.priority : target.priority;
}

function mergedLeadFollowUpAt(target: CrmLead, source: CrmLead) {
  if (!target.nextFollowUpAt) return source.nextFollowUpAt ?? null;
  if (!source.nextFollowUpAt) return target.nextFollowUpAt;
  return source.nextFollowUpAt.getTime() < target.nextFollowUpAt.getTime()
    ? source.nextFollowUpAt
    : target.nextFollowUpAt;
}

function mergedLeadNotes(target: CrmLead, source: CrmLead) {
  const stamped = appendCrmActivityNote(
    target.notes,
    `Merged duplicate lead "${source.name}" (${source.id}).`,
  );
  const sourceDetails = [
    source.source?.trim() ? `Merged duplicate source: ${source.source.trim()}` : "",
    source.service?.trim() && source.service.trim() !== target.service?.trim()
      ? `Merged duplicate service: ${source.service.trim()}`
      : "",
    source.message?.trim() && source.message.trim() !== target.message?.trim()
      ? `Merged duplicate message: ${source.message.trim()}`
      : "",
    source.nextFollowUpAt ? `Merged duplicate next follow-up: ${source.nextFollowUpAt.toISOString()}` : "",
  ].filter(Boolean);
  const sourceNotes = source.notes?.trim();
  if (!sourceDetails.length && !sourceNotes) return stamped;

  return [
    stamped,
    ...sourceDetails,
    sourceNotes ? `Merged duplicate notes from ${source.name}:` : "",
    sourceNotes ?? "",
  ].filter(Boolean).join("\n");
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  return Object.fromEntries(
    Array.from(
      items.reduce((counts, item) => {
        const key = getKey(item)?.trim() || "unknown";
        counts.set(key, (counts.get(key) ?? 0) + 1);
        return counts;
      }, new Map<string, number>()),
    ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
}

function normalizedLeadEmail(lead: Pick<CrmLead, "email">) {
  return lead.email?.trim().toLowerCase() ?? "";
}

function normalizedLeadPhone(lead: Pick<CrmLead, "phone">) {
  const digits = lead.phone?.replace(/\D/g, "") ?? "";
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function leadContactDuplicateGroups(leads: CrmLead[]) {
  const contactMap = new Map<string, { type: "email" | "phone"; value: string; leads: CrmLead[] }>();

  leads.forEach((lead) => {
    const email = normalizedLeadEmail(lead);
    const phone = normalizedLeadPhone(lead);
    if (email) {
      const key = `email:${email}`;
      const group = contactMap.get(key) ?? { type: "email" as const, value: email, leads: [] };
      group.leads.push(lead);
      contactMap.set(key, group);
    }
    if (phone) {
      const key = `phone:${phone}`;
      const group = contactMap.get(key) ?? { type: "phone" as const, value: phone, leads: [] };
      group.leads.push(lead);
      contactMap.set(key, group);
    }
  });

  return Array.from(contactMap.values())
    .filter((group) => group.leads.length > 1)
    .map((group) => {
      const sortedLeads = [...group.leads].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return {
        type: group.type,
        value: group.value,
        count: sortedLeads.length,
        openCount: sortedLeads.filter(leadIsOpen).length,
        latestAt: sortedLeads[0]?.createdAt.toISOString() ?? null,
        leads: sortedLeads.map((lead) => ({
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          service: lead.service,
          source: lead.source,
          pipelineStage: lead.pipelineStage,
          status: lead.status,
          priority: lead.priority,
          createdAt: lead.createdAt.toISOString(),
        })),
      };
    })
    .sort((a, b) => b.openCount - a.openCount || b.count - a.count || String(b.latestAt).localeCompare(String(a.latestAt)));
}

function publicDuplicateLeadNote(existingLead: CrmLead, incomingLead: InsertCrmLead) {
  return [
    `Received another website inquiry from ${incomingLead.name || "Website Lead"}.`,
    incomingLead.source?.trim() ? `Source: ${incomingLead.source.trim()}` : "",
    incomingLead.service?.trim() && incomingLead.service.trim() !== existingLead.service?.trim()
      ? `Service: ${incomingLead.service.trim()}`
      : "",
    incomingLead.message?.trim() ? `Message: ${incomingLead.message.trim()}` : "",
    incomingLead.notes?.trim() ? incomingLead.notes.trim() : "",
  ].filter(Boolean).join("\n");
}

function createCrmStageAging(leads: CrmLead[]) {
  const byStage = new Map<string, CrmLead[]>();

  leads.forEach((lead) => {
    const stage = lead.pipelineStage || "unknown";
    byStage.set(stage, [...(byStage.get(stage) ?? []), lead]);
  });

  return Array.from(byStage.entries())
    .map(([stage, stageLeads]) => {
      const openStageLeads = stageLeads.filter(leadIsOpen);
      const followUpStageLeads = openStageLeads.filter(leadNeedsFollowUp);
      const oldestOpenLead = [...openStageLeads].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      const oldestUpdatedLead = [...openStageLeads].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())[0];
      const averageOpenLeadAgeHours = openStageLeads.length > 0
        ? Math.round(openStageLeads.reduce((total, lead) => total + leadAgeHours(lead.createdAt), 0) / openStageLeads.length)
        : 0;
      const averageHoursSinceUpdate = openStageLeads.length > 0
        ? Math.round(openStageLeads.reduce((total, lead) => total + leadAgeHours(lead.updatedAt), 0) / openStageLeads.length)
        : 0;

      return {
        stage,
        leads: stageLeads.length,
        openLeads: openStageLeads.length,
        followUpLeads: followUpStageLeads.length,
        highPriorityLeads: openStageLeads.filter((lead) => lead.priority === "high").length,
        unassignedLeads: openStageLeads.filter((lead) => !lead.assignedTo?.trim()).length,
        oldestOpenLeadAt: oldestOpenLead?.createdAt.toISOString() ?? null,
        oldestOpenLeadAgeHours: oldestOpenLead ? leadAgeHours(oldestOpenLead.createdAt) : 0,
        oldestUpdatedAt: oldestUpdatedLead?.updatedAt.toISOString() ?? null,
        hoursSinceOldestUpdate: oldestUpdatedLead ? leadAgeHours(oldestUpdatedLead.updatedAt) : 0,
        averageOpenLeadAgeHours,
        averageHoursSinceUpdate,
      };
    })
    .sort(
      (a, b) =>
        b.followUpLeads - a.followUpLeads ||
        b.highPriorityLeads - a.highPriorityLeads ||
        b.oldestOpenLeadAgeHours - a.oldestOpenLeadAgeHours ||
        a.stage.localeCompare(b.stage),
    );
}

function createCrmServiceFunnel(leads: CrmLead[]) {
  const byService = new Map<string, CrmLead[]>();

  leads.forEach((lead) => {
    const service = lead.service?.trim() || "General Inquiry";
    byService.set(service, [...(byService.get(service) ?? []), lead]);
  });

  return Array.from(byService.entries())
    .map(([service, serviceLeads]) => {
      const openServiceLeads = serviceLeads.filter(leadIsOpen);
      const wonServiceLeads = serviceLeads.filter((lead) => lead.pipelineStage === "won");
      const lostServiceLeads = serviceLeads.filter((lead) => lead.pipelineStage === "lost");
      const closedOutcomeCount = wonServiceLeads.length + lostServiceLeads.length;

      return {
        service,
        leads: serviceLeads.length,
        openLeads: openServiceLeads.length,
        estimateLeads: serviceLeads.filter((lead) => lead.pipelineStage === "estimate").length,
        followUpLeads: serviceLeads.filter(leadNeedsFollowUp).length,
        highPriorityLeads: serviceLeads.filter((lead) => lead.priority === "high" && leadIsOpen(lead)).length,
        wonLeads: wonServiceLeads.length,
        lostLeads: lostServiceLeads.length,
        conversionRate: closedOutcomeCount > 0 ? Math.round((wonServiceLeads.length / closedOutcomeCount) * 100) : 0,
      };
    })
    .sort(
      (a, b) =>
        b.leads - a.leads ||
        b.openLeads - a.openLeads ||
        b.followUpLeads - a.followUpLeads ||
        a.service.localeCompare(b.service),
    );
}

function createCrmActionQueue(
  leads: CrmLead[],
  duplicateLeadIds: Set<string>,
  sourceDetailsFor: (lead: CrmLead) => ReturnType<typeof getLeadSourceDetails>,
) {
  const actionPriorityScore = { critical: 0, high: 1, medium: 2, low: 3 } as const;

  return leads
    .filter(leadIsOpen)
    .map((lead) => {
      const ageHours = leadAgeHours(lead.createdAt);
      const hoursSinceUpdate = leadAgeHours(lead.updatedAt);
      const sourceDetails = sourceDetailsFor(lead);
      const baseRecord = {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        service: lead.service,
        pipelineStage: lead.pipelineStage,
        status: lead.status,
        priority: lead.priority,
        source: lead.source,
        assignedTo: lead.assignedTo,
        nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
        ageHours,
        hoursSinceUpdate,
        followUpSortTime: leadFollowUpSortTime(lead),
        sourceDetails,
      };

      if (leadNeedsFollowUp(lead)) {
        return {
          ...baseRecord,
          category: "follow-up",
          urgency: "critical",
          action: "Follow up now",
          detail: leadFollowUpLabel(lead),
        };
      }

      if (duplicateLeadIds.has(lead.id)) {
        return {
          ...baseRecord,
          category: "duplicate",
          urgency: "high",
          action: "Review duplicate contact",
          detail: "Lead shares an email address or phone number with another CRM record.",
        };
      }

      if (!lead.assignedTo?.trim()) {
        return {
          ...baseRecord,
          category: "unassigned",
          urgency: lead.pipelineStage === "new" ? "high" : "medium",
          action: "Assign owner",
          detail: "Open lead has no assigned admin owner.",
        };
      }

      if (hoursSinceUpdate >= 72) {
        return {
          ...baseRecord,
          category: "stale-update",
          urgency: hoursSinceUpdate >= 168 ? "high" : "medium",
          action: "Refresh lead status",
          detail: `No CRM update recorded for ${hoursSinceUpdate} hours.`,
        };
      }

      if (lead.priority === "high") {
        return {
          ...baseRecord,
          category: "high-priority",
          urgency: "medium",
          action: "Confirm next step",
          detail: "High-priority lead is open but not currently due for follow-up.",
        };
      }

      if (lead.pipelineStage === "new" && ageHours >= 4) {
        return {
          ...baseRecord,
          category: "new-lead",
          urgency: "medium",
          action: "Make first contact",
          detail: `New lead has been open for ${ageHours} hours.`,
        };
      }

      return null;
    })
    .filter((record): record is NonNullable<typeof record> => Boolean(record))
    .sort(
      (a, b) =>
        actionPriorityScore[a.urgency as keyof typeof actionPriorityScore] -
          actionPriorityScore[b.urgency as keyof typeof actionPriorityScore] ||
        a.followUpSortTime - b.followUpSortTime ||
        b.hoursSinceUpdate - a.hoursSinceUpdate ||
        b.ageHours - a.ageHours ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 50)
    .map(({ followUpSortTime, ...record }) => record);
}

function createCrmHealthReport(leads: CrmLead[]) {
  const openLeads = leads.filter(leadIsOpen);
  const followUpLeads = leads.filter(leadNeedsFollowUp);
  const highPriorityLeads = leads.filter((lead) => lead.priority === "high" && leadIsOpen(lead));
  const wonLeads = leads.filter((lead) => lead.pipelineStage === "won");
  const lostLeads = leads.filter((lead) => lead.pipelineStage === "lost");
  const closedOutcomeCount = wonLeads.length + lostLeads.length;
  const oldestOpenLead = [...openLeads].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
  const sortedFollowUpLeads = [...followUpLeads].sort((a, b) => leadFollowUpSortTime(a) - leadFollowUpSortTime(b));
  const oldestFollowUp = sortedFollowUpLeads[0];
  const duplicateContacts = leadContactDuplicateGroups(leads);
  const duplicateLeadIds = new Set(duplicateContacts.flatMap((group) => group.leads.map((lead) => lead.id)));
  const oldestFollowUpTime = oldestFollowUp ? leadFollowUpSortTime(oldestFollowUp) : null;
  const sourceDetailsByLead = new Map(leads.map((lead) => [lead.id, getLeadSourceDetails(lead)]));
  const sourceDetailsFor = (lead: CrmLead) => sourceDetailsByLead.get(lead.id) ?? getLeadSourceDetails(lead);
  const actionQueue = createCrmActionQueue(leads, duplicateLeadIds, sourceDetailsFor);

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    totals: {
      leads: leads.length,
      openLeads: openLeads.length,
      followUpLeads: followUpLeads.length,
      highPriorityLeads: highPriorityLeads.length,
      newTodayLeads: leads.filter(leadCreatedToday).length,
      wonLeads: wonLeads.length,
      lostLeads: lostLeads.length,
      unassignedLeads: leads.filter((lead) => !lead.assignedTo?.trim() && leadIsOpen(lead)).length,
      conversionRate: closedOutcomeCount > 0 ? Math.round((wonLeads.length / closedOutcomeCount) * 100) : 0,
      duplicateContacts: duplicateContacts.length,
      duplicateLeads: duplicateLeadIds.size,
      oldestOpenLeadAt: oldestOpenLead?.createdAt.toISOString() ?? null,
      oldestOpenLeadAgeHours: oldestOpenLead ? leadAgeHours(oldestOpenLead.createdAt) : 0,
      oldestFollowUpAt: oldestFollowUpTime ? new Date(oldestFollowUpTime).toISOString() : null,
      oldestFollowUpAgeHours: oldestFollowUpTime ? leadAgeHours(new Date(oldestFollowUpTime)) : 0,
    },
    byStage: countBy(leads, (lead) => lead.pipelineStage),
    byStatus: countBy(leads, (lead) => lead.status),
    bySource: countBy(leads, (lead) => lead.source),
    byService: countBy(leads, (lead) => lead.service),
    byLandingPage: countBy(leads, (lead) => sourceDetailsFor(lead).landingPage || sourceDetailsFor(lead).page),
    byLandingReferrer: countBy(leads, (lead) => sourceDetailsFor(lead).landingReferrer || sourceDetailsFor(lead).referrer || "direct"),
    byCampaign: countBy(leads, (lead) => leadTrackingValue(sourceDetailsFor(lead), "UTM Campaign")),
    byUtmSource: countBy(leads, (lead) => leadTrackingValue(sourceDetailsFor(lead), "UTM Source")),
    byUtmMedium: countBy(leads, (lead) => leadTrackingValue(sourceDetailsFor(lead), "UTM Medium")),
    byPriority: countBy(leads, (lead) => lead.priority),
    byOpenLeadAge: countBy(openLeads, (lead) => leadAgeBucketLabel(lead.createdAt)),
    stageAging: createCrmStageAging(leads),
    serviceFunnel: createCrmServiceFunnel(leads),
    actionQueue,
    duplicateContacts: duplicateContacts.slice(0, 25),
    followUps: sortedFollowUpLeads
      .map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        service: lead.service,
        pipelineStage: lead.pipelineStage,
        priority: lead.priority,
        nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
        assignedTo: lead.assignedTo,
        reason: leadFollowUpLabel(lead),
        hoursSinceUpdate: leadAgeHours(lead.updatedAt),
        sourceDetails: sourceDetailsFor(lead),
      })),
  };
}

function crmHealthReportCsv(report: ReturnType<typeof createCrmHealthReport>) {
  const metricRows = Object.entries(report.totals).map(([label, value]) => ["metric", label, value]);
  const breakdownRows = [
    ...Object.entries(report.byStage).map(([label, value]) => ["stage", label, value]),
    ...Object.entries(report.byStatus).map(([label, value]) => ["status", label, value]),
    ...Object.entries(report.bySource).map(([label, value]) => ["source", label, value]),
    ...Object.entries(report.byService).map(([label, value]) => ["service", label, value]),
    ...Object.entries(report.byLandingPage).map(([label, value]) => ["landingPage", label, value]),
    ...Object.entries(report.byLandingReferrer).map(([label, value]) => ["landingReferrer", label, value]),
    ...Object.entries(report.byCampaign).map(([label, value]) => ["campaign", label, value]),
    ...Object.entries(report.byUtmSource).map(([label, value]) => ["utmSource", label, value]),
    ...Object.entries(report.byUtmMedium).map(([label, value]) => ["utmMedium", label, value]),
    ...Object.entries(report.byOpenLeadAge).map(([label, value]) => ["openLeadAge", label, value]),
    ...report.stageAging.map((stage) => [
      "stageAging",
      stage.stage,
      `${stage.openLeads} open, ${stage.followUpLeads} follow-up, ${stage.highPriorityLeads} high, ${stage.oldestOpenLeadAgeHours}h oldest`,
    ]),
    ...report.serviceFunnel.map((service) => [
      "serviceFunnel",
      service.service,
      `${service.leads} leads, ${service.openLeads} open, ${service.estimateLeads} estimates, ${service.wonLeads} won, ${service.lostLeads} lost, ${service.conversionRate}% conversion`,
    ]),
  ];
  const followUpRows = report.followUps.map((lead) => [
    "followUp",
    lead.name,
    `${lead.reason} (${lead.hoursSinceUpdate} hours)`,
  ]);
  const duplicateRows = report.duplicateContacts.map((group) => [
    "duplicateContact",
    `${group.type}:${group.value}`,
    `${group.count} leads (${group.openCount} open)`,
  ]);
  const actionRows = report.actionQueue.map((lead) => [
    "actionQueue",
    lead.name,
    `${lead.urgency}: ${lead.action} (${lead.detail})`,
  ]);
  const rows = [...metricRows, ...breakdownRows, ...actionRows, ...followUpRows, ...duplicateRows];

  return [["section", "label", "value"].join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function crmActionQueueCsv(report: ReturnType<typeof createCrmHealthReport>) {
  const headers = [
    "name",
    "email",
    "phone",
    "service",
    "pipelineStage",
    "status",
    "priority",
    "urgency",
    "category",
    "action",
    "detail",
    "nextFollowUpAt",
    "ageHours",
    "hoursSinceUpdate",
    "source",
    "capturedPage",
    "referrer",
    "landingPage",
    "landingReferrer",
    "tracking",
    "landingTracking",
    "assignedTo",
  ];
  const rows = report.actionQueue.map((lead) =>
    [
      lead.name,
      lead.email,
      lead.phone,
      lead.service,
      lead.pipelineStage,
      lead.status,
      lead.priority,
      lead.urgency,
      lead.category,
      lead.action,
      lead.detail,
      lead.nextFollowUpAt,
      lead.ageHours,
      lead.hoursSinceUpdate,
      lead.source,
      lead.sourceDetails.page,
      lead.sourceDetails.referrer,
      lead.sourceDetails.landingPage,
      lead.sourceDetails.landingReferrer,
      lead.sourceDetails.tracking,
      lead.sourceDetails.landingTracking,
      lead.assignedTo,
    ].map(csvValue).join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

function createFormSubmissionReport(submissions: CmsFormSubmission[], forms: CmsForm[], leads: CrmLead[]) {
  const formById = new Map(forms.map((form) => [form.id, form]));
  const formBySlug = new Map(forms.map((form) => [form.slug, form]));
  const leadIds = new Set(leads.map((lead) => lead.id));
  const normalized = submissions
    .map((submission) => {
      const form = (submission.formId ? formById.get(submission.formId) : undefined) ?? formBySlug.get(submission.formSlug);
      const email = submission.email ?? submissionFieldString(submission, "email");
      const phone = submission.phone ?? submissionFieldString(submission, "phone");
      const hasLead = Boolean(submission.leadId && leadIds.has(submission.leadId));
      const staleLead = Boolean(submission.leadId && !leadIds.has(submission.leadId));
      const blockedStatus = submission.status === "lead-created" && staleLead
        ? false
        : nonConvertibleFormSubmissionStatuses.has(submission.status);
      return {
        id: submission.id,
        formId: submission.formId,
        formName: form?.name ?? submission.formSlug,
        formSlug: submission.formSlug,
        name: submission.name ?? "Website Lead",
        email,
        phone,
        service: submission.service ?? "",
        status: submission.status,
        leadId: submission.leadId,
        hasLead,
        staleLead,
        hasContact: Boolean(email || phone),
        convertible: Boolean(
          !hasLead &&
          (email || phone) &&
          !blockedStatus,
        ),
        sourceUrl: submission.sourceUrl ?? "",
        referrer: submission.referrer ?? "",
        landingPage: submissionFieldString(submission, "landingPage"),
        landingReferrer: submissionFieldString(submission, "landingReferrer"),
        tracking: [...sourceTrackingNotes(submission.sourceUrl), ...submissionLandingTrackingNotes(submission)].join("; "),
        createdAt: submission.createdAt.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const actionQueue = normalized
    .map((submission) => {
      if (submission.staleLead) {
        return {
          ...submission,
          priority: 0,
          priorityLabel: "stale-lead",
          nextAction: "Clear stale CRM link.",
          issue: "Submission points to a CRM lead that no longer exists.",
        };
      }
      if (submission.convertible) {
        return {
          ...submission,
          priority: 1,
          priorityLabel: "create-lead",
          nextAction: "Create CRM lead.",
          issue: "Submission has contact details and is ready to enter the CRM pipeline.",
        };
      }
      if (!submission.hasLead && !submission.hasContact && !nonConvertibleFormSubmissionStatuses.has(submission.status)) {
        return {
          ...submission,
          priority: 2,
          priorityLabel: "missing-contact",
          nextAction: "Review contact details.",
          issue: "Submission is unlinked but does not include an email address or phone number.",
        };
      }
      if (!submission.hasLead && submission.status === "new") {
        return {
          ...submission,
          priority: 3,
          priorityLabel: "review-new",
          nextAction: "Review new submission.",
          issue: "Submission has not been linked to CRM or marked reviewed.",
        };
      }
      return null;
    })
    .filter((submission): submission is NonNullable<typeof submission> => Boolean(submission))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        a.formName.localeCompare(b.formName),
    )
    .slice(0, 50);

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    totals: {
      submissions: submissions.length,
      forms: forms.length,
      linkedLeads: normalized.filter((submission) => submission.hasLead).length,
      unlinkedSubmissions: normalized.filter((submission) => !submission.hasLead).length,
      staleLinkedSubmissions: normalized.filter((submission) => submission.staleLead).length,
      convertibleSubmissions: normalized.filter((submission) => submission.convertible).length,
      newToday: submissions.filter((submission) => submission.createdAt.toDateString() === new Date().toDateString()).length,
    },
    byForm: countBy(normalized, (submission) => submission.formName),
    byStatus: countBy(normalized, (submission) => submission.status),
    byLandingPage: countBy(normalized, (submission) => submission.landingPage || submission.sourceUrl),
    byLandingReferrer: countBy(normalized, (submission) => submission.landingReferrer || submission.referrer || "direct"),
    byPriorityLabel: countBy(actionQueue, (submission) => submission.priorityLabel),
    actionQueue,
    recent: normalized.slice(0, 25),
    submissions: normalized,
  };
}

async function createLeadFromFormSubmission(submission: CmsFormSubmission, initialStage: string) {
  if (submission.leadId) {
    const linkedLead = (await storage.listLeads()).find((lead) => lead.id === submission.leadId);
    if (linkedLead) {
      return { skipped: true as const, reason: "This submission is already linked to a CRM lead." };
    }
  }

  const staleLeadCreatedSubmission = submission.status === "lead-created" && Boolean(submission.leadId);
  if (nonConvertibleFormSubmissionStatuses.has(submission.status) && !staleLeadCreatedSubmission) {
    return { skipped: true as const, reason: `Submission status "${submission.status}" is not convertible.` };
  }

  const email = submission.email?.trim() || submissionFieldString(submission, "email") || null;
  const phone = submission.phone?.trim() || submissionFieldString(submission, "phone") || null;
  if (!email && !phone) {
    return { skipped: true as const, reason: "Email or phone is required before creating a CRM lead." };
  }

  const forms = await storage.listCms("forms");
  const matchingForm = forms.find((form) => form.id === submission.formId || form.slug === submission.formSlug);
  const fieldLabels = {
    ...Object.fromEntries((matchingForm?.fields ?? []).map((field) => [field.name.trim(), field.label.trim()])),
    ...leadAttributionFieldLabels,
  };
  const leadPayload = normalizeLeadPayload<InsertCrmLead>({
    name: submission.name?.trim() || submissionFieldString(submission, "name") || "Website Lead",
    email,
    phone,
    service: submission.service?.trim() || submissionFieldString(submission, "service") || null,
    message: submission.message?.trim() || submissionFieldString(submission, "message") || "Website form submission.",
    source: submission.formSlug?.trim() || "website",
    status: "new",
    pipelineStage: initialStage,
    priority: "normal",
    nextFollowUpAt: null,
    notes: buildLeadSourceNotes(
      `Converted from form submission ${submission.id}.`,
      submission.sourceUrl,
      submission.referrer,
      submission.fields,
      fieldLabels,
    ),
    assignedTo: null,
  });
  const existingOpenLead = (await storage.listLeads()).find((currentLead) =>
    leadIsOpen(currentLead) && leadsShareContact(currentLead, { email, phone })
  );
  const lead = existingOpenLead
    ? await storage.updateLead(existingOpenLead.id, {
        notes: appendCrmActivityNote(existingOpenLead.notes, publicDuplicateLeadNote(existingOpenLead, leadPayload)),
      }) ?? existingOpenLead
    : await storage.createLead(leadPayload);
  const updatedSubmission = await storage.updateCms("formSubmissions", submission.id, {
    status: "lead-created",
    leadId: lead.id,
  });
  if (!updatedSubmission) {
    throw new Error("Submission could not be updated after lead creation.");
  }

  return { skipped: false as const, lead, submission: updatedSubmission };
}

function formSubmissionReportCsv(report: ReturnType<typeof createFormSubmissionReport>) {
  const headers = [
    "formName",
    "formSlug",
    "name",
    "email",
    "phone",
    "service",
    "status",
    "hasLead",
    "staleLead",
    "hasContact",
    "leadId",
    "sourceUrl",
    "referrer",
    "landingPage",
    "landingReferrer",
    "tracking",
    "createdAt",
  ];
  const rows = report.submissions.map((submission) => [
    submission.formName,
    submission.formSlug,
    submission.name,
    submission.email,
    submission.phone,
    submission.service,
    submission.status,
    submission.hasLead,
    submission.staleLead,
    submission.hasContact,
    submission.leadId ?? "",
    submission.sourceUrl,
    submission.referrer,
    submission.landingPage,
    submission.landingReferrer,
    submission.tracking,
    submission.createdAt,
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function formSubmissionActionQueueCsv(report: ReturnType<typeof createFormSubmissionReport>) {
  const headers = [
    "formName",
    "formSlug",
    "name",
    "email",
    "phone",
    "service",
    "status",
    "priority",
    "priorityLabel",
    "nextAction",
    "issue",
    "hasLead",
    "staleLead",
    "hasContact",
    "leadId",
    "sourceUrl",
    "referrer",
    "landingPage",
    "landingReferrer",
    "tracking",
    "createdAt",
  ];
  const rows = report.actionQueue.map((submission) => [
    submission.formName,
    submission.formSlug,
    submission.name,
    submission.email,
    submission.phone,
    submission.service,
    submission.status,
    submission.priority,
    submission.priorityLabel,
    submission.nextAction,
    submission.issue,
    submission.hasLead,
    submission.staleLead,
    submission.hasContact,
    submission.leadId ?? "",
    submission.sourceUrl,
    submission.referrer,
    submission.landingPage,
    submission.landingReferrer,
    submission.tracking,
    submission.createdAt,
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

async function createSystemExport() {
  const collections = Object.fromEntries(
    await Promise.all(
      cmsCollectionNames.map(async (collection) => [collection, await storage.listCms(collection)]),
    ),
  ) as Record<(typeof cmsCollectionNames)[number], unknown[]>;
  const leads = await storage.listLeads();

  return {
    exportedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    collections,
    crm: { leads },
  };
}

function createMigrationCoverageReport(collections: {
  pages: CmsPage[];
  blogPosts: CmsBlogPost[];
  sections: CmsSection[];
  forms: CmsForm[];
  media: unknown[];
}) {
  const blockProps = (block: CmsSectionBlock) => (block.props ?? {}) as Record<string, unknown>;
  const hasReviewsAnchor = (block: CmsSectionBlock) => {
    const props = blockProps(block);
    return block.id === "reviews" || props.anchor === "reviews" || props.anchorId === "reviews";
  };
  const hasAboutOwnerPhoto = (block: CmsSectionBlock) => {
    const props = blockProps(block);
    return block.type === "splitContent" && typeof props.imageUrl === "string" && props.imageUrl.includes("contractor-about");
  };
  const hasAboutProofStats = (block: CmsSectionBlock) => {
    const props = blockProps(block);
    return block.type === "statGrid" || (block.type === "splitContent" && Array.isArray(props.stats) && props.stats.length > 0);
  };
  const hasContactInfoCoverage = (block: CmsSectionBlock) => {
    const props = blockProps(block);
    const variant = typeof props.variant === "string" ? props.variant.trim().toLowerCase().replace(/[\s_-]+/g, "") : "";
    return block.type === "contactInfo" || (block.type === "form" && props.formSlug === "website-quote-request" && variant === "contactpage");
  };
  const hasBlogIntroBlock = (block: CmsSectionBlock) => {
    const props = blockProps(block);
    return block.type === "content" && typeof props.title === "string" && props.title.includes("Glass & Door Pro Blog");
  };
  const hasQuoteSectionRef = (block: CmsSectionBlock) => {
    const props = blockProps(block);
    return block.type === "sectionRef" && (props.handle === "free-quote-cta" || props.sectionId === "free-quote-cta");
  };
  const contentUpgradeLabels = (slug: string, sections: CmsSectionBlock[]) => {
    if (sections.length === 0) return [];
    return [
      slug === "home" && !sections.some((block) => block.type === "videoHero") ? "homepage video hero" : "",
      slug === "home" && !sections.some(hasReviewsAnchor) ? "homepage reviews anchor" : "",
      slug === "about" && !sections.some(hasAboutOwnerPhoto) ? "about owner photo" : "",
      slug === "about" && !sections.some(hasAboutProofStats) ? "about proof stats" : "",
      slug === "contact" && !sections.some(hasContactInfoCoverage) ? "contact info block" : "",
      slug === "blog" && !sections.some(hasBlogIntroBlock) ? "blog landing intro" : "",
      slug === "blog" && !sections.some(hasQuoteSectionRef) ? "blog quote CTA" : "",
    ].filter(Boolean);
  };
  const migrationPriority = ({
    routeType,
    hasPage,
    hasSections,
    contentUpgradeCount,
    hasSeo,
    dependencyIssueCount,
    isPublished,
    ready,
  }: {
    routeType: "primary" | "custom";
    hasPage: boolean;
    hasSections: boolean;
    contentUpgradeCount: number;
    hasSeo: boolean;
    dependencyIssueCount: number;
    isPublished: boolean;
    ready: boolean;
  }) => {
    if (ready) return { priority: 99, priorityLabel: "ready" };
    if (!hasPage) return { priority: routeType === "primary" ? 0 : 2, priorityLabel: "missing-page" };
    if (!hasSections) return { priority: routeType === "primary" ? 1 : 2, priorityLabel: "needs-sections" };
    if (contentUpgradeCount > 0) return { priority: 2, priorityLabel: "content-upgrade" };
    if (!hasSeo) return { priority: 3, priorityLabel: "seo" };
    if (dependencyIssueCount > 0) return { priority: 4, priorityLabel: "references" };
    if (!isPublished) return { priority: 5, priorityLabel: "publish" };
    return { priority: 6, priorityLabel: "review" };
  };
  const hasMediaRegistrationIssue = (issues: Array<{ message: string }>) =>
    issues.some((issue) => issue.message.includes("not registered in Media"));
  const migrationNextAction = ({
    routeType,
    hasPage,
    isPublished,
    hasSections,
    upgrades,
    hasSeo,
    dependencyIssueCount,
    ready,
  }: {
    routeType: "primary" | "custom";
    hasPage: boolean;
    isPublished: boolean;
    hasSections: boolean;
    upgrades: string[];
    hasSeo: boolean;
    dependencyIssueCount: number;
    ready: boolean;
  }) => {
    if (ready) return "CMS route is live.";
    if (!hasPage) return routeType === "primary" ? "Create the missing starter CMS page." : "Create the CMS page record.";
    if (!hasSections) return routeType === "primary" ? "Apply starter sections." : "Add CMS sections.";
    if (upgrades.length > 0) return `Apply ${upgrades.join(" and ")}.`;
    if (!hasSeo) return "Complete SEO title, description, and canonical URL.";
    if (dependencyIssueCount > 0) return "Resolve broken section, form, media, or link references.";
    if (!isPublished) return "Publish the CMS page.";
    return routeType === "primary" ? "Review why the hard-coded fallback is still active." : "Review route readiness.";
  };
  const pageBySlug = new Map(collections.pages.map((page) => [page.slug, page]));
  const expectedSlugs = new Set<string>(primaryCmsRouteSlugs);
  const slugs = Array.from(new Set([...primaryCmsRouteSlugs, ...collections.pages.map((page) => page.slug)])).sort((a, b) =>
    cmsPageUrl(a).localeCompare(cmsPageUrl(b)),
  );
  const pageRoutes = slugs.map((slug) => {
    const page = pageBySlug.get(slug) ?? null;
    const routeType = expectedSlugs.has(slug) ? "primary" : "custom";
    const isPublished = page?.status === "published";
    const dependencyIssues = page
      ? getPageDependencyIssues(page, collections.sections, collections.forms, collections.media)
      : [];
    const mediaRegistrationIssue = hasMediaRegistrationIssue(dependencyIssues);
    const hasSections = Boolean(page && page.content.sections.length > 0);
    const seoIssues = page ? seoReadinessIssues(page.seo) : [];
    const hasSeo = Boolean(page && seoIssues.length === 0);
    const upgrades = page ? contentUpgradeLabels(page.slug, page.content.sections) : [];
    const fallbackActive = !page || !isPublished || !hasSections;
    const hardCodedFallbackActive = routeType === "primary" && fallbackActive;
    const customRouteGap = routeType === "custom" && fallbackActive;
    const ready = Boolean(page && isPublished && hasSections && upgrades.length === 0 && hasSeo && dependencyIssues.length === 0);
    const customRouteReview = routeType === "custom" && !ready;
    const publishReady = Boolean(page && !isPublished && hasSections && upgrades.length === 0 && hasSeo && dependencyIssues.length === 0);
    const nextAction = mediaRegistrationIssue
      ? "Import missing local assets into Media."
      : migrationNextAction({
          routeType,
          hasPage: Boolean(page),
          isPublished: Boolean(isPublished),
          hasSections,
          upgrades,
          hasSeo,
          dependencyIssueCount: dependencyIssues.length,
          ready,
        });
    const priority = mediaRegistrationIssue
      ? { priority: 4, priorityLabel: "media-records" }
      : migrationPriority({
          routeType,
          hasPage: Boolean(page),
          hasSections,
          contentUpgradeCount: upgrades.length,
          hasSeo,
          dependencyIssueCount: dependencyIssues.length,
          isPublished: Boolean(isPublished),
          ready,
        });

    return {
      slug,
      pageId: page?.id ?? null,
      path: cmsPageUrl(slug),
      title: page?.title ?? "",
      status: page?.status ?? "missing",
      routeType,
      hasPage: Boolean(page),
      hasSections,
      hasSeo,
      contentUpgradeLabels: upgrades,
      contentUpgradeCount: upgrades.length,
      dependencyIssueCount: dependencyIssues.length,
      fallbackActive,
      hardCodedFallbackActive,
      customRouteGap,
      customRouteReview,
      publishReady,
      ready,
      nextAction,
      ...priority,
      issues: [
        ...(!page ? ["CMS page record is missing."] : []),
        ...(page && !isPublished
          ? [
              routeType === "primary"
                ? "CMS page is not published, so the hard-coded fallback is still active."
                : "CMS page is not published, so the public route is not live.",
            ]
          : []),
        ...(page && !hasSections
          ? [
              routeType === "primary"
                ? "Route is still relying on hard-coded fallback content."
                : "CMS page has no sections, so the public route has no useful CMS content.",
            ]
          : []),
        ...seoIssues,
        ...upgrades.map((upgrade) => `Starter content needs ${upgrade}.`),
        ...dependencyIssues.map((issue) => issue.message),
      ],
    };
  });
  const archiveRoutes = getPublishedBlogArchiveEntries(collections.blogPosts).map((archive) => {
    const parsedArchive = parseBlogArchiveHref(archive.loc);
    const label = parsedArchive?.value ?? archive.loc;
    const title = `${parsedArchive?.kind === "tag" ? "Tagged" : "Category"}: ${label}`;

    return {
      slug: label,
      pageId: null,
      path: archive.loc,
      title,
      status: "published",
      routeType: "blogArchive",
      hasPage: false,
      hasSections: true,
      hasSeo: true,
      contentUpgradeLabels: [],
      contentUpgradeCount: 0,
      dependencyIssueCount: 0,
      fallbackActive: false,
      hardCodedFallbackActive: false,
      customRouteGap: false,
      customRouteReview: false,
      publishReady: false,
      ready: true,
      nextAction: "Blog archive route is live.",
      priority: 99,
      priorityLabel: "ready",
      issues: [],
    };
  });
  const routes = [...pageRoutes, ...archiveRoutes].sort((a, b) => a.path.localeCompare(b.path));
  const totals = {
    routes: routes.length,
    primaryRoutes: routes.filter((route) => route.routeType === "primary").length,
    customRoutes: routes.filter((route) => route.routeType === "custom").length,
    blogArchiveRoutes: routes.filter((route) => route.routeType === "blogArchive").length,
    cmsPages: routes.filter((route) => route.hasPage).length,
    readyRoutes: routes.filter((route) => route.ready).length,
    fallbackRoutes: routes.filter((route) => route.hardCodedFallbackActive).length,
    customRouteGaps: routes.filter((route) => route.customRouteGap).length,
    customRouteReviewRoutes: routes.filter((route) => route.customRouteReview).length,
    publishReadyRoutes: routes.filter((route) => route.publishReady).length,
    draftRoutes: routes.filter((route) => route.status === "draft").length,
    seoGaps: routes.filter((route) => route.hasPage && !route.hasSeo).length,
    contentUpgrades: routes.filter((route) => route.contentUpgradeCount > 0).length,
    dependencyIssues: routes.reduce((sum, route) => sum + route.dependencyIssueCount, 0),
    missingPrimaryRoutes: routes.filter((route) => route.routeType === "primary" && !route.hasPage).length,
    blockerRoutes: routes.filter((route) => !route.ready).length,
  };
  const blockers = routes
    .filter((route) => !route.ready)
    .sort((a, b) => a.priority - b.priority || a.path.localeCompare(b.path));
  const actionQueue = blockers.slice(0, 50).map((route) => ({
    pageId: route.pageId,
    title: route.title || route.slug,
    slug: route.slug,
    path: route.path,
    routeType: route.routeType,
    status: route.status,
    priority: route.priority,
    priorityLabel: route.priorityLabel,
    nextAction: route.nextAction,
    issueCount: route.issues.length,
    dependencyIssueCount: route.dependencyIssueCount,
    contentUpgradeCount: route.contentUpgradeCount,
    publishReady: route.publishReady,
    fallbackActive: route.fallbackActive,
    issues: route.issues,
  }));

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    totals,
    byNextAction: countBy(routes, (route) => route.nextAction),
    byPriorityLabel: countBy(routes, (route) => route.priorityLabel),
    actionQueue,
    blockers,
    routes,
  };
}

function migrationCoverageCsv(report: ReturnType<typeof createMigrationCoverageReport>) {
  const headers = [
    "routeType",
    "pageId",
    "title",
    "slug",
    "path",
    "status",
    "hasPage",
    "hasSections",
    "hasSeo",
    "contentUpgradeCount",
    "contentUpgradeLabels",
    "fallbackActive",
    "hardCodedFallbackActive",
    "customRouteGap",
    "customRouteReview",
    "publishReady",
    "ready",
    "nextAction",
    "priority",
    "priorityLabel",
    "dependencyIssueCount",
    "issues",
  ];
  const rows = report.routes.map((route) => [
    route.routeType,
    route.pageId ?? "",
    route.title,
    route.slug,
    route.path,
    route.status,
    route.hasPage,
    route.hasSections,
    route.hasSeo,
    route.contentUpgradeCount,
    route.contentUpgradeLabels.join("; "),
    route.fallbackActive,
    route.hardCodedFallbackActive,
    route.customRouteGap,
    route.customRouteReview,
    route.publishReady,
    route.ready,
    route.nextAction,
    route.priority,
    route.priorityLabel,
    route.dependencyIssueCount,
    route.issues.join("; "),
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function migrationActionQueueCsv(report: ReturnType<typeof createMigrationCoverageReport>) {
  const headers = [
    "routeType",
    "title",
    "slug",
    "path",
    "status",
    "priority",
    "priorityLabel",
    "nextAction",
    "issueCount",
    "dependencyIssueCount",
    "contentUpgradeCount",
    "publishReady",
    "fallbackActive",
    "issues",
  ];
  const rows = report.actionQueue.map((route) => [
    route.routeType,
    route.title,
    route.slug,
    route.path,
    route.status,
    route.priority,
    route.priorityLabel,
    route.nextAction,
    route.issueCount,
    route.dependencyIssueCount,
    route.contentUpgradeCount,
    route.publishReady,
    route.fallbackActive,
    route.issues.join("; "),
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function withCmsPreviewParam(path: string, enabled: boolean) {
  try {
    const url = new URL(path, "https://glassanddoorpro.local");
    url.searchParams.set("cms-preview", enabled ? "1" : "0");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const basePath = path.startsWith("/") ? path : `/${path}`;
    const separator = basePath.includes("?") ? "&" : "?";
    return `${basePath}${separator}cms-preview=${enabled ? "1" : "0"}`;
  }
}

function absolutePublicRouteUrl(siteUrl: string, path: string) {
  const base = safePublicBaseUrl(siteUrl, "https://glassanddoorpro.com");

  try {
    return new URL(path, `${base}/`).toString();
  } catch {
    return new URL("/", `${base}/`).toString();
  }
}

function visualParityReviewCsv(
  report: ReturnType<typeof createMigrationCoverageReport>,
  siteUrl: string,
  routeReviews: PublicCmsVisualParityRouteReview[] = [],
) {
  const reviewsBySlug = new Map(routeReviews.map((review) => [review.slug, review]));
  const headers = [
    "title",
    "slug",
    "path",
    "originalUrl",
    "cmsPreviewUrl",
    "status",
    "ready",
    "fallbackActive",
    "reviewStatus",
    "visualParityReviewed",
    "visualParityApproved",
    "reviewedAt",
    "reviewNotes",
    "nextAction",
    "issues",
  ];
  const rows = report.routes
    .filter((route) => route.routeType === "primary")
    .map((route) => {
      const review = reviewsBySlug.get(route.slug);
      return [
        route.title || route.slug,
        route.slug,
        route.path,
        absolutePublicRouteUrl(siteUrl, withCmsPreviewParam(route.path, false)),
        absolutePublicRouteUrl(siteUrl, withCmsPreviewParam(route.path, true)),
        route.status,
        route.ready,
        route.fallbackActive,
        review?.status ?? "unreviewed",
        Boolean(review),
        review?.status === "approved",
        review?.reviewedAt ?? "",
        review?.notes ?? "",
        route.nextAction,
        route.issues.join("; "),
      ];
    });

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function createVisualParityReviewReport(
  report: ReturnType<typeof createMigrationCoverageReport>,
  siteUrl: string,
  routeReviews: PublicCmsVisualParityRouteReview[] = [],
) {
  const reviewsBySlug = new Map(routeReviews.map((review) => [review.slug, review]));
  const routes = report.routes
    .filter((route) => route.routeType === "primary")
    .map((route) => {
      const review = reviewsBySlug.get(route.slug);
      return {
        title: route.title || route.slug,
        slug: route.slug,
        path: route.path,
        originalUrl: absolutePublicRouteUrl(siteUrl, withCmsPreviewParam(route.path, false)),
        cmsPreviewUrl: absolutePublicRouteUrl(siteUrl, withCmsPreviewParam(route.path, true)),
        status: route.status,
        ready: route.ready,
        fallbackActive: route.fallbackActive,
        reviewStatus: review?.status ?? "unreviewed",
        visualParityReviewed: Boolean(review),
        visualParityApproved: review?.status === "approved",
        visualParityNeedsChanges: review?.status === "changes-needed",
        reviewedAt: review?.reviewedAt ?? null,
        reviewNotes: review?.notes ?? "",
        nextAction: route.nextAction,
        issueCount: route.issues.length,
        issues: route.issues,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    siteUrl: safePublicBaseUrl(siteUrl, "https://glassanddoorpro.com"),
    totals: {
      routes: routes.length,
      ready: routes.filter((route) => route.ready).length,
      fallbackActive: routes.filter((route) => route.fallbackActive).length,
      withIssues: routes.filter((route) => route.issueCount > 0).length,
      reviewed: routes.filter((route) => route.visualParityReviewed).length,
      approved: routes.filter((route) => route.visualParityApproved).length,
      changesNeeded: routes.filter((route) => route.visualParityNeedsChanges).length,
      unreviewed: routes.filter((route) => !route.visualParityReviewed).length,
    },
    routes,
  };
}

type PublicFrontendLaunchBlocker = {
  slug: string;
  path: string;
  status: string;
  nextAction: string;
  issueCount: number;
  issues: string[];
};

function createPublicFrontendGuardReport({
  migration,
  siteUrl,
  routeReviews,
  launchBlockers,
  publicCmsTakeoverEnabled,
  publicCmsTakeoverRequested,
  publicCmsTakeoverConfirmed,
  visualParityApproved,
}: {
  migration: ReturnType<typeof createMigrationCoverageReport>;
  siteUrl: string;
  routeReviews: PublicCmsVisualParityRouteReview[];
  launchBlockers: PublicFrontendLaunchBlocker[];
  publicCmsTakeoverEnabled: boolean;
  publicCmsTakeoverRequested: boolean;
  publicCmsTakeoverConfirmed: boolean;
  visualParityApproved: boolean;
}) {
  const reviewedSlugs = new Set(routeReviews.map((review) => review.slug));
  const reviewBySlug = new Map(routeReviews.map((review) => [review.slug, review]));
  const routes = migration.routes
    .filter((route) => route.routeType === "primary")
    .map((route) => {
      const originalPath = withCmsPreviewParam(route.path, false);
      const cmsPreviewPath = withCmsPreviewParam(route.path, true);
      const review = reviewBySlug.get(route.slug);

      return {
        title: route.title || route.slug,
        slug: route.slug,
        path: route.path,
        status: route.status,
        cmsReady: route.ready,
        priorityLabel: route.priorityLabel,
        hardCodedFallbackActive: route.hardCodedFallbackActive,
        protectedByOriginalFallback: !publicCmsTakeoverEnabled,
        visualParityReviewed: reviewedSlugs.has(route.slug),
        visualParityApproved: review?.status === "approved",
        reviewStatus: review?.status ?? "not-reviewed",
        reviewedAt: review?.reviewedAt ?? null,
        reviewNotes: review?.notes ?? "",
        originalPath,
        cmsPreviewPath,
        publicUrl: absolutePublicRouteUrl(siteUrl, route.path),
        originalUrl: absolutePublicRouteUrl(siteUrl, originalPath),
        cmsPreviewUrl: absolutePublicRouteUrl(siteUrl, cmsPreviewPath),
        nextAction: route.nextAction,
        issueCount: route.issues.length,
        issues: route.issues,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    mode: publicCmsTakeoverEnabled
      ? "CMS takeover"
      : publicCmsTakeoverRequested
        ? "Original frontend protected (CMS launch blocked)"
        : "Original frontend protected",
    approvals: {
      publicCmsTakeoverRequested,
      publicCmsTakeoverConfirmed,
      visualParityApproved,
      publicCmsTakeoverEnabled,
    },
    totals: {
      primaryRoutes: routes.length,
      protectedRoutes: routes.filter((route) => route.protectedByOriginalFallback).length,
      cmsReadyRoutes: routes.filter((route) => route.cmsReady).length,
      visualParityReviewedRoutes: routes.filter((route) => route.visualParityReviewed).length,
      visualParityApprovedRoutes: routes.filter((route) => route.visualParityApproved).length,
      visualParityNeedsChangesRoutes: routes.filter((route) => route.reviewStatus === "changes-needed").length,
      unreviewedRoutes: routes.filter((route) => !route.visualParityReviewed).length,
      launchBlockers: launchBlockers.length,
    },
    launchBlockers,
    routes,
  };
}

function publicFrontendGuardCsv(report: ReturnType<typeof createPublicFrontendGuardReport>) {
  const headers = [
    "title",
    "slug",
    "path",
    "status",
    "protectedByOriginalFallback",
    "cmsReady",
    "visualParityReviewed",
    "visualParityApproved",
    "reviewStatus",
    "reviewedAt",
    "reviewNotes",
    "publicUrl",
    "originalUrl",
    "cmsPreviewUrl",
    "nextAction",
    "issueCount",
    "issues",
  ];
  const rows = report.routes.map((route) => [
    route.title,
    route.slug,
    route.path,
    route.status,
    route.protectedByOriginalFallback,
    route.cmsReady,
    route.visualParityReviewed,
    route.visualParityApproved,
    route.reviewStatus,
    route.reviewedAt ?? "",
    route.reviewNotes,
    route.publicUrl,
    route.originalUrl,
    route.cmsPreviewUrl,
    route.nextAction,
    route.issueCount,
    route.issues.join("; "),
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

async function getPublicCmsTakeoverBlockers(candidateSiteValue?: Record<string, unknown>) {
  const [pages, blogPosts, sections, forms, media, settings] = await Promise.all([
    storage.listCms("pages"),
    storage.listCms("blogPosts"),
    storage.listCms("sections"),
    storage.listCms("forms"),
    storage.listCms("media"),
    storage.listCms("settings"),
  ]);
  const report = createMigrationCoverageReport({ pages, blogPosts, sections, forms, media });
  const siteValue = candidateSiteValue ?? settings.find((setting) => setting.key === "site")?.value ?? {};
  const visualParityBlocker = publicCmsVisualParityApproved(siteValue)
    ? []
    : [{
        path: withCmsPreviewParam("/", true),
        slug: "visual-parity",
        status: "review",
        nextAction: "Approve CMS visual parity with the original public site.",
        issues: ["Review the CMS preview against the current Glass & Door Pro frontend before enabling takeover."],
      }];

  const routeBlockers = report.routes
    .filter((route) => route.routeType === "primary" && !route.ready)
    .map((route) => ({
      path: route.path,
      slug: route.slug,
      status: route.status,
      nextAction: route.nextAction,
      issues: route.issues,
    }));

  return [...visualParityBlocker, ...routeBlockers];
}

function getCandidateSiteSettingValue(value: Partial<CmsSetting>, current?: CmsSetting | null) {
  const nextKey = value.key ?? current?.key;
  if (nextKey !== "site") return null;
  return {
    ...(current?.value ?? {}),
    ...(value.value ?? {}),
  } as Record<string, unknown>;
}

function settingValueEnablesPublicCms(value: Partial<CmsSetting>, current?: CmsSetting | null) {
  const nextValue = getCandidateSiteSettingValue(value, current);
  return nextValue ? publicCmsTakeoverValueRequested(nextValue) : false;
}

function mediaIsImage(media: CmsMedia) {
  return media.mimeType.trim().startsWith("image/");
}

function mediaIsVideo(media: CmsMedia) {
  return media.mimeType.trim().startsWith("video/");
}

function mediaIsDocument(media: CmsMedia) {
  const mimeType = media.mimeType.trim();
  return mimeType === "application/pdf" || mimeType.includes("document");
}

function mediaIsGalleryReadyRecord(media: CmsMedia) {
  const searchable = [
    media.url,
    media.name,
    media.caption ?? "",
    media.altText ?? "",
    media.category ?? "",
    ...(media.tags ?? []),
  ].join(" ").toLowerCase();
  return mediaIsImage(media) && (media.isGalleryReady || searchable.includes("gallery"));
}

function mediaGeneratedAltText(media: CmsMedia) {
  const source = media.name?.trim() || mediaNameFromUrl(media.url);
  return source
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/-\d{10,}$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Glass and door project image";
}

function cleanGalleryCaptionBase(caption: string, fallback: string) {
  const cleaned = mediaGalleryCategoryValues
    .reduce(
      (value, category) =>
        value
          .replace(new RegExp(`^gallery\\s*[-:]\\s*${category}\\s*[-:]\\s*`, "i"), "")
          .replace(new RegExp(`^${category}\\s*[-:]\\s*`, "i"), ""),
      caption.replace(/^gallery\s*[-:]\s*/i, ""),
    )
    .replace(/\bgallery\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || fallback;
}

function inferMediaGalleryCategory(value: {
  url?: string | null;
  name?: string | null;
  caption?: string | null;
  altText?: string | null;
  category?: string | null;
  tags?: string[] | null;
}) {
  if (value.category && mediaGalleryCategories.has(value.category)) {
    return value.category as (typeof mediaGalleryCategoryValues)[number];
  }

  const searchable = [
    value.url ?? "",
    value.name ?? "",
    value.caption ?? "",
    value.altText ?? "",
    ...(value.tags ?? []),
  ].join(" ").toLowerCase();

  if (searchable.includes("frameless") || searchable.includes("shower")) return "Frameless Showers";
  if (searchable.includes("commercial") || searchable.includes("storefront")) return "Commercial Glass";
  if (searchable.includes("window") || searchable.includes("sunroom")) return "Windows";
  if (searchable.includes("door")) return "Doors";
  return null;
}

function mediaMatchesGalleryCategory(media: CmsMedia, category: string) {
  if (!category.trim()) return true;
  const normalized = category.trim().toLowerCase();
  const searchable = [
    media.url,
    media.name,
    media.caption ?? "",
    media.altText ?? "",
    media.category ?? "",
    ...(media.tags ?? []),
  ].join(" ").toLowerCase();

  if (media.category?.trim().toLowerCase() === normalized) return true;
  if ((media.tags ?? []).some((tag) => tag.trim().toLowerCase() === normalized)) return true;
  if (normalized === "frameless-showers") return searchable.includes("frameless") || searchable.includes("shower");
  if (normalized === "commercial-glass") return searchable.includes("commercial") || searchable.includes("storefront");
  return searchable.includes(normalized.replaceAll("-", " ")) || searchable.includes(normalized);
}

function sanitizePublicFormField(field: CmsFormField): CmsFormField | null {
  const id = field.id.trim();
  const name = field.name.trim();
  const label = field.label.trim();

  if (!id || !name || !label || !supportedFormFieldTypes.has(field.type)) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) return null;

  const options = field.options?.map((option) => option.trim()).filter(Boolean);
  if (field.type === "select" && (!options || options.length === 0)) return null;

  return {
    id,
    name,
    label,
    type: field.type,
    required: Boolean(field.required),
    ...(field.placeholder?.trim() ? { placeholder: field.placeholder.trim() } : {}),
    ...(options?.length ? { options } : {}),
  };
}

function publicFormResponse(form: CmsForm) {
  const seenNames = new Set<string>();
  const fields = form.fields.flatMap((field) => {
    const publicField = sanitizePublicFormField(field);
    if (!publicField || seenNames.has(publicField.name)) return [];
    seenNames.add(publicField.name);
    return [publicField];
  });

  return {
    ...form,
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description?.trim() || null,
    fields,
    notificationEmail: null,
  };
}

function valueReferencesMedia(value: unknown, media: CmsMedia): boolean {
  if (typeof value === "string") {
    return value === media.id || value === media.url || (Boolean(media.url) && value.includes(media.url));
  }
  if (Array.isArray(value)) {
    return value.some((item) => valueReferencesMedia(item, media));
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => valueReferencesMedia(item, media));
  }
  return false;
}

function mediaUsageItems(media: CmsMedia, collections: {
  pages: CmsPage[];
  blogPosts: CmsBlogPost[];
  sections: CmsSection[];
  branding: CmsBranding[];
  sidebars: CmsSidebar[];
}) {
  const usage: Array<{ type: string; title: string; path: string }> = [];

  collections.pages.forEach((page) => {
    if (valueReferencesMedia({ content: page.content, seo: page.seo }, media)) {
      usage.push({ type: "page", title: page.title, path: cmsPageUrl(page.slug) });
    }
  });
  collections.blogPosts.forEach((post) => {
    if (post.featuredImageId === media.id || valueReferencesMedia({ body: post.body, seo: post.seo }, media)) {
      usage.push({ type: "blogPost", title: post.title, path: `/blog/${encodeURIComponent(post.slug)}` });
    }
  });
  collections.sections.forEach((section) => {
    if (valueReferencesMedia(section.blocks, media)) {
      usage.push({ type: "section", title: section.name, path: section.handle });
    }
  });
  collections.branding.forEach((branding) => {
    if (valueReferencesMedia({ logoUrl: branding.logoUrl, faviconUrl: branding.faviconUrl }, media)) {
      usage.push({ type: "branding", title: branding.siteName, path: "branding" });
    }
  });
  collections.sidebars.forEach((sidebar) => {
    if (valueReferencesMedia(sidebar.widgets, media)) {
      usage.push({ type: "sidebar", title: sidebar.name, path: sidebar.location });
    }
  });

  return usage;
}

function createMediaAuditReport(collections: {
  media: CmsMedia[];
  pages: CmsPage[];
  blogPosts: CmsBlogPost[];
  sections: CmsSection[];
  branding: CmsBranding[];
  sidebars: CmsSidebar[];
}) {
  const items = collections.media
    .map((media) => {
      const usage = mediaUsageItems(media, collections);
      const isImage = mediaIsImage(media);
      const galleryReady = mediaIsGalleryReadyRecord(media);
      const category = media.category?.trim() ?? "";
      const issues = [
        ...(isImage && !media.altText?.trim() ? ["Image is missing alt text."] : []),
        ...(isImage && (!media.width || !media.height) ? ["Image is missing width or height metadata."] : []),
        ...(!media.url?.trim() ? ["Media URL is missing."] : []),
        ...(category && !mediaGalleryCategories.has(category) ? [`Media category "${category}" is not supported.`] : []),
        ...(galleryReady && !category ? ["Gallery-ready media should have a gallery category."] : []),
        ...(usage.length === 0 ? ["Media is not referenced by CMS pages, sections, blog posts, branding, or sidebars."] : []),
      ];
      return {
        id: media.id,
        name: media.name,
        url: media.url,
        mimeType: media.mimeType,
        kind: isImage ? "image" : mediaIsVideo(media) ? "video" : mediaIsDocument(media) ? "document" : "file",
        altText: media.altText ?? "",
        caption: media.caption ?? "",
        category,
        tags: media.tags ?? [],
        sizeBytes: media.sizeBytes ?? 0,
        width: media.width ?? null,
        height: media.height ?? null,
        galleryReady,
        usageCount: usage.length,
        usage,
        issueCount: issues.length,
        issues,
        updatedAt: media.updatedAt.toISOString(),
      };
    })
    .sort((a, b) => b.issueCount - a.issueCount || a.name.localeCompare(b.name));
  const mediaAction = (item: (typeof items)[number]) => {
    if (item.kind === "image" && !item.altText.trim()) return "Add image alt text.";
    if (item.kind === "image" && (!item.width || !item.height)) return "Refresh image dimensions.";
    if (item.galleryReady && !item.category.trim()) return "Assign a gallery category.";
    if (item.category.trim() && !mediaGalleryCategories.has(item.category)) return "Replace unsupported gallery category.";
    if (!item.url.trim()) return "Add a media URL.";
    if (item.usageCount === 0) return "Attach or remove unused media.";
    return "Review media metadata.";
  };
  const mediaPriority = (item: (typeof items)[number]) => {
    if (!item.url.trim()) return { priority: 0, priorityLabel: "missing-url" };
    if (item.kind === "image" && !item.altText.trim()) return { priority: 1, priorityLabel: "alt-text" };
    if (item.galleryReady && !item.category.trim()) return { priority: 2, priorityLabel: "gallery-category" };
    if (item.category.trim() && !mediaGalleryCategories.has(item.category)) return { priority: 3, priorityLabel: "unsupported-category" };
    if (item.kind === "image" && (!item.width || !item.height)) return { priority: 4, priorityLabel: "dimensions" };
    if (item.usageCount === 0) return { priority: 5, priorityLabel: "unused" };
    return { priority: 6, priorityLabel: "review" };
  };
  const actionQueue = items
    .filter((item) => item.issueCount > 0)
    .map((item) => ({
      ...item,
      ...mediaPriority(item),
      nextAction: mediaAction(item),
    }))
    .sort((a, b) => a.priority - b.priority || b.issueCount - a.issueCount || a.name.localeCompare(b.name))
    .slice(0, 50);
  const totals = {
    media: items.length,
    images: items.filter((item) => item.kind === "image").length,
    videos: items.filter((item) => item.kind === "video").length,
    documents: items.filter((item) => item.kind === "document").length,
    galleryReady: items.filter((item) => item.galleryReady).length,
    galleryMissingCategory: items.filter((item) => item.galleryReady && !item.category.trim()).length,
    galleryByCategory: Object.fromEntries(
      mediaGalleryCategoryValues.map((category) => [
        category,
        items.filter((item) => item.galleryReady && item.category === category).length,
      ]),
    ) as Record<(typeof mediaGalleryCategoryValues)[number], number>,
    galleryUnsupportedCategory: items.filter((item) => item.galleryReady && item.category.trim() && !mediaGalleryCategories.has(item.category)).length,
    missingAltText: items.filter((item) => item.kind === "image" && !item.altText.trim()).length,
    missingDimensions: items.filter((item) => item.kind === "image" && (!item.width || !item.height)).length,
    unused: items.filter((item) => item.usageCount === 0).length,
    withIssues: items.filter((item) => item.issueCount > 0).length,
  };

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    totals,
    byPriorityLabel: countBy(actionQueue, (item) => item.priorityLabel),
    actionQueue,
    items,
  };
}

function mediaAuditCsv(report: ReturnType<typeof createMediaAuditReport>) {
  const headers = [
    "name",
    "kind",
    "mimeType",
    "url",
    "galleryReady",
    "usageCount",
    "issueCount",
    "issues",
    "category",
    "tags",
    "altText",
    "caption",
    "width",
    "height",
    "sizeBytes",
    "updatedAt",
  ];
  const rows = report.items.map((item) => [
    item.name,
    item.kind,
    item.mimeType,
    item.url,
    item.galleryReady,
    item.usageCount,
    item.issueCount,
    item.issues.join("; "),
    item.category,
    item.tags.join("; "),
    item.altText,
    item.caption,
    item.width ?? "",
    item.height ?? "",
    item.sizeBytes,
    item.updatedAt,
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function mediaActionQueueCsv(report: ReturnType<typeof createMediaAuditReport>) {
  const headers = [
    "name",
    "kind",
    "mimeType",
    "url",
    "priority",
    "priorityLabel",
    "nextAction",
    "galleryReady",
    "category",
    "usageCount",
    "issueCount",
    "issues",
    "width",
    "height",
    "sizeBytes",
    "updatedAt",
  ];
  const rows = report.actionQueue.map((item) => [
    item.name,
    item.kind,
    item.mimeType,
    item.url,
    item.priority,
    item.priorityLabel,
    item.nextAction,
    item.galleryReady,
    item.category,
    item.usageCount,
    item.issueCount,
    item.issues.join("; "),
    item.width ?? "",
    item.height ?? "",
    item.sizeBytes,
    item.updatedAt,
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

const starterReusableSectionHandles = new Set(["free-quote-cta", "project-faq"]);

function createSectionActionReport(collections: {
  sections: CmsSection[];
  pages: CmsPage[];
  forms: CmsForm[];
  media: CmsMedia[];
}) {
  const items = collections.sections
    .map((section) => {
      const pageReferences = collections.pages
        .map((page) => countSectionReferences(page, section, collections.sections))
        .reduce((sum, count) => sum + count, 0);
      const sectionReferences = collections.sections
        .filter((candidate) => candidate.id !== section.id)
        .map((candidate) => countSectionReferencesSection(candidate, section, collections.sections))
        .reduce((sum, count) => sum + count, 0);
      const saveIssues = getSectionSaveIssues(section);
      const blockIssues = getSectionDependencyIssues(section, collections.sections, collections.forms, collections.media);
      const starterLibraryReady =
        starterReusableSectionHandles.has(section.handle) &&
        section.isReusable &&
        section.blocks.length > 0 &&
        saveIssues.length === 0 &&
        blockIssues.length === 0;
      const issues = [
        ...saveIssues.map((issue) => issue.message),
        ...blockIssues.map((issue) => issue.message),
        ...(section.blocks.length === 0 ? ["Section has no content blocks."] : []),
        ...(!section.isReusable ? ["Section is not marked reusable, so it cannot be inserted from CMS Pages."] : []),
        ...(pageReferences + sectionReferences === 0 && !starterLibraryReady
          ? ["Section is not referenced by CMS pages or reusable sections."]
          : []),
      ];

      return {
        id: section.id,
        name: section.name,
        handle: section.handle,
        category: section.category,
        isReusable: section.isReusable,
        blockCount: section.blocks.length,
        pageReferences,
        sectionReferences,
        starterLibraryReady,
        usageCount: pageReferences + sectionReferences,
        issueCount: issues.length,
        issues,
        updatedAt: section.updatedAt.toISOString(),
      };
    })
    .sort((a, b) => b.issueCount - a.issueCount || a.name.localeCompare(b.name));

  const sectionPriority = (item: (typeof items)[number]) => {
    if (!item.name.trim() || !item.handle.trim() || !item.category.trim()) return { priority: 0, priorityLabel: "details" };
    if (item.blockCount === 0) return { priority: 1, priorityLabel: "empty" };
    if (item.issues.some((issue) => issue.includes("Unsupported block type") || issue.includes("unsafe") || issue.includes("not saved") || issue.includes("inactive") || issue.includes("circular") || issue.includes("deeper than"))) {
      return { priority: 2, priorityLabel: "block-issues" };
    }
    if (!item.isReusable) return { priority: 3, priorityLabel: "not-reusable" };
    if (item.starterLibraryReady && item.issueCount === 0) return { priority: 6, priorityLabel: "starter-library" };
    if (item.usageCount === 0) return { priority: 4, priorityLabel: "unused" };
    if (item.issueCount > 0) return { priority: 5, priorityLabel: "review" };
    return { priority: 6, priorityLabel: "ready" };
  };
  const sectionAction = (item: (typeof items)[number]) => {
    if (!item.name.trim() || !item.handle.trim() || !item.category.trim()) return "Complete section details.";
    if (item.blockCount === 0) return "Add content blocks.";
    if (item.issues.some((issue) => issue.includes("not saved") || issue.includes("inactive") || issue.includes("circular") || issue.includes("deeper than"))) return "Resolve broken references.";
    if (item.issues.some((issue) => issue.includes("unsafe") || issue.includes("URL"))) return "Replace unsafe URLs.";
    if (item.issues.some((issue) => issue.includes("Gallery-ready") || issue.includes("fallback image"))) return "Add gallery media or fallback items.";
    if (!item.isReusable) return "Mark reusable if needed.";
    if (item.starterLibraryReady && item.issueCount === 0) return "Starter library section ready.";
    if (item.usageCount === 0) return "Insert into a CMS page or remove.";
    if (item.issueCount > 0) return "Review section readiness.";
    return "Section ready.";
  };
  const actionQueue = items
    .map((item) => ({
      ...item,
      ...sectionPriority(item),
      nextAction: sectionAction(item),
    }))
    .filter((item) => item.priority < 6)
    .sort((a, b) => a.priority - b.priority || b.issueCount - a.issueCount || a.name.localeCompare(b.name))
    .slice(0, 50);
  const totals = {
    sections: items.length,
    reusable: items.filter((item) => item.isReusable).length,
    inUse: items.filter((item) => item.usageCount > 0).length,
    starterLibrary: items.filter((item) => item.starterLibraryReady).length,
    unused: items.filter((item) => item.usageCount === 0).length,
    empty: items.filter((item) => item.blockCount === 0).length,
    withIssues: items.filter((item) => item.issueCount > 0).length,
    actionable: actionQueue.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    totals,
    byPriorityLabel: countBy(actionQueue, (item) => item.priorityLabel),
    actionQueue,
    items,
  };
}

function sectionActionQueueCsv(report: ReturnType<typeof createSectionActionReport>) {
  const headers = [
    "name",
    "handle",
    "category",
    "priority",
    "priorityLabel",
    "nextAction",
    "isReusable",
    "usageCount",
    "pageReferences",
    "sectionReferences",
    "blockCount",
    "issueCount",
    "issues",
    "updatedAt",
  ];
  const rows = report.actionQueue.map((item) => [
    item.name,
    item.handle,
    item.category,
    item.priority,
    item.priorityLabel,
    item.nextAction,
    item.isReusable,
    item.usageCount,
    item.pageReferences,
    item.sectionReferences,
    item.blockCount,
    item.issueCount,
    item.issues.join("; "),
    item.updatedAt,
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function createMenuActionReport(collections: {
  menus: CmsMenu[];
  pages: CmsPage[];
  posts: CmsBlogPost[];
}) {
  const items = collections.menus
    .map((menu) => {
      const flattened = flattenMenuItems(menu.items);
      const saveIssues = getMenuSaveIssues(menu);
      const readinessIssues = getMenuReadinessIssues(menu, collections.pages, collections.posts);
      const issues = Array.from(new Set([...saveIssues, ...readinessIssues]));

      return {
        id: menu.id,
        name: menu.name,
        location: menu.location,
        isActive: menu.isActive,
        itemCount: menu.items.length,
        linkCount: flattened.length,
        issueCount: issues.length,
        issues,
        updatedAt: menu.updatedAt.toISOString(),
      };
    })
    .sort((a, b) => b.issueCount - a.issueCount || a.name.localeCompare(b.name));

  const menuPriority = (item: (typeof items)[number]) => {
    if (!item.name.trim() || !item.location.trim()) return { priority: 0, priorityLabel: "details" };
    if (item.issues.some((issue) => issue.includes("unsafe") || issue.includes("Duplicate menu IDs") || issue.includes("label and URL"))) {
      return { priority: 1, priorityLabel: "invalid-links" };
    }
    if (item.isActive && item.itemCount === 0) return { priority: 2, priorityLabel: "empty-active" };
    if (item.issues.some((issue) => issue.includes("missing CMS page") || issue.includes("missing blog post"))) {
      return { priority: 3, priorityLabel: "missing-targets" };
    }
    if (item.issues.some((issue) => issue.includes("draft CMS page") || issue.includes("draft blog post"))) {
      return { priority: 4, priorityLabel: "draft-targets" };
    }
    if (item.issues.some((issue) => issue.includes("Header navigation"))) {
      return { priority: 5, priorityLabel: "header-coverage" };
    }
    if (item.issueCount > 0) return { priority: 6, priorityLabel: "review" };
    return { priority: 7, priorityLabel: "ready" };
  };
  const menuAction = (item: (typeof items)[number]) => {
    if (!item.name.trim() || !item.location.trim()) return "Complete menu details.";
    if (item.issues.some((issue) => issue.includes("unsafe"))) return "Replace unsafe menu links.";
    if (item.issues.some((issue) => issue.includes("Duplicate menu IDs"))) return "Fix duplicate menu IDs.";
    if (item.issues.some((issue) => issue.includes("label and URL"))) return "Complete item labels and URLs.";
    if (item.isActive && item.itemCount === 0) return "Add navigation links.";
    if (item.issues.some((issue) => issue.includes("missing CMS page") || issue.includes("missing blog post"))) return "Remove or create missing link targets.";
    if (item.issues.some((issue) => issue.includes("draft CMS page") || issue.includes("draft blog post"))) return "Publish or replace draft link targets.";
    if (item.issues.some((issue) => issue.includes("Header navigation"))) return "Add required header links.";
    if (item.issueCount > 0) return "Review navigation readiness.";
    return "Navigation ready.";
  };
  const actionQueue = items
    .map((item) => ({
      ...item,
      ...menuPriority(item),
      nextAction: menuAction(item),
    }))
    .filter((item) => item.priority < 7)
    .sort((a, b) => a.priority - b.priority || b.issueCount - a.issueCount || a.name.localeCompare(b.name))
    .slice(0, 50);
  const totals = {
    menus: items.length,
    active: items.filter((item) => item.isActive).length,
    inactive: items.filter((item) => !item.isActive).length,
    withIssues: items.filter((item) => item.issueCount > 0).length,
    emptyActive: items.filter((item) => item.isActive && item.itemCount === 0).length,
    actionable: actionQueue.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    totals,
    byPriorityLabel: countBy(actionQueue, (item) => item.priorityLabel),
    actionQueue,
    items,
  };
}

function menuActionQueueCsv(report: ReturnType<typeof createMenuActionReport>) {
  const headers = [
    "name",
    "location",
    "priority",
    "priorityLabel",
    "nextAction",
    "isActive",
    "itemCount",
    "linkCount",
    "issueCount",
    "issues",
    "updatedAt",
  ];
  const rows = report.actionQueue.map((item) => [
    item.name,
    item.location,
    item.priority,
    item.priorityLabel,
    item.nextAction,
    item.isActive,
    item.itemCount,
    item.linkCount,
    item.issueCount,
    item.issues.join("; "),
    item.updatedAt,
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function createSidebarActionReport(collections: {
  sidebars: CmsSidebar[];
  forms: CmsForm[];
  branding: CmsBranding | null;
  pages: CmsPage[];
  posts: CmsBlogPost[];
  media: CmsMedia[];
}) {
  const items = collections.sidebars
    .map((sidebar) => {
      const saveIssues = getSidebarSaveIssues(sidebar, collections.forms, collections.branding);
      const readinessIssues = getSidebarActivationIssues(
        sidebar,
        collections.forms,
        collections.branding,
        collections.pages,
        collections.posts,
        collections.media,
      );
      const issues = Array.from(new Set([...saveIssues, ...readinessIssues]));

      return {
        id: sidebar.id,
        name: sidebar.name,
        location: sidebar.location,
        isActive: sidebar.isActive,
        widgetCount: sidebar.widgets.length,
        issueCount: issues.length,
        issues,
        updatedAt: sidebar.updatedAt.toISOString(),
      };
    })
    .sort((a, b) => b.issueCount - a.issueCount || a.name.localeCompare(b.name));

  const sidebarPriority = (item: (typeof items)[number]) => {
    if (!item.name.trim() || !item.location.trim()) return { priority: 0, priorityLabel: "details" };
    if (item.issues.some((issue) => issue.includes("unsupported widget type") || issue.includes("Duplicate widget IDs") || issue.includes("needs props") || issue.includes("widget ID"))) {
      return { priority: 1, priorityLabel: "invalid-widgets" };
    }
    if (item.isActive && item.widgetCount === 0) return { priority: 2, priorityLabel: "empty-active" };
    if (item.issues.some((issue) => issue.includes("missing CMS page") || issue.includes("missing blog post"))) {
      return { priority: 3, priorityLabel: "missing-targets" };
    }
    if (item.issues.some((issue) => issue.includes("draft CMS page") || issue.includes("draft blog post"))) {
      return { priority: 4, priorityLabel: "draft-targets" };
    }
    if (item.issues.some((issue) => issue.includes("formSlug") || issue.includes("references form") || issue.includes("inactive form"))) {
      return { priority: 5, priorityLabel: "lead-form" };
    }
    if (item.issues.some((issue) => issue.includes("not registered in Media"))) {
      return { priority: 6, priorityLabel: "media-records" };
    }
    if (item.issues.some((issue) => issue.includes("unsafe") || issue.includes("stripped"))) {
      return { priority: 7, priorityLabel: "unsafe-content" };
    }
    if (item.issueCount > 0) return { priority: 8, priorityLabel: "review" };
    return { priority: 9, priorityLabel: "ready" };
  };
  const sidebarAction = (item: (typeof items)[number]) => {
    if (!item.name.trim() || !item.location.trim()) return "Complete sidebar details.";
    if (item.issues.some((issue) => issue.includes("unsupported widget type"))) return "Replace unsupported widgets.";
    if (item.issues.some((issue) => issue.includes("Duplicate widget IDs"))) return "Fix duplicate widget IDs.";
    if (item.issues.some((issue) => issue.includes("needs props") || issue.includes("widget ID"))) return "Complete widget setup.";
    if (item.isActive && item.widgetCount === 0) return "Add widgets.";
    if (item.issues.some((issue) => issue.includes("missing CMS page") || issue.includes("missing blog post"))) return "Remove or create missing sidebar target.";
    if (item.issues.some((issue) => issue.includes("draft CMS page") || issue.includes("draft blog post"))) return "Publish or replace draft sidebar target.";
    if (item.issues.some((issue) => issue.includes("formSlug") || issue.includes("references form") || issue.includes("inactive form"))) return "Fix lead form widget.";
    if (item.issues.some((issue) => issue.includes("not registered in Media"))) return "Import missing media records.";
    if (item.issues.some((issue) => issue.includes("unsafe") || issue.includes("stripped"))) return "Replace unsafe widget content.";
    if (item.issueCount > 0) return "Review widget readiness.";
    return "Sidebar ready.";
  };
  const actionQueue = items
    .map((item) => ({
      ...item,
      ...sidebarPriority(item),
      nextAction: sidebarAction(item),
    }))
    .filter((item) => item.priority < 9)
    .sort((a, b) => a.priority - b.priority || b.issueCount - a.issueCount || a.name.localeCompare(b.name))
    .slice(0, 50);
  const totals = {
    sidebars: items.length,
    active: items.filter((item) => item.isActive).length,
    inactive: items.filter((item) => !item.isActive).length,
    withIssues: items.filter((item) => item.issueCount > 0).length,
    emptyActive: items.filter((item) => item.isActive && item.widgetCount === 0).length,
    actionable: actionQueue.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    totals,
    byPriorityLabel: countBy(actionQueue, (item) => item.priorityLabel),
    actionQueue,
    items,
  };
}

function sidebarActionQueueCsv(report: ReturnType<typeof createSidebarActionReport>) {
  const headers = [
    "name",
    "location",
    "priority",
    "priorityLabel",
    "nextAction",
    "isActive",
    "widgetCount",
    "issueCount",
    "issues",
    "updatedAt",
  ];
  const rows = report.actionQueue.map((item) => [
    item.name,
    item.location,
    item.priority,
    item.priorityLabel,
    item.nextAction,
    item.isActive,
    item.widgetCount,
    item.issueCount,
    item.issues.join("; "),
    item.updatedAt,
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function createDesignActionReport(collections: {
  branding: CmsBranding[];
  colorPalettes: CmsColorPalette[];
  typography: CmsTypography[];
  media: CmsMedia[];
}) {
  const activePaletteCount = collections.colorPalettes.filter((palette) => palette.isActive).length;
  const activeTypographyCount = collections.typography.filter((style) => style.isActive).length;
  const designItems: Array<{
    id: string;
    collection: "branding" | "colorPalettes" | "typography";
    name: string;
    isActive: boolean | null;
    issueCount: number;
    issues: string[];
    updatedAt: string;
    priority: number;
    priorityLabel: string;
    nextAction: string;
  }> = [
    ...collections.branding.map((record) => {
      const issues = getBrandingSaveIssues(record, collections.media);
      return {
        id: record.id,
        collection: "branding" as const,
        name: record.siteName || "Glass & Door Pro Branding",
        isActive: null,
        issueCount: issues.length,
        issues,
        updatedAt: record.updatedAt.toISOString(),
        priority: 1,
        priorityLabel: "branding-details",
        nextAction: issues.some((issue) => issue.includes("Logo") || issue.includes("Favicon"))
          ? "Fix brand asset URLs."
          : issues.some((issue) => issue.includes("Social link"))
            ? "Fix social links."
            : "Review brand profile.",
      };
    }),
    ...getBrandingCollectionIssues(collections.branding).map((issue) => ({
      id: "branding-singleton",
      collection: "branding" as const,
      name: "Glass & Door Pro Branding",
      isActive: null,
      issueCount: 1,
      issues: [issue],
      updatedAt: new Date(0).toISOString(),
      priority: 0,
      priorityLabel: "brand-profile",
      nextAction: collections.branding.length === 0 ? "Create the Glass & Door Pro brand profile." : "Keep exactly one brand profile.",
    })),
    ...collections.colorPalettes.map((palette) => {
      const issues = getColorPaletteTokenIssues(palette);
      return {
        id: palette.id,
        collection: "colorPalettes" as const,
        name: palette.name || "Color Palette",
        isActive: palette.isActive,
        issueCount: issues.length,
        issues,
        updatedAt: palette.updatedAt.toISOString(),
        priority: 2,
        priorityLabel: "palette-tokens",
        nextAction: issues.some((issue) => issue.includes("name")) ? "Name the color palette." : "Fix palette HSL tokens.",
      };
    }),
    ...(activePaletteCount === 1
      ? []
      : [{
          id: "active-palette-required",
          collection: "colorPalettes" as const,
          name: "Active Color Palette",
          isActive: null,
          issueCount: 1,
          issues: [`Exactly one active color palette is required; found ${activePaletteCount}.`],
          updatedAt: new Date(0).toISOString(),
          priority: 3,
          priorityLabel: "active-palette",
          nextAction: activePaletteCount === 0 ? "Activate one approved palette." : "Deactivate extra active palettes.",
        }]),
    ...collections.typography.map((style) => {
      const issues = getTypographySaveIssues(style);
      return {
        id: style.id,
        collection: "typography" as const,
        name: style.name || "Typography",
        isActive: style.isActive,
        issueCount: issues.length,
        issues,
        updatedAt: style.updatedAt.toISOString(),
        priority: 4,
        priorityLabel: "typography-scale",
        nextAction: issues.some((issue) => issue.includes("font")) ? "Fix typography font names." : "Fix typography scale tokens.",
      };
    }),
    ...(activeTypographyCount === 1
      ? []
      : [{
          id: "active-typography-required",
          collection: "typography" as const,
          name: "Active Typography",
          isActive: null,
          issueCount: 1,
          issues: [`Exactly one active typography record is required; found ${activeTypographyCount}.`],
          updatedAt: new Date(0).toISOString(),
          priority: 5,
          priorityLabel: "active-typography",
          nextAction: activeTypographyCount === 0 ? "Activate one approved typography set." : "Deactivate extra active typography sets.",
        }]),
  ];

  const actionQueue = designItems
    .filter((item) => item.issueCount > 0)
    .sort((a, b) => a.priority - b.priority || b.issueCount - a.issueCount || a.name.localeCompare(b.name))
    .slice(0, 50);

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    totals: {
      branding: collections.branding.length,
      colorPalettes: collections.colorPalettes.length,
      typography: collections.typography.length,
      activePalettes: activePaletteCount,
      activeTypography: activeTypographyCount,
      withIssues: actionQueue.length,
      actionable: actionQueue.length,
    },
    byPriorityLabel: countBy(actionQueue, (item) => item.priorityLabel),
    actionQueue,
    items: designItems,
  };
}

function designActionQueueCsv(report: ReturnType<typeof createDesignActionReport>) {
  const headers = [
    "collection",
    "name",
    "priority",
    "priorityLabel",
    "nextAction",
    "isActive",
    "issueCount",
    "issues",
    "updatedAt",
  ];
  const rows = report.actionQueue.map((item) => [
    item.collection,
    item.name,
    item.priority,
    item.priorityLabel,
    item.nextAction,
    item.isActive ?? "",
    item.issueCount,
    item.issues.join("; "),
    item.updatedAt,
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function createSystemActionReport(collections: {
  settings: CmsSetting[];
  documentation: CmsDocumentation[];
  systemBackups: CmsSystemBackup[];
  systemUsers: CmsSystemUser[];
}) {
  const activeOwnerCount = collections.systemUsers.filter((user) => user.status === "active" && user.role === "owner").length;
  const siteSetting = collections.settings.find((setting) => setting.key === "site");
  const systemItems: Array<{
    id: string;
    collection: "settings" | "documentation" | "systemBackups" | "systemUsers" | "security";
    name: string;
    status: string;
    issueCount: number;
    issues: string[];
    updatedAt: string;
    priority: number;
    priorityLabel: string;
    nextAction: string;
  }> = [
    ...(!process.env.ADMIN_PASSWORD
      ? [{
          id: "admin-password",
          collection: "security" as const,
          name: "Admin Password",
          status: "missing",
          issueCount: 1,
          issues: ["ADMIN_PASSWORD is not configured."],
          updatedAt: new Date(0).toISOString(),
          priority: 0,
          priorityLabel: "admin-password",
          nextAction: "Set ADMIN_PASSWORD in Railway variables.",
        }]
      : []),
    ...(!process.env.ADMIN_SESSION_SECRET
      ? [{
          id: "admin-session-secret",
          collection: "security" as const,
          name: "Admin Session Secret",
          status: "missing",
          issueCount: 1,
          issues: ["ADMIN_SESSION_SECRET is not configured."],
          updatedAt: new Date(0).toISOString(),
          priority: 1,
          priorityLabel: "session-secret",
          nextAction: "Set ADMIN_SESSION_SECRET in Railway variables.",
        }]
      : []),
    ...(activeOwnerCount > 0
      ? []
      : [{
          id: "active-owner-required",
          collection: "systemUsers" as const,
          name: "Active Owner",
          status: "missing",
          issueCount: 1,
          issues: ["At least one active owner system user is required."],
          updatedAt: new Date(0).toISOString(),
          priority: 2,
          priorityLabel: "active-owner",
          nextAction: "Create or activate an owner user.",
        }]),
    ...(!siteSetting
      ? [{
          id: "site-setting-required",
          collection: "settings" as const,
          name: "Site Setting",
          status: "missing",
          issueCount: 1,
          issues: ["Site setting record is required for public identity and CRM stages."],
          updatedAt: new Date(0).toISOString(),
          priority: 3,
          priorityLabel: "site-setting",
          nextAction: "Create the site setting record.",
        }]
      : []),
    ...collections.settings.map((setting) => {
      const issues = getSettingSaveIssues(setting);
      return {
        id: setting.id,
        collection: "settings" as const,
        name: setting.key,
        status: setting.isPublic ? "public" : "private",
        issueCount: issues.length,
        issues,
        updatedAt: setting.updatedAt.toISOString(),
        priority: setting.key === "site" ? 4 : 8,
        priorityLabel: setting.key === "site" ? "site-setting" : "setting-value",
        nextAction: setting.key === "site" ? "Fix public identity or lead pipeline settings." : "Review setting value.",
      };
    }),
    ...collections.systemUsers.map((user) => {
      const issues = getSystemUserSaveIssues(user);
      return {
        id: user.id,
        collection: "systemUsers" as const,
        name: user.name || user.email || "System User",
        status: user.status,
        issueCount: issues.length,
        issues,
        updatedAt: user.updatedAt.toISOString(),
        priority: user.role === "owner" ? 5 : 9,
        priorityLabel: "user-details",
        nextAction: issues.some((issue) => issue.includes("email")) ? "Fix user email." : "Complete user access details.",
      };
    }),
    ...collections.systemBackups.map((backup) => {
      const issues = [
        ...getSystemBackupSaveIssues(backup),
        ...(backup.status === "failed" ? ["Backup failed and needs review."] : []),
        ...(backup.status === "pending" ? ["Backup is still pending."] : []),
      ];
      return {
        id: backup.id,
        collection: "systemBackups" as const,
        name: backup.name || "System Backup",
        status: backup.status,
        issueCount: issues.length,
        issues,
        updatedAt: backup.updatedAt.toISOString(),
        priority: backup.status === "failed" ? 6 : backup.status === "pending" ? 7 : 10,
        priorityLabel: backup.status === "failed" ? "backup-failed" : backup.status === "pending" ? "backup-pending" : "backup-details",
        nextAction: backup.status === "failed" ? "Review failed backup." : backup.status === "pending" ? "Complete or retry backup." : "Review backup manifest.",
      };
    }),
    ...collections.documentation.map((doc) => {
      const issues = [
        ...getDocumentationSaveIssues(doc),
        ...(!doc.body?.trim() ? ["Documentation body is empty."] : []),
      ];
      return {
        id: doc.id,
        collection: "documentation" as const,
        name: doc.title || doc.slug || "Documentation",
        status: doc.category || "uncategorized",
        issueCount: issues.length,
        issues,
        updatedAt: doc.updatedAt.toISOString(),
        priority: 11,
        priorityLabel: "documentation",
        nextAction: !doc.body?.trim() ? "Add documentation body." : "Complete documentation metadata.",
      };
    }),
  ];
  const actionQueue = systemItems
    .filter((item) => item.issueCount > 0)
    .sort((a, b) => a.priority - b.priority || b.issueCount - a.issueCount || a.name.localeCompare(b.name))
    .slice(0, 50);

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    totals: {
      settings: collections.settings.length,
      documentation: collections.documentation.length,
      backups: collections.systemBackups.length,
      users: collections.systemUsers.length,
      activeOwners: activeOwnerCount,
      securityIssues: (process.env.ADMIN_PASSWORD ? 0 : 1) + (process.env.ADMIN_SESSION_SECRET ? 0 : 1),
      actionable: actionQueue.length,
    },
    byPriorityLabel: countBy(actionQueue, (item) => item.priorityLabel),
    actionQueue,
    items: systemItems,
  };
}

function systemActionQueueCsv(report: ReturnType<typeof createSystemActionReport>) {
  const headers = [
    "collection",
    "name",
    "status",
    "priority",
    "priorityLabel",
    "nextAction",
    "issueCount",
    "issues",
    "updatedAt",
  ];
  const rows = report.actionQueue.map((item) => [
    item.collection,
    item.name,
    item.status,
    item.priority,
    item.priorityLabel,
    item.nextAction,
    item.issueCount,
    item.issues.join("; "),
    item.updatedAt,
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function seoNeedsReadinessReview(seo: { metaTitle?: string; metaDescription?: string; canonicalUrl?: string } | undefined | null) {
  return !seo?.metaTitle?.trim() || !seo?.metaDescription?.trim() || !seo?.canonicalUrl?.trim() || Boolean(seoCanonicalIssue(seo?.canonicalUrl ?? ""));
}

function seoReadinessIssues(seo: { metaTitle?: string; metaDescription?: string; canonicalUrl?: string } | undefined | null) {
  return [
    !seo?.metaTitle?.trim() ? "SEO title is missing." : "",
    !seo?.metaDescription?.trim() ? "SEO description is missing." : "",
    !seo?.canonicalUrl?.trim() ? "Canonical URL is missing." : "",
    seoCanonicalIssue(seo?.canonicalUrl ?? "") ? "Canonical URL must be a valid http or https URL." : "",
  ].filter(Boolean);
}

function createSeoPressureReport(
  pages: CmsPage[],
  posts: CmsBlogPost[],
  sections: CmsSection[],
  options: { includeCmsRoutes?: boolean } = {},
) {
  const includeCmsRoutes = options.includeCmsRoutes ?? true;
  const records = [
    ...pages.map((page) => {
      const issues = [];
      if (page.status === "published" && !page.seo.noIndex && !pageHasIndexableRouteContent(page)) issues.push("noRouteContent");
      if (page.status === "published" && !page.seo.metaTitle?.trim()) issues.push("missingTitle");
      if (page.status === "published" && !page.seo.metaDescription?.trim()) issues.push("missingDescription");
      if (page.status === "published" && !page.seo.canonicalUrl?.trim()) issues.push("missingCanonical");
      if (page.status === "published" && page.seo.noIndex) issues.push("noIndex");
      if (page.status === "published" && (page.seo.metaTitle?.trim().length ?? 0) > 70) issues.push("longTitle");
      if (page.status === "published" && (page.seo.metaDescription?.trim().length ?? 0) > 160) issues.push("longDescription");
      const canonicalIssue = page.status === "published" ? seoCanonicalIssue(page.seo.canonicalUrl ?? "") : "";
      if (canonicalIssue) issues.push(canonicalIssue);
      if (page.status !== "published" && page.status !== "archived" && !page.seo.metaTitle?.trim()) issues.push("draftMissingTitle");
      if (page.status !== "published" && page.status !== "archived" && !page.seo.metaDescription?.trim()) issues.push("draftMissingDescription");
      if (page.status !== "published" && page.status !== "archived" && !page.seo.canonicalUrl?.trim()) issues.push("draftMissingCanonical");
      const priority = issues.length ? Math.min(...issues.map(seoIssuePriority)) : 3;
      return {
        id: page.id,
        type: "page",
        title: page.title,
        slug: page.slug,
        path: cmsPageUrl(page.slug),
        status: page.status,
        inSitemap: pageIsPublicSitemapCandidate(page, { includeCmsRoutes }),
        structuredData: seoStructuredDataTypes(page, "page", sections),
        issueCount: issues.length,
        priority,
        priorityLabel: seoPriorityLabel(priority),
        nextAction: seoNextAction(issues),
        issues,
      };
    }),
    ...posts.map((post) => {
      const issues = [];
      if (post.status === "published" && !post.seo.noIndex && !postIsPublicSitemapCandidate(post)) issues.push("noRouteContent");
      if (post.status === "published" && !post.seo.metaTitle?.trim()) issues.push("missingTitle");
      if (post.status === "published" && !post.seo.metaDescription?.trim()) issues.push("missingDescription");
      if (post.status === "published" && !post.seo.canonicalUrl?.trim()) issues.push("missingCanonical");
      if (post.status === "published" && post.seo.noIndex) issues.push("noIndex");
      if (post.status === "published" && (post.seo.metaTitle?.trim().length ?? 0) > 70) issues.push("longTitle");
      if (post.status === "published" && (post.seo.metaDescription?.trim().length ?? 0) > 160) issues.push("longDescription");
      const canonicalIssue = post.status === "published" ? seoCanonicalIssue(post.seo.canonicalUrl ?? "") : "";
      if (canonicalIssue) issues.push(canonicalIssue);
      if (post.status !== "published" && post.status !== "archived" && !post.seo.metaTitle?.trim()) issues.push("draftMissingTitle");
      if (post.status !== "published" && post.status !== "archived" && !post.seo.metaDescription?.trim()) issues.push("draftMissingDescription");
      if (post.status !== "published" && post.status !== "archived" && !post.seo.canonicalUrl?.trim()) issues.push("draftMissingCanonical");
      const priority = issues.length ? Math.min(...issues.map(seoIssuePriority)) : 3;
      return {
        id: post.id,
        type: "blogPost",
        title: post.title,
        slug: post.slug,
        path: `/blog/${encodeURIComponent(post.slug)}`,
        status: post.status,
        inSitemap: postIsPublicSitemapCandidate(post, { includeCmsRoutes }),
        structuredData: seoStructuredDataTypes(post, "blogPost"),
        issueCount: issues.length,
        priority,
        priorityLabel: seoPriorityLabel(priority),
        nextAction: seoNextAction(issues),
        issues,
      };
    }),
    ...getPublishedBlogArchiveEntries(posts, { includeCmsRoutes }).map((archive) => {
      const parsedArchive = parseBlogArchiveHref(archive.loc);
      const label = parsedArchive?.value ?? archive.loc;
      return {
        id: `blogArchive:${archive.loc}`,
        type: "blogArchive",
        title: `${parsedArchive?.kind === "tag" ? "Tagged" : "Category"}: ${label}`,
        slug: label,
        path: archive.loc,
        status: "published",
        inSitemap: true,
        structuredData: ["WebPage"],
        issueCount: 0,
        priority: 3,
        priorityLabel: "ready",
        nextAction: "Blog archive SEO is ready.",
        issues: [],
      };
    }),
  ].sort(
    (a, b) =>
      a.priority - b.priority ||
      b.issueCount - a.issueCount ||
      a.title.localeCompare(b.title),
  );
  const publishedRecords = records.filter((record) => record.status === "published");
  const indexableRecords = publishedRecords.filter((record) => record.inSitemap && !record.issues.includes("noIndex"));

  return {
    totals: {
      records: records.length,
      published: publishedRecords.length,
      indexable: indexableRecords.length,
      blockers: records.filter((record) => record.priorityLabel === "blocker").length,
      warnings: records.filter((record) => record.priorityLabel === "warning").length,
      draftIssues: records.filter((record) => record.priorityLabel === "draft").length,
      ready: records.filter((record) => record.priorityLabel === "ready").length,
      issueCount: records.reduce((total, record) => total + record.issueCount, 0),
      structuredDataRecords: indexableRecords.reduce((total, record) => total + record.structuredData.length, 0),
      priorityCounts: countBy(records, (record) => record.priorityLabel),
    },
    records: records.filter((record) => record.issueCount > 0).slice(0, 12),
  };
}

type AdminActionPlanItem = {
  id: string;
  category: "Launch" | "Content" | "CRM" | "Design" | "System";
  source: string;
  toolKey: string;
  recordId: string | null;
  leadId: string | null;
  title: string;
  detail: string;
  path: string;
  priority: number;
  priorityLabel: string;
  nextAction: string;
  issueCount: number;
  issues: string[];
};

function createAdminActionPlan({
  publicCmsLaunchBlockers,
  visualParitySettingId,
  migration,
  seoPressure,
  crmHealthReport,
  formSubmissionReport,
  mediaAudit,
  sectionActions,
  menuActions,
  sidebarActions,
  designActions,
  systemActions,
}: {
  publicCmsLaunchBlockers: Array<{
    slug: string;
    path: string;
    status: string;
    nextAction: string;
    issueCount: number;
    issues: string[];
  }>;
  visualParitySettingId?: string | null;
  migration: ReturnType<typeof createMigrationCoverageReport>;
  seoPressure: ReturnType<typeof createSeoPressureReport>;
  crmHealthReport: ReturnType<typeof createCrmHealthReport>;
  formSubmissionReport: ReturnType<typeof createFormSubmissionReport>;
  mediaAudit: ReturnType<typeof createMediaAuditReport>;
  sectionActions: ReturnType<typeof createSectionActionReport>;
  menuActions: ReturnType<typeof createMenuActionReport>;
  sidebarActions: ReturnType<typeof createSidebarActionReport>;
  designActions: ReturnType<typeof createDesignActionReport>;
  systemActions: ReturnType<typeof createSystemActionReport>;
}) {
  const crmPriority = (urgency: string) =>
    urgency === "critical" ? 4 : urgency === "high" ? 12 : urgency === "medium" ? 28 : 45;
  const specialDesignActions = new Set(["branding-singleton", "active-palette-required", "active-typography-required"]);
  const specialSystemActions = new Set(["admin-password", "admin-session-secret", "active-owner-required", "site-setting-required"]);
  const safeIssues = (issues: string[], fallback: string) => (issues.length > 0 ? issues : [fallback]);
  const items: AdminActionPlanItem[] = [
    ...publicCmsLaunchBlockers.slice(0, 5).map((blocker) => ({
      id: `launch-${blocker.slug}`,
      category: "Launch" as const,
      source: "Public frontend",
      toolKey: blocker.slug === "visual-parity" ? "settings" : "pages",
      recordId: blocker.slug === "visual-parity" ? visualParitySettingId ?? null : null,
      leadId: null,
      title: blocker.slug === "visual-parity" ? "Approve CMS visual parity" : `Review ${blocker.path}`,
      detail: `${blocker.status} route launch blocker`,
      path: blocker.path,
      priority: 0,
      priorityLabel: "launch-blocker",
      nextAction: blocker.nextAction,
      issueCount: blocker.issueCount,
      issues: safeIssues(blocker.issues, blocker.nextAction),
    })),
    ...systemActions.actionQueue.slice(0, 6).map((action) => ({
      id: `system-${action.collection}-${action.id}`,
      category: "System" as const,
      source: action.collection === "security" ? "Security" : "System",
      toolKey: action.collection === "security" ? "systemUsers" : action.collection,
      recordId: specialSystemActions.has(action.id) || action.collection === "security" ? null : action.id,
      leadId: null,
      title: action.name,
      detail: `${action.collection} · ${action.status}`,
      path: action.collection,
      priority: 6 + action.priority,
      priorityLabel: action.priorityLabel,
      nextAction: action.nextAction,
      issueCount: action.issueCount,
      issues: safeIssues(action.issues, action.nextAction),
    })),
    ...crmHealthReport.actionQueue.slice(0, 8).map((lead) => ({
      id: `crm-${lead.id}`,
      category: "CRM" as const,
      source: "Lead pipeline",
      toolKey: "crmPipeline",
      recordId: null,
      leadId: lead.id,
      title: lead.name || lead.email || lead.phone || "Website lead",
      detail: `${lead.pipelineStage} · ${lead.email || lead.phone || lead.service || "No contact detail"}`,
      path: lead.sourceDetails.page || lead.sourceDetails.landingPage || "",
      priority: crmPriority(lead.urgency),
      priorityLabel: lead.urgency,
      nextAction: lead.action,
      issueCount: 1,
      issues: [lead.detail],
    })),
    ...formSubmissionReport.actionQueue.slice(0, 6).map((submission) => ({
      id: `form-submission-${submission.id}`,
      category: "CRM" as const,
      source: "Form submissions",
      toolKey: "forms",
      recordId: submission.formId,
      leadId: submission.leadId,
      title: submission.name || "Website form submission",
      detail: `${submission.formName} · ${submission.email || submission.phone || "No contact detail"}`,
      path: submission.sourceUrl || submission.landingPage || "",
      priority: 16 + submission.priority,
      priorityLabel: submission.priorityLabel,
      nextAction: submission.nextAction,
      issueCount: 1,
      issues: [submission.issue],
    })),
    ...migration.actionQueue.slice(0, 8).map((route) => ({
      id: `route-${route.slug}-${route.path}`,
      category: "Content" as const,
      source: "Page migration",
      toolKey: "pages",
      recordId: route.pageId,
      leadId: null,
      title: route.title || route.slug || route.path,
      detail: `${route.routeType} route · ${route.status}`,
      path: route.path,
      priority: 20 + route.priority,
      priorityLabel: route.priorityLabel,
      nextAction: route.nextAction,
      issueCount: route.issueCount,
      issues: safeIssues(route.issues, route.nextAction),
    })),
    ...seoPressure.records.slice(0, 8).map((record) => ({
      id: `seo-${record.type}-${record.id}`,
      category: "Content" as const,
      source: "SEO",
      toolKey: record.type === "blogPost" ? "blogPosts" : "pages",
      recordId: record.id,
      leadId: null,
      title: record.title || record.slug,
      detail: `${record.type === "blogPost" ? "Blog post" : "Page"} · ${record.status}`,
      path: record.path,
      priority: 30 + record.priority,
      priorityLabel: record.priorityLabel,
      nextAction: record.nextAction,
      issueCount: record.issueCount,
      issues: safeIssues(record.issues, record.nextAction),
    })),
    ...sectionActions.actionQueue.slice(0, 6).map((section) => ({
      id: `section-${section.id}`,
      category: "Content" as const,
      source: "Sections",
      toolKey: "sections",
      recordId: section.id,
      leadId: null,
      title: section.name || section.handle,
      detail: `${section.category || "uncategorized"} · ${section.usageCount} references`,
      path: section.handle,
      priority: 38 + section.priority,
      priorityLabel: section.priorityLabel,
      nextAction: section.nextAction,
      issueCount: section.issueCount,
      issues: safeIssues(section.issues, section.nextAction),
    })),
    ...mediaAudit.actionQueue.slice(0, 6).map((media) => ({
      id: `media-${media.id}`,
      category: "Content" as const,
      source: "Media",
      toolKey: "media",
      recordId: media.id,
      leadId: null,
      title: media.name || media.url,
      detail: `${media.kind} · ${media.usageCount} references`,
      path: media.url,
      priority: 42 + media.priority,
      priorityLabel: media.priorityLabel,
      nextAction: media.nextAction,
      issueCount: media.issueCount,
      issues: safeIssues(media.issues, media.nextAction),
    })),
    ...menuActions.actionQueue.slice(0, 6).map((menu) => ({
      id: `menu-${menu.id}`,
      category: "Design" as const,
      source: "Menus",
      toolKey: "menus",
      recordId: menu.id,
      leadId: null,
      title: menu.name || menu.location,
      detail: `${menu.location || "unassigned"} · ${menu.linkCount} links`,
      path: menu.location,
      priority: 46 + menu.priority,
      priorityLabel: menu.priorityLabel,
      nextAction: menu.nextAction,
      issueCount: menu.issueCount,
      issues: safeIssues(menu.issues, menu.nextAction),
    })),
    ...sidebarActions.actionQueue.slice(0, 6).map((sidebar) => ({
      id: `sidebar-${sidebar.id}`,
      category: "Design" as const,
      source: "Sidebars",
      toolKey: "sidebars",
      recordId: sidebar.id,
      leadId: null,
      title: sidebar.name || sidebar.location,
      detail: `${sidebar.location || "unassigned"} · ${sidebar.widgetCount} widgets`,
      path: sidebar.location,
      priority: 48 + sidebar.priority,
      priorityLabel: sidebar.priorityLabel,
      nextAction: sidebar.nextAction,
      issueCount: sidebar.issueCount,
      issues: safeIssues(sidebar.issues, sidebar.nextAction),
    })),
    ...designActions.actionQueue.slice(0, 6).map((action) => ({
      id: `design-${action.collection}-${action.id}`,
      category: "Design" as const,
      source: "Brand system",
      toolKey: action.collection,
      recordId: specialDesignActions.has(action.id) ? null : action.id,
      leadId: null,
      title: action.name,
      detail: action.isActive === null ? action.collection : `${action.collection} · ${action.isActive ? "active" : "inactive"}`,
      path: action.collection,
      priority: 52 + action.priority,
      priorityLabel: action.priorityLabel,
      nextAction: action.nextAction,
      issueCount: action.issueCount,
      issues: safeIssues(action.issues, action.nextAction),
    })),
  ];

  return items
    .filter((item) => item.issueCount > 0)
    .sort((a, b) => a.priority - b.priority || b.issueCount - a.issueCount || a.category.localeCompare(b.category) || a.title.localeCompare(b.title))
    .slice(0, 12);
}

function adminActionPlanCsv(actionPlan: AdminActionPlanItem[]) {
  const headers = [
    "category",
    "source",
    "title",
    "priority",
    "priorityLabel",
    "nextAction",
    "issueCount",
    "path",
    "toolKey",
    "recordId",
    "leadId",
    "issues",
  ];
  const rows = actionPlan.map((item) => [
    item.category,
    item.source,
    item.title,
    item.priority,
    item.priorityLabel,
    item.nextAction,
    item.issueCount,
    item.path,
    item.toolKey,
    item.recordId ?? "",
    item.leadId ?? "",
    item.issues.join("; "),
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function createAdminActionPlanReport(actionPlan: AdminActionPlanItem[]) {
  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    totals: {
      items: actionPlan.length,
      launch: actionPlan.filter((item) => item.category === "Launch").length,
      content: actionPlan.filter((item) => item.category === "Content").length,
      crm: actionPlan.filter((item) => item.category === "CRM").length,
      design: actionPlan.filter((item) => item.category === "Design").length,
      system: actionPlan.filter((item) => item.category === "System").length,
      blocking: actionPlan.filter((item) => item.priority <= 20).length,
    },
    byCategory: countBy(actionPlan, (item) => item.category),
    bySource: countBy(actionPlan, (item) => item.source),
    byPriorityLabel: countBy(actionPlan, (item) => item.priorityLabel),
    items: actionPlan,
  };
}

function createAdminBuildProgressReport(snapshot: Awaited<ReturnType<typeof createSystemSnapshot>>) {
  const publicGuard = snapshot.publicFrontendGuard;
  const primaryRouteTotal = publicGuard.totals.primaryRoutes;
  const visualParityRequiredRoutes = snapshot.publicFrontend.visualParityRequiredRoutes || primaryRouteTotal;
  const readinessSignalCount = Object.values(snapshot.readiness).reduce((total, value) => total + value, 0);
  const crmOpenWork =
    snapshot.crm.actionQueue.length +
    snapshot.crm.duplicateContacts +
    snapshot.readiness.convertibleSubmissions +
    snapshot.readiness.formsWithLeadIssues +
    snapshot.readiness.crmLeadsWithIssues;
  const actionPlanClearPercent = snapshot.actionPlan.length === 0
    ? 100
    : Math.max(10, 100 - Math.min(90, snapshot.actionPlan.length * 8));
  const crmReadinessPercent = crmOpenWork === 0 ? 100 : Math.max(10, 100 - Math.min(90, crmOpenWork * 8));
  const launchClearanceChecks = [
    {
      id: "fresh-backup",
      label: "Fresh System Backup",
      complete: snapshot.totals.backups > 0,
      nextAction: "Create a System Backup before CMS takeover.",
      link: "systemBackups",
    },
    {
      id: "route-readiness",
      label: "Primary Route Readiness",
      complete: publicGuard.totals.cmsReadyRoutes === primaryRouteTotal,
      nextAction: "Run Launch CMS Routes and clear Route Actions CSV/JSON blockers.",
      link: "/api/admin/system/migration-actions",
    },
    {
      id: "visual-parity",
      label: "Visual Parity Approval",
      complete: publicGuard.totals.visualParityApprovedRoutes === visualParityRequiredRoutes,
      nextAction: "Compare Original Site and CMS Preview URLs, then approve every primary route.",
      link: "/api/admin/system/visual-parity",
    },
    {
      id: "crm-forms",
      label: "CRM and Form Readiness",
      complete: crmOpenWork === 0,
      nextAction: "Clear CRM action queue, duplicate contacts, submission conversion, and form-readiness work.",
      link: "crmReports",
    },
    {
      id: "takeover-blockers",
      label: "Takeover Blockers",
      complete: publicGuard.totals.launchBlockers === 0,
      nextAction: "Clear public CMS launch blockers before enabling publicCmsEnabled.",
      link: "/api/admin/system/public-frontend",
    },
  ];
  const launchClearanceComplete = launchClearanceChecks.filter((check) => check.complete).length;
  const launchClearanceNextAction =
    launchClearanceChecks.find((check) => !check.complete)?.nextAction ??
    "Enable publicCmsEnabled only when the final launch decision is ready.";
  const launchClearanceStatus = launchClearanceComplete === launchClearanceChecks.length
    ? "ready"
    : publicGuard.totals.launchBlockers > 0
      ? "blocked"
      : "in-progress";
  const publicStorefrontGuardStatus = snapshot.publicFrontend.cmsTakeoverEnabled
    ? "cms-live"
    : snapshot.publicFrontend.launchReady
      ? "launch-ready"
      : "original-protected";
  const publicStorefrontGuardSummary = snapshot.publicFrontend.cmsTakeoverEnabled
    ? "Public URLs are using the CMS takeover path."
    : snapshot.publicFrontend.launchReady
      ? "Public URLs remain protected, and launch gates are ready for the final CMS takeover decision."
      : "Public URLs stay on the original Glass & Door Pro frontend while CMS preview routes are reviewed.";
  const publicStorefrontGuardNextAction =
    publicGuard.totals.launchBlockers > 0
      ? "Clear launch blockers before enabling public CMS takeover."
      : snapshot.publicFrontend.launchReady
        ? "Confirm final launch timing, create/verify a fresh backup, then enable publicCmsEnabled."
        : "Keep the original frontend protected until visual parity approval is complete.";
  const categories = [
    {
      id: "public-storefront-guard",
      label: "Public Storefront Guard",
      status: publicStorefrontGuardStatus,
      complete: primaryRouteTotal,
      total: primaryRouteTotal,
      percent: 100,
      summary: publicStorefrontGuardSummary,
      nextAction: publicStorefrontGuardNextAction,
    },
    {
      id: "launch-clearance",
      label: "Launch Clearance",
      status: launchClearanceStatus,
      complete: launchClearanceComplete,
      total: launchClearanceChecks.length,
      percent: completionPercent(launchClearanceComplete, launchClearanceChecks.length),
      summary: `${launchClearanceComplete} of ${launchClearanceChecks.length} launch clearance checks are complete.`,
      nextAction: launchClearanceNextAction,
    },
    {
      id: "primary-cms-route-migration",
      label: "Primary CMS Route Migration",
      status: publicGuard.totals.cmsReadyRoutes === primaryRouteTotal ? "ready" : "in-progress",
      complete: publicGuard.totals.cmsReadyRoutes,
      total: primaryRouteTotal,
      percent: completionPercent(publicGuard.totals.cmsReadyRoutes, primaryRouteTotal),
      summary: `${publicGuard.totals.cmsReadyRoutes} of ${primaryRouteTotal} primary routes are CMS-ready.`,
      nextAction:
        publicGuard.launchBlockers[0]?.nextAction ??
        snapshot.migrationActionQueue[0]?.nextAction ??
        "Review primary routes for content, SEO, and media parity.",
    },
    {
      id: "visual-parity-review",
      label: "Visual Parity Review",
      status: publicGuard.totals.visualParityApprovedRoutes === visualParityRequiredRoutes ? "approved" : "review-needed",
      complete: publicGuard.totals.visualParityApprovedRoutes,
      total: visualParityRequiredRoutes,
      percent: completionPercent(publicGuard.totals.visualParityApprovedRoutes, visualParityRequiredRoutes),
      summary: `${publicGuard.totals.visualParityReviewedRoutes} reviewed, ${publicGuard.totals.visualParityNeedsChangesRoutes} marked for changes.`,
      nextAction:
        publicGuard.totals.visualParityNeedsChangesRoutes > 0
          ? "Resolve routes marked for changes, then approve their visual parity reviews."
          : "Approve every primary route after comparing original and CMS preview URLs.",
    },
    {
      id: "admin-build-queue",
      label: "Admin Build Queue",
      status: snapshot.actionPlan.length === 0 ? "clear" : "queued",
      complete: Math.max(0, 100 - snapshot.actionPlan.length),
      total: 100,
      percent: actionPlanClearPercent,
      summary: `${snapshot.actionPlan.length} action item${snapshot.actionPlan.length === 1 ? "" : "s"} queued with ${readinessSignalCount} readiness signal${readinessSignalCount === 1 ? "" : "s"}.`,
      nextAction: snapshot.actionPlan[0]?.nextAction ?? "Continue routine CMS, CRM, design, and system verification.",
    },
    {
      id: "crm-and-forms",
      label: "CRM and Forms",
      status: crmOpenWork === 0 ? "clear" : "open-work",
      complete: Math.max(0, 100 - crmOpenWork),
      total: 100,
      percent: crmReadinessPercent,
      summary: `${crmOpenWork} CRM/form cleanup signal${crmOpenWork === 1 ? "" : "s"} remain.`,
      nextAction: snapshot.crm.actionQueue[0]?.action ?? "Keep lead capture, duplicate review, and follow-up queues clean.",
    },
    {
      id: "admin-scope",
      label: "Admin Scope",
      status: snapshot.scope.status,
      complete: 1,
      total: 1,
      percent: 100,
      summary: `${snapshot.scope.sections.join(", ")} only; excludes ${snapshot.scope.excludedModuleFamilies.join(", ")}.`,
      nextAction: `Keep work inside ${snapshot.scope.collections.length} CMS/System collections and inbound lead CRM.`,
    },
  ];
  const nextMilestone =
    snapshot.actionPlan[0] ??
    publicGuard.launchBlockers[0] ??
    snapshot.migrationActionQueue[0] ??
    null;

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    overallPercent: Math.round(categories.reduce((total, item) => total + item.percent, 0) / categories.length),
    publicFrontend: snapshot.publicFrontend,
    publicFrontendGuard: publicGuard,
    launchClearance: {
      status: launchClearanceStatus,
      complete: launchClearanceComplete,
      total: launchClearanceChecks.length,
      percent: completionPercent(launchClearanceComplete, launchClearanceChecks.length),
      nextAction: launchClearanceNextAction,
      links: {
        backups: "systemBackups",
        visualParityJson: "/api/admin/system/visual-parity",
        visualParityCsv: "/api/admin/system/visual-parity.csv",
        routeActionsJson: "/api/admin/system/migration-actions",
        routeActionsCsv: "/api/admin/system/migration-actions.csv",
        publicFrontendGuardJson: "/api/admin/system/public-frontend",
        publicFrontendGuardCsv: "/api/admin/system/public-frontend.csv",
      },
      checks: launchClearanceChecks,
    },
    scope: snapshot.scope,
    totals: {
      actionItems: snapshot.actionPlan.length,
      readinessSignals: readinessSignalCount,
      launchBlockers: publicGuard.totals.launchBlockers,
      primaryRoutes: primaryRouteTotal,
      cmsReadyPrimaryRoutes: publicGuard.totals.cmsReadyRoutes,
      visualParityReviewedRoutes: publicGuard.totals.visualParityReviewedRoutes,
      visualParityApprovedRoutes: publicGuard.totals.visualParityApprovedRoutes,
      crmOpenWork,
    },
    nextMilestone,
    categories,
  };
}

function adminBuildProgressCsv(report: ReturnType<typeof createAdminBuildProgressReport>) {
  const headers = [
    "label",
    "status",
    "percent",
    "complete",
    "total",
    "summary",
    "nextAction",
    "link",
  ];
  const rows = report.categories.map((item) => [
    item.label,
    item.status,
    item.percent,
    item.complete,
    item.total,
    item.summary,
    item.nextAction,
    "",
  ]);
  const launchClearanceRows = report.launchClearance.checks.map((check) => [
    `Launch Clearance: ${check.label}`,
    check.complete ? "complete" : "open",
    check.complete ? 100 : 0,
    check.complete ? 1 : 0,
    1,
    check.complete ? `${check.label} is complete.` : `${check.label} still needs attention.`,
    check.complete ? "No action needed." : check.nextAction,
    check.link,
  ]);

  return [headers.join(","), ...[...rows, ...launchClearanceRows].map((row) => row.map(csvValue).join(","))].join("\n");
}

async function createSystemSnapshot() {
  const exported = await createSystemExport();
  const collections = exported.collections as {
    pages: CmsPage[];
    blogPosts: CmsBlogPost[];
    forms: CmsForm[];
    media: CmsMedia[];
    branding: CmsBranding[];
    menus: CmsMenu[];
    sidebars: CmsSidebar[];
    sections: CmsSection[];
    colorPalettes: CmsColorPalette[];
    documentation: CmsDocumentation[];
    settings: CmsSetting[];
    typography: CmsTypography[];
    systemBackups: CmsSystemBackup[];
  } & Record<CmsCollectionName, unknown[]>;
  const collectionCounts = Object.fromEntries(
    Object.entries(collections).map(([collection, records]) => [collection, records.length]),
  );
  const pages = collections.pages;
  const posts = collections.blogPosts;
  const forms = collections.forms;
  const branding = collections.branding[0] ?? null;
  const publicIdentity = buildPublicBusinessIdentity({
    branding,
    settings: collections.settings,
  });
  const siteSetting = collections.settings.find((setting) => setting.key === "site") ?? null;
  const siteSettingValue = siteSetting?.value ?? {};
  const publicCmsTakeoverIsRequested = publicCmsTakeoverRequested(collections.settings);
  const publicCmsTakeoverConfirmed = publicCmsTakeoverEnabled(collections.settings);
  const publicCmsVisualParityIsApproved = publicCmsVisualParityApproved(siteSettingValue);
  const publicCmsVisualParityRouteReviews = normalizePublicCmsVisualParityRouteReviews(
    siteSettingValue.publicCmsVisualParityRouteReviews,
  );
  const leads = exported.crm.leads;
  const systemUsers = collections.systemUsers as CmsSystemUser[];
  const formSubmissions = collections.formSubmissions as CmsFormSubmission[];
  const leadPipelineStages = normalizeLeadPipelineStages(
    collections.settings.find((setting) => setting.key === "site")?.value.leadPipelineStages,
  );
  const crmHealthReport = createCrmHealthReport(leads);
  const formSubmissionReport = createFormSubmissionReport(formSubmissions, forms, leads);
  const activeOwnerCount = systemUsers.filter((user) => user.status === "active" && user.role === "owner").length;
  const migration = createMigrationCoverageReport({
    pages,
    blogPosts: posts,
    sections: collections.sections,
    forms,
    media: collections.media,
  });
  const publicCmsRouteLaunchBlockers = migration.routes
    .filter((route) => route.routeType === "primary" && !route.ready)
    .map((route) => ({
      slug: route.slug,
      path: route.path,
      status: route.status,
      nextAction: route.nextAction,
      issueCount: route.issues.length,
      issues: route.issues.slice(0, 4),
    }));
  const publicCmsLaunchBlockers = [
    ...(!publicCmsVisualParityIsApproved
      ? [{
          slug: "visual-parity",
          path: withCmsPreviewParam("/", true),
          status: "review",
          nextAction: "Approve CMS visual parity with the original public site.",
          issueCount: 1,
          issues: ["Review the CMS preview against the current Glass & Door Pro frontend before enabling takeover."],
        }]
      : []),
    ...publicCmsRouteLaunchBlockers,
  ];
  const publicCmsTakeoverIsEnabled = publicCmsTakeoverConfirmed && publicCmsLaunchBlockers.length === 0;
  const mediaAudit = createMediaAuditReport({
    media: collections.media,
    pages,
    blogPosts: posts,
    sections: collections.sections,
    branding: collections.branding,
    sidebars: collections.sidebars,
  });
  const sectionActions = createSectionActionReport({
    sections: collections.sections,
    pages,
    forms,
    media: collections.media,
  });
  const menuActions = createMenuActionReport({
    menus: collections.menus,
    pages,
    posts,
  });
  const sidebarActions = createSidebarActionReport({
    sidebars: collections.sidebars,
    forms,
    branding,
    pages,
    posts,
    media: collections.media,
  });
  const designActions = createDesignActionReport({
    branding: collections.branding,
    colorPalettes: collections.colorPalettes,
    typography: collections.typography,
    media: collections.media,
  });
  const systemActions = createSystemActionReport({
    settings: collections.settings,
    documentation: collections.documentation,
    systemBackups: collections.systemBackups,
    systemUsers,
  });
  const seoPressure = createSeoPressureReport(pages, posts, collections.sections, {
    includeCmsRoutes: publicCmsTakeoverIsEnabled,
  });
  const publishedSeoGaps = [
    ...pages.map((page) => ({ status: page.status, seo: page.seo })),
    ...posts.map((post) => ({ status: post.status, seo: post.seo })),
  ].filter((item) => item.status === "published" && seoNeedsReadinessReview(item.seo));
  const publishedBlogIssueResults = await Promise.all(
    posts
      .filter((post) => post.status === "published")
      .map(async (post) => getBlogPostPublishIssues(post)),
  );
  const publishedStructuredData = [
    ...pages
      .filter((page) => page.status === "published" && !page.seo.noIndex)
      .flatMap((page) => seoStructuredDataTypes(page, "page", collections.sections)),
    ...posts
      .filter((post) => post.status === "published" && !post.seo.noIndex)
      .flatMap((post) => seoStructuredDataTypes(post, "blogPost")),
  ];
  const structuredDataTypes = countBy(publishedStructuredData, (type) => type);
  const activePaletteCount = collections.colorPalettes.filter((palette) => palette.isActive).length;
  const activeTypographyCount = collections.typography.filter((style) => style.isActive).length;
  const readiness = {
    pagesWithoutSections: pages.filter((page) => page.content.sections.length === 0).length,
    pageDependencyIssues: pages.filter((page) => pageHasDependencyIssue(page, collections.sections, forms, collections.media)).length,
    sectionsWithBlockIssues: collections.sections.filter((section) =>
      getSectionDependencyIssues(section, collections.sections, forms, collections.media).length > 0,
    ).length,
    blogPostsWithIssues: publishedBlogIssueResults.filter((issues) => issues.length > 0).length,
    publishedSeoGaps: publishedSeoGaps.length,
    seoBlockers: seoPressure.totals.blockers,
    seoWarnings: seoPressure.totals.warnings,
    menusWithLinkIssues: collections.menus.filter((menu) => getMenuReadinessIssues(menu, pages, posts).length > 0).length,
    formsWithLeadIssues: forms.filter((form) => getFormActivationIssues(form).length > 0).length,
    convertibleSubmissions: formSubmissionReport.totals.convertibleSubmissions,
    unlinkedSubmissions: formSubmissionReport.totals.unlinkedSubmissions,
    staleLinkedSubmissions: formSubmissionReport.totals.staleLinkedSubmissions,
    duplicateLeadContacts: crmHealthReport.totals.duplicateContacts,
    crmLeadsWithIssues: leads.filter((lead) => getLeadRecordReadinessIssues(lead, leadPipelineStages, systemUsers).length > 0).length,
    sidebarsWithWidgetIssues: collections.sidebars.filter((sidebar) =>
      getSidebarActivationIssues(sidebar, forms, branding, pages, posts, collections.media).length > 0,
    ).length,
    brandingWithIssues:
      collections.branding.filter((record) => getBrandingSaveIssues(record, collections.media).length > 0).length +
      getBrandingCollectionIssues(collections.branding).length,
    colorPalettesWithIssues: collections.colorPalettes.filter((palette) => getColorPaletteTokenIssues(palette).length > 0).length,
    activePaletteIssues: activePaletteCount === 1 ? 0 : 1,
    settingsWithIssues: collections.settings.filter((setting) => getSettingSaveIssues(setting).length > 0).length,
    mediaWithIssues: mediaAudit.totals.withIssues,
    typographyWithIssues: collections.typography.filter((style) => getTypographySaveIssues(style).length > 0).length,
    activeTypographyIssues: activeTypographyCount === 1 ? 0 : 1,
    documentationWithIssues: collections.documentation.filter((doc) => getDocumentationSaveIssues(doc).length > 0).length,
    backupsWithIssues: collections.systemBackups.filter((backup) => getSystemBackupSaveIssues(backup).length > 0).length,
    systemUsersWithIssues:
      systemUsers.filter((user) => getSystemUserSaveIssues(user).length > 0).length + (activeOwnerCount === 0 ? 1 : 0),
    securityWithIssues:
      (process.env.ADMIN_PASSWORD ? 0 : 1) +
      (process.env.ADMIN_SESSION_SECRET ? 0 : 1),
  };
  const structuredData = {
    records: publishedStructuredData.length,
    webPages: structuredDataTypes.WebPage ?? 0,
    services: structuredDataTypes.Service ?? 0,
    localBusinesses: structuredDataTypes.LocalBusiness ?? 0,
    faqPages: structuredDataTypes.FAQPage ?? 0,
    blogPostings: structuredDataTypes.BlogPosting ?? 0,
    byType: structuredDataTypes,
  };
  const totals = {
    cmsRecords: Object.values(collectionCounts).reduce((sum, count) => sum + count, 0),
    publishedPages: pages.filter((page) => page.status === "published").length,
    draftPages: pages.filter((page) => page.status === "draft").length,
    publishedPosts: posts.filter((post) => post.status === "published").length,
    activeForms: forms.filter((form) => form.isActive).length,
    activeMenus: collections.menus.filter((menu) => menu.isActive).length,
    activeSidebars: collections.sidebars.filter((sidebar) => sidebar.isActive).length,
    mediaAssets: collections.media.length,
    leads: leads.length,
    backups: collectionCounts.systemBackups ?? 0,
  };
  const crm = {
    openLeads: crmHealthReport.totals.openLeads,
    followUpLeads: crmHealthReport.totals.followUpLeads,
    newTodayLeads: crmHealthReport.totals.newTodayLeads,
    estimateLeads: leads.filter((lead) => lead.pipelineStage === "estimate").length,
    wonLeads: crmHealthReport.totals.wonLeads,
    lostLeads: crmHealthReport.totals.lostLeads,
    unassignedLeads: crmHealthReport.totals.unassignedLeads,
    duplicateContacts: crmHealthReport.totals.duplicateContacts,
    duplicateLeads: crmHealthReport.totals.duplicateLeads,
    conversionRate: crmHealthReport.totals.conversionRate,
    oldestOpenLeadAgeHours: crmHealthReport.totals.oldestOpenLeadAgeHours,
    oldestFollowUpAgeHours: crmHealthReport.totals.oldestFollowUpAgeHours,
    actionQueue: crmHealthReport.actionQueue.slice(0, 8),
    stageAging: crmHealthReport.stageAging.slice(0, 8),
  };
  const security = {
    adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
    sessionSecretConfigured: Boolean(process.env.ADMIN_SESSION_SECRET),
    activeUsers: systemUsers.filter((user) => user.status === "active").length,
    activeOwners: activeOwnerCount,
    disabledUsers: systemUsers.filter((user) => user.status === "disabled").length,
    invitedUsers: systemUsers.filter((user) => user.status === "invited").length,
    lastLoginAt: systemUsers
      .map((user) => user.lastLoginAt)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? null,
  };
  const publicRoutes = createPublicRouteEntries(pages, posts, { includeCmsRoutes: publicCmsTakeoverIsEnabled }).map((route) => route.loc).sort();
  const publicForms = createPublicFormEntries(forms, formSubmissions);
  const actionPlan = createAdminActionPlan({
    publicCmsLaunchBlockers,
    visualParitySettingId: siteSetting?.id ?? null,
    migration,
    seoPressure,
    crmHealthReport,
    formSubmissionReport,
    mediaAudit,
    sectionActions,
    menuActions,
    sidebarActions,
    designActions,
    systemActions,
  });
  const publicFrontendGuard = createPublicFrontendGuardReport({
    migration,
    siteUrl: publicIdentity.siteUrl,
    routeReviews: publicCmsVisualParityRouteReviews,
    launchBlockers: publicCmsLaunchBlockers,
    publicCmsTakeoverEnabled: publicCmsTakeoverIsEnabled,
    publicCmsTakeoverRequested: publicCmsTakeoverIsRequested,
    publicCmsTakeoverConfirmed: publicCmsTakeoverConfirmed,
    visualParityApproved: publicCmsVisualParityIsApproved,
  });

  return {
    exported,
    collectionCounts,
    readiness,
    totals,
    actionPlan,
    crm,
    migration: migration.totals,
    migrationActionQueue: migration.actionQueue.slice(0, 8),
    media: mediaAudit.totals,
    mediaActionQueue: mediaAudit.actionQueue.slice(0, 8),
    sectionActionQueue: sectionActions.actionQueue.slice(0, 8),
    menuActionQueue: menuActions.actionQueue.slice(0, 8),
    sidebarActionQueue: sidebarActions.actionQueue.slice(0, 8),
    designActionQueue: designActions.actionQueue.slice(0, 8),
    systemActionQueue: systemActions.actionQueue.slice(0, 8),
    seo: seoPressure,
    structuredData,
    security,
    publicIdentity,
    publicFrontendGuard,
    publicFrontend: {
      cmsTakeoverEnabled: publicCmsTakeoverIsEnabled,
      cmsTakeoverRequested: publicCmsTakeoverIsRequested,
      cmsTakeoverConfirmed: publicCmsTakeoverConfirmed,
      visualParityApproved: publicCmsVisualParityIsApproved,
      visualParityRequiredRoutes: primaryCmsRouteSlugs.length,
      visualParityReviewedRoutes: publicCmsVisualParityRouteReviews.length,
      visualParityRouteReviews: publicCmsVisualParityRouteReviews,
      mode: publicCmsTakeoverIsEnabled
        ? "CMS takeover"
        : publicCmsTakeoverIsRequested
          ? "Original frontend protected (CMS launch blocked)"
          : "Original frontend protected",
      primaryRoutesProtected: !publicCmsTakeoverIsEnabled,
      launchReady: publicCmsLaunchBlockers.length === 0,
      launchBlockerCount: publicCmsLaunchBlockers.length,
      launchBlockers: publicCmsLaunchBlockers.slice(0, 8),
    },
    scope: adminScopeGuardrails,
    publicRoutes,
    publicForms,
    formSubmissionActionQueue: formSubmissionReport.actionQueue.slice(0, 8),
    environment: {
      database: hasDatabase ? "postgres" : "memory",
      nodeEnv: process.env.NODE_ENV || "development",
      schemaProvisioning: getDatabaseProvisioningStatus(),
    },
  };
}

async function createSystemBackupSnapshot({
  name,
  createdBy,
  includeData = true,
  context,
}: {
  name: string;
  createdBy: string;
  includeData?: boolean;
  context?: Record<string, unknown>;
}) {
  const snapshot = await createSystemSnapshot();
  const dataIncluded = includeData !== false;

  return storage.createCms("systemBackups", {
    name,
    status: "ready",
    createdBy,
    manifest: {
      generatedAt: snapshot.exported.exportedAt,
      source: snapshot.exported.source,
      environment: snapshot.environment,
      collections: cmsCollectionNames,
      collectionCounts: snapshot.collectionCounts,
      totals: snapshot.totals,
      readiness: snapshot.readiness,
      publicRoutes: snapshot.publicRoutes,
      publicForms: snapshot.publicForms,
      structuredData: snapshot.structuredData,
      seo: snapshot.seo,
      crm: {
        leads: snapshot.totals.leads,
      },
      dataIncluded,
      snapshot: dataIncluded ? snapshot.exported : undefined,
      exportPath: "/api/admin/system/export",
      ...(context ? { context } : {}),
    },
  });
}

async function createReadinessReport() {
  const snapshot = await createSystemSnapshot();
  const collections = snapshot.exported.collections as {
    pages: CmsPage[];
    blogPosts: CmsBlogPost[];
    forms: CmsForm[];
    media: CmsMedia[];
    branding: CmsBranding[];
    menus: CmsMenu[];
    sidebars: CmsSidebar[];
    sections: CmsSection[];
    colorPalettes: CmsColorPalette[];
    documentation: CmsDocumentation[];
    settings: CmsSetting[];
    typography: CmsTypography[];
    systemBackups: CmsSystemBackup[];
    systemUsers: CmsSystemUser[];
  } & Record<CmsCollectionName, unknown[]>;
  const branding = collections.branding[0] ?? null;
  const leads = snapshot.exported.crm.leads;
  const leadPipelineStages = normalizeLeadPipelineStages(
    collections.settings.find((setting) => setting.key === "site")?.value.leadPipelineStages,
  );
  const pageIssues = collections.pages
    .map((page) => {
      const isPrimaryRoute = primaryCmsRouteSlugSet.has(page.slug);
      const issues = [
        ...(page.content.sections.length === 0
          ? [
              {
                blockIndex: -1,
                blockType: "content",
                message: isPrimaryRoute
                  ? "Page is still relying on hard-coded fallback content."
                  : "CMS page has no sections, so the public route has no useful CMS content.",
              },
            ]
          : []),
        ...getPageDependencyIssues(page, collections.sections, collections.forms, collections.media),
        ...(!page.seo.metaTitle?.trim()
          ? [{ blockIndex: -1, blockType: "seo", message: "SEO title is missing." }]
          : []),
        ...(!page.seo.metaDescription?.trim()
          ? [{ blockIndex: -1, blockType: "seo", message: "SEO description is missing." }]
          : []),
        ...(!page.seo.canonicalUrl?.trim()
          ? [{ blockIndex: -1, blockType: "seo", message: "Canonical URL is missing." }]
          : []),
        ...(seoCanonicalIssue(page.seo.canonicalUrl ?? "")
          ? [{ blockIndex: -1, blockType: "seo", message: "Canonical URL must be a valid http or https URL." }]
          : []),
      ];

      return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        status: page.status,
        path: cmsPageUrl(page.slug),
        issueCount: issues.length,
        issues,
      };
    })
    .filter((page) => page.issueCount > 0);
  const blogIssues = await Promise.all(
    collections.blogPosts.map(async (post) => {
      const issues = post.status === "published" ? await getBlogPostPublishIssues(post) : [];
      return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        status: post.status,
        path: `/blog/${encodeURIComponent(post.slug)}`,
        issueCount: issues.length,
        issues,
      };
    }),
  );
  const seoIssues = snapshot.seo.records.map((record) => ({
    id: record.id,
    title: record.title,
    slug: record.slug,
    status: record.status,
    path: record.path,
    priorityLabel: record.priorityLabel,
    issueCount: record.issueCount,
    nextAction: record.nextAction,
    issues: record.issues.map((issue) => `${record.priorityLabel}: ${issue}. Next: ${record.nextAction}`),
  }));
  const formIssues = collections.forms
    .map((form) => ({
      id: form.id,
      name: form.name,
      slug: form.slug,
      isActive: form.isActive,
      issues: getFormActivationIssues(form),
    }))
    .filter((form) => form.issues.length > 0);
  const leadIssues = leads
    .map((lead) => ({
      id: lead.id,
      name: lead.name,
      status: lead.status,
      pipelineStage: lead.pipelineStage,
      path: `crmLeads/${lead.id}`,
      issues: getLeadRecordReadinessIssues(lead, leadPipelineStages, collections.systemUsers),
    }))
    .filter((lead) => lead.issues.length > 0);
  const sectionIssues = collections.sections
    .map((section) => ({
      id: section.id,
      name: section.name,
      handle: section.handle,
      issues: getSectionDependencyIssues(section, collections.sections, collections.forms, collections.media),
    }))
    .filter((section) => section.issues.length > 0);
  const menuIssues = collections.menus
    .map((menu) => ({
      id: menu.id,
      name: menu.name,
      location: menu.location,
      isActive: menu.isActive,
      issues: getMenuReadinessIssues(menu, collections.pages, collections.blogPosts),
    }))
    .filter((menu) => menu.issues.length > 0);
  const sidebarIssues = collections.sidebars
    .map((sidebar) => ({
      id: sidebar.id,
      name: sidebar.name,
      location: sidebar.location,
      isActive: sidebar.isActive,
      issues: getSidebarActivationIssues(sidebar, collections.forms, branding, collections.pages, collections.blogPosts, collections.media),
    }))
    .filter((sidebar) => sidebar.issues.length > 0);
  const brandingIssues = [
    ...collections.branding
      .map((record) => ({
        id: record.id,
        title: record.siteName,
        path: "branding",
        issues: getBrandingSaveIssues(record, collections.media),
      }))
      .filter((record) => record.issues.length > 0),
    ...getBrandingCollectionIssues(collections.branding).map((issue) => ({
      id: "branding-singleton",
      title: "Branding",
      path: "branding",
      issues: [issue],
    })),
  ];
  const activePaletteCount = collections.colorPalettes.filter((palette) => palette.isActive).length;
  const colorPaletteIssues = [
    ...collections.colorPalettes
      .map((palette) => ({
        id: palette.id,
        name: palette.name,
        isActive: palette.isActive,
        path: "colorPalettes",
        issues: getColorPaletteTokenIssues(palette),
      }))
      .filter((palette) => palette.issues.length > 0),
    ...(activePaletteCount === 1
      ? []
      : [{
          id: "active-palette-required",
          name: "Color Palettes",
          isActive: false,
          path: "colorPalettes",
          issues: [`Exactly one active color palette is required; found ${activePaletteCount}.`],
        }]),
  ];
  const settingIssues = collections.settings
    .map((setting) => ({
      id: setting.id,
      key: setting.key,
      path: `settings/${setting.key}`,
      issues: getSettingSaveIssues(setting),
    }))
    .filter((setting) => setting.issues.length > 0);
  const activeTypographyCount = collections.typography.filter((style) => style.isActive).length;
  const typographyIssues = [
    ...collections.typography
      .map((style) => ({
        id: style.id,
        name: style.name,
        isActive: style.isActive,
        path: "typography",
        issues: getTypographySaveIssues(style),
      }))
      .filter((style) => style.issues.length > 0),
    ...(activeTypographyCount === 1
      ? []
      : [{
          id: "active-typography-required",
          name: "Typography",
          isActive: false,
          path: "typography",
          issues: [`Exactly one active typography record is required; found ${activeTypographyCount}.`],
        }]),
  ];
  const documentationIssues = collections.documentation
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      path: `documentation/${doc.slug}`,
      issues: getDocumentationSaveIssues(doc),
    }))
    .filter((doc) => doc.issues.length > 0);
  const backupIssues = collections.systemBackups
    .map((backup) => ({
      id: backup.id,
      name: backup.name,
      status: backup.status,
      path: `systemBackups/${backup.id}`,
      issues: getSystemBackupSaveIssues(backup),
    }))
    .filter((backup) => backup.issues.length > 0);
  const userIssues = collections.systemUsers
    .map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      status: user.status,
      path: `systemUsers/${user.email}`,
      issues: getSystemUserSaveIssues(user),
    }))
    .filter((user) => user.issues.length > 0);
  const activeOwnerCount = collections.systemUsers.filter((user) => user.status === "active" && user.role === "owner").length;
  if (activeOwnerCount === 0) {
    userIssues.unshift({
      id: "active-owner-required",
      name: "System Users",
      role: "owner",
      status: "missing",
      path: "systemUsers",
      issues: ["At least one active owner system user is required."],
    });
  }
  const securityIssues = [
    ...(!process.env.ADMIN_PASSWORD
      ? [{
          id: "admin-password",
          name: "Admin Password",
          status: "missing",
          path: "system/security",
          issues: ["ADMIN_PASSWORD is not configured."],
        }]
      : []),
    ...(!process.env.ADMIN_SESSION_SECRET
      ? [{
          id: "admin-session-secret",
          name: "Admin Session Secret",
          status: "missing",
          path: "system/security",
          issues: ["ADMIN_SESSION_SECRET is not configured."],
        }]
      : []),
  ];
  const mediaIssues = createMediaAuditReport({
    media: collections.media,
    pages: collections.pages,
    blogPosts: collections.blogPosts,
    sections: collections.sections,
    branding: collections.branding,
    sidebars: collections.sidebars,
  }).items
    .filter((media) => media.issueCount > 0)
    .map((media) => ({
      id: media.id,
      name: media.name,
      kind: media.kind,
      path: media.url,
      usageCount: media.usageCount,
      issues: media.issues,
    }));

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    environment: snapshot.environment,
    totals: snapshot.totals,
    crm: snapshot.crm,
    migration: snapshot.migration,
    media: snapshot.media,
    seo: snapshot.seo,
    structuredData: snapshot.structuredData,
    security: snapshot.security,
    readiness: snapshot.readiness,
    publicRoutes: snapshot.publicRoutes,
    publicForms: snapshot.publicForms,
    blockers: {
      pages: pageIssues,
      blogPosts: blogIssues.filter((post) => post.issueCount > 0),
      seo: seoIssues,
      sections: sectionIssues,
      menus: menuIssues,
      forms: formIssues,
      crmLeads: leadIssues,
      sidebars: sidebarIssues,
      branding: brandingIssues,
      colorPalettes: colorPaletteIssues,
      settings: settingIssues,
      media: mediaIssues,
      typography: typographyIssues,
      documentation: documentationIssues,
      systemBackups: backupIssues,
      systemUsers: userIssues,
      security: securityIssues,
    },
  };
}

function readinessReportCsv(report: Awaited<ReturnType<typeof createReadinessReport>>) {
  const headers = ["category", "title", "status", "path", "issueType", "issue"];
  const rows = [
    ...report.blockers.pages.flatMap((page) =>
      page.issues.map((issue) => [
        "page",
        page.title,
        page.status,
        page.path,
        issue.blockType,
        issue.message,
      ]),
    ),
    ...report.blockers.blogPosts.flatMap((post) =>
      post.issues.map((issue) => [
        "blogPost",
        post.title,
        post.status,
        post.path,
        issue.blockType,
        issue.message,
      ]),
    ),
    ...report.blockers.seo.flatMap((record) =>
      record.issues.map((issue) => [
        "seo",
        record.title,
        record.status,
        record.path,
        record.priorityLabel,
        issue,
      ]),
    ),
    ...report.blockers.forms.flatMap((form) =>
      form.issues.map((issue) => [
        "form",
        form.name,
        form.isActive ? "active" : "inactive",
        form.slug,
        "leadCapture",
        issue,
      ]),
    ),
    ...report.blockers.crmLeads.flatMap((lead) =>
      lead.issues.map((issue) => [
        "crmLead",
        lead.name,
        `${lead.pipelineStage}:${lead.status}`,
        lead.path,
        "pipeline",
        issue,
      ]),
    ),
    ...report.blockers.sections.flatMap((section) =>
      section.issues.map((issue) => [
        "section",
        section.name,
        "reusable",
        section.handle,
        issue.blockType,
        issue.message,
      ]),
    ),
    ...report.blockers.menus.flatMap((menu) =>
      menu.issues.map((issue) => [
        "menu",
        menu.name,
        menu.isActive ? "active" : "inactive",
        menu.location,
        "navigation",
        issue,
      ]),
    ),
    ...report.blockers.sidebars.flatMap((sidebar) =>
      sidebar.issues.map((issue) => [
        "sidebar",
        sidebar.name,
        sidebar.isActive ? "active" : "inactive",
        sidebar.location,
        "widget",
        issue,
      ]),
    ),
    ...report.blockers.branding.flatMap((branding) =>
      branding.issues.map((issue) => [
        "branding",
        branding.title,
        "active",
        branding.path,
        "brand",
        issue,
      ]),
    ),
    ...report.blockers.colorPalettes.flatMap((palette) =>
      palette.issues.map((issue) => [
        "colorPalette",
        palette.name,
        palette.isActive ? "active" : "inactive",
        palette.path,
        "design",
        issue,
      ]),
    ),
    ...report.blockers.settings.flatMap((setting) =>
      setting.issues.map((issue) => [
        "setting",
        setting.key,
        "active",
        setting.path,
        "configuration",
        issue,
      ]),
    ),
    ...report.blockers.media.flatMap((media) =>
      media.issues.map((issue) => [
        "media",
        media.name,
        media.kind,
        media.path,
        `usage:${media.usageCount}`,
        issue,
      ]),
    ),
    ...report.blockers.typography.flatMap((style) =>
      style.issues.map((issue) => [
        "typography",
        style.name,
        style.isActive ? "active" : "inactive",
        style.path,
        "font",
        issue,
      ]),
    ),
    ...report.blockers.documentation.flatMap((doc) =>
      doc.issues.map((issue) => [
        "documentation",
        doc.title,
        doc.category,
        doc.path,
        "documentation",
        issue,
      ]),
    ),
    ...report.blockers.systemBackups.flatMap((backup) =>
      backup.issues.map((issue) => [
        "systemBackup",
        backup.name,
        backup.status,
        backup.path,
        "backup",
        issue,
      ]),
    ),
    ...report.blockers.systemUsers.flatMap((user) =>
      user.issues.map((issue) => [
        "systemUser",
        user.name,
        `${user.role}:${user.status}`,
        user.path,
        "access",
        issue,
      ]),
    ),
    ...report.blockers.security.flatMap((item) =>
      item.issues.map((issue) => [
        "security",
        item.name,
        item.status,
        item.path,
        "environment",
        issue,
      ]),
    ),
  ];

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function manifestNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function createManifestSeoSummary(manifest: Record<string, unknown>) {
  const seo = isPlainRecord(manifest.seo) ? manifest.seo : {};
  const totals = isPlainRecord(seo.totals) ? seo.totals : {};
  const records = Array.isArray(seo.records) ? seo.records : [];

  return {
    records: manifestNumber(totals.records),
    published: manifestNumber(totals.published),
    indexable: manifestNumber(totals.indexable),
    blockers: manifestNumber(totals.blockers),
    warnings: manifestNumber(totals.warnings),
    draftIssues: manifestNumber(totals.draftIssues),
    ready: manifestNumber(totals.ready),
    issueCount: manifestNumber(totals.issueCount),
    structuredDataRecords: manifestNumber(totals.structuredDataRecords),
    topRecords: records
      .filter(isPlainRecord)
      .slice(0, 8)
      .map((record) => ({
        title: typeof record.title === "string" ? record.title : "Untitled",
        type: typeof record.type === "string" ? record.type : "record",
        path: typeof record.path === "string" ? record.path : "",
        priorityLabel: typeof record.priorityLabel === "string" ? record.priorityLabel : "review",
        issueCount: manifestNumber(record.issueCount),
        nextAction: typeof record.nextAction === "string" ? record.nextAction : "Review SEO metadata.",
      })),
  };
}

function createBackupRestorePreview(manifest: Record<string, unknown>) {
  const snapshot = manifest.snapshot;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const seo = createManifestSeoSummary(manifest);

  if (!isPlainRecord(snapshot)) {
    return {
      restorable: false,
      summary: "This backup only includes a manifest, so there is no point-in-time data to preview.",
      generatedAt: typeof manifest.generatedAt === "string" ? manifest.generatedAt : null,
      source: typeof manifest.source === "string" ? manifest.source : "Glass & Door Pro Admin",
      collections: [],
      crm: { included: false, leads: 0 },
      seo,
      warnings,
      blockers: ["No snapshot payload is attached to this backup."],
    };
  }

  const snapshotCollections = isPlainRecord(snapshot.collections) ? snapshot.collections : null;
  if (!snapshotCollections) {
    blockers.push("Snapshot collections are missing or malformed.");
  }

  const expectedCollections = cmsCollectionNames.filter((collection) => collection !== "systemBackups");
  const collections = expectedCollections.map((collection) => {
    const records = snapshotCollections?.[collection];
    const included = Array.isArray(records);
    if (!included) {
      blockers.push(`${collection} is missing from the snapshot.`);
    }
    return {
      collection,
      included,
      count: included ? records.length : 0,
    };
  });

  const unknownCollections = snapshotCollections
    ? Object.keys(snapshotCollections).filter((collection) => !cmsCollectionNames.includes(collection as CmsCollectionName))
    : [];
  if (unknownCollections.length > 0) {
    warnings.push(`Unknown collections found in snapshot: ${unknownCollections.join(", ")}.`);
  }
  if (snapshotCollections && Array.isArray(snapshotCollections.systemBackups)) {
    warnings.push("System backup records are present for audit history and should stay excluded from future production restores.");
  }

  const crm = isPlainRecord(snapshot.crm) ? snapshot.crm : null;
  const leads = crm?.leads;
  if (!crm || !Array.isArray(leads)) {
    warnings.push("CRM leads are not included in this snapshot.");
  }
  if (!isPlainRecord(manifest.seo)) {
    warnings.push("SEO launch pressure metadata is not included in this backup manifest.");
  }

  const generatedAt = typeof snapshot.exportedAt === "string"
    ? snapshot.exportedAt
    : typeof manifest.generatedAt === "string"
      ? manifest.generatedAt
      : null;
  const source = typeof snapshot.source === "string"
    ? snapshot.source
    : typeof manifest.source === "string"
      ? manifest.source
      : "Glass & Door Pro Admin";

  return {
    restorable: blockers.length === 0,
    summary: blockers.length === 0
      ? "Snapshot data is structured and can be restored with confirmation."
      : "Snapshot data needs attention before it can be restored.",
    generatedAt,
    source,
    collections,
    crm: {
      included: Array.isArray(leads),
      leads: Array.isArray(leads) ? leads.length : 0,
    },
    seo,
    warnings,
    blockers,
  };
}

function createBackupCatalog(backups: CmsSystemBackup[]) {
  const records = backups
    .map((backup) => {
      const manifest = backup.manifest ?? {};
      const totals = isPlainRecord(manifest.totals) ? manifest.totals : {};
      const structuredData = isPlainRecord(manifest.structuredData) ? manifest.structuredData : {};
      const lastRestore = isPlainRecord(manifest.lastRestore) ? manifest.lastRestore : {};
      const preview = createBackupRestorePreview(manifest);
      const dataIncluded = manifest.dataIncluded === true && Boolean(manifest.snapshot);
      const restoreStatus = dataIncluded
        ? preview.restorable
          ? "snapshot-ready"
          : "needs-review"
        : "manifest-only";
      const lastRestoredAt = typeof manifest.lastRestoredAt === "string"
        ? manifest.lastRestoredAt
        : typeof lastRestore.restoredAt === "string"
          ? lastRestore.restoredAt
          : null;

      return {
        id: backup.id,
        name: backup.name,
        status: backup.status,
        createdBy: backup.createdBy ?? "",
        createdAt: backup.createdAt,
        updatedAt: backup.updatedAt,
        generatedAt: typeof manifest.generatedAt === "string" ? manifest.generatedAt : null,
        source: typeof manifest.source === "string" ? manifest.source : "Glass & Door Pro Admin",
        dataIncluded,
        restoreStatus,
        cmsRecords: manifestNumber(totals.cmsRecords),
        publishedPages: manifestNumber(totals.publishedPages),
        leads: manifestNumber(totals.leads),
        publicRoutes: Array.isArray(manifest.publicRoutes) ? manifest.publicRoutes.length : 0,
        publicForms: Array.isArray(manifest.publicForms) ? manifest.publicForms.length : 0,
        structuredDataRecords: manifestNumber(structuredData.records),
        seoBlockers: preview.seo.blockers,
        seoWarnings: preview.seo.warnings,
        seoIssueCount: preview.seo.issueCount,
        blockerCount: preview.blockers.length,
        warningCount: preview.warnings.length,
        lastRestoredAt,
        lastRestoreIncludesCrm: typeof lastRestore.includeCrm === "boolean" ? lastRestore.includeCrm : null,
        preRestoreBackupId: typeof lastRestore.preRestoreBackupId === "string" ? lastRestore.preRestoreBackupId : "",
        summary: preview.summary,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    totals: {
      backups: records.length,
      ready: records.filter((record) => record.status === "ready").length,
      restored: records.filter((record) => record.status === "restored").length,
      restoredSnapshots: records.filter((record) => Boolean(record.lastRestoredAt)).length,
      snapshotReady: records.filter((record) => record.restoreStatus === "snapshot-ready").length,
      manifestOnly: records.filter((record) => record.restoreStatus === "manifest-only").length,
      needsReview: records.filter((record) => record.restoreStatus === "needs-review").length,
      dataIncluded: records.filter((record) => record.dataIncluded).length,
      seoBlockers: records.reduce((total, record) => total + record.seoBlockers, 0),
      seoWarnings: records.reduce((total, record) => total + record.seoWarnings, 0),
    },
    latest: records[0] ?? null,
    records,
  };
}

function backupCatalogCsv(catalog: ReturnType<typeof createBackupCatalog>) {
  const headers = [
    "name",
    "status",
    "restoreStatus",
    "createdBy",
    "createdAt",
    "updatedAt",
    "generatedAt",
    "source",
    "dataIncluded",
    "cmsRecords",
    "publishedPages",
    "leads",
    "publicRoutes",
    "publicForms",
    "structuredDataRecords",
    "seoBlockers",
    "seoWarnings",
    "seoIssueCount",
    "blockerCount",
    "warningCount",
    "lastRestoredAt",
    "lastRestoreIncludesCrm",
    "preRestoreBackupId",
    "summary",
  ];
  const rows = catalog.records.map((record) => [
    record.name,
    record.status,
    record.restoreStatus,
    record.createdBy,
    new Date(record.createdAt).toISOString(),
    new Date(record.updatedAt).toISOString(),
    record.generatedAt ?? "",
    record.source,
    record.dataIncluded,
    record.cmsRecords,
    record.publishedPages,
    record.leads,
    record.publicRoutes,
    record.publicForms,
    record.structuredDataRecords,
    record.seoBlockers,
    record.seoWarnings,
    record.seoIssueCount,
    record.blockerCount,
    record.warningCount,
    record.lastRestoredAt ?? "",
    record.lastRestoreIncludesCrm ?? "",
    record.preRestoreBackupId,
    record.summary,
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(csvValue).join(","))].join("\n");
}

type DocumentationRunbookSnapshot = {
  totals: Record<string, unknown>;
  readiness: Record<string, number>;
  migration: Record<string, unknown>;
  migrationActionQueue?: Array<Record<string, unknown>>;
  media: Record<string, unknown>;
  structuredData: Record<string, unknown>;
  seo: ReturnType<typeof createSeoPressureReport>;
  mediaActionQueue?: Array<Record<string, unknown>>;
  sectionActionQueue?: Array<Record<string, unknown>>;
  menuActionQueue?: Array<Record<string, unknown>>;
  sidebarActionQueue?: Array<Record<string, unknown>>;
  designActionQueue?: Array<Record<string, unknown>>;
  systemActionQueue?: Array<Record<string, unknown>>;
  formSubmissionActionQueue?: Array<Record<string, unknown>>;
  security: Record<string, unknown>;
  crm: {
    openLeads: number;
    followUpLeads: number;
    highPriorityLeads?: number;
    oldestOpenLeadAgeHours: number;
    actionQueue: ReturnType<typeof createCrmHealthReport>["actionQueue"];
    stageAging: ReturnType<typeof createCrmStageAging>;
  };
  environment: Record<string, unknown>;
  scope?: {
    status: string;
    sections: readonly string[];
    collections: readonly string[];
    excludedModuleFamilies: readonly string[];
    documentationSlug: string;
  };
  publicRoutes: string[];
  publicForms?: Array<{
    name: string;
    slug: string;
    endpoint: string;
    fieldCount: number;
    submissionCount: number;
    lastSubmissionAt: string | null;
  }>;
};

function runbookValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "not set";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function runbookActionQueueLines(label: string, rows: Array<Record<string, unknown>> | undefined) {
  const actions = rows ?? [];
  return [
    `- ${label}: ${actions.length}`,
    ...(actions.length
      ? actions.slice(0, 4).map((item) => {
          const title =
            typeof item.name === "string" ? item.name :
            typeof item.title === "string" ? item.title :
            typeof item.formName === "string" ? item.formName :
            typeof item.id === "string" ? item.id :
            "Untitled";
          const context =
            typeof item.priorityLabel === "string" ? item.priorityLabel :
            typeof item.urgency === "string" ? item.urgency :
            typeof item.status === "string" ? item.status :
            typeof item.collection === "string" ? item.collection :
            "review";
          const nextAction =
            typeof item.nextAction === "string" ? item.nextAction :
            typeof item.action === "string" ? item.action :
            "Review in admin.";
          return `  - ${title} (${context}): ${nextAction}`;
        })
      : []),
  ];
}

function createDocumentationRunbookMarkdown(docs: CmsDocumentation[], snapshot?: DocumentationRunbookSnapshot) {
  const sortedDocs = [...docs].sort((a, b) =>
    a.category.localeCompare(b.category) ||
    a.title.localeCompare(b.title) ||
    a.slug.localeCompare(b.slug),
  );
  const categories = countBy(sortedDocs, (doc) => doc.category || "Uncategorized");
  const lines = [
    "# Glass & Door Pro CMS Operations Runbook",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Notes: ${sortedDocs.length}`,
    "",
    "## Documentation Coverage",
    "",
    ...Object.entries(categories)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, count]) => `- ${category}: ${count}`),
    "",
  ];

  if (snapshot) {
    const readinessEntries = Object.entries(snapshot.readiness).sort(([a], [b]) => a.localeCompare(b));
    const openReadinessIssues = readinessEntries.filter(([, count]) => count > 0);

    lines.push(
      "## Live CMS Snapshot",
      "",
      `- Database: ${runbookValue(snapshot.environment.database)}`,
      `- Node environment: ${runbookValue(snapshot.environment.nodeEnv)}`,
      `- Schema provisioning: ${runbookValue(snapshot.environment.schemaProvisioning)}`,
      `- Admin scope: ${runbookValue(snapshot.scope?.status).replace(/-/g, " ")}`,
      `- Scope sections: ${snapshot.scope?.sections.join(", ") ?? "Content, Design, CRM, System"}`,
      `- Excluded source-project modules: ${snapshot.scope?.excludedModuleFamilies.join(", ") ?? "listing directories, application intake, public calendars, customer account portals, agreement-gated onboarding, RSVP flows, ticketing, venue schedules, or attendee management"}`,
      `- CMS records: ${runbookValue(snapshot.totals.cmsRecords)}`,
      `- Published pages: ${runbookValue(snapshot.totals.publishedPages)}`,
      `- Draft pages: ${runbookValue(snapshot.totals.draftPages)}`,
      `- Public routes: ${snapshot.publicRoutes.length}`,
      `- Public forms: ${snapshot.publicForms?.length ?? 0}`,
      `- Leads: ${runbookValue(snapshot.totals.leads)}`,
      `- Media assets: ${runbookValue(snapshot.totals.mediaAssets)}`,
      `- Structured data records: ${runbookValue(snapshot.structuredData.records)}`,
      "",
      "## SEO Launch Snapshot",
      "",
      `- SEO records: ${runbookValue(snapshot.seo.totals.records)}`,
      `- Published records: ${runbookValue(snapshot.seo.totals.published)}`,
      `- Indexable records: ${runbookValue(snapshot.seo.totals.indexable)}`,
      `- Launch blockers: ${runbookValue(snapshot.seo.totals.blockers)}`,
      `- Warnings: ${runbookValue(snapshot.seo.totals.warnings)}`,
      `- Draft issues: ${runbookValue(snapshot.seo.totals.draftIssues)}`,
      `- Structured data records: ${runbookValue(snapshot.seo.totals.structuredDataRecords)}`,
      "",
      ...(snapshot.seo.records.length
        ? snapshot.seo.records.slice(0, 6).map((record) =>
            `- ${record.title} (${record.type}, ${record.priorityLabel}): ${record.nextAction} ${record.path ? `[${record.path}]` : ""}`,
          )
        : ["- No SEO launch pressure records were reported."]),
      "",
      "## CRM Snapshot",
      "",
      `- Open leads: ${runbookValue(snapshot.crm.openLeads)}`,
      `- Leads needing follow-up: ${runbookValue(snapshot.crm.followUpLeads)}`,
      `- Queued lead actions: ${runbookValue(snapshot.crm.actionQueue?.length ?? 0)}`,
      `- High-pressure stages: ${snapshot.crm.stageAging.filter((stage) => stage.followUpLeads > 0 || stage.highPriorityLeads > 0).length}`,
      `- Oldest open lead age: ${runbookValue(snapshot.crm.oldestOpenLeadAgeHours)} hours`,
      "",
      ...(snapshot.crm.actionQueue?.length
        ? snapshot.crm.actionQueue.slice(0, 6).map((lead) =>
            `- ${lead.name} (${lead.urgency}, ${lead.pipelineStage}): ${lead.action} - ${lead.detail}`,
          )
        : ["- No CRM action queue pressure was reported."]),
      "",
      ...(snapshot.crm.stageAging.length
        ? snapshot.crm.stageAging.map((stage) =>
            `- ${stage.stage}: ${stage.openLeads} open, ${stage.followUpLeads} follow-up, ${stage.highPriorityLeads} high, oldest ${stage.oldestOpenLeadAgeHours}h`,
          )
        : ["- No CRM stage pressure was reported."]),
      "",
      "## Action Queue Snapshot",
      "",
      ...runbookActionQueueLines("Route actions", snapshot.migrationActionQueue),
      ...runbookActionQueueLines("Media actions", snapshot.mediaActionQueue),
      ...runbookActionQueueLines("Section actions", snapshot.sectionActionQueue),
      ...runbookActionQueueLines("Menu actions", snapshot.menuActionQueue),
      ...runbookActionQueueLines("Sidebar actions", snapshot.sidebarActionQueue),
      ...runbookActionQueueLines("Design actions", snapshot.designActionQueue),
      ...runbookActionQueueLines("System actions", snapshot.systemActionQueue),
      ...runbookActionQueueLines("Form submission actions", snapshot.formSubmissionActionQueue),
      "",
      "## Migration Snapshot",
      "",
      `- Ready routes: ${runbookValue(snapshot.migration.readyRoutes)} / ${runbookValue(snapshot.migration.routes)}`,
      `- Primary fallback routes: ${runbookValue(snapshot.migration.fallbackRoutes)}`,
      `- Missing primary routes: ${runbookValue(snapshot.migration.missingPrimaryRoutes)}`,
      `- Custom route gaps: ${runbookValue(snapshot.migration.customRouteGaps)}`,
      `- Custom route review: ${runbookValue(snapshot.migration.customRouteReviewRoutes)}`,
      `- Publish-ready routes: ${runbookValue(snapshot.migration.publishReadyRoutes)}`,
      `- Page dependency issues: ${runbookValue(snapshot.migration.dependencyIssues)}`,
      `- Media records with issues: ${runbookValue(snapshot.media.withIssues)}`,
      `- Video media records: ${runbookValue(snapshot.media.videos)}`,
      `- Gallery-ready media: ${runbookValue(snapshot.media.galleryReady)} / ${runbookValue(snapshot.media.images)}`,
      `- Gallery media missing category: ${runbookValue(snapshot.media.galleryMissingCategory)}`,
      "",
      "## Public Form Endpoints",
      "",
      ...(snapshot.publicForms?.length
        ? snapshot.publicForms.map((form) =>
            `- ${form.name} (${form.slug}): ${form.endpoint} - ${form.fieldCount} field${form.fieldCount === 1 ? "" : "s"}, ${form.submissionCount} submission${form.submissionCount === 1 ? "" : "s"}`,
          )
        : ["- No active public CMS forms are exposed right now."]),
      "",
      "## Readiness Issue Counts",
      "",
      ...(readinessEntries.length > 0
        ? readinessEntries.map(([key, count]) => `- ${key}: ${count}`)
        : ["- No readiness checks were available."]),
      "",
      "## Current Blockers",
      "",
      ...(openReadinessIssues.length > 0
        ? openReadinessIssues.map(([key, count]) => `- ${key}: ${count}`)
        : ["- No readiness blockers were reported at export time."]),
      "",
    );
  }

  lines.push("## Notes", "");

  for (const doc of sortedDocs) {
    lines.push(
      `### ${doc.title}`,
      "",
      `Category: ${doc.category}`,
      `Slug: ${doc.slug}`,
      `Updated: ${doc.updatedAt.toISOString()}`,
      "",
      doc.body.trim() || "_No documentation body has been added yet._",
      "",
    );
  }

  return lines.join("\n");
}

function snapshotCollectionCounts(snapshot: unknown) {
  const collections = isPlainRecord(snapshot) && isPlainRecord(snapshot.collections) ? snapshot.collections : {};

  return Object.fromEntries(
    cmsCollectionNames
      .filter((collection) => collection !== "systemBackups")
      .map((collection) => {
        const records = collections[collection];
        return [collection, Array.isArray(records) ? records.length : 0];
      }),
  ) as Partial<Record<CmsCollectionName, number>>;
}

function createBackupRestorePlan(manifest: Record<string, unknown>, current: Awaited<ReturnType<typeof createSystemSnapshot>>) {
  const preview = createBackupRestorePreview(manifest);
  const snapshot = isPlainRecord(manifest.snapshot) ? manifest.snapshot : null;
  const snapshotCounts = snapshotCollectionCounts(snapshot);
  const currentCounts = current.collectionCounts;
  const collections = cmsCollectionNames
    .filter((collection) => collection !== "systemBackups")
    .map((collection) => {
      const currentCount = currentCounts[collection] ?? 0;
      const snapshotCount = snapshotCounts[collection] ?? 0;
      return {
        collection,
        currentCount,
        snapshotCount,
        delta: snapshotCount - currentCount,
        included: preview.collections.some((item) => item.collection === collection && item.included),
      };
    });
  const snapshotCrm = snapshot && isPlainRecord(snapshot.crm) && Array.isArray(snapshot.crm.leads)
    ? snapshot.crm.leads.length
    : 0;
  const snapshotReadiness = isPlainRecord(manifest.readiness) ? manifest.readiness : {};
  const snapshotRoutes = Array.isArray(manifest.publicRoutes) ? manifest.publicRoutes.length : 0;
  const snapshotForms = Array.isArray(manifest.publicForms) ? manifest.publicForms.length : 0;
  const snapshotStructuredData = isPlainRecord(manifest.structuredData) ? manifest.structuredData : {};
  const snapshotSeo = createManifestSeoSummary(manifest);

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    restorable: preview.restorable,
    summary: preview.restorable
      ? "This snapshot has the expected data shape. Review impact before restoring."
      : "This snapshot is not ready for restore work until blockers are resolved.",
    backup: {
      generatedAt: typeof manifest.generatedAt === "string" ? manifest.generatedAt : preview.generatedAt,
      source: typeof manifest.source === "string" ? manifest.source : preview.source,
      dataIncluded: manifest.dataIncluded === true && Boolean(manifest.snapshot),
    },
    impact: {
      cmsRecordDelta: collections.reduce((total, item) => total + item.delta, 0),
      leadDelta: snapshotCrm - current.totals.leads,
      publicRouteDelta: snapshotRoutes - current.publicRoutes.length,
      publicFormDelta: snapshotForms - current.publicForms.length,
      structuredDataDelta: manifestNumber(snapshotStructuredData.records) - current.structuredData.records,
      seoBlockerDelta: snapshotSeo.blockers - current.seo.totals.blockers,
      seoWarningDelta: snapshotSeo.warnings - current.seo.totals.warnings,
      seoIssueDelta: snapshotSeo.issueCount - current.seo.totals.issueCount,
      readinessDelta: Object.fromEntries(
        Object.entries(current.readiness).map(([key, value]) => [
          key,
          manifestNumber(snapshotReadiness[key]) - value,
        ]),
      ),
    },
    current: {
      totals: current.totals,
      readiness: current.readiness,
      publicRoutes: current.publicRoutes.length,
      publicForms: current.publicForms.length,
      structuredData: current.structuredData,
      seo: current.seo.totals,
    },
    snapshot: {
      totals: isPlainRecord(manifest.totals) ? manifest.totals : {},
      readiness: snapshotReadiness,
      publicRoutes: snapshotRoutes,
      publicForms: snapshotForms,
      structuredData: snapshotStructuredData,
      seo: snapshotSeo,
      crmLeads: snapshotCrm,
    },
    collections,
    blockers: preview.blockers,
    warnings: [
      ...preview.warnings,
      "Restore requires exact typed confirmation and creates a pre-restore safety snapshot first.",
    ],
  };
}

function backupRestorePlanCsv(plan: ReturnType<typeof createBackupRestorePlan>) {
  const headers = ["collection", "currentCount", "snapshotCount", "delta", "included"];
  const rows = plan.collections.map((item) => [
    item.collection,
    item.currentCount,
    item.snapshotCount,
    item.delta,
    item.included,
  ]);

  return [
    ["summary", plan.summary].map(csvValue).join(","),
    ["generatedAt", plan.generatedAt].map(csvValue).join(","),
    ["restorable", plan.restorable].map(csvValue).join(","),
    ["seoBlockerDelta", plan.impact.seoBlockerDelta].map(csvValue).join(","),
    ["seoWarningDelta", plan.impact.seoWarningDelta].map(csvValue).join(","),
    ["seoIssueDelta", plan.impact.seoIssueDelta].map(csvValue).join(","),
    "",
    headers.join(","),
    ...rows.map((row) => row.map(csvValue).join(",")),
  ].join("\n");
}

const restorableCmsCollectionNames = cmsCollectionNames.filter(
  (collection) => collection !== "systemBackups",
) as Exclude<CmsCollectionName, "systemBackups">[];

const cmsSnapshotDateFields: Partial<Record<CmsCollectionName, string[]>> = {
  pages: ["publishedAt", "createdAt", "updatedAt"],
  forms: ["createdAt", "updatedAt"],
  formSubmissions: ["createdAt", "updatedAt"],
  blogPosts: ["publishedAt", "createdAt", "updatedAt"],
  media: ["createdAt", "updatedAt"],
  sections: ["createdAt", "updatedAt"],
  branding: ["createdAt", "updatedAt"],
  colorPalettes: ["createdAt", "updatedAt"],
  typography: ["createdAt", "updatedAt"],
  menus: ["createdAt", "updatedAt"],
  sidebars: ["createdAt", "updatedAt"],
  documentation: ["createdAt", "updatedAt"],
  systemUsers: ["lastLoginAt", "createdAt", "updatedAt"],
  settings: ["createdAt", "updatedAt"],
};

const nullableSnapshotDateFields = new Set(["publishedAt", "lastLoginAt", "nextFollowUpAt"]);

function restoreConfirmationForBackup(backup: CmsSystemBackup) {
  return `RESTORE ${backup.name}`;
}

function coerceSnapshotDate(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") {
    return nullableSnapshotDateFields.has(field) ? null : new Date();
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return nullableSnapshotDateFields.has(field) ? null : new Date();
  }
  return date;
}

function normalizeSnapshotRecord(collection: CmsCollectionName, record: unknown) {
  if (!isPlainRecord(record) || typeof record.id !== "string" || !record.id.trim()) {
    throw new Error(`${collection} contains a record without a valid id.`);
  }

  const normalized: Record<string, unknown> = { ...record };
  for (const field of cmsSnapshotDateFields[collection] ?? []) {
    normalized[field] = coerceSnapshotDate(normalized[field], field);
  }
  return normalized;
}

function normalizeLeadSnapshotRecord(record: unknown) {
  if (!isPlainRecord(record) || typeof record.id !== "string" || !record.id.trim()) {
    throw new Error("CRM leads contain a record without a valid id.");
  }

  return {
    ...record,
    nextFollowUpAt: coerceSnapshotDate(record.nextFollowUpAt, "nextFollowUpAt"),
    createdAt: coerceSnapshotDate(record.createdAt, "createdAt"),
    updatedAt: coerceSnapshotDate(record.updatedAt, "updatedAt"),
  } as CrmLead;
}

function snapshotCollectionsForRestore(manifest: Record<string, unknown>) {
  const snapshot = isPlainRecord(manifest.snapshot) ? manifest.snapshot : null;
  const snapshotCollections = snapshot && isPlainRecord(snapshot.collections) ? snapshot.collections : null;
  if (!snapshotCollections) {
    throw new Error("Backup snapshot collections are missing.");
  }

  return Object.fromEntries(
    restorableCmsCollectionNames.map((collection) => {
      const records = snapshotCollections[collection];
      if (!Array.isArray(records)) {
        throw new Error(`${collection} is missing from the backup snapshot.`);
      }
      return [collection, records.map((record) => normalizeSnapshotRecord(collection, record))];
    }),
  ) as Parameters<typeof storage.restoreSnapshot>[0];
}

function snapshotLeadsForRestore(manifest: Record<string, unknown>) {
  const snapshot = isPlainRecord(manifest.snapshot) ? manifest.snapshot : null;
  const crm = snapshot && isPlainRecord(snapshot.crm) ? snapshot.crm : null;
  if (!crm || !Array.isArray(crm.leads)) {
    throw new Error("CRM leads are missing from the backup snapshot.");
  }

  return crm.leads.map(normalizeLeadSnapshotRecord);
}

function expandReusableSectionBlocks(blocks: CmsSectionBlock[], sections: CmsSection[]) {
  const expandBlock = (
    block: CmsSectionBlock,
    depth = 0,
    visitedSectionIds = new Set<string>(),
    keyPrefix = "",
  ): CmsSectionBlock[] => {
    if (block.type !== "sectionRef") {
      return keyPrefix ? [{ ...block, id: `${keyPrefix}__${block.id ?? block.type}` }] : [block];
    }
    if (depth >= maxReusableSectionDepth) return [];

    const handle = typeof block.props.handle === "string" ? block.props.handle.trim() : "";
    const sectionId = typeof block.props.sectionId === "string" ? block.props.sectionId.trim() : "";
    const section = sections.find((item) => item.handle === handle || item.id === sectionId);

    if (!section?.blocks.length || visitedSectionIds.has(section.id)) return [];

    const nextVisitedSectionIds = new Set(visitedSectionIds);
    nextVisitedSectionIds.add(section.id);
    const referenceKey = [keyPrefix, block.id ?? handle ?? sectionId ?? `section-ref-${depth}`, section.handle]
      .filter(Boolean)
      .join("__");

    return section.blocks.flatMap((sectionBlock, index) =>
      expandBlock(
        sectionBlock,
        depth + 1,
        nextVisitedSectionIds,
        `${referenceKey}__${index}`,
      ),
    );
  };

  return blocks.flatMap((block) => expandBlock(block));
}

async function expandReusableSections(page: Awaited<ReturnType<typeof storage.getPageBySlug>>) {
  if (!page?.content.sections.some((block) => block.type === "sectionRef")) {
    return page;
  }

  const sections = await storage.listCms("sections");
  const expandedSections = expandReusableSectionBlocks(page.content.sections, sections);

  return {
    ...page,
    content: {
      ...page.content,
      sections: expandedSections,
    },
  };
}

async function expandReusableSectionPreview(section: CmsSection) {
  if (!section.blocks.some((block) => block.type === "sectionRef")) {
    return section;
  }

  const sections = (await storage.listCms("sections")).filter((item) => item.id !== section.id);

  return {
    ...section,
    blocks: expandReusableSectionBlocks(section.blocks, sections),
  };
}

function countBlockSectionReferences(
  blocks: CmsSectionBlock[],
  section: CmsSection,
  sections: CmsSection[] = [],
  depth = 0,
): number {
  return blocks.reduce<number>((count, block) => {
    if (block.type !== "sectionRef") return count;
    const handle = typeof block.props.handle === "string" ? block.props.handle.trim() : "";
    const sectionId = typeof block.props.sectionId === "string" ? block.props.sectionId.trim() : "";
    const directMatch = sectionId === section.id || (Boolean(handle) && handle === section.handle);

    if (directMatch || depth >= maxReusableSectionDepth) {
      return count + (directMatch ? 1 : 0);
    }

    const referencedSection = sections.find((item) => item.handle === handle || item.id === sectionId);
    if (!referencedSection) return count;
    return count + countBlockSectionReferences(
      referencedSection.blocks,
      section,
      sections.filter((item) => item.id !== referencedSection.id),
      depth + 1,
    );
  }, 0);
}

function countSectionReferences(page: CmsPage, section: CmsSection, sections: CmsSection[] = []) {
  return countBlockSectionReferences(page.content.sections, section, sections);
}

function countSectionReferencesSection(section: CmsSection, target: CmsSection, sections: CmsSection[] = []) {
  return countBlockSectionReferences(
    section.blocks,
    target,
    sections.filter((candidate) => candidate.id !== section.id),
  );
}

function countBlockFormReferences(
  blocks: CmsSectionBlock[],
  form: CmsForm,
  sections: CmsSection[] = [],
  depth = 0,
): number {
  return blocks.reduce<number>((count, block) => {
    if (block.type === "form") {
      const formSlug = typeof block.props.formSlug === "string" ? block.props.formSlug.trim() : "";
      return count + (formSlug === form.slug ? 1 : 0);
    }
    if (block.type === "sectionRef" && depth < maxReusableSectionDepth) {
      const handle = typeof block.props.handle === "string" ? block.props.handle.trim() : "";
      const sectionId = typeof block.props.sectionId === "string" ? block.props.sectionId.trim() : "";
      const section = sections.find((item) => item.handle === handle || item.id === sectionId);
      if (!section) return count;
      return count + countBlockFormReferences(
        section.blocks,
        form,
        sections.filter((item) => item.id !== section.id),
        depth + 1,
      );
    }
    return count;
  }, 0);
}

function countFormReferences(page: CmsPage, form: CmsForm, sections: CmsSection[] = []) {
  return countBlockFormReferences(page.content.sections, form, sections);
}

function countSectionFormReferences(section: CmsSection, form: CmsForm, sections: CmsSection[] = []) {
  return countBlockFormReferences(
    section.blocks,
    form,
    sections.filter((candidate) => candidate.id !== section.id),
  );
}

function pageHasDependencyIssue(page: CmsPage, sections: CmsSection[], forms: CmsForm[], mediaItems: unknown[] = []) {
  return getPageDependencyIssues(page, sections, forms, mediaItems).length > 0;
}

const safeCmsHrefPattern = /^(\/(?!\/)|#|https:\/\/|http:\/\/|mailto:|tel:)/i;
const safeCmsAssetUrlPattern = /^(\/(?!\/)|https:\/\/|http:\/\/)/i;
const unsafeCmsHtmlPattern = /<\s*(script|style|iframe|object|embed|link|meta)\b|(\s+(on[a-z]+|style)\s*=)|((href|src|srcset|formaction|poster|xlink:href)\s*=\s*['"]?\s*(javascript:|data:text\/html|vbscript:))/i;
const unsafeCmsHtmlElementPattern = /<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi;
const unsafeCmsHtmlEventAttrPattern = /\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const unsafeCmsHtmlStyleAttrPattern = /\s+style\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const unsafeCmsHtmlUrlAttrPattern = /\s+(href|src|srcset|formaction|poster|xlink:href)\s*=\s*(['"]?)\s*(javascript:|data:text\/html|vbscript:)[^'"\s>]*/gi;

function isSafeCmsHref(value: unknown) {
  return typeof value === "string" && safeCmsHrefPattern.test(value.trim());
}

function safeCmsHrefValue(value: unknown) {
  return isSafeCmsHref(value) ? String(value).trim() : "";
}

function unsafeCmsHrefMessage(label: string, href: unknown) {
  if (typeof href !== "string" || !href.trim()) return "";
  return isSafeCmsHref(href)
    ? ""
    : `${label} uses an unsafe URL. Use a site path, #anchor, http(s), mailto, or tel link.`;
}

function isSafeCmsAssetUrl(value: unknown) {
  return typeof value === "string" && safeCmsAssetUrlPattern.test(value.trim());
}

function safeCmsAssetUrlValue(value: unknown) {
  return isSafeCmsAssetUrl(value) ? String(value).trim() : "";
}

function normalizedLocalCmsAssetPath(value: unknown) {
  const safeValue = safeCmsAssetUrlValue(value);
  if (!safeValue || !safeValue.startsWith("/") || safeValue.startsWith("//")) return "";
  return safeValue.split(/[?#]/)[0];
}

function localCmsAssetPathIsImportable(value: string) {
  return mediaImportExtensions.has(path.extname(value).toLowerCase());
}

function collectLocalCmsAssetUrls(value: unknown, urls = new Set<string>()) {
  if (typeof value === "string") {
    const directPath = normalizedLocalCmsAssetPath(value);
    if (directPath && localCmsAssetPathIsImportable(directPath)) {
      urls.add(directPath);
    }

    for (const match of value.match(/\/(?:cms-assets|assets|images|uploads)\/[^\s"'|),]+/g) ?? []) {
      const matchedPath = normalizedLocalCmsAssetPath(match);
      if (matchedPath && localCmsAssetPathIsImportable(matchedPath)) {
        urls.add(matchedPath);
      }
    }
    return urls;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectLocalCmsAssetUrls(item, urls));
    return urls;
  }

  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectLocalCmsAssetUrls(item, urls));
  }

  return urls;
}

function mediaLibraryHasLocalAsset(mediaItems: unknown[], value: unknown) {
  const path = normalizedLocalCmsAssetPath(value);
  if (!path) return true;

  return mediaItems.some((media) => {
    if (!media || typeof media !== "object") return false;
    const mediaUrl = (media as { url?: unknown }).url;
    return normalizedLocalCmsAssetPath(mediaUrl) === path;
  });
}

function missingMediaLibraryAssetMessage(label: string, url: unknown, mediaItems: unknown[]) {
  const path = normalizedLocalCmsAssetPath(url);
  if (!path || mediaLibraryHasLocalAsset(mediaItems, path)) return "";
  return `${label} uses a local asset that is not registered in Media. Use Import Assets or select a saved Media record.`;
}

function unsafeCmsAssetUrlMessage(label: string, url: unknown) {
  if (typeof url !== "string" || !url.trim()) return "";
  return isSafeCmsAssetUrl(url)
    ? ""
    : `${label} uses an unsafe asset URL. Use a site asset path or http(s) URL.`;
}

function legacyCmsAssetMessage(label: string, url: unknown) {
  return typeof url === "string" && url.includes("/images/gallery/frameless-showers/")
    ? `${label} uses a legacy starter image path. Use /cms-assets/... or a saved Media record.`
    : "";
}

function cmsHtmlHasUnsafeContent(value: unknown) {
  return typeof value === "string" && unsafeCmsHtmlPattern.test(value);
}

function sanitizeCmsHtml(value: unknown) {
  return typeof value === "string"
    ? value
        .replace(unsafeCmsHtmlElementPattern, "")
        .replace(unsafeCmsHtmlEventAttrPattern, "")
        .replace(unsafeCmsHtmlStyleAttrPattern, "")
        .replace(unsafeCmsHtmlUrlAttrPattern, "")
    : "";
}

function getBlockLinkSafetyIssues(block: CmsSectionBlock, blockIndex: number) {
  const props = block.props ?? {};
  const issues: Array<{ blockIndex: number; blockType: string; message: string }> = [];
  const hrefIssue = unsafeCmsHrefMessage(`${block.type} block`, props.href);
  const imageIssue =
    unsafeCmsAssetUrlMessage(`${block.type} image`, props.imageUrl) ||
    legacyCmsAssetMessage(`${block.type} image`, props.imageUrl);
  const videoIssue = unsafeCmsAssetUrlMessage(`${block.type} video`, props.videoUrl);
  const posterIssue =
    unsafeCmsAssetUrlMessage(`${block.type} poster`, props.posterUrl) ||
    legacyCmsAssetMessage(`${block.type} poster`, props.posterUrl);

  if (!supportedCmsSectionBlockTypes.has(block.type)) {
    issues.push({
      blockIndex,
      blockType: block.type,
      message: `Unsupported block type "${block.type}" will render as generic content. Choose a supported block type before publishing.`,
    });
  }
  if (hrefIssue) {
    issues.push({ blockIndex, blockType: block.type, message: hrefIssue });
  }
  if (imageIssue) {
    issues.push({ blockIndex, blockType: block.type, message: imageIssue });
  }
  if (videoIssue) {
    issues.push({ blockIndex, blockType: block.type, message: videoIssue });
  }
  if (posterIssue) {
    issues.push({ blockIndex, blockType: block.type, message: posterIssue });
  }

  if ((block.type === "linkGrid" || block.type === "serviceList" || block.type === "contactInfo" || block.type === "galleryGrid" || block.type === "mediaGallery") && Array.isArray(props.items)) {
    props.items.forEach((item, itemIndex) => {
      const parts = String(item).split("|").map((part) => part.trim());
      const href = block.type === "linkGrid" ? parts[2] : block.type === "serviceList" ? parts[1] : block.type === "contactInfo" ? parts[2] : "";
      const assetUrl = block.type === "galleryGrid" || block.type === "mediaGallery" ? parts[0] : "";
      const itemLabel = block.type === "serviceList" ? "Service list" : block.type === "contactInfo" ? "Contact info" : "Link grid";
      const issue =
        unsafeCmsHrefMessage(`${itemLabel} item ${itemIndex + 1}`, href) ||
        unsafeCmsAssetUrlMessage(`${block.type} item ${itemIndex + 1}`, assetUrl) ||
        legacyCmsAssetMessage(`${block.type} item ${itemIndex + 1}`, assetUrl);
      if (issue) {
        issues.push({ blockIndex, blockType: block.type, message: issue });
      }
    });
  }

  if (block.type === "image" && !safeCmsAssetUrlValue(props.imageUrl)) {
    issues.push({ blockIndex, blockType: block.type, message: "Image blocks need a safe image URL before publishing." });
  }

  if (block.type === "videoHero" && !safeCmsAssetUrlValue(props.videoUrl) && !safeCmsAssetUrlValue(props.posterUrl) && !safeCmsAssetUrlValue(props.imageUrl)) {
    issues.push({ blockIndex, blockType: block.type, message: "Video hero blocks need a safe videoUrl, posterUrl, or imageUrl before publishing." });
  }

  if (block.type === "galleryGrid") {
    const galleryItems = Array.isArray(props.items) ? props.items.map(String).filter(Boolean) : [];
    const safeGalleryItems = galleryItems.filter((item) => {
      const [url] = item.split("|").map((part) => part.trim());
      return Boolean(safeCmsAssetUrlValue(url));
    });

    if (safeGalleryItems.length === 0) {
      issues.push({ blockIndex, blockType: block.type, message: "Gallery grid blocks need at least one safe image item." });
    }
  }

  if (block.type === "recentPosts") {
    const count = props.count;
    const countNumber = Number(count);
    if (count !== undefined && count !== null && count !== "" && (!Number.isInteger(countNumber) || countNumber < 1 || countNumber > 6)) {
      issues.push({ blockIndex, blockType: block.type, message: "Recent posts blocks need count as a whole number from 1 to 6." });
    }
  }

  return issues;
}

function mediaItemIsGalleryReady(media: unknown) {
  if (!media || typeof media !== "object") return false;
  const value = media as {
    url?: unknown;
    name?: unknown;
    caption?: unknown;
    altText?: unknown;
    mimeType?: unknown;
    isGalleryReady?: unknown;
    category?: unknown;
    tags?: unknown;
  };
  const searchable = [value.url, value.name, value.caption, value.altText, value.category, ...(Array.isArray(value.tags) ? value.tags : [])]
    .filter((item): item is string => typeof item === "string")
    .join(" ")
    .toLowerCase();
  return (
    typeof value.mimeType === "string" &&
    value.mimeType.startsWith("image/") &&
    (value.isGalleryReady === true || searchable.includes("gallery"))
  );
}

function mediaItemMatchesGalleryCategory(media: unknown, category: unknown) {
  if (!media || typeof media !== "object") return false;
  const normalized = typeof category === "string" ? category.trim().toLowerCase() : "";
  if (!normalized) return true;

  const value = media as {
    url?: unknown;
    name?: unknown;
    caption?: unknown;
    altText?: unknown;
    category?: unknown;
    tags?: unknown;
  };
  const searchable = [value.url, value.name, value.caption, value.altText, value.category, ...(Array.isArray(value.tags) ? value.tags : [])]
    .filter((item): item is string => typeof item === "string")
    .join(" ")
    .toLowerCase();
  const directCategory = typeof value.category === "string" && value.category.trim().toLowerCase() === normalized;
  const directTag =
    Array.isArray(value.tags) &&
    value.tags.some((tag) => typeof tag === "string" && tag.trim().toLowerCase() === normalized);
  if (directCategory || directTag) return true;
  if (normalized === "frameless-showers") return searchable.includes("frameless") || searchable.includes("shower");
  if (normalized === "commercial-glass") return searchable.includes("commercial") || searchable.includes("storefront");
  return searchable.includes(normalized.replaceAll("-", " ")) || searchable.includes(normalized);
}

function getCmsBlockDependencyIssues(blocks: CmsSectionBlock[], sections: CmsSection[], forms: CmsForm[], mediaItems: unknown[] = []) {
  const sectionIds = new Set(sections.map((section) => section.id));
  const sectionHandles = new Set(sections.map((section) => section.handle));
  const formBySlug = new Map(forms.map((form) => [form.slug, form]));
  const hasGalleryMediaForBlock = (block: CmsSectionBlock) =>
    mediaItems.some((media) => mediaItemIsGalleryReady(media) && mediaItemMatchesGalleryCategory(media, block.props.category));

  const withContext = (
    issues: Array<{ blockIndex: number; blockType: string; message: string }>,
    context: string,
  ) =>
    issues.map((issue) => ({
      ...issue,
      message: context ? `${context}: ${issue.message}` : issue.message,
    }));

  const checkBlock = (
    block: CmsSectionBlock,
    index: number,
    context = "",
    depth = 0,
    visitedSectionIds = new Set<string>(),
  ): Array<{ blockIndex: number; blockType: string; message: string }> => {
    const linkSafetyIssues = withContext(getBlockLinkSafetyIssues(block, index), context);
    const props = block.props ?? {};
    const assetLibraryIssues = [
      missingMediaLibraryAssetMessage(`${block.type} image`, props.imageUrl, mediaItems),
      missingMediaLibraryAssetMessage(`${block.type} video`, props.videoUrl, mediaItems),
      missingMediaLibraryAssetMessage(`${block.type} poster`, props.posterUrl, mediaItems),
    ]
      .filter(Boolean)
      .map((message) => ({
        blockIndex: index,
        blockType: block.type,
        message: context ? `${context}: ${message}` : message,
      }));

    if (block.type === "sectionRef") {
      const sectionId = typeof block.props.sectionId === "string" ? block.props.sectionId.trim() : "";
      const handle = typeof block.props.handle === "string" ? block.props.handle.trim() : "";
      if (!sectionId && !handle) {
        return [
          ...linkSafetyIssues,
          ...assetLibraryIssues,
          {
            blockIndex: index,
            blockType: block.type,
            message: `${context ? `${context}: ` : ""}Reusable section reference is missing a handle or section ID.`,
          },
        ];
      }
      if (!((sectionId && sectionIds.has(sectionId)) || (handle && sectionHandles.has(handle)))) {
        return [
          ...linkSafetyIssues,
          ...assetLibraryIssues,
          {
            blockIndex: index,
            blockType: block.type,
            message: `${context ? `${context}: ` : ""}Reusable section "${handle || sectionId}" is not saved in the Section Library.`,
          },
        ];
      }
      const section = sections.find((item) => item.id === sectionId || item.handle === handle);
      if (section && visitedSectionIds.has(section.id)) {
        return [
          ...linkSafetyIssues,
          ...assetLibraryIssues,
          {
            blockIndex: index,
            blockType: block.type,
            message: `${context ? `${context}: ` : ""}Reusable section "${section.name}" creates a circular reference.`,
          },
        ];
      }
      if (depth >= maxReusableSectionDepth) {
        return [
          ...linkSafetyIssues,
          ...assetLibraryIssues,
          {
            blockIndex: index,
            blockType: block.type,
            message: `${context ? `${context}: ` : ""}Reusable section nesting is deeper than ${maxReusableSectionDepth} levels and will not render completely.`,
          },
        ];
      }
      const nextVisitedSectionIds = new Set(visitedSectionIds);
      if (section) nextVisitedSectionIds.add(section.id);
      const reusableIssues = section
        ? section.blocks.flatMap((sectionBlock, sectionIndex) =>
            checkBlock(sectionBlock, index, `Reusable section "${section.name}" block ${sectionIndex + 1}`, depth + 1, nextVisitedSectionIds),
          )
        : [];
      return [...linkSafetyIssues, ...assetLibraryIssues, ...reusableIssues];
    }

    if (block.type === "form") {
      const formSlug = typeof block.props.formSlug === "string" ? block.props.formSlug.trim() : "";
      if (!formSlug) {
        return [
          ...linkSafetyIssues,
          ...assetLibraryIssues,
          { blockIndex: index, blockType: block.type, message: `${context ? `${context}: ` : ""}Form block is missing a form slug.` },
        ];
      }
      const form = formBySlug.get(formSlug);
      if (!form) {
        return [
          ...linkSafetyIssues,
          ...assetLibraryIssues,
          { blockIndex: index, blockType: block.type, message: `${context ? `${context}: ` : ""}Form "${formSlug}" is not saved in the Form Builder.` },
        ];
      }
      if (!form.isActive) {
        return [
          ...linkSafetyIssues,
          ...assetLibraryIssues,
          { blockIndex: index, blockType: block.type, message: `${context ? `${context}: ` : ""}Form "${formSlug}" is inactive and will not load on public pages.` },
        ];
      }
      const issues = getFormActivationIssues(form);
      if (issues.length > 0) {
        return [
          ...linkSafetyIssues,
          ...assetLibraryIssues,
          { blockIndex: index, blockType: block.type, message: `${context ? `${context}: ` : ""}Form "${formSlug}" has lead capture issues: ${issues.join(" ")}` },
        ];
      }
    }

    if (block.type === "galleryGrid") {
      const galleryItems = Array.isArray(block.props.items)
        ? block.props.items.map(String).filter(Boolean)
        : [];
      const galleryMediaIssues = galleryItems.flatMap((item, itemIndex) => {
        const [url] = item.split("|").map((part) => part.trim());
        const message = missingMediaLibraryAssetMessage(`${block.type} item ${itemIndex + 1}`, url, mediaItems);
        return message
          ? [{ blockIndex: index, blockType: block.type, message: context ? `${context}: ${message}` : message }]
          : [];
      });
      if (galleryMediaIssues.length > 0) {
        return [...linkSafetyIssues, ...assetLibraryIssues, ...galleryMediaIssues];
      }
    }

    if (block.type === "mediaGallery") {
      const fallbackItems = Array.isArray(block.props.items)
        ? block.props.items.map(String).filter(Boolean)
        : [];
      const fallbackMediaIssues = fallbackItems.flatMap((item, itemIndex) => {
        const [url] = item.split("|").map((part) => part.trim());
        const message = missingMediaLibraryAssetMessage(`${block.type} fallback item ${itemIndex + 1}`, url, mediaItems);
        return message
          ? [{ blockIndex: index, blockType: block.type, message: context ? `${context}: ${message}` : message }]
          : [];
      });
      if (!hasGalleryMediaForBlock(block) && fallbackItems.length === 0) {
        return [
          ...linkSafetyIssues,
          ...assetLibraryIssues,
          ...fallbackMediaIssues,
          {
            blockIndex: index,
            blockType: block.type,
            message: `${context ? `${context}: ` : ""}Media gallery blocks need Gallery-ready media or fallback image items.`,
          },
        ];
      }
      if (fallbackMediaIssues.length > 0) {
        return [...linkSafetyIssues, ...assetLibraryIssues, ...fallbackMediaIssues];
      }
    }

    return [...linkSafetyIssues, ...assetLibraryIssues];
  };

  return blocks.flatMap((block, index) => checkBlock(block, index));
}

function getPageDependencyIssues(page: CmsPage, sections: CmsSection[], forms: CmsForm[], mediaItems: unknown[] = []) {
  return getCmsBlockDependencyIssues(page.content.sections, sections, forms, mediaItems);
}

function getSectionDependencyIssues(section: CmsSection, sections: CmsSection[], forms: CmsForm[], mediaItems: unknown[] = []) {
  const peerSections = sections.filter((candidate) => candidate.id !== section.id);
  return getCmsBlockDependencyIssues(section.blocks, peerSections, forms, mediaItems);
}

function getSectionSaveIssues(section: Partial<Pick<CmsSection, "name" | "handle" | "category" | "blocks">>) {
  const issues: Array<{ blockIndex: number; blockType: string; message: string }> = [];
  const handle = section.handle?.trim();

  if (section.name !== undefined && !section.name?.trim()) {
    issues.push({ blockIndex: -1, blockType: "section", message: "Section name is required." });
  }
  if (section.handle !== undefined && !handle) {
    issues.push({ blockIndex: -1, blockType: "section", message: "Section handle is required." });
  } else if (handle && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
    issues.push({ blockIndex: -1, blockType: "section", message: "Section handle should use lowercase letters, numbers, and hyphens only." });
  }
  if (section.category !== undefined && !section.category?.trim()) {
    issues.push({ blockIndex: -1, blockType: "section", message: "Section category is required." });
  }
  if (section.blocks !== undefined && !Array.isArray(section.blocks)) {
    issues.push({ blockIndex: -1, blockType: "section", message: "Section blocks must be an array." });
  }

  return issues;
}

function getPageSaveIssues(page: Partial<Pick<CmsPage, "title" | "slug" | "status" | "seo">>) {
  const issues: Array<{ blockIndex: number; blockType: string; message: string }> = [];
  const slug = page.slug?.trim();
  const status = page.status?.trim();

  if (page.title !== undefined && !page.title?.trim()) {
    issues.push({ blockIndex: -1, blockType: "content", message: "Page title is required." });
  }
  if (page.slug !== undefined && !slug) {
    issues.push({ blockIndex: -1, blockType: "route", message: "Page slug is required." });
  } else if (slug) {
    const slugRouteIssue = getPageSlugRouteIssue(slug);
    if (slugRouteIssue) {
      issues.push({ blockIndex: -1, blockType: "route", message: slugRouteIssue });
    }
  }
  if (status && !pageStatuses.has(status)) {
    issues.push({ blockIndex: -1, blockType: "content", message: `Page status "${status}" is not supported.` });
  }
  if (page.seo?.canonicalUrl?.trim() && seoCanonicalIssue(page.seo.canonicalUrl)) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "Canonical URL must be a valid http or https URL before saving." });
  }
  if (page.seo?.ogImage?.trim() && !safeCmsAssetUrlValue(page.seo.ogImage)) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "OG image must use a safe site asset path or http(s) URL before saving." });
  }

  return issues;
}

async function getPagePublishIssues(page: CmsPage) {
  const [sections, forms, mediaItems] = await Promise.all([
    storage.listCms("sections"),
    storage.listCms("forms"),
    storage.listCms("media"),
  ]);
  const issues = getPageDependencyIssues(page, sections, forms, mediaItems);

  if (!primaryCmsRouteSlugSet.has(page.slug) && page.content.sections.length === 0) {
    issues.push({
      blockIndex: -1,
      blockType: "content",
      message: "Custom CMS pages need at least one section before publishing.",
    });
  }
  if (!page.title?.trim()) {
    issues.push({ blockIndex: -1, blockType: "content", message: "Title is required before publishing." });
  }
  if (!page.slug?.trim()) {
    issues.push({ blockIndex: -1, blockType: "content", message: "Slug is required before publishing." });
  } else {
    const slugRouteIssue = getPageSlugRouteIssue(page.slug);
    if (slugRouteIssue) {
      issues.push({ blockIndex: -1, blockType: "route", message: slugRouteIssue });
    }
  }
  if (!page.seo.metaTitle?.trim()) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "SEO title is required before publishing." });
  }
  if (!page.seo.metaDescription?.trim()) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "SEO description is required before publishing." });
  }
  if (!page.seo.canonicalUrl?.trim()) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "Canonical URL is required before publishing." });
  }
  if (seoCanonicalIssue(page.seo.canonicalUrl ?? "")) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "Canonical URL must be a valid http or https URL before publishing." });
  }
  if (page.seo.ogImage?.trim() && !safeCmsAssetUrlValue(page.seo.ogImage)) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "OG image must use a safe site asset path or http(s) URL before publishing." });
  }

  return issues;
}

type BlogPublishCandidate = {
  title?: string | null;
  slug?: string | null;
  status?: string | null;
  excerpt?: string | null;
  body?: string | null;
  featuredImageId?: string | null;
  seo?: CmsBlogPost["seo"];
};

async function getBlogPostSaveIssues(post: BlogPublishCandidate) {
  const issues: Array<{ blockIndex: number; blockType: string; message: string }> = [];
  const slug = post.slug?.trim();
  const status = post.status?.trim();
  const mediaItems = await storage.listCms("media");

  if (post.title !== undefined && !post.title?.trim()) {
    issues.push({ blockIndex: -1, blockType: "content", message: "Blog title is required." });
  }
  if (post.slug !== undefined && !slug) {
    issues.push({ blockIndex: -1, blockType: "content", message: "Blog slug is required." });
  }
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    issues.push({ blockIndex: -1, blockType: "content", message: "Blog slug should use lowercase letters, numbers, and hyphens only." });
  }
  if (status && !blogPostStatuses.has(status)) {
    issues.push({ blockIndex: -1, blockType: "content", message: `Blog status "${status}" is not supported.` });
  }
  if (post.seo?.canonicalUrl?.trim() && seoCanonicalIssue(post.seo.canonicalUrl)) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "Canonical URL must be a valid http or https URL before saving." });
  }
  if (post.seo?.ogImage?.trim() && !safeCmsAssetUrlValue(post.seo.ogImage)) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "OG image must use a safe site asset path or http(s) URL before saving." });
  }
  const ogImageMediaMessage = missingMediaLibraryAssetMessage("OG image", post.seo?.ogImage, mediaItems);
  if (ogImageMediaMessage) {
    issues.push({ blockIndex: -1, blockType: "media", message: ogImageMediaMessage });
  }
  if (post.featuredImageId) {
    const featuredImage = mediaItems.find((media) => media.id === post.featuredImageId);
    if (!featuredImage?.mimeType.startsWith("image/")) {
      issues.push({ blockIndex: -1, blockType: "media", message: "Featured image must reference an image media item." });
    }
  }

  return issues;
}

async function getBlogPostPublishIssues(post: BlogPublishCandidate) {
  const issues: Array<{ blockIndex: number; blockType: string; message: string }> = [];
  const mediaItems = await storage.listCms("media");
  if (!post.title?.trim()) {
    issues.push({ blockIndex: -1, blockType: "content", message: "Title is required before publishing." });
  }
  if (!post.slug?.trim()) {
    issues.push({ blockIndex: -1, blockType: "content", message: "Slug is required before publishing." });
  }
  if (!post.excerpt?.trim()) {
    issues.push({ blockIndex: -1, blockType: "content", message: "Excerpt is required before publishing." });
  }
  if (!post.body?.trim()) {
    issues.push({ blockIndex: -1, blockType: "content", message: "Body content is required before publishing." });
  }
  if (!post.seo?.metaTitle?.trim()) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "SEO title is required before publishing." });
  }
  if (!post.seo?.metaDescription?.trim()) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "SEO description is required before publishing." });
  }
  if (!post.seo?.canonicalUrl?.trim()) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "Canonical URL is required before publishing." });
  }
  if (seoCanonicalIssue(post.seo?.canonicalUrl ?? "")) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "Canonical URL must be a valid http or https URL before publishing." });
  }
  if (post.seo?.ogImage?.trim() && !safeCmsAssetUrlValue(post.seo.ogImage)) {
    issues.push({ blockIndex: -1, blockType: "seo", message: "OG image must use a safe site asset path or http(s) URL before publishing." });
  }
  const ogImageMediaMessage = missingMediaLibraryAssetMessage("OG image", post.seo?.ogImage, mediaItems);
  if (ogImageMediaMessage) {
    issues.push({ blockIndex: -1, blockType: "media", message: ogImageMediaMessage });
  }

  const safeOgImage = safeCmsAssetUrlValue(post.seo?.ogImage ?? "");
  if (!safeOgImage) {
    const featuredImage = post.featuredImageId ? mediaItems.find((media) => media.id === post.featuredImageId) : null;
    if (!featuredImage?.mimeType.startsWith("image/")) {
      issues.push({ blockIndex: -1, blockType: "media", message: "Add a featured image or OG image before publishing." });
    }
  }

  return issues;
}

function formLeadReadinessIssues(fields: CmsForm["fields"]) {
  const names = new Set(fields.map((field) => field.name.trim()));
  const issues: string[] = [];
  if (!names.has("email") && !names.has("phone")) {
    issues.push("missing contact field");
  }
  if (!names.has("message")) {
    issues.push("missing project details");
  }
  return issues;
}

function getFormFieldIssues(fields: CmsForm["fields"]) {
  const issues: string[] = [];
  const ids = fields.map((field) => field.id.trim()).filter(Boolean);
  const names = fields.map((field) => field.name.trim()).filter(Boolean);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);

  fields.forEach((field, index) => {
    const label = field.label.trim() || `Field ${index + 1}`;
    if (!field.id.trim()) issues.push(`${label} needs a field ID.`);
    if (!field.name.trim()) issues.push(`${label} needs a field name.`);
    if (!field.label.trim()) issues.push(`Field ${index + 1} needs a label.`);
    if (field.name.trim() && !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(field.name.trim())) {
      issues.push(`${label} field name should start with a letter and use only letters, numbers, hyphens, or underscores.`);
    }
    if (!supportedFormFieldTypes.has(field.type)) {
      issues.push(`${label} uses unsupported field type "${field.type}".`);
    }
    if (field.type === "select" && (!field.options || field.options.map((option) => option.trim()).filter(Boolean).length === 0)) {
      issues.push(`${label} select fields need at least one option.`);
    }
  });

  if (duplicateIds.length > 0) {
    issues.push(`Duplicate field IDs: ${Array.from(new Set(duplicateIds)).join(", ")}.`);
  }
  if (duplicateNames.length > 0) {
    issues.push(`Duplicate field names: ${Array.from(new Set(duplicateNames)).join(", ")}.`);
  }

  return issues;
}

function getFormSaveIssues(form: Partial<Pick<CmsForm, "name" | "slug" | "fields" | "notificationEmail" | "isActive">>) {
  const issues: string[] = [];
  const name = form.name?.trim();
  const slug = form.slug?.trim();
  const notificationEmail = form.notificationEmail?.trim();
  const fields = form.fields ?? [];

  if (form.name !== undefined && !name) {
    issues.push("Form name is required.");
  }
  if (form.slug !== undefined && !slug) {
    issues.push("Form slug is required.");
  }
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    issues.push("Form slug should use lowercase letters, numbers, and hyphens only.");
  }
  if (notificationEmail && !emailPattern.test(notificationEmail)) {
    issues.push("Notification email must be valid.");
  }

  issues.push(...getFormFieldIssues(fields));
  if (form.isActive) {
    issues.push(...formLeadReadinessIssues(fields));
  }

  return issues;
}

function getFormActivationIssues(form: Pick<CmsForm, "fields" | "isActive">) {
  return form.isActive ? [...getFormFieldIssues(form.fields), ...formLeadReadinessIssues(form.fields)] : [];
}

function normalizeCmsFormFields(fields: CmsFormField[]) {
  return fields.map((field) => ({
    ...field,
    id: field.id.trim(),
    name: field.name.trim(),
    label: field.label.trim(),
    placeholder: field.placeholder?.trim() || undefined,
    options: field.options?.map((option) => option.trim()).filter(Boolean),
  }));
}

const cmsUniqueFields: Partial<Record<CmsCollectionName, Array<{ field: string; label: string; caseInsensitive?: boolean }>>> = {
  pages: [{ field: "slug", label: "Page slug" }],
  forms: [{ field: "slug", label: "Form slug" }],
  blogPosts: [{ field: "slug", label: "Blog post slug" }],
  sections: [{ field: "handle", label: "Section handle" }],
  documentation: [{ field: "slug", label: "Documentation slug" }],
  systemUsers: [{ field: "email", label: "System user email", caseInsensitive: true }],
  settings: [{ field: "key", label: "Setting key" }],
};

const colorPaletteTokenFields = ["primary", "secondary", "accent", "background", "foreground"] as const;

function isHslCssToken(value: unknown) {
  if (typeof value !== "string") return false;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return false;

  const [, hue, saturation, lightness] = match.map(Number);
  return hue >= 0 && hue <= 360 && saturation >= 0 && saturation <= 100 && lightness >= 0 && lightness <= 100;
}

function getColorPaletteTokenIssues(value: Partial<CmsColorPalette>) {
  const issues: string[] = [];
  if (typeof value.name === "string" && !value.name.trim()) {
    issues.push("Palette name is required.");
  }
  if (!value.tokens) return issues;
  const tokens = value.tokens as Record<string, unknown>;

  colorPaletteTokenFields
    .filter((field) => !isHslCssToken(tokens[field]))
    .forEach((field) => {
      issues.push(`${field} must be an HSL token like "195 75% 38%".`);
    });

  return issues;
}

function isSafeFontFamilyName(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9 -]{0,79}$/.test(value.trim());
}

function isSafeCssSizeValue(value: unknown) {
  return typeof value === "string" && /^(?:0|(?:\d+(?:\.\d+)?)(?:rem|em|px|%))$/.test(value.trim());
}

function getTypographySaveIssues(value: Partial<CmsTypography>) {
  const issues: string[] = [];
  if (typeof value.name === "string" && !value.name.trim()) {
    issues.push("Typography name is required.");
  }
  if (value.headingFont !== undefined && !isSafeFontFamilyName(value.headingFont)) {
    issues.push("Heading font can only use letters, numbers, spaces, and hyphens.");
  }
  if (value.bodyFont !== undefined && !isSafeFontFamilyName(value.bodyFont)) {
    issues.push("Body font can only use letters, numbers, spaces, and hyphens.");
  }
  if (value.scale && typeof value.scale === "object") {
    Object.entries(value.scale)
      .filter(([key]) => ["h1", "h2", "h3", "body", "small"].includes(key))
      .forEach(([key, size]) => {
        if (!isSafeCssSizeValue(size)) {
          issues.push(`${key} scale must be a CSS size like "3rem", "18px", or "100%".`);
        }
      });
  }
  return issues;
}

function normalizeUniqueValue(value: unknown, caseInsensitive = false) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return caseInsensitive ? normalized.toLowerCase() : normalized;
}

function slugifyCmsPath(value: string) {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("/");
}

function slugifyCmsToken(value: string) {
  return slugifyCmsPath(value).replace(/\//g, "-");
}

function getPageSlugRouteIssue(slug: string) {
  const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  const [root] = cleanSlug.split("/");
  if (!cleanSlug) return "Slug is required before publishing.";
  if (["admin", "api", "assets", "cms-assets", "images", "page"].includes(root)) {
    return `The "${root}" path is reserved for system routes or static assets.`;
  }
  if (root === "blog" && cleanSlug !== "blog") {
    return "Use Blog Posts for /blog/... URLs instead of CMS Pages.";
  }
  return "";
}

function normalizeCmsWriteValue(collection: CmsCollectionName, value: Record<string, unknown>) {
  const next = { ...value };
  if (["pages", "blogPosts", "documentation"].includes(collection) && typeof next.slug === "string") {
    next.slug = slugifyCmsPath(next.slug);
  }
  if (collection === "pages") {
    ["title", "excerpt"].forEach((field) => {
      if (typeof next[field] === "string") next[field] = next[field].trim();
    });
  }
  if (collection === "forms" && typeof next.slug === "string") {
    next.slug = slugifyCmsToken(next.slug);
  }
  if (collection === "documentation") {
    ["title", "category", "body"].forEach((field) => {
      if (typeof next[field] === "string") next[field] = next[field].trim();
    });
  }
  if (collection === "forms") {
    ["name", "description", "notificationEmail"].forEach((field) => {
      if (typeof next[field] === "string") next[field] = next[field].trim();
    });
    if (Array.isArray(next.fields)) {
      next.fields = normalizeCmsFormFields(next.fields as CmsFormField[]);
    }
  }
  if (collection === "blogPosts") {
    ["title", "excerpt", "body", "category"].forEach((field) => {
      if (typeof next[field] === "string") next[field] = next[field].trim();
    });
    if (Array.isArray(next.tags)) {
      next.tags = next.tags.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean);
    }
  }
  if (collection === "media") {
    ["name", "url", "mimeType", "altText", "caption", "category"].forEach((field) => {
      if (typeof next[field] === "string") next[field] = next[field].trim();
    });
    if (Array.isArray(next.tags)) {
      next.tags = next.tags.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean);
    }
  }
  if (collection === "branding") {
    ["siteName", "tagline", "logoUrl", "faviconUrl", "phone", "email", "address"].forEach((field) => {
      if (typeof next[field] === "string") next[field] = next[field].trim();
    });
    if (next.socialLinks && typeof next.socialLinks === "object" && !Array.isArray(next.socialLinks)) {
      next.socialLinks = Object.fromEntries(
        Object.entries(next.socialLinks).map(([label, href]) => [
          label.trim(),
          typeof href === "string" ? href.trim() : href,
        ]),
      );
    }
  }
  if (collection === "colorPalettes") {
    if (typeof next.name === "string") next.name = next.name.trim();
    if (next.tokens && typeof next.tokens === "object" && !Array.isArray(next.tokens)) {
      next.tokens = Object.fromEntries(
        Object.entries(next.tokens).map(([key, token]) => [
          key.trim(),
          typeof token === "string" ? token.trim() : token,
        ]),
      );
    }
  }
  if (collection === "typography") {
    ["name", "headingFont", "bodyFont"].forEach((field) => {
      if (typeof next[field] === "string") next[field] = next[field].trim();
    });
    if (next.scale && typeof next.scale === "object" && !Array.isArray(next.scale)) {
      next.scale = Object.fromEntries(
        Object.entries(next.scale).map(([key, size]) => [
          key.trim(),
          typeof size === "string" ? size.trim() : size,
        ]),
      );
    }
  }
  if (collection === "sections" && typeof next.handle === "string") {
    next.handle = slugifyCmsToken(next.handle);
  }
  if (collection === "sections") {
    ["name", "category"].forEach((field) => {
      if (typeof next[field] === "string") next[field] = next[field].trim();
    });
  }
  if ((collection === "menus" || collection === "sidebars") && typeof next.location === "string") {
    next.location = next.location.trim();
  }
  if ((collection === "menus" || collection === "sidebars") && typeof next.name === "string") {
    next.name = next.name.trim();
  }
  if (collection === "settings") {
    if (typeof next.key === "string") next.key = next.key.trim();
    if (typeof next.group === "string") next.group = next.group.trim();
    if (next.key === "site" && next.value && typeof next.value === "object" && !Array.isArray(next.value)) {
      next.value = normalizeSiteSettingValueForSave(next.value as Record<string, unknown>);
    }
  }
  if (collection === "systemBackups") {
    ["name", "status"].forEach((field) => {
      if (typeof next[field] === "string") next[field] = next[field].trim();
    });
    if (typeof next.createdBy === "string") {
      next.createdBy = next.createdBy.trim() || null;
    }
  }
  if (collection === "systemUsers") {
    ["name", "role", "status"].forEach((field) => {
      if (typeof next[field] === "string") next[field] = next[field].trim();
    });
    if (typeof next.email === "string") {
      next.email = next.email.trim().toLowerCase();
    }
  }
  return next;
}

async function getCmsUniqueConflict(collection: CmsCollectionName, value: Record<string, unknown>, excludeId?: string) {
  const rules = cmsUniqueFields[collection] ?? [];
  if (rules.length === 0) return null;

  const records = await storage.listCms(collection);
  for (const rule of rules) {
    if (!(rule.field in value)) continue;
    const candidateValue = normalizeUniqueValue(value[rule.field], rule.caseInsensitive);
    if (!candidateValue) continue;

    const conflict = records.find((record) => {
      if (record.id === excludeId) return false;
      const recordValue = normalizeUniqueValue((record as Record<string, unknown>)[rule.field], rule.caseInsensitive);
      return recordValue === candidateValue;
    });

    if (conflict) {
      return {
        field: rule.field,
        value: candidateValue,
        message: `${rule.label} "${candidateValue}" is already in use.`,
      };
    }
  }

  return null;
}

const flattenMenuItems = (items: CmsMenuItem[]): CmsMenuItem[] =>
  items.flatMap((item) => [item, ...(item.children ? flattenMenuItems(item.children) : [])]);

function getMenuSaveIssues(menu: Partial<Pick<CmsMenu, "name" | "items" | "location">>) {
  const items = menu.items ?? [];
  const flattened = flattenMenuItems(items);
  const ids = flattened.map((item) => item.id.trim()).filter(Boolean);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const issues: string[] = [];

  if (menu.name !== undefined && !menu.name?.trim()) {
    issues.push("Menu name is required.");
  }
  if (menu.location !== undefined && !menu.location?.trim()) {
    issues.push("Menu location is required.");
  }
  if (flattened.some((item) => !item.label?.trim() || !item.href?.trim())) {
    issues.push("Every menu item needs a label and URL.");
  }
  flattened.forEach((item) => {
    const hrefIssue = unsafeCmsHrefMessage(item.label || item.href || "Menu item", item.href);
    if (hrefIssue) issues.push(hrefIssue);
  });
  if (duplicateIds.length > 0) {
    issues.push(`Duplicate menu IDs: ${Array.from(new Set(duplicateIds)).join(", ")}.`);
  }

  return Array.from(new Set(issues));
}

function getMenuActivationIssues(menu: Pick<CmsMenu, "items" | "location" | "isActive">) {
  if (!menu.isActive) return [];

  const flattened = flattenMenuItems(menu.items);
  const issues: string[] = [];

  if (!menu.location.trim()) {
    issues.push("Active menus need a location.");
  }
  if (menu.items.length === 0) {
    issues.push("Active menus should include at least one link.");
  }
  if (menu.location === "header") {
    const hrefs = new Set(flattened.map((item) => item.href.trim()));
    if (!hrefs.has("/")) issues.push("Header navigation should include Home.");
    if (!hrefs.has("/contact")) issues.push("Header navigation should include Contact.");
    if (!menu.items.some((item) => item.href.trim() === "/services" || item.children?.some((child) => child.href.trim().startsWith("/services")))) {
      issues.push("Header navigation should include Services or service child links.");
    }
  }

  return issues;
}

function decodeCmsPath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function menuHrefToPageSlug(href: string) {
  const [pathOnly] = href.split("#");
  const path = pathOnly.split("?")[0];
  if (!path || path === "/") return "home";
  if (path.startsWith("/page/")) return decodeCmsPath(path.replace(/^\/page\//, ""));
  return decodeCmsPath(path.replace(/^\//, ""));
}

function cmsBlogPostUrl(slug: string) {
  return `/blog/${encodeURIComponent(slug)}`;
}

function cmsBlogCategoryUrl(category: string) {
  return `/blog/category/${encodeURIComponent(category)}`;
}

function cmsBlogTagUrl(tag: string) {
  return `/blog/tag/${encodeURIComponent(tag)}`;
}

function parseBlogArchiveHref(href: string) {
  const [pathOnly] = href.split(/[?#]/);
  const match = pathOnly.match(/^\/blog\/(category|tag)\/(.+)$/);
  if (!match) return null;
  return {
    kind: match[1] as "category" | "tag",
    value: decodeCmsPath(match[2] ?? "").trim(),
  };
}

function sidebarPageSlugFromLocation(location: string) {
  if (location.startsWith("/blog/")) return "";
  if (location.startsWith("page:")) return location.replace(/^page:/, "").trim();
  if (location.startsWith("/")) return menuHrefToPageSlug(location);
  return location.trim();
}

function sidebarPostSlugFromLocation(location: string) {
  if (location.startsWith("blog:") || location.startsWith("post:")) {
    return location.replace(/^(blog|post):/, "").trim();
  }
  if (location.startsWith("/blog/")) {
    return decodeCmsPath(location.replace(/^\/blog\//, "").split(/[?#]/)[0] ?? "").trim();
  }
  return "";
}

function getMenuReadinessIssues(menu: Pick<CmsMenu, "items" | "location" | "isActive">, pages: CmsPage[] = [], posts: CmsBlogPost[] = []) {
  const issues = [...getMenuSaveIssues(menu), ...getMenuActivationIssues(menu)];
  if (!menu.isActive) return issues;

  const publishedPageSlugs = new Set(pages.filter((page) => page.status === "published").map((page) => page.slug));
  const pageSlugs = new Set(pages.map((page) => page.slug));
  const publishedPostSlugs = new Set(posts.filter((post) => post.status === "published").map((post) => post.slug));
  const postSlugs = new Set(posts.map((post) => post.slug));

  flattenMenuItems(menu.items).forEach((item) => {
    const href = item.href.trim();
    if (!href || href.startsWith("/#") || href.startsWith("#") || /^(https?:|mailto:|tel:)/i.test(href)) return;

    const archiveHref = parseBlogArchiveHref(href);
    if (archiveHref) {
      const hasMatchingPublishedPost = posts.some((post) => {
        if (post.status !== "published") return false;
        return archiveHref.kind === "category"
          ? post.category === archiveHref.value
          : post.tags.includes(archiveHref.value);
      });
      if (!hasMatchingPublishedPost) {
        issues.push(`${item.label || href} links to a blog ${archiveHref.kind} archive with no published posts.`);
      }
      return;
    }

    if (href.startsWith("/blog/")) {
      const slug = decodeCmsPath(href.replace(/^\/blog\//, "").split(/[?#]/)[0] ?? "");
      if (!postSlugs.has(slug)) {
        issues.push(`${item.label || href} links to missing blog post "${slug}".`);
      } else if (!publishedPostSlugs.has(slug)) {
        issues.push(`${item.label || href} links to draft blog post "${slug}".`);
      }
      return;
    }

    const slug = menuHrefToPageSlug(href);
    if (!pageSlugs.has(slug)) {
      if (primaryCmsRouteSlugSet.has(slug)) return;
      issues.push(`${item.label || href} links to missing CMS page "${slug}".`);
    } else if (!publishedPageSlugs.has(slug)) {
      issues.push(`${item.label || href} links to draft CMS page "${slug}".`);
    }
  });

  return Array.from(new Set(issues));
}

function getMenuPageUsage(slug: string, menus: CmsMenu[]) {
  return menus.flatMap((menu) => {
    if (!menu.isActive) return [];
    return flattenMenuItems(menu.items)
      .filter((item) => {
        const href = item.href.trim();
        if (!href || href.startsWith("#") || /^(https?:|mailto:|tel:)/i.test(href)) return false;
        return menuHrefToPageSlug(href) === slug;
      })
      .map((item) => ({
        type: "menu",
        title: `${menu.name}: ${item.label || item.href}`,
        path: item.href,
      }));
  });
}

function getMenuBlogPostUsage(slug: string, menus: CmsMenu[]) {
  return menus.flatMap((menu) => {
    if (!menu.isActive) return [];
    return flattenMenuItems(menu.items)
      .filter((item) => {
        const href = item.href.trim();
        if (!href.startsWith("/blog/")) return false;
        const linkedSlug = decodeCmsPath(href.replace(/^\/blog\//, "").split(/[?#]/)[0] ?? "");
        return linkedSlug === slug;
      })
      .map((item) => ({
        type: "menu",
        title: `${menu.name}: ${item.label || item.href}`,
        path: item.href,
      }));
  });
}

function getPublishedBlogArchiveEntries(posts: CmsBlogPost[], options: { includeCmsRoutes?: boolean } = {}) {
  const includeCmsRoutes = options.includeCmsRoutes ?? true;
  const categories = new Map<string, Date>();
  const tags = new Map<string, Date>();

  posts
    .filter((post) => postIsPublicSitemapCandidate(post, { includeCmsRoutes }))
    .forEach((post) => {
      const category = post.category?.trim();
      if (category) {
        const previous = categories.get(category);
        if (!previous || post.updatedAt > previous) categories.set(category, post.updatedAt);
      }
      post.tags.forEach((tag) => {
        if (!tag.trim()) return;
        const previous = tags.get(tag);
        if (!previous || post.updatedAt > previous) tags.set(tag, post.updatedAt);
      });
    });

  return [
    ...Array.from(categories.entries()).map(([category, updatedAt]) => ({ loc: cmsBlogCategoryUrl(category), updatedAt })),
    ...Array.from(tags.entries()).map(([tag, updatedAt]) => ({ loc: cmsBlogTagUrl(tag), updatedAt })),
  ];
}

function getSidebarPageUsage(slug: string, sidebars: CmsSidebar[]) {
  const targets = new Set([slug, `page:${slug}`, cmsPageUrl(slug)]);
  return sidebars
    .filter((sidebar) => sidebar.isActive && targets.has(sidebar.location))
    .map((sidebar) => ({
      type: "sidebar",
      title: sidebar.name,
      path: sidebar.location,
    }));
}

function getSidebarBlogPostUsage(slug: string, sidebars: CmsSidebar[]) {
  const targets = new Set([`blog:${slug}`, `post:${slug}`, cmsBlogPostUrl(slug)]);
  return sidebars
    .filter((sidebar) => sidebar.isActive && targets.has(sidebar.location))
    .map((sidebar) => ({
      type: "sidebar",
      title: sidebar.name,
      path: sidebar.location,
    }));
}

const supportedWidgetTypes = new Set(["contactCard", "cta", "imageCard", "serviceList", "leadForm", "recentPosts", "html"]);

function sanitizeWidgetCount(value: unknown, fallback = 3, max = 6) {
  const numberValue = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.trunc(numberValue), 1), max);
}

function getSidebarSaveIssues(
  sidebar: Partial<Pick<CmsSidebar, "name" | "widgets" | "location">>,
  forms: CmsForm[] = [],
  branding?: CmsBranding | null,
) {
  const issues: string[] = [];
  const widgets = sidebar.widgets ?? [];
  const ids = widgets.map((widget) => widget.id.trim()).filter(Boolean);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const formBySlug = new Map(forms.map((form) => [form.slug, form]));

  if (sidebar.name !== undefined && !sidebar.name?.trim()) {
    issues.push("Sidebar name is required.");
  }
  if (sidebar.location !== undefined && !sidebar.location?.trim()) {
    issues.push("Sidebar location is required.");
  }
  if (duplicateIds.length > 0) {
    issues.push(`Duplicate widget IDs: ${Array.from(new Set(duplicateIds)).join(", ")}.`);
  }

  widgets.forEach((widget: CmsWidget, index) => {
    const label = widget.title || widget.id || `Widget ${index + 1}`;
    if (!widget.id?.trim()) {
      issues.push(`${label} needs a widget ID.`);
    }
    if (!supportedWidgetTypes.has(widget.type)) {
      issues.push(`${label} uses unsupported widget type "${widget.type}".`);
    }
    if (!widget.props || Array.isArray(widget.props) || typeof widget.props !== "object") {
      issues.push(`${label} needs props as a JSON object.`);
      return;
    }
    if (
      widget.type === "contactCard" &&
      !String(widget.props.phone ?? "").trim() &&
      !String(widget.props.email ?? "").trim() &&
      !branding?.phone?.trim() &&
      !branding?.email?.trim()
    ) {
      issues.push(`${label} should include a phone or email, or Branding should include contact details.`);
    }
    if (widget.type === "cta") {
      const href = String(widget.props.href ?? "");
      if (!href.trim() || !String(widget.props.label ?? "").trim()) {
        issues.push(`${label} should include CTA href and label props.`);
      }
      const hrefIssue = unsafeCmsHrefMessage(`${label} CTA`, href);
      if (hrefIssue) issues.push(hrefIssue);
    }
    if (widget.type === "imageCard") {
      const imageUrl = String(widget.props.imageUrl ?? "");
      const href = String(widget.props.href ?? "");
      if (!imageUrl.trim()) {
        issues.push(`${label} should include an imageUrl prop.`);
      }
      const imageIssue =
        unsafeCmsAssetUrlMessage(`${label} image`, imageUrl) ||
        legacyCmsAssetMessage(`${label} image`, imageUrl);
      if (imageIssue) issues.push(imageIssue);
      const hrefIssue = unsafeCmsHrefMessage(`${label} link`, href);
      if (hrefIssue) issues.push(hrefIssue);
    }
    if (widget.type === "serviceList") {
      const items = widget.props.items;
      if (!Array.isArray(items) || items.map(String).filter(Boolean).length === 0) {
        issues.push(`${label} should include at least one service item.`);
      } else {
        items.map(String).forEach((item, itemIndex) => {
          const href = item.split("|").map((part) => part.trim())[1];
          const hrefIssue = unsafeCmsHrefMessage(`${label} service item ${itemIndex + 1}`, href);
          if (hrefIssue) issues.push(hrefIssue);
        });
      }
    }
    if (widget.type === "leadForm") {
      const formSlug = String(widget.props.formSlug ?? "").trim();
      const form = formBySlug.get(formSlug);
      if (!formSlug) {
        issues.push(`${label} should include a formSlug prop.`);
      } else if (forms.length > 0 && !form) {
        issues.push(`${label} references form "${formSlug}", but it is not saved.`);
      } else if (form && !form.isActive) {
        issues.push(`${label} references inactive form "${formSlug}".`);
      }
    }
    if (widget.type === "recentPosts") {
      const count = widget.props.count;
      const countNumber = Number(count);
      if (count !== undefined && count !== null && count !== "" && (!Number.isInteger(countNumber) || countNumber < 1 || countNumber > 6)) {
        issues.push(`${label} count should be a whole number from 1 to 6.`);
      }
    }
    if (widget.type === "html") {
      const html = String(widget.props.html ?? "");
      if (!html.trim()) {
        issues.push(`${label} should include HTML content.`);
      }
      if (cmsHtmlHasUnsafeContent(html)) {
        issues.push(`${label} includes HTML that will be stripped from the public site.`);
      }
    }
  });

  return Array.from(new Set(issues));
}

function getSidebarActivationIssues(
  sidebar: Pick<CmsSidebar, "widgets" | "location" | "isActive">,
  forms: CmsForm[] = [],
  branding?: CmsBranding | null,
  pages: CmsPage[] = [],
  posts: CmsBlogPost[] = [],
  mediaItems: unknown[] = [],
) {
  const saveIssues = getSidebarSaveIssues(sidebar, forms, branding);
  if (!sidebar.isActive) return saveIssues;

  const issues: string[] = [...saveIssues];
  const location = sidebar.location.trim();
  const pageLocation = sidebarPageSlugFromLocation(location);
  const postLocation = sidebarPostSlugFromLocation(location);
  const page = pages.find((item) => item.slug === pageLocation);
  const post = posts.find((item) => item.slug === postLocation);

  if (!location) {
    issues.push("Active sidebars need a location.");
  }
  if (location && !["default", "page", "footer", "blog", "blogPost"].includes(location)) {
    if (postLocation) {
      if (posts.length > 0 && !post) {
        issues.push(`Sidebar location references missing blog post "${postLocation}".`);
      } else if (post && post.status !== "published") {
        issues.push(`Sidebar location references draft blog post "${postLocation}".`);
      }
    } else if (pages.length > 0 && !page) {
      issues.push(`Sidebar location references missing CMS page "${pageLocation}".`);
    } else if (page && page.status !== "published") {
      issues.push(`Sidebar location references draft CMS page "${pageLocation}".`);
    }
  }
  if (sidebar.widgets.length === 0) {
    issues.push("Active sidebars should include at least one widget.");
  }
  sidebar.widgets.forEach((widget, index) => {
    if (!widget.props || Array.isArray(widget.props) || typeof widget.props !== "object") return;
    const label = widget.title || widget.id || `Widget ${index + 1}`;
    const props = widget.props as Record<string, unknown>;
    const mediaIssue = missingMediaLibraryAssetMessage(`${label} image`, props.imageUrl, mediaItems);
    if (mediaIssue) issues.push(mediaIssue);
  });

  return Array.from(new Set(issues));
}

function sanitizePublicMenuItems(items: CmsMenuItem[]): CmsMenuItem[] {
  return items.flatMap((item) => {
    const href = safeCmsHrefValue(item.href);
    const children = sanitizePublicMenuItems(item.children ?? []);
    const label = item.label.trim();
    const id = item.id.trim();

    if (!label || (!href && children.length === 0)) return [];

    return [
      {
        id: id || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        label,
        href: href || "#",
        ...(children.length > 0 ? { children } : {}),
      },
    ];
  });
}

function sanitizePublicMenu(menu: CmsMenu): CmsMenu {
  return {
    ...menu,
    location: menu.location.trim(),
    items: sanitizePublicMenuItems(menu.items),
  };
}

function propString(props: Record<string, unknown>, key: string) {
  const value = props[key];
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeServiceListItems(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const [label = "", href = ""] = String(item).split("|").map((part) => part.trim());
    const safeHref = safeCmsHrefValue(href);

    if (!label) return [];
    return safeHref ? [`${label}|${safeHref}`] : [label];
  });
}

function sanitizePublicWidget(widget: CmsWidget): CmsWidget | null {
  if (!supportedWidgetTypes.has(widget.type)) return null;

  const props = widget.props && !Array.isArray(widget.props) && typeof widget.props === "object"
    ? widget.props
    : {};

  if (widget.type === "contactCard") {
    return {
      ...widget,
      title: widget.title?.trim() || undefined,
      props: {
        title: propString(props, "title"),
        body: propString(props, "body"),
        phone: propString(props, "phone"),
        email: propString(props, "email"),
      },
    };
  }

  if (widget.type === "cta") {
    return {
      ...widget,
      title: widget.title?.trim() || undefined,
      props: {
        title: propString(props, "title"),
        body: propString(props, "body"),
        label: propString(props, "label"),
        href: safeCmsHrefValue(props.href),
      },
    };
  }

  if (widget.type === "imageCard") {
    return {
      ...widget,
      title: widget.title?.trim() || undefined,
      props: {
        imageUrl: safeCmsAssetUrlValue(props.imageUrl),
        altText: propString(props, "altText"),
        caption: propString(props, "caption"),
        body: propString(props, "body"),
        label: propString(props, "label"),
        href: safeCmsHrefValue(props.href),
      },
    };
  }

  if (widget.type === "serviceList") {
    return {
      ...widget,
      title: widget.title?.trim() || undefined,
      props: {
        items: sanitizeServiceListItems(props.items),
      },
    };
  }

  if (widget.type === "leadForm") {
    return {
      ...widget,
      title: widget.title?.trim() || undefined,
      props: {
        title: propString(props, "title"),
        body: propString(props, "body"),
        formSlug: propString(props, "formSlug"),
      },
    };
  }

  if (widget.type === "recentPosts") {
    return {
      ...widget,
      title: widget.title?.trim() || undefined,
      props: {
        title: propString(props, "title"),
        body: propString(props, "body"),
        count: sanitizeWidgetCount(props.count),
        category: propString(props, "category"),
        tag: propString(props, "tag"),
        label: propString(props, "label"),
      },
    };
  }

  if (widget.type === "html") {
    return {
      ...widget,
      title: widget.title?.trim() || undefined,
      props: {
        html: sanitizeCmsHtml(props.html),
      },
    };
  }

  return {
    ...widget,
    title: widget.title?.trim() || undefined,
    props: {
      body: propString(props, "body"),
    },
  };
}

function sanitizePublicSidebar(sidebar: CmsSidebar): CmsSidebar {
  return {
    ...sidebar,
    location: sidebar.location.trim(),
    widgets: sidebar.widgets.flatMap((widget) => {
      const sanitized = sanitizePublicWidget(widget);
      return sanitized ? [sanitized] : [];
    }),
  };
}

function sanitizePublicBranding(branding: CmsBranding | null) {
  if (!branding) return null;

  const socialLinks = Object.fromEntries(
    Object.entries(branding.socialLinks ?? {})
      .map(([label, href]) => [label.trim(), safeCmsHrefValue(href)] as const)
      .filter(([label, href]) => label && href),
  );

  return {
    ...branding,
    siteName: branding.siteName.trim(),
    tagline: branding.tagline?.trim() || null,
    logoUrl: safeCmsAssetUrlValue(branding.logoUrl),
    faviconUrl: safeCmsAssetUrlValue(branding.faviconUrl),
    phone: branding.phone?.trim() || null,
    email: branding.email?.trim() || null,
    address: branding.address?.trim() || null,
    socialLinks,
  };
}

function sanitizePublicColorPalette(palette: CmsColorPalette | null) {
  if (!palette) return null;

  return {
    ...palette,
    name: palette.name.trim(),
    tokens: Object.fromEntries(
      colorPaletteTokenFields.map((field) => [field, isHslCssToken(palette.tokens[field]) ? palette.tokens[field].trim() : ""]),
    ) as CmsColorPalette["tokens"],
  };
}

function sanitizePublicTypography(typography: CmsTypography | null) {
  if (!typography) return null;

  const scale = Object.fromEntries(
    Object.entries(typography.scale ?? {})
      .map(([key, size]) => [key.trim(), isSafeCssSizeValue(size) ? String(size).trim() : ""] as const)
      .filter(([key, size]) => key && size),
  );

  return {
    ...typography,
    name: typography.name.trim(),
    headingFont: isSafeFontFamilyName(typography.headingFont) ? typography.headingFont.trim() : "Montserrat",
    bodyFont: isSafeFontFamilyName(typography.bodyFont) ? typography.bodyFont.trim() : "Open Sans",
    scale,
  };
}

function sanitizePublicSettingValue(value: unknown): unknown {
  if (typeof value === "string") return value.trim().slice(0, 1000);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitizePublicSettingValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key))
        .slice(0, 100)
        .map(([key, item]) => [key, sanitizePublicSettingValue(item)]),
    );
  }
  return null;
}

function sanitizePublicSiteSettingValue(value: Record<string, unknown>, options: { publicCmsEnabled?: boolean } = {}) {
  const siteUrl = typeof value.siteUrl === "string" ? safePublicBaseUrl(value.siteUrl, "") : "";

  return {
    ...(typeof value.businessName === "string" && value.businessName.trim()
      ? { businessName: value.businessName.trim().slice(0, 120) }
      : {}),
    ...(siteUrl ? { siteUrl } : {}),
    ...(typeof value.market === "string" && value.market.trim()
      ? { market: value.market.trim().slice(0, 160) }
      : {}),
    ...(typeof value.businessHours === "string" && value.businessHours.trim()
      ? { businessHours: value.businessHours.trim().slice(0, 160) }
      : {}),
    publicCmsEnabled: options.publicCmsEnabled ?? publicCmsTakeoverValueEnabled(value),
    leadPipelineStages: normalizeLeadPipelineStages(value.leadPipelineStages).slice(0, 12),
  };
}

function sanitizePublicSetting(setting: CmsSetting, options: { publicCmsEnabled?: boolean } = {}): CmsSetting {
  const value = setting.value && typeof setting.value === "object" && !Array.isArray(setting.value)
    ? setting.value
    : {};

  return {
    ...setting,
    key: setting.key.trim(),
    group: setting.group.trim(),
    value: setting.key === "site"
      ? sanitizePublicSiteSettingValue(value as Record<string, unknown>, options)
      : sanitizePublicSettingValue(value) as Record<string, unknown>,
  };
}

function cmsSlugParam(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join("/");
  return String(value ?? "").trim();
}

function sanitizePublicMedia(media: CmsMedia): CmsMedia | null {
  const url = safeCmsAssetUrlValue(media.url);
  if (!url) return null;

  return {
    ...media,
    url,
    name: media.name.trim(),
    altText: media.altText?.trim() || null,
    caption: media.caption?.trim() || null,
    category: media.category?.trim() || null,
    tags: (media.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
  };
}

async function getSectionUsage(sectionId: string) {
  const sections = await storage.listCms("sections");
  const section = sections.find((item) => item.id === sectionId);
  if (!section) return { section: undefined, usage: [] };

  const pages = await storage.listCms("pages");
  const usage = pages
    .map((page) => ({
      type: "page",
      id: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      matches: countSectionReferences(page, section, sections),
    }))
    .filter((item) => item.matches > 0);
  const sectionUsage = sections
    .filter((candidate) => candidate.id !== section.id)
    .map((candidate) => ({
      type: "section",
      id: candidate.id,
      title: candidate.name,
      slug: candidate.handle,
      status: candidate.isReusable ? "reusable" : "section",
      matches: countSectionReferencesSection(candidate, section, sections),
    }))
    .filter((item) => item.matches > 0);

  return { section, usage: [...usage, ...sectionUsage] };
}

async function getFormUsage(formId: string) {
  const forms = await storage.listCms("forms");
  const form = forms.find((item) => item.id === formId);
  if (!form) return { form: undefined, usage: [] };

  const [pages, sections, sidebars] = await Promise.all([
    storage.listCms("pages"),
    storage.listCms("sections"),
    storage.listCms("sidebars"),
  ]);
  const pageUsage = pages
    .map((page) => ({
      type: "page",
      id: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      matches: countFormReferences(page, form, sections),
    }))
    .filter((item) => item.matches > 0);
  const sectionUsage = sections
    .map((section) => ({
      type: "section",
      id: section.id,
      title: section.name,
      slug: section.handle,
      status: section.isReusable ? "reusable" : "section",
      matches: countSectionFormReferences(section, form, sections),
    }))
    .filter((item) => item.matches > 0);
  const sidebarUsage = sidebars
    .map((sidebar) => {
      const matches = sidebar.widgets.filter((widget) => {
        if (widget.type !== "leadForm") return false;
        const formSlug = typeof widget.props.formSlug === "string" ? widget.props.formSlug : "";
        return formSlug === form.slug;
      }).length;
      return {
        type: "sidebar",
        id: sidebar.id,
        title: sidebar.name,
        slug: sidebar.location,
        status: sidebar.isActive ? "active" : "inactive",
        matches,
      };
    })
    .filter((item) => item.matches > 0);

  return { form, usage: [...pageUsage, ...sectionUsage, ...sidebarUsage] };
}

async function enforceActiveCmsSingleton(collection: CmsCollectionName, record: unknown) {
  if (collection === "colorPalettes") {
    const active = record as CmsColorPalette;
    if (!active.isActive) return;
    const palettes = await storage.listCms("colorPalettes");
    await Promise.all(
      palettes
        .filter((palette) => palette.id !== active.id && palette.isActive)
        .map((palette) => storage.updateCms("colorPalettes", palette.id, { isActive: false })),
    );
  }

  if (collection === "typography") {
    const active = record as CmsTypography;
    if (!active.isActive) return;
    const styles = await storage.listCms("typography");
    await Promise.all(
      styles
        .filter((style) => style.id !== active.id && style.isActive)
        .map((style) => storage.updateCms("typography", style.id, { isActive: false })),
    );
  }

  if (collection === "menus") {
    const active = record as CmsMenu;
    if (!active.isActive) return;
    const menus = await storage.listCms("menus");
    await Promise.all(
      menus
        .filter((menu) => menu.id !== active.id && menu.location === active.location && menu.isActive)
        .map((menu) => storage.updateCms("menus", menu.id, { isActive: false })),
    );
  }

  if (collection === "sidebars") {
    const active = record as CmsSidebar;
    if (!active.isActive) return;
    const sidebars = await storage.listCms("sidebars");
    await Promise.all(
      sidebars
        .filter((sidebar) => sidebar.id !== active.id && sidebar.location === active.location && sidebar.isActive)
        .map((sidebar) => storage.updateCms("sidebars", sidebar.id, { isActive: false })),
    );
  }
}

async function getLastActiveOwnerIssue(candidate: CmsSystemUser) {
  if (candidate.role === "owner" && candidate.status === "active") return "";

  const systemUsers = await storage.listCms("systemUsers");
  const activeOwnerCount = systemUsers.filter(
    (user) =>
      user.id !== candidate.id &&
      user.role === "owner" &&
      user.status === "active",
  ).length;

  return activeOwnerCount === 0
    ? "At least one active owner system user is required."
    : "";
}

async function attachFeaturedImage<T extends { featuredImageId: string | null }>(post: T) {
  const featuredImage = post.featuredImageId
    ? await storage.getCms("media", post.featuredImageId)
    : null;
  return { ...post, featuredImage: featuredImage ? sanitizePublicMedia(featuredImage) : null };
}

function getPublicBaseUrl(req: Request) {
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost";
  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  return `${protocol}://${host}`;
}

function safePublicBaseUrl(value: string | null | undefined, fallback: string) {
  const fallbackBase = fallback.replace(/\/$/, "");
  const candidate = value?.trim();

  if (!candidate) return fallbackBase;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString().replace(/\/$/, "")
      : fallbackBase;
  } catch {
    return fallbackBase;
  }
}

async function getCanonicalPublicBaseUrl(req: Request) {
  try {
    const [brandingRecords, settings] = await Promise.all([
      storage.listCms("branding"),
      storage.getPublicSettings(),
    ]);
    const siteUrl = buildPublicBusinessIdentity({
      branding: brandingRecords[0] ?? null,
      settings,
    }).siteUrl.trim();
    return safePublicBaseUrl(siteUrl, getPublicBaseUrl(req));
  } catch {
    return safePublicBaseUrl(null, getPublicBaseUrl(req));
  }
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
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
  return `/${slug.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function pageHasIndexableRouteContent(page: CmsPage) {
  return primaryCmsRouteSlugSet.has(page.slug) || page.content.sections.length > 0;
}

function publicCmsTakeoverValueRequested(value: unknown) {
  return Boolean(
    value &&
      !Array.isArray(value) &&
      typeof value === "object" &&
      (value as Record<string, unknown>).publicCmsEnabled === true,
  );
}

function publicCmsTakeoverLaunchConfirmed(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return false;
  const confirmedAt = (value as Record<string, unknown>).publicCmsLaunchConfirmedAt;
  return typeof confirmedAt === "string" && confirmedAt.trim() !== "" && !Number.isNaN(Date.parse(confirmedAt));
}

function publicCmsVisualParityApproved(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return false;
  const approvedAt = (value as Record<string, unknown>).publicCmsVisualParityApprovedAt;
  return (
    typeof approvedAt === "string" &&
    approvedAt.trim() !== "" &&
    !Number.isNaN(Date.parse(approvedAt)) &&
    publicCmsVisualParityRouteChecklistComplete((value as Record<string, unknown>).publicCmsVisualParityRouteReviews)
  );
}

function publicCmsTakeoverValueEnabled(value: unknown) {
  return publicCmsTakeoverValueRequested(value) && publicCmsTakeoverLaunchConfirmed(value);
}

function publicCmsTakeoverRequested(settings: Array<Pick<CmsSetting, "key" | "value">>) {
  const siteValue = settings.find((setting) => setting.key === "site")?.value ?? {};
  return publicCmsTakeoverValueRequested(siteValue);
}

function publicCmsTakeoverEnabled(settings: Array<Pick<CmsSetting, "key" | "value">>) {
  const siteValue = settings.find((setting) => setting.key === "site")?.value ?? {};
  return publicCmsTakeoverValueEnabled(siteValue);
}

async function effectivePublicCmsTakeoverEnabled(settings: Array<Pick<CmsSetting, "key" | "value">>) {
  if (!publicCmsTakeoverEnabled(settings)) return false;
  return (await getPublicCmsTakeoverBlockers()).length === 0;
}

function pageIsPublicSitemapCandidate(page: CmsPage, options: { includeCmsRoutes?: boolean } = {}) {
  return (options.includeCmsRoutes ?? true) && page.status === "published" && !page.seo.noIndex && pageHasIndexableRouteContent(page);
}

function postIsPublicSitemapCandidate(post: CmsBlogPost, options: { includeCmsRoutes?: boolean } = {}) {
  return (options.includeCmsRoutes ?? true) && post.status === "published" && !post.seo.noIndex;
}

function createPublicRouteEntries(
  pages: CmsPage[],
  posts: CmsBlogPost[],
  options: { includeCmsRoutes?: boolean } = {},
) {
  const includeCmsRoutes = options.includeCmsRoutes ?? true;
  const fallbackRoutes = hardCodedPublicRouteSlugs.map((slug) => ({
    loc: cmsPageUrl(slug),
    updatedAt: pages.find((page) => page.slug === slug)?.updatedAt ?? new Date(),
  }));

  if (!includeCmsRoutes) {
    return Array.from(new Map(fallbackRoutes.map((url) => [url.loc, url])).values());
  }

  const cmsOwnedLocs = new Set(
    pages
      .filter((page) => page.status === "published")
      .map((page) => cmsPageUrl(page.slug)),
  );
  const urls = [
    ...pages
      .filter((page) => pageIsPublicSitemapCandidate(page, { includeCmsRoutes }))
      .map((page) => ({ loc: cmsPageUrl(page.slug), updatedAt: page.updatedAt })),
    ...primaryCmsRouteSlugs
      .map((slug) => ({ loc: cmsPageUrl(slug), updatedAt: new Date() }))
      .filter((url) => !cmsOwnedLocs.has(url.loc)),
    ...posts
      .filter((post) => postIsPublicSitemapCandidate(post, { includeCmsRoutes }))
      .map((post) => ({ loc: `/blog/${encodeURIComponent(post.slug)}`, updatedAt: post.updatedAt })),
    ...getPublishedBlogArchiveEntries(posts, { includeCmsRoutes }),
  ];

  return Array.from(new Map(urls.map((url) => [url.loc, url])).values());
}

function createPublicFormEntries(forms: CmsForm[], submissions: CmsFormSubmission[]) {
  const submissionsBySlug = countBy(submissions, (submission) => submission.formSlug);
  const lastSubmissionBySlug = submissions.reduce<Record<string, string>>((latest, submission) => {
    const slug = submission.formSlug.trim();
    if (!slug) return latest;
    const submittedAt = submission.createdAt.toISOString();
    if (!latest[slug] || submittedAt > latest[slug]) {
      latest[slug] = submittedAt;
    }
    return latest;
  }, {});

  return forms
    .filter((form) => form.isActive)
    .map((form) => {
      const publicForm = publicFormResponse(form);
      return {
        name: publicForm.name,
        slug: publicForm.slug,
        endpoint: `/api/cms/public/forms/${encodeURIComponent(publicForm.slug)}`,
        fieldCount: publicForm.fields.length,
        submissionCount: submissionsBySlug[publicForm.slug] ?? 0,
        lastSubmissionAt: lastSubmissionBySlug[publicForm.slug] ?? null,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function blockHasFaqStructuredData(blocks: CmsSectionBlock[], sections: CmsSection[] = [], depth = 0, visitedSectionIds = new Set<string>()): boolean {
  return blocks.some((block) => {
    if (block.type === "faq") {
      const items = Array.isArray(block.props.items) ? block.props.items : [];
      return items.some((item) => {
        if (typeof item !== "string") return false;
        const [question, answer] = item.split("|").map((part) => part.trim());
        return Boolean(question && answer);
      });
    }

    if (block.type !== "sectionRef" || depth >= maxReusableSectionDepth) return false;

    const handle = typeof block.props.handle === "string" ? block.props.handle.trim() : "";
    const sectionId = typeof block.props.sectionId === "string" ? block.props.sectionId.trim() : "";
    const section = sections.find((item) => item.handle === handle || item.id === sectionId);
    if (!section || visitedSectionIds.has(section.id)) return false;

    const nextVisitedSectionIds = new Set(visitedSectionIds);
    nextVisitedSectionIds.add(section.id);
    return blockHasFaqStructuredData(section.blocks, sections, depth + 1, nextVisitedSectionIds);
  });
}

function seoStructuredDataTypes(record: CmsPage | Pick<CmsBlogPost, "slug">, type: "page" | "blogPost", sections: CmsSection[] = []) {
  if (type === "blogPost") return ["BlogPosting"];
  const page = record as CmsPage;
  return [
    "WebPage",
    page.slug === "home" ? "LocalBusiness" : "",
    page.slug.startsWith("services/") ? "Service" : "",
    blockHasFaqStructuredData(page.content.sections, sections) ? "FAQPage" : "",
  ].filter(Boolean);
}

function seoCanonicalIssue(canonicalUrl: string) {
  const value = canonicalUrl.trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "invalidCanonical";
    }
  } catch {
    return "invalidCanonical";
  }
  return "";
}

function seoIssuePriority(issue: string) {
  if (["noRouteContent", "missingCanonical", "invalidCanonical"].includes(issue)) return 0;
  if (["missingTitle", "missingDescription", "longTitle", "longDescription"].includes(issue)) return 1;
  if (issue.startsWith("draft") || issue === "noIndex") return 2;
  return 3;
}

function seoPriorityLabel(priority: number) {
  if (priority === 0) return "blocker";
  if (priority === 1) return "warning";
  if (priority === 2) return "draft";
  return "ready";
}

function seoNextAction(issues: string[]) {
  const sortedIssues = [...issues].sort((a, b) => seoIssuePriority(a) - seoIssuePriority(b));
  const issue = sortedIssues[0];
  if (!issue) return "SEO record is ready.";
  if (issue === "noRouteContent") return "Add route content or sections so the published record can enter the sitemap.";
  if (issue === "missingCanonical" || issue === "invalidCanonical") return "Repair the canonical URL.";
  if (issue === "missingTitle" || issue === "missingDescription") return "Fill missing SEO metadata.";
  if (issue === "longTitle" || issue === "longDescription") return "Tighten long SEO copy.";
  if (issue === "noIndex") return "Review whether this published record should be indexed.";
  if (issue.startsWith("draft")) return "Complete draft SEO before publishing.";
  return "Review SEO readiness.";
}

async function createSeoAudit(req: Request) {
  const baseUrl = await getCanonicalPublicBaseUrl(req);
  const [pages, posts, sections, settings] = await Promise.all([
    storage.listCms("pages"),
    storage.listCms("blogPosts"),
    storage.listCms("sections"),
    storage.getPublicSettings(),
  ]);
  const includeCmsRoutes = await effectivePublicCmsTakeoverEnabled(settings);
  const records = [
    ...pages.map((page) => ({
      id: page.id,
      type: "page",
      title: page.title,
      status: page.status,
      url: `${baseUrl}${cmsPageUrl(page.slug)}`,
      metaTitle: page.seo.metaTitle ?? "",
      metaDescription: page.seo.metaDescription ?? "",
      canonicalUrl: page.seo.canonicalUrl ?? "",
      noIndex: Boolean(page.seo.noIndex),
      inSitemap: pageIsPublicSitemapCandidate(page, { includeCmsRoutes }),
      structuredData: seoStructuredDataTypes(page, "page", sections),
      updatedAt: page.updatedAt,
    })),
    ...posts.map((post) => ({
      id: post.id,
      type: "blogPost",
      title: post.title,
      status: post.status,
      url: `${baseUrl}/blog/${encodeURIComponent(post.slug)}`,
      metaTitle: post.seo.metaTitle ?? "",
      metaDescription: post.seo.metaDescription ?? "",
      canonicalUrl: post.seo.canonicalUrl ?? "",
      noIndex: Boolean(post.seo.noIndex),
      inSitemap: postIsPublicSitemapCandidate(post, { includeCmsRoutes }),
      structuredData: seoStructuredDataTypes(post, "blogPost"),
      updatedAt: post.updatedAt,
    })),
    ...getPublishedBlogArchiveEntries(posts, { includeCmsRoutes }).map((archive) => {
      const parsedArchive = parseBlogArchiveHref(archive.loc);
      const isTag = parsedArchive?.kind === "tag";
      const label = parsedArchive?.value ?? archive.loc;
      return {
        id: `blogArchive:${archive.loc}`,
        type: "blogArchive",
        title: `${isTag ? "Tagged" : "Category"}: ${label}`,
        status: "published",
        url: `${baseUrl}${archive.loc}`,
        metaTitle: `${isTag ? "Tagged" : "Category"}: ${label} | Blog | Glass & Door Pro`,
        metaDescription: `${isTag ? "Tagged" : "Category"}: ${label} articles, project notes, and glass and door guidance from Glass & Door Pro.`,
        canonicalUrl: `${baseUrl}${archive.loc}`,
        noIndex: false,
        inSitemap: true,
        structuredData: ["WebPage"],
        updatedAt: archive.updatedAt,
      };
    }),
  ];
  const published = records.filter((record) => record.status === "published");
  const indexablePublished = published.filter((record) => !record.noIndex && record.inSitemap);
  const issues = records.flatMap((record) => {
    const recordIssues = [];
    const isWritableDraft = record.status !== "published" && record.status !== "archived";
    if (record.status === "published" && !record.noIndex && !record.inSitemap) recordIssues.push("noRouteContent");
    if (record.status === "published" && !record.metaTitle.trim()) recordIssues.push("missingTitle");
    if (record.status === "published" && !record.metaDescription.trim()) recordIssues.push("missingDescription");
    if (record.status === "published" && !record.canonicalUrl.trim()) recordIssues.push("missingCanonical");
    if (record.status === "published" && record.noIndex) recordIssues.push("noIndex");
    if (record.status === "published" && record.metaTitle.trim().length > 70) recordIssues.push("longTitle");
    if (record.status === "published" && record.metaDescription.trim().length > 160) recordIssues.push("longDescription");
    const canonicalIssue = record.status === "published" ? seoCanonicalIssue(record.canonicalUrl) : "";
    if (canonicalIssue) recordIssues.push(canonicalIssue);
    if (isWritableDraft && !record.metaTitle.trim()) recordIssues.push("draftMissingTitle");
    if (isWritableDraft && !record.metaDescription.trim()) recordIssues.push("draftMissingDescription");
    if (isWritableDraft && !record.canonicalUrl.trim()) recordIssues.push("draftMissingCanonical");
    if (isWritableDraft && record.canonicalUrl.trim() && seoCanonicalIssue(record.canonicalUrl)) {
      recordIssues.push("draftInvalidCanonical");
    }
    return recordIssues.map((issue) => ({ id: record.id, type: record.type, title: record.title, url: record.url, issue }));
  });
  const issueMap = issues.reduce<Record<string, string[]>>((issuesById, issue) => {
    issuesById[issue.id] = [...(issuesById[issue.id] ?? []), issue.issue];
    return issuesById;
  }, {});
  const enrichedRecords = records.map((record) => {
    const recordIssues = issueMap[record.id] ?? [];
    const priority = recordIssues.length ? Math.min(...recordIssues.map(seoIssuePriority)) : 3;
    return {
      ...record,
      issueCount: recordIssues.length,
      priority,
      priorityLabel: seoPriorityLabel(priority),
      nextAction: seoNextAction(recordIssues),
    };
  });
  const priorityCounts = countBy(enrichedRecords, (record) => record.priorityLabel);

  return {
    generatedAt: new Date().toISOString(),
    source: "Glass & Door Pro Admin",
    sitemapUrl: `${baseUrl}/sitemap.xml`,
    robotsUrl: `${baseUrl}/robots.txt`,
    rssUrl: `${baseUrl}/rss.xml`,
    totals: {
      records: records.length,
      published: published.length,
      noIndex: published.filter((record) => record.noIndex).length,
      noRouteContent: issues.filter((issue) => issue.issue === "noRouteContent").length,
      missingTitles: issues.filter((issue) => issue.issue === "missingTitle").length,
      missingDescriptions: issues.filter((issue) => issue.issue === "missingDescription").length,
      missingCanonicals: issues.filter((issue) => issue.issue === "missingCanonical").length,
      draftMissingTitles: issues.filter((issue) => issue.issue === "draftMissingTitle").length,
      draftMissingDescriptions: issues.filter((issue) => issue.issue === "draftMissingDescription").length,
      draftMissingCanonicals: issues.filter((issue) => issue.issue === "draftMissingCanonical").length,
      longTitles: issues.filter((issue) => issue.issue === "longTitle").length,
      longDescriptions: issues.filter((issue) => issue.issue === "longDescription").length,
      invalidCanonicals: issues.filter((issue) => issue.issue === "invalidCanonical").length,
      draftInvalidCanonicals: issues.filter((issue) => issue.issue === "draftInvalidCanonical").length,
      structuredDataRecords: indexablePublished.reduce((total, record) => total + record.structuredData.length, 0),
      structuredDataByType: countBy(indexablePublished.flatMap((record) => record.structuredData), (type) => type),
      priorityCounts,
      blockerRecords: enrichedRecords.filter((record) => record.priorityLabel === "blocker").length,
      warningRecords: enrichedRecords.filter((record) => record.priorityLabel === "warning").length,
      draftRecords: enrichedRecords.filter((record) => record.priorityLabel === "draft").length,
    },
    issues,
    records: enrichedRecords,
  };
}

async function walkMediaFiles(
  root: string,
  base = root,
  urlPrefix = "",
): Promise<Array<{ filePath: string; url: string; mimeType: string }>> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return walkMediaFiles(entryPath, base, urlPrefix);
      const extension = path.extname(entry.name).toLowerCase();
      const mimeType = mediaImportExtensions.get(extension);
      if (!mimeType) return [];
      const relativePath = path.relative(base, entryPath).split(path.sep).join("/");
      const normalizedPrefix = urlPrefix.trim().replace(/\/$/, "");
      return [{ filePath: entryPath, url: `${normalizedPrefix}/${relativePath}`, mimeType }];
    }),
  );

  return files.flat();
}

function mediaNameFromUrl(url: string) {
  const filename = url.split("/").filter(Boolean).at(-1) ?? "Media Item";
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mediaBrandTags(value: { url?: string | null; name?: string | null }) {
  const searchable = `${value.url ?? ""} ${value.name ?? ""}`.toLowerCase();
  if (!/(logo|favicon|icon|brand)/.test(searchable)) return [];

  const tags = ["brand"];
  if (searchable.includes("logo")) tags.push("logo");
  if (searchable.includes("favicon") || searchable.includes("icon")) tags.push("icon");
  return Array.from(new Set(tags));
}

function sanitizeUploadBaseName(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "media";
}

function getWritablePublicRoot() {
  return process.env.NODE_ENV === "production"
    ? path.resolve(process.cwd(), "dist", "public")
    : path.resolve(process.cwd(), "client", "public");
}

async function findLocalMediaFilePath(url: string) {
  if (!url.startsWith("/") || url.startsWith("//")) return null;
  const cleanUrl = url.split(/[?#]/)[0] ?? "";
  const cmsAssetsRoot = path.resolve(process.cwd(), "client", "src", "assets");
  const roots = [
    getWritablePublicRoot(),
    path.resolve(process.cwd(), "client", "public"),
    path.resolve(process.cwd(), "dist", "public"),
    cmsAssetsRoot,
  ];

  for (const root of Array.from(new Set(roots))) {
    const cmsAssetPath = cleanUrl.startsWith("/cms-assets/")
      ? cleanUrl.replace(/^\/cms-assets\//, "")
      : null;
    const candidate = path.resolve(root, cmsAssetPath && root === cmsAssetsRoot ? cmsAssetPath : `.${cleanUrl}`);
    const relative = path.relative(root, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;

    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return { filePath: candidate, sizeBytes: stat.size };
    } catch {
      // Try the next public root.
    }
  }

  return null;
}

async function getImageDimensions(filePath: string) {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    };
  } catch {
    return { width: null, height: null };
  }
}

async function getReferencedCmsAssetUrls() {
  const [pages, posts, sections, branding, sidebars] = await Promise.all([
    storage.listCms("pages"),
    storage.listCms("blogPosts"),
    storage.listCms("sections"),
    storage.listCms("branding"),
    storage.listCms("sidebars"),
  ]);
  const urls = new Set<string>();

  pages.forEach((page) => collectLocalCmsAssetUrls({ content: page.content, seo: page.seo }, urls));
  posts.forEach((post) => collectLocalCmsAssetUrls({ body: post.body, seo: post.seo }, urls));
  sections.forEach((section) => collectLocalCmsAssetUrls(section.blocks, urls));
  branding.forEach((record) => collectLocalCmsAssetUrls({ logoUrl: record.logoUrl, faviconUrl: record.faviconUrl }, urls));
  sidebars.forEach((sidebar) => collectLocalCmsAssetUrls(sidebar.widgets, urls));

  return urls;
}

async function importPublicAssetMediaRecords(options: { referencedOnly?: boolean } = {}) {
  const roots = [
    { path: path.resolve(process.cwd(), "client", "public"), urlPrefix: "" },
    { path: path.resolve(process.cwd(), "dist", "public"), urlPrefix: "" },
    { path: path.resolve(process.cwd(), "client", "src", "assets"), urlPrefix: "/cms-assets" },
  ];
  const discovered = (await Promise.all(roots.map((root) => walkMediaFiles(root.path, root.path, root.urlPrefix)))).flat();
  const uniqueDiscovered = Array.from(new Map(discovered.map((item) => [item.url, item])).values());
  const discoveredByUrl = new Map(uniqueDiscovered.map((item) => [item.url, item]));
  const requestedUrls = options.referencedOnly ? await getReferencedCmsAssetUrls() : null;
  const importCandidates = requestedUrls
    ? Array.from(requestedUrls).flatMap((url) => {
        const item = discoveredByUrl.get(url);
        return item ? [item] : [];
      })
    : uniqueDiscovered;
  const existing = await storage.listCms("media");
  const existingUrls = new Set(existing.map((item) => item.url));
  const imported: CmsMedia[] = [];

  for (const item of importCandidates) {
    if (existingUrls.has(item.url)) continue;
    const stat = await fs.stat(item.filePath);
    const dimensions = await getImageDimensions(item.filePath);
    const name = mediaNameFromUrl(item.url);
    const category = inferMediaGalleryCategory({ url: item.url, name });
    const brandTags = item.mimeType.startsWith("image/") ? mediaBrandTags({ url: item.url, name }) : [];
    const isGalleryReady = item.mimeType.startsWith("image/") && item.url.toLowerCase().includes("gallery");
    const tags = Array.from(new Set([
      ...(category ? ["gallery", category] : []),
      ...brandTags,
    ]));
    const media = await storage.createCms("media", {
      name,
      url: item.url,
      mimeType: item.mimeType,
      altText: name,
      caption: isGalleryReady
        ? category
          ? `Gallery - ${category} - ${name}`
          : `Gallery - ${name}`
        : brandTags.length > 0
          ? `Brand asset - ${name}`
          : "",
      category: category ?? "",
      tags,
      isGalleryReady,
      sizeBytes: stat.size,
      width: dimensions.width,
      height: dimensions.height,
    });
    imported.push(media);
  }

  const missing = requestedUrls
    ? Array.from(requestedUrls).filter((url) => !discoveredByUrl.has(url))
    : [];

  return {
    imported,
    skipped: importCandidates.length - imported.length,
    discovered: uniqueDiscovered.length,
    requested: requestedUrls?.size ?? uniqueDiscovered.length,
    missing,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await seedStorageDefaults();
  await importPublicAssetMediaRecords({ referencedOnly: true });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "Glass & Door Pro CMS" });
  });

  app.get("/api/admin/auth/me", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      if (!req.session.isAdmin) {
        return res.status(401).json({ authenticated: false });
      }

      const systemUsers = await storage.listCms("systemUsers");
      const sessionUser = req.session.adminUserId
        ? systemUsers.find((user) => user.id === req.session.adminUserId)
        : undefined;
      const user =
        sessionUser ??
        systemUsers.find((item) => item.status === "active" && item.role === "owner") ??
        systemUsers.find((item) => item.status === "active") ??
        null;

      if (user && req.session.adminUserId !== user.id) {
        req.session.adminUserId = user.id;
      }

      return res.json({ authenticated: true, user });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/admin/auth/login", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const { password } = loginSchema.parse(req.body);
      const expectedPassword =
        process.env.ADMIN_PASSWORD ||
        (process.env.NODE_ENV === "production" ? "" : "admin");

      if (!expectedPassword) {
        return res.status(503).json({ message: "Admin password is not configured" });
      }

      if (password !== expectedPassword) {
        return res.status(401).json({ message: "Invalid admin password" });
      }

      req.session.isAdmin = true;
      const systemUsers = await storage.listCms("systemUsers");
      const loginUser =
        systemUsers.find((user) => user.status === "active" && user.role === "owner") ??
        systemUsers.find((user) => user.status === "active");
      if (loginUser) {
        await storage.updateCms("systemUsers", loginUser.id, { lastLoginAt: new Date() });
        req.session.adminUserId = loginUser.id;
      }

      return req.session.save((error) => {
        if (error) return next(error);
        return res.json({ authenticated: true, user: loginUser ?? null });
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/admin/auth/logout", (req, res, next) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie("gdp_admin.sid");
      return res.json({ authenticated: false });
    });
  });

  app.get("/api/cms/public/settings", async (_req, res, next) => {
    try {
      const settings = await storage.getPublicSettings();
      const publicCmsEnabled = await effectivePublicCmsTakeoverEnabled(settings);
      res.json(settings.map((setting) => sanitizePublicSetting(setting, { publicCmsEnabled })));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/cms/public/site", async (_req, res, next) => {
    try {
      const [branding, menus, sidebars, colorPalettes, typography, settings] = await Promise.all([
        storage.listCms("branding"),
        storage.listCms("menus"),
        storage.listCms("sidebars"),
        storage.listCms("colorPalettes"),
        storage.listCms("typography"),
        storage.getPublicSettings(),
      ]);
      const primaryBranding = branding[0] ?? null;
      const publicCmsEnabled = await effectivePublicCmsTakeoverEnabled(settings);
      const publicSettings = settings.map((setting) => sanitizePublicSetting(setting, { publicCmsEnabled }));
      const publicMenus = menus
        .filter((menu) => menu.isActive)
        .map(sanitizePublicMenu)
        .filter((menu) => menu.items.length > 0);
      const publicSidebars = sidebars
        .filter((sidebar) => sidebar.isActive)
        .map(sanitizePublicSidebar)
        .filter((sidebar) => sidebar.widgets.length > 0);

      res.json({
        branding: sanitizePublicBranding(primaryBranding),
        identity: buildPublicBusinessIdentity({
          branding: primaryBranding,
          settings: publicSettings,
        }),
        menus: publicMenus,
        sidebars: publicSidebars,
        colorPalette: sanitizePublicColorPalette(colorPalettes.find((palette) => palette.isActive) ?? null),
        typography: sanitizePublicTypography(typography.find((typeStyle) => typeStyle.isActive) ?? null),
        settings: publicSettings,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/robots.txt", async (req, res, next) => {
    try {
      const baseUrl = await getCanonicalPublicBaseUrl(req);
      res.type("text/plain").send([
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        `Sitemap: ${baseUrl}/sitemap.xml`,
        "",
      ].join("\n"));
    } catch (error) {
      next(error);
    }
  });

  app.get("/sitemap.xml", async (req, res, next) => {
    try {
      const baseUrl = await getCanonicalPublicBaseUrl(req);
      const [pages, posts, settings] = await Promise.all([
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.getPublicSettings(),
      ]);
      const uniqueUrls = createPublicRouteEntries(pages, posts, {
        includeCmsRoutes: await effectivePublicCmsTakeoverEnabled(settings),
      });
      const body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...uniqueUrls.map((url) => {
          const loc = url.loc as string;
          const priority =
            loc === "/"
              ? "1.0"
              : loc.startsWith("/services/")
                ? "0.9"
                : loc === "/gallery"
                  ? "0.6"
                  : "0.8";
          return [
            "  <url>",
            `    <loc>${xmlEscape(`${baseUrl}${loc}`)}</loc>`,
            `    <lastmod>${url.updatedAt.toISOString()}</lastmod>`,
            "    <changefreq>monthly</changefreq>",
            `    <priority>${priority}</priority>`,
            "  </url>",
          ].join("\n");
        }),
        "</urlset>",
      ].join("\n");
      res.type("application/xml").send(body);
    } catch (error) {
      next(error);
    }
  });

  app.get("/rss.xml", async (req, res, next) => {
    try {
      const baseUrl = await getCanonicalPublicBaseUrl(req);
      const [blogPosts, brandingRecords, publicSettings] = await Promise.all([
        storage.listCms("blogPosts"),
        storage.listCms("branding"),
        storage.getPublicSettings(),
      ]);
      const identity = buildPublicBusinessIdentity({
        branding: brandingRecords[0] ?? null,
        settings: publicSettings,
      });
      const includeCmsRoutes = await effectivePublicCmsTakeoverEnabled(publicSettings);
      const posts = blogPosts
        .filter((post) => postIsPublicSitemapCandidate(post, { includeCmsRoutes }))
        .sort((a, b) => {
          const aDate = a.publishedAt ?? a.createdAt;
          const bDate = b.publishedAt ?? b.createdAt;
          return bDate.getTime() - aDate.getTime();
        });
      const body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0">',
        "  <channel>",
        `    <title>${xmlEscape(`${identity.siteName} Blog`)}</title>`,
        `    <description>${xmlEscape(identity.description)}</description>`,
        `    <link>${xmlEscape(`${baseUrl}/blog`)}</link>`,
        `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
        ...posts.map((post) => {
          const url = `${baseUrl}/blog/${encodeURIComponent(post.slug)}`;
          const publishedAt = post.publishedAt ?? post.createdAt;
          return [
            "    <item>",
            `      <title>${xmlEscape(post.title)}</title>`,
            `      <description>${xmlEscape(post.seo.metaDescription ?? post.excerpt ?? "")}</description>`,
            `      <link>${xmlEscape(url)}</link>`,
            `      <guid>${xmlEscape(url)}</guid>`,
            `      <pubDate>${publishedAt.toUTCString()}</pubDate>`,
            "    </item>",
          ].join("\n");
        }),
        "  </channel>",
        "</rss>",
      ].join("\n");
      res.type("application/rss+xml").send(body);
    } catch (error) {
      next(error);
    }
  });

  const publicCmsPageHandler: RequestHandler = async (req, res, next) => {
    try {
      const page = await storage.getPageBySlug(cmsSlugParam(req.params.slug));
      if (!page || page.status !== "published" || !pageHasIndexableRouteContent(page)) {
        return res.status(404).json({ message: "Page not found" });
      }
      return res.json(await expandReusableSections(page));
    } catch (error) {
      next(error);
    }
  };

  app.get("/api/cms/public/pages/:slug", publicCmsPageHandler);
  app.get("/api/cms/public/pages/{*slug}", publicCmsPageHandler);

  app.get("/api/cms/public/forms/:slug", async (req, res, next) => {
    try {
      const requestedSlug = req.params.slug.trim();
      const forms = await storage.listCms("forms");
      const form = forms.find((item) => item.slug.trim() === requestedSlug && item.isActive);
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }
      return res.json(publicFormResponse(form));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/cms/public/media", async (req, res, next) => {
    try {
      const media = await storage.listCms("media");
      const galleryOnly = req.query.gallery === "1" || req.query.gallery === "true";
      const category = typeof req.query.category === "string" ? req.query.category : "";
      const filtered = media
        .filter((item) => !galleryOnly || mediaIsGalleryReadyRecord(item))
        .filter((item) => !category || mediaMatchesGalleryCategory(item, category))
        .flatMap((item) => {
          const publicMedia = sanitizePublicMedia(item);
          return publicMedia ? [publicMedia] : [];
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json(filtered);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/cms/public/blog", async (_req, res, next) => {
    try {
      const [posts, mediaItems] = await Promise.all([
        storage.listCms("blogPosts"),
        storage.listCms("media"),
      ]);
      const mediaById = new Map(mediaItems.map((media) => [media.id, media]));
      const publishedPosts = posts
        .filter((post) => post.status === "published" && !post.seo.noIndex)
        .sort((a, b) => {
          const aDate = a.publishedAt ?? a.createdAt;
          const bDate = b.publishedAt ?? b.createdAt;
          return bDate.getTime() - aDate.getTime();
        })
        .map((post) => {
          const featuredImage = post.featuredImageId ? mediaById.get(post.featuredImageId) : null;
          return {
            ...post,
            featuredImage: featuredImage ? sanitizePublicMedia(featuredImage) : null,
          };
        });

      return res.json(publishedPosts);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/cms/public/blog/:slug", async (req, res, next) => {
    try {
      const post = await storage.getPostBySlug(req.params.slug);
      if (!post || post.status !== "published") {
        return res.status(404).json({ message: "Post not found" });
      }
      return res.json(await attachFeaturedImage(post));
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/admin", requireAdmin);

  app.get("/api/admin/system/export", async (_req, res, next) => {
    try {
      const exported = await createSystemExport();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-cms-export.json"');
      return res.json(exported);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/status", async (_req, res, next) => {
    try {
      const snapshot = await createSystemSnapshot();

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json({
        database: snapshot.environment.database,
        environment: snapshot.environment,
        collections: snapshot.collectionCounts,
        leads: snapshot.totals.leads,
        backups: snapshot.totals.backups,
        totals: snapshot.totals,
        crm: snapshot.crm,
        actionPlan: snapshot.actionPlan,
        migration: snapshot.migration,
        migrationActionQueue: snapshot.migrationActionQueue,
        media: snapshot.media,
        mediaActionQueue: snapshot.mediaActionQueue,
        sectionActionQueue: snapshot.sectionActionQueue,
        menuActionQueue: snapshot.menuActionQueue,
        sidebarActionQueue: snapshot.sidebarActionQueue,
        designActionQueue: snapshot.designActionQueue,
        systemActionQueue: snapshot.systemActionQueue,
        seo: snapshot.seo,
        structuredData: snapshot.structuredData,
        security: snapshot.security,
        publicIdentity: snapshot.publicIdentity,
        publicFrontendGuard: snapshot.publicFrontendGuard,
        publicFrontend: snapshot.publicFrontend,
        scope: snapshot.scope,
        readiness: snapshot.readiness,
        publicRoutes: snapshot.publicRoutes,
        publicForms: snapshot.publicForms,
        formSubmissionActionQueue: snapshot.formSubmissionActionQueue,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/build-progress", async (_req, res, next) => {
    try {
      const snapshot = await createSystemSnapshot();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-admin-build-progress.json"');
      return res.json(createAdminBuildProgressReport(snapshot));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/build-progress.csv", async (_req, res, next) => {
    try {
      const snapshot = await createSystemSnapshot();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-admin-build-progress.csv"');
      return res.send(adminBuildProgressCsv(createAdminBuildProgressReport(snapshot)));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/action-plan.csv", async (_req, res, next) => {
    try {
      const snapshot = await createSystemSnapshot();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-admin-action-plan.csv"');
      return res.send(adminActionPlanCsv(snapshot.actionPlan));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/action-plan", async (_req, res, next) => {
    try {
      const snapshot = await createSystemSnapshot();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-action-plan.json"');
      return res.json(createAdminActionPlanReport(snapshot.actionPlan));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/public-frontend", async (_req, res, next) => {
    try {
      const snapshot = await createSystemSnapshot();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-public-frontend-guard.json"');
      return res.json(snapshot.publicFrontendGuard);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/public-frontend.csv", async (_req, res, next) => {
    try {
      const snapshot = await createSystemSnapshot();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-public-frontend-guard.csv"');
      return res.send(publicFrontendGuardCsv(snapshot.publicFrontendGuard));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/readiness", async (_req, res, next) => {
    try {
      const report = await createReadinessReport();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-readiness-report.json"');
      return res.json(report);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/readiness.csv", async (_req, res, next) => {
    try {
      const report = await createReadinessReport();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-readiness-report.csv"');
      return res.send(readinessReportCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/documentation-runbook.md", async (_req, res, next) => {
    try {
      const snapshot = await createSystemSnapshot();
      const collections = snapshot.exported.collections as { documentation: CmsDocumentation[] };
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-cms-runbook.md"');
      return res.send(createDocumentationRunbookMarkdown(collections.documentation, snapshot));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/migration", async (_req, res, next) => {
    try {
      const [pages, blogPosts, sections, forms, media] = await Promise.all([
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("sections"),
        storage.listCms("forms"),
        storage.listCms("media"),
      ]);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-migration-coverage.json"');
      return res.json(createMigrationCoverageReport({ pages, blogPosts, sections, forms, media }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/migration.csv", async (_req, res, next) => {
    try {
      const [pages, blogPosts, sections, forms, media] = await Promise.all([
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("sections"),
        storage.listCms("forms"),
        storage.listCms("media"),
      ]);
      const report = createMigrationCoverageReport({ pages, blogPosts, sections, forms, media });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-migration-coverage.csv"');
      return res.send(migrationCoverageCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/migration-actions", async (_req, res, next) => {
    try {
      const [pages, blogPosts, sections, forms, media] = await Promise.all([
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("sections"),
        storage.listCms("forms"),
        storage.listCms("media"),
      ]);
      const report = createMigrationCoverageReport({ pages, blogPosts, sections, forms, media });
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-migration-action-queue.json"');
      return res.json({
        totals: report.totals,
        actionQueue: report.actionQueue,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/migration-actions.csv", async (_req, res, next) => {
    try {
      const [pages, blogPosts, sections, forms, media] = await Promise.all([
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("sections"),
        storage.listCms("forms"),
        storage.listCms("media"),
      ]);
      const report = createMigrationCoverageReport({ pages, blogPosts, sections, forms, media });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-migration-action-queue.csv"');
      return res.send(migrationActionQueueCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/visual-parity", async (_req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const [pages, blogPosts, sections, forms, media, settings, branding] = await Promise.all([
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("sections"),
        storage.listCms("forms"),
        storage.listCms("media"),
        storage.listCms("settings"),
        storage.listCms("branding"),
      ]);
      const report = createMigrationCoverageReport({ pages, blogPosts, sections, forms, media });
      const identity = buildPublicBusinessIdentity({
        branding: branding[0] ?? null,
        settings,
      });
      const siteSettingValue = settings.find((setting) => setting.key === "site")?.value ?? {};
      const routeReviews = normalizePublicCmsVisualParityRouteReviews(siteSettingValue.publicCmsVisualParityRouteReviews);
      return res.json(createVisualParityReviewReport(report, identity.siteUrl, routeReviews));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/visual-parity.csv", async (_req, res, next) => {
    try {
      const [pages, blogPosts, sections, forms, media, settings, branding] = await Promise.all([
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("sections"),
        storage.listCms("forms"),
        storage.listCms("media"),
        storage.listCms("settings"),
        storage.listCms("branding"),
      ]);
      const report = createMigrationCoverageReport({ pages, blogPosts, sections, forms, media });
      const identity = buildPublicBusinessIdentity({
        branding: branding[0] ?? null,
        settings,
      });
      const siteSettingValue = settings.find((setting) => setting.key === "site")?.value ?? {};
      const routeReviews = normalizePublicCmsVisualParityRouteReviews(siteSettingValue.publicCmsVisualParityRouteReviews);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-visual-parity-review.csv"');
      return res.send(visualParityReviewCsv(report, identity.siteUrl, routeReviews));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/system/launch-primary-routes", async (_req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      await seedStorageDefaults();
      const safetyBackup = await createSystemBackupSnapshot({
        name: `Pre-launch CMS route snapshot ${new Date().toLocaleString()}`,
        createdBy: "system",
        includeData: true,
        context: {
          trigger: "launch-primary-routes",
          note: "Automatic safety snapshot before primary CMS route launch repair or publish pass.",
        },
      });
      const mediaImport = await importPublicAssetMediaRecords({ referencedOnly: true });
      const now = new Date();
      const outcomes: Array<{
        slug: string;
        pageId: string | null;
        action: "created" | "repaired" | "published" | "already-live" | "blocked" | "skipped";
        issues: string[];
      }> = [];
      let created = 0;
      let repaired = 0;
      let published = 0;
      let alreadyLive = 0;

      for (const slug of primaryCmsRouteSlugs) {
        const pages = await storage.listCms("pages");
        const existingPage = pages.find((page) => page.slug === slug);
        let page = existingPage;
        let didCreate = false;
        let didRepair = false;

        if (!page) {
          const defaults = getDefaultCmsPageForSlug(slug, now);
          if (!defaults) {
            outcomes.push({ slug, pageId: null, action: "skipped", issues: ["No starter defaults are available for this route."] });
            continue;
          }
          page = await storage.createCms("pages", {
            ...defaults,
            excerpt: defaults.excerpt ?? null,
            status: "draft",
            publishedAt: null,
          });
          didCreate = true;
          created += 1;
        }

        const repairPayload = getStarterCmsPageRepairPayload(page, now);
        if (repairPayload) {
          const repairedPage = await storage.updateCms("pages", page.id, repairPayload);
          if (repairedPage) {
            page = repairedPage;
            didRepair = true;
            if (!didCreate) repaired += 1;
          }
        }

        const issues = await getPagePublishIssues(page);
        if (issues.length > 0 || page.content.sections.length === 0) {
          outcomes.push({
            slug,
            pageId: page.id,
            action: didCreate ? "created" : didRepair ? "repaired" : "blocked",
            issues: [
              ...(page.content.sections.length === 0 ? ["CMS sections are still missing."] : []),
              ...issues.map((issue) => issue.message),
            ],
          });
          continue;
        }

        if (page.status === "published") {
          outcomes.push({
            slug,
            pageId: page.id,
            action: didCreate || didRepair ? "repaired" : "already-live",
            issues: [],
          });
          alreadyLive += 1;
          continue;
        }

        const livePage = await storage.updateCms("pages", page.id, {
          status: "published",
          publishedAt: now,
        });
        outcomes.push({
          slug,
          pageId: livePage?.id ?? page.id,
          action: "published",
          issues: [],
        });
        published += 1;
      }

      const [pages, blogPosts, sections, forms, media] = await Promise.all([
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("sections"),
        storage.listCms("forms"),
        storage.listCms("media"),
      ]);
      const migration = createMigrationCoverageReport({ pages, blogPosts, sections, forms, media });

      return res.json({
        generatedAt: new Date().toISOString(),
        mediaImport: {
          imported: mediaImport.imported.length,
          skipped: mediaImport.skipped,
          missing: mediaImport.missing.length,
        },
        totals: {
          created,
          repaired,
          published,
          alreadyLive,
          blocked: outcomes.filter((outcome) => outcome.issues.length > 0).length,
          routes: outcomes.length,
        },
        outcomes,
        migration: migration.totals,
        safetyBackup: {
          id: safetyBackup.id,
          name: safetyBackup.name,
          status: safetyBackup.status,
          createdAt: safetyBackup.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/media-audit", async (_req, res, next) => {
    try {
      const [media, pages, blogPosts, sections, branding, sidebars] = await Promise.all([
        storage.listCms("media"),
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("sections"),
        storage.listCms("branding"),
        storage.listCms("sidebars"),
      ]);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-media-audit.json"');
      return res.json(createMediaAuditReport({ media, pages, blogPosts, sections, branding, sidebars }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/media-audit.csv", async (_req, res, next) => {
    try {
      const [media, pages, blogPosts, sections, branding, sidebars] = await Promise.all([
        storage.listCms("media"),
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("sections"),
        storage.listCms("branding"),
        storage.listCms("sidebars"),
      ]);
      const report = createMediaAuditReport({ media, pages, blogPosts, sections, branding, sidebars });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-media-audit.csv"');
      return res.send(mediaAuditCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/media-actions.csv", async (_req, res, next) => {
    try {
      const [media, pages, blogPosts, sections, branding, sidebars] = await Promise.all([
        storage.listCms("media"),
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("sections"),
        storage.listCms("branding"),
        storage.listCms("sidebars"),
      ]);
      const report = createMediaAuditReport({ media, pages, blogPosts, sections, branding, sidebars });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-media-action-queue.csv"');
      return res.send(mediaActionQueueCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/media-actions", async (_req, res, next) => {
    try {
      const [media, pages, blogPosts, sections, branding, sidebars] = await Promise.all([
        storage.listCms("media"),
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("sections"),
        storage.listCms("branding"),
        storage.listCms("sidebars"),
      ]);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-media-action-queue.json"');
      return res.json(createMediaAuditReport({ media, pages, blogPosts, sections, branding, sidebars }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/section-actions.csv", async (_req, res, next) => {
    try {
      const [sections, pages, forms, media] = await Promise.all([
        storage.listCms("sections"),
        storage.listCms("pages"),
        storage.listCms("forms"),
        storage.listCms("media"),
      ]);
      const report = createSectionActionReport({ sections, pages, forms, media });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-section-action-queue.csv"');
      return res.send(sectionActionQueueCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/section-actions", async (_req, res, next) => {
    try {
      const [sections, pages, forms, media] = await Promise.all([
        storage.listCms("sections"),
        storage.listCms("pages"),
        storage.listCms("forms"),
        storage.listCms("media"),
      ]);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-section-action-queue.json"');
      return res.json(createSectionActionReport({ sections, pages, forms, media }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/menu-actions.csv", async (_req, res, next) => {
    try {
      const [menus, pages, posts] = await Promise.all([
        storage.listCms("menus"),
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
      ]);
      const report = createMenuActionReport({ menus, pages, posts });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-menu-action-queue.csv"');
      return res.send(menuActionQueueCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/menu-actions", async (_req, res, next) => {
    try {
      const [menus, pages, posts] = await Promise.all([
        storage.listCms("menus"),
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
      ]);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-menu-action-queue.json"');
      return res.json(createMenuActionReport({ menus, pages, posts }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/sidebar-actions.csv", async (_req, res, next) => {
    try {
      const [sidebars, forms, branding, pages, posts, media] = await Promise.all([
        storage.listCms("sidebars"),
        storage.listCms("forms"),
        storage.listCms("branding"),
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("media"),
      ]);
      const report = createSidebarActionReport({
        sidebars,
        forms,
        branding: branding[0] ?? null,
        pages,
        posts,
        media,
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-sidebar-action-queue.csv"');
      return res.send(sidebarActionQueueCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/sidebar-actions", async (_req, res, next) => {
    try {
      const [sidebars, forms, branding, pages, posts, media] = await Promise.all([
        storage.listCms("sidebars"),
        storage.listCms("forms"),
        storage.listCms("branding"),
        storage.listCms("pages"),
        storage.listCms("blogPosts"),
        storage.listCms("media"),
      ]);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-sidebar-action-queue.json"');
      return res.json(createSidebarActionReport({
        sidebars,
        forms,
        branding: branding[0] ?? null,
        pages,
        posts,
        media,
      }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/design-actions.csv", async (_req, res, next) => {
    try {
      const [branding, colorPalettes, typography, media] = await Promise.all([
        storage.listCms("branding"),
        storage.listCms("colorPalettes"),
        storage.listCms("typography"),
        storage.listCms("media"),
      ]);
      const report = createDesignActionReport({ branding, colorPalettes, typography, media });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-design-action-queue.csv"');
      return res.send(designActionQueueCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/design-actions", async (_req, res, next) => {
    try {
      const [branding, colorPalettes, typography, media] = await Promise.all([
        storage.listCms("branding"),
        storage.listCms("colorPalettes"),
        storage.listCms("typography"),
        storage.listCms("media"),
      ]);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-design-action-queue.json"');
      return res.json(createDesignActionReport({ branding, colorPalettes, typography, media }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/system-actions.csv", async (_req, res, next) => {
    try {
      const [settings, documentation, systemBackups, systemUsers] = await Promise.all([
        storage.listCms("settings"),
        storage.listCms("documentation"),
        storage.listCms("systemBackups"),
        storage.listCms("systemUsers"),
      ]);
      const report = createSystemActionReport({ settings, documentation, systemBackups, systemUsers });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-system-action-queue.csv"');
      return res.send(systemActionQueueCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/system-actions", async (_req, res, next) => {
    try {
      const [settings, documentation, systemBackups, systemUsers] = await Promise.all([
        storage.listCms("settings"),
        storage.listCms("documentation"),
        storage.listCms("systemBackups"),
        storage.listCms("systemUsers"),
      ]);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-system-action-queue.json"');
      return res.json(createSystemActionReport({ settings, documentation, systemBackups, systemUsers }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/backups/catalog", async (_req, res, next) => {
    try {
      const backups = await storage.listCms("systemBackups");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-backup-catalog.json"');
      return res.json(createBackupCatalog(backups));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/backups/catalog.csv", async (_req, res, next) => {
    try {
      const backups = await storage.listCms("systemBackups");
      const catalog = createBackupCatalog(backups);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-backup-catalog.csv"');
      return res.send(backupCatalogCsv(catalog));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/forms/submissions/report", async (_req, res, next) => {
    try {
      const [submissions, forms, leads] = await Promise.all([
        storage.listCms("formSubmissions"),
        storage.listCms("forms"),
        storage.listLeads(),
      ]);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json(createFormSubmissionReport(submissions, forms, leads));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/forms/submissions/report.csv", async (_req, res, next) => {
    try {
      const [submissions, forms, leads] = await Promise.all([
        storage.listCms("formSubmissions"),
        storage.listCms("forms"),
        storage.listLeads(),
      ]);
      const report = createFormSubmissionReport(submissions, forms, leads);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-form-submissions.csv"');
      return res.send(formSubmissionReportCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/forms/submissions/actions.csv", async (_req, res, next) => {
    try {
      const [submissions, forms, leads] = await Promise.all([
        storage.listCms("formSubmissions"),
        storage.listCms("forms"),
        storage.listLeads(),
      ]);
      const report = createFormSubmissionReport(submissions, forms, leads);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-form-submission-action-queue.csv"');
      return res.send(formSubmissionActionQueueCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/forms/submissions/clear-stale-leads", async (_req, res, next) => {
    try {
      const [submissions, leads] = await Promise.all([
        storage.listCms("formSubmissions"),
        storage.listLeads(),
      ]);
      const leadIds = new Set(leads.map((lead) => lead.id));
      const staleSubmissions = submissions.filter((submission) => submission.leadId && !leadIds.has(submission.leadId));
      const cleared = await Promise.all(
        staleSubmissions.map((submission) =>
          storage.updateCms("formSubmissions", submission.id, {
            leadId: null,
            status: submission.status === "lead-created" ? "new" : submission.status,
          }),
        ),
      );

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json({
        requested: staleSubmissions.length,
        cleared: cleared.filter(Boolean).length,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/forms/submissions/bulk-status", async (req, res, next) => {
    try {
      const value = bulkFormSubmissionStatusSchema.parse(req.body);
      const uniqueIds = Array.from(new Set(value.ids));
      const updated: CmsFormSubmission[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];

      for (const id of uniqueIds) {
        const submission = await storage.getCms("formSubmissions", id);
        if (!submission) {
          skipped.push({ id, reason: "Submission not found." });
          continue;
        }

        const issues = await getFormSubmissionIssues({ ...submission, status: value.status });
        if (issues.length > 0) {
          skipped.push({ id, reason: issues.join(" ") });
          continue;
        }

        const nextSubmission = await storage.updateCms("formSubmissions", id, { status: value.status });
        if (!nextSubmission) {
          skipped.push({ id, reason: "Submission could not be updated." });
          continue;
        }
        updated.push(nextSubmission);
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json({
        requested: uniqueIds.length,
        updated,
        skipped,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/forms/submissions/:id/create-lead", async (req, res, next) => {
    try {
      const submission = await storage.getCms("formSubmissions", req.params.id);
      if (!submission) return res.status(404).json({ message: "Submission not found" });

      const initialStage = (await getConfiguredLeadPipelineStages())[0] ?? "new";
      const result = await createLeadFromFormSubmission(submission, initialStage);
      if (result.skipped) {
        return res.status(result.reason.startsWith("Email or phone") ? 400 : 409).json({ message: result.reason });
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(201).json({ lead: result.lead, submission: result.submission });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/forms/submissions/bulk-create-leads", async (req, res, next) => {
    try {
      const value = bulkCreateSubmissionLeadsSchema.parse(req.body);
      const uniqueIds = Array.from(new Set(value.ids));
      const initialStage = (await getConfiguredLeadPipelineStages())[0] ?? "new";
      const converted: Array<{ id: string; lead: CrmLead; submission: CmsFormSubmission }> = [];
      const skipped: Array<{ id: string; reason: string }> = [];

      for (const id of uniqueIds) {
        const submission = await storage.getCms("formSubmissions", id);
        if (!submission) {
          skipped.push({ id, reason: "Submission not found." });
          continue;
        }
        const result = await createLeadFromFormSubmission(submission, initialStage);
        if (result.skipped) {
          skipped.push({ id, reason: result.reason });
          continue;
        }
        converted.push({ id, lead: result.lead, submission: result.submission });
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(201).json({
        requested: uniqueIds.length,
        converted,
        skipped,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/cms/media/import-public-assets", async (_req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(201).json(await importPublicAssetMediaRecords());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/cms/media/import-referenced-assets", async (_req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(201).json(await importPublicAssetMediaRecords({ referencedOnly: true }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/cms/media/upload", async (req, res, next) => {
    try {
      const value = uploadMediaSchema.parse(req.body);
      const extension = uploadMimeExtensions.get(value.mimeType);
      if (!extension) {
        return res.status(415).json({ message: "Unsupported media type" });
      }

      const data = value.dataUrl.includes(",") ? value.dataUrl.split(",").at(-1) : value.dataUrl;
      if (!data) {
        return res.status(400).json({ message: "Upload data is missing" });
      }

      const buffer = Buffer.from(data, "base64");
      if (buffer.length === 0) {
        return res.status(400).json({ message: "Upload data is empty" });
      }
      if (buffer.length > 8 * 1024 * 1024) {
        return res.status(413).json({ message: "Uploads must be 8 MB or smaller" });
      }

      const uploadDir = path.join(getWritablePublicRoot(), "uploads", "cms");
      await fs.mkdir(uploadDir, { recursive: true });
      const baseName = sanitizeUploadBaseName(value.filename);
      const storedName = `${baseName}-${Date.now()}${extension}`;
      const filePath = path.join(uploadDir, storedName);
      await fs.writeFile(filePath, buffer);

      const url = `/uploads/cms/${storedName}`;
      const stat = await fs.stat(filePath);
      const dimensions = value.mimeType.startsWith("image/")
        ? await getImageDimensions(filePath)
        : { width: null, height: null };
      const media = await storage.createCms("media", {
        name: mediaNameFromUrl(value.filename),
        url,
        mimeType: value.mimeType,
        altText: value.altText ?? mediaNameFromUrl(value.filename),
        caption: value.caption ?? "",
        category: "",
        tags: [],
        isGalleryReady: false,
        sizeBytes: stat.size,
        width: dimensions.width,
        height: dimensions.height,
      });

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(201).json(media);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/cms/media/bulk", async (req, res, next) => {
    try {
      const value = bulkMediaActionSchema.parse(req.body);
      const uniqueIds = Array.from(new Set(value.ids));
      const requestedMedia = await Promise.all(uniqueIds.map((id) => storage.getCms("media", id)));
      const missingIds = uniqueIds.filter((id, index) => !requestedMedia[index]);
      const mediaItems = requestedMedia.filter(Boolean) as CmsMedia[];
      const updated: CmsMedia[] = [];
      const skipped: Array<{ id: string; reason: string }> = missingIds.map((id) => ({ id, reason: "Media record not found." }));

      for (const media of mediaItems) {
        if (value.action === "refresh-metadata") {
          const localFile = await findLocalMediaFilePath(media.url);
          if (!localFile) {
            skipped.push({ id: media.id, reason: "Local media file could not be found for this URL." });
            continue;
          }
          const dimensions = mediaIsImage(media) ? await getImageDimensions(localFile.filePath) : { width: null, height: null };
          const nextMedia = await storage.updateCms("media", media.id, {
            sizeBytes: localFile.sizeBytes,
            width: dimensions.width,
            height: dimensions.height,
          });
          if (!nextMedia) {
            skipped.push({ id: media.id, reason: "Media metadata could not be updated." });
            continue;
          }
          updated.push(nextMedia);
          continue;
        }

        if (value.action !== "fill-alt" && value.action !== "remove-gallery" && !mediaIsImage(media)) {
          skipped.push({ id: media.id, reason: "Only image media can be changed for this action." });
          continue;
        }
        if (value.action === "fill-alt" && (!mediaIsImage(media) || media.altText?.trim())) {
          skipped.push({ id: media.id, reason: "Media does not need generated alt text." });
          continue;
        }
        if (value.action === "remove-gallery" && !mediaIsGalleryReadyRecord(media)) {
          skipped.push({ id: media.id, reason: "Media is not gallery-ready." });
          continue;
        }

        const currentCaption = media.caption?.trim() ?? "";
        const baseCaption = cleanGalleryCaptionBase(currentCaption, media.name);
        const inferredCategory = inferMediaGalleryCategory(media);
        const update =
          value.action === "fill-alt"
            ? { altText: mediaGeneratedAltText(media) }
            : value.action === "remove-gallery"
              ? {
                  caption: baseCaption === media.name ? "" : baseCaption,
                  category: null,
                  isGalleryReady: false,
                }
              : value.action === "category"
                ? {
                    caption: `Gallery - ${value.category} - ${baseCaption}`,
                    category: value.category,
                    isGalleryReady: true,
                    ...(media.altText?.trim() ? {} : { altText: mediaGeneratedAltText(media) }),
                  }
                : {
                    caption: currentCaption.toLowerCase().includes("gallery")
                      ? currentCaption
                      : inferredCategory
                        ? `Gallery - ${inferredCategory} - ${currentCaption || media.name}`
                        : `Gallery - ${currentCaption || media.name}`,
                    ...(inferredCategory ? { category: inferredCategory } : {}),
                    isGalleryReady: true,
                    ...(media.altText?.trim() ? {} : { altText: mediaGeneratedAltText(media) }),
                  };

        const issues = getMediaSaveIssues({ ...media, ...update });
        if (issues.length > 0) {
          skipped.push({ id: media.id, reason: issues.join(" ") });
          continue;
        }

        const nextMedia = await storage.updateCms("media", media.id, update);
        if (!nextMedia) {
          skipped.push({ id: media.id, reason: "Media record could not be updated." });
          continue;
        }
        updated.push(nextMedia);
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json({
        action: value.action,
        requested: uniqueIds.length,
        updated,
        skipped,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/seo/audit", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json(await createSeoAudit(req));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/seo/audit.csv", async (req, res, next) => {
    try {
      const audit = await createSeoAudit(req);
      const issueMap = audit.issues.reduce<Record<string, string[]>>((issuesById, issue) => {
        issuesById[issue.id] = [...(issuesById[issue.id] ?? []), issue.issue];
        return issuesById;
      }, {});
      const headers = [
        "type",
        "title",
        "status",
        "url",
        "metaTitle",
        "metaDescription",
        "canonicalUrl",
        "noIndex",
        "inSitemap",
        "structuredData",
        "issueCount",
        "priorityLabel",
        "nextAction",
        "issues",
        "updatedAt",
      ];
      const rows = audit.records.map((record) =>
        [
          record.type,
          record.title,
          record.status,
          record.url,
          record.metaTitle,
          record.metaDescription,
          record.canonicalUrl,
          record.noIndex,
          record.inSitemap,
          Array.isArray(record.structuredData) ? record.structuredData.join("; ") : "",
          record.issueCount,
          record.priorityLabel,
          record.nextAction,
          (issueMap[record.id] ?? []).join("; "),
          new Date(record.updatedAt).toISOString(),
        ].map(csvValue).join(","),
      );

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-seo-audit.csv"');
      return res.send([headers.join(","), ...rows].join("\n"));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/system/backups", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const value = createBackupSnapshotSchema.parse(req.body);
      const backup = await createSystemBackupSnapshot({
        name: value.name || `System Snapshot ${new Date().toLocaleDateString()}`,
        createdBy: value.createdBy || "admin",
        includeData: value.includeData !== false,
      });
      return res.status(201).json(backup);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/backups/:id/export", async (req, res, next) => {
    try {
      const backup = await storage.getCms("systemBackups", req.params.id);
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      const filename = `${sanitizeUploadBaseName(backup.name)}-manifest.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.json({
        exportedAt: new Date().toISOString(),
        source: "Glass & Door Pro Admin",
        backup,
        manifest: backup.manifest,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/backups/:id/data-export", async (req, res, next) => {
    try {
      const backup = await storage.getCms("systemBackups", req.params.id);
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      const snapshot = backup.manifest.snapshot;
      if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== "object") {
        return res.status(404).json({ message: "Backup does not include point-in-time data" });
      }

      const filename = `${sanitizeUploadBaseName(backup.name)}-data-export.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.json(snapshot);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/backups/:id/restore-preview", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const backup = await storage.getCms("systemBackups", req.params.id);
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      return res.json(createBackupRestorePreview(backup.manifest));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/backups/:id/restore-plan", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const backup = await storage.getCms("systemBackups", req.params.id);
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      return res.json(createBackupRestorePlan(backup.manifest, await createSystemSnapshot()));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/system/backups/:id/restore-plan.csv", async (req, res, next) => {
    try {
      const backup = await storage.getCms("systemBackups", req.params.id);
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      const plan = createBackupRestorePlan(backup.manifest, await createSystemSnapshot());
      const filename = `${sanitizeUploadBaseName(backup.name)}-restore-plan.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(backupRestorePlanCsv(plan));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/system/backups/:id/restore", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const backup = await storage.getCms("systemBackups", req.params.id);
      if (!backup) {
        return res.status(404).json({ message: "Backup not found" });
      }

      const value = restoreBackupSchema.parse(req.body);
      const requiredConfirmation = restoreConfirmationForBackup(backup);
      if (value.confirmation !== requiredConfirmation) {
        return res.status(400).json({
          message: "Backup restore confirmation did not match.",
          requiredConfirmation,
        });
      }

      const preview = createBackupRestorePreview(backup.manifest);
      if (!preview.restorable) {
        return res.status(409).json({
          message: "Backup snapshot is not restorable.",
          blockers: preview.blockers,
        });
      }

      const preRestoreSnapshot = await createSystemSnapshot();
      const preRestoreBackup = await storage.createCms("systemBackups", {
        name: `Pre-restore safety snapshot ${new Date().toLocaleString()}`,
        status: "ready",
        createdBy: req.session.adminUserId ?? "admin",
        manifest: {
          generatedAt: preRestoreSnapshot.exported.exportedAt,
          source: "Glass & Door Pro Admin",
          environment: preRestoreSnapshot.environment,
          collections: cmsCollectionNames,
          collectionCounts: preRestoreSnapshot.collectionCounts,
          totals: preRestoreSnapshot.totals,
          readiness: preRestoreSnapshot.readiness,
          publicRoutes: preRestoreSnapshot.publicRoutes,
          structuredData: preRestoreSnapshot.structuredData,
          crm: {
            leads: preRestoreSnapshot.totals.leads,
          },
          dataIncluded: true,
          snapshot: preRestoreSnapshot.exported,
          restoreContext: {
            backupId: backup.id,
            backupName: backup.name,
            includeCrm: value.includeCrm,
          },
        },
      });

      const collections = snapshotCollectionsForRestore(backup.manifest);
      const leads = value.includeCrm ? snapshotLeadsForRestore(backup.manifest) : undefined;
      await storage.restoreSnapshot(collections, leads);

      await storage.updateCms("systemBackups", backup.id, {
        status: "restored",
        manifest: {
          ...backup.manifest,
          lastRestoredAt: new Date().toISOString(),
          lastRestore: {
            restoredAt: new Date().toISOString(),
            includeCrm: value.includeCrm,
            preRestoreBackupId: preRestoreBackup.id,
          },
        },
      });

      const restoredCollections = Object.fromEntries(
        Object.entries(collections).map(([collection, records]) => [collection, records.length]),
      );

      return res.json({
        restored: true,
        backupId: backup.id,
        backupName: backup.name,
        includeCrm: value.includeCrm,
        restoredCollections,
        leadsRestored: leads?.length ?? null,
        preRestoreBackup: {
          id: preRestoreBackup.id,
          name: preRestoreBackup.name,
        },
        restoredAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cms/pages/:id/preview", async (req, res, next) => {
    try {
      const page = await storage.getCms("pages", req.params.id);
      if (!page) return res.status(404).json({ message: "Page not found" });
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json(await expandReusableSections(page));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cms/sections/:id/preview", async (req, res, next) => {
    try {
      const section = await storage.getCms("sections", req.params.id);
      if (!section) return res.status(404).json({ message: "Section not found" });
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json(await expandReusableSectionPreview(section));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cms/blogPosts/:id/preview", async (req, res, next) => {
    try {
      const post = await storage.getCms("blogPosts", req.params.id);
      if (!post) return res.status(404).json({ message: "Post not found" });
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json(await attachFeaturedImage(post));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cms/:collection", async (req, res, next) => {
    try {
      const collection = collectionParamSchema.parse(req.params.collection);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.json(await storage.listCms(collection));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cms/:collection/:id", async (req, res, next) => {
    try {
      const collection = collectionParamSchema.parse(req.params.collection);
      const record = await storage.getCms(collection, req.params.id);
      if (!record) return res.status(404).json({ message: "Record not found" });
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json(record);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/cms/:collection", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const collection = collectionParamSchema.parse(req.params.collection);
      const value = normalizeCmsWriteValue(collection, cmsSchemas[collection].parse(req.body) as Record<string, unknown>);
      const uniqueConflict = await getCmsUniqueConflict(collection, value);
      if (uniqueConflict) {
        return res.status(409).json(uniqueConflict);
      }
      if (collection === "documentation") {
        const issues = getDocumentationSaveIssues(value as Partial<CmsDocumentation>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve documentation issues before saving this note.",
            issues,
          });
        }
      }
      if (collection === "systemBackups") {
        const issues = getSystemBackupSaveIssues(value as Partial<CmsSystemBackup>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve backup manifest issues before saving this backup.",
            issues,
          });
        }
      }
      if (collection === "systemUsers") {
        const issues = getSystemUserSaveIssues(value as Partial<CmsSystemUser>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve system user access issues before saving this user.",
            issues,
          });
        }
      }
      if (collection === "pages") {
        const pageValue = value as Partial<CmsPage>;
        const saveIssues = getPageSaveIssues(pageValue);
        if (saveIssues.length > 0) {
          return res.status(409).json({
            message: "Resolve page readiness issues before saving this page.",
            issues: saveIssues,
          });
        }
        if (pageValue.status === "published") {
          const issues = await getPagePublishIssues({
            id: "",
            title: pageValue.title ?? "",
            slug: pageValue.slug ?? "",
            status: "published",
            excerpt: pageValue.excerpt ?? null,
            content: pageValue.content ?? { sections: [] },
            seo: pageValue.seo ?? {},
            publishedAt: pageValue.publishedAt ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          if (issues.length > 0) {
            return res.status(409).json({
              message: "Resolve publish readiness issues before publishing this page.",
              issues,
            });
          }
        }
      }
      if (collection === "blogPosts") {
        const blogValue = value as BlogPublishCandidate & { status?: string };
        const saveIssues = await getBlogPostSaveIssues(blogValue);
        if (saveIssues.length > 0) {
          return res.status(409).json({
            message: "Resolve blog readiness issues before saving this blog post.",
            issues: saveIssues,
          });
        }
        if (blogValue.status !== "published") {
          const record = await storage.createCms(collection, value as never);
          await enforceActiveCmsSingleton(collection, record);
          return res.status(201).json(record);
        }
        const issues = await getBlogPostPublishIssues(blogValue);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve publish readiness issues before publishing this blog post.",
            issues,
          });
        }
      }
      if (collection === "forms") {
        const formValue = value as Partial<CmsForm>;
        const candidate = {
          name: formValue.name,
          slug: formValue.slug,
          notificationEmail: formValue.notificationEmail,
          fields: formValue.fields ?? [],
          isActive: formValue.isActive ?? true,
        };
        const issues = getFormSaveIssues(candidate);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve form readiness issues before saving this form.",
            issues,
          });
        }
      }
      if (collection === "formSubmissions") {
        const issues = await getFormSubmissionIssues(value as Partial<CmsFormSubmission>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve submission issues before saving this form submission.",
            issues,
          });
        }
      }
      if (collection === "media") {
        const issues = getMediaSaveIssues(value as Partial<CmsMedia>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve media readiness issues before saving this media item.",
            issues,
          });
        }
      }
      if (collection === "branding") {
        const mediaItems = await storage.listCms("media");
        const issues = getBrandingSaveIssues(value as Partial<CmsBranding>, mediaItems);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve brand asset and social link issues before saving branding.",
            issues,
          });
        }
        const existingBranding = await storage.listCms("branding");
        if (existingBranding.length > 0) {
          return res.status(409).json({
            message: "Branding is a singleton. Update the existing Glass & Door Pro brand profile instead.",
            existingId: existingBranding[0].id,
          });
        }
      }
      if (collection === "settings") {
        const issues = getSettingSaveIssues(value as Partial<CmsSetting>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve setting issues before saving this setting.",
            issues,
          });
        }
        if (settingValueEnablesPublicCms(value as Partial<CmsSetting>)) {
          const blockers = await getPublicCmsTakeoverBlockers(getCandidateSiteSettingValue(value as Partial<CmsSetting>) ?? undefined);
          if (blockers.length > 0) {
            return res.status(409).json({
              message: "Public CMS takeover is blocked until visual parity is approved and all primary routes are migration-ready.",
              blockers,
            });
          }
        }
      }
      if (collection === "menus") {
        const menuValue = value as Partial<CmsMenu>;
        const candidate = {
          name: menuValue.name,
          items: menuValue.items ?? [],
          location: menuValue.location ?? "",
          isActive: menuValue.isActive ?? true,
        };
        const [pages, posts] = await Promise.all([
          storage.listCms("pages"),
          storage.listCms("blogPosts"),
        ]);
        const issues = getMenuReadinessIssues(candidate, pages, posts);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve navigation issues before activating this menu.",
            issues,
          });
        }
      }
      if (collection === "sidebars") {
        const sidebarValue = value as Partial<CmsSidebar>;
        const [forms, brandingRecords, pages, posts, mediaItems] = await Promise.all([
          storage.listCms("forms"),
          storage.listCms("branding"),
          storage.listCms("pages"),
          storage.listCms("blogPosts"),
          storage.listCms("media"),
        ]);
        const candidate = {
          name: sidebarValue.name,
          widgets: sidebarValue.widgets ?? [],
          location: sidebarValue.location ?? "",
          isActive: sidebarValue.isActive ?? true,
        };
        const issues = getSidebarActivationIssues(candidate, forms, brandingRecords[0] ?? null, pages, posts, mediaItems);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve widget issues before activating this sidebar.",
            issues,
          });
        }
      }
      if (collection === "sections") {
        const issues = getSectionSaveIssues(value as Partial<CmsSection>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve section readiness issues before saving this section.",
            issues,
          });
        }
      }
      if (collection === "colorPalettes") {
        const issues = getColorPaletteTokenIssues(value as Partial<CmsColorPalette>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve color token issues before saving this palette.",
            issues,
          });
        }
      }
      if (collection === "typography") {
        const issues = getTypographySaveIssues(value as Partial<CmsTypography>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve typography issues before saving this type style.",
            issues,
          });
        }
      }
      const record = await storage.createCms(collection, value as never);
      await enforceActiveCmsSingleton(collection, record);
      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/cms/:collection/:id", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const collection = collectionParamSchema.parse(req.params.collection);
      const parsedPayload = cmsSchemas[collection].partial().parse(req.body) as Record<string, unknown>;
      const value = normalizeCmsWriteValue(collection, parsedPayload);
      let currentSetting: CmsSetting | null | undefined;

      if (collection === "settings") {
        const settingId = req.params.id;
        currentSetting = await storage.getCms("settings", settingId);
        if (!currentSetting) {
          return res.status(404).json({ message: "Record not found" });
        }

        const settingValue = value as { key?: string; value?: Record<string, unknown> };
        const effectiveKey = (typeof settingValue.key === "string" && settingValue.key.trim()) || currentSetting.key;
        if (
          effectiveKey === "site" &&
          settingValue.value &&
          typeof settingValue.value === "object" &&
          !Array.isArray(settingValue.value)
        ) {
          settingValue.value = normalizeSiteSettingValueForSave(settingValue.value);
        }
      }

      const uniqueConflict = await getCmsUniqueConflict(collection, value, req.params.id);
      if (uniqueConflict) {
        return res.status(409).json(uniqueConflict);
      }
      if (collection === "pages") {
        const pageValue = value as Partial<CmsPage>;
        const current = await storage.getCms("pages", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const candidate = { ...current, ...pageValue } as CmsPage;
        const saveIssues = getPageSaveIssues(candidate);
        if (saveIssues.length > 0) {
          return res.status(409).json({
            message: "Resolve page readiness issues before saving this page.",
            issues: saveIssues,
          });
        }
        if (candidate.status === "published") {
          const issues = await getPagePublishIssues(candidate);
          if (issues.length > 0) {
            return res.status(409).json({
              message: "Resolve publish readiness issues before saving this published page.",
              issues,
            });
          }
        }
      }
      if (collection === "blogPosts") {
        const postValue = value as Partial<CmsBlogPost>;
        const current = await storage.getCms("blogPosts", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const candidate = { ...current, ...postValue } as CmsBlogPost;
        const saveIssues = await getBlogPostSaveIssues(candidate);
        if (saveIssues.length > 0) {
          return res.status(409).json({
            message: "Resolve blog readiness issues before saving this blog post.",
            issues: saveIssues,
          });
        }
        if (candidate.status === "published") {
          const issues = await getBlogPostPublishIssues(candidate);
          if (issues.length > 0) {
            return res.status(409).json({
              message: "Resolve publish readiness issues before saving this published blog post.",
              issues,
            });
          }
        }
      }
      if (collection === "colorPalettes") {
        const paletteValue = value as Partial<CmsColorPalette>;
        const current = await storage.getCms("colorPalettes", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const issues = getColorPaletteTokenIssues(paletteValue);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve color token issues before saving this palette.",
            issues,
          });
        }
        const activeCount = (await storage.listCms("colorPalettes")).filter((item) => item.isActive).length;
        if (current.isActive && paletteValue.isActive === false && activeCount <= 1) {
          return res.status(409).json({ message: "At least one active color palette is required." });
        }
      }
      if (collection === "typography") {
        const typographyValue = value as Partial<CmsTypography>;
        const current = await storage.getCms("typography", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const issues = getTypographySaveIssues({ ...current, ...typographyValue });
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve typography issues before saving this type style.",
            issues,
          });
        }
        const activeCount = (await storage.listCms("typography")).filter((item) => item.isActive).length;
        if (current.isActive && typographyValue.isActive === false && activeCount <= 1) {
          return res.status(409).json({ message: "At least one active typography set is required." });
        }
      }
      if (collection === "forms") {
        const formValue = value as Partial<CmsForm>;
        const current = await storage.getCms("forms", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const candidate = {
          name: formValue.name ?? current.name,
          slug: formValue.slug ?? current.slug,
          notificationEmail: formValue.notificationEmail ?? current.notificationEmail,
          fields: formValue.fields ?? current.fields,
          isActive: formValue.isActive ?? current.isActive,
        };
        const issues = getFormSaveIssues(candidate);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve form readiness issues before saving this form.",
            issues,
          });
        }
        if (!candidate.isActive) {
          const { usage } = await getFormUsage(req.params.id);
          const activeUsage = usage.filter((item) => item.status === "published" || item.status === "active");
          if (activeUsage.length > 0) {
            return res.status(409).json({
              message: "This form is used by published CMS pages or active sidebars and cannot be deactivated.",
              usage: activeUsage,
            });
          }
        }
      }
      if (collection === "formSubmissions") {
        const current = await storage.getCms("formSubmissions", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const issues = await getFormSubmissionIssues({ ...current, ...value } as Partial<CmsFormSubmission>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve submission issues before saving this form submission.",
            issues,
          });
        }
      }
      if (collection === "media") {
        const current = await storage.getCms("media", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const issues = getMediaSaveIssues({ ...current, ...value } as Partial<CmsMedia>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve media readiness issues before saving this media item.",
            issues,
          });
        }
      }
      if (collection === "branding") {
        const current = await storage.getCms("branding", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const mediaItems = await storage.listCms("media");
        const issues = getBrandingSaveIssues({ ...current, ...value } as Partial<CmsBranding>, mediaItems);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve brand asset and social link issues before saving branding.",
            issues,
          });
        }
      }
      if (collection === "menus") {
        const menuValue = value as Partial<CmsMenu>;
        const current = await storage.getCms("menus", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const candidate = {
          name: menuValue.name ?? current.name,
          items: menuValue.items ?? current.items,
          location: menuValue.location ?? current.location,
          isActive: menuValue.isActive ?? current.isActive,
        };
        const removesCoreMenu =
          current.isActive &&
          (current.location === "header" || current.location === "footer") &&
          (!candidate.isActive || candidate.location !== current.location);
        const activeAtCurrentLocation = removesCoreMenu
          ? (await storage.listCms("menus")).filter((menu) => menu.id !== current.id && menu.location === current.location && menu.isActive).length
          : 1;
        if (removesCoreMenu && activeAtCurrentLocation === 0) {
          return res.status(409).json({ message: `At least one active ${current.location} menu is required.` });
        }
        const [pages, posts] = await Promise.all([
          storage.listCms("pages"),
          storage.listCms("blogPosts"),
        ]);
        const issues = getMenuReadinessIssues(candidate, pages, posts);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve navigation issues before activating this menu.",
            issues,
          });
        }
      }
      if (collection === "sidebars") {
        const sidebarValue = value as Partial<CmsSidebar>;
        const current = await storage.getCms("sidebars", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const [forms, brandingRecords, pages, posts, mediaItems] = await Promise.all([
          storage.listCms("forms"),
          storage.listCms("branding"),
          storage.listCms("pages"),
          storage.listCms("blogPosts"),
          storage.listCms("media"),
        ]);
        const candidate = {
          name: sidebarValue.name ?? current.name,
          widgets: sidebarValue.widgets ?? current.widgets,
          location: sidebarValue.location ?? current.location,
          isActive: sidebarValue.isActive ?? current.isActive,
        };
        const removesCoreSidebar =
          current.isActive &&
          (current.location === "default" || current.location === "blog") &&
          (!candidate.isActive || candidate.location !== current.location);
        const activeAtCurrentLocation = removesCoreSidebar
          ? (await storage.listCms("sidebars")).filter((sidebar) => sidebar.id !== current.id && sidebar.location === current.location && sidebar.isActive).length
          : 1;
        if (removesCoreSidebar && activeAtCurrentLocation === 0) {
          return res.status(409).json({ message: `At least one active ${current.location} sidebar is required.` });
        }
        const issues = getSidebarActivationIssues(candidate, forms, brandingRecords[0] ?? null, pages, posts, mediaItems);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve widget issues before activating this sidebar.",
            issues,
          });
        }
      }
      if (collection === "sections") {
        const sectionValue = value as Partial<CmsSection>;
        const current = await storage.getCms("sections", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const candidate = { ...current, ...sectionValue } as CmsSection;
        const saveIssues = getSectionSaveIssues(candidate);
        if (saveIssues.length > 0) {
          return res.status(409).json({
            message: "Resolve section readiness issues before saving this section.",
            issues: saveIssues,
          });
        }
        const [sections, forms, mediaItems, pages] = await Promise.all([
          storage.listCms("sections"),
          storage.listCms("forms"),
          storage.listCms("media"),
          storage.listCms("pages"),
        ]);
        const nextSections = sections.map((section) => (section.id === candidate.id ? candidate : section));
        const sectionUsage = pages
          .map((page) => ({
            id: page.id,
            title: page.title,
            slug: page.slug,
            status: page.status,
            currentMatches: countSectionReferences(page, current, sections),
            candidateMatches: countSectionReferences(page, candidate, nextSections),
          }))
          .filter((usage) => usage.currentMatches > 0 || usage.candidateMatches > 0);
        const publishedUsage = sectionUsage.filter((usage) => usage.status === "published");

        if (publishedUsage.length > 0) {
          const issues = getSectionDependencyIssues(candidate, nextSections, forms, mediaItems);
          const brokenPublishedReferences = publishedUsage.filter(
            (usage) => usage.currentMatches > 0 && usage.candidateMatches === 0,
          );

          if (brokenPublishedReferences.length > 0) {
            issues.unshift({
              blockIndex: -1,
              blockType: "sectionRef",
              message: `Changing this section handle would break ${brokenPublishedReferences.length} published page reference${
                brokenPublishedReferences.length === 1 ? "" : "s"
              }. Update those pages before changing the handle.`,
            });
          }

          if (issues.length > 0) {
            return res.status(409).json({
              message: "Resolve section readiness issues before updating a section used by published pages.",
              issues,
              usage: publishedUsage,
            });
          }
        }
      }
      if (collection === "documentation") {
        const current = await storage.getCms("documentation", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const issues = getDocumentationSaveIssues({ ...current, ...value } as Partial<CmsDocumentation>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve documentation issues before saving this note.",
            issues,
          });
        }
      }
      if (collection === "systemBackups") {
        const current = await storage.getCms("systemBackups", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const issues = getSystemBackupSaveIssues({ ...current, ...value } as Partial<CmsSystemBackup>);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve backup manifest issues before saving this backup.",
            issues,
          });
        }
      }
      if (collection === "systemUsers") {
        const userValue = value as Partial<CmsSystemUser>;
        const current = await storage.getCms("systemUsers", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const candidate = { ...current, ...userValue };
        const issues = getSystemUserSaveIssues(candidate);
        if (issues.length > 0) {
          return res.status(409).json({
            message: "Resolve system user access issues before saving this user.",
            issues,
          });
        }
        const issue = await getLastActiveOwnerIssue(candidate);
        if (issue) {
          return res.status(409).json({ message: issue });
        }
      }
      if (collection === "settings") {
        const settingValue = value as { key?: string; value?: Record<string, unknown> };
        const current = currentSetting ?? await storage.getCms("settings", req.params.id);
        if (!current) return res.status(404).json({ message: "Record not found" });
        const settingIssues = getSettingSaveIssues({ ...current, ...value } as Partial<CmsSetting>);
        if (settingIssues.length > 0) {
          return res.status(409).json({
            message: "Resolve setting issues before saving this setting.",
            issues: settingIssues,
          });
        }
        if (current.key === "site" && settingValue.key && settingValue.key !== "site") {
          return res.status(409).json({ message: "The core site setting key cannot be renamed." });
        }
        if (current.key === "site" && settingValue.value && "leadPipelineStages" in settingValue.value) {
          const nextStages = normalizeLeadPipelineStages(settingValue.value.leadPipelineStages);
          const leads = await storage.listLeads();
          const removedStages = Array.from(
            new Set(leads.map((lead) => lead.pipelineStage).filter((stage) => !nextStages.includes(stage))),
          );
          if (removedStages.length > 0) {
            return res.status(409).json({
              message: `Move leads out of these stages before removing them: ${removedStages.join(", ")}.`,
              stages: removedStages,
            });
          }
        }
        if (settingValueEnablesPublicCms(value as Partial<CmsSetting>, current)) {
          const blockers = await getPublicCmsTakeoverBlockers(getCandidateSiteSettingValue(value as Partial<CmsSetting>, current) ?? undefined);
          if (blockers.length > 0) {
            return res.status(409).json({
              message: "Public CMS takeover is blocked until visual parity is approved and all primary routes are migration-ready.",
              blockers,
            });
          }
        }
      }
      const record = await storage.updateCms(collection, req.params.id, value as never);
      if (!record) return res.status(404).json({ message: "Record not found" });
      await enforceActiveCmsSingleton(collection, record);
      return res.json(record);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/cms/:collection/:id", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const collection = collectionParamSchema.parse(req.params.collection);
      if (collection === "pages") {
        const page = await storage.getCms("pages", req.params.id);
        if (!page) return res.status(404).json({ message: "Record not found" });
        const [menus, sidebars] = await Promise.all([
          storage.listCms("menus"),
          storage.listCms("sidebars"),
        ]);
        const usage = [
          ...getMenuPageUsage(page.slug, menus),
          ...getSidebarPageUsage(page.slug, sidebars),
        ];
        if (usage.length > 0) {
          return res.status(409).json({
            message: "This page is still linked from active navigation or sidebars.",
            usage,
          });
        }
      }
      if (collection === "blogPosts") {
        const post = await storage.getCms("blogPosts", req.params.id);
        if (!post) return res.status(404).json({ message: "Record not found" });
        const [menus, sidebars] = await Promise.all([
          storage.listCms("menus"),
          storage.listCms("sidebars"),
        ]);
        const usage = [
          ...getMenuBlogPostUsage(post.slug, menus),
          ...getSidebarBlogPostUsage(post.slug, sidebars),
        ];
        if (usage.length > 0) {
          return res.status(409).json({
            message: "This blog post is still linked from active navigation or sidebars.",
            usage,
          });
        }
      }
      if (collection === "colorPalettes") {
        const palette = await storage.getCms("colorPalettes", req.params.id);
        if (!palette) return res.status(404).json({ message: "Record not found" });
        const activeCount = (await storage.listCms("colorPalettes")).filter((item) => item.isActive).length;
        if (palette.isActive && activeCount <= 1) {
          return res.status(409).json({ message: "At least one active color palette is required." });
        }
      }
      if (collection === "typography") {
        const typography = await storage.getCms("typography", req.params.id);
        if (!typography) return res.status(404).json({ message: "Record not found" });
        const activeCount = (await storage.listCms("typography")).filter((item) => item.isActive).length;
        if (typography.isActive && activeCount <= 1) {
          return res.status(409).json({ message: "At least one active typography set is required." });
        }
      }
      if (collection === "menus") {
        const menu = await storage.getCms("menus", req.params.id);
        if (!menu) return res.status(404).json({ message: "Record not found" });
        const activeAtLocation = (await storage.listCms("menus")).filter(
          (item) => item.location === menu.location && item.isActive,
        ).length;
        if ((menu.location === "header" || menu.location === "footer") && menu.isActive && activeAtLocation <= 1) {
          return res.status(409).json({ message: `At least one active ${menu.location} menu is required.` });
        }
      }
      if (collection === "sections") {
        const { section, usage } = await getSectionUsage(req.params.id);
        if (!section) return res.status(404).json({ message: "Record not found" });
        if (usage.length > 0) {
          return res.status(409).json({
            message: "This section is still used by one or more CMS pages.",
            usage,
          });
        }
      }
      if (collection === "forms") {
        const { form, usage } = await getFormUsage(req.params.id);
        if (!form) return res.status(404).json({ message: "Record not found" });
        if (usage.length > 0) {
          return res.status(409).json({
            message: "This form is still used by CMS pages, reusable sections, or sidebars.",
            usage,
          });
        }
      }
      if (collection === "sidebars") {
        const sidebar = await storage.getCms("sidebars", req.params.id);
        if (!sidebar) return res.status(404).json({ message: "Record not found" });
        const activeAtLocation = (await storage.listCms("sidebars")).filter(
          (item) => item.location === sidebar.location && item.isActive,
        ).length;
        if ((sidebar.location === "default" || sidebar.location === "blog") && sidebar.isActive && activeAtLocation <= 1) {
          return res.status(409).json({ message: `At least one active ${sidebar.location} sidebar is required.` });
        }
      }
      if (collection === "media") {
        const media = await storage.getCms("media", req.params.id);
        if (!media) return res.status(404).json({ message: "Record not found" });
        const [pages, blogPosts, sections, branding, sidebars] = await Promise.all([
          storage.listCms("pages"),
          storage.listCms("blogPosts"),
          storage.listCms("sections"),
          storage.listCms("branding"),
          storage.listCms("sidebars"),
        ]);
        const usage = mediaUsageItems(media, { pages, blogPosts, sections, branding, sidebars });
        if (usage.length > 0) {
          return res.status(409).json({
            message: "This media item is still used by CMS content, SEO, branding, or sidebars.",
            usage,
          });
        }
      }
      if (collection === "systemUsers") {
        const user = await storage.getCms("systemUsers", req.params.id);
        if (!user) return res.status(404).json({ message: "Record not found" });
        const issue = await getLastActiveOwnerIssue({ ...user, status: "disabled" });
        if (issue) {
          return res.status(409).json({ message: issue });
        }
      }
      if (collection === "settings") {
        const setting = await storage.getCms("settings", req.params.id);
        if (!setting) return res.status(404).json({ message: "Record not found" });
        if (setting.key === "site") {
          return res.status(409).json({ message: "The core site setting is required for public site and CRM configuration." });
        }
      }
      const deleted = await storage.deleteCms(collection, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Record not found" });
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/crm/leads", async (req, res, next) => {
    try {
      if (!checkLeadRateLimit(req)) {
        return res.status(429).json({ message: "Too many lead submissions. Please try again later." });
      }

      const requestedSource =
        typeof req.body.source === "string" && req.body.source.trim()
          ? req.body.source.trim().slice(0, 120)
          : "website";
      const initialStage = (await getConfiguredLeadPipelineStages())[0] ?? "new";
      const parsed = publicLeadSchema.parse({
        ...req.body,
        status: "new",
        pipelineStage: initialStage,
        priority: "normal",
        assignedTo: null,
        nextFollowUpAt: null,
        source: requestedSource === "admin-lead-intake" ? "website" : requestedSource,
      });

      if (parsed.website?.trim()) {
        return res.status(204).send();
      }

      const {
        website: _website,
        fields: submittedFields,
        fieldLabels: submittedFieldLabels,
        sourceUrl,
        referrer,
        ...parsedLead
      } = parsed;
      const lead = normalizeLeadPayload(parsedLead);
      if (!lead.email?.trim() && !lead.phone?.trim()) {
        return res.status(400).json({ message: "Email or phone is required." });
      }
      const normalizedFields = normalizeSubmittedLeadFields(submittedFields);
      const normalizedFieldLabels = normalizeSubmittedLeadFieldLabels(submittedFieldLabels);
      const leadWithSourceNotes = normalizeLeadPayload({
        ...lead,
        notes: buildLeadSourceNotes(lead.notes, sourceUrl, referrer, normalizedFields, normalizedFieldLabels),
      });
      const leadIssues = getLeadSaveIssues(leadWithSourceNotes, true);
      if (leadIssues.length > 0) {
        return res.status(400).json({ message: leadIssues.join(" ") });
      }

      const forms = await storage.listCms("forms");
      const matchedForm = forms.find((form) => form.slug === requestedSource);
      const existingOpenLead = (await storage.listLeads()).find((currentLead) =>
        leadIsOpen(currentLead) &&
        leadsShareContact(currentLead, { email: leadWithSourceNotes.email ?? null, phone: leadWithSourceNotes.phone ?? null })
      );
      const savedLead = existingOpenLead
        ? await storage.updateLead(existingOpenLead.id, {
            notes: appendCrmActivityNote(existingOpenLead.notes, publicDuplicateLeadNote(existingOpenLead, leadWithSourceNotes)),
          }) ?? existingOpenLead
        : await storage.createLead(leadWithSourceNotes);

      await storage.createFormSubmission({
        formId: matchedForm?.id ?? null,
        formSlug: matchedForm?.slug ?? requestedSource,
        name: leadWithSourceNotes.name,
        email: leadWithSourceNotes.email ?? null,
        phone: leadWithSourceNotes.phone ?? null,
        service: leadWithSourceNotes.service ?? null,
        message: leadWithSourceNotes.message ?? null,
        fields: normalizedFields,
        status: "lead-created",
        leadId: savedLead.id,
        sourceUrl: normalizePublicLeadNoteText(sourceUrl) || null,
        referrer: normalizePublicLeadNoteText(referrer) || null,
        userAgent: req.get("user-agent") ?? null,
        ipAddress: getRequestIp(req),
      });

      res.status(existingOpenLead ? 200 : 201).json(savedLead);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/crm/leads", async (_req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.json(await storage.listLeads());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/crm/leads", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const configuredStages = await getConfiguredLeadPipelineStages();
      const initialStage = configuredStages[0] ?? "new";
      const requestedStage = typeof req.body.pipelineStage === "string" && req.body.pipelineStage.trim()
        ? req.body.pipelineStage.trim()
        : initialStage;
      if (!configuredStages.includes(requestedStage)) {
        return res.status(409).json({
          message: `Pipeline stage "${requestedStage}" is not configured. Available stages: ${configuredStages.join(", ")}.`,
        });
      }
      const lead = normalizeLeadPayload(insertCrmLeadSchema.parse({
        ...req.body,
        status: "new",
        pipelineStage: requestedStage,
        source: "admin-lead-intake",
      }));
      if (!lead.email?.trim() && !lead.phone?.trim()) {
        return res.status(400).json({ message: "Email or phone is required." });
      }
      const assigneeIssue = await getLeadAssigneeIssue(lead.assignedTo);
      if (assigneeIssue) {
        return res.status(409).json({ message: assigneeIssue });
      }
      const leadIssues = getLeadSaveIssues(lead, true);
      if (leadIssues.length > 0) {
        return res.status(400).json({ message: leadIssues.join(" ") });
      }
      res.status(201).json(await storage.createLead(lead));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/crm/report", async (_req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json(createCrmHealthReport(await storage.listLeads()));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/crm/report.csv", async (_req, res, next) => {
    try {
      const report = createCrmHealthReport(await storage.listLeads());
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-crm-health-report.csv"');
      return res.send(crmHealthReportCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/crm/action-queue", async (_req, res, next) => {
    try {
      const report = createCrmHealthReport(await storage.listLeads());
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-crm-action-queue.json"');
      return res.json({
        totals: report.totals,
        actionQueue: report.actionQueue,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/crm/action-queue.csv", async (_req, res, next) => {
    try {
      const report = createCrmHealthReport(await storage.listLeads());
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-crm-action-queue.csv"');
      return res.send(crmActionQueueCsv(report));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/crm/leads.csv", async (_req, res, next) => {
    try {
      const leads = await storage.listLeads();
      const headers = [
        "name",
        "email",
        "phone",
        "service",
        "status",
        "pipelineStage",
        "priority",
        "nextFollowUpAt",
        "source",
        "capturedPage",
        "referrer",
        "landingPage",
        "landingReferrer",
        "tracking",
        "landingTracking",
        "activity",
        "assignedTo",
        "message",
        "notes",
        "createdAt",
        "updatedAt",
      ];
      const rows = leads.map((lead) => {
        const sourceDetails = getLeadSourceDetails(lead);
        return [
          lead.name,
          lead.email,
          lead.phone,
          lead.service,
          lead.status,
          lead.pipelineStage,
          lead.priority,
          lead.nextFollowUpAt?.toISOString() ?? "",
          lead.source,
          sourceDetails.page,
          sourceDetails.referrer,
          sourceDetails.landingPage,
          sourceDetails.landingReferrer,
          sourceDetails.tracking,
          sourceDetails.landingTracking,
          sourceDetails.activity,
          lead.assignedTo,
          lead.message,
          lead.notes,
          lead.createdAt.toISOString(),
          lead.updatedAt.toISOString(),
        ].map(csvValue).join(",");
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-leads.csv"');
      return res.send([headers.join(","), ...rows].join("\n"));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/crm/follow-ups.csv", async (_req, res, next) => {
    try {
      const leads = (await storage.listLeads())
        .filter(leadNeedsFollowUp)
        .sort((a, b) => leadFollowUpSortTime(a) - leadFollowUpSortTime(b));
      const headers = [
        "name",
        "email",
        "phone",
        "service",
        "status",
        "pipelineStage",
        "priority",
        "nextFollowUpAt",
        "followUpReason",
        "hoursSinceUpdate",
        "source",
        "capturedPage",
        "referrer",
        "landingPage",
        "landingReferrer",
        "tracking",
        "landingTracking",
        "activity",
        "assignedTo",
        "message",
        "notes",
        "createdAt",
        "updatedAt",
      ];
      const rows = leads.map((lead) => {
        const sourceDetails = getLeadSourceDetails(lead);
        return [
          lead.name,
          lead.email,
          lead.phone,
          lead.service,
          lead.status,
          lead.pipelineStage,
          lead.priority,
          lead.nextFollowUpAt?.toISOString() ?? "",
          leadFollowUpLabel(lead),
          leadAgeHours(lead.updatedAt),
          lead.source,
          sourceDetails.page,
          sourceDetails.referrer,
          sourceDetails.landingPage,
          sourceDetails.landingReferrer,
          sourceDetails.tracking,
          sourceDetails.landingTracking,
          sourceDetails.activity,
          lead.assignedTo,
          lead.message,
          lead.notes,
          lead.createdAt.toISOString(),
          lead.updatedAt.toISOString(),
        ].map(csvValue).join(",");
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-follow-ups.csv"');
      return res.send([headers.join(","), ...rows].join("\n"));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/crm/follow-ups.json", async (_req, res, next) => {
    try {
      const leads = (await storage.listLeads())
        .filter(leadNeedsFollowUp)
        .sort((a, b) => leadFollowUpSortTime(a) - leadFollowUpSortTime(b));
      const byStage = leads.reduce<Record<string, number>>((counts, lead) => {
        counts[lead.pipelineStage] = (counts[lead.pipelineStage] ?? 0) + 1;
        return counts;
      }, {});
      const oldestFollowUpTime = leads[0] ? leadFollowUpSortTime(leads[0]) : null;
      const oldestFollowUpAt = oldestFollowUpTime ? new Date(oldestFollowUpTime).toISOString() : null;

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-follow-ups.json"');
      return res.json({
        exportedAt: new Date().toISOString(),
        source: "Glass & Door Pro Admin",
        totals: {
          leads: leads.length,
          byStage,
          oldestFollowUpAt,
        },
        leads: leads.map((lead) => ({
          ...lead,
          followUpReason: leadFollowUpLabel(lead),
          hoursSinceUpdate: leadAgeHours(lead.updatedAt),
          sourceDetails: getLeadSourceDetails(lead),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/crm/leads.json", async (_req, res, next) => {
    try {
      const leads = await storage.listLeads();
      const byStage = leads.reduce<Record<string, number>>((counts, lead) => {
        counts[lead.pipelineStage] = (counts[lead.pipelineStage] ?? 0) + 1;
        return counts;
      }, {});
      const bySource = leads.reduce<Record<string, number>>((counts, lead) => {
        counts[lead.source] = (counts[lead.source] ?? 0) + 1;
        return counts;
      }, {});
      const byStatus = leads.reduce<Record<string, number>>((counts, lead) => {
        counts[lead.status] = (counts[lead.status] ?? 0) + 1;
        return counts;
      }, {});

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="glass-door-pro-leads.json"');
      return res.json({
        exportedAt: new Date().toISOString(),
        source: "Glass & Door Pro Admin",
        totals: {
          leads: leads.length,
          byStage,
          bySource,
          byStatus,
        },
        leads: leads.map((lead) => ({
          ...lead,
          sourceDetails: getLeadSourceDetails(lead),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/crm/pipeline", async (_req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.json(await storage.getLeadPipeline());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/crm/leads/bulk-activity", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const { ids, activity } = bulkLeadActivitySchema.parse(req.body);
      const uniqueIds = Array.from(new Set(ids));
      const pipelineStageIssue = await getLeadPipelineStageIssue(activity.pipelineStage);
      if (pipelineStageIssue) {
        return res.status(409).json({ message: pipelineStageIssue });
      }
      const assigneeIssue = await getLeadAssigneeIssue(activity.assignedTo);
      if (assigneeIssue) {
        return res.status(409).json({ message: assigneeIssue });
      }
      const leadIssues = getLeadSaveIssues(activity);
      if (leadIssues.length > 0) {
        return res.status(409).json({ message: leadIssues.join(" ") });
      }

      const leadsById = new Map((await storage.listLeads()).map((lead) => [lead.id, lead]));
      const updated: CrmLead[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];

      for (const id of uniqueIds) {
        const current = leadsById.get(id);
        if (!current) {
          skipped.push({ id, reason: "Lead not found." });
          continue;
        }
        const lead = await storage.updateLead(id, {
          ...(activity.pipelineStage ? { pipelineStage: activity.pipelineStage } : {}),
          ...(activity.status ? { status: activity.status } : {}),
          ...(activity.assignedTo !== undefined ? { assignedTo: activity.assignedTo || null } : {}),
          ...(activity.priority ? { priority: activity.priority } : {}),
          ...(activity.nextFollowUpAt !== undefined ? { nextFollowUpAt: activity.nextFollowUpAt } : {}),
          notes: appendCrmActivityNote(current.notes, activity.note),
        });
        if (!lead) {
          skipped.push({ id, reason: "Lead could not be updated." });
          continue;
        }
        updated.push(lead);
      }

      return res.json({
        requested: uniqueIds.length,
        updated,
        skipped,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/crm/leads/:id/activity", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const activity = leadActivitySchema.parse(req.body);
      const current = (await storage.listLeads()).find((lead) => lead.id === req.params.id);
      if (!current) return res.status(404).json({ message: "Lead not found" });
      const pipelineStageIssue = await getLeadPipelineStageIssue(activity.pipelineStage);
      if (pipelineStageIssue) {
        return res.status(409).json({ message: pipelineStageIssue });
      }
      const assigneeIssue = await getLeadAssigneeIssue(activity.assignedTo);
      if (assigneeIssue) {
        return res.status(409).json({ message: assigneeIssue });
      }
      const leadIssues = getLeadSaveIssues(activity);
      if (leadIssues.length > 0) {
        return res.status(409).json({ message: leadIssues.join(" ") });
      }

      const updated = await storage.updateLead(req.params.id, {
        ...(activity.pipelineStage ? { pipelineStage: activity.pipelineStage } : {}),
        ...(activity.status ? { status: activity.status } : {}),
        ...(activity.assignedTo !== undefined ? { assignedTo: activity.assignedTo || null } : {}),
        ...(activity.priority ? { priority: activity.priority } : {}),
        ...(activity.nextFollowUpAt !== undefined ? { nextFollowUpAt: activity.nextFollowUpAt } : {}),
        notes: appendCrmActivityNote(current.notes, activity.note),
      });

      return res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/crm/leads/:id/merge", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const { sourceId } = mergeLeadSchema.parse(req.body);
      if (sourceId === req.params.id) {
        return res.status(400).json({ message: "Choose a different duplicate lead to merge." });
      }

      const leads = await storage.listLeads();
      const target = leads.find((lead) => lead.id === req.params.id);
      const source = leads.find((lead) => lead.id === sourceId);
      if (!target || !source) return res.status(404).json({ message: "Lead not found" });
      if (!leadsShareContact(target, source)) {
        return res.status(409).json({ message: "Leads must share an email address or phone number before merging." });
      }

      const merged = await storage.updateLead(target.id, {
        email: target.email?.trim() ? target.email : source.email,
        phone: target.phone?.trim() ? target.phone : source.phone,
        service: target.service?.trim() ? target.service : source.service,
        message: target.message?.trim() ? target.message : source.message,
        priority: mergedLeadPriority(target, source),
        assignedTo: target.assignedTo ?? source.assignedTo,
        nextFollowUpAt: mergedLeadFollowUpAt(target, source),
        notes: mergedLeadNotes(target, source),
      });
      if (!merged) return res.status(404).json({ message: "Lead not found" });

      const linkedSubmissions = (await storage.listCms("formSubmissions"))
        .filter((submission) => submission.leadId === source.id);
      await Promise.all(
        linkedSubmissions.map((submission) =>
          storage.updateCms("formSubmissions", submission.id, {
            leadId: target.id,
            status: "lead-created",
          }),
        ),
      );

      const deleted = await storage.deleteLead(source.id);
      if (!deleted) {
        return res.status(409).json({ message: "Duplicate lead could not be removed after merge." });
      }

      return res.json({ lead: merged, mergedId: source.id, mergedSubmissionCount: linkedSubmissions.length });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/crm/leads/:id", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const lead = normalizeLeadPayload(insertCrmLeadSchema.partial().parse(req.body));
      const current = (await storage.listLeads()).find((item) => item.id === req.params.id);
      if (!current) return res.status(404).json({ message: "Lead not found" });
      const pipelineStageIssue = await getLeadPipelineStageIssue(lead.pipelineStage);
      if (pipelineStageIssue) {
        return res.status(409).json({ message: pipelineStageIssue });
      }
      const assigneeIssue = await getLeadAssigneeIssue(lead.assignedTo);
      if (assigneeIssue) {
        return res.status(409).json({ message: assigneeIssue });
      }
      const candidate = { ...current, ...lead };
      const leadIssues = getLeadSaveIssues(candidate, true);
      if (leadIssues.length > 0) {
        return res.status(409).json({ message: leadIssues.join(" ") });
      }
      const updated = await storage.updateLead(req.params.id, lead);
      return res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/crm/leads/:id", async (req, res, next) => {
    try {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const leadExists = (await storage.listLeads()).some((lead) => lead.id === req.params.id);
      if (!leadExists) return res.status(404).json({ message: "Lead not found" });

      const linkedSubmissions = (await storage.listCms("formSubmissions"))
        .filter((submission) => submission.leadId === req.params.id);
      await Promise.all(
        linkedSubmissions.map((submission) =>
          storage.updateCms("formSubmissions", submission.id, {
            leadId: null,
            status: submission.status === "lead-created" ? "new" : submission.status,
          }),
        ),
      );

      const deleted = await storage.deleteLead(req.params.id);
      if (!deleted) return res.status(409).json({ message: "Lead could not be deleted after lookup." });
      return res.json({ deleted: true, clearedSubmissionCount: linkedSubmissions.length });
    } catch (error) {
      next(error);
    }
  });

  return httpServer;
}
