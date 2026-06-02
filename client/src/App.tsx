import { Switch, Route } from "wouter";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initializeLeadAttribution } from "@/lib/lead-attribution";
import { publicCmsEnabled, usePublicSite } from "@/hooks/use-public-site";
import NotFound from "@/pages/not-found";
import { ScrollToTop } from "@/components/scroll-to-top";
import { CmsBlogIndex } from "@/components/cms-blog-index";
import { CmsBlogPreviewRoute, CmsBlogRoute } from "@/components/cms-blog-route";
import { CmsPagePreviewRoute, CmsPageRoute, CmsSectionPreviewRoute } from "@/components/cms-page-route";

const Admin = lazy(() => import("@/pages/admin"));
const Home = lazy(() => import("@/pages/home"));
const About = lazy(() => import("@/pages/about"));
const Contact = lazy(() => import("@/pages/contact"));
const FramelessShowers = lazy(() => import("@/pages/services/frameless-showers"));
const WindowInstallation = lazy(() => import("@/pages/services/window-installation"));
const DoorInstallation = lazy(() => import("@/pages/services/door-installation"));
const WindowRepair = lazy(() => import("@/pages/services/window-repair"));
const CommercialGlass = lazy(() => import("@/pages/services/commercial-glass"));
const ShowersPage = lazy(() => import("@/pages/services/showers"));
const WindowsPage = lazy(() => import("@/pages/services/windows"));
const DoorsPage = lazy(() => import("@/pages/services/doors"));
const Gallery = lazy(() => import("@/pages/gallery"));

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-muted-foreground">
      Loading...
    </div>
  );
}

function LeadAttributionTracker() {
  useEffect(() => {
    initializeLeadAttribution();
  }, []);

  return null;
}

function PublicCmsRoute({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const siteData = usePublicSite();

  if (!siteData.isPublicCmsPreview && !publicCmsEnabled(siteData.settings)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

function withCmsPreviewParam(path: string, enabled: boolean) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = typeof window === "undefined" ? "https://glassanddoorpro.com" : window.location.origin;
  const url = new URL(normalizedPath, baseUrl);
  url.searchParams.set("cms-preview", enabled ? "1" : "0");
  return `${url.pathname}${url.search}${url.hash}`;
}

function PublicCmsPreviewBanner() {
  const siteData = usePublicSite();
  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

  if (!siteData.isPublicCmsPreview || isAdminRoute) return null;

  const exitPreviewHref = (() => {
    if (typeof window === "undefined") return withCmsPreviewParam("/", false);
    const url = new URL(window.location.href);
    url.searchParams.set("cms-preview", "0");
    return `${url.pathname}${url.search}${url.hash}`;
  })();

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-md border border-sky-300 bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
      <div className="min-w-0">
        <div className="font-semibold text-slate-950">CMS Preview Mode</div>
        <div className="text-xs text-slate-600">This URL is showing CMS preview; normal public URLs still use the original site.</div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <a className="rounded-md border px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50" href={exitPreviewHref}>
          Exit Preview
        </a>
        <a className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90" href="/admin">
          Admin
        </a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/admin/preview/pages/:id">
        {(params) => <CmsPagePreviewRoute id={params.id} fallback={<NotFound />} />}
      </Route>
      <Route path="/admin/preview/blog/:id">
        {(params) => <CmsBlogPreviewRoute id={params.id} fallback={<NotFound />} />}
      </Route>
      <Route path="/admin/preview/sections/:id">
        {(params) => <CmsSectionPreviewRoute id={params.id} />}
      </Route>
      <Route path="/admin" component={Admin} />
      <Route path="/">
        <CmsPageRoute slug="home" fallback={<Home />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/about">
        <CmsPageRoute slug="about" fallback={<About />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/contact">
        <CmsPageRoute slug="contact" fallback={<Contact />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/services">
        <CmsPageRoute slug="services" fallback={<NotFound />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/services/frameless-showers">
        <CmsPageRoute slug="services/frameless-showers" fallback={<FramelessShowers />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/services/window-installation">
        <CmsPageRoute slug="services/window-installation" fallback={<WindowInstallation />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/services/door-installation">
        <CmsPageRoute slug="services/door-installation" fallback={<DoorInstallation />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/services/window-repair">
        <CmsPageRoute slug="services/window-repair" fallback={<WindowRepair />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/services/commercial-glass">
        <CmsPageRoute slug="services/commercial-glass" fallback={<CommercialGlass />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/services/showers">
        <CmsPageRoute slug="services/showers" fallback={<ShowersPage />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/services/windows">
        <CmsPageRoute slug="services/windows" fallback={<WindowsPage />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/services/doors">
        <CmsPageRoute slug="services/doors" fallback={<DoorsPage />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/services/*">
        {(params) => (
          <CmsPageRoute
            slug={`services/${params["*"] ?? ""}`}
            fallback={<NotFound />}
            deferFallback
            preserveFallbackUntilCmsEnabled
          />
        )}
      </Route>
      <Route path="/gallery">
        <CmsPageRoute slug="gallery" fallback={<Gallery />} deferFallback preserveFallbackUntilCmsEnabled />
      </Route>
      <Route path="/page/*">
        {(params) => (
          <CmsPageRoute
            slug={params["*"] ?? ""}
            fallback={<NotFound />}
            deferFallback
            preserveFallbackUntilCmsEnabled
          />
        )}
      </Route>
      <Route path="/blog">
        <PublicCmsRoute fallback={<NotFound />}>
          <CmsBlogIndex />
        </PublicCmsRoute>
      </Route>
      <Route path="/blog/category/:topic">
        {(params) => (
          <PublicCmsRoute fallback={<NotFound />}>
            <CmsBlogIndex filterKind="category" filterValue={params.topic} />
          </PublicCmsRoute>
        )}
      </Route>
      <Route path="/blog/tag/:topic">
        {(params) => (
          <PublicCmsRoute fallback={<NotFound />}>
            <CmsBlogIndex filterKind="tag" filterValue={params.topic} />
          </PublicCmsRoute>
        )}
      </Route>
      <Route path="/blog/:slug">
        {(params) => (
          <PublicCmsRoute fallback={<NotFound />}>
            <CmsBlogRoute slug={params.slug} fallback={<NotFound />} />
          </PublicCmsRoute>
        )}
      </Route>
      <Route path="/*">
        {(params) => (
          <CmsPageRoute
            slug={params["*"] ?? ""}
            fallback={<NotFound />}
            deferFallback
            preserveFallbackUntilCmsEnabled
          />
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LeadAttributionTracker />
        <ScrollToTop />
        <Toaster />
        <PublicCmsPreviewBanner />
        <Suspense fallback={<RouteLoading />}>
          <Router />
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
