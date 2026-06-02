import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Layout from "@/components/layout";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, usePublicBusinessIdentity } from "@/hooks/use-public-site";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  const identity = usePublicBusinessIdentity();
  const homeUrl = buildPublicUrl(identity.siteUrl);

  usePageMeta(
    `Page Not Found | ${identity.siteName}`,
    `This ${identity.siteName} page is not available yet.`,
    { canonicalUrl: homeUrl, ogUrl: homeUrl, noIndex: true },
  );

  return (
    <Layout>
      <section className="flex min-h-[60vh] w-full items-center justify-center bg-slate-50 px-4 py-16">
        <Card className="w-full max-w-lg">
          <CardContent className="space-y-5 pt-6">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-7 w-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-slate-950">Page Not Found</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This page is not available yet. It may still be waiting on a CMS page, menu link, or published route.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
