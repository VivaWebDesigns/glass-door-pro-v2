import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

const timestamps = {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
};

export const cmsPages = pgTable("cms_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("draft"),
  excerpt: text("excerpt"),
  content: jsonb("content").$type<CmsPageContent>().notNull().default({ sections: [] }),
  seo: jsonb("seo").$type<SeoSettings>().notNull().default({}),
  publishedAt: timestamp("published_at"),
  ...timestamps,
});

export const cmsForms = pgTable("cms_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  fields: jsonb("fields").$type<CmsFormField[]>().notNull().default([]),
  notificationEmail: text("notification_email"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const cmsFormSubmissions = pgTable("cms_form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id"),
  formSlug: text("form_slug").notNull(),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  service: text("service"),
  message: text("message"),
  fields: jsonb("fields").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("new"),
  leadId: varchar("lead_id"),
  sourceUrl: text("source_url"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  ...timestamps,
});

export const cmsBlogPosts = pgTable("cms_blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("draft"),
  excerpt: text("excerpt"),
  body: text("body").notNull().default(""),
  featuredImageId: varchar("featured_image_id"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  category: text("category"),
  seo: jsonb("seo").$type<SeoSettings>().notNull().default({}),
  publishedAt: timestamp("published_at"),
  ...timestamps,
});

export const cmsMedia = pgTable("cms_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull(),
  altText: text("alt_text"),
  caption: text("caption"),
  category: text("category"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  isGalleryReady: boolean("is_gallery_ready").notNull().default(false),
  sizeBytes: integer("size_bytes"),
  width: integer("width"),
  height: integer("height"),
  ...timestamps,
});

export const cmsSections = pgTable("cms_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
  category: text("category").notNull().default("content"),
  blocks: jsonb("blocks").$type<CmsSectionBlock[]>().notNull().default([]),
  isReusable: boolean("is_reusable").notNull().default(true),
  ...timestamps,
});

export const cmsBranding = pgTable("cms_branding", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteName: text("site_name").notNull().default("Glass & Door Pro"),
  tagline: text("tagline"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default({}),
  ...timestamps,
});

export const cmsColorPalettes = pgTable("cms_color_palettes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tokens: jsonb("tokens").$type<ColorPaletteTokens>().notNull(),
  isActive: boolean("is_active").notNull().default(false),
  ...timestamps,
});

export const cmsTypography = pgTable("cms_typography", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  headingFont: text("heading_font").notNull().default("Montserrat"),
  bodyFont: text("body_font").notNull().default("Open Sans"),
  scale: jsonb("scale").$type<Record<string, string>>().notNull().default({}),
  isActive: boolean("is_active").notNull().default(false),
  ...timestamps,
});

export const cmsMenus = pgTable("cms_menus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: text("location").notNull(),
  items: jsonb("items").$type<CmsMenuItem[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const cmsSidebars = pgTable("cms_sidebars", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: text("location").notNull(),
  widgets: jsonb("widgets").$type<CmsWidget[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const cmsDocumentation = pgTable("cms_documentation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  body: text("body").notNull().default(""),
  category: text("category").notNull().default("Admin"),
  ...timestamps,
});

export const cmsSystemBackups = pgTable("cms_system_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status").notNull().default("ready"),
  manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull().default({}),
  createdBy: varchar("created_by"),
  ...timestamps,
});

export const cmsSystemUsers = pgTable("cms_system_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("editor"),
  status: text("status").notNull().default("active"),
  lastLoginAt: timestamp("last_login_at"),
  ...timestamps,
});

export const cmsSettings = pgTable("cms_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  group: text("group").notNull().default("general"),
  isPublic: boolean("is_public").notNull().default(false),
  ...timestamps,
});

export const crmLeads = pgTable("crm_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  service: text("service"),
  message: text("message").notNull().default(""),
  source: text("source").notNull().default("website"),
  status: text("status").notNull().default("new"),
  pipelineStage: text("pipeline_stage").notNull().default("new"),
  priority: text("priority").notNull().default("normal"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  notes: text("notes"),
  assignedTo: varchar("assigned_to"),
  ...timestamps,
});

export const seoSettingsSchema = z.object({
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
  canonicalUrl: z.string().optional(),
  noIndex: z.boolean().optional(),
});

export const cmsSectionBlockSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  props: z.record(z.unknown()).default({}),
});

export const cmsPageContentSchema = z.object({
  sections: z.array(cmsSectionBlockSchema).default([]),
});

export const cmsFormFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  name: z.string(),
  type: z.enum(["text", "email", "tel", "textarea", "select", "checkbox"]),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const cmsMenuItemSchema: z.ZodType<CmsMenuItem> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    href: z.string(),
    children: z.array(cmsMenuItemSchema).optional(),
  }),
);

export const cmsWidgetSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().optional(),
  props: z.record(z.unknown()).default({}),
});

export const colorPaletteTokensSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  background: z.string(),
  foreground: z.string(),
});

export const insertCmsPageSchema = createInsertSchema(cmsPages, {
  seo: seoSettingsSchema,
  content: cmsPageContentSchema,
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertCmsFormSchema = createInsertSchema(cmsForms, {
  fields: z.array(cmsFormFieldSchema),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertCmsFormSubmissionSchema = createInsertSchema(cmsFormSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCmsBlogPostSchema = createInsertSchema(cmsBlogPosts, {
  seo: seoSettingsSchema,
  tags: z.array(z.string()),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertCmsMediaSchema = createInsertSchema(cmsMedia, {
  tags: z.array(z.string()),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCmsSectionSchema = createInsertSchema(cmsSections, {
  blocks: z.array(cmsSectionBlockSchema),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertCmsBrandingSchema = createInsertSchema(cmsBranding).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCmsColorPaletteSchema = createInsertSchema(cmsColorPalettes, {
  tokens: colorPaletteTokensSchema,
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertCmsTypographySchema = createInsertSchema(cmsTypography).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCmsMenuSchema = createInsertSchema(cmsMenus, {
  items: z.array(cmsMenuItemSchema),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertCmsSidebarSchema = createInsertSchema(cmsSidebars, {
  widgets: z.array(cmsWidgetSchema),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertCmsDocumentationSchema = createInsertSchema(cmsDocumentation).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCmsSystemBackupSchema = createInsertSchema(cmsSystemBackups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCmsSystemUserSchema = createInsertSchema(cmsSystemUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCmsSettingSchema = createInsertSchema(cmsSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SeoSettings = z.infer<typeof seoSettingsSchema>;
export type CmsSectionBlock = z.infer<typeof cmsSectionBlockSchema>;
export type CmsPageContent = z.infer<typeof cmsPageContentSchema>;
export type CmsFormField = z.infer<typeof cmsFormFieldSchema>;
export type CmsMenuItem = {
  id: string;
  label: string;
  href: string;
  children?: CmsMenuItem[];
};
export type CmsWidget = z.infer<typeof cmsWidgetSchema>;
export type ColorPaletteTokens = z.infer<typeof colorPaletteTokensSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type CmsPage = typeof cmsPages.$inferSelect;
export type InsertCmsPage = z.infer<typeof insertCmsPageSchema>;
export type CmsForm = typeof cmsForms.$inferSelect;
export type InsertCmsForm = z.infer<typeof insertCmsFormSchema>;
export type CmsFormSubmission = typeof cmsFormSubmissions.$inferSelect;
export type InsertCmsFormSubmission = z.infer<typeof insertCmsFormSubmissionSchema>;
export type CmsBlogPost = typeof cmsBlogPosts.$inferSelect;
export type InsertCmsBlogPost = z.infer<typeof insertCmsBlogPostSchema>;
export type CmsMedia = typeof cmsMedia.$inferSelect;
export type InsertCmsMedia = z.infer<typeof insertCmsMediaSchema>;
export type CmsSection = typeof cmsSections.$inferSelect;
export type InsertCmsSection = z.infer<typeof insertCmsSectionSchema>;
export type CmsBranding = typeof cmsBranding.$inferSelect;
export type InsertCmsBranding = z.infer<typeof insertCmsBrandingSchema>;
export type CmsColorPalette = typeof cmsColorPalettes.$inferSelect;
export type InsertCmsColorPalette = z.infer<typeof insertCmsColorPaletteSchema>;
export type CmsTypography = typeof cmsTypography.$inferSelect;
export type InsertCmsTypography = z.infer<typeof insertCmsTypographySchema>;
export type CmsMenu = typeof cmsMenus.$inferSelect;
export type InsertCmsMenu = z.infer<typeof insertCmsMenuSchema>;
export type CmsSidebar = typeof cmsSidebars.$inferSelect;
export type InsertCmsSidebar = z.infer<typeof insertCmsSidebarSchema>;
export type CmsDocumentation = typeof cmsDocumentation.$inferSelect;
export type InsertCmsDocumentation = z.infer<typeof insertCmsDocumentationSchema>;
export type CmsSystemBackup = typeof cmsSystemBackups.$inferSelect;
export type InsertCmsSystemBackup = z.infer<typeof insertCmsSystemBackupSchema>;
export type CmsSystemUser = typeof cmsSystemUsers.$inferSelect;
export type InsertCmsSystemUser = z.infer<typeof insertCmsSystemUserSchema>;
export type CmsSetting = typeof cmsSettings.$inferSelect;
export type InsertCmsSetting = z.infer<typeof insertCmsSettingSchema>;
export type CrmLead = typeof crmLeads.$inferSelect;
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;
