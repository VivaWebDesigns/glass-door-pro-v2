import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { Menu, Phone, Mail, MapPin, Clock, ChevronDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { CmsWidgetStack } from "@/components/cms-widgets";
import { getPublicBusinessIdentity, publicCmsEnabled, usePublicSite } from "@/hooks/use-public-site";
import { isExternalCmsHref, safeCmsAssetUrl, safeCmsHref } from "@/lib/cms-safety";
import { cn } from "@/lib/utils";
import logo from "@/assets/images/logo.png";
import type { CmsMenuItem } from "@shared/schema";

const fallbackServiceLinks: CmsMenuItem[] = [
  { id: "frameless-showers", href: "/services/frameless-showers", label: "Frameless Showers" },
  { id: "window-installation", href: "/services/window-installation", label: "Window Installation" },
  { id: "door-installation", href: "/services/door-installation", label: "Door Installation" },
  { id: "window-repair", href: "/services/window-repair", label: "Window Repair" },
  { id: "commercial-glass", href: "/services/commercial-glass", label: "Commercial Glass" },
];

const fallbackHeaderItems: CmsMenuItem[] = [
  { id: "home", href: "/", label: "Home" },
  { id: "about", href: "/about", label: "About" },
  { id: "services", href: "#", label: "Services", children: fallbackServiceLinks },
  { id: "gallery", href: "/gallery", label: "Gallery" },
  { id: "reviews", href: "/#reviews", label: "Reviews" },
  { id: "contact", href: "/contact", label: "Contact" },
];

const fallbackFooterItems: CmsMenuItem[] = [
  ...fallbackServiceLinks,
  { id: "gallery", href: "/gallery", label: "Gallery" },
];

const sanitizeMenuItems = (items: CmsMenuItem[]): CmsMenuItem[] =>
  items.flatMap((item) => {
    const href = safeCmsHref(item.href);
    const children = sanitizeMenuItems(item.children ?? []);
    const label = item.label.trim();
    const id = item.id.trim() || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    if (!label || (!href && children.length === 0)) return [];

    return [
      {
        ...item,
        id,
        label,
        href: href || "#",
        children,
      },
    ];
  });

const flattenFooterMenuItems = (items: CmsMenuItem[]) => {
  const seen = new Set<string>();
  return items.flatMap((item) => [item, ...(item.children ?? [])]).filter((item) => {
    if (item.href === "#" && item.children?.length) return false;
    const key = `${item.href}|${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isHttpHref = (href: string) => /^https?:/i.test(href);
const isNavigableMenuHref = (href: string) => href.trim() !== "#";
const safeCmsFontName = (value: string | null | undefined, fallback: string) =>
  value && /^[A-Za-z0-9][A-Za-z0-9 -]{0,79}$/.test(value.trim()) ? value.trim() : fallback;
const cmsFontStack = (value: string | null | undefined, fallback: string) =>
  `"${safeCmsFontName(value, fallback)}", sans-serif`;
const safeCmsTypeSize = (value: string | null | undefined) =>
  value && /^(?:0|(?:\d+(?:\.\d+)?)(?:rem|em|px|%))$/.test(value.trim()) ? value.trim() : "";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDesktopMenu, setOpenDesktopMenu] = useState<string | null>(null);
  const [openMobileMenus, setOpenMobileMenus] = useState<Record<string, boolean>>({});
  const siteData = usePublicSite();
  const isPublicCmsEnabled = publicCmsEnabled(siteData.settings);
  const branding = isPublicCmsEnabled ? siteData.branding : null;
  const headerMenu = isPublicCmsEnabled ? siteData.menus.find((menu) => menu.location === "header") : null;
  const footerMenu = isPublicCmsEnabled ? siteData.menus.find((menu) => menu.location === "footer") : null;
  const footerSidebar = isPublicCmsEnabled
    ? siteData.sidebars.find((sidebar) => sidebar.location === "footer" && sidebar.widgets.length > 0)
    : null;
  const sanitizedHeaderMenuItems = sanitizeMenuItems(headerMenu?.items ?? []);
  const sanitizedFooterMenuItems = sanitizeMenuItems(footerMenu?.items ?? []);
  const headerItems = sanitizedHeaderMenuItems.length ? sanitizedHeaderMenuItems : sanitizeMenuItems(fallbackHeaderItems);
  const footerItems = sanitizedFooterMenuItems.length ? sanitizedFooterMenuItems : sanitizeMenuItems(fallbackFooterItems);
  const footerLinks = flattenFooterMenuItems(footerItems);
  const identity = getPublicBusinessIdentity(isPublicCmsEnabled ? siteData : { branding: null, settings: [] });
  const logoSrc = safeCmsAssetUrl(branding?.logoUrl) || logo;
  const brandName = identity.siteName;
  const contactPhone = identity.phone;
  const contactEmail = identity.email;
  const contactAddress = identity.address;
  const siteSettings = isPublicCmsEnabled ? siteData.settings.find((setting) => setting.key === "site")?.value ?? {} : {};
  const businessHours =
    typeof siteSettings.businessHours === "string" && siteSettings.businessHours.trim()
      ? siteSettings.businessHours
      : "Mon-Sat: 7am - 6pm";
  const socialLinks = Object.entries(branding?.socialLinks ?? {})
    .map(([label, href]) => [label, safeCmsHref(href)] as const)
    .filter(([_label, href]) => href);
  const paletteTokens = isPublicCmsEnabled ? siteData.colorPalette?.tokens : undefined;
  const typography = isPublicCmsEnabled ? siteData.typography : null;
  const typeScale = typography?.scale ?? {};
  const cmsThemeVariables = {
    ...(paletteTokens?.primary ? { "--primary": paletteTokens.primary } : {}),
    ...(paletteTokens?.secondary ? { "--secondary": paletteTokens.secondary } : {}),
    ...(paletteTokens?.accent ? { "--accent": paletteTokens.accent } : {}),
    ...(paletteTokens?.background ? { "--background": paletteTokens.background } : {}),
    ...(paletteTokens?.foreground ? { "--foreground": paletteTokens.foreground } : {}),
    ...(typography?.headingFont ? { "--font-heading": cmsFontStack(typography.headingFont, "Montserrat") } : {}),
    ...(typography?.bodyFont ? { "--font-sans": cmsFontStack(typography.bodyFont, "Open Sans") } : {}),
    ...(safeCmsTypeSize(typeScale.h1) ? { "--cms-type-h1": safeCmsTypeSize(typeScale.h1) } : {}),
    ...(safeCmsTypeSize(typeScale.h2) ? { "--cms-type-h2": safeCmsTypeSize(typeScale.h2) } : {}),
    ...(safeCmsTypeSize(typeScale.h3) ? { "--cms-type-h3": safeCmsTypeSize(typeScale.h3) } : {}),
    ...(safeCmsTypeSize(typeScale.body) ? { "--cms-type-body": safeCmsTypeSize(typeScale.body) } : {}),
    ...(safeCmsTypeSize(typeScale.small) ? { "--cms-type-small": safeCmsTypeSize(typeScale.small) } : {}),
  } as Record<string, string>;
  const cmsThemeStyle = cmsThemeVariables as CSSProperties;

  const isActive = (path: string) => location === path;
  const isServicesActive = () => location.startsWith("/services");
  const isExternalHref = isExternalCmsHref;
  const isHashHref = (href: string) => href.startsWith("/#");

  const scrollToSection = (sectionId: string) => {
    if (location !== "/") {
      window.location.href = `/#${sectionId}`;
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
    setIsMobileMenuOpen(false);
  };

  const navigateMenuItem = (item: CmsMenuItem) => {
    const href = safeCmsHref(item.href);
    if (!href) return;

    if (isHashHref(href)) {
      scrollToSection(href.replace("/#", ""));
      return;
    }
    if (isExternalHref(href)) {
      window.location.href = href;
      setIsMobileMenuOpen(false);
      return;
    }
    navigate(href);
    window.scrollTo(0, 0);
    setIsMobileMenuOpen(false);
  };

  const isItemActive = (item: CmsMenuItem) => {
    if (item.children?.some((child) => isItemActive(child))) return true;
    if (item.href === "/services") return isServicesActive();
    return item.href === location;
  };

  // Handle hash scrolling on page load
  useEffect(() => {
    if (location === "/" && window.location.hash) {
      const id = window.location.hash.substring(1);
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }, [location]);

  useEffect(() => {
    document.title = document.title.replace(/Glass (&|and) Door Pro/g, brandName);
    const faviconUrl = safeCmsAssetUrl(branding?.faviconUrl) || "/favicon.png";
    const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const appleTouchIconLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    iconLink?.setAttribute("href", faviconUrl);
    appleTouchIconLink?.setAttribute("href", faviconUrl);
    appleTitle?.setAttribute("content", brandName);
  }, [brandName, branding?.faviconUrl]);

  useEffect(() => {
    const root = document.documentElement;
    const previousValues = Object.fromEntries(
      Object.keys(cmsThemeVariables).map((property) => [property, root.style.getPropertyValue(property)]),
    );

    Object.entries(cmsThemeVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    return () => {
      Object.entries(previousValues).forEach(([property, value]) => {
        if (value) {
          root.style.setProperty(property, value);
        } else {
          root.style.removeProperty(property);
        }
      });
    };
  }, [
    paletteTokens?.primary,
    paletteTokens?.secondary,
    paletteTokens?.accent,
    paletteTokens?.background,
    paletteTokens?.foreground,
    typography?.headingFont,
    typography?.bodyFont,
    typeScale.h1,
    typeScale.h2,
    typeScale.h3,
    typeScale.body,
    typeScale.small,
  ]);

  return (
    <div className="min-h-screen flex flex-col font-sans" style={cmsThemeStyle}>
      {/* Main Navigation */}
      <header 
        className="sticky top-0 z-50 w-full border-b bg-[#ffffff] transition-shadow duration-300"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
      >
        <div className="container mx-auto px-4 py-1.5 md:py-1 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-0" data-testid="link-home-logo">
            <img 
              src={logoSrc} 
              alt={brandName} 
              className="h-[72px] md:h-[80px] w-auto block m-0 p-0 scale-x-[0.85] origin-left" 
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {headerItems.map((item) => (
              item.children?.length ? (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => setOpenDesktopMenu(item.id)}
                  onMouseLeave={() => setOpenDesktopMenu(null)}
                >
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary",
                      isItemActive(item) ? "text-primary font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", openDesktopMenu === item.id && "rotate-180")} />
                  </button>

                  {openDesktopMenu === item.id && (
                    <div className="absolute left-0 top-full z-50 pt-2">
                      <div className="w-52 rounded-lg border bg-white py-2 shadow-lg">
                        {isNavigableMenuHref(item.href) && (
                          <a
                            href={item.href}
                            onClick={(event) => {
                              event.preventDefault();
                              setOpenDesktopMenu(null);
                              navigateMenuItem(item);
                            }}
                            className={cn(
                              "block cursor-pointer border-b px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent",
                              isItemActive(item) ? "text-primary" : "text-foreground"
                            )}
                          >
                            {item.label}
                          </a>
                        )}
                        {item.children.map((child) => (
                          <a
                            key={child.id}
                            href={child.href}
                            onClick={(event) => {
                              event.preventDefault();
                              setOpenDesktopMenu(null);
                              navigateMenuItem(child);
                            }}
                            className={cn(
                              "block cursor-pointer px-4 py-2 text-sm transition-colors hover:bg-accent",
                              isActive(child.href) ? "font-medium text-primary" : "text-muted-foreground"
                            )}
                          >
                            {child.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : isHashHref(item.href) ? (
                <button
                  key={item.id}
                  onClick={() => navigateMenuItem(item)}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  {item.label}
                </button>
              ) : isExternalHref(item.href) ? (
                <a
                  key={item.id}
                  href={item.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                  {item.href.startsWith("http") && <ExternalLink className="h-3 w-3" />}
                </a>
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
                    isItemActive(item) ? "text-primary font-semibold" : "text-muted-foreground"
                  )}
                  data-testid={item.href === "/gallery" ? "link-gallery" : undefined}
                >
                  {item.label}
                </Link>
              )
            ))}
          </nav>

          {/* Mobile Nav */}
          <div className="flex items-center md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-16 w-16">
                  <Menu className="h-12 w-12" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex flex-col gap-6 mt-6">
                  <Link href="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                    <img src={logoSrc} alt={brandName} className="h-10 w-auto" />
                    <span className="font-heading font-bold text-lg">{brandName}</span>
                  </Link>
                  <div className="flex flex-col gap-4">
                    {headerItems.map((item) => (
                      item.children?.length ? (
                        <div key={item.id}>
                          <button
                            onClick={() =>
                              setOpenMobileMenus((current) => ({ ...current, [item.id]: !current[item.id] }))
                            }
                            className="flex w-full items-center gap-2 text-left text-lg font-medium hover:text-primary"
                          >
                            {item.label}
                            <ChevronDown className={cn("h-5 w-5 transition-transform", openMobileMenus[item.id] && "rotate-180")} />
                          </button>
                          {openMobileMenus[item.id] && (
                            <div className="ml-4 mt-2 flex flex-col gap-2">
                              {isNavigableMenuHref(item.href) && (
                                isHashHref(item.href) ? (
                                  <button
                                    type="button"
                                    className="text-left text-base font-medium text-foreground hover:text-primary"
                                    onClick={() => navigateMenuItem(item)}
                                  >
                                    {item.label}
                                  </button>
                                ) : isExternalHref(item.href) ? (
                                  <a
                                    href={item.href}
                                    className="inline-flex items-center gap-1 text-base font-medium text-foreground hover:text-primary"
                                    target={item.href.startsWith("http") ? "_blank" : undefined}
                                    rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                  >
                                    {item.label}
                                    {item.href.startsWith("http") && <ExternalLink className="h-3 w-3" />}
                                  </a>
                                ) : (
                                  <Link
                                    href={item.href}
                                    className="text-base font-medium text-foreground hover:text-primary"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                  >
                                    {item.label}
                                  </Link>
                                )
                              )}
                              {item.children.map((child) => (
                                isHashHref(child.href) ? (
                                  <button
                                    key={child.id}
                                    type="button"
                                    className="text-left text-base text-muted-foreground hover:text-primary"
                                    onClick={() => navigateMenuItem(child)}
                                  >
                                    {child.label}
                                  </button>
                                ) : isExternalHref(child.href) ? (
                                  <a
                                    key={child.id}
                                    href={child.href}
                                    className="inline-flex items-center gap-1 text-base text-muted-foreground hover:text-primary"
                                    target={child.href.startsWith("http") ? "_blank" : undefined}
                                    rel={child.href.startsWith("http") ? "noreferrer" : undefined}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                  >
                                    {child.label}
                                    {child.href.startsWith("http") && <ExternalLink className="h-3 w-3" />}
                                  </a>
                                ) : (
                                  <Link
                                    key={child.id}
                                    href={child.href}
                                    className="text-base text-muted-foreground hover:text-primary"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                  >
                                    {child.label}
                                  </Link>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      ) : isHashHref(item.href) ? (
                        <button
                          key={item.id}
                          onClick={() => navigateMenuItem(item)}
                          className="text-left text-lg font-medium hover:text-primary"
                        >
                          {item.label}
                        </button>
                      ) : isExternalHref(item.href) ? (
                        <a
                          key={item.id}
                          href={item.href}
                          className="inline-flex items-center gap-1 text-lg font-medium hover:text-primary"
                          target={item.href.startsWith("http") ? "_blank" : undefined}
                          rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {item.label}
                          {item.href.startsWith("http") && <ExternalLink className="h-4 w-4" />}
                        </a>
                      ) : (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="text-lg font-medium hover:text-primary"
                          onClick={() => setIsMobileMenuOpen(false)}
                          data-testid={item.href === "/gallery" ? "link-gallery-mobile" : undefined}
                        >
                          {item.label}
                        </Link>
                      )
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-slate-900 text-slate-200 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={logoSrc} alt={brandName} className="h-12 w-auto" />
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                {identity.description}
              </p>
            </div>

            <div>
              <h3 className="font-heading font-bold text-white mb-4">Services</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                {footerLinks.map((item) => (
                  <li key={`${item.id}-${item.href}`}>
                    {isExternalHref(item.href) ? (
                      <a
                        href={item.href}
                        className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                        target={isHttpHref(item.href) ? "_blank" : undefined}
                        rel={isHttpHref(item.href) ? "noreferrer" : undefined}
                      >
                        {item.label}
                        {isHttpHref(item.href) && <ExternalLink className="h-3 w-3" />}
                      </a>
                    ) : isHashHref(item.href) ? (
                      <button
                        type="button"
                        className="text-left transition-colors hover:text-primary"
                        onClick={() => navigateMenuItem(item)}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        className="hover:text-primary transition-colors"
                        data-testid={item.href === "/gallery" ? "link-gallery-footer" : undefined}
                        onClick={() => window.scrollTo(0, 0)}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-heading font-bold text-white mb-4">Contact Info</h3>
              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary shrink-0" />
                  <span>{contactAddress}</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary shrink-0" />
                  <a href={identity.phoneHref} className="hover:text-white transition-colors">
                    {contactPhone}
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary shrink-0" />
                  <a href={`mailto:${contactEmail}`} className="hover:text-white transition-colors">
                    {contactEmail}
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary shrink-0" />
                  <span>{businessHours}</span>
                </li>
              </ul>
              {socialLinks.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {socialLinks.map(([label, href]) => (
                    <a
                      key={label}
                      href={href}
                      target={isHttpHref(href) ? "_blank" : undefined}
                      rel={isHttpHref(href) ? "noreferrer" : undefined}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-primary hover:text-primary"
                    >
                      {label}
                      {isHttpHref(href) && <ExternalLink className="h-3 w-3" />}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
          {footerSidebar?.widgets.length ? (
            <div className="mb-8 border-t border-slate-800 pt-8">
              <CmsWidgetStack widgets={footerSidebar.widgets} theme="footer" />
            </div>
          ) : null}
          <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} {brandName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
