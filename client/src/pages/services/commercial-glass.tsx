import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { CheckCircle, Phone, Building2, Shield, Clock, Store, Layers, Settings } from "lucide-react";
import { QuoteCtaButton } from "@/components/quote-cta-button";
import { ServiceSchema, BreadcrumbSchema } from "@/components/structured-data";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import commercialInterior_640 from "@/assets/images/commercial-glass-interior-640w.webp";
import commercialInterior_960 from "@/assets/images/commercial-glass-interior-960w.webp";
import commercialInterior_1280 from "@/assets/images/commercial-glass-interior-1280w.webp";
import commercialInterior_1280jpg from "@/assets/images/commercial-glass-interior-1280w.jpg";
import hero640w from "@/assets/images/commercial-hero-640w.webp";
import hero960w from "@/assets/images/commercial-hero-960w.webp";
import hero1280w from "@/assets/images/commercial-hero-1280w.webp";
import hero1920w from "@/assets/images/commercial-hero-1920w.webp";
import hero1280wJpg from "@/assets/images/commercial-hero-1280w.jpg";

export default function CommercialGlass() {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const { phone, phoneHref } = siteData;
  const homeUrl = buildPublicUrl(identity.siteUrl);
  const servicesUrl = buildPublicUrl(identity.siteUrl, "/#services");
  const serviceUrl = buildPublicUrl(identity.siteUrl, "/services/commercial-glass");

  usePageMeta(
    `Commercial Glass Services | ${identity.market} | ${identity.siteName}`,
    `Professional commercial glass installation, repair, and replacement in ${identity.market}. Storefronts, office partitions, security glass, and emergency repairs. Call ${phone}.`,
    { canonicalUrl: serviceUrl, ogUrl: serviceUrl },
  );

  return (
    <Layout>
      <ServiceSchema
        name="Commercial Glass Services"
        description={`Professional commercial glass installation, repair, and replacement by ${identity.siteName} in ${identity.market}. Storefronts, office partitions, curtain walls, security glass, and emergency repairs for businesses.`}
        url={serviceUrl}
      />
      <BreadcrumbSchema items={[
        { name: "Home", url: homeUrl },
        { name: "Services", url: servicesUrl },
        { name: "Commercial Glass", url: serviceUrl },
      ]} />
      {/* Desktop-only hero styles */}
      <style>{`
        @media (min-width: 1024px) {
          .commercial-hero {
            background-position: center 25% !important;
            min-height: 70vh;
            max-height: 760px;
          }
        }
        @media (min-width: 1440px) {
          .commercial-hero {
            background-position: center 20% !important;
          }
        }
      `}</style>
      
      {/* Parallax Hero Section */}
      <section 
        className="commercial-hero relative min-h-[70vh] flex items-center lg:items-start overflow-hidden bg-cover bg-center bg-scroll lg:bg-fixed"
        style={{ backgroundImage: `url(${hero1920w})`, backgroundColor: '#1a1a1a' }}
      >
        {/* Mobile-only responsive image (replaces CSS background on small screens) */}
        <picture className="lg:hidden">
          <source
            type="image/webp"
            srcSet={`${hero640w} 640w, ${hero960w} 960w, ${hero1280w} 1280w`}
            sizes="100vw"
          />
          <img
            src={hero1280wJpg}
            alt="Commercial glass storefront and office building served by Glass & Door Pro in Charlotte, NC"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: 'center center' }}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </picture>
        
        {/* Mobile-only gradient overlay for text readability */}
        <div 
          className="absolute inset-0 pointer-events-none lg:hidden z-[1]"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)' }}
        />
        {/* Desktop overlay */}
        <div className="absolute inset-0 bg-black/25 hidden lg:block pointer-events-none" />
        
        <div className="container mx-auto px-6 lg:px-4 relative z-10 pt-28 pb-12 lg:pt-32 lg:pb-12">
          <div className="max-w-xl lg:max-w-[600px]">
            <h1 
              className="text-3xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 md:mb-6 text-white"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
            >
              Commercial Glass Services
            </h1>
            <p 
              className="text-base md:text-xl text-white mb-6 md:mb-8 leading-[1.6] md:leading-relaxed font-medium md:font-normal"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
            >
              Professional commercial glass installation, repair, and replacement for Charlotte-area businesses. From storefronts to office buildings, we deliver quality solutions that enhance your business image and security.
            </p>
            <div className="flex flex-wrap gap-4 relative z-20">
              <QuoteCtaButton label="Request a Quote" data-testid="button-hero-quote" />
              <Button size="lg" variant="outline" className="text-lg px-8 h-12 border-white text-white hover:bg-white hover:text-primary" asChild>
                <a href={phoneHref}>
                  <Phone className="mr-2 h-5 w-5" /> Call {phone}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
              Commercial Glass Solutions for Your Business
            </h2>
            <p className="text-lg text-muted-foreground">
              Whether you need a new storefront, emergency glass repair, or custom commercial installations, Glass & Door Pro delivers reliable, professional service to businesses throughout the Greater Charlotte area. We understand that your business can't wait—that's why we prioritize quick response times and minimal disruption to your operations.
            </p>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Our Commercial Glass Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Store className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Storefront Glass</h3>
                <p className="text-muted-foreground">
                  Custom storefront installations and replacements that showcase your business and attract customers.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Office Glass Partitions</h3>
                <p className="text-muted-foreground">
                  Modern glass partitions and dividers that create open, professional workspaces while maintaining privacy.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Layers className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Curtain Wall Systems</h3>
                <p className="text-muted-foreground">
                  Large-scale glass facade installations for commercial buildings that maximize natural light.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Security Glass</h3>
                <p className="text-muted-foreground">
                  Tempered, laminated, and impact-resistant glass options to protect your business and assets.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Settings className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Emergency Repairs</h3>
                <p className="text-muted-foreground">
                  Fast response for broken storefronts, vandalism damage, and urgent commercial glass repairs.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Glass Doors</h3>
                <p className="text-muted-foreground">
                  Commercial entrance doors, automatic doors, and interior glass doors for professional spaces.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Commercial Glass Projects
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${commercialInterior_640} 640w, ${commercialInterior_960} 960w, ${commercialInterior_1280} 1280w`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <img 
                  src={commercialInterior_1280jpg} 
                  alt="Modern commercial glass partitions and office interior installed by Glass & Door Pro in Charlotte, NC" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
              <img 
                src={hero1280wJpg} 
                alt="Commercial glass entrance doors installed by Glass & Door Pro in a Charlotte metro area building" 
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-16 md:py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            How We Work
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">1</div>
              <h3 className="text-xl font-bold mb-2">Site Assessment</h3>
              <p className="text-muted-foreground">We visit your location to evaluate your commercial glass needs and take precise measurements.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">2</div>
              <h3 className="text-xl font-bold mb-2">Custom Quote</h3>
              <p className="text-muted-foreground">Receive a detailed, transparent quote with options tailored to your budget and timeline.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">3</div>
              <h3 className="text-xl font-bold mb-2">Professional Install</h3>
              <p className="text-muted-foreground">Our team completes the installation with minimal disruption to your business operations.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">4</div>
              <h3 className="text-xl font-bold mb-2">Final Walkthrough</h3>
              <p className="text-muted-foreground">We ensure everything meets your expectations and clean up completely before leaving.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Why Charlotte Businesses Choose Us
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Fast Response</h3>
              <p className="text-muted-foreground">We understand business urgency and respond quickly to minimize your downtime.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Licensed & Insured</h3>
              <p className="text-muted-foreground">Full liability coverage protects your business during every installation.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Local Experience</h3>
              <p className="text-muted-foreground">15+ years serving Charlotte-area businesses with quality commercial glass work.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Quality Materials</h3>
              <p className="text-muted-foreground">We use premium commercial-grade glass and hardware built to last.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">What types of commercial properties do you serve?</h3>
              <p className="text-muted-foreground">We serve retail stores, restaurants, office buildings, medical facilities, warehouses, and all types of commercial properties in the Charlotte area.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">Do you offer emergency board-up services?</h3>
              <p className="text-muted-foreground">Yes, we provide emergency board-up and temporary glazing services to secure your property until permanent repairs can be completed.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">Can you work after business hours?</h3>
              <p className="text-muted-foreground">Absolutely. We offer flexible scheduling including evenings and weekends to minimize disruption to your business operations.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">Do you handle insurance claims?</h3>
              <p className="text-muted-foreground">We can work with your insurance company and provide detailed documentation to help streamline your claim process.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">What areas do you serve?</h3>
              <p className="text-muted-foreground">We serve Charlotte, Matthews, Mint Hill, Monroe, Pineville, Huntersville, Cornelius, Davidson, Concord, Tega Cay, Waxhaw, Indian Trail, Stallings, Fort Mill, Rock Hill, and surrounding areas.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Service Areas */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-heading font-bold mb-6">Serving the Greater Charlotte Area</h2>
          <p className="text-muted-foreground max-w-3xl mx-auto">
            Charlotte • Matthews • Mint Hill • Monroe • Pineville • Huntersville • Cornelius • Davidson • Concord • Tega Cay • Waxhaw • Indian Trail • Stallings • Fort Mill • Rock Hill • and surrounding areas
          </p>
        </div>
      </section>

      {/* Related Services */}
      <section className="py-10">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-xl font-heading font-bold mb-4">Related Services</h3>
          <p className="text-muted-foreground max-w-3xl mx-auto">
            Glass and Door Pro also offers{" "}
            <a href="/services/frameless-showers" className="text-primary hover:underline">frameless shower installation</a>,{" "}
            <a href="/services/window-installation" className="text-primary hover:underline">window installation</a>,{" "}
            <a href="/services/window-repair" className="text-primary hover:underline">window repair</a>, and{" "}
            <a href="/services/door-installation" className="text-primary hover:underline">door installation</a>{" "}
            for residential clients throughout the Charlotte metro area.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Ready to Discuss Your Commercial Glass Project?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Get a free estimate for your commercial glass installation, repair, or replacement. We're ready to help your business look its best.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <QuoteCtaButton label="Get Your Free Estimate" variant="secondary" />
            <Button size="lg" variant="outline" className="text-lg px-8 h-12 border-white text-white hover:bg-white hover:text-primary" asChild>
              <Link href="/">
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
