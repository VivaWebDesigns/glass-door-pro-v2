import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "wouter";
import Layout from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CmsPreviewUnavailable, cmsTypeStyle } from "@/components/cms-page-route";
import { CmsRichText } from "@/components/cms-rich-text";
import { CmsWidgetStack } from "@/components/cms-widgets";
import { BlogPostingSchema, BreadcrumbSchema } from "@/components/structured-data";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import { safeCmsAssetUrl, safeCmsCanonicalUrl } from "@/lib/cms-safety";
import type { CmsBlogPost, CmsMedia, CmsSidebar } from "@shared/schema";

type CmsBlogPostResponse = CmsBlogPost & {
  featuredImage?: CmsMedia | null;
};

function siteAbsoluteUrl(siteUrl: string, pathname: string) {
  return buildPublicUrl(siteUrl, pathname);
}

function cmsBlogPostPath(slug: string) {
  return `/blog/${encodeURIComponent(slug)}`;
}

function cmsBlogCategoryPath(category: string) {
  return `/blog/category/${encodeURIComponent(category)}`;
}

function cmsBlogTagPath(tag: string) {
  return `/blog/tag/${encodeURIComponent(tag)}`;
}

function cmsBlogPostCanonicalUrl(post: CmsBlogPostResponse, siteUrl: string) {
  return safeCmsCanonicalUrl(post.seo.canonicalUrl, siteAbsoluteUrl(siteUrl, cmsBlogPostPath(post.slug)));
}

function findBlogPostSidebar(sidebars: CmsSidebar[] = [], post: CmsBlogPostResponse) {
  const locations = [`blog:${post.slug}`, `post:${post.slug}`, cmsBlogPostPath(post.slug), "blogPost", "blog", "default"];
  return locations
    .map((location) => sidebars.find((sidebar) => sidebar.location === location && sidebar.widgets.length > 0))
    .find(Boolean);
}

function relatedPostScore(post: CmsBlogPostResponse, candidate: CmsBlogPostResponse) {
  const categoryScore = post.category && post.category === candidate.category ? 3 : 0;
  const tagScore = candidate.tags.filter((tag) => post.tags.includes(tag)).length;
  return categoryScore + tagScore;
}

function CmsBlogPostView({ post, preview = false }: { post: CmsBlogPostResponse; preview?: boolean }) {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const imageUrl = post.featuredImage?.mimeType.startsWith("image/")
    ? safeCmsAssetUrl(post.featuredImage.url)
    : "";
  const image = imageUrl
    ? post.featuredImage
    : null;
  const seoOgImage = safeCmsAssetUrl(post.seo.ogImage) || undefined;
  const postOgImage = seoOgImage || imageUrl || undefined;
  const canonicalUrl = cmsBlogPostCanonicalUrl(post, identity.siteUrl);

  usePageMeta(
    post.seo.metaTitle ?? `${post.title} | ${identity.siteName}`,
    post.seo.metaDescription ?? post.excerpt ?? `${identity.siteName} blog post`,
    {
      ogTitle: post.seo.ogTitle,
      ogDescription: post.seo.ogDescription,
      ogImage: postOgImage,
      ogType: "article",
      canonicalUrl: preview ? undefined : canonicalUrl,
      ogUrl: preview ? undefined : canonicalUrl,
      noIndex: preview || post.seo.noIndex,
    },
  );

  const blogSidebar = findBlogPostSidebar(siteData.sidebars, post);
  const publishedAt = new Date(post.publishedAt ?? post.createdAt).toISOString();
  const updatedAt = new Date(post.updatedAt).toISOString();
  const shouldRenderStructuredData = !preview && !post.seo.noIndex;
  const hasBody = post.body.trim().length > 0;
  const { data: posts = [] } = useQuery<CmsBlogPostResponse[]>({
    queryKey: ["/api/cms/public/blog"],
    retry: false,
    throwOnError: false,
  });
  const relatedPosts = posts
    .filter((candidate) => candidate.id !== post.id)
    .map((candidate) => ({ post: candidate, score: relatedPostScore(post, candidate) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((candidate) => candidate.post);

  return (
    <Layout>
      {shouldRenderStructuredData && (
        <BreadcrumbSchema
          items={[
            { name: "Home", url: siteAbsoluteUrl(identity.siteUrl, "/") },
            { name: "Blog", url: siteAbsoluteUrl(identity.siteUrl, "/blog") },
            { name: post.title, url: canonicalUrl },
          ]}
        />
      )}
      {shouldRenderStructuredData && (
        <BlogPostingSchema
          title={post.title}
          description={post.seo.metaDescription ?? post.excerpt}
          url={canonicalUrl}
          image={postOgImage}
          datePublished={publishedAt}
          dateModified={updatedAt}
        />
      )}
      <article className="bg-white">
        <header className="bg-slate-900 px-4 py-16 text-white">
          <div className="mx-auto max-w-3xl">
            {post.category && (
              <Link
                href={cmsBlogCategoryPath(post.category)}
                className="mb-3 inline-block text-sm font-semibold uppercase tracking-wider text-primary transition hover:text-white"
              >
                {post.category}
              </Link>
            )}
            <h1 className="text-4xl font-bold leading-tight md:text-5xl" style={cmsTypeStyle("h1", "3rem")}>{post.title}</h1>
            {post.excerpt && <p className="mt-5 text-lg text-slate-200" style={cmsTypeStyle("body", "1rem")}>{post.excerpt}</p>}
            {post.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link key={tag} href={cmsBlogTagPath(tag)}>
                    <Badge variant="secondary" className="transition hover:bg-white hover:text-slate-950">#{tag}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>
        {image && (
          <figure className="bg-slate-100">
            <div className="mx-auto max-w-5xl px-4 py-8">
              <img
                src={imageUrl}
                alt={image.altText ?? post.title}
                className="h-auto max-h-[560px] w-full rounded-md object-cover shadow-sm"
              />
              {image.caption && (
                <figcaption className="mt-3 text-sm text-slate-500">{image.caption}</figcaption>
              )}
            </div>
          </figure>
        )}
        <div className={blogSidebar?.widgets.length
          ? "mx-auto grid max-w-5xl gap-8 px-4 py-14 lg:grid-cols-[1fr_320px]"
          : "mx-auto max-w-3xl px-4 py-14"
        }>
          <div className="min-w-0">
            {hasBody ? (
              <CmsRichText body={post.body} />
            ) : preview ? (
              <Card>
                <CardContent className="space-y-4 p-6">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-primary">Blog Post Preview</p>
                    <h2 className="mt-2 text-2xl font-bold">Body Content Needed</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      This draft post can be previewed, but it does not have body content yet. Add article copy before publishing it to the public blog.
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/admin?tool=blog&record=${encodeURIComponent(post.id)}`}>Open Blog Editor</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            {relatedPosts.length > 0 && (
              <section className="mt-12 border-t pt-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold" style={cmsTypeStyle("h2", "2rem")}>Related Posts</h2>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/blog">View Blog</Link>
                  </Button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {relatedPosts.map((relatedPost) => (
                    <Card key={relatedPost.id} className="h-full">
                      <CardContent className="flex h-full flex-col p-4">
                        {relatedPost.category && <Badge variant="secondary" className="mb-3 w-fit">{relatedPost.category}</Badge>}
                        <h3 className="text-base font-bold leading-snug">
                          <Link href={cmsBlogPostPath(relatedPost.slug)} className="hover:text-primary">
                            {relatedPost.title}
                          </Link>
                        </h3>
                        {relatedPost.excerpt && <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">{relatedPost.excerpt}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
          {blogSidebar?.widgets.length ? <CmsWidgetStack widgets={blogSidebar.widgets} /> : null}
        </div>
      </article>
    </Layout>
  );
}

export function CmsBlogRoute({ slug, fallback }: { slug: string; fallback: ReactNode }) {
  const { data: post, isLoading } = useQuery<CmsBlogPostResponse | null>({
    queryKey: [`/api/cms/public/blog/${encodeURIComponent(slug)}`],
    retry: false,
    throwOnError: false,
  });

  if (post) {
    return <CmsBlogPostView post={post} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return <>{fallback}</>;
}

export function CmsBlogPreviewRoute({ id, fallback }: { id: string; fallback: ReactNode }) {
  const { data: post, isError, isLoading } = useQuery<CmsBlogPostResponse | null>({
    queryKey: [`/api/admin/cms/blogPosts/${encodeURIComponent(id)}/preview`],
    retry: false,
    throwOnError: false,
  });

  if (post) {
    return <CmsBlogPostView post={post} preview />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-muted-foreground">
        Loading preview...
      </div>
    );
  }

  if (isError) {
    return (
      <CmsPreviewUnavailable
        resourceLabel="blog post"
        editorHref={`/admin?tool=blog&record=${encodeURIComponent(id)}`}
      />
    );
  }

  return <>{fallback}</>;
}
