import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/layout";
import { CmsAnchoredBlock, cmsTypeStyle } from "@/components/cms-page-route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CmsWidgetStack } from "@/components/cms-widgets";
import { BreadcrumbSchema, WebPageSchema } from "@/components/structured-data";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import { safeCmsAssetUrl, safeCmsCanonicalUrl } from "@/lib/cms-safety";
import type { CmsBlogPost, CmsMedia, CmsPage, CmsSidebar } from "@shared/schema";

type CmsBlogPostSummary = CmsBlogPost & {
  featuredImage?: CmsMedia | null;
};

type CmsBlogFilterKind = "category" | "tag";

function findBlogIndexSidebar(sidebars: CmsSidebar[] = []) {
  return ["blog", "page:blog", "/blog", "default"]
    .map((location) => sidebars.find((sidebar) => sidebar.location === location && sidebar.widgets.length > 0))
    .find(Boolean);
}

const formatPostDate = (post: CmsBlogPostSummary) => {
  const date = post.publishedAt ?? post.createdAt;
  return date ? new Date(date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";
};

function siteAbsoluteUrl(siteUrl: string, pathname: string) {
  return buildPublicUrl(siteUrl, pathname);
}

function safeDecodeBlogTopic(value?: string) {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cmsBlogCategoryPath(category: string) {
  return `/blog/category/${encodeURIComponent(category)}`;
}

function cmsBlogTagPath(tag: string) {
  return `/blog/tag/${encodeURIComponent(tag)}`;
}

function cmsBlogFilterPath(kind?: CmsBlogFilterKind, value?: string) {
  if (!kind || !value) return "/blog";
  return kind === "category" ? cmsBlogCategoryPath(value) : cmsBlogTagPath(value);
}

export function CmsBlogIndex({
  filterKind,
  filterValue,
}: {
  filterKind?: CmsBlogFilterKind;
  filterValue?: string;
} = {}) {
  const { data: blogPage } = useQuery<CmsPage | null>({
    queryKey: ["/api/cms/public/pages/blog"],
    retry: false,
    throwOnError: false,
  });
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const activeFilterValue = safeDecodeBlogTopic(filterValue).trim();
  const activeFilterLabel = activeFilterValue
    ? `${filterKind === "tag" ? "Tagged" : "Category"}: ${activeFilterValue}`
    : "";
  const blogPath = cmsBlogFilterPath(filterKind, activeFilterValue);
  const blogCanonicalUrl = safeCmsCanonicalUrl(
    filterKind ? undefined : blogPage?.seo.canonicalUrl,
    siteAbsoluteUrl(identity.siteUrl, blogPath),
  );
  const blogOgImage = safeCmsAssetUrl(blogPage?.seo.ogImage) || undefined;

  usePageMeta(
    activeFilterLabel
      ? `${activeFilterLabel} | Blog | ${identity.siteName}`
      : blogPage?.seo.metaTitle ?? `Blog | ${identity.siteName}`,
    activeFilterLabel
      ? `${activeFilterLabel} articles, project notes, and glass and door guidance from ${identity.siteName}.`
      : blogPage?.seo.metaDescription ?? blogPage?.excerpt ?? identity.description,
    {
      ogTitle: activeFilterLabel ? `${activeFilterLabel} | Blog` : blogPage?.seo.ogTitle,
      ogDescription: activeFilterLabel
        ? `${activeFilterLabel} articles from ${identity.siteName}.`
        : blogPage?.seo.ogDescription,
      ogImage: blogOgImage,
      canonicalUrl: blogCanonicalUrl,
      ogUrl: blogCanonicalUrl,
      noIndex: blogPage?.seo.noIndex,
    },
  );

  const { data: posts = [], isLoading } = useQuery<CmsBlogPostSummary[]>({
    queryKey: ["/api/cms/public/blog"],
    retry: false,
    throwOnError: false,
  });
  const blogSidebar = findBlogIndexSidebar(siteData.sidebars);
  const { categoryFilters, tagFilters } = useMemo(() => {
    const categories = new Set<string>();
    const tags = new Set<string>();
    posts.forEach((post) => {
      if (post.category) categories.add(post.category);
      post.tags.forEach((tag) => tags.add(tag));
    });
    return {
      categoryFilters: Array.from(categories).sort((a, b) => a.localeCompare(b)),
      tagFilters: Array.from(tags).sort((a, b) => a.localeCompare(b)),
    };
  }, [posts]);
  const visiblePosts = filterKind === "category" && activeFilterValue
    ? posts.filter((post) => post.category === activeFilterValue)
    : filterKind === "tag" && activeFilterValue
      ? posts.filter((post) => post.tags.includes(activeFilterValue))
      : posts;
  const blogSections = blogPage?.content.sections ?? [];
  const hasBlogSections = blogSections.length > 0;
  const shouldRenderStructuredData = !blogPage?.seo.noIndex;

  return (
    <Layout>
      {shouldRenderStructuredData && (
        <>
          <BreadcrumbSchema
            items={[
              { name: "Home", url: siteAbsoluteUrl(identity.siteUrl, "/") },
              { name: blogPage?.title ?? "Blog", url: siteAbsoluteUrl(identity.siteUrl, "/blog") },
              ...(activeFilterLabel ? [{ name: activeFilterLabel, url: blogCanonicalUrl }] : []),
            ]}
          />
          <WebPageSchema
            name={activeFilterLabel || blogPage?.seo.ogTitle || blogPage?.seo.metaTitle || blogPage?.title || "Blog"}
            description={
              activeFilterLabel
                ? `${activeFilterLabel} articles from ${identity.siteName}.`
                : blogPage?.seo.metaDescription ?? blogPage?.excerpt ?? identity.description
            }
            url={blogCanonicalUrl}
          />
        </>
      )}
      {hasBlogSections ? (
        blogSections.map((block, index) => (
          <CmsAnchoredBlock key={block.id ?? `${block.type}-${index}`} block={block} />
        ))
      ) : (
        <section className="bg-slate-900 px-4 py-16 text-white">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">{identity.siteName}</p>
            <h1 className="mt-3 text-4xl font-bold md:text-5xl" style={cmsTypeStyle("h1", "3rem")}>
              {activeFilterLabel || blogPage?.title || "Blog"}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-200" style={cmsTypeStyle("body", "1rem")}>
              {blogPage?.excerpt ?? "Project updates, maintenance guidance, and practical ideas for better glass, windows, showers, and doors."}
            </p>
          </div>
        </section>
      )}

      <section className="px-4 py-14">
        <div className="mx-auto max-w-5xl">
          {isLoading && <p className="text-sm text-muted-foreground">Loading posts...</p>}

          {!isLoading && posts.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold" style={cmsTypeStyle("h2", "2rem")}>No posts published yet</h2>
                <p className="mx-auto mt-2 max-w-xl text-muted-foreground" style={cmsTypeStyle("body", "1rem")}>
                  Published blog posts from the CMS will appear here as the content migration continues.
                </p>
                <Button asChild className="mt-5">
                  <Link href="/contact">Request a Quote</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <div className={blogSidebar?.widgets.length ? "grid gap-8 lg:grid-cols-[1fr_320px]" : ""}>
            <div className="space-y-5">
              {(categoryFilters.length > 0 || tagFilters.length > 0) && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant={!filterKind ? "default" : "outline"} size="sm">
                      <Link href="/blog">All</Link>
                    </Button>
                    {categoryFilters.map((category) => (
                      <Button
                        key={category}
                        asChild
                        variant={filterKind === "category" && activeFilterValue === category ? "default" : "outline"}
                        size="sm"
                      >
                        <Link href={cmsBlogCategoryPath(category)}>{category}</Link>
                      </Button>
                    ))}
                  </div>
                  {tagFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tagFilters.map((tag) => (
                        <Button
                          key={tag}
                          asChild
                          variant={filterKind === "tag" && activeFilterValue === tag ? "default" : "outline"}
                          size="sm"
                        >
                          <Link href={cmsBlogTagPath(tag)}>#{tag}</Link>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-5 md:grid-cols-2">
              {visiblePosts.map((post) => {
                const imageUrl = post.featuredImage?.mimeType.startsWith("image/")
                  ? safeCmsAssetUrl(post.featuredImage.url)
                  : "";
                const image = imageUrl ? post.featuredImage : null;
                return (
                  <Card key={post.id} className="overflow-hidden">
                    {image && (
                      <Link href={`/blog/${encodeURIComponent(post.slug)}`} className="block bg-slate-100">
                        <img
                          src={imageUrl}
                          alt={image.altText ?? post.title}
                          className="h-56 w-full object-cover"
                        />
                      </Link>
                    )}
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {post.category && (
                          <Link href={cmsBlogCategoryPath(post.category)}>
                            <Badge variant="secondary" className="transition hover:bg-primary hover:text-primary-foreground">{post.category}</Badge>
                          </Link>
                        )}
                        <span>{formatPostDate(post)}</span>
                      </div>
                      <h2 className="mt-3 text-2xl font-bold leading-tight" style={cmsTypeStyle("h2", "2rem")}>
                        <Link href={`/blog/${encodeURIComponent(post.slug)}`} className="hover:text-primary">
                          {post.title}
                        </Link>
                      </h2>
                      {post.excerpt && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground" style={cmsTypeStyle("small", "0.875rem")}>{post.excerpt}</p>}
                      {post.tags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {post.tags.map((tag) => (
                            <Link key={tag} href={cmsBlogTagPath(tag)}>
                              <Badge variant="outline" className="transition hover:border-primary hover:text-primary">#{tag}</Badge>
                            </Link>
                          ))}
                        </div>
                      )}
                      <Button asChild variant="outline" className="mt-5">
                        <Link href={`/blog/${encodeURIComponent(post.slug)}`}>Read Post</Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              </div>
              {!isLoading && posts.length > 0 && visiblePosts.length === 0 && (
                <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
                  No posts match this filter.
                </p>
              )}
            </div>
            {blogSidebar?.widgets.length ? <CmsWidgetStack widgets={blogSidebar.widgets} /> : null}
          </div>
        </div>
      </section>
    </Layout>
  );
}
