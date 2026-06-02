import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CmsLeadForm } from "@/components/cms-lead-form";
import { getPublicBusinessIdentity, phoneToTelHref, type PublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import { isExternalCmsHref, safeCmsAssetUrl, safeCmsHref, sanitizeCmsHtml } from "@/lib/cms-safety";
import { cn } from "@/lib/utils";
import type { CmsBlogPost, CmsForm, CmsMedia, CmsWidget } from "@shared/schema";

type CmsBlogPostSummary = CmsBlogPost & {
  featuredImage?: CmsMedia | null;
};

type CmsWidgetTheme = "default" | "footer";

const widgetCardClass = (theme: CmsWidgetTheme) =>
  theme === "footer" ? "border-slate-700 bg-slate-800 text-slate-100 shadow-none" : "";
const widgetMutedClass = (theme: CmsWidgetTheme) =>
  theme === "footer" ? "text-slate-300" : "text-muted-foreground";
const widgetItemClass = (theme: CmsWidgetTheme) =>
  theme === "footer" ? "border-slate-700 bg-slate-900/40 text-slate-300" : "border bg-white";
const widgetLinkClass = (theme: CmsWidgetTheme) =>
  theme === "footer" ? "transition hover:text-primary" : "transition hover:text-primary";

function propText(props: Record<string, unknown>, key: string) {
  const value = props[key];
  return typeof value === "string" ? value : "";
}

function propList(props: Record<string, unknown>, key: string) {
  const value = props[key];
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function propCount(props: Record<string, unknown>, key: string, fallback = 3) {
  const value = props[key];
  const numberValue = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numberValue) ? Math.min(Math.max(numberValue, 1), 6) : fallback;
}

function CmsWidgetView({
  widget,
  identity,
  theme = "default",
}: {
  widget: CmsWidget;
  identity: PublicBusinessIdentity;
  theme?: CmsWidgetTheme;
}) {
  const props = widget.props ?? {};
  const title = widget.title || propText(props, "title");

  if (widget.type === "contactCard") {
    const phone = propText(props, "phone") || identity.phone;
    const email = propText(props, "email") || identity.email;
    const body = propText(props, "body") || identity.description;
    return (
      <Card className={widgetCardClass(theme)}>
        <CardHeader>
          <CardTitle className="text-lg">{title || `Contact ${identity.siteName}`}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {body && <p className={widgetMutedClass(theme)}>{body}</p>}
          {phone && (
            <Button asChild className="w-full">
              <a href={phoneToTelHref(phone)}>{phone}</a>
            </Button>
          )}
          {email && (
            <Button asChild variant="outline" className="w-full">
              <a href={`mailto:${email}`}>{email}</a>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (widget.type === "cta") {
    const href = safeCmsHref(propText(props, "href") || "/contact");
    const label = propText(props, "label") || "Request a Quote";
    return (
      <Card className={widgetCardClass(theme)}>
        <CardContent className="space-y-3 p-5">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {propText(props, "body") && <p className={cn("text-sm", widgetMutedClass(theme))}>{propText(props, "body")}</p>}
          {href && (
            <Button asChild className="w-full">
              {isExternalCmsHref(href) ? (
                <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
                  {label}
                </a>
              ) : (
                <Link href={href}>{label}</Link>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (widget.type === "imageCard") {
    const imageUrl = safeCmsAssetUrl(propText(props, "imageUrl"));
    const href = safeCmsHref(propText(props, "href"));
    const label = propText(props, "label");
    const altText = propText(props, "altText") || title || `${identity.siteName} project image`;

    return (
      <Card className={cn("overflow-hidden", widgetCardClass(theme))}>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={altText}
            className="aspect-[4/3] w-full object-cover"
            loading="lazy"
          />
        )}
        <CardContent className="space-y-3 p-5">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {propText(props, "caption") && <p className={cn("text-xs font-medium uppercase tracking-wide", widgetMutedClass(theme))}>{propText(props, "caption")}</p>}
          {propText(props, "body") && <p className={cn("text-sm", widgetMutedClass(theme))}>{propText(props, "body")}</p>}
          {href && label && (
            <Button asChild variant="outline" className="w-full">
              {isExternalCmsHref(href) ? (
                <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
                  {label}
                </a>
              ) : (
                <Link href={href}>{label}</Link>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (widget.type === "serviceList") {
    const items = propList(props, "items");
    return (
      <Card className={widgetCardClass(theme)}>
        <CardHeader>
          <CardTitle className="text-lg">{title || "Services"}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className={cn("space-y-2 text-sm", widgetMutedClass(theme))}>
            {items.map((item) => {
              const [label, href] = item.split("|").map((part) => part.trim());
              const safeHref = safeCmsHref(href);
              return (
                <li key={item} className={cn("rounded-md border", widgetItemClass(theme))}>
                  {safeHref ? (
                    isExternalCmsHref(safeHref) ? (
                      <a
                        href={safeHref}
                        target={safeHref.startsWith("http") ? "_blank" : undefined}
                        rel={safeHref.startsWith("http") ? "noreferrer" : undefined}
                        className={cn("block px-3 py-2", widgetLinkClass(theme))}
                      >
                        {label}
                      </a>
                    ) : (
                      <Link href={safeHref} className={cn("block px-3 py-2", widgetLinkClass(theme))}>
                        {label}
                      </Link>
                    )
                  ) : (
                    <span className="block px-3 py-2">{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    );
  }

  if (widget.type === "leadForm") {
    return <CmsLeadFormWidget widget={widget} theme={theme} />;
  }

  if (widget.type === "recentPosts") {
    return <CmsRecentPostsWidget widget={widget} theme={theme} />;
  }

  if (widget.type === "html") {
    const html = sanitizeCmsHtml(propText(props, "html"));
    return (
      <Card className={widgetCardClass(theme)}>
        <CardContent
          className={cn("prose prose-sm max-w-none p-5", theme === "footer" && "prose-invert")}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Card>
    );
  }

  return (
    <Card className={widgetCardClass(theme)}>
      <CardContent className="p-5">
        {title && <h2 className="text-lg font-bold">{title}</h2>}
        {propText(props, "body") && <p className={cn("mt-2 text-sm", widgetMutedClass(theme))}>{propText(props, "body")}</p>}
      </CardContent>
    </Card>
  );
}

function CmsRecentPostsWidget({ widget, theme = "default" }: { widget: CmsWidget; theme?: CmsWidgetTheme }) {
  const props = widget.props ?? {};
  const title = widget.title || propText(props, "title") || "Recent Posts";
  const count = propCount(props, "count", 3);
  const filter = propText(props, "category") || propText(props, "tag");
  const label = propText(props, "label") || "View Blog";
  const { data: posts = [], isLoading } = useQuery<CmsBlogPostSummary[]>({
    queryKey: ["/api/cms/public/blog"],
    retry: false,
    throwOnError: false,
  });
  const visiblePosts = posts
    .filter((post) => !filter || post.category === filter || post.tags.includes(filter))
    .slice(0, count);

  return (
    <Card className={widgetCardClass(theme)}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {propText(props, "body") && <p className={cn("text-sm", widgetMutedClass(theme))}>{propText(props, "body")}</p>}
        {isLoading && <p className={cn("text-sm", widgetMutedClass(theme))}>Loading posts...</p>}
        {!isLoading && visiblePosts.length === 0 && (
          <p className={cn("text-sm", widgetMutedClass(theme))}>Published CMS posts will appear here.</p>
        )}
        {visiblePosts.length > 0 && (
          <ul className="space-y-3 text-sm">
            {visiblePosts.map((post) => (
              <li key={post.id} className={cn("border-b pb-3 last:border-b-0 last:pb-0", theme === "footer" && "border-slate-700")}>
                <Link href={`/blog/${encodeURIComponent(post.slug)}`} className="font-semibold leading-snug hover:text-primary">
                  {post.title}
                </Link>
                {post.excerpt && <p className={cn("mt-1 line-clamp-2 text-xs leading-5", widgetMutedClass(theme))}>{post.excerpt}</p>}
              </li>
            ))}
          </ul>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href="/blog">{label}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CmsLeadFormWidget({ widget, theme = "default" }: { widget: CmsWidget; theme?: CmsWidgetTheme }) {
  const props = widget.props ?? {};
  const formSlug = propText(props, "formSlug");
  const title = widget.title || propText(props, "title") || "Request a Quote";
  const { data: form } = useQuery<CmsForm | null>({
    queryKey: [`/api/cms/public/forms/${encodeURIComponent(formSlug)}`],
    enabled: Boolean(formSlug),
    retry: false,
    throwOnError: false,
  });

  return (
    <Card className={widgetCardClass(theme)}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {propText(props, "body") && <p className={cn("text-sm", widgetMutedClass(theme))}>{propText(props, "body")}</p>}
        <CmsLeadForm form={form} />
      </CardContent>
    </Card>
  );
}

export function CmsWidgetStack({ widgets, theme = "default" }: { widgets: CmsWidget[]; theme?: CmsWidgetTheme }) {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);

  if (widgets.length === 0) return null;

  return (
    <aside className="space-y-4">
      {widgets.map((widget) => (
        <CmsWidgetView key={widget.id} widget={widget} identity={identity} theme={theme} />
      ))}
    </aside>
  );
}
