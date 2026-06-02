import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function assertIncludes(body, expected, label) {
  if (!body.includes(expected)) {
    throw new Error(`${label} is missing: ${expected}`);
  }
}

function assertNotIncludes(body, unexpected, label) {
  if (body.includes(unexpected)) {
    throw new Error(`${label} should not include: ${unexpected}`);
  }
}

function assertMatches(body, pattern, label) {
  if (!pattern.test(body)) {
    throw new Error(`${label} failed: ${pattern}`);
  }
}

function assertRouteHasHeader(source, route, expected, label) {
  const routeStarts = ["get", "post", "put", "patch", "delete"]
    .map((method) => source.indexOf(`app.${method}("${route}",`))
    .filter((value) => value !== -1);

  const routeStart = routeStarts.length > 0 ? Math.min(...routeStarts) : -1;
  if (routeStart === -1) {
    throw new Error(`Route not found for header check: ${route}`);
  }

  const routeEnd = source.indexOf("\n  app.", routeStart + 1);
  const routeBlock = source.slice(routeStart, routeEnd === -1 ? routeStart + 2500 : routeEnd);
  assertIncludes(routeBlock, expected, label);
}

function assertMethodRouteHasHeader(source, method, route, expected, label) {
  const marker = `app.${method}("${route}",`;
  const routeStart = source.indexOf(marker);
  if (routeStart === -1) {
    throw new Error(`Route not found for ${method.toUpperCase()} header check: ${route}`);
  }

  const routeEnd = source.indexOf("\n  app.", routeStart + 1);
  const routeBlock = source.slice(routeStart, routeEnd === -1 ? routeStart + 2500 : routeEnd);
  assertIncludes(routeBlock, expected, label);
}

function inferExpectedAdminContentType(route) {
  if (route.endsWith(".csv")) {
    return "text/csv; charset=utf-8";
  }
  if (route.endsWith(".md")) {
    return "text/markdown; charset=utf-8";
  }
  if (route.includes(".json")) {
    return "application/json; charset=utf-8";
  }
  return "application/json; charset=utf-8";
}

function assertAdminApiRoutesHaveContentTypeHeaders(source) {
  const routeStartPattern = /app\.(get|post|patch|delete|put)\("([^"]+)",\s*(?:async|\()/g;
  const matches = [...source.matchAll(routeStartPattern)];
  for (const match of matches) {
    const method = match[1].toUpperCase();
    const route = match[2];
    if (!route.startsWith("/api/admin/")) {
      continue;
    }
    const routeStart = match.index;
    const routeEnd = source.indexOf("\n  app.", routeStart + 1);
    const routeBlock = source.slice(routeStart, routeEnd === -1 ? routeStart + 2500 : routeEnd);
    const expected = inferExpectedAdminContentType(route);
    assertIncludes(
      routeBlock,
      `res.setHeader("Content-Type", "${expected}");`,
      `admin API ${method} ${route} uses expected content-type ${expected}`,
    );
  }
}

function extractPrimaryRouteSlugs(source) {
  const declaration = source.match(/const primaryCmsRouteSlugs\s*=\s*\[\s*([\s\S]*?)\]\s*(?:as const)?\s*;/);
  if (!declaration) return [];

  const listBody = declaration[1];
  const valuePattern = /["'`]([^"'`]+)["'`]/g;
  const values = [];
  let valueMatch;

  while ((valueMatch = valuePattern.exec(listBody)) !== null) {
    values.push(valueMatch[1]);
  }

  return values;
}

function extractObjectKeys(source, objectName) {
  const objectStart = source.indexOf(`const ${objectName}`);
  if (objectStart === -1) return [];

  const bodyStart = source.indexOf("{", objectStart);
  if (bodyStart === -1) return [];

  let bodyEnd = source.indexOf("\ntype", bodyStart);
  if (bodyEnd === -1) {
    bodyEnd = source.indexOf("};", bodyStart);
    if (bodyEnd === -1) {
      bodyEnd = source.length;
    } else {
      bodyEnd += 2;
    }
  }

  const objectBody = source.slice(bodyStart, bodyEnd);
  const keyPattern = /^\s{2}["'`]([^"'`]+)["'`]\s*:/gm;
  const keys = [];
  let keyMatch;

  while ((keyMatch = keyPattern.exec(objectBody)) !== null) {
    keys.push(keyMatch[1]);
  }

  return keys;
}

function extractSetWithObjectKeys(source, setName, spreadSourceName) {
  const declaration = source.match(new RegExp(`const ${setName} = new Set\\(\\[([\\s\\S]*?)\\]\\);`));
  if (!declaration) return [];

  const setBody = declaration[1];
  const values = new Set(extractQuotedValues(setBody));

  if (setBody.includes(`...Object.keys(${spreadSourceName})`)) {
    for (const slug of extractObjectKeys(source, spreadSourceName)) {
      values.add(slug);
    }
  }

  return Array.from(values);
}

function extractQuotedValues(source) {
  const valuePattern = /["'`]([^"'`]+)["'`]/g;
  const values = [];
  let valueMatch;

  while ((valueMatch = valuePattern.exec(source)) !== null) {
    values.push(valueMatch[1]);
  }

  return values;
}

function extractAdminApiRouteLinks(source) {
  const hrefPattern = /href=(?:"([^"]+)"|'([^']+)'|{`([^`]+)`})/g;
  const hrefSet = new Set();

  let hrefMatch;
  while ((hrefMatch = hrefPattern.exec(source)) !== null) {
    const rawRoute = hrefMatch[1] || hrefMatch[2] || hrefMatch[3];
    if (!rawRoute || !rawRoute.includes("/api/admin/")) continue;
    hrefSet.add(rawRoute);
  }

  return [...hrefSet];
}

function normalizeAdminApiRoute(route) {
  return route.replace(/\$\{[^}]+\}/g, ":id");
}

function extractAdminApiRouteDefinitions(source) {
  const routeStartPattern = /app\.(get|post|patch|delete|put)\("([^"]+)",\s*(?:async|\()/g;
  const routes = new Set();
  for (const match of source.matchAll(routeStartPattern)) {
    const route = match[2];
    if (route.startsWith("/api/admin/")) {
      routes.add(route);
    }
  }

  return routes;
}

function assertAdminHrefRoutesExist(adminSource, routeSource) {
  const adminLinkRoutes = extractAdminApiRouteLinks(adminSource)
    .map((route) => normalizeAdminApiRoute(route))
    .filter((route) => route.startsWith("/api/admin/"));
  const serverRoutes = extractAdminApiRouteDefinitions(routeSource);
  const missingRoutes = adminLinkRoutes.filter((route) => !serverRoutes.has(route));

  if (missingRoutes.length > 0) {
    throw new Error(`Admin UI links to missing admin API routes: ${missingRoutes.join(", ")}`);
  }
}

const [
  app,
  layout,
  home,
  gallery,
  form,
  publicSite,
  publicIdentity,
  storage,
  admin,
  routes,
  indexHtml,
  adminScope,
] = await Promise.all([
  source("client/src/App.tsx"),
  source("client/src/components/layout.tsx"),
  source("client/src/pages/home.tsx"),
  source("client/src/pages/gallery.tsx"),
  source("client/src/components/cms-lead-form.tsx"),
  source("client/src/hooks/use-public-site.ts"),
  source("server/public-identity.ts"),
  source("server/storage.ts"),
  source("client/src/pages/admin.tsx"),
  source("server/routes.ts"),
  source("client/index.html"),
  source("script/check-admin-scope.mjs"),
]);
const cmsPageRoute = await source("client/src/components/cms-page-route.tsx");
const serverPrimaryRouteSlugs = extractPrimaryRouteSlugs(routes);
const adminPrimaryRouteSlugs = extractPrimaryRouteSlugs(admin);
const adminStarterRouteSlugs = extractSetWithObjectKeys(admin, "starterRouteSlugs", "serviceStarterContent");

if (serverPrimaryRouteSlugs.length === 0 || adminPrimaryRouteSlugs.length === 0) {
  throw new Error("Unable to parse primaryCmsRouteSlugs from both server and admin route configs.");
}

const serverSlugSet = new Set(serverPrimaryRouteSlugs);
const adminSlugSet = new Set(adminPrimaryRouteSlugs);

const adminMissingFromServer = adminPrimaryRouteSlugs.filter((slug) => !serverSlugSet.has(slug));
const serverMissingFromAdmin = serverPrimaryRouteSlugs.filter((slug) => !adminSlugSet.has(slug));

if (adminMissingFromServer.length > 0 || serverMissingFromAdmin.length > 0) {
  throw new Error(
    `Primary route slug lists drift detected. admin-only: ${adminMissingFromServer.join(", ") || "none"}, server-only: ${serverMissingFromAdmin.join(", ") || "none"}`,
  );
}

const adminStarterSet = new Set(adminStarterRouteSlugs);
const starterMissingFromServer = adminStarterRouteSlugs.filter((slug) => !serverSlugSet.has(slug));
const serverMissingFromStarter = [...serverSlugSet].filter((slug) => !adminStarterSet.has(slug));

if (starterMissingFromServer.length > 0 || serverMissingFromStarter.length > 0) {
  throw new Error(
    `Starter route slug list drift detected. admin-only: ${starterMissingFromServer.join(", ") || "none"}, server-only: ${serverMissingFromStarter.join(", ") || "none"}`,
  );
}

const protectedRouteSlugs = [
  "home",
  "about",
  "contact",
  "services",
  "services/frameless-showers",
  "services/window-installation",
  "services/door-installation",
  "services/window-repair",
  "services/commercial-glass",
  "services/showers",
  "services/windows",
  "services/doors",
  "gallery",
];

for (const slug of protectedRouteSlugs) {
  assertMatches(
    app,
    new RegExp(`slug="${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?preserveFallbackUntilCmsEnabled`),
    `Public route ${slug} must preserve the original fallback until CMS takeover is enabled`,
  );
}

const fallbackHeaderBlock = layout.slice(
  layout.indexOf("const fallbackHeaderItems"),
  layout.indexOf("const fallbackFooterItems"),
);
assertIncludes(fallbackHeaderBlock, 'label: "Home"', "fallback header");
assertIncludes(fallbackHeaderBlock, 'label: "About"', "fallback header");
assertIncludes(fallbackHeaderBlock, 'label: "Services"', "fallback header");
assertIncludes(fallbackHeaderBlock, 'href: "#", label: "Services"', "fallback header");
assertIncludes(fallbackHeaderBlock, 'label: "Gallery"', "fallback header");
assertIncludes(fallbackHeaderBlock, 'label: "Reviews"', "fallback header");
assertIncludes(fallbackHeaderBlock, 'label: "Contact"', "fallback header");
assertNotIncludes(fallbackHeaderBlock, 'label: "Blog"', "fallback header");

assertIncludes(indexHtml, '<link rel="icon" type="image/png" href="/favicon.png" />', "document favicon");
assertIncludes(indexHtml, '<link rel="apple-touch-icon" href="/favicon.png" />', "document favicon");
assertIncludes(layout, 'import logo from "@/assets/images/logo.png";', "original public logo import");
assertIncludes(layout, 'const isPublicCmsEnabled = publicCmsEnabled(siteData.settings);', "public layout CMS gate");
assertIncludes(layout, "const branding = isPublicCmsEnabled ? siteData.branding : null;", "public layout CMS branding gate");
assertIncludes(layout, 'const headerMenu = isPublicCmsEnabled ? siteData.menus.find((menu) => menu.location === "header") : null;', "public layout CMS menu gate");
assertIncludes(layout, 'const footerMenu = isPublicCmsEnabled ? siteData.menus.find((menu) => menu.location === "footer") : null;', "public layout CMS menu gate");
assertIncludes(layout, "const paletteTokens = isPublicCmsEnabled ? siteData.colorPalette?.tokens : undefined;", "public layout CMS theme gate");
assertIncludes(layout, "const typography = isPublicCmsEnabled ? siteData.typography : null;", "public layout CMS theme gate");
assertIncludes(layout, "safeCmsAssetUrl(branding?.logoUrl) || logo", "public layout original logo fallback");
assertIncludes(layout, 'safeCmsAssetUrl(branding?.faviconUrl) || "/favicon.png"', "public layout original favicon fallback");

assertIncludes(home, "We've got your glass & door<br />needs covered.", "home hero headline");
assertIncludes(home, "Specializing in frameless glass showers, windows, and doors", "home hero copy");
assertIncludes(home, "Hi there! My name is Doug.", "home about heading");
assertIncludes(home, "Welcome to my glass and door installation business, proudly serving the greater Charlotte, North Carolina area.", "home about copy");
assertIncludes(home, "What We Offer", "home services heading");
assertIncludes(home, "Let us know how we can help!", "home contact heading");
assertIncludes(home, "Charlotte & Surrounding Areas", "home service locations");
assertIncludes(gallery, "Explore our work by category.", "gallery fallback copy");
assertIncludes(gallery, 'subtitle: "Coming Soon"', "gallery fallback pending categories");
assertNotIncludes(gallery, "/api/cms/public/media", "gallery fallback");
assertNotIncludes(gallery, "CMS-curated project photos", "gallery fallback");
assertNotIncludes(gallery, "CMS curated media", "gallery fallback");
assertNotIncludes(gallery, "Commercial Interior Glass", "gallery fallback");

assertIncludes(form, 'label: "Your Name"', "fallback lead form");
assertIncludes(form, 'label: "Email Address"', "fallback lead form");
assertIncludes(form, 'label: "Phone Number"', "fallback lead form");
assertIncludes(form, 'label: "Your Message"', "fallback lead form");
assertNotIncludes(form.slice(form.indexOf("const fallbackFields"), form.indexOf("const supportedLeadFieldTypes")), 'name: "service"', "fallback lead form");

assertIncludes(publicSite, 'const DEFAULT_MARKET = "Charlotte, NC";', "client public identity fallback");
assertIncludes(publicSite, 'address: "2341 Waverly Dr, Monroe, NC 28112"', "client public identity fallback");
assertIncludes(publicSite, "publicCmsPreviewRequested", "public CMS preview helper");
assertIncludes(publicSite, 'normalizedParam === "1" || normalizedParam === "true"', "public CMS preview helper");
assertIncludes(publicSite, 'return normalizedParam === "1" || normalizedParam === "true";', "public CMS preview helper");
assertNotIncludes(publicSite, "sessionStorage", "public CMS preview helper");
assertNotIncludes(publicSite, "sticky", "public CMS preview helper");
assertIncludes(publicSite, "isPublicCmsPreview", "public CMS preview state");
assertIncludes(publicSite, "isPublicCmsEnabled", "public CMS takeover state");

assertIncludes(publicIdentity, 'market: "Charlotte, NC"', "server public identity fallback");
assertIncludes(publicIdentity, 'address: "2341 Waverly Dr, Monroe, NC 28112"', "server public identity fallback");
assertIncludes(storage, 'address: "2341 Waverly Dr, Monroe, NC 28112"', "seeded CMS branding fallback");
assertNotIncludes(
  storage.slice(storage.indexOf("const branding = withDates"), storage.indexOf("const palette = withDates")),
  'address: "Charlotte, NC"',
  "seeded CMS branding fallback",
);

const adminBrandDefaultsStart = admin.indexOf("const applyGlassDoorDefaults");
const adminBrandDefaults = admin.slice(adminBrandDefaultsStart, admin.indexOf("if (isLoading)", adminBrandDefaultsStart));
assertIncludes(adminBrandDefaults, 'logoUrl: "/logo.png"', "admin brand defaults");
assertIncludes(adminBrandDefaults, 'faviconUrl: "/favicon.png"', "admin brand defaults");
assertIncludes(adminBrandDefaults, 'address: "2341 Waverly Dr, Monroe, NC 28112"', "admin brand defaults");
assertNotIncludes(adminBrandDefaults, 'address: "Charlotte, NC"', "admin brand defaults");
assertIncludes(admin, 'const defaultSiteBusinessHours = "Mon-Sat: 7am - 6pm";', "admin site defaults");
assertNotIncludes(admin, "Monday-Friday, 8 AM-5 PM", "admin site defaults");

const serverStarterStart = storage.indexOf("function starterSectionsForSlug");
const serverHomeStart = storage.indexOf('if (slug === "home")', serverStarterStart);
const serverHomeStarter = storage.slice(serverHomeStart, storage.indexOf('if (slug === "services")', serverHomeStart));
const adminStarterStart = admin.indexOf("function rawStarterSectionsForSlug");
const adminHomeStart = admin.indexOf('if (slug === "home")', adminStarterStart);
const adminHomeStarter = admin.slice(adminHomeStart, admin.indexOf('if (slug === "services")', adminHomeStart));
const serverHeaderMenuStart = storage.indexOf("const defaultHeaderMenuItems");
const serverHeaderMenu = storage.slice(serverHeaderMenuStart, storage.indexOf("const defaultFooterMenuItems", serverHeaderMenuStart));
const adminHeaderMenuStart = admin.indexOf("const starterHeaderMenuItems");
const adminHeaderMenu = admin.slice(adminHeaderMenuStart, admin.indexOf("const starterFooterMenuItems", adminHeaderMenuStart));

for (const [label, sourceText] of [
  ["server default header menu", serverHeaderMenu],
  ["admin starter header menu", adminHeaderMenu],
]) {
  assertIncludes(sourceText, 'label: "Home"', label);
  assertIncludes(sourceText, 'label: "Services"', label);
  assertIncludes(sourceText, 'label: "Gallery"', label);
  assertIncludes(sourceText, 'label: "Reviews"', label);
  assertIncludes(sourceText, 'label: "Contact"', label);
  assertNotIncludes(sourceText, 'label: "Blog"', label);
  assertNotIncludes(sourceText, 'href: "/blog"', label);
}

for (const [label, sourceText] of [
  ["server CMS starter homepage", serverHomeStarter],
  ["admin CMS starter homepage", adminHomeStarter],
]) {
  assertIncludes(sourceText, 'title: "Hi there! My name is Doug."', label);
  assertIncludes(sourceText, "body: homeHeroBody", label);
  assertIncludes(sourceText, 'title: "What We Offer"', label);
  assertIncludes(sourceText, "homeDoorServiceCopy", label);
  assertIncludes(sourceText, 'title: "Get the job done right"', label);
  assertIncludes(sourceText, 'badgeValue: "15+"', label);
  assertIncludes(sourceText, 'badgeLabel: "Years Experience"', label);
  assertIncludes(sourceText, 'title: "Recent Glass & Door Projects"', label);
  assertIncludes(sourceText, 'title: "Let us know how we can help!"', label);
  assertIncludes(sourceText, 'imagePosition: "left"', label);
  assertNotIncludes(sourceText, 'posterUrl: "/cms-assets/images/gallery-shower1-1280w.jpg"', label);
  assertNotIncludes(sourceText, 'handle: "free-quote-cta"', label);
  assertNotIncludes(sourceText, 'title: "Glass and door services"', label);
}

const serverServiceStarterStart = storage.indexOf("const serviceStarterContent");
const serverServiceStarter = storage.slice(serverServiceStarterStart, storage.indexOf("function starterSectionId", serverServiceStarterStart));
const adminServiceStarterStart = admin.indexOf("const serviceStarterContent");
const adminServiceStarter = admin.slice(adminServiceStarterStart, admin.indexOf("const starterRouteSlugs", adminServiceStarterStart));
for (const [label, sourceText] of [
  ["server CMS service starters", serverServiceStarter],
  ["admin CMS service starters", adminServiceStarter],
]) {
  assertIncludes(sourceText, 'title: "Frameless Glass Shower Doors"', label);
  assertIncludes(sourceText, 'title: "Residential Window Installation"', label);
  assertIncludes(sourceText, 'title: "Door Installation Services"', label);
  assertIncludes(sourceText, 'title: "Window Repair Services"', label);
  assertIncludes(sourceText, 'title: "Commercial Glass Services"', label);
  assertNotIncludes(sourceText, "Custom frameless shower glass for a cleaner bathroom finish", label);
  assertNotIncludes(sourceText, "Commercial glass service for storefronts and business spaces", label);
}

for (const [label, sourceText] of [
  ["server CMS primary route starters", storage],
  ["admin CMS primary route starters", admin],
]) {
  assertIncludes(sourceText, 'title: "Residential and commercial glass, window, and door work."', label);
  assertIncludes(sourceText, 'title: "Our Core Values"', label);
  assertIncludes(sourceText, 'title: "Contact Us"', label);
  assertIncludes(sourceText, 'title: "Gallery"', label);
  assertIncludes(sourceText, 'variant: "categoryCards"', label);
}

assertIncludes(app, "function PublicCmsRoute", "public CMS route gate");
assertIncludes(app, "function PublicCmsPreviewBanner", "public CMS preview banner");
assertIncludes(app, "CMS Preview Mode", "public CMS preview banner");
assertIncludes(app, "normal public URLs still use the original site", "public CMS preview banner");
assertIncludes(app, "const exitPreviewHref", "public CMS preview exit");
assertIncludes(app, 'url.searchParams.set("cms-preview", "0")', "public CMS preview exit");
assertIncludes(app, "href={exitPreviewHref}", "public CMS preview exit");
assertIncludes(app, "!siteData.isPublicCmsPreview && !publicCmsEnabled(siteData.settings)", "public CMS preview route gate");
assertNotIncludes(app, "const ServicesOverview", "public /services fallback");
assertIncludes(publicSite, "const isPublicCmsEnabled = publicCmsEnabled(rawSettings)", "public CMS preview keeps original chrome");
assertNotIncludes(publicSite, "publicCmsEnabled(rawSettings) || isPublicCmsPreview", "public CMS preview keeps original chrome");
assertNotIncludes(publicSite, "settingsWithPublicCmsPreview", "public CMS preview keeps original chrome");
assertIncludes(cmsPageRoute, "const primaryCmsPageSlugs", "primary CMS page sidebar guard");
assertIncludes(cmsPageRoute, 'primaryCmsPageSlugs.has(page.slug) ? [] : ["page", "default"]', "primary CMS page sidebar guard");
assertIncludes(cmsPageRoute, "preserveFallbackUntilCmsEnabled && !siteData.isPublicCmsPreview && !publicCmsEnabled(siteData.settings)", "public CMS preview keeps original fallback chrome");
assertIncludes(cmsPageRoute, "enabled: !shouldPreserveFallback", "public CMS fallback query guard");
assertIncludes(cmsPageRoute, 'text(props.imagePosition) ?? "right"', "home CMS split content image position");
assertIncludes(cmsPageRoute, 'imagePosition === "left"', "home CMS split content image position");
assertIncludes(cmsPageRoute, 'fieldPreset="originalHome"', "home CMS lead form preserves original fields");
assertNotIncludes(cmsPageRoute.slice(cmsPageRoute.indexOf('layout === "homecontact"'), cmsPageRoute.indexOf('layout === "contactpage"')), "form?.description", "home CMS lead form helper copy");
assertIncludes(form, 'fieldPreset === "originalHome"', "home CMS lead form preserves original fields");
assertIncludes(form, "return fallbackFields", "home CMS lead form preserves original fields");
assertIncludes(cmsPageRoute, "badgeValue", "home CMS why-us image badge");
assertIncludes(cmsPageRoute, "badgeLabel", "home CMS why-us image badge");
assertIncludes(cmsPageRoute, "function cmsResponsiveImageSources", "home CMS gallery responsive images");
assertIncludes(cmsPageRoute, 'const loading = index < 4 ? "eager" : "lazy"', "home CMS gallery first-paint images");
assertIncludes(cmsPageRoute, "function CmsResponsiveImage", "CMS gallery responsive images");
assertIncludes(cmsPageRoute, "serviceImageSizes", "service CMS gallery responsive images");
assertIncludes(cmsPageRoute, 'sizes="100vw"', "home CMS image band responsive images");
assertIncludes(cmsPageRoute, 'sizes="(max-width: 1024px) 100vw, 50vw"', "CMS split content responsive images");
assertIncludes(cmsPageRoute, 'sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"', "CMS gallery card responsive images");
assertIncludes(cmsPageRoute, 'sizes="(max-width: 768px) 100vw, 33vw"', "CMS recent post responsive images");
assertIncludes(cmsPageRoute, "const activeCategoryId = activeGalleryCategoryId", "CMS gallery starts on category cards");
assertMatches(cmsPageRoute, /const activeItems = activeCategoryId\s*\?\s*items\.filter[\s\S]*?: \[\];/, "CMS gallery starts on category cards");
assertIncludes(cmsPageRoute, "function CmsVideoHeroBlock", "home CMS video hero parity");
assertIncludes(cmsPageRoute, "onLoadedData={() => setVideoLoaded(true)}", "home CMS video hero load transition");
assertIncludes(cmsPageRoute, "bg-slate-900/50", "home CMS video hero overlay parity");
assertMatches(
  cmsPageRoute,
  /if \(shouldPreserveFallback\) \{\s*return <>\{fallback\}<\/>;\s*\}/,
  "Public fallback routes must render hard-coded pages without CMS metadata until preview/takeover",
);
assertIncludes(storage, "Default page sidebars apply to custom CMS pages", "sidebar docs");
assertIncludes(admin, "Default page sidebars apply to custom CMS pages", "sidebar docs");
assertIncludes(storage, "footerSidebarUsesStarterWidgets", "starter footer widget guard");
assertIncludes(storage, "isActive: false", "starter footer widget guard");
assertIncludes(routes, "const starterReusableSectionHandles", "starter reusable section library guard");
assertIncludes(routes, "starterLibraryReady", "starter reusable section library guard");
assertIncludes(routes, "pageReferences + sectionReferences === 0 && !starterLibraryReady", "starter reusable section library guard");
assertIncludes(routes, 'priorityLabel: "starter-library"', "starter reusable section library guard");
assertMatches(routes, /const publicSidebars = sidebars[\s\S]*?\.filter\(\(sidebar\) => sidebar\.isActive\)/, "public sidebars must require active status");
assertMatches(app, /<Route path="\/blog">[\s\S]*?<PublicCmsRoute fallback={<NotFound \/>}>[\s\S]*?<CmsBlogIndex \/>/, "Blog index must stay gated until CMS takeover or preview");
assertMatches(app, /<Route path="\/blog\/:slug">[\s\S]*?<PublicCmsRoute fallback={<NotFound \/>}>[\s\S]*?<CmsBlogRoute/, "Blog post routes must stay gated until CMS takeover or preview");
assertMatches(
  app,
  /<Route path="\/services">[\s\S]*?slug="services" fallback={<NotFound \/>}[\s\S]*?preserveFallbackUntilCmsEnabled/,
  "Top-level services route must preserve the original 404 fallback until CMS takeover or preview",
);
assertMatches(
  app,
  /<Route path="\/services\/\*">[\s\S]*?preserveFallbackUntilCmsEnabled/,
  "Dynamic service CMS routes must stay gated until CMS takeover or preview",
);
assertMatches(
  app,
  /<Route path="\/page\/\*">[\s\S]*?preserveFallbackUntilCmsEnabled/,
  "Legacy CMS page routes must stay gated until CMS takeover or preview",
);
assertMatches(
  app,
  /<Route path="\/\*">[\s\S]*?preserveFallbackUntilCmsEnabled/,
  "Catchall CMS routes must stay gated until CMS takeover or preview",
);
assertIncludes(routes, "const hardCodedPublicRouteSlugs", "public sitemap fallback routes");
assertIncludes(routes, 'slug !== "services" && slug !== "blog"', "public sitemap fallback routes");
assertIncludes(routes, "function publicCmsTakeoverEnabled", "public sitemap CMS takeover guard");
assertIncludes(routes, "function publicCmsTakeoverValueRequested", "public sitemap CMS takeover guard");
assertIncludes(routes, "function publicCmsTakeoverLaunchConfirmed", "public CMS fresh launch approval guard");
assertIncludes(routes, "publicCmsLaunchConfirmedAt", "public CMS fresh launch approval guard");
assertIncludes(routes, "function publicCmsVisualParityApproved", "public CMS visual parity approval guard");
assertIncludes(routes, "publicCmsVisualParityApprovedAt", "public CMS visual parity approval guard");
assertIncludes(routes, "publicCmsVisualParityRouteReviews", "public CMS route-level visual parity guard");
assertIncludes(routes, "publicCmsVisualParityRouteStatuses", "public CMS route-level visual parity status guard");
assertIncludes(routes, "publicCmsVisualParityRouteChecklistComplete", "public CMS route-level visual parity guard");
assertIncludes(routes, 'review.status === "approved"', "public CMS route-level visual parity approval guard");
assertIncludes(routes, "visualParityApprovedRoutes", "public frontend approved route reporting");
assertIncludes(routes, "visualParityNeedsChangesRoutes", "public frontend changes-needed route reporting");
assertIncludes(routes, "reviewStatus", "public frontend route review status reporting");
assertIncludes(routes, "reviewNotes", "public frontend route review note reporting");
assertIncludes(routes, "publicUrl: absolutePublicRouteUrl(siteUrl, route.path)", "public frontend customer URL reporting");
assertIncludes(routes, "status must be approved or changes-needed", "public CMS route review status validation");
assertIncludes(routes, "async function effectivePublicCmsTakeoverEnabled", "public sitemap CMS takeover guard");
assertIncludes(routes, "includeCmsRoutes: await effectivePublicCmsTakeoverEnabled(settings)", "sitemap CMS takeover guard");
assertIncludes(routes, "postIsPublicSitemapCandidate(post, { includeCmsRoutes })", "RSS CMS takeover guard");
assertIncludes(routes, "includeCmsRoutes: publicCmsTakeoverIsEnabled", "system public route CMS takeover guard");
assertIncludes(routes, "function getPublicCmsTakeoverBlockers", "public CMS takeover launch guard");
assertIncludes(routes, "settingValueEnablesPublicCms", "public CMS takeover launch guard");
assertIncludes(routes, "Public CMS takeover is blocked until visual parity is approved and all primary routes are migration-ready.", "public CMS takeover launch guard");
assertIncludes(routes, 'toolKey: blocker.slug === "visual-parity" ? "settings" : "pages"', "public CMS visual parity action target");
assertIncludes(routes, "visualParitySettingId", "public CMS visual parity action target");
assertIncludes(routes, "sanitizePublicSetting(setting, { publicCmsEnabled })", "public CMS stale setting guard");
assertIncludes(routes, "collectLocalCmsAssetUrls", "referenced CMS asset import guard");
assertIncludes(routes, "importPublicAssetMediaRecords({ referencedOnly: true })", "referenced CMS asset import guard");
assertIncludes(routes, "/api/admin/cms/media/import-referenced-assets", "referenced CMS asset import guard");
assertIncludes(routes, "launchBlockerCount", "system public CMS launch blockers");
assertIncludes(routes, "cmsTakeoverConfirmed: publicCmsTakeoverConfirmed", "system public CMS launch approval status");
assertIncludes(routes, "launchBlockers: publicCmsLaunchBlockers.slice(0, 8)", "system public CMS launch blockers");
assertIncludes(routes, "function createVisualParityReviewReport", "visual parity route comparison export");
assertIncludes(routes, "/api/admin/system/visual-parity", "visual parity route comparison export");
assertIncludes(routes, "/api/admin/system/visual-parity.csv", "visual parity route comparison export");
assertIncludes(routes, "visualParityReviewed", "visual parity route review export status");
assertIncludes(routes, "visualParityApproved", "visual parity route review export status");
assertIncludes(routes, "visualParityNeedsChanges", "visual parity route review export status");
assertIncludes(routes, 'review?.status ?? "unreviewed"', "visual parity route review export status");
assertIncludes(routes, "normalizePublicCmsVisualParityRouteReviews(siteSettingValue.publicCmsVisualParityRouteReviews)", "visual parity export checklist source");
assertIncludes(routes, "function createMigrationCoverageReport", "migration coverage report builder");
assertIncludes(routes, "/api/admin/system/migration", "migration coverage report endpoint");
assertIncludes(routes, "/api/admin/system/migration.csv", "migration coverage csv endpoint");
assertIncludes(routes, "/api/admin/system/migration-actions", "migration action queue json endpoint");
assertIncludes(routes, "/api/admin/system/migration-actions.csv", "migration action queue csv endpoint");
assertIncludes(routes, "migrationCoverageCsv(report)", "migration coverage csv serializer");
assertIncludes(routes, "migrationActionQueueCsv(report)", "migration action queue csv serializer");
assertIncludes(routes, "/api/admin/system/media-actions", "media action queue json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/media-actions",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "media action json endpoint includes JSON content type header",
);
assertRouteHasHeader(
  routes,
  "/api/admin/system/media-actions.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "media action csv endpoint includes CSV content type header",
);
assertRouteHasHeader(
  routes,
  "/api/admin/system/migration",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "migration json endpoint includes JSON content type header",
);
assertRouteHasHeader(
  routes,
  "/api/admin/system/migration.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "migration csv endpoint includes CSV content type header",
);
assertRouteHasHeader(
  routes,
  "/api/admin/system/migration-actions",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "migration action queue json endpoint includes JSON content type header",
);
assertRouteHasHeader(
  routes,
  "/api/admin/system/migration-actions.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "migration action queue csv endpoint includes CSV content type header",
);
assertIncludes(routes, "const migration = createMigrationCoverageReport({", "migration system report creation");
assertIncludes(routes, "migration: migration.totals", "migration system snapshot wiring");
assertIncludes(routes, "migrationActionQueue: migration.actionQueue.slice(0, 8)", "migration action queue snapshot wiring");
assertIncludes(routes, "/api/admin/system/status", "admin system status endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/status",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system status json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/action-plan", "admin action plan json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/action-plan",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system action plan json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/action-plan.csv", "admin action plan csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/action-plan.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system action plan csv endpoint includes CSV content type header",
);
assertIncludes(routes, "/api/admin/system/readiness", "admin readiness json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/readiness",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system readiness json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/readiness.csv", "admin readiness csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/readiness.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system readiness csv endpoint includes CSV content type header",
);
assertIncludes(routes, "/api/admin/system/media-audit", "admin media audit json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/media-audit",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system media-audit json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/media-audit.csv", "admin media audit csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/media-audit.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system media-audit csv endpoint includes CSV content type header",
);
assertIncludes(routes, "/api/admin/system/export", "admin system export endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/export",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system export json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/documentation-runbook.md", "admin system documentation runbook endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/documentation-runbook.md",
  'res.setHeader("Content-Type", "text/markdown; charset=utf-8");',
  "system documentation runbook endpoint includes markdown content type header",
);
assertIncludes(routes, "/api/admin/system/visual-parity", "admin visual parity json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/visual-parity",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system visual-parity json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/visual-parity.csv", "admin visual parity csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/visual-parity.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system visual-parity csv endpoint includes CSV content type header",
);
assertIncludes(routes, "/api/admin/system/launch-primary-routes", "admin launch primary routes endpoint");
assertMethodRouteHasHeader(
  routes,
  "post",
  "/api/admin/system/launch-primary-routes",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system launch-primary-routes endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/backups", "admin backups create endpoint");
assertMethodRouteHasHeader(
  routes,
  "post",
  "/api/admin/system/backups",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system backups create endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/backups/:id/restore-preview", "admin backup restore preview endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/backups/:id/restore-preview",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system backup restore-preview endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/backups/:id/restore-plan", "admin backup restore plan endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/backups/:id/restore-plan",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system backup restore-plan endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/backups/:id/export", "admin backup export endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/backups/:id/export",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system backup export endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/backups/:id/data-export", "admin backup data export endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/backups/:id/data-export",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system backup data export endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/backups/:id/restore-plan.csv", "admin backup restore-plan csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/backups/:id/restore-plan.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system backup restore-plan csv endpoint includes CSV content type header",
);
assertIncludes(routes, "/api/admin/system/backups/:id/restore", "admin backup restore endpoint");
assertMethodRouteHasHeader(
  routes,
  "post",
  "/api/admin/system/backups/:id/restore",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system backup restore endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/auth/me", "admin auth/me endpoint");
assertMethodRouteHasHeader(
  routes,
  "get",
  "/api/admin/auth/me",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "admin auth/me endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/auth/login", "admin auth/login endpoint");
assertMethodRouteHasHeader(
  routes,
  "post",
  "/api/admin/auth/login",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "admin auth/login endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/auth/logout", "admin auth/logout endpoint");
assertMethodRouteHasHeader(
  routes,
  "post",
  "/api/admin/auth/logout",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "admin auth/logout endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/section-actions", "admin section actions json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/section-actions",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system section-actions json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/section-actions.csv", "admin section actions csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/section-actions.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system section-actions csv endpoint includes CSV content type header",
);
assertIncludes(routes, "/api/admin/system/menu-actions", "admin menu actions json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/menu-actions",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system menu-actions json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/menu-actions.csv", "admin menu actions csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/menu-actions.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system menu-actions csv endpoint includes CSV content type header",
);
assertIncludes(routes, "/api/admin/system/sidebar-actions", "admin sidebar actions json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/sidebar-actions",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system sidebar-actions json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/sidebar-actions.csv", "admin sidebar actions csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/sidebar-actions.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system sidebar-actions csv endpoint includes CSV content type header",
);
assertIncludes(routes, "/api/admin/system/design-actions", "admin design actions json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/design-actions",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system design-actions json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/design-actions.csv", "admin design actions csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/design-actions.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system design-actions csv endpoint includes CSV content type header",
);
assertIncludes(routes, "/api/admin/system/system-actions", "admin system actions json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/system-actions",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system system-actions json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/system-actions.csv", "admin system actions csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/system-actions.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system system-actions csv endpoint includes CSV content type header",
);
assertIncludes(routes, "/api/admin/system/backups/catalog", "admin backup catalog json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/backups/catalog",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system backup catalog json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/backups/catalog.csv", "admin backup catalog csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/system/backups/catalog.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system backup catalog csv endpoint includes CSV content type header",
);
assertIncludes(routes, "function createPublicFrontendGuardReport", "public frontend guard report");
assertIncludes(routes, "/api/admin/system/public-frontend", "public frontend guard report");
assertRouteHasHeader(
  routes,
  "/api/admin/system/public-frontend",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system public-frontend json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/public-frontend.csv", "public frontend guard export");
assertRouteHasHeader(
  routes,
  "/api/admin/system/public-frontend.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system public-frontend csv endpoint includes CSV content type header",
);
assertIncludes(routes, "function createAdminBuildProgressReport", "admin build progress report");
assertIncludes(routes, "/api/admin/system/build-progress", "admin build progress report");
assertIncludes(routes, "launchClearanceChecks", "admin build progress launch clearance report");
assertIncludes(routes, "const launchClearanceStatus", "admin build progress launch clearance status");
assertIncludes(routes, "status: launchClearanceStatus", "admin build progress launch clearance status");
assertIncludes(routes, "const publicStorefrontGuardStatus", "admin build progress public storefront status");
assertIncludes(routes, "launch-ready", "admin build progress public storefront ready status");
assertIncludes(routes, "Confirm final launch timing", "admin build progress public storefront next action");
assertIncludes(routes, 'id: "launch-clearance"', "admin build progress launch clearance category");
assertIncludes(routes, "visualParityJson", "admin build progress launch clearance links");
assertIncludes(routes, "routeActionsCsv", "admin build progress launch clearance links");
assertIncludes(routes, "publicFrontendGuardCsv", "admin build progress launch clearance links");
assertIncludes(routes, "Launch Clearance: ${check.label}", "admin build progress launch clearance csv rows");
assertIncludes(routes, '"link"', "admin build progress launch clearance csv links");
assertIncludes(routes, "check.link", "admin build progress launch clearance csv links");
assertRouteHasHeader(
  routes,
  "/api/admin/system/build-progress",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "system build-progress json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/system/build-progress.csv", "admin build progress export");
assertRouteHasHeader(
  routes,
  "/api/admin/system/build-progress.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "system build-progress csv endpoint includes CSV content type header",
);
assertIncludes(routes, "scope: snapshot.scope", "admin build progress scope export");
assertIncludes(routes, "snapshot.scope.excludedModuleFamilies.join", "admin build progress scope export");
assertIncludes(routes, "Keep work inside", "admin build progress scope export");
assertIncludes(routes, "async function createSystemBackupSnapshot", "admin backup snapshot helper");
assertIncludes(routes, "trigger: \"launch-primary-routes\"", "launch route safety backup");
assertIncludes(routes, "safetyBackup", "launch route safety backup");
assertIncludes(routes, "protectedByOriginalFallback", "public frontend guard report");
assertIncludes(routes, "publicFrontend: snapshot.publicFrontend", "system public CMS launch blockers");
assertIncludes(routes, "publicFrontendGuard: snapshot.publicFrontendGuard", "system public frontend guard status");
assertIncludes(admin, "CMS launch blocker", "admin public CMS launch blockers");
assertIncludes(admin, "Original Frontend Guard", "admin public frontend guard panel");
assertIncludes(admin, "Public Guard JSON", "admin public frontend guard export");
assertIncludes(admin, "Public Guard CSV", "admin public frontend guard export");
assertIncludes(admin, "withCmsPreviewParam(\"/\", false)", "admin original website link");
assertIncludes(admin, "View Original Website", "admin original website link");
assertIncludes(admin, "withCmsPreviewParam(\"/\", true)", "admin CMS preview link");
assertIncludes(admin, "Primary Route Review Checklist", "admin route-level visual parity checklist");
assertIncludes(admin, "Approve every primary route in publicCmsVisualParityRouteReviews", "admin route-level visual parity checklist");
assertIncludes(admin, "Mark All Approved", "admin route-level visual parity checklist");
assertIncludes(admin, "Changes needed", "admin route-level visual parity status control");
assertIncludes(admin, "Optional visual parity note", "admin route-level visual parity note control");
assertIncludes(admin, "visualParityNeedsChangesRoutes", "admin visual parity changes-needed reporting");
assertIncludes(admin, "visualParityApprovedRoutes", "admin visual parity approval reporting");
assertIncludes(admin, "visualParityLabel", "admin sidebar visual parity status");
assertIncludes(admin, "Visual", "admin sidebar visual parity status");
assertIncludes(admin, "publicFrontend?.launchReady", "admin sidebar launch-ready status");
assertIncludes(admin, "Ready", "admin sidebar launch-ready status");
assertIncludes(admin, "Needs fresh launch approval", "admin public CMS fresh launch approval status");
assertIncludes(admin, "Needs visual parity approval", "admin public CMS visual parity approval status");
assertIncludes(admin, "CMS Visual Parity Approval", "admin public CMS visual parity approval setting");
assertIncludes(admin, "Visual Parity Review", "admin visual parity route comparison");
assertIncludes(admin, "Review Checklist", "admin visual parity route comparison");
assertIncludes(admin, "Visual JSON", "admin visual parity route comparison");
assertIncludes(admin, "Open Original Site", "admin protected original route links");
assertIncludes(admin, "Public URL", "admin protected customer route links");
assertIncludes(admin, "Open Migration Queue", "admin public CMS launch blockers");
assertIncludes(admin, "Build Progress", "admin build progress summary");
assertIncludes(admin, "Production Visibility", "admin build progress summary");
assertIncludes(admin, 'queryKey: ["/api/admin/system/build-progress"]', "admin build progress report query");
assertIncludes(admin, 'queryClient.invalidateQueries({ queryKey: ["/api/admin/system/build-progress"] });', "admin build progress report invalidation");
assertIncludes(admin, "buildProgressOverallPercent", "admin build progress report overall status");
assertIncludes(admin, "buildProgressPercentLabel", "admin sidebar build progress status");
assertIncludes(admin, "mt-3 grid grid-cols-2 gap-2 text-center", "admin sidebar build progress readable layout");
assertIncludes(admin, "col-span-2 rounded border border-white/10 bg-slate-900/80 p-2", "admin sidebar build progress primary tile");
assertIncludes(admin, "Build", "admin sidebar build progress status");
assertIncludes(admin, "Report updated", "admin build progress report timestamp");
assertIncludes(admin, "launchClearanceChecks", "admin launch clearance checklist rendering");
assertIncludes(admin, "openLaunchClearanceCheck", "admin launch clearance checklist actions");
assertIncludes(admin, "Launch Clearance", "admin launch clearance quick links");
assertIncludes(admin, "Open Backups", "admin launch clearance quick links");
assertIncludes(admin, "Visual Approval", "admin launch clearance quick links");
assertIncludes(admin, "Public Guard CSV", "admin launch clearance public guard links");
assertIncludes(admin, "Public Guard JSON", "admin launch clearance public guard links");
assertIncludes(admin, "Visual CSV", "admin launch clearance visual export links");
assertIncludes(admin, "Visual JSON", "admin launch clearance visual export links");
assertIncludes(admin, "Route Actions CSV", "admin launch clearance route action links");
assertIncludes(admin, "Migration JSON", "admin migration report export");
assertIncludes(admin, "Route Actions JSON", "admin migration action export");
assertIncludes(admin, "Launch clearance checklist", "admin migration launch clearance docs");
assertIncludes(admin, "Visual CSV or JSON", "admin migration launch clearance docs");
assertIncludes(admin, "disable publicCmsEnabled", "admin migration launch rollback docs");
assertIncludes(storage, "Launch clearance checklist", "seeded migration launch clearance docs");
assertIncludes(storage, "Visual CSV or JSON", "seeded migration launch clearance docs");
assertIncludes(storage, "disable publicCmsEnabled", "seeded migration launch rollback docs");
assertIncludes(admin, "Readiness JSON", "admin readiness export");
assertIncludes(admin, "Readiness CSV", "admin readiness export");
assertIncludes(admin, "Action Plan JSON", "admin action plan export");
assertIncludes(admin, "Action Plan CSV", "admin action plan export");
assertIncludes(admin, "Section Actions CSV", "admin section action exports");
assertIncludes(admin, "Menu Actions CSV", "admin menu action exports");
assertIncludes(admin, "Sidebar Actions CSV", "admin sidebar action exports");
assertIncludes(admin, "Design Actions CSV", "admin design action exports");
assertIncludes(admin, "System Actions CSV", "admin system action exports");
assertIncludes(admin, "Action Queue JSON", "admin crm action queue export");
assertIncludes(admin, "Media Actions JSON", "admin media action queue export");
assertIncludes(routes, "/api/admin/crm/action-queue", "crm action queue json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/crm/action-queue",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm action-queue json export includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/action-queue.csv", "crm action queue csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/forms/submissions/report.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "form submissions report csv endpoint includes CSV content type header",
);
assertRouteHasHeader(
  routes,
  "/api/admin/forms/submissions/actions.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "form submission actions csv endpoint includes CSV content type header",
);
assertRouteHasHeader(
  routes,
  "/api/admin/crm/report.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "crm report csv endpoint includes CSV content type header",
);
assertRouteHasHeader(
  routes,
  "/api/admin/crm/leads.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "crm leads csv endpoint includes CSV content type header",
);
assertRouteHasHeader(
  routes,
  "/api/admin/crm/follow-ups.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "crm follow-ups csv endpoint includes CSV content type header",
);
assertRouteHasHeader(
  routes,
  "/api/admin/seo/audit.csv",
  'res.setHeader("Content-Type", "text/csv; charset=utf-8");',
  "seo audit csv endpoint includes CSV content type header",
);
assertIncludes(routes, "/api/admin/crm/report.csv", "crm report csv endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/crm/follow-ups.json",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm follow-ups json export includes JSON content type header",
);
assertRouteHasHeader(
  routes,
  "/api/admin/crm/leads.json",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm leads json export includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/follow-ups.csv", "crm follow-ups csv endpoint");
assertIncludes(routes, "/api/admin/forms/submissions/report.csv", "form submissions report csv endpoint");
assertIncludes(routes, "/api/admin/forms/submissions/actions.csv", "form submissions actions csv endpoint");
assertIncludes(routes, "/api/admin/seo/audit.csv", "seo audit csv endpoint");
assertIncludes(routes, "/api/admin/crm/report.csv", "crm report csv endpoint");
assertIncludes(routes, "/api/admin/crm/leads.csv", "crm leads csv endpoint");
assertIncludes(routes, "/api/admin/forms/submissions/report", "form submission report json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/forms/submissions/report",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "form submissions report includes JSON content type header",
);
assertIncludes(routes, "/api/admin/forms/submissions/clear-stale-leads", "form stale lead clear endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/forms/submissions/clear-stale-leads",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "form stale lead clear endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/forms/submissions/bulk-status", "form bulk-status endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/forms/submissions/bulk-status",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "form bulk-status endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/forms/submissions/:id/create-lead", "form submission create-lead endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/forms/submissions/:id/create-lead",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "form submission create-lead endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/forms/submissions/bulk-create-leads", "form bulk create-leads endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/forms/submissions/bulk-create-leads",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "form bulk create-leads endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/media/import-public-assets", "cms media public asset import endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/cms/media/import-public-assets",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms media public asset import endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/media/import-referenced-assets", "cms media referenced asset import endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/cms/media/import-referenced-assets",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms media referenced asset import endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/media/upload", "cms media upload endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/cms/media/upload",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms media upload endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/media/bulk", "cms media bulk action endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/cms/media/bulk",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms media bulk action endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/pages/:id/preview", "cms page preview endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/cms/pages/:id/preview",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms page preview endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/sections/:id/preview", "cms section preview endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/cms/sections/:id/preview",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms section preview endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/blogPosts/:id/preview", "cms blog post preview endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/cms/blogPosts/:id/preview",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms blog post preview endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/:collection", "cms collection list endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/cms/:collection",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms collection list endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/:collection/:id", "cms collection record endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/cms/:collection/:id",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms collection record endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/:collection", "cms collection create endpoint");
assertMethodRouteHasHeader(
  routes,
  "post",
  "/api/admin/cms/:collection",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms collection create endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/:collection/:id", "cms collection update endpoint");
assertMethodRouteHasHeader(
  routes,
  "patch",
  "/api/admin/cms/:collection/:id",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms collection update endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/cms/:collection/:id", "cms collection delete endpoint");
assertMethodRouteHasHeader(
  routes,
  "delete",
  "/api/admin/cms/:collection/:id",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "cms collection delete endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/seo/audit", "seo audit json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/seo/audit",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "seo audit json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/leads", "crm leads endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/crm/leads",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm leads endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/leads", "crm leads create endpoint");
assertMethodRouteHasHeader(
  routes,
  "post",
  "/api/admin/crm/leads",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm leads create endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/report", "crm report json endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/crm/report",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm report json endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/leads/bulk-activity", "crm bulk-activity endpoint");
assertMethodRouteHasHeader(
  routes,
  "post",
  "/api/admin/crm/leads/bulk-activity",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm bulk-activity endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/leads/:id/activity", "crm lead activity endpoint");
assertMethodRouteHasHeader(
  routes,
  "post",
  "/api/admin/crm/leads/:id/activity",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm lead activity endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/leads/:id/merge", "crm lead merge endpoint");
assertMethodRouteHasHeader(
  routes,
  "post",
  "/api/admin/crm/leads/:id/merge",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm lead merge endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/leads/:id", "crm lead update endpoint");
assertMethodRouteHasHeader(
  routes,
  "patch",
  "/api/admin/crm/leads/:id",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm lead update endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/leads/:id", "crm lead delete endpoint");
assertMethodRouteHasHeader(
  routes,
  "delete",
  "/api/admin/crm/leads/:id",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm lead delete endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/report", "crm report endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/crm/report",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm report endpoint includes JSON content type header",
);
assertIncludes(routes, "/api/admin/crm/pipeline", "crm pipeline endpoint");
assertRouteHasHeader(
  routes,
  "/api/admin/crm/pipeline",
  'res.setHeader("Content-Type", "application/json; charset=utf-8");',
  "crm pipeline endpoint includes JSON content type header",
);
assertIncludes(admin, "Progress JSON", "admin build progress export");
assertIncludes(admin, "Progress CSV", "admin build progress export");
assertIncludes(admin, "Original frontend protected", "admin build progress summary");
assertIncludes(admin, "customer-facing routes stay on the original Glass & Door Pro layout", "admin build progress summary");
assertIncludes(admin, "Safety backup created", "launch route safety backup");
assertIncludes(storage, "published CMS route body while the original header, footer, menus, branding, palette, typography, and sidebars remain protected", "CMS preview runbook protected chrome guidance");
assertIncludes(admin, "published CMS route body while the original header, footer, menus, branding, palette, typography, and sidebars remain protected", "CMS preview runbook protected chrome guidance");
assertIncludes(storage, '!migrationRunbookBody.includes("published CMS route body while the original header")', "CMS preview runbook repair trigger");
assertIncludes(adminScope, 'label: "Client Portal"', "admin scope client portal guard");
assertIncludes(adminScope, 'label: "Agreement Gate"', "admin scope agreement gate guard");
assertIncludes(adminScope, "termsAndConditions", "admin scope agreement gate guard");
assertIncludes(adminScope, "agreementRequired", "admin scope agreement gate guard");
const excludedModuleFamilies = [
  "listing directories",
  "application intake",
  "public calendars",
  "customer account portals",
  "agreement-gated onboarding",
  "RSVP flows",
  "ticketing",
  "venue schedules",
  "attendee management",
];

function extractQuotedArray(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) {
    return [];
  }

  const match = source.slice(start).match(/excludedModuleFamilies:\s*\[([\s\S]*?)\]/);
  if (!match) {
    return [];
  }

  const items = match[1].matchAll(/["'`]([^"'`]+)["'`]/g);
  return [...items].map((match) => match[1]);
}

const routeExclusions = extractQuotedArray(routes, "excludedModuleFamilies:");
const adminScopeExclusions = extractQuotedArray(admin, "excludedModuleFamilies:");

function parseExcludedModulesFromGuide(source) {
  const match = source.match(/Do not introduce non-CMS module families from the source project, including ([^.]*)\./);
  if (!match) {
    return [];
  }

  const listText = match[1].replace(/\s+or\s+/g, ", ");
  return listText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const storageGuideExclusions = parseExcludedModulesFromGuide(storage);
const adminGuideExclusions = parseExcludedModulesFromGuide(admin);

if (routeExclusions.join("|") !== excludedModuleFamilies.join("|")) {
  throw new Error(
    `system route excluded module families mismatch. expected: ${excludedModuleFamilies.join(", ")}; got: ${routeExclusions.join(", ")}`,
  );
}

if (adminScopeExclusions.join("|") !== excludedModuleFamilies.join("|")) {
  throw new Error(
    `admin scope excluded module families mismatch. expected: ${excludedModuleFamilies.join(", ")}; got: ${adminScopeExclusions.join(", ")}`,
  );
}

if (storageGuideExclusions.join("|") !== excludedModuleFamilies.join("|")) {
  throw new Error(
    `server scope guide excluded module families mismatch. expected: ${excludedModuleFamilies.join(", ")}; got: ${storageGuideExclusions.join(", ")}`,
  );
}

if (adminGuideExclusions.join("|") !== excludedModuleFamilies.join("|")) {
  throw new Error(
    `admin scope guide excluded module families mismatch. expected: ${excludedModuleFamilies.join(", ")}; got: ${adminGuideExclusions.join(", ")}`,
  );
}

for (const moduleFamily of excludedModuleFamilies) {
  assertIncludes(routes, moduleFamily, "system scope report excluded module guard");
  assertIncludes(storage, moduleFamily, "seeded scope documentation excluded module guard");
  assertIncludes(admin, moduleFamily, "admin scope report excluded module guard");
}

assertAdminHrefRoutesExist(admin, routes);
assertAdminApiRoutesHaveContentTypeHeaders(routes);

console.log("Public fallback check passed.");
