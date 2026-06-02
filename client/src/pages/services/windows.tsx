import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { BreadcrumbSchema, ServiceSchema } from "@/components/structured-data";
import { QuoteCtaButton } from "@/components/quote-cta-button";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import { Check, Phone } from "lucide-react";
import windowsService from "@/assets/images/windows-service.webp";

export default function WindowsPage() {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const { phone, phoneHref } = siteData;
  const homeUrl = buildPublicUrl(identity.siteUrl);
  const servicesUrl = buildPublicUrl(identity.siteUrl, "/services");
  const serviceUrl = buildPublicUrl(identity.siteUrl, "/services/windows");

  usePageMeta(
    `Residential Windows | ${identity.siteName}`,
    `Residential window replacement and professional installation from ${identity.siteName}. Call ${phone} to request a window quote.`,
    { canonicalUrl: serviceUrl, ogUrl: serviceUrl },
  );

  return (
    <Layout>
      <ServiceSchema
        name="Residential Windows"
        description={`Residential window replacement and professional installation from ${identity.siteName}.`}
        url={serviceUrl}
      />
      <BreadcrumbSchema items={[
        { name: "Home", url: homeUrl },
        { name: "Services", url: servicesUrl },
        { name: "Residential Windows", url: serviceUrl },
      ]} />
       <section className="relative h-[400px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-slate-900/60 z-10" />
          <img 
            src={windowsService} 
            alt="Residential Window Replacement" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative z-20 text-center text-white p-4">
          <h1 className="text-4xl md:text-6xl font-heading font-bold mb-4">Residential Windows</h1>
          <p className="text-xl max-w-2xl mx-auto text-white/90">
            Energy-efficient replacements and professional installation.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
             <div className="order-2 md:order-1">
               <img src={windowsService} alt="Modern window installation" className="rounded-xl shadow-lg w-full" />
             </div>
            <div className="order-1 md:order-2">
              <h2 className="text-3xl font-heading font-bold mb-6 text-primary">Clear Views, Better Efficiency</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Old, drafty windows are one of the biggest sources of energy loss in a home. Upgrading to modern, energy-efficient windows not only lowers your utility bills but also transforms the look of your home inside and out.
              </p>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                {identity.siteName} offers a wide selection of window styles to match your home's architecture, from traditional sash windows to modern picture windows.
              </p>
              
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                {[
                  "Double Hung Windows",
                  "Casement Windows",
                  "Picture Windows",
                  "Bay & Bow Windows",
                  "Slider Windows",
                  "Energy Star Rated Glass"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="bg-primary/10 p-1 rounded-full">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <QuoteCtaButton label="Get a Window Quote" />
                <Button size="lg" variant="outline" asChild>
                  <a href={phoneHref}>
                    <Phone className="mr-2 h-5 w-5" />
                    Call {phone}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

       {/* Process Section */}
       <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-heading font-bold mb-12">Our Installation Process</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <div className="h-12 w-12 bg-primary text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">1</div>
              <h3 className="text-xl font-bold mb-2">Consultation</h3>
              <p className="text-muted-foreground">We visit your home to measure and discuss styles, materials, and efficiency options.</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <div className="h-12 w-12 bg-primary text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">2</div>
              <h3 className="text-xl font-bold mb-2">Precision Installation</h3>
              <p className="text-muted-foreground">Our team removes old windows and installs new ones with minimal disruption to your home.</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <div className="h-12 w-12 bg-primary text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">3</div>
              <h3 className="text-xl font-bold mb-2">Final Inspection</h3>
              <p className="text-muted-foreground">We ensure everything operates smoothly, is sealed tight, and clean up the work area completely.</p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
