import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { BreadcrumbSchema, ServiceSchema } from "@/components/structured-data";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import { Check, Phone } from "lucide-react";
import { QuoteCtaButton } from "@/components/quote-cta-button";
import showerHero from "@/assets/images/shower-hero.webp";

export default function ShowersPage() {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const { phone, phoneHref } = siteData;
  const homeUrl = buildPublicUrl(identity.siteUrl);
  const servicesUrl = buildPublicUrl(identity.siteUrl, "/services");
  const serviceUrl = buildPublicUrl(identity.siteUrl, "/services/showers");

  usePageMeta(
    `Frameless Glass Showers | ${identity.siteName}`,
    `Custom-cut frameless shower glass and heavy glass enclosures from ${identity.siteName}. Call ${phone} to request a shower quote.`,
    { canonicalUrl: serviceUrl, ogUrl: serviceUrl },
  );

  return (
    <Layout>
      <ServiceSchema
        name="Frameless Glass Showers"
        description={`Custom-cut frameless shower glass and heavy glass enclosures from ${identity.siteName}.`}
        url={serviceUrl}
      />
      <BreadcrumbSchema items={[
        { name: "Home", url: homeUrl },
        { name: "Services", url: servicesUrl },
        { name: "Frameless Glass Showers", url: serviceUrl },
      ]} />
       <section className="relative h-[400px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-slate-900/60 z-10" />
          <img 
            src={showerHero} 
            alt="Custom Frameless Glass Shower" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative z-20 text-center text-white p-4">
          <h1 className="text-4xl md:text-6xl font-heading font-bold mb-4">Frameless Glass Showers</h1>
          <p className="text-xl max-w-2xl mx-auto text-white/90">
            Elevate your bathroom with custom-cut, heavy glass enclosures.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-heading font-bold mb-6 text-primary">The Standard of Luxury</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Frameless glass shower doors are the hallmark of a modern, luxury bathroom. Without bulky metal frames to collect grime and block light, your shower becomes an open, airy showcase of your tile work.
              </p>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                At {identity.siteName}, we specialize in 3/8" and 1/2" heavy tempered glass enclosures. Each piece is custom-measured and cut to fit your specific opening, ensuring a perfect seal and a stunning look.
              </p>
              
              <h3 className="text-xl font-bold mb-4 mt-8">Our Capabilities</h3>
              <ul className="space-y-3">
                {[
                  "Custom Frameless Enclosures",
                  "Sliding Glass Barn Doors",
                  "Steam Shower Enclosures",
                  "Inline Door and Panel",
                  "Corner Showers (90° and Neo-Angle)",
                  "Variety of Hardware Finishes (Chrome, Brushed Nickel, Matte Black, Oil Rubbed Bronze)"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="bg-primary/10 p-1 rounded-full">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-muted rounded-xl p-8 flex flex-col justify-center">
              <h3 className="text-2xl font-bold mb-4">Why Go Frameless?</h3>
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-lg mb-2">Easier Maintenance</h4>
                  <p className="text-muted-foreground text-sm">No metal tracks at the bottom means no place for mold and mildew to hide. A simple squeegee is all you need.</p>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Visual Space</h4>
                  <p className="text-muted-foreground text-sm">Clear glass makes your bathroom feel larger and showcases beautiful tile work rather than hiding it.</p>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">Increased Home Value</h4>
                  <p className="text-muted-foreground text-sm">Bathroom remodels offer some of the highest ROIs, and a frameless shower is a top wish-list item for buyers in Charlotte.</p>
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-border">
                <div className="grid gap-3 sm:grid-cols-2">
                  <QuoteCtaButton label="Request a Shower Quote" className="w-full text-lg py-6" />
                  <Button asChild variant="outline" className="w-full text-lg py-6">
                    <a href={phoneHref}>
                      <Phone className="mr-2 h-5 w-5" />
                      Call {phone}
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
