import {
  cmsBlogPosts,
  cmsBranding,
  cmsColorPalettes,
  cmsDocumentation,
  cmsFormSubmissions,
  cmsForms,
  cmsMedia,
  cmsMenus,
  cmsPages,
  cmsSections,
  cmsSettings,
  cmsSidebars,
  cmsSystemBackups,
  cmsSystemUsers,
  cmsTypography,
  crmLeads,
  type CmsBlogPost,
  type CmsBranding,
  type CmsColorPalette,
  type CmsDocumentation,
  type CmsForm,
  type CmsFormSubmission,
  type CmsMedia,
  type CmsMenu,
  type CmsMenuItem,
  type CmsPage,
  type CmsSectionBlock,
  type CmsSection,
  type CmsSetting,
  type CmsSidebar,
  type CmsSystemBackup,
  type CmsSystemUser,
  type CmsTypography,
  type CmsWidget,
  type CrmLead,
  type InsertCmsBlogPost,
  type InsertCmsBranding,
  type InsertCmsColorPalette,
  type InsertCmsDocumentation,
  type InsertCmsForm,
  type InsertCmsFormSubmission,
  type InsertCmsMedia,
  type InsertCmsMenu,
  type InsertCmsPage,
  type InsertCmsSection,
  type InsertCmsSetting,
  type InsertCmsSidebar,
  type InsertCmsSystemBackup,
  type InsertCmsSystemUser,
  type InsertCmsTypography,
  type InsertCrmLead,
  type InsertUser,
  type User,
  users,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, hasDatabase } from "./db";

type Timestamped = { createdAt: Date; updatedAt: Date };
type Entity = Timestamped & { id: string };
type Insertable<T extends Entity> = Omit<T, "id" | "createdAt" | "updatedAt">;
type CollectionName =
  | "pages"
  | "forms"
  | "formSubmissions"
  | "blogPosts"
  | "media"
  | "sections"
  | "branding"
  | "colorPalettes"
  | "typography"
  | "menus"
  | "sidebars"
  | "documentation"
  | "systemBackups"
  | "systemUsers"
  | "settings";

type CmsCollections = {
  pages: CmsPage;
  forms: CmsForm;
  formSubmissions: CmsFormSubmission;
  blogPosts: CmsBlogPost;
  media: CmsMedia;
  sections: CmsSection;
  branding: CmsBranding;
  colorPalettes: CmsColorPalette;
  typography: CmsTypography;
  menus: CmsMenu;
  sidebars: CmsSidebar;
  documentation: CmsDocumentation;
  systemBackups: CmsSystemBackup;
  systemUsers: CmsSystemUser;
  settings: CmsSetting;
};

type CmsCollectionSnapshot = Partial<{
  [K in CollectionName]: CmsCollections[K][];
}>;

const cmsTables = {
  pages: cmsPages,
  forms: cmsForms,
  formSubmissions: cmsFormSubmissions,
  blogPosts: cmsBlogPosts,
  media: cmsMedia,
  sections: cmsSections,
  branding: cmsBranding,
  colorPalettes: cmsColorPalettes,
  typography: cmsTypography,
  menus: cmsMenus,
  sidebars: cmsSidebars,
  documentation: cmsDocumentation,
  systemBackups: cmsSystemBackups,
  systemUsers: cmsSystemUsers,
  settings: cmsSettings,
} as const;

const defaultLeadPipelineStages = ["new", "contacted", "estimate", "won", "lost"];

const legacyCmsBlockFormatGuideBody =
  "Page and Section blocks use JSON arrays. Block ids and optional anchor props become safe public anchor targets. videoHero uses videoUrl and optional posterUrl. splitContent supports variant=aboutStory with stats using Value | Label rows. featureGrid supports variant=serviceCards for original homepage-style service cards and variant=valueCards for original About values. cta supports variant=aboutPhonePair for the original About CTA with phone action. image supports variant=fullWidthBand for original homepage-style image bands. linkGrid item format: Title | Body | URL | Button Label. serviceList item format: Label | URL, or a plain Label for static rows. statGrid item format: Value | Label. FAQ item format: Question | Answer. testimonials item format: Quote | Author, with variant=homeCarousel for original homepage-style reviews. galleryGrid item format: Image URL | Caption. mediaGallery supports an optional category, variant=homeStrip, variant=categoryCards, source=fallback, limit/count, showCaptions=false, categories using ID | Title | Subtitle | Cover URL, and fallback Image URL | Caption | Category ID | Alt items. form blocks require an active formSlug and can use variant=homeContact for original homepage-style contact panels or variant=contactPage for the original Contact page two-column layout. sectionRef blocks require a saved reusable section handle or sectionId.";

const cmsBlockFormatGuideBody =
  "Page and Section blocks use JSON arrays. Block ids and optional anchor props become safe public anchor targets for menu links like /#reviews. hero uses eyebrow, title, body, imageUrl, href, and label; variant=parallaxServiceHero renders the original service-page parallax hero and accepts heroPreset values default, window, door, repair, or commercial, while variant=simpleServiceHero renders the original 400px centered service category hero. videoHero uses videoUrl and optional posterUrl for full-bleed homepage-style media. splitContent uses eyebrow, title, body, imageUrl, alt, href, and label; variant=aboutStory supports stats using Value | Label rows for the original About story layout, and variant=simpleServiceDetail supports service category detail layouts with imagePosition, itemStyle, panelTitle, panelItems, and CTA labels. featureGrid item format: Title | Body | URL | Button Label, with URL and button label optional; use variant=serviceCards for original homepage-style service cards, variant=valueCards for original About values, variant=benefitCards for original service benefit cards, and variant=iconColumns for original service proof columns. cta uses title, body, href, and label; variant=aboutPhonePair renders the original About CTA with phone action and variant=serviceClosing renders the original service closing CTA. image supports imageUrl, alt, optional caption, and variant=fullWidthBand for original homepage-style image bands. linkGrid item format: Title | Body | URL | Button Label. serviceList item format: Label | URL, or a plain Label for static rows. steps item format: Title | Body, or a plain sentence; variant=processNumbers renders the original numbered service process and accepts tone=muted, while variant=processCards renders the compact original service category process cards. statGrid item format: Value | Label. FAQ item format: Question | Answer; variant=faqCards renders the original service FAQ cards. testimonials item format: Quote | Author, with variant=homeCarousel for original homepage-style reviews. contactInfo pulls Branding/site contact details by default, or items can use Label | Value | URL. galleryGrid item format: Image URL | Caption. mediaGallery reads public gallery-ready image media, can filter by category, supports variant=homeStrip plus source=fallback for curated starter sets, supports variant=categoryCards for the original public Gallery category cards and lightbox, supports variant=servicePair for original service image pairs or trios, accepts tone=default or tone=muted, accepts limit/count and showCaptions=false, and still supports fallback Image URL | Caption | Category ID | Alt items while migration is incomplete. content uses title and body; variant=serviceArea renders the original service area band and variant=centeredIntro renders original centered service intro copy. recentPosts renders published CMS blog posts and supports count plus optional category or tag filters. Gallery media should be marked isGalleryReady, assigned a supported category when needed, tagged for search, and given alt text. Button and menu URLs should be site paths, #anchors, http(s), mailto, or tel links; unsafe URLs are blocked from public rendering and flagged by readiness checks. form blocks require an active formSlug, active form field IDs and names must be unique, variant=homeContact renders the original homepage-style form plus contact panels, and variant=contactPage renders the original Contact page two-column info/form layout. sectionRef blocks require a saved reusable section handle or sectionId, can nest up to four levels, and circular references are blocked before publishing. Use the Section Actions CSV before reusable-section cleanup passes to work missing details, empty blocks, broken references, non-reusable records, and unused sections in priority order.";

const previousCmsMediaGalleryGuideBody =
  "Use the Media workspace as the source of truth for public gallery images and reusable CMS assets. Import Assets scans public files and the served /cms-assets library from client/src/assets, including seeded images and MP4 videos used by starter CMS blocks. Create or upload media records, fill in alt text and useful dimensions, mark only approved images isGalleryReady, then assign categories such as Frameless Showers, Windows, Doors, or Commercial Glass. Use the Media Actions CSV before gallery publishing passes to work missing URLs, missing alt text, missing dimensions, unsupported categories, gallery category gaps, and unused media in priority order. Add concise tags for search and internal filtering. CMS mediaGallery blocks can use a category filter and will request /api/cms/public/media?gallery=1 with an optional category query while retaining fallback image items until each gallery is fully migrated. Use variant=homeStrip, source=fallback, limit/count, and showCaptions=false when a starter route should preserve a curated public gallery layout. Use variant=categoryCards with categories and categorized fallback items when the public Gallery route should mirror the original category cards and lightbox.";

const cmsMediaGalleryGuideBody =
  "Use the Media workspace as the source of truth for public gallery images and reusable CMS assets. Import Assets scans public files and the served /cms-assets library from client/src/assets, including seeded images and MP4 videos used by starter CMS blocks. Create or upload media records, fill in alt text and useful dimensions, mark only approved images isGalleryReady, then assign categories such as Frameless Showers, Windows, Doors, or Commercial Glass. Route and section readiness checks now flag local image, poster, video, and gallery fallback URLs that are not registered in Media, so run Import Assets before route-publishing passes. Use the Media Actions CSV before gallery publishing passes to work missing URLs, missing alt text, missing dimensions, unsupported categories, gallery category gaps, missing Media records, and unused media in priority order. Add concise tags for search and internal filtering. CMS mediaGallery blocks can use a category filter and will request /api/cms/public/media?gallery=1 with an optional category query while retaining fallback image items until each gallery is fully migrated. Use variant=homeStrip, source=fallback, limit/count, and showCaptions=false when a starter route should preserve a curated public gallery layout. Use variant=categoryCards with categories and categorized fallback items when the public Gallery route should mirror the original category cards and lightbox. Use variant=servicePair for two- or three-image service page gallery layouts.";

const cmsSidebarWidgetGuideBody =
  "Sidebar widgets are JSON arrays. Supported widget types are contactCard, cta, imageCard, serviceList, leadForm, recentPosts, and html. imageCard uses imageUrl plus optional altText, caption, body, href, and label, and local image paths must be registered in Media before activation. Service list items can use Label | URL for linked rows or plain Label for static rows. recentPosts uses count plus optional category or tag filters and reads published CMS blog posts. Blog category and tag archives live at /blog/category/Category%20Name and /blog/tag/tag%20name for sidebar and menu links. HTML widgets strip unsafe tags, event handlers, inline styles, and unsafe URL attributes before public rendering. Sidebar locations can target a page slug, page:slug, public path, blog, blog:slug, post:slug, /blog/slug, blogPost, page, or default. Default page sidebars apply to custom CMS pages, while primary public routes such as home, services, about, contact, and gallery require a route-specific sidebar before their full-width layouts change. Use the Sidebar Actions CSV before widget cleanup passes to work missing sidebar details, incomplete widget props, unsafe content, broken lead forms, missing Media records, missing targets, and empty active sidebars in priority order.";

const cmsDesignSystemGuideBody =
  'Design system records control public Glass & Door Pro presentation. Keep exactly one active Color Palette and one active Typography set; activating a new record automatically turns the previous active record off. Palette tokens use HSL strings like "195 75% 38%" for primary, secondary, accent, background, and foreground. Typography records use safe font family names and CSS size tokens for h1, h2, h3, body, and small. Use Branding for logo, favicon, contact details, and service area; use Color Palette and Typography for theme choices only. Use the Design Actions CSV before design cleanup passes to work missing brand profiles, unsafe brand assets, invalid palette tokens, invalid typography tokens, and active-record conflicts in priority order. After activating a design record, review public pages, menus, forms, and widgets against the System readiness report.';

const cmsAdminScopeGuardrailsBody =
  "Glass & Door Pro admin scope is CMS, Design, CRM inbound website leads, and standard System operations only. Build and migration passes should stay within Pages, Forms, Blog, Media, Sections, SEO, Branding, Color Palette, Typography, Menus, Sidebars & Widgets, Documentation, System Backups, System Users, Settings, and the basic lead pipeline. Do not introduce non-CMS module families from the source project, including listing directories, application intake, public calendars, customer account portals, agreement-gated onboarding, RSVP flows, ticketing, venue schedules, or attendee management. If an import, route, table, nav item, API, seed file, or generated page references those source-project features, skip that data and continue with CMS/System/CRM work for Glass & Door Pro.";

const legacyCmsCrmLeadWorkflowGuideBody =
  "Inbound website leads enter CRM from CMS Forms and are grouped by the configured leadPipelineStages setting. The lead API stamps source page, referrer, campaign tracking, and extra submitted fields into internal notes so the pipeline keeps attribution. Form submissions that were captured before a lead was created can be converted from the Forms workspace when they include email or phone contact details. Keep lead status to new, open, quoted, or closed, and priority to low, normal, or high so reports and follow-up queues stay consistent. New leads should be contacted quickly, contacted leads should receive a next follow-up, estimate leads should be checked within two days, and won or lost leads should be closed. Use activity notes for calls, estimates, and customer updates; exports and follow-up reports are available from the CRM workspace.";

const previousCmsCrmLeadWorkflowGuideBody =
  "Inbound website leads enter CRM from CMS Forms and are grouped by the configured leadPipelineStages setting. The lead API stamps source page, referrer, campaign tracking, and extra submitted fields into internal notes so the pipeline keeps attribution. If a new website inquiry matches an existing open lead by email or phone, the submission is linked to that open lead and the new inquiry is appended to the lead notes instead of creating a duplicate opportunity. Form submissions that were captured before a lead was created can be converted from the Forms workspace when they include email or phone contact details; conversion also reuses a matching open lead when one exists. Keep lead status to new, open, quoted, or closed, and priority to low, normal, or high so reports and follow-up queues stay consistent. New leads should be contacted quickly, contacted leads should receive a next follow-up, estimate leads should be checked within two days, and won or lost leads should be closed. Use activity notes for calls, estimates, and customer updates; exports and follow-up reports are available from the CRM workspace.";

const previousCrmStageAgingGuideBody =
  "Inbound website leads enter CRM from CMS Forms and are grouped by the configured leadPipelineStages setting. The lead API stamps source page, referrer, campaign tracking, and extra submitted fields into internal notes so the pipeline keeps attribution. If a new website inquiry matches an existing open lead by email or phone, the submission is linked to that open lead and the new inquiry is appended to the lead notes instead of creating a duplicate opportunity. Form submissions that were captured before a lead was created can be converted from the Forms workspace when they include email or phone contact details; conversion also reuses a matching open lead when one exists. Use the Forms workspace filters to bulk mark visible submissions reviewed, archived, spam, or reopened after triage. Keep lead status to new, open, quoted, or closed, and priority to low, normal, or high so reports and follow-up queues stay consistent. New leads should be contacted quickly, contacted leads should receive a next follow-up, estimate leads should be checked within two days, and won or lost leads should be closed. Use the CRM report open-lead age buckets to spot stale inbound opportunities before they disappear into the pipeline. Use activity notes for calls, estimates, and customer updates; exports and follow-up reports are available from the CRM workspace.";

const previousCrmActionQueueGuideBody =
  "Inbound website leads enter CRM from CMS Forms and are grouped by the configured leadPipelineStages setting. The lead API stamps source page, referrer, campaign tracking, and extra submitted fields into internal notes so the pipeline keeps attribution. If a new website inquiry matches an existing open lead by email or phone, the submission is linked to that open lead and the new inquiry is appended to the lead notes instead of creating a duplicate opportunity. Form submissions that were captured before a lead was created can be converted from the Forms workspace when they include email or phone contact details; conversion also reuses a matching open lead when one exists. Use the Forms workspace filters to bulk mark visible submissions reviewed, archived, spam, or reopened after triage. Keep lead status to new, open, quoted, or closed, and priority to low, normal, or high so reports and follow-up queues stay consistent. New leads should be contacted quickly, contacted leads should receive a next follow-up, estimate leads should be checked within two days, and won or lost leads should be closed. Use the CRM report open-lead age buckets and Stage Aging panel to spot stale inbound opportunities before they disappear into the pipeline. System Status also surfaces CRM Stage Pressure for quick checks across open, due, high-priority, and oldest-stage leads. Use activity notes for calls, estimates, and customer updates; exports and follow-up reports are available from the CRM workspace.";

const previousFormSubmissionActionQueueGuideBody =
  "Inbound website leads enter CRM from CMS Forms and are grouped by the configured leadPipelineStages setting. The lead API stamps source page, referrer, campaign tracking, and extra submitted fields into internal notes so the pipeline keeps attribution. If a new website inquiry matches an existing open lead by email or phone, the submission is linked to that open lead and the new inquiry is appended to the lead notes instead of creating a duplicate opportunity. Form submissions that were captured before a lead was created can be converted from the Forms workspace when they include email or phone contact details; conversion also reuses a matching open lead when one exists. Use the Forms workspace filters to bulk mark visible submissions reviewed, archived, spam, or reopened after triage. Keep lead status to new, open, quoted, or closed, and priority to low, normal, or high so reports and follow-up queues stay consistent. New leads should be contacted quickly, contacted leads should receive a next follow-up, estimate leads should be checked within two days, and won or lost leads should be closed. Use the CRM Action Queue first for follow-ups, duplicate reviews, unassigned leads, stale updates, and high-priority records; export it from CRM Reports when a daily call sheet is needed. Use the CRM report open-lead age buckets and Stage Aging panel to spot stale inbound opportunities before they disappear into the pipeline. System Status also surfaces CRM Action Queue and Stage Pressure for quick checks before working the full pipeline. Use activity notes for calls, estimates, and customer updates; exports and follow-up reports are available from the CRM workspace.";

const previousCrmServiceFunnelGuideBody =
  "Inbound website leads enter CRM from CMS Forms and are grouped by the configured leadPipelineStages setting. The lead API stamps source page, referrer, campaign tracking, and extra submitted fields into internal notes so the pipeline keeps attribution. If a new website inquiry matches an existing open lead by email or phone, the submission is linked to that open lead and the new inquiry is appended to the lead notes instead of creating a duplicate opportunity. Form submissions that were captured before a lead was created can be converted from the Forms workspace when they include email or phone contact details; conversion also reuses a matching open lead when one exists. Use the Forms workspace filters to bulk mark visible submissions reviewed, archived, spam, or reopened after triage. Use the Form Submission Action Queue or Forms Action CSV to clear stale CRM links, convert contact-ready submissions, and triage missing-contact inquiries before they age out of the intake queue. Keep lead status to new, open, quoted, or closed, and priority to low, normal, or high so reports and follow-up queues stay consistent. New leads should be contacted quickly, contacted leads should receive a next follow-up, estimate leads should be checked within two days, and won or lost leads should be closed. Use the CRM Action Queue first for follow-ups, duplicate reviews, unassigned leads, stale updates, and high-priority records; export it from CRM Reports when a daily call sheet is needed. Use the CRM report open-lead age buckets and Stage Aging panel to spot stale inbound opportunities before they disappear into the pipeline. System Status also surfaces CRM Action Queue, Form Submission Action Queue, and Stage Pressure for quick checks before working the full pipeline. Use activity notes for calls, estimates, and customer updates; exports and follow-up reports are available from the CRM workspace.";

const cmsCrmLeadWorkflowGuideBody =
  "Inbound website leads enter CRM from CMS Forms and are grouped by the configured leadPipelineStages setting. The lead API stamps source page, referrer, campaign tracking, and extra submitted fields into internal notes so the pipeline keeps attribution. If a new website inquiry matches an existing open lead by email or phone, the submission is linked to that open lead and the new inquiry is appended to the lead notes instead of creating a duplicate opportunity. Form submissions that were captured before a lead was created can be converted from the Forms workspace when they include email or phone contact details; conversion also reuses a matching open lead when one exists. Use the Forms workspace filters to bulk mark visible submissions reviewed, archived, spam, or reopened after triage. Use the Form Submission Action Queue or Forms Action CSV to clear stale CRM links, convert contact-ready submissions, and triage missing-contact inquiries before they age out of the intake queue. Keep lead status to new, open, quoted, or closed, and priority to low, normal, or high so reports and follow-up queues stay consistent. New leads should be contacted quickly, contacted leads should receive a next follow-up, estimate leads should be checked within two days, and won or lost leads should be closed. Use the CRM Action Queue first for follow-ups, duplicate reviews, unassigned leads, stale updates, and high-priority records; export it from CRM Reports when a daily call sheet is needed. Use the CRM report service funnel to compare open, estimate, won, lost, follow-up, high-priority, and conversion pressure by service line. Use the CRM report open-lead age buckets and Stage Aging panel to spot stale inbound opportunities before they disappear into the pipeline. System Status also surfaces CRM Action Queue, Form Submission Action Queue, and Stage Pressure for quick checks before working the full pipeline. Use activity notes for calls, estimates, and customer updates; exports and follow-up reports are available from the CRM workspace.";

const cmsAdminAccessGuideBody =
  "Admin login is controlled by the ADMIN_PASSWORD environment variable, not by System User records. System Users track owner/admin/editor/viewer identity, active status, and last-login metadata for the CMS dashboard. Production should always define ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Railway variables. If production login fails, confirm the Railway service has the expected ADMIN_PASSWORD value, redeploy after changing variables, and check System Status for password/session configuration. Use the System Actions CSV before system cleanup passes to work missing password/session variables, missing active owners, broken site settings, incomplete documentation, and backup review items in priority order. Keep at least one active owner in System Users so the dashboard has a clear accountable admin contact.";

const cmsBackupRestoreGuideBody =
  "Create a System Backup before large CMS migrations, route publishing passes, SEO cleanup, or bulk lead workflow changes. Snapshot manifests include collection counts, readiness counts, public routes, public forms, structured data totals, CRM lead counts, and SEO launch pressure so the restore preview can show whether a backup carried blockers, warnings, or missing SEO metadata. Use the System Actions CSV to spot failed or pending backups alongside other system cleanup items, then use the Backup Catalog Health cards to find the latest restorable snapshot. Review the restore preview and restore impact plan before typing the exact confirmation phrase. Older backups can still be restorable even when they are missing newer SEO pressure metadata; refresh them with a new snapshot before relying on them for launch comparisons.";

const legacyCmsMigrationRunbookBody =
  "Glass & Door Pro public routes are served by CMS Pages first and keep hard-coded fallbacks until each route is ready. Use Pages for route status, Menus for active navigation, Forms for lead capture, Media for gallery readiness, Blog taxonomy archives for category/tag entry points, and System Backups before large content changes. A route is ready when it has CMS sections, required SEO, and no broken reusable section, form, media, menu, or widget references.";

const cmsMigrationRunbookBody = [
  "Glass & Door Pro public routes keep the original hard-coded frontend by default while CMS Pages are prepared behind the scenes.",
  "Leave the site setting publicCmsEnabled off until the migrated CMS pages, menus, branding, palette, typography, media, SEO, and sidebars match the original public site closely enough to take over, and do not add publicCmsVisualParityApprovedAt until the CMS preview has been visually compared against the current frontend.",
  "Use ?cms-preview=1 on the route being reviewed to show the published CMS route body while the original header, footer, menus, branding, palette, typography, and sidebars remain protected. Use ?cms-preview=0 on that same route to return to normal public rendering.",
  "Preview links are intentionally per-route so normal public URLs keep returning to the original site during migration.",
  "Use Pages for route status, Menus for active navigation, Forms for lead capture, SEO canonicals and schema tags, Blog taxonomy archives for category/tag entry points, Media for gallery readiness and local asset registration, and System Backups before large content changes.",
  "Use Launch CMS Routes in the Migration Queue to create missing starter pages, repair starter content and SEO, import local assets into Media, validate blockers, and publish only primary routes that pass readiness.",
  "Use the System Status Route Actions CSV or JSON and the Migration Queue Route Actions CSV/JSON before route-publishing passes to work the highest-priority missing page, starter section, SEO, media-records, reference, visual parity, and publish tasks.",
  "Use the Menu Actions CSV before navigation publishing passes to clear missing details, unsafe links, draft targets, missing targets, and header coverage gaps in priority order.",
  "Custom CMS pages publish at clean slug URLs while the /page/slug path remains available as a migration fallback, but custom CMS pages need at least one section before publishing because they do not have hard-coded route content.",
  "Use the Custom Review migration filter to find CMS-only routes that still need sections, SEO, clean references, registered media, or publishing.",
  "Blog category and tag archives publish automatically for published posts at /blog/category/Category%20Name and /blog/tag/tag%20name, and menu readiness accepts them when at least one published post matches.",
  "Mark gallery images isGalleryReady, assign optional categories and tags, and use mediaGallery category filters to migrate galleries without losing starter fallbacks.",
  "Launch clearance checklist: create a fresh System Backup, open Public Frontend Guard and Visual Parity Review from System Status, export Visual CSV or JSON, compare every Original Site and CMS Preview link, mark each primary route approved or changes-needed in CMS Visual Parity Approval, and only approve visual parity after every primary route is approved.",
  "Before enabling publicCmsEnabled, rerun Launch CMS Routes, confirm the Route Actions CSV/JSON has no blockers, confirm Public Frontend Guard shows route readiness plus visual parity approval, then enable publicCmsEnabled so publicCmsLaunchConfirmedAt records the launch decision.",
  "After takeover, spot-check normal public URLs without cms-preview, confirm forms still create CRM leads, download one final System Backup, and disable publicCmsEnabled if the original hard-coded frontend needs to retake public traffic while content is corrected.",
  "A route is ready when it has CMS sections, required SEO, schema tags, a production canonical URL, safe public links, registered local assets, and no broken reusable section, form, media, menu, or widget references; public takeover additionally requires visual parity approval.",
].join(" ");

function getLeadPipelineStagesFromSettings(settings: CmsSetting[]) {
  const configuredStages = settings
    .find((setting) => setting.key === "site")
    ?.value.leadPipelineStages;

  if (!Array.isArray(configuredStages)) {
    return defaultLeadPipelineStages;
  }

  const stages = configuredStages
    .map((stage) => String(stage).trim())
    .filter(Boolean);

  return stages.length > 0 ? Array.from(new Set(stages)) : defaultLeadPipelineStages;
}

const defaultHeaderMenuItems: CmsMenuItem[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "about", label: "About", href: "/about" },
  {
    id: "services",
    label: "Services",
    href: "/services",
    children: [
      { id: "frameless-showers", label: "Frameless Showers", href: "/services/frameless-showers" },
      { id: "window-installation", label: "Window Installation", href: "/services/window-installation" },
      { id: "door-installation", label: "Door Installation", href: "/services/door-installation" },
      { id: "window-repair", label: "Window Repair", href: "/services/window-repair" },
      { id: "commercial-glass", label: "Commercial Glass", href: "/services/commercial-glass" },
    ],
  },
  { id: "gallery", label: "Gallery", href: "/gallery" },
  { id: "reviews", label: "Reviews", href: "/#reviews" },
  { id: "contact", label: "Contact", href: "/contact" },
];

const defaultFooterMenuItems: CmsMenuItem[] = [
  { id: "frameless-showers", label: "Frameless Showers", href: "/services/frameless-showers" },
  { id: "window-installation", label: "Window Installation", href: "/services/window-installation" },
  { id: "door-installation", label: "Door Installation", href: "/services/door-installation" },
  { id: "window-repair", label: "Window Repair", href: "/services/window-repair" },
  { id: "commercial-glass", label: "Commercial Glass", href: "/services/commercial-glass" },
  { id: "gallery", label: "Gallery", href: "/gallery" },
];

const defaultServiceNames = [
  "Frameless Showers | /services/frameless-showers",
  "Window Installation | /services/window-installation",
  "Door Installation | /services/door-installation",
  "Window Repair | /services/window-repair",
  "Commercial Glass | /services/commercial-glass",
];

const previousHomeHeroBody =
  "Specializing in frameless glass showers, windows, and doors for homeowners in the greater Charlotte, North Carolina area.";
const homeHeroBody =
  "Specializing in frameless glass showers, windows, and doors for homeowners in Charlotte, NC.";
const previousHomeDoorServiceCopy =
  "Door Installation | From entry doors to patio doors, Glass & Door Pro installs options to enhance your home's security and style. | /services/door-installation | Learn More";
const homeDoorServiceCopy =
  "Door Installation | From entry doors to patio doors, I install options to enhance your home's security and style. | /services/door-installation | Learn More";

const defaultPageSidebarWidgets: CmsWidget[] = [
  {
    id: "default-contact",
    type: "contactCard",
    title: "Talk With Glass & Door Pro",
    props: {
      body: "Get practical next steps for your shower, window, door, or commercial glass project.",
    },
  },
  {
    id: "default-quote-form",
    type: "leadForm",
    title: "Request a Quote",
    props: {
      formSlug: "website-quote-request",
      body: "Send a few details and we will follow up with a clear path forward.",
    },
  },
  {
    id: "default-services",
    type: "serviceList",
    title: "Services",
    props: {
      items: defaultServiceNames,
    },
  },
];

const defaultFooterSidebarWidgets: CmsWidget[] = [
  {
    id: "footer-quote-cta",
    type: "cta",
    title: "Ready to start a glass or door project?",
    props: {
      body: "Send project details and Glass & Door Pro will follow up with next steps.",
      href: "/contact",
      label: "Request a Quote",
    },
  },
  {
    id: "footer-contact-card",
    type: "contactCard",
    title: "Contact Glass & Door Pro",
    props: {
      body: "Charlotte-area shower glass, windows, doors, repairs, and commercial glass.",
    },
  },
];

const serviceStarterContent: Record<string, {
  title: string;
  eyebrow: string;
  body: string;
  imageUrl: string;
  features: string[];
  galleryCategory: string;
}> = {
  "services/frameless-showers": {
    eyebrow: "Frameless Showers",
    title: "Frameless Glass Shower Doors",
    body: "Transform your bathroom into a luxurious spa-like retreat with custom frameless glass shower enclosures. Serving Charlotte, NC and surrounding areas with over 15 years of expert installation experience.",
    imageUrl: "/cms-assets/images/gallery-shower1-1280w.webp",
    features: [
      "Modern Elegance | Frameless designs create a sleek, open feel that makes your bathroom appear larger and more luxurious.",
      "Premium Quality | We use thick tempered safety glass and high-quality hardware that's built to last for decades.",
      "Easy to Clean | No metal frames means fewer places for mold and mildew to hide. Simply wipe and go.",
      "Custom Fit | Every installation is precision-measured and custom-cut to perfectly fit your unique bathroom space.",
      "Increases Home Value | A beautiful frameless shower is a sought-after feature that adds real value to your home.",
      "Professional Installation | Doug personally handles every installation with meticulous attention to detail and craftsmanship.",
    ],
    galleryCategory: "Frameless Showers",
  },
  "services/window-installation": {
    eyebrow: "Window Installation",
    title: "Residential Window Installation",
    body: "Upgrade your home with energy-efficient windows that enhance comfort, reduce energy bills, and boost curb appeal. Professional installation serving Charlotte, NC and surrounding communities.",
    imageUrl: "/cms-assets/images/gallery-windows-1280w.webp",
    features: [
      "Energy Efficiency | Modern double or triple-pane windows significantly reduce heat transfer, keeping your home comfortable year-round.",
      "Lower Energy Bills | Quality windows can reduce heating and cooling costs by up to 25%, saving you money every month.",
      "Natural Light | Let more natural light in while blocking harmful UV rays that can fade furniture and flooring.",
      "Enhanced Security | New windows feature improved locking mechanisms and stronger glass for better home security.",
      "Curb Appeal | Beautiful new windows dramatically improve your home's appearance and increase property value.",
      "Noise Reduction | Multi-pane windows significantly reduce outside noise, creating a quieter, more peaceful home.",
    ],
    galleryCategory: "Windows",
  },
  "services/door-installation": {
    eyebrow: "Door Installation",
    title: "Door Installation Services",
    body: "From stunning entry doors to functional patio doors, we provide expert installation that enhances your home's security, energy efficiency, and curb appeal. Serving Charlotte, NC and surrounding areas.",
    imageUrl: "/cms-assets/images/gallery-door1-1280w.webp",
    features: [
      "Enhanced Security | Modern doors feature advanced locking systems and reinforced frames that protect your family.",
      "Energy Efficiency | Insulated doors prevent drafts and heat loss, reducing your energy bills significantly.",
      "Curb Appeal | A beautiful entry door is one of the best investments for boosting your home's first impression.",
      "Increased Home Value | Quality door replacements offer one of the highest returns on investment in home improvement.",
      "Wide Selection | Choose from entry doors, patio doors, French doors, sliding doors, and storm doors.",
      "Professional Fit | Proper installation ensures your door operates smoothly and seals correctly for years to come.",
    ],
    galleryCategory: "Doors",
  },
  "services/window-repair": {
    eyebrow: "Window Repair",
    title: "Window Repair Services",
    body: "Fast, reliable window glass repair and replacement for Charlotte-area homeowners. From foggy windows to broken panes, we restore your windows to like-new condition with expert craftsmanship.",
    imageUrl: "/cms-assets/images/window-repair-broken-1280w.webp",
    features: [
      "Broken Glass | Cracked, shattered, or damaged window panes replaced quickly to restore safety and security to your home.",
      "Foggy Windows | Condensation between double-pane glass indicates a failed seal. We replace the insulated glass unit to restore clarity.",
      "Seal Failure | Drafty windows with failed weatherstripping or seals repaired to improve energy efficiency and comfort.",
      "Storm Damage | Emergency repairs for windows damaged by storms, hail, or flying debris. Fast response to secure your home.",
      "Single Pane Upgrade | Upgrade old single-pane windows to energy-efficient double-pane glass without replacing the entire window.",
      "Glass-Only Replacement | Save money by replacing just the glass instead of the entire window unit. Perfect for older windows in good condition.",
    ],
    galleryCategory: "Windows",
  },
  "services/commercial-glass": {
    eyebrow: "Commercial Glass",
    title: "Commercial Glass Services",
    body: "Professional commercial glass installation, repair, and replacement for Charlotte-area businesses. From storefronts to office buildings, we deliver quality solutions that enhance your business image and security.",
    imageUrl: "/cms-assets/images/commercial-hero-1280w.webp",
    features: [
      "Storefront Glass | Custom storefront installations and replacements that showcase your business and attract customers.",
      "Office Glass Partitions | Modern glass partitions and dividers that create open, professional workspaces while maintaining privacy.",
      "Curtain Wall Systems | Large-scale glass facade installations for commercial buildings that maximize natural light.",
      "Security Glass | Tempered, laminated, and impact-resistant glass options to protect your business and assets.",
      "Emergency Repairs | Fast response for broken storefronts, vandalism damage, and urgent commercial glass repairs.",
      "Glass Doors | Commercial entrance doors, automatic doors, and interior glass doors for professional spaces.",
    ],
    galleryCategory: "Commercial Glass",
  },
  "services/showers": {
    eyebrow: "Frameless Showers",
    title: "Frameless Glass Showers",
    body: "Custom-cut frameless shower glass and heavy glass enclosures that make your bathroom feel open, bright, and easier to maintain.",
    imageUrl: "/cms-assets/images/gallery-shower2-1280w.webp",
    features: ["Custom Frameless Enclosures | Built around your exact opening, tile, and hardware selections.", "Premium Hardware | Choose finishes that fit the rest of your bathroom design.", "Clean Installation | Doug personally handles the installation details."],
    galleryCategory: "Frameless Showers",
  },
  "services/windows": {
    eyebrow: "Residential Windows",
    title: "Residential Windows",
    body: "Energy-efficient replacements and professional installation for comfort, clarity, and curb appeal.",
    imageUrl: "/cms-assets/images/gallery-windows-1280w.webp",
    features: ["Energy Efficiency | Improve comfort and reduce heat transfer.", "Curb Appeal | Refresh the look of your home from the street.", "Professional Installation | Proper fit, sealing, and cleanup matter."],
    galleryCategory: "Windows",
  },
  "services/doors": {
    eyebrow: "Door Installation",
    title: "Professional Door Installation",
    body: "Upgrade entry, patio, and interior doors with the right fit, finish, and long-term function.",
    imageUrl: "/cms-assets/images/gallery-door2-1280w.webp",
    features: ["Entry Doors | Improve security, comfort, and curb appeal.", "Patio Doors | Better light, operation, and access to outdoor spaces.", "Professional Fit | Hardware, sealing, and daily use all get reviewed."],
    galleryCategory: "Doors",
  },
};

type ServicePageStarterContent = {
  heroImageUrl: string;
  heroPreset: string;
  heroLabel?: string;
  benefitsTitle: string;
  benefitsTone?: string;
  galleryTitle: string;
  galleryTone?: string;
  galleryItems: string[];
  intro?: { title: string; body: string };
  processTitle?: string;
  processTone?: string;
  processItems?: string[];
  iconColumnsTitle?: string;
  iconColumnItems?: string[];
  faqItems: string[];
  ctaTitle: string;
  ctaBody: string;
};

const serviceAreaBody =
  "Charlotte • Matthews • Mint Hill • Monroe • Pineville • Huntersville • Cornelius • Davidson • Concord • Tega Cay • Waxhaw • Indian Trail • Stallings • Fort Mill • Rock Hill • and surrounding areas";

const servicePageStarterContent: Record<string, ServicePageStarterContent> = {
  "services/frameless-showers": {
    heroImageUrl: "/cms-assets/images/frameless-parallax.jpg",
    heroPreset: "default",
    benefitsTitle: "Why Choose Frameless Shower Doors?",
    galleryTitle: "Our Frameless Shower Work",
    galleryItems: [
      "/cms-assets/images/gallery-shower1-1280w.webp | Custom frameless glass shower enclosure installed by Glass & Door Pro in a Charlotte, NC area home",
      "/cms-assets/images/gallery-shower2-1280w.webp | Modern frameless shower door with gold hardware fixtures installed in Monroe, NC",
    ],
    processTitle: "Our Simple Process",
    processItems: [
      "Free Consultation | Contact us and we'll schedule a convenient time to discuss your vision.",
      "Precise Measurement | We take detailed measurements to ensure a perfect custom fit.",
      "Custom Fabrication | Your glass is precision-cut and edges polished to perfection.",
      "Expert Installation | Professional installation with attention to every detail.",
    ],
    faqItems: [
      "How long does installation take? | Most frameless shower installations are completed in 2-4 hours, depending on the complexity of your design.",
      "What thickness of glass do you use? | We typically use 3/8\" or 1/2\" thick tempered safety glass, which provides excellent durability and a premium look.",
      "Do you offer different hardware finishes? | Yes! We offer chrome, brushed nickel, oil-rubbed bronze, matte black, gold, and other finishes to match your bathroom.",
      "How do I maintain my frameless shower? | Simply squeegee after each use and clean weekly with a non-abrasive glass cleaner. We can also apply protective coatings.",
      "What areas do you serve? | We serve Charlotte, Matthews, Mint Hill, Monroe, Pineville, Huntersville, Cornelius, Davidson, Concord, Tega Cay, Waxhaw, Indian Trail, Stallings, Fort Mill, Rock Hill, and surrounding areas.",
    ],
    ctaTitle: "Ready to Transform Your Bathroom?",
    ctaBody: "Get a free quote for your custom frameless shower installation today. We're ready to help you create the bathroom of your dreams.",
  },
  "services/window-installation": {
    heroImageUrl: "/cms-assets/images/window-parallax.jpg",
    heroPreset: "window",
    benefitsTitle: "Benefits of New Windows",
    galleryTitle: "Window Installation Projects",
    galleryItems: [
      "/cms-assets/images/gallery-windows-1280w.webp | Modern residential window installation by Glass & Door Pro in a Charlotte, NC area home",
      "/cms-assets/images/gallery-sunroom-1280w.webp | Bright sunroom with large glass windows installed by Glass & Door Pro in Indian Trail, NC",
    ],
    processTitle: "Our Installation Process",
    processItems: [
      "In-Home Consultation | We evaluate your windows and discuss options that fit your needs and budget.",
      "Window Selection | Choose from various styles, materials, and energy-efficient options.",
      "Professional Install | Expert installation with proper sealing and insulation for maximum efficiency.",
      "Final Inspection | Complete cleanup and walkthrough to ensure your total satisfaction.",
    ],
    faqItems: [
      "How long does window replacement take? | Most single window replacements take 30-60 minutes. A full home can typically be completed in 1-2 days.",
      "What types of windows do you install? | We install double-hung, casement, sliding, bay, bow, picture windows, and more in various materials including vinyl, wood, and fiberglass.",
      "Do you remove and dispose of old windows? | Yes, we handle complete removal and disposal of your old windows, leaving your home clean and tidy.",
      "Are your windows energy efficient? | We offer ENERGY STAR certified windows with Low-E glass, argon gas fills, and insulated frames for maximum efficiency.",
      "What areas do you serve? | We serve Charlotte, Matthews, Mint Hill, Monroe, Pineville, Huntersville, Cornelius, Davidson, Concord, Tega Cay, Waxhaw, Indian Trail, Stallings, Fort Mill, Rock Hill, and surrounding areas.",
    ],
    ctaTitle: "Ready to Upgrade Your Windows?",
    ctaBody: "Get a free estimate for your window replacement project. We'll help you find the perfect windows for your home and budget.",
  },
  "services/door-installation": {
    heroImageUrl: "/cms-assets/images/door-parallax.jpg",
    heroPreset: "door",
    benefitsTitle: "Why Upgrade Your Doors?",
    galleryTitle: "Door Installation Gallery",
    galleryItems: [
      "/cms-assets/images/gallery-door1-1280w.webp | Modern black entry door with glass panels installed by Glass & Door Pro in Charlotte, NC",
      "/cms-assets/images/gallery-door2-1280w.webp | Elegant wooden front door with sidelights installed by Glass & Door Pro in Monroe, NC",
      "/cms-assets/images/gallery-door3-1280w.webp | Charming blue entry door with window panes installed by Glass & Door Pro in Indian Trail, NC",
    ],
    processTitle: "Our Installation Process",
    processItems: [
      "Consultation | We assess your current doors and discuss style, material, and security options.",
      "Selection | Choose from a wide variety of doors, hardware, and finishes to match your home.",
      "Installation | Expert installation with proper shimming, sealing, and hardware adjustment.",
      "Final Check | We ensure smooth operation, proper locks, and clean up the work area.",
    ],
    faqItems: [
      "What types of doors do you install? | We install entry doors, French doors, patio doors, sliding glass doors, storm doors, and interior doors in various materials.",
      "How long does door installation take? | Most single door installations are completed in 2-4 hours. Complex installations like French or patio doors may take longer.",
      "What door materials are available? | We offer fiberglass, steel, wood, and composite doors. Each has benefits for durability, insulation, and aesthetics.",
      "Do you install door hardware? | Yes, we install all hardware including handles, locks, deadbolts, hinges, and smart lock systems.",
      "What areas do you serve? | We serve Charlotte, Matthews, Mint Hill, Monroe, Pineville, Huntersville, Cornelius, Davidson, Concord, Tega Cay, Waxhaw, Indian Trail, Stallings, Fort Mill, Rock Hill, and surrounding areas.",
    ],
    ctaTitle: "Ready for a New Door?",
    ctaBody: "Get a free quote for your door installation project. We'll help you find the perfect door that enhances your home's beauty and security.",
  },
  "services/window-repair": {
    heroImageUrl: "/cms-assets/images/window-repair-parallax.jpg",
    heroPreset: "repair",
    heroLabel: "Get a Free Estimate",
    benefitsTitle: "Window Problems We Fix",
    galleryTitle: "Window Repair Projects",
    galleryItems: [
      "/cms-assets/images/window-repair-broken-1280w.webp | Broken residential window glass needing repair by Glass & Door Pro in the Charlotte, NC metro area",
      "/cms-assets/images/window-repair-living-1280w.webp | Beautiful living room with professionally repaired windows by Glass & Door Pro in Monroe, NC",
    ],
    iconColumnsTitle: "Why Choose Us for Window Repair",
    iconColumnItems: [
      "Fast Response | Quick scheduling and same-week service for most repairs in the Charlotte area.",
      "Affordable Pricing | Fair, upfront pricing with no hidden fees. Free estimates on all repairs.",
      "Quality Materials | We use premium glass and materials that meet or exceed industry standards.",
      "15+ Years Experience | Trusted expertise from a local professional who takes pride in every job.",
    ],
    faqItems: [
      "How much does window repair cost? | Costs vary depending on window size, glass type, and repair complexity. We provide free estimates so you know the exact cost before we begin.",
      "Can you repair just the glass without replacing the whole window? | Yes! In many cases, we can replace just the glass pane or insulated glass unit, saving you money compared to full window replacement.",
      "How long does window repair take? | Most single-window repairs are completed in under an hour. Larger projects or custom glass may require 1-2 days for fabrication.",
      "Do you offer emergency window repair? | Yes, we offer priority scheduling for emergency situations like broken windows that compromise your home's security.",
      "What areas do you serve? | We serve Charlotte, Matthews, Mint Hill, Monroe, Pineville, Huntersville, Cornelius, Davidson, Concord, Tega Cay, Waxhaw, Indian Trail, Stallings, Fort Mill, Rock Hill, and surrounding areas.",
    ],
    ctaTitle: "Need Window Repair in Charlotte?",
    ctaBody: "Don't let a damaged window compromise your home's comfort and security. Contact us today for a free estimate on your window repair project.",
  },
  "services/commercial-glass": {
    heroImageUrl: "/cms-assets/images/commercial-hero-1920w.webp",
    heroPreset: "commercial",
    benefitsTitle: "Our Commercial Glass Services",
    benefitsTone: "muted",
    galleryTitle: "Commercial Glass Projects",
    galleryTone: "default",
    galleryItems: [
      "/cms-assets/images/commercial-glass-interior-1280w.webp | Modern commercial glass partitions and office interior installed by Glass & Door Pro in Charlotte, NC",
      "/cms-assets/images/commercial-hero-1280w.jpg | Commercial glass entrance doors installed by Glass & Door Pro in a Charlotte metro area building",
    ],
    intro: {
      title: "Commercial Glass Solutions for Your Business",
      body: "Whether you need a new storefront, emergency glass repair, or custom commercial installations, Glass & Door Pro delivers reliable, professional service to businesses throughout the Greater Charlotte area. We understand that your business can't wait, so we prioritize quick response times and minimal disruption to your operations.",
    },
    processTitle: "How We Work",
    processTone: "muted",
    processItems: [
      "Site Assessment | We visit your location to evaluate your commercial glass needs and take precise measurements.",
      "Custom Quote | Receive a detailed, transparent quote with options tailored to your budget and timeline.",
      "Professional Install | Our team completes the installation with minimal disruption to your business operations.",
      "Final Walkthrough | We ensure everything meets your expectations and clean up completely before leaving.",
    ],
    iconColumnsTitle: "Why Charlotte Businesses Choose Us",
    iconColumnItems: [
      "Fast Response | We understand business urgency and respond quickly to minimize your downtime.",
      "Licensed & Insured | Full liability coverage protects your business during every installation.",
      "Local Experience | 15+ years serving Charlotte-area businesses with quality commercial glass work.",
      "Quality Materials | We use premium commercial-grade glass and hardware built to last.",
    ],
    faqItems: [
      "What types of commercial properties do you serve? | We serve retail stores, restaurants, office buildings, medical facilities, warehouses, and all types of commercial properties in the Charlotte area.",
      "Do you offer emergency board-up services? | Yes, we provide emergency board-up and temporary glazing services to secure your property until permanent repairs can be completed.",
      "Can you work after business hours? | Absolutely. We offer flexible scheduling including evenings and weekends to minimize disruption to your business operations.",
      "Do you handle insurance claims? | We can work with your insurance company and provide detailed documentation to help streamline your claim process.",
      "What areas do you serve? | We serve Charlotte, Matthews, Mint Hill, Monroe, Pineville, Huntersville, Cornelius, Davidson, Concord, Tega Cay, Waxhaw, Indian Trail, Stallings, Fort Mill, Rock Hill, and surrounding areas.",
    ],
    ctaTitle: "Ready to Discuss Your Commercial Glass Project?",
    ctaBody: "Get a free estimate for your commercial glass installation, repair, or replacement. We're ready to help your business look its best.",
  },
};

function starterSectionId(prefix: string, slug: string) {
  return `${prefix}-${slug.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"}`;
}

function starterSectionsForSlug(slug: string): CmsSectionBlock[] {
  if (slug === "home") {
    return [
      {
        id: starterSectionId("hero", slug),
        type: "videoHero",
        props: {
          title: "We've got your glass & door needs covered.",
          body: homeHeroBody,
          videoUrl: "/cms-assets/videos/hero-video.mp4",
          href: "/contact",
          label: "Get a Free Quote",
        },
      },
      {
        id: starterSectionId("about", slug),
        type: "splitContent",
        props: {
          eyebrow: "About Us",
          title: "Hi there! My name is Doug.",
          body: "Welcome to my glass and door installation business, proudly serving the greater Charlotte, North Carolina area. With over 15 years of hands-on experience, I'm dedicated to providing high-quality, personalized solutions for all your glass and door needs.\n\nWhether you're looking to enhance your home with a custom frameless shower or improve comfort and energy efficiency with new windows or doors, I've got you covered. I handle every project personally, from small repairs to full installations, ensuring each job is completed efficiently, correctly, and with attention to detail.",
          imageUrl: "/cms-assets/images/family-1280w.webp",
          alt: "Doug Adams, owner of Glass & Door Pro, with his family in Charlotte, NC",
          imagePosition: "left",
          href: "/about",
          label: "Learn More",
        },
      },
      {
        id: starterSectionId("services", slug),
        type: "featureGrid",
        props: {
          eyebrow: "Our Services",
          title: "What We Offer",
          variant: "serviceCards",
          items: [
            "Frameless Showers | Custom frameless glass shower enclosures that add luxury and value to any bathroom. | /services/frameless-showers | Learn More",
            "Window Installation | Energy-efficient window replacements to enhance your property's comfort and curb appeal. | /services/window-installation | Learn More",
            homeDoorServiceCopy,
            "Window Repair | Fast, reliable window glass repair for broken panes, foggy windows, and seal failures. | /services/window-repair | Learn More",
            "Commercial Glass | Professional storefront glass, office partitions, and commercial glass solutions for businesses. | /services/commercial-glass | Learn More",
          ],
        },
      },
      {
        id: starterSectionId("image-band", slug),
        type: "image",
        props: {
          variant: "fullWidthBand",
          imageUrl: "/cms-assets/images/gallery-door2-1280w.webp",
          alt: "Custom wooden entry door installation with decorative planters by Glass & Door Pro in Charlotte, NC",
          caption: "",
        },
      },
      {
        id: "why-us",
        type: "splitContent",
        props: {
          eyebrow: "Why us?",
          title: "Get the job done right",
          body: "I work closely with my clients to ensure that each installation is tailored to their specific preferences and needs, resulting in a truly unique and beautiful addition to any space.\n\nWith 15+ years of experience, I have the knowledge and equipment necessary to install any type of glass or door, from standard windows and exterior doors to more complex frameless shower enclosures.",
          imageUrl: "/cms-assets/images/gallery-door1-1280w.webp",
          alt: "Professional entry door installation by Glass & Door Pro serving Monroe and Indian Trail, NC",
          badgeValue: "15+",
          badgeLabel: "Years Experience",
          href: "/contact",
          label: "Contact Us",
        },
      },
      {
        id: starterSectionId("gallery", slug),
        type: "mediaGallery",
        props: {
          eyebrow: "Project Gallery",
          title: "Recent Glass & Door Projects",
          body: "Selected project photos from frameless shower, window, and door installations.",
          variant: "homeStrip",
          source: "fallback",
          limit: 4,
          showCaptions: false,
          fallbackNote: "Showing starter project photos until Gallery-ready CMS media is available.",
          items: [
            "/cms-assets/images/gallery-shower1-1280w.webp | Frameless glass shower enclosure installed in a Charlotte area home by Glass & Door Pro",
            "/cms-assets/images/gallery-windows-1280w.webp | Energy-efficient window installation for homes in Matthews, Mint Hill, and Charlotte, NC",
            "/cms-assets/images/gallery-door3-1280w.webp | Charming blue entry door installed by Glass & Door Pro in the Charlotte, NC metro area",
            "/cms-assets/images/gallery-shower2-1280w.webp | Modern frameless shower glass door with sleek hardware installed in Indian Trail, NC",
          ],
        },
      },
      {
        id: "reviews",
        type: "testimonials",
        props: {
          eyebrow: "Reviews",
          title: "What our clients say",
          variant: "homeCarousel",
          items: [
            "Doug was great. He's extremely detailed in his work. Will definitely use him again when I'm ready to upgrade the other shower door. Highly recommend! | Thomas F.",
            "Very happy with the service by Doug. Fast out to give a quote, friendly and good communication, installation as promised and high quality product. | Leah O.",
            "Doug was simply fantastic. Very thorough and the shower glass turned out amazing! Highly recommend! | Gary D.",
            "Doug was a great communicator and made the whole process easy. He was meticulous, did a great job and was super great to work with! My glass and hardware are STUNNING! | Tyler W.",
            "Doug was great. From the time I called him he was punctual and thorough. We were extremely satisfied with the work that was done we will definitely be recommending him to others. | Donna K.",
            "Very pleased with the results on our frameless shower. Doug was great to work with, very responsive, and professional. | Will F.",
            "Great work! Doug was very professional and did a super job with my house window glass replacements. He arrived on time for the estimate and the install jobs. He also provided me with excellent, detailed proof of payment paperwork after the job was completed. | Pam",
            "Doug did an AMAZING job!! Very meticulous and made sure it was done right. Will definitely use again and highly recommend. | Kristy C.",
          ],
        },
      },
      {
        id: starterSectionId("contact", slug),
        type: "form",
        props: {
          eyebrow: "Contact Us",
          title: "Let us know how we can help!",
          body: "Contact us today to learn more about how we can help you enhance the beauty and functionality of your home.",
          formTitle: "Send us a message",
          variant: "homeContact",
          formSlug: "website-quote-request",
        },
      },
    ];
  }

  if (slug === "services") {
    return [
      {
        id: starterSectionId("hero", slug),
        type: "hero",
        props: {
          eyebrow: "Glass & Door Pro Services",
          title: "Residential and commercial glass, window, and door work.",
          body: "From frameless shower glass to windows, doors, repairs, and commercial storefront needs, Glass & Door Pro helps customers across the greater Charlotte area plan and finish the project with confidence.",
          imageUrl: "/cms-assets/images/gallery-shower1-1280w.webp",
          href: "/contact",
          label: "Request a Quote",
        },
      },
      {
        id: starterSectionId("services", slug),
        type: "linkGrid",
        props: {
          eyebrow: "Choose a Service Area",
          title: "Choose a service area",
          body: "Each service page includes more detail, project examples, and a direct path to request an estimate.",
          items: [
            "Frameless Showers | Custom shower glass and frameless enclosures measured and installed with clean, precise detail. | /services/frameless-showers | View Service",
            "Window Installation | Residential window replacement and installation for brighter rooms, tighter seals, and a refreshed exterior. | /services/window-installation | View Service",
            "Door Installation | Entry, patio, French, sliding, and storm doors installed for curb appeal, security, and daily use. | /services/door-installation | View Service",
            "Window Repair | Glass replacement and repair support for broken panes, failed seals, fogging, and damaged windows. | /services/window-repair | View Service",
            "Commercial Glass | Commercial doors, storefront glass, office glass, and repair work for Charlotte-area businesses. | /services/commercial-glass | View Service",
          ],
        },
      },
      {
        id: starterSectionId("steps", slug),
        type: "steps",
        props: {
          eyebrow: "How we help",
          title: "A straightforward path from first call to finished installation.",
          items: ["Tell us about the project", "Review options and measurements", "Schedule the work"],
        },
      },
      { id: starterSectionId("quote", slug), type: "sectionRef", props: { handle: "free-quote-cta" } },
    ];
  }

  if (slug === "about") {
    return [
      {
        id: starterSectionId("hero", slug),
        type: "hero",
        props: {
          title: "About Glass & Door Pro",
          body: "Serving the greater Charlotte area with integrity, craftsmanship, and a commitment to excellence.",
        },
      },
      {
        id: starterSectionId("story", slug),
        type: "splitContent",
        props: {
          eyebrow: "Our Story",
          title: "Meet Doug Adams",
          body: "With over 15 years of hands-on experience in the glazing and fenestration industry, Doug Adams founded Glass & Door Pro with a simple mission: to provide Charlotte homeowners with the highest quality glass installations without the high markup of big box stores.\n\nStarting as an apprentice and mastering the art of precision glass cutting and installation, Doug has seen it all. He specializes in the tricky, custom projects that other contractors turn away.\n\n\"We treat every home as if it were our own,\" says Doug. \"When we install a frameless shower door or a new set of windows, we're not just installing a product; we're upgrading your lifestyle and adding lasting value to your property.\"",
          variant: "aboutStory",
          imageUrl: "/cms-assets/images/contractor-about-1280w.webp",
          alt: "Doug Adams, owner of Glass & Door Pro",
          stats: ["15+ | Years Experience", "500+ | Projects Completed"],
        },
      },
      {
        id: starterSectionId("values", slug),
        type: "featureGrid",
        props: {
          title: "Our Core Values",
          body: "We build our business on trust, quality, and reliability.",
          variant: "valueCards",
          items: [
            "Precision | In glass work, a millimeter matters. We measure twice, cut once, and ensure every fit is perfect for a watertight, seamless finish.",
            "Integrity | We believe in transparent pricing and honest timelines. No hidden fees, no surprises - just quality work delivered as promised.",
            "Quality | We use only top-rated hardware and glass. We partner with the best manufacturers to ensure your installation lasts a lifetime.",
          ],
        },
      },
      {
        id: starterSectionId("cta", slug),
        type: "cta",
        props: {
          title: "Work With the Best in Charlotte",
          variant: "aboutPhonePair",
          href: "/contact",
          label: "Contact Doug Today",
        },
      },
    ];
  }

  if (slug === "contact") {
    return [
      {
        id: starterSectionId("hero", slug),
        type: "hero",
        props: {
          title: "Contact Us",
          body: "Get a free estimate for your project today.",
        },
      },
      {
        id: starterSectionId("form", slug),
        type: "form",
        props: {
          title: "Get In Touch",
          body: "Whether you're ready to start your bathroom renovation or just have a few questions about window replacement, we're here to help.",
          formTitle: "Send a Message",
          variant: "contactPage",
          formSlug: "website-quote-request",
        },
      },
    ];
  }

  if (slug === "gallery") {
    return [
      {
        id: starterSectionId("gallery", slug),
        type: "mediaGallery",
        props: {
          title: "Gallery",
          body: "Explore our work by category.",
          variant: "categoryCards",
          source: "fallback",
          categories: [
            "frameless-showers | Frameless Showers | Recent installations | /cms-assets/gallery/frameless-showers/03.jpg",
            "windows | Windows | Coming Soon",
            "doors | Doors | Coming Soon",
            "commercial-glass | Commercial Glass | Coming Soon",
          ],
          items: [
            "/cms-assets/gallery/frameless-showers/03.jpg | Frameless Shower Install - SouthPark | frameless-showers | Black frame glass shower enclosure with marble walls and freestanding tub installed by Glass & Door Pro in SouthPark, Charlotte, NC",
            "/cms-assets/gallery/frameless-showers/01.jpg | Frameless Shower Install - Myers Park | frameless-showers | Frameless glass shower enclosure with marble walls and built-in bench installed by Glass & Door Pro in Myers Park, Charlotte, NC",
            "/cms-assets/gallery/frameless-showers/06.jpg | Frameless Shower Install - Weddington | frameless-showers | Corner frameless shower with gold hardware and blue accent walls installed by Glass & Door Pro in Weddington, NC",
            "/cms-assets/gallery/frameless-showers/09.jpg | Frameless Shower Install - Waxhaw | frameless-showers | Sliding frameless shower door with marble walls and patterned floor installed by Glass & Door Pro in Waxhaw, NC",
            "/cms-assets/gallery/frameless-showers/02.jpg | Frameless Shower Install - Dilworth | frameless-showers | Modern frameless shower with barn door hardware and wood ceiling installed by Glass & Door Pro in Dilworth, Charlotte, NC",
            "/cms-assets/gallery/frameless-showers/08.jpg | Frameless Shower Install - Marvin | frameless-showers | Large frameless shower enclosure with dual shower heads installed by Glass & Door Pro in Marvin, NC near Monroe",
            "/cms-assets/gallery/frameless-showers/05.jpg | Frameless Shower Install - Plaza Midwood | frameless-showers | Black frame shower door with dark tile and modern hardware installed by Glass & Door Pro in Plaza Midwood, Charlotte, NC",
            "/cms-assets/gallery/frameless-showers/12.jpg | Frameless Shower Install - Matthews | frameless-showers | Frameless sliding shower door with gold hardware and wood vanity installed by Glass & Door Pro in Matthews, NC",
            "/cms-assets/gallery/frameless-showers/04.jpg | Frameless Shower Install - Ballantyne | frameless-showers | Corner frameless shower with gold hardware and blue tile floor installed by Glass & Door Pro in Ballantyne, Charlotte, NC",
            "/cms-assets/gallery/frameless-showers/07.jpg | Frameless Shower Install - Lake Norman | frameless-showers | Frameless glass shower with gray subway tile and half wall installed by Glass & Door Pro in the Lake Norman area, NC",
            "/cms-assets/gallery/frameless-showers/10.jpg | Frameless Shower Install - Fort Mill | frameless-showers | Frameless glass shower enclosure with patterned floor tile installed by Glass & Door Pro in Fort Mill, SC near Charlotte",
          ],
        },
      },
      { id: starterSectionId("quote", slug), type: "sectionRef", props: { handle: "free-quote-cta" } },
    ];
  }

  if (slug === "blog") {
    return [
      {
        id: starterSectionId("hero", slug),
        type: "hero",
        props: {
          eyebrow: "Glass & Door Pro",
          title: "Project notes and practical glass guidance",
          body: "CMS-managed articles, project updates, and maintenance guidance for glass, shower, window, and door projects.",
          imageUrl: "/opengraph.jpg",
        },
      },
      {
        id: starterSectionId("intro", slug),
        type: "content",
        props: {
          title: "Glass & Door Pro Blog",
          body: "Use the Blog workspace to publish articles. This page controls the blog landing intro and SEO while published posts render below it.",
        },
      },
      { id: starterSectionId("quote", slug), type: "sectionRef", props: { handle: "free-quote-cta" } },
    ];
  }

  if (slug === "services/showers") {
    return [
      {
        id: starterSectionId("hero", slug),
        type: "hero",
        props: {
          title: "Frameless Glass Showers",
          body: "Elevate your bathroom with custom-cut, heavy glass enclosures.",
          imageUrl: "/cms-assets/images/shower-hero.jpg",
          alt: "Custom frameless glass shower",
          variant: "simpleServiceHero",
        },
      },
      {
        id: starterSectionId("detail", slug),
        type: "splitContent",
        props: {
          eyebrow: "Frameless Showers",
          title: "The Standard of Luxury",
          body: "Frameless glass shower doors are the hallmark of a modern, luxury bathroom. Without bulky metal frames to collect grime and block light, your shower becomes an open, airy showcase of your tile work.\n\nAt Glass & Door Pro, we specialize in 3/8\" and 1/2\" heavy tempered glass enclosures. Each piece is custom-measured and cut to fit your specific opening, ensuring a perfect seal and a stunning look.",
          variant: "simpleServiceDetail",
          imagePosition: "none",
          itemStyle: "checkList",
          items: [
            "Custom Frameless Enclosures",
            "Sliding Glass Barn Doors",
            "Steam Shower Enclosures",
            "Inline Door and Panel",
            "Corner Showers (90° and Neo-Angle)",
            "Variety of Hardware Finishes (Chrome, Brushed Nickel, Matte Black, Oil Rubbed Bronze)",
          ],
          panelTitle: "Why Go Frameless?",
          panelItems: [
            "Easier Maintenance | No metal tracks at the bottom means no place for mold and mildew to hide. A simple squeegee is all you need.",
            "Visual Space | Clear glass makes your bathroom feel larger and showcases beautiful tile work rather than hiding it.",
            "Increased Home Value | Bathroom remodels offer some of the highest ROIs, and a frameless shower is a top wish-list item for buyers in Charlotte.",
          ],
          href: "/contact",
          label: "Request a Shower Quote",
        },
      },
    ];
  }

  if (slug === "services/windows") {
    return [
      {
        id: starterSectionId("hero", slug),
        type: "hero",
        props: {
          title: "Residential Windows",
          body: "Energy-efficient replacements and professional installation.",
          imageUrl: "/cms-assets/images/windows-service.jpg",
          alt: "Residential window replacement",
          variant: "simpleServiceHero",
        },
      },
      {
        id: starterSectionId("detail", slug),
        type: "splitContent",
        props: {
          eyebrow: "Residential Windows",
          title: "Clear Views, Better Efficiency",
          body: "Old, drafty windows are one of the biggest sources of energy loss in a home. Upgrading to modern, energy-efficient windows not only lowers your utility bills but also transforms the look of your home inside and out.\n\nGlass & Door Pro offers a wide selection of window styles to match your home's architecture, from traditional sash windows to modern picture windows.",
          imageUrl: "/cms-assets/images/windows-service.jpg",
          alt: "Modern window installation",
          variant: "simpleServiceDetail",
          imagePosition: "left",
          itemStyle: "checkGrid",
          items: [
            "Double Hung Windows",
            "Casement Windows",
            "Picture Windows",
            "Bay & Bow Windows",
            "Slider Windows",
            "Energy Star Rated Glass",
          ],
          href: "/contact",
          label: "Get a Window Quote",
        },
      },
      {
        id: starterSectionId("process", slug),
        type: "steps",
        props: {
          title: "Our Installation Process",
          variant: "processCards",
          items: [
            "Consultation | We visit your home to measure and discuss styles, materials, and efficiency options.",
            "Precision Installation | Our team removes old windows and installs new ones with minimal disruption to your home.",
            "Final Inspection | We ensure everything operates smoothly, is sealed tight, and clean up the work area completely.",
          ],
        },
      },
    ];
  }

  if (slug === "services/doors") {
    return [
      {
        id: starterSectionId("hero", slug),
        type: "hero",
        props: {
          title: "Professional Door Installation",
          body: "Make a grand entrance with high-quality exterior and interior doors.",
          imageUrl: "/cms-assets/images/door-service.jpg",
          alt: "Door installation",
          variant: "simpleServiceHero",
        },
      },
      {
        id: starterSectionId("detail", slug),
        type: "splitContent",
        props: {
          eyebrow: "Door Installation",
          title: "Security meets Style",
          body: "Your front door is the first thing people see. It needs to be beautiful, but it also needs to be secure and durable against the elements. We provide expert installation of entry doors, patio doors, and interior doors.",
          imageUrl: "/cms-assets/images/door-service.jpg",
          alt: "Modern entry door",
          variant: "simpleServiceDetail",
          imagePosition: "right",
          itemStyle: "borderList",
          items: [
            "Entry Doors | Fiberglass, steel, and wood options that provide superior security and insulation.",
            "Patio Doors | Sliding glass doors and French doors that connect your indoor and outdoor living spaces seamlessly.",
            "Interior Glass Doors | Frosted glass office doors, pantry doors, and closet doors for a modern touch.",
          ],
          href: "/contact",
          label: "Get a Door Quote",
        },
      },
    ];
  }

  const service = serviceStarterContent[slug];
  const servicePage = servicePageStarterContent[slug];
  if (service && servicePage) {
    const sections: CmsSectionBlock[] = [
      {
        id: starterSectionId("hero", slug),
        type: "hero",
        props: {
          title: service.title,
          body: service.body,
          imageUrl: servicePage.heroImageUrl,
          variant: "parallaxServiceHero",
          heroPreset: servicePage.heroPreset,
          href: "/contact",
          label: servicePage.heroLabel ?? "Request a Quote",
        },
      },
    ];

    if (servicePage.intro) {
      sections.push({
        id: starterSectionId("intro", slug),
        type: "content",
        props: {
          title: servicePage.intro.title,
          body: servicePage.intro.body,
          variant: "centeredIntro",
        },
      });
    }

    sections.push(
      {
        id: starterSectionId("benefits", slug),
        type: "featureGrid",
        props: {
          title: servicePage.benefitsTitle,
          variant: "benefitCards",
          tone: servicePage.benefitsTone,
          items: service.features,
        },
      },
      {
        id: starterSectionId("gallery", slug),
        type: "mediaGallery",
        props: {
          title: servicePage.galleryTitle,
          variant: "servicePair",
          source: "fallback",
          tone: servicePage.galleryTone,
          items: servicePage.galleryItems,
        },
      },
    );

    if (servicePage.processTitle && servicePage.processItems) {
      sections.push({
        id: starterSectionId("process", slug),
        type: "steps",
        props: {
          title: servicePage.processTitle,
          variant: "processNumbers",
          tone: servicePage.processTone,
          items: servicePage.processItems,
        },
      });
    }

    if (servicePage.iconColumnsTitle && servicePage.iconColumnItems) {
      sections.push({
        id: starterSectionId("reasons", slug),
        type: "featureGrid",
        props: {
          title: servicePage.iconColumnsTitle,
          variant: "iconColumns",
          items: servicePage.iconColumnItems,
        },
      });
    }

    sections.push(
      {
        id: starterSectionId("faq", slug),
        type: "faq",
        props: {
          title: "Frequently Asked Questions",
          variant: "faqCards",
          items: servicePage.faqItems,
        },
      },
      {
        id: starterSectionId("service-area", slug),
        type: "content",
        props: {
          title: "Serving the Greater Charlotte Area",
          body: serviceAreaBody,
          variant: "serviceArea",
        },
      },
      {
        id: starterSectionId("cta", slug),
        type: "cta",
        props: {
          title: servicePage.ctaTitle,
          body: servicePage.ctaBody,
          variant: "serviceClosing",
          href: "/contact",
          label: "Get Your Free Estimate",
          secondaryHref: "/",
          secondaryLabel: "Back to Home",
        },
      },
    );

    return sections;
  }

  if (service) {
    return [
      {
        id: starterSectionId("hero", slug),
        type: "hero",
        props: {
          eyebrow: service.eyebrow,
          title: service.title,
          body: service.body,
          imageUrl: service.imageUrl,
          href: "/contact",
          label: "Request a Quote",
        },
      },
      {
        id: starterSectionId("split", slug),
        type: "splitContent",
        props: {
          eyebrow: "Glass & Door Pro",
          title: service.title,
          body: service.body,
          imageUrl: service.imageUrl,
          alt: service.title,
          href: "/contact",
          label: "Start the Project",
        },
      },
      {
        id: starterSectionId("features", slug),
        type: "featureGrid",
        props: {
          title: "Project support",
          items: service.features,
        },
      },
      {
        id: starterSectionId("media-gallery", slug),
        type: "mediaGallery",
        props: {
          eyebrow: "Project Photos",
          title: `${service.eyebrow} gallery`,
          body: "This section renders matching Gallery-ready media records first, then keeps starter images in place during migration.",
          category: service.galleryCategory,
          fallbackNote: "Showing starter images until matching CMS gallery media is available.",
          items: [`${service.imageUrl} | ${service.eyebrow} project photo`],
        },
      },
      { id: starterSectionId("faq", slug), type: "sectionRef", props: { handle: "project-faq" } },
      { id: starterSectionId("quote", slug), type: "sectionRef", props: { handle: "free-quote-cta" } },
    ];
  }

  return [];
}

const sectionBlockProps = (block: CmsSectionBlock) => (block.props ?? {}) as Record<string, unknown>;

function isSeededHomeHero(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  return (
    block.type === "hero" &&
    typeof props.title === "string" &&
    props.title.includes("glass & door needs covered") &&
    (block.id === "hero-home" || props.imageUrl === "/opengraph.jpg")
  );
}

function hasReviewsAnchor(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  return block.id === "reviews" || props.anchor === "reviews" || props.anchorId === "reviews";
}

function blockTitleIncludes(block: CmsSectionBlock, text: string) {
  const props = sectionBlockProps(block);
  return typeof props.title === "string" && props.title.includes(text);
}

function normalizeCmsStarterVariant(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function blockVariantIs(block: CmsSectionBlock, type: string, ...variants: string[]) {
  const props = sectionBlockProps(block);
  const variant = typeof props.variant === "string" ? normalizeCmsStarterVariant(props.variant) : "";
  return block.type === type && variants.includes(variant);
}

function hasHomeAboutBlock(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  return block.type === "splitContent" && typeof props.imageUrl === "string" && props.imageUrl.includes("family-1280w");
}

function hasHomeServicesBlock(block: CmsSectionBlock) {
  return block.type === "featureGrid" && blockTitleIncludes(block, "What We Offer");
}

function hasHomeImageBandBlock(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  return block.type === "image" && typeof props.imageUrl === "string" && props.imageUrl.includes("gallery-door2");
}

function hasHomeWhyBlock(block: CmsSectionBlock) {
  return block.type === "splitContent" && blockTitleIncludes(block, "Get the job done right");
}

function hasHomeGalleryBlock(block: CmsSectionBlock) {
  return block.type === "mediaGallery" && blockTitleIncludes(block, "Recent Glass & Door Projects");
}

function hasHomeContactFormBlock(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  return block.type === "form" && props.formSlug === "website-quote-request";
}

function hasContactInfoBlock(block: CmsSectionBlock) {
  return block.type === "contactInfo";
}

function hasContactPageFormBlock(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  const variant = typeof props.variant === "string" ? normalizeCmsStarterVariant(props.variant) : "";
  return block.type === "form" && props.formSlug === "website-quote-request" && variant === "contactpage";
}

function hasAboutOwnerPhoto(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  return block.type === "splitContent" && typeof props.imageUrl === "string" && props.imageUrl.includes("contractor-about");
}

function hasAboutProofStats(block: CmsSectionBlock) {
  return block.type === "statGrid";
}

function hasAboutStoryVariant(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  const variant = typeof props.variant === "string" ? normalizeCmsStarterVariant(props.variant) : "";
  return block.type === "splitContent" && typeof props.imageUrl === "string" && props.imageUrl.includes("contractor-about") && variant === "aboutstory";
}

function hasAboutValueCards(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  const variant = typeof props.variant === "string" ? normalizeCmsStarterVariant(props.variant) : "";
  return block.type === "featureGrid" && blockTitleIncludes(block, "Our Core Values") && variant === "valuecards";
}

function hasAboutPhonePairCta(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  const variant = typeof props.variant === "string" ? normalizeCmsStarterVariant(props.variant) : "";
  return block.type === "cta" && blockTitleIncludes(block, "Work With the Best in Charlotte") && variant === "aboutphonepair";
}

function hasBlogIntroBlock(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  return block.type === "content" && typeof props.title === "string" && props.title.includes("Glass & Door Pro Blog");
}

function hasQuoteSectionRef(block: CmsSectionBlock) {
  const props = sectionBlockProps(block);
  return block.type === "sectionRef" && (props.handle === "free-quote-cta" || props.sectionId === "free-quote-cta");
}

function isLegacyThinHomeStarter(sections: CmsSectionBlock[]) {
  return (
    sections.length <= 5 &&
    sections.some((block) => block.type === "linkGrid" && blockTitleIncludes(block, "Glass and door services")) &&
    sections.some((block) => block.type === "steps" && blockTitleIncludes(block, "From request to finished install"))
  );
}

function hasServiceStarterHero(slug: string, sections: CmsSectionBlock[]) {
  const service = serviceStarterContent[slug];
  return Boolean(service && sections.some((block) => block.type === "hero" && blockTitleIncludes(block, service.title)));
}

function hasServiceGroupParityStarter(slug: string, sections: CmsSectionBlock[]) {
  if (!["services/showers", "services/windows", "services/doors"].includes(slug)) {
    return hasServiceStarterHero(slug, sections);
  }

  return (
    sections.some((block) => blockVariantIs(block, "hero", "simpleservicehero")) &&
    sections.some((block) => blockVariantIs(block, "splitContent", "simpleservicedetail")) &&
    (slug !== "services/windows" || sections.some((block) => blockVariantIs(block, "steps", "processcards")))
  );
}

function hasServicePageParityStarter(slug: string, sections: CmsSectionBlock[]) {
  const servicePage = servicePageStarterContent[slug];
  if (!servicePage) return hasServiceGroupParityStarter(slug, sections);

  return (
    sections.some((block) => blockVariantIs(block, "hero", "parallaxservicehero")) &&
    sections.some((block) => blockVariantIs(block, "featureGrid", "benefitcards")) &&
    sections.some((block) => blockVariantIs(block, "mediaGallery", "servicepair")) &&
    (!servicePage.processTitle || sections.some((block) => blockVariantIs(block, "steps", "processnumbers"))) &&
    (!servicePage.intro || sections.some((block) => blockVariantIs(block, "content", "centeredintro"))) &&
    (!servicePage.iconColumnsTitle || sections.some((block) => blockVariantIs(block, "featureGrid", "iconcolumns"))) &&
    sections.some((block) => blockVariantIs(block, "faq", "faqcards")) &&
    sections.some((block) => blockVariantIs(block, "content", "servicearea")) &&
    sections.some((block) => blockVariantIs(block, "cta", "serviceclosing"))
  );
}

function isLegacyServicePageStarter(slug: string, sections: CmsSectionBlock[]) {
  return (
    sections.length <= 10 &&
    (!hasServicePageParityStarter(slug, sections) ||
      sections.some((block) => block.type === "featureGrid" && blockTitleIncludes(block, "Project support")) ||
      sections.some(hasQuoteSectionRef))
  );
}

function isLegacyServiceStarter(slug: string, sections: CmsSectionBlock[]) {
  if (servicePageStarterContent[slug]) return isLegacyServicePageStarter(slug, sections);

  return (
    Boolean(serviceStarterContent[slug]) &&
    sections.length <= 7 &&
    (!hasServiceGroupParityStarter(slug, sections) ||
      sections.some((block) => block.type === "featureGrid" && blockTitleIncludes(block, "Project support")) ||
      sections.some(hasQuoteSectionRef))
  );
}

function isLegacyServicesOverviewStarter(sections: CmsSectionBlock[]) {
  return (
    sections.some((block) => block.type === "linkGrid" && blockTitleIncludes(block, "Service categories")) ||
    sections.some((block) => block.type === "hero" && blockTitleIncludes(block, "Glass, shower, window, door, repair, and commercial services")) ||
    !sections.some((block) => block.type === "steps" && blockTitleIncludes(block, "A straightforward path from first call to finished installation."))
  );
}

function isLegacyAboutStarter(sections: CmsSectionBlock[]) {
  return (
    !sections.some(hasAboutStoryVariant) ||
    !sections.some(hasAboutValueCards) ||
    !sections.some(hasAboutPhonePairCta) ||
    sections.some((block) => block.type === "statGrid" && blockTitleIncludes(block, "Built on steady project work")) ||
    sections.some(hasQuoteSectionRef)
  );
}

function isLegacyContactStarter(sections: CmsSectionBlock[]) {
  return (
    !sections.some((block) => block.type === "hero" && blockTitleIncludes(block, "Contact Us")) ||
    !sections.some(hasContactPageFormBlock) ||
    sections.some(hasContactInfoBlock)
  );
}

function isLegacyGalleryStarter(sections: CmsSectionBlock[]) {
  const gallery = sections.find((block) =>
    block.type === "mediaGallery" && (blockTitleIncludes(block, "Project Gallery") || blockTitleIncludes(block, "Gallery"))
  );
  const galleryProps = gallery ? sectionBlockProps(gallery) : {};
  const galleryVariant = typeof galleryProps.variant === "string" ? normalizeCmsStarterVariant(galleryProps.variant) : "";

  return (
    !gallery ||
    galleryVariant !== "categorycards" ||
    sections.some((block) => block.type === "hero" && (blockTitleIncludes(block, "Recent glass and door project photos") || blockTitleIncludes(block, "Gallery")))
  );
}

function upgradeStarterSectionsForSlug(slug: string, sections: CmsSectionBlock[]) {
  if (sections.length === 0) return starterSectionsForSlug(slug);
  if (
    slug !== "home" &&
    slug !== "contact" &&
    slug !== "about" &&
    slug !== "blog" &&
    slug !== "services" &&
    slug !== "gallery" &&
    !serviceStarterContent[slug]
  ) return sections;

  const defaults = starterSectionsForSlug(slug);
  let next = [...sections];
  let changed = false;

  if (serviceStarterContent[slug]) {
    return isLegacyServiceStarter(slug, next) ? defaults : sections;
  }

  if (slug === "services" && isLegacyServicesOverviewStarter(next)) return defaults;
  if (slug === "about" && isLegacyAboutStarter(next)) return defaults;
  if (slug === "contact" && isLegacyContactStarter(next)) return defaults;
  if (slug === "gallery" && isLegacyGalleryStarter(next)) return defaults;

  if (slug === "home") {
    if (isLegacyThinHomeStarter(next)) return defaults;

    const videoHero = defaults.find((block) => block.type === "videoHero");
    const about = defaults.find(hasHomeAboutBlock);
    const services = defaults.find(hasHomeServicesBlock);
    const imageBand = defaults.find(hasHomeImageBandBlock);
    const why = defaults.find(hasHomeWhyBlock);
    const gallery = defaults.find(hasHomeGalleryBlock);
    const reviews = defaults.find((block) => hasReviewsAnchor(block));
    const contactForm = defaults.find(hasHomeContactFormBlock);

    const insertBeforeQuote = (block: CmsSectionBlock) => {
      const quoteIndex = next.findIndex(hasQuoteSectionRef);
      if (quoteIndex >= 0) {
        next.splice(quoteIndex, 0, block);
      } else {
        next.push(block);
      }
    };

    if (videoHero) {
      const videoHeroIndex = next.findIndex((block) => block.type === "videoHero");
      if (videoHeroIndex >= 0) {
        const existingProps = sectionBlockProps(next[videoHeroIndex]);
        const defaultProps = sectionBlockProps(videoHero);
        const patchedHero = {
          ...next[videoHeroIndex],
          props: {
            ...existingProps,
            videoUrl: defaultProps.videoUrl,
            body: existingProps.body === previousHomeHeroBody || !existingProps.body ? defaultProps.body : existingProps.body,
            eyebrow: "",
            posterUrl: "",
          },
        };
        if (JSON.stringify(patchedHero) !== JSON.stringify(next[videoHeroIndex])) {
          next[videoHeroIndex] = patchedHero;
          changed = true;
        }
      } else {
        const heroIndex = next.findIndex(isSeededHomeHero);
        if (heroIndex >= 0) {
          next[heroIndex] = videoHero;
        } else {
          next = [videoHero, ...next];
        }
        changed = true;
      }
    }

    if (about) {
      const aboutIndex = next.findIndex(hasHomeAboutBlock);
      if (aboutIndex >= 0) {
        const existingProps = sectionBlockProps(next[aboutIndex]);
        const defaultProps = sectionBlockProps(about);
        const patchedAbout = {
          ...next[aboutIndex],
          props: {
            ...existingProps,
            imagePosition: existingProps.imagePosition ?? defaultProps.imagePosition,
          },
        };
        if (JSON.stringify(patchedAbout) !== JSON.stringify(next[aboutIndex])) {
          next[aboutIndex] = patchedAbout;
          changed = true;
        }
      } else {
        const heroIndex = next.findIndex((block) => block.type === "videoHero" || block.type === "hero");
        next.splice(heroIndex >= 0 ? heroIndex + 1 : 0, 0, about);
        changed = true;
      }
    }

    if (services) {
      const servicesIndex = next.findIndex(hasHomeServicesBlock);
      if (servicesIndex >= 0) {
        const existingProps = sectionBlockProps(next[servicesIndex]);
        const defaultProps = sectionBlockProps(services);
        const existingItems = Array.isArray(existingProps.items) ? existingProps.items : [];
        const shouldRepairDoorCopy = existingItems.some((item) => item === previousHomeDoorServiceCopy);
        const patchedServices = {
          ...next[servicesIndex],
          props: {
            ...existingProps,
            variant: existingProps.variant ?? defaultProps.variant,
            items: shouldRepairDoorCopy ? defaultProps.items : existingProps.items,
          },
        };
        if (JSON.stringify(patchedServices) !== JSON.stringify(next[servicesIndex])) {
          next[servicesIndex] = patchedServices;
          changed = true;
        }
      } else {
        const aboutIndex = next.findIndex(hasHomeAboutBlock);
        next.splice(aboutIndex >= 0 ? aboutIndex + 1 : next.length, 0, services);
        changed = true;
      }
    }

    if (imageBand) {
      const imageBandIndex = next.findIndex(hasHomeImageBandBlock);
      if (imageBandIndex >= 0) {
        const existingProps = sectionBlockProps(next[imageBandIndex]);
        const defaultProps = sectionBlockProps(imageBand);
        const patchedImageBand = {
          ...next[imageBandIndex],
          props: {
            ...existingProps,
            variant: existingProps.variant ?? defaultProps.variant,
          },
        };
        if (JSON.stringify(patchedImageBand) !== JSON.stringify(next[imageBandIndex])) {
          next[imageBandIndex] = patchedImageBand;
          changed = true;
        }
      } else {
        const servicesIndex = next.findIndex(hasHomeServicesBlock);
        next.splice(servicesIndex >= 0 ? servicesIndex + 1 : next.length, 0, imageBand);
        changed = true;
      }
    }

    if (why) {
      const whyIndex = next.findIndex(hasHomeWhyBlock);
      if (whyIndex >= 0) {
        const existingProps = sectionBlockProps(next[whyIndex]);
        const defaultProps = sectionBlockProps(why);
        const patchedWhy = {
          ...next[whyIndex],
          props: {
            ...existingProps,
            badgeValue: existingProps.badgeValue ?? defaultProps.badgeValue,
            badgeLabel: existingProps.badgeLabel ?? defaultProps.badgeLabel,
          },
        };
        if (JSON.stringify(patchedWhy) !== JSON.stringify(next[whyIndex])) {
          next[whyIndex] = patchedWhy;
          changed = true;
        }
      } else {
        const imageBandIndex = next.findIndex(hasHomeImageBandBlock);
        next.splice(imageBandIndex >= 0 ? imageBandIndex + 1 : next.length, 0, why);
        changed = true;
      }
    }

    if (gallery) {
      const galleryIndex = next.findIndex(hasHomeGalleryBlock);
      if (galleryIndex >= 0) {
        const existingProps = sectionBlockProps(next[galleryIndex]);
        const defaultProps = sectionBlockProps(gallery);
        const patchedGallery = {
          ...next[galleryIndex],
          props: {
            ...existingProps,
            variant: existingProps.variant ?? defaultProps.variant,
            source: existingProps.source ?? defaultProps.source,
            limit: existingProps.limit ?? defaultProps.limit,
            showCaptions: existingProps.showCaptions ?? defaultProps.showCaptions,
          },
        };
        if (JSON.stringify(patchedGallery) !== JSON.stringify(next[galleryIndex])) {
          next[galleryIndex] = patchedGallery;
          changed = true;
        }
      } else {
        const whyIndex = next.findIndex(hasHomeWhyBlock);
        next.splice(whyIndex >= 0 ? whyIndex + 1 : next.length, 0, gallery);
        changed = true;
      }
    }

    if (reviews) {
      const reviewsIndex = next.findIndex(hasReviewsAnchor);
      if (reviewsIndex >= 0) {
        const existingProps = sectionBlockProps(next[reviewsIndex]);
        const defaultProps = sectionBlockProps(reviews);
        const existingItems = Array.isArray(existingProps.items) ? existingProps.items.filter((item): item is string => typeof item === "string") : [];
        const defaultItems = Array.isArray(defaultProps.items) ? defaultProps.items.filter((item): item is string => typeof item === "string") : [];
        const mergedItems = [...existingItems];
        defaultItems.forEach((item) => {
          if (!mergedItems.includes(item)) mergedItems.push(item);
        });
        const patchedReviews = {
          ...next[reviewsIndex],
          props: {
            ...existingProps,
            variant: existingProps.variant ?? defaultProps.variant,
            items: mergedItems.length > 0 ? mergedItems : defaultProps.items,
          },
        };
        if (JSON.stringify(patchedReviews) !== JSON.stringify(next[reviewsIndex])) {
          next[reviewsIndex] = patchedReviews;
          changed = true;
        }
      } else {
        insertBeforeQuote(reviews);
        changed = true;
      }
    }

    if (contactForm) {
      const contactIndex = next.findIndex(hasHomeContactFormBlock);
      if (contactIndex >= 0) {
        const existingProps = sectionBlockProps(next[contactIndex]);
        const defaultProps = sectionBlockProps(contactForm);
        const patchedContact = {
          ...next[contactIndex],
          props: {
            ...existingProps,
            eyebrow: existingProps.eyebrow ?? defaultProps.eyebrow,
            formTitle: existingProps.formTitle ?? defaultProps.formTitle,
            variant: existingProps.variant ?? defaultProps.variant,
          },
        };
        if (JSON.stringify(patchedContact) !== JSON.stringify(next[contactIndex])) {
          next[contactIndex] = patchedContact;
          changed = true;
        }
      } else {
        insertBeforeQuote(contactForm);
        changed = true;
      }
    }

    const withoutHomeQuote = next.filter((block) => !hasQuoteSectionRef(block));
    if (withoutHomeQuote.length !== next.length) {
      next = withoutHomeQuote;
      changed = true;
    }
  }

  if (slug === "about") {
    const ownerPhotoStory = defaults.find(hasAboutOwnerPhoto);
    const proofStats = defaults.find(hasAboutProofStats);

    if (ownerPhotoStory && !next.some(hasAboutOwnerPhoto)) {
      const storyIndex = next.findIndex((block) => block.type === "splitContent");
      if (storyIndex >= 0) {
        next[storyIndex] = {
          ...next[storyIndex],
          props: {
            ...sectionBlockProps(next[storyIndex]),
            ...sectionBlockProps(ownerPhotoStory),
          },
        };
      } else {
        const heroIndex = next.findIndex((block) => block.type === "hero");
        next.splice(heroIndex >= 0 ? heroIndex + 1 : 0, 0, ownerPhotoStory);
      }
      changed = true;
    }

    if (proofStats && !next.some(hasAboutProofStats)) {
      const quoteIndex = next.findIndex(hasQuoteSectionRef);
      if (quoteIndex >= 0) {
        next.splice(quoteIndex, 0, proofStats);
      } else {
        next.push(proofStats);
      }
      changed = true;
    }
  }

  if (slug === "contact") {
    const contactInfo = defaults.find(hasContactInfoBlock);
    if (contactInfo && !next.some(hasContactInfoBlock)) {
      const formIndex = next.findIndex((block) => block.type === "form");
      if (formIndex >= 0) {
        next.splice(formIndex, 0, contactInfo);
      } else {
        next.push(contactInfo);
      }
      changed = true;
    }
  }

  if (slug === "blog") {
    const intro = defaults.find(hasBlogIntroBlock);
    const quote = defaults.find(hasQuoteSectionRef);

    if (intro && !next.some(hasBlogIntroBlock)) {
      const heroIndex = next.findIndex((block) => block.type === "hero");
      const quoteIndex = next.findIndex(hasQuoteSectionRef);
      const insertIndex = heroIndex >= 0 ? heroIndex + 1 : quoteIndex >= 0 ? quoteIndex : next.length;
      next.splice(insertIndex, 0, intro);
      changed = true;
    }

    if (quote && !next.some(hasQuoteSectionRef)) {
      next.push(quote);
      changed = true;
    }
  }

  return changed ? next : sections;
}

const legacyCmsAssetPathPairs = [
  ["/images/gallery/frameless-showers/01.png", "/cms-assets/gallery/frameless-showers/01.jpg"],
  ["/images/gallery/frameless-showers/02.png", "/cms-assets/gallery/frameless-showers/02.jpg"],
  ["/images/gallery/frameless-showers/03.png", "/cms-assets/gallery/frameless-showers/03.jpg"],
  ["/images/gallery/frameless-showers/04.png", "/cms-assets/gallery/frameless-showers/04.jpg"],
  ["/images/gallery/frameless-showers/05.png", "/cms-assets/gallery/frameless-showers/05.jpg"],
] as const;

function replaceLegacyCmsAssetPaths<T>(value: T): T {
  let serialized = JSON.stringify(value);
  if (!serialized) return value;

  let changed = false;
  for (const [legacyPath, nextPath] of legacyCmsAssetPathPairs) {
    if (serialized.includes(legacyPath)) {
      serialized = serialized.replaceAll(legacyPath, nextPath);
      changed = true;
    }
  }

  return changed ? JSON.parse(serialized) as T : value;
}

function defaultCmsCanonicalUrl(slug: string) {
  if (slug === "home") return "https://glassanddoorpro.com/";
  return `https://glassanddoorpro.com/${slug.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function defaultCmsPages(now: Date): InsertCmsPage[] {
  const pages: InsertCmsPage[] = [
    {
      title: "Home",
      slug: "home",
      status: "published",
      excerpt: "Charlotte glass, shower, window, and door services.",
      content: { sections: starterSectionsForSlug("home") },
      seo: {
        metaTitle: "Glass & Door Pro | Charlotte, NC Glass & Door Installation",
        metaDescription:
          "Glass & Door Pro serves Charlotte homeowners with frameless shower doors, windows, door replacement, window repair, and commercial glass.",
      },
      publishedAt: now,
    },
    {
      title: "Services",
      slug: "services",
      status: "published",
      excerpt: "Glass, shower, window, door, repair, and commercial services.",
      content: { sections: starterSectionsForSlug("services") },
      seo: {
        metaTitle: "Glass & Door Services | Glass & Door Pro",
        metaDescription:
          "Explore Glass & Door Pro services for showers, windows, doors, repairs, and commercial glass in greater Charlotte.",
      },
      publishedAt: now,
    },
    {
      title: "About",
      slug: "about",
      status: "published",
      excerpt: "Meet Doug Adams and the Glass & Door Pro story.",
      content: { sections: starterSectionsForSlug("about") },
      seo: {
        metaTitle: "About Glass & Door Pro | Charlotte Glass & Door Installer",
        metaDescription:
          "Meet Doug Adams and learn about Glass & Door Pro's glass, shower, window, and door installation work in the greater Charlotte area.",
      },
      publishedAt: now,
    },
    {
      title: "Contact",
      slug: "contact",
      status: "published",
      excerpt: "Request a free quote from Glass & Door Pro.",
      content: { sections: starterSectionsForSlug("contact") },
      seo: {
        metaTitle: "Contact Glass & Door Pro | Charlotte Glass Quotes",
        metaDescription: "Contact Glass & Door Pro for shower glass, windows, doors, repairs, and commercial glass in the Charlotte area.",
      },
      publishedAt: now,
    },
    {
      title: "Gallery",
      slug: "gallery",
      status: "published",
      excerpt: "Recent glass, shower, window, and door projects.",
      content: { sections: starterSectionsForSlug("gallery") },
      seo: {
        metaTitle: "Glass & Door Project Gallery | Glass & Door Pro",
        metaDescription: "View recent frameless shower, window, door, and commercial glass projects from Glass & Door Pro.",
      },
      publishedAt: now,
    },
    {
      title: "Blog",
      slug: "blog",
      status: "published",
      excerpt: "Project updates, maintenance guidance, and practical ideas for better glass, windows, showers, and doors.",
      content: { sections: starterSectionsForSlug("blog") },
      seo: {
        metaTitle: "Glass & Door Blog | Glass & Door Pro",
        metaDescription:
          "Read Glass & Door Pro articles, project notes, and practical guidance for glass, shower, window, and door projects.",
      },
      publishedAt: now,
    },
    {
      title: "Frameless Showers",
      slug: "services/frameless-showers",
      status: "published",
      excerpt: "Custom frameless shower glass installation.",
      content: { sections: starterSectionsForSlug("services/frameless-showers") },
      seo: {
        metaTitle: "Frameless Shower Doors | Glass & Door Pro",
        metaDescription: "Custom frameless shower door design and installation for homeowners in the greater Charlotte area.",
      },
      publishedAt: now,
    },
    {
      title: "Window Installation",
      slug: "services/window-installation",
      status: "published",
      excerpt: "Residential window installation and replacement.",
      content: { sections: starterSectionsForSlug("services/window-installation") },
      seo: {
        metaTitle: "Window Installation | Glass & Door Pro",
        metaDescription: "Residential window installation and replacement services from Glass & Door Pro in the greater Charlotte area.",
      },
      publishedAt: now,
    },
    {
      title: "Door Installation",
      slug: "services/door-installation",
      status: "published",
      excerpt: "Door replacement and installation services.",
      content: { sections: starterSectionsForSlug("services/door-installation") },
      seo: {
        metaTitle: "Door Installation | Glass & Door Pro",
        metaDescription: "Door replacement and installation services for homes in Charlotte, Monroe, Indian Trail, Matthews, and nearby areas.",
      },
      publishedAt: now,
    },
    {
      title: "Window Repair",
      slug: "services/window-repair",
      status: "published",
      excerpt: "Window glass repair and replacement.",
      content: { sections: starterSectionsForSlug("services/window-repair") },
      seo: {
        metaTitle: "Window Repair | Glass & Door Pro",
        metaDescription: "Window glass repair and replacement services for the greater Charlotte area.",
      },
      publishedAt: now,
    },
    {
      title: "Commercial Glass",
      slug: "services/commercial-glass",
      status: "published",
      excerpt: "Commercial glass replacement and installation.",
      content: { sections: starterSectionsForSlug("services/commercial-glass") },
      seo: {
        metaTitle: "Commercial Glass | Glass & Door Pro",
        metaDescription: "Commercial glass installation and replacement services for businesses around Charlotte.",
      },
      publishedAt: now,
    },
    {
      title: "Frameless Glass Showers",
      slug: "services/showers",
      status: "published",
      excerpt: "Custom frameless shower glass and heavy-glass enclosures.",
      content: { sections: starterSectionsForSlug("services/showers") },
      seo: {
        metaTitle: "Frameless Glass Showers | Glass & Door Pro",
        metaDescription:
          "Custom frameless shower glass, shower doors, and heavy-glass enclosures from Glass & Door Pro in the greater Charlotte area.",
      },
      publishedAt: now,
    },
    {
      title: "Residential Windows",
      slug: "services/windows",
      status: "published",
      excerpt: "Energy-efficient residential window replacement and installation.",
      content: { sections: starterSectionsForSlug("services/windows") },
      seo: {
        metaTitle: "Residential Windows | Glass & Door Pro",
        metaDescription:
          "Residential window replacement and energy-efficient installation services from Glass & Door Pro in the greater Charlotte area.",
      },
      publishedAt: now,
    },
    {
      title: "Professional Door Installation",
      slug: "services/doors",
      status: "published",
      excerpt: "Exterior, patio, and interior door installation.",
      content: { sections: starterSectionsForSlug("services/doors") },
      seo: {
        metaTitle: "Professional Door Installation | Glass & Door Pro",
        metaDescription:
          "Entry door, patio door, and interior door installation services from Glass & Door Pro for Charlotte area homes.",
      },
      publishedAt: now,
    },
  ];

  return pages.map((page) => ({
    ...page,
    seo: {
      ...page.seo,
      canonicalUrl: defaultCmsCanonicalUrl(page.slug),
    },
  }));
}

export function getDefaultCmsPageForSlug(slug: string, now = new Date()) {
  return defaultCmsPages(now).find((page) => page.slug === slug) ?? null;
}

export function getStarterCmsPageRepairPayload(page: CmsPage, now = new Date()): Partial<InsertCmsPage> | null {
  const defaultPage = getDefaultCmsPageForSlug(page.slug, now);
  if (!defaultPage) return null;

  const currentSeo = page.seo ?? {};
  const upgradedSections = upgradeStarterSectionsForSlug(page.slug, page.content.sections);

  return {
    excerpt: page.excerpt?.trim() ? page.excerpt : defaultPage.excerpt,
    content: page.content.sections.length === 0
      ? defaultPage.content
      : { ...page.content, sections: upgradedSections },
    seo: {
      ...defaultPage.seo,
      ...currentSeo,
      metaTitle: currentSeo.metaTitle?.trim() ? currentSeo.metaTitle : defaultPage.seo.metaTitle,
      metaDescription:
        currentSeo.metaDescription?.trim() && currentSeo.metaDescription.trim().length <= 160
          ? currentSeo.metaDescription
          : defaultPage.seo.metaDescription,
      ogTitle: currentSeo.ogTitle?.trim() ? currentSeo.ogTitle : defaultPage.seo.ogTitle,
      ogDescription: currentSeo.ogDescription?.trim() ? currentSeo.ogDescription : defaultPage.seo.ogDescription,
      canonicalUrl: currentSeo.canonicalUrl?.trim() ? currentSeo.canonicalUrl : defaultPage.seo.canonicalUrl,
    },
    publishedAt: page.publishedAt ?? defaultPage.publishedAt ?? now,
  };
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listCms<K extends CollectionName>(collection: K): Promise<CmsCollections[K][]>;
  getCms<K extends CollectionName>(
    collection: K,
    id: string,
  ): Promise<CmsCollections[K] | undefined>;
  createCms<K extends CollectionName>(
    collection: K,
    value: Insertable<CmsCollections[K]>,
  ): Promise<CmsCollections[K]>;
  updateCms<K extends CollectionName>(
    collection: K,
    id: string,
    value: Partial<Insertable<CmsCollections[K]>>,
  ): Promise<CmsCollections[K] | undefined>;
  replaceCmsCollection<K extends CollectionName>(
    collection: K,
    records: CmsCollections[K][],
  ): Promise<void>;
  restoreSnapshot(collections: CmsCollectionSnapshot, leads?: CrmLead[]): Promise<void>;
  deleteCms(collection: CollectionName, id: string): Promise<boolean>;
  getPageBySlug(slug: string): Promise<CmsPage | undefined>;
  getPostBySlug(slug: string): Promise<CmsBlogPost | undefined>;
  getPublicSettings(): Promise<CmsSetting[]>;
  createFormSubmission(submission: InsertCmsFormSubmission): Promise<CmsFormSubmission>;
  createLead(lead: InsertCrmLead): Promise<CrmLead>;
  listLeads(): Promise<CrmLead[]>;
  updateLead(id: string, lead: Partial<InsertCrmLead>): Promise<CrmLead | undefined>;
  replaceLeads(leads: CrmLead[]): Promise<void>;
  deleteLead(id: string): Promise<boolean>;
  getLeadPipeline(): Promise<Record<string, CrmLead[]>>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private collections: {
    [K in CollectionName]: Map<string, CmsCollections[K]>;
  };
  private leads: Map<string, CrmLead>;

  constructor() {
    this.users = new Map();
    this.collections = {
      pages: new Map(),
      forms: new Map(),
      formSubmissions: new Map(),
      blogPosts: new Map(),
      media: new Map(),
      sections: new Map(),
      branding: new Map(),
      colorPalettes: new Map(),
      typography: new Map(),
      menus: new Map(),
      sidebars: new Map(),
      documentation: new Map(),
      systemBackups: new Map(),
      systemUsers: new Map(),
      settings: new Map(),
    };
    this.leads = new Map();
    this.seedCms();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async listCms<K extends CollectionName>(collection: K): Promise<CmsCollections[K][]> {
    return Array.from(this.collections[collection].values());
  }

  async getCms<K extends CollectionName>(
    collection: K,
    id: string,
  ): Promise<CmsCollections[K] | undefined> {
    return this.collections[collection].get(id);
  }

  async createCms<K extends CollectionName>(
    collection: K,
    value: Insertable<CmsCollections[K]>,
  ): Promise<CmsCollections[K]> {
    const now = new Date();
    const item = {
      ...value,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as CmsCollections[K];
    this.collections[collection].set(item.id, item);
    return item;
  }

  async updateCms<K extends CollectionName>(
    collection: K,
    id: string,
    value: Partial<Insertable<CmsCollections[K]>>,
  ): Promise<CmsCollections[K] | undefined> {
    const current = this.collections[collection].get(id);
    if (!current) return undefined;
    const next = { ...current, ...value, updatedAt: new Date() } as CmsCollections[K];
    this.collections[collection].set(id, next);
    return next;
  }

  async deleteCms(collection: CollectionName, id: string): Promise<boolean> {
    return this.collections[collection].delete(id);
  }

  async replaceCmsCollection<K extends CollectionName>(
    collection: K,
    records: CmsCollections[K][],
  ): Promise<void> {
    const next = new Map<string, CmsCollections[K]>();
    records.forEach((record) => {
      next.set(record.id, record);
    });
    this.collections[collection] = next as (typeof this.collections)[K];
  }

  async restoreSnapshot(collections: CmsCollectionSnapshot, leads?: CrmLead[]): Promise<void> {
    for (const [collection, records] of Object.entries(collections) as Array<[CollectionName, CmsCollections[CollectionName][]]>) {
      await this.replaceCmsCollection(collection as never, records as never);
    }
    if (leads) {
      await this.replaceLeads(leads);
    }
  }

  async getPageBySlug(slug: string): Promise<CmsPage | undefined> {
    return Array.from(this.collections.pages.values()).find((page) => page.slug === slug);
  }

  async getPostBySlug(slug: string): Promise<CmsBlogPost | undefined> {
    return Array.from(this.collections.blogPosts.values()).find((post) => post.slug === slug);
  }

  async getPublicSettings(): Promise<CmsSetting[]> {
    return Array.from(this.collections.settings.values()).filter((setting) => setting.isPublic);
  }

  async createFormSubmission(insertSubmission: InsertCmsFormSubmission): Promise<CmsFormSubmission> {
    return await this.createCms("formSubmissions", {
      formId: null,
      name: null,
      email: null,
      phone: null,
      service: null,
      message: null,
      fields: {},
      status: "new",
      leadId: null,
      sourceUrl: null,
      referrer: null,
      userAgent: null,
      ipAddress: null,
      ...insertSubmission,
    });
  }

  async createLead(insertLead: InsertCrmLead): Promise<CrmLead> {
    const now = new Date();
    const lead: CrmLead = {
      assignedTo: null,
      email: null,
      phone: null,
      service: null,
      notes: null,
      source: "website",
      status: "new",
      pipelineStage: "new",
      priority: "normal",
      nextFollowUpAt: null,
      message: "",
      ...insertLead,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.leads.set(lead.id, lead);
    return lead;
  }

  async listLeads(): Promise<CrmLead[]> {
    return Array.from(this.leads.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async updateLead(id: string, lead: Partial<InsertCrmLead>): Promise<CrmLead | undefined> {
    const current = this.leads.get(id);
    if (!current) return undefined;
    const next = { ...current, ...lead, updatedAt: new Date() };
    this.leads.set(id, next);
    return next;
  }

  async replaceLeads(leads: CrmLead[]): Promise<void> {
    this.leads = new Map(leads.map((lead) => [lead.id, lead]));
  }

  async deleteLead(id: string): Promise<boolean> {
    return this.leads.delete(id);
  }

  async getLeadPipeline(): Promise<Record<string, CrmLead[]>> {
    const stages = getLeadPipelineStagesFromSettings(Array.from(this.collections.settings.values()));
    const pipeline = Object.fromEntries(stages.map((stage) => [stage, [] as CrmLead[]]));
    const fallbackStage = stages[0] ?? "new";
    for (const lead of await this.listLeads()) {
      const stage = pipeline[lead.pipelineStage] ? lead.pipelineStage : fallbackStage;
      pipeline[stage].push(lead);
    }
    return pipeline;
  }

  private seedCms() {
    const now = new Date();
    const withDates = <T extends object>(value: T) => ({
      ...value,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    });

    const pages = defaultCmsPages(now);

    pages.forEach((page) => {
      const record = withDates(page) as CmsPage;
      this.collections.pages.set(record.id, record);
    });

    const form = withDates({
      name: "Website Quote Request",
      slug: "website-quote-request",
      description: "Primary inbound website lead form.",
      fields: [
        { id: "name", name: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
        { id: "email", name: "email", label: "Email", type: "email", required: false, placeholder: "you@example.com" },
        { id: "phone", name: "phone", label: "Phone", type: "tel", required: false, placeholder: "(704) 555-0123" },
        {
          id: "service",
          name: "service",
          label: "Service",
          type: "select",
          required: false,
          placeholder: "Choose a service",
          options: ["Frameless Shower Door", "Window Replacement", "Door Installation", "Other / Repair"],
        },
        {
          id: "message",
          name: "message",
          label: "Project Details",
          type: "textarea",
          required: true,
          placeholder: "Tell us about your project",
        },
      ],
      notificationEmail: "Doug@GlassandDoorPro.com",
      isActive: true,
    }) as CmsForm;
    this.collections.forms.set(form.id, form);

    const branding = withDates({
      siteName: "Glass & Door Pro",
      tagline: "We've got your glass & door needs covered.",
      logoUrl: "/logo.png",
      faviconUrl: "/favicon.png",
      phone: "(704) 771-6111",
      email: "Doug@GlassandDoorPro.com",
      address: "2341 Waverly Dr, Monroe, NC 28112",
      socialLinks: {},
    }) as CmsBranding;
    this.collections.branding.set(branding.id, branding);

    const palette = withDates({
      name: "Glass & Door Pro Teal",
      tokens: {
        primary: "195 75% 38%",
        secondary: "210 20% 96%",
        accent: "195 60% 92%",
        background: "0 0% 100%",
        foreground: "215 50% 23%",
      },
      isActive: true,
    }) as CmsColorPalette;
    this.collections.colorPalettes.set(palette.id, palette);

    const typography = withDates({
      name: "Glass & Door Pro Default",
      headingFont: "Montserrat",
      bodyFont: "Open Sans",
      scale: {},
      isActive: true,
    }) as CmsTypography;
    this.collections.typography.set(typography.id, typography);

    const menu = withDates({
      name: "Main Navigation",
      location: "header",
      isActive: true,
      items: defaultHeaderMenuItems,
    }) as CmsMenu;
    this.collections.menus.set(menu.id, menu);

    const footerMenu = withDates({
      name: "Footer Navigation",
      location: "footer",
      isActive: true,
      items: defaultFooterMenuItems,
    }) as CmsMenu;
    this.collections.menus.set(footerMenu.id, footerMenu);

    const blogSidebar = withDates({
      name: "Blog Sidebar",
      location: "blog",
      isActive: true,
      widgets: [
        {
          id: "blog-contact",
          type: "contactCard",
          title: "Request a Quote",
          props: {
            body: "Talk with Glass & Door Pro about your shower, window, door, or commercial glass project.",
            phone: "(704) 771-6111",
            email: "Doug@GlassandDoorPro.com",
          },
        },
        {
          id: "blog-services",
          type: "serviceList",
          title: "Services",
          props: {
            items: [
              "Frameless Showers | /services/frameless-showers",
              "Window Installation | /services/window-installation",
              "Door Installation | /services/door-installation",
              "Window Repair | /services/window-repair",
              "Commercial Glass | /services/commercial-glass",
            ],
          },
        },
        {
          id: "blog-recent-posts",
          type: "recentPosts",
          title: "Recent Posts",
          props: {
            count: 3,
            label: "View All Posts",
          },
        },
      ],
    }) as CmsSidebar;
    this.collections.sidebars.set(blogSidebar.id, blogSidebar);

    const defaultSidebar = withDates({
      name: "Default Page Sidebar",
      location: "default",
      isActive: true,
      widgets: defaultPageSidebarWidgets,
    }) as CmsSidebar;
    this.collections.sidebars.set(defaultSidebar.id, defaultSidebar);

    const footerSidebar = withDates({
      name: "Footer Widget Area",
      location: "footer",
      isActive: false,
      widgets: defaultFooterSidebarWidgets,
    }) as CmsSidebar;
    this.collections.sidebars.set(footerSidebar.id, footerSidebar);

    const docs = withDates({
      title: "CMS Migration Notes",
      slug: "cms-migration-notes",
      body:
        "Glass & Door Pro pages can now be represented in CMS records while each frontend route keeps its hard-coded fallback until content is migrated.",
      category: "Content",
    }) as CmsDocumentation;
    this.collections.documentation.set(docs.id, docs);

    const adminGuide = withDates({
      title: "Admin Operating Notes",
      slug: "admin-operating-notes",
      body:
        "Use Pages for public route content, Sections for reusable blocks, Media for image metadata, and CRM for inbound website leads. Draft pages and posts can be previewed from the editor before publishing.",
      category: "System",
    }) as CmsDocumentation;
    this.collections.documentation.set(adminGuide.id, adminGuide);

    const blockGuide = withDates({
      title: "CMS Block Format Guide",
      slug: "cms-block-format-guide",
      body: cmsBlockFormatGuideBody,
      category: "Content",
    }) as CmsDocumentation;
    this.collections.documentation.set(blockGuide.id, blockGuide);

    const mediaGalleryGuide = withDates({
      title: "Media Gallery Publishing Guide",
      slug: "media-gallery-publishing-guide",
      body: cmsMediaGalleryGuideBody,
      category: "Content",
    }) as CmsDocumentation;
    this.collections.documentation.set(mediaGalleryGuide.id, mediaGalleryGuide);

    const scopeGuardrailsGuide = withDates({
      title: "Admin Scope Guardrails",
      slug: "admin-scope-guardrails",
      body: cmsAdminScopeGuardrailsBody,
      category: "System",
    }) as CmsDocumentation;
    this.collections.documentation.set(scopeGuardrailsGuide.id, scopeGuardrailsGuide);

    const crmLeadWorkflowGuide = withDates({
      title: "CRM Lead Workflow Guide",
      slug: "crm-lead-workflow-guide",
      body: cmsCrmLeadWorkflowGuideBody,
      category: "CRM",
    }) as CmsDocumentation;
    this.collections.documentation.set(crmLeadWorkflowGuide.id, crmLeadWorkflowGuide);

    const adminAccessGuide = withDates({
      title: "Admin Access Guide",
      slug: "admin-access-guide",
      body: cmsAdminAccessGuideBody,
      category: "System",
    }) as CmsDocumentation;
    this.collections.documentation.set(adminAccessGuide.id, adminAccessGuide);

    const widgetGuide = withDates({
      title: "Sidebar Widget Format Guide",
      slug: "sidebar-widget-format-guide",
      body: cmsSidebarWidgetGuideBody,
      category: "Design",
    }) as CmsDocumentation;
    this.collections.documentation.set(widgetGuide.id, widgetGuide);

    const migrationRunbook = withDates({
      title: "CMS Migration Runbook",
      slug: "cms-migration-runbook",
      body: cmsMigrationRunbookBody,
      category: "Content",
    }) as CmsDocumentation;
    this.collections.documentation.set(migrationRunbook.id, migrationRunbook);

    const adminUser = withDates({
      name: "Glass & Door Pro Admin",
      email: "Doug@GlassandDoorPro.com",
      role: "owner",
      status: "active",
      lastLoginAt: null,
    }) as CmsSystemUser;
    this.collections.systemUsers.set(adminUser.id, adminUser);

    const setting = withDates({
      key: "site",
      value: {
        businessName: "Glass & Door Pro",
        siteUrl: "https://glassanddoorpro.com",
        market: "Greater Charlotte area",
        businessHours: "Mon-Sat: 7am - 6pm",
        publicCmsEnabled: false,
        leadPipelineStages: ["new", "contacted", "estimate", "won", "lost"],
      },
      group: "general",
      isPublic: true,
    }) as CmsSetting;
    this.collections.settings.set(setting.id, setting);

    const section = withDates({
      name: "Free Quote CTA",
      handle: "free-quote-cta",
      category: "marketing",
      blocks: [
        {
          id: "quote-cta",
          type: "cta",
          props: {
            title: "Ready for a clearer view?",
            body: "Tell us about your shower, window, door, or commercial glass project.",
            href: "/contact",
            label: "Request a Quote",
          },
        },
      ],
      isReusable: true,
    }) as CmsSection;
    this.collections.sections.set(section.id, section);

    const faqSection = withDates({
      name: "Project FAQ",
      handle: "project-faq",
      category: "content",
      blocks: [
        {
          id: "project-faq",
          type: "faq",
          props: {
            eyebrow: "FAQ",
            title: "Glass & Door Project Questions",
            body: "A few quick answers customers often need before requesting an estimate.",
            items: [
              "Do you offer free estimates? | Yes. Share your project details and we will follow up with next steps.",
              "What areas do you serve? | Glass & Door Pro serves the greater Charlotte area.",
              "Can you help with custom shower glass? | Yes. We handle frameless shower glass, enclosures, and related installation needs.",
            ],
          },
        },
      ],
      isReusable: true,
    }) as CmsSection;
    this.collections.sections.set(faqSection.id, faqSection);
  }
}

export class DbStorage implements IStorage {
  private database: NonNullable<typeof db>;

  constructor(database: NonNullable<typeof db>) {
    this.database = database;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.database.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.database
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await this.database.insert(users).values(user).returning();
    return created;
  }

  async listCms<K extends CollectionName>(collection: K): Promise<CmsCollections[K][]> {
    const table = cmsTables[collection] as any;
    return (await (this.database as any).select().from(table).orderBy(desc(table.updatedAt))) as CmsCollections[K][];
  }

  async getCms<K extends CollectionName>(
    collection: K,
    id: string,
  ): Promise<CmsCollections[K] | undefined> {
    const table = cmsTables[collection] as any;
    const [record] = await (this.database as any)
      .select()
      .from(table)
      .where(eq(table.id, id))
      .limit(1);
    return record as CmsCollections[K] | undefined;
  }

  async createCms<K extends CollectionName>(
    collection: K,
    value: Insertable<CmsCollections[K]>,
  ): Promise<CmsCollections[K]> {
    const table = cmsTables[collection] as any;
    const [created] = await (this.database as any)
      .insert(table)
      .values(value as any)
      .returning();
    return created as CmsCollections[K];
  }

  async updateCms<K extends CollectionName>(
    collection: K,
    id: string,
    value: Partial<Insertable<CmsCollections[K]>>,
  ): Promise<CmsCollections[K] | undefined> {
    const table = cmsTables[collection] as any;
    const [updated] = await (this.database as any)
      .update(table)
      .set({ ...(value as any), updatedAt: new Date() })
      .where(eq(table.id, id))
      .returning();
    return updated as CmsCollections[K] | undefined;
  }

  async deleteCms(collection: CollectionName, id: string): Promise<boolean> {
    const table = cmsTables[collection] as any;
    const deleted = await (this.database as any)
      .delete(table)
      .where(eq(table.id, id))
      .returning({ id: table.id });
    return deleted.length > 0;
  }

  async replaceCmsCollection<K extends CollectionName>(
    collection: K,
    records: CmsCollections[K][],
  ): Promise<void> {
    const table = cmsTables[collection] as any;
    await this.database.transaction(async (tx) => {
      await (tx as any).delete(table);
      if (records.length > 0) {
        await (tx as any).insert(table).values(records as any);
      }
    });
  }

  async restoreSnapshot(collections: CmsCollectionSnapshot, leads?: CrmLead[]): Promise<void> {
    await this.database.transaction(async (tx) => {
      for (const [collection, records] of Object.entries(collections) as Array<[CollectionName, CmsCollections[CollectionName][]]>) {
        const table = cmsTables[collection] as any;
        await (tx as any).delete(table);
        if (records.length > 0) {
          await (tx as any).insert(table).values(records as any);
        }
      }
      if (leads) {
        await tx.delete(crmLeads);
        if (leads.length > 0) {
          await tx.insert(crmLeads).values(leads);
        }
      }
    });
  }

  async getPageBySlug(slug: string): Promise<CmsPage | undefined> {
    const [page] = await this.database
      .select()
      .from(cmsPages)
      .where(eq(cmsPages.slug, slug))
      .limit(1);
    return page;
  }

  async getPostBySlug(slug: string): Promise<CmsBlogPost | undefined> {
    const [post] = await this.database
      .select()
      .from(cmsBlogPosts)
      .where(eq(cmsBlogPosts.slug, slug))
      .limit(1);
    return post;
  }

  async getPublicSettings(): Promise<CmsSetting[]> {
    return await this.database
      .select()
      .from(cmsSettings)
      .where(eq(cmsSettings.isPublic, true));
  }

  async createFormSubmission(submission: InsertCmsFormSubmission): Promise<CmsFormSubmission> {
    const [created] = await this.database.insert(cmsFormSubmissions).values(submission).returning();
    return created;
  }

  async createLead(lead: InsertCrmLead): Promise<CrmLead> {
    const [created] = await this.database.insert(crmLeads).values(lead).returning();
    return created;
  }

  async listLeads(): Promise<CrmLead[]> {
    return await this.database.select().from(crmLeads).orderBy(desc(crmLeads.createdAt));
  }

  async updateLead(id: string, lead: Partial<InsertCrmLead>): Promise<CrmLead | undefined> {
    const [updated] = await this.database
      .update(crmLeads)
      .set({ ...lead, updatedAt: new Date() })
      .where(eq(crmLeads.id, id))
      .returning();
    return updated;
  }

  async replaceLeads(leads: CrmLead[]): Promise<void> {
    await this.database.transaction(async (tx) => {
      await tx.delete(crmLeads);
      if (leads.length > 0) {
        await tx.insert(crmLeads).values(leads);
      }
    });
  }

  async deleteLead(id: string): Promise<boolean> {
    const deleted = await this.database
      .delete(crmLeads)
      .where(eq(crmLeads.id, id))
      .returning({ id: crmLeads.id });
    return deleted.length > 0;
  }

  async getLeadPipeline(): Promise<Record<string, CrmLead[]>> {
    const stages = getLeadPipelineStagesFromSettings(await this.listCms("settings"));
    const pipeline = Object.fromEntries(stages.map((stage) => [stage, [] as CrmLead[]]));
    const fallbackStage = stages[0] ?? "new";
    for (const lead of await this.listLeads()) {
      const stage = pipeline[lead.pipelineStage] ? lead.pipelineStage : fallbackStage;
      pipeline[stage].push(lead);
    }
    return pipeline;
  }

  async seedDefaults() {
    const existingPages = await this.listCms("pages");
    if (existingPages.length > 0) {
      await this.backfillSeededRecords();
      return;
    }

    const seeded = new MemStorage();
    for (const collection of Object.keys(cmsTables) as CollectionName[]) {
      const records = await seeded.listCms(collection);
      for (const record of records) {
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...insert } = record;
        await this.createCms(collection, insert as never);
      }
    }
  }

  private async backfillSeededRecords() {
    const pages = await this.listCms("pages");
    const pageSlugs = new Set(pages.map((page) => page.slug));
    const defaultPagesBySlug = new Map(defaultCmsPages(new Date()).map((page) => [page.slug, page]));
    for (const page of defaultCmsPages(new Date())) {
      if (!pageSlugs.has(page.slug)) {
        await this.createCms("pages", page as Insertable<CmsPage>);
      }
    }
    for (const page of pages) {
      const defaultPage = defaultPagesBySlug.get(page.slug);
      if (!defaultPage) continue;
      const missingMetaTitle = !page.seo.metaTitle?.trim() && defaultPage.seo.metaTitle;
      const missingMetaDescription = !page.seo.metaDescription?.trim() && defaultPage.seo.metaDescription;
      const missingCanonicalUrl = !page.seo.canonicalUrl?.trim() && defaultPage.seo.canonicalUrl;
      if (missingMetaTitle || missingMetaDescription || missingCanonicalUrl) {
        await this.updateCms("pages", page.id, {
          seo: {
            ...defaultPage.seo,
            ...page.seo,
            metaTitle: page.seo.metaTitle || defaultPage.seo.metaTitle,
            metaDescription: page.seo.metaDescription || defaultPage.seo.metaDescription,
            canonicalUrl: page.seo.canonicalUrl || defaultPage.seo.canonicalUrl,
          },
        });
      }
      if (page.content.sections.length === 0 && defaultPage.content.sections.length > 0) {
        await this.updateCms("pages", page.id, {
          content: defaultPage.content,
          excerpt: page.excerpt?.trim() ? page.excerpt : defaultPage.excerpt,
          status: page.status || defaultPage.status,
          publishedAt: page.publishedAt ?? defaultPage.publishedAt,
        });
      } else {
        const upgradedSections = upgradeStarterSectionsForSlug(page.slug, page.content.sections);
        if (JSON.stringify(upgradedSections) !== JSON.stringify(page.content.sections)) {
          await this.updateCms("pages", page.id, {
            content: { ...page.content, sections: upgradedSections },
          });
        }
      }
    }

    const menus = await this.listCms("menus");
    const headerMenu = menus.find((menu) => menu.location === "header" && menu.isActive);
    const looksLikeOriginalSeed =
      headerMenu &&
      headerMenu.items.length <= 3 &&
      !headerMenu.items.some((item) => item.id === "services" || item.children?.length);

    if (looksLikeOriginalSeed) {
      await this.updateCms("menus", headerMenu.id, { items: defaultHeaderMenuItems });
    }

    const looksLikeSeededHeaderWithBlog =
      headerMenu &&
      headerMenu.items.length <= 7 &&
      headerMenu.items.some((item) => item.id === "blog" || item.href === "/blog") &&
      headerMenu.items.some((item) => item.id === "services") &&
      headerMenu.items.some((item) => item.id === "gallery") &&
      headerMenu.items.some((item) => item.id === "reviews") &&
      headerMenu.items.some((item) => item.id === "contact");

    if (looksLikeSeededHeaderWithBlog) {
      await this.updateCms("menus", headerMenu.id, { items: defaultHeaderMenuItems });
    }

    const activeHeaderMenu = (await this.listCms("menus")).find((menu) => menu.location === "header" && menu.isActive);
    if (activeHeaderMenu?.items.some((item) => item.id === "about" && item.href === "/#about")) {
      await this.updateCms("menus", activeHeaderMenu.id, {
        items: activeHeaderMenu.items.map((item) =>
          item.id === "about" && item.href === "/#about" ? { ...item, href: "/about" } : item,
        ),
      });
    }

    const hasFooterMenu = menus.some((menu) => menu.location === "footer" && menu.isActive);
    if (!hasFooterMenu) {
      await this.createCms("menus", {
        name: "Footer Navigation",
        location: "footer",
        isActive: true,
        items: defaultFooterMenuItems,
      });
    }

    const sidebars = await this.listCms("sidebars");
    const hasBlogSidebar = sidebars.some((sidebar) => sidebar.location === "blog");
    if (!hasBlogSidebar) {
      const seeded = new MemStorage();
      const blogSidebar = (await seeded.listCms("sidebars")).find((sidebar) => sidebar.location === "blog");
      if (blogSidebar) {
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...insert } = blogSidebar;
        await this.createCms("sidebars", insert);
      }
    }
    const blogSidebar = sidebars.find((sidebar) => sidebar.location === "blog");
    if (blogSidebar && !blogSidebar.widgets.some((widget) => widget.type === "recentPosts")) {
      await this.updateCms("sidebars", blogSidebar.id, {
        widgets: [
          ...blogSidebar.widgets,
          {
            id: "blog-recent-posts",
            type: "recentPosts",
            title: "Recent Posts",
            props: {
              count: 3,
              label: "View All Posts",
            },
          },
        ],
      });
    }
    const hasDefaultSidebar = sidebars.some((sidebar) => sidebar.location === "default");
    if (!hasDefaultSidebar) {
      await this.createCms("sidebars", {
        name: "Default Page Sidebar",
        location: "default",
        isActive: true,
        widgets: defaultPageSidebarWidgets,
      });
    }
    const hasFooterSidebar = sidebars.some((sidebar) => sidebar.location === "footer");
    if (!hasFooterSidebar) {
      await this.createCms("sidebars", {
        name: "Footer Widget Area",
        location: "footer",
        isActive: false,
        widgets: defaultFooterSidebarWidgets,
      });
    }
    const seededFooterSidebar = sidebars.find((sidebar) => sidebar.location === "footer");
    const footerSidebarUsesStarterWidgets =
      seededFooterSidebar &&
      JSON.stringify(seededFooterSidebar.widgets) === JSON.stringify(defaultFooterSidebarWidgets);
    if (seededFooterSidebar?.isActive && footerSidebarUsesStarterWidgets) {
      await this.updateCms("sidebars", seededFooterSidebar.id, { isActive: false });
    }

    const docs = await this.listCms("documentation");
    const hasAdminGuide = docs.some((doc) => doc.slug === "admin-operating-notes");
    if (!hasAdminGuide) {
      await this.createCms("documentation", {
        title: "Admin Operating Notes",
        slug: "admin-operating-notes",
        body:
          "Use Pages for public route content, Sections for reusable blocks, Media for image metadata, and CRM for inbound website leads. Draft pages and posts can be previewed from the editor before publishing.",
        category: "System",
      });
    }
    const hasBlockGuide = docs.some((doc) => doc.slug === "cms-block-format-guide");
    if (!hasBlockGuide) {
      await this.createCms("documentation", {
        title: "CMS Block Format Guide",
        slug: "cms-block-format-guide",
        body: cmsBlockFormatGuideBody,
        category: "Content",
      });
    }
    const blockGuide = docs.find((doc) => doc.slug === "cms-block-format-guide");
    if (
      blockGuide?.body === legacyCmsBlockFormatGuideBody ||
      (blockGuide?.body.startsWith("Page and Section blocks use JSON arrays.") &&
        (!blockGuide.body.includes("featureGrid item format") ||
          !blockGuide.body.includes("serviceList item format") ||
          !blockGuide.body.includes("videoHero uses videoUrl") ||
          !blockGuide.body.includes("contactInfo pulls Branding") ||
          !blockGuide.body.includes("safe public anchor targets") ||
          !blockGuide.body.includes("recentPosts renders published CMS blog posts") ||
          !blockGuide.body.includes("field IDs and names must be unique") ||
          !blockGuide.body.includes("parallaxServiceHero") ||
          !blockGuide.body.includes("benefitCards") ||
          !blockGuide.body.includes("iconColumns") ||
          !blockGuide.body.includes("servicePair") ||
          !blockGuide.body.includes("Section Actions CSV")))
    ) {
      await this.updateCms("documentation", blockGuide.id, { body: cmsBlockFormatGuideBody });
    }
    const hasMediaGalleryGuide = docs.some((doc) => doc.slug === "media-gallery-publishing-guide");
    if (!hasMediaGalleryGuide) {
      await this.createCms("documentation", {
        title: "Media Gallery Publishing Guide",
        slug: "media-gallery-publishing-guide",
        body: cmsMediaGalleryGuideBody,
        category: "Content",
      });
    }
    const mediaGalleryGuide = docs.find((doc) => doc.slug === "media-gallery-publishing-guide");
    if (
      mediaGalleryGuide?.body === previousCmsMediaGalleryGuideBody ||
      (mediaGalleryGuide?.body.includes("Use the Media workspace as the source of truth") &&
        (!mediaGalleryGuide.body.includes("Media Actions CSV") ||
          !mediaGalleryGuide.body.includes("not registered in Media") ||
          !mediaGalleryGuide.body.includes("servicePair")))
    ) {
      await this.updateCms("documentation", mediaGalleryGuide.id, { body: cmsMediaGalleryGuideBody });
    }
    const scopeGuardrailsGuide = docs.find((doc) => doc.slug === "admin-scope-guardrails");
    if (!scopeGuardrailsGuide) {
      await this.createCms("documentation", {
        title: "Admin Scope Guardrails",
        slug: "admin-scope-guardrails",
        body: cmsAdminScopeGuardrailsBody,
        category: "System",
      });
    } else if (scopeGuardrailsGuide.body !== cmsAdminScopeGuardrailsBody) {
      await this.updateCms("documentation", scopeGuardrailsGuide.id, { body: cmsAdminScopeGuardrailsBody });
    }
    const designSystemGuide = docs.find((doc) => doc.slug === "design-system-operations-guide");
    if (!designSystemGuide) {
      await this.createCms("documentation", {
        title: "Design System Operations Guide",
        slug: "design-system-operations-guide",
        body: cmsDesignSystemGuideBody,
        category: "Design",
      });
    } else if (designSystemGuide.body !== cmsDesignSystemGuideBody) {
      await this.updateCms("documentation", designSystemGuide.id, { body: cmsDesignSystemGuideBody });
    }
    const hasCrmLeadWorkflowGuide = docs.some((doc) => doc.slug === "crm-lead-workflow-guide");
    if (!hasCrmLeadWorkflowGuide) {
      await this.createCms("documentation", {
        title: "CRM Lead Workflow Guide",
        slug: "crm-lead-workflow-guide",
        body: cmsCrmLeadWorkflowGuideBody,
        category: "CRM",
      });
    }
    const crmLeadWorkflowGuide = docs.find((doc) => doc.slug === "crm-lead-workflow-guide");
    if (
      crmLeadWorkflowGuide?.body === legacyCmsCrmLeadWorkflowGuideBody ||
      crmLeadWorkflowGuide?.body === previousCmsCrmLeadWorkflowGuideBody ||
      crmLeadWorkflowGuide?.body === previousCrmStageAgingGuideBody ||
      crmLeadWorkflowGuide?.body === previousCrmActionQueueGuideBody ||
      crmLeadWorkflowGuide?.body === previousFormSubmissionActionQueueGuideBody ||
      crmLeadWorkflowGuide?.body === previousCrmServiceFunnelGuideBody
    ) {
      await this.updateCms("documentation", crmLeadWorkflowGuide.id, { body: cmsCrmLeadWorkflowGuideBody });
    }
    const hasAdminAccessGuide = docs.some((doc) => doc.slug === "admin-access-guide");
    if (!hasAdminAccessGuide) {
      await this.createCms("documentation", {
        title: "Admin Access Guide",
        slug: "admin-access-guide",
        body: cmsAdminAccessGuideBody,
        category: "System",
      });
    }
    const adminAccessGuide = docs.find((doc) => doc.slug === "admin-access-guide");
    if (adminAccessGuide?.body.includes("Admin login is controlled by the ADMIN_PASSWORD") && !adminAccessGuide.body.includes("System Actions CSV")) {
      await this.updateCms("documentation", adminAccessGuide.id, { body: cmsAdminAccessGuideBody });
    }
    const backupRestoreGuide = docs.find((doc) => doc.slug === "system-backup-restore-guide");
    if (!backupRestoreGuide) {
      await this.createCms("documentation", {
        title: "System Backup Restore Guide",
        slug: "system-backup-restore-guide",
        body: cmsBackupRestoreGuideBody,
        category: "System",
      });
    } else if (backupRestoreGuide.body !== cmsBackupRestoreGuideBody) {
      await this.updateCms("documentation", backupRestoreGuide.id, { body: cmsBackupRestoreGuideBody });
    }
    const hasWidgetGuide = docs.some((doc) => doc.slug === "sidebar-widget-format-guide");
    if (!hasWidgetGuide) {
      await this.createCms("documentation", {
        title: "Sidebar Widget Format Guide",
        slug: "sidebar-widget-format-guide",
        body: cmsSidebarWidgetGuideBody,
        category: "Design",
      });
    }
    const widgetGuide = docs.find((doc) => doc.slug === "sidebar-widget-format-guide");
    if (
      widgetGuide?.body.includes("Sidebar widgets are JSON arrays.") &&
      (!widgetGuide.body.includes("Sidebar Actions CSV") || !widgetGuide.body.includes("recentPosts") || !widgetGuide.body.includes("/blog/slug") || !widgetGuide.body.includes("imageCard"))
    ) {
      await this.updateCms("documentation", widgetGuide.id, { body: cmsSidebarWidgetGuideBody });
    }
    const hasMigrationRunbook = docs.some((doc) => doc.slug === "cms-migration-runbook");
    if (!hasMigrationRunbook) {
      await this.createCms("documentation", {
        title: "CMS Migration Runbook",
        slug: "cms-migration-runbook",
        body: cmsMigrationRunbookBody,
        category: "Content",
      });
    }
    const migrationRunbook = docs.find((doc) => doc.slug === "cms-migration-runbook");
    const migrationRunbookBody = migrationRunbook?.body ?? "";
    if (
      migrationRunbook &&
      (migrationRunbookBody === legacyCmsMigrationRunbookBody ||
        (migrationRunbookBody.includes("Glass & Door Pro public routes are served by CMS Pages first") &&
          !migrationRunbookBody.includes("Route Actions CSV") ||
          !migrationRunbookBody.includes("Route Actions JSON")) ||
        (migrationRunbookBody.includes("Glass & Door Pro public routes are served by CMS Pages first") &&
          !migrationRunbookBody.includes("Menu Actions CSV")) ||
        (migrationRunbookBody.includes("Glass & Door Pro public routes are served by CMS Pages first") &&
          !migrationRunbookBody.includes("Launch CMS Routes")) ||
        (migrationRunbookBody.includes("Glass & Door Pro public routes are served by CMS Pages first") &&
          !migrationRunbookBody.includes("Custom Review migration filter")) ||
        (migrationRunbookBody.includes("Glass & Door Pro public routes are served by CMS Pages first") &&
          !migrationRunbookBody.includes("registered local assets")) ||
        !migrationRunbookBody.includes("published CMS route body while the original header") ||
        !migrationRunbookBody.includes("publicCmsEnabled off") ||
        !migrationRunbookBody.includes("cms-preview=1") ||
        !migrationRunbookBody.includes("publicCmsVisualParityApprovedAt") ||
        !migrationRunbookBody.includes("Launch clearance checklist") ||
        !migrationRunbookBody.includes("Visual CSV or JSON") ||
        !migrationRunbookBody.includes("disable publicCmsEnabled"))
    ) {
      await this.updateCms("documentation", migrationRunbook.id, { body: cmsMigrationRunbookBody });
    }

    const existingSections = await this.listCms("sections");
    const hasFreeQuoteCta = existingSections.some((section) => section.handle === "free-quote-cta");
    if (!hasFreeQuoteCta) {
      await this.createCms("sections", {
        name: "Free Quote CTA",
        handle: "free-quote-cta",
        category: "marketing",
        blocks: [
          {
            id: "quote-cta",
            type: "cta",
            props: {
              title: "Ready for a clearer view?",
              body: "Tell us about your shower, window, door, or commercial glass project.",
              href: "/contact",
              label: "Request a Quote",
            },
          },
        ],
        isReusable: true,
      });
    }
    const hasProjectFaq = existingSections.some((section) => section.handle === "project-faq");
    if (!hasProjectFaq) {
      await this.createCms("sections", {
        name: "Project FAQ",
        handle: "project-faq",
        category: "content",
        blocks: [
          {
            id: "project-faq",
            type: "faq",
            props: {
              eyebrow: "FAQ",
              title: "Glass & Door Project Questions",
              body: "A few quick answers customers often need before requesting an estimate.",
              items: [
                "Do you offer free estimates? | Yes. Share your project details and we will follow up with next steps.",
                "What areas do you serve? | Glass & Door Pro serves the greater Charlotte area.",
                "Can you help with custom shower glass? | Yes. We handle frameless shower glass, enclosures, and related installation needs.",
              ],
            },
          },
        ],
        isReusable: true,
      });
    }

    const systemUsers = await this.listCms("systemUsers");
    const hasOwnerUser = systemUsers.some((user) => user.email.toLowerCase() === "doug@glassanddoorpro.com");
    if (!hasOwnerUser) {
      await this.createCms("systemUsers", {
        name: "Glass & Door Pro Admin",
        email: "Doug@GlassandDoorPro.com",
        role: "owner",
        status: "active",
        lastLoginAt: null,
      });
    }

    const branding = (await this.listCms("branding"))[0];
    if (branding?.faviconUrl === "/favicon.ico") {
      await this.updateCms("branding", branding.id, { faviconUrl: "/favicon.png" });
    }
    if (branding?.address === "Charlotte, NC" || branding?.address === "Monroe, NC") {
      await this.updateCms("branding", branding.id, { address: "2341 Waverly Dr, Monroe, NC 28112" });
    }

    const forms = await this.listCms("forms");
    const quoteForm = forms.find((form) => form.slug === "website-quote-request");
    const serviceField = quoteForm?.fields.find((field) => field.name === "service");
    if (quoteForm && serviceField && !serviceField.options?.length) {
      await this.updateCms("forms", quoteForm.id, {
        fields: quoteForm.fields.map((field) =>
          field.name === "service"
            ? {
                ...field,
                options: ["Frameless Shower Door", "Window Replacement", "Door Installation", "Other / Repair"],
              }
            : field,
        ),
      });
    }

    const pagesForAssetRepair = await this.listCms("pages");
    for (const page of pagesForAssetRepair) {
      const nextContent = replaceLegacyCmsAssetPaths(page.content);
      if (JSON.stringify(nextContent) !== JSON.stringify(page.content)) {
        await this.updateCms("pages", page.id, { content: nextContent });
      }
    }

    const sectionsForAssetRepair = await this.listCms("sections");
    for (const section of sectionsForAssetRepair) {
      const nextBlocks = replaceLegacyCmsAssetPaths(section.blocks);
      if (JSON.stringify(nextBlocks) !== JSON.stringify(section.blocks)) {
        await this.updateCms("sections", section.id, { blocks: nextBlocks });
      }
    }

    const settings = await this.listCms("settings");
    const siteSetting = settings.find((setting) => setting.key === "site");
    if (siteSetting) {
      const currentStages = siteSetting.value.leadPipelineStages;
      const nextSiteValue = {
        businessName: typeof siteSetting.value.businessName === "string" ? siteSetting.value.businessName : "Glass & Door Pro",
        siteUrl: typeof siteSetting.value.siteUrl === "string" ? siteSetting.value.siteUrl : "https://glassanddoorpro.com",
        market: typeof siteSetting.value.market === "string" ? siteSetting.value.market : "Greater Charlotte area",
        businessHours: typeof siteSetting.value.businessHours === "string" ? siteSetting.value.businessHours : "Mon-Sat: 7am - 6pm",
        publicCmsEnabled: typeof siteSetting.value.publicCmsEnabled === "boolean" ? siteSetting.value.publicCmsEnabled : false,
        leadPipelineStages: Array.isArray(currentStages) ? currentStages : ["new", "contacted", "estimate", "won", "lost"],
      };
      const needsSiteBackfill =
        !siteSetting.value.businessName ||
        !siteSetting.value.siteUrl ||
        !siteSetting.value.market ||
        !siteSetting.value.businessHours ||
        typeof siteSetting.value.publicCmsEnabled !== "boolean" ||
        !Array.isArray(siteSetting.value.leadPipelineStages) ||
        "publicCmsPagesEnabled" in siteSetting.value;
      if (needsSiteBackfill) {
        await this.updateCms("settings", siteSetting.id, {
          value: nextSiteValue,
          group: siteSetting.group || "general",
          isPublic: true,
        });
      }
    } else {
      await this.createCms("settings", {
        key: "site",
        value: {
          businessName: "Glass & Door Pro",
          siteUrl: "https://glassanddoorpro.com",
          market: "Greater Charlotte area",
          businessHours: "Mon-Sat: 7am - 6pm",
          publicCmsEnabled: false,
          leadPipelineStages: ["new", "contacted", "estimate", "won", "lost"],
        },
        group: "general",
        isPublic: true,
      });
    }
  }
}

const dbStorage = db ? new DbStorage(db) : null;

export const storage: IStorage = dbStorage ?? new MemStorage();

export async function seedStorageDefaults() {
  if (hasDatabase && dbStorage) {
    await dbStorage.seedDefaults();
  }
}
