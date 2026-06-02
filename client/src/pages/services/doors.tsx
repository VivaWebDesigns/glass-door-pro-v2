import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { BreadcrumbSchema, ServiceSchema } from "@/components/structured-data";
import { QuoteCtaButton } from "@/components/quote-cta-button";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import { Check, Phone } from "lucide-react";
import doorService from "@/assets/images/door-service.webp";

export default function DoorsPage() {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const { phone, phoneHref } = siteData;
  const homeUrl = buildPublicUrl(identity.siteUrl);
  const servicesUrl = buildPublicUrl(identity.siteUrl, "/services");
  const serviceUrl = buildPublicUrl(identity.siteUrl, "/services/doors");

  usePageMeta(
    `Professional Door Installation | ${identity.siteName}`,
    `Exterior, patio, and interior door installation from ${identity.siteName}. Call ${phone} to request a door quote.`,
    { canonicalUrl: serviceUrl, ogUrl: serviceUrl },
  );

  return (
    <Layout>
      <ServiceSchema
        name="Professional Door Installation"
        description={`Exterior, patio, and interior door installation from ${identity.siteName}.`}
        url={serviceUrl}
      />
      <BreadcrumbSchema items={[
        { name: "Home", url: homeUrl },
        { name: "Services", url: servicesUrl },
        { name: "Professional Door Installation", url: serviceUrl },
      ]} />
       <section className="relative h-[400px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-slate-900/60 z-10" />
          <img 
            src={doorService} 
            alt="Door Installation" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative z-20 text-center text-white p-4">
          <h1 className="text-4xl md:text-6xl font-heading font-bold mb-4">Professional Door Installation</h1>
          <p className="text-xl max-w-2xl mx-auto text-white/90">
            Make a grand entrance with high-quality exterior and interior doors.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-heading font-bold mb-6 text-primary">Security meets Style</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Your front door is the first thing people see. It needs to be beautiful, but it also needs to be secure and durable against the elements. We provide expert installation of entry doors, patio doors, and interior doors.
              </p>
              
              <div className="space-y-6">
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="text-xl font-bold mb-2">Entry Doors</h3>
                  <p className="text-muted-foreground">Fiberglass, steel, and wood options that provide superior security and insulation.</p>
                </div>
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="text-xl font-bold mb-2">Patio Doors</h3>
                  <p className="text-muted-foreground">Sliding glass doors and French doors that connect your indoor and outdoor living spaces seamlessly.</p>
                </div>
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="text-xl font-bold mb-2">Interior Glass Doors</h3>
                  <p className="text-muted-foreground">Frosted glass office doors, pantry doors, and closet doors for a modern touch.</p>
                </div>
              </div>
              
               <div className="mt-8 flex flex-wrap gap-3">
                <QuoteCtaButton label="Get a Door Quote" />
                <Button size="lg" variant="outline" asChild>
                  <a href={phoneHref}>
                    <Phone className="mr-2 h-5 w-5" />
                    Call {phone}
                  </a>
                </Button>
              </div>
            </div>
             <div className="bg-muted rounded-xl overflow-hidden h-full min-h-[400px]">
               <img src={doorService} alt="Modern entry door" className="w-full h-full object-cover" />
             </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
