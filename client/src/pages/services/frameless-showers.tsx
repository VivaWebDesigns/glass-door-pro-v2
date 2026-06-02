import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { CheckCircle, Phone, Sparkles, Shield, Droplets, Clock } from "lucide-react";
import { QuoteCtaButton } from "@/components/quote-cta-button";
import { ServiceSchema, BreadcrumbSchema } from "@/components/structured-data";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import galleryShower1_640 from "@/assets/images/gallery-shower1-640w.webp";
import galleryShower1_960 from "@/assets/images/gallery-shower1-960w.webp";
import galleryShower1_1280 from "@/assets/images/gallery-shower1-1280w.webp";
import galleryShower1_1280jpg from "@/assets/images/gallery-shower1-1280w.jpg";
import galleryShower2_640 from "@/assets/images/gallery-shower2-640w.webp";
import galleryShower2_960 from "@/assets/images/gallery-shower2-960w.webp";
import galleryShower2_1280 from "@/assets/images/gallery-shower2-1280w.webp";
import galleryShower2_1280jpg from "@/assets/images/gallery-shower2-1280w.jpg";
import framelessParallax from "@/assets/images/frameless-parallax.webp";

export default function FramelessShowers() {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const { phone, phoneHref } = siteData;
  const homeUrl = buildPublicUrl(identity.siteUrl);
  const servicesUrl = buildPublicUrl(identity.siteUrl, "/#services");
  const serviceUrl = buildPublicUrl(identity.siteUrl, "/services/frameless-showers");

  usePageMeta(
    `Frameless Shower Doors | ${identity.market} | ${identity.siteName}`,
    `Custom frameless glass shower door installation in ${identity.market}. Precision-measured tempered safety glass with premium hardware. Over 15 years of experience. Call ${phone}.`,
    { canonicalUrl: serviceUrl, ogUrl: serviceUrl },
  );

  return (
    <Layout>
      <ServiceSchema
        name="Frameless Glass Shower Door Installation"
        description={`Custom frameless glass shower enclosures installed by ${identity.siteName} in ${identity.market}. Precision-measured, custom-cut tempered safety glass with premium hardware.`}
        url={serviceUrl}
      />
      <BreadcrumbSchema items={[
        { name: "Home", url: homeUrl },
        { name: "Services", url: servicesUrl },
        { name: "Frameless Showers", url: serviceUrl },
      ]} />
      {/* Desktop-only hero styles */}
      <style>{`
        @media (min-width: 1024px) {
          .shower-hero {
            background-position: center 25% !important;
            min-height: 70vh;
            max-height: 760px;
          }
        }
        @media (min-width: 1440px) {
          .shower-hero {
            background-position: center 15% !important;
          }
        }
      `}</style>
      
      {/* Parallax Hero Section */}
      <section 
        className="shower-hero relative min-h-[70vh] flex items-center lg:items-start bg-cover bg-center bg-scroll lg:bg-fixed"
        style={{ backgroundImage: `url(${framelessParallax})` }}
      >
        {/* Mobile-only gradient overlay for text readability */}
        <div 
          className="absolute inset-0 pointer-events-none lg:hidden"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.15) 100%)' }}
        />
        {/* Desktop overlay */}
        <div className="absolute inset-0 bg-black/20 hidden lg:block pointer-events-none" />
        
        <div className="container mx-auto px-6 lg:px-4 relative z-10 py-12 lg:pt-32 lg:pb-12">
          <div className="max-w-3xl lg:max-w-[600px]">
            <h1 
              className="text-3xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 md:mb-6 text-white"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
            >
              Frameless Glass Shower Doors
            </h1>
            <p 
              className="text-base md:text-xl text-white mb-6 md:mb-8 leading-[1.6] md:leading-relaxed font-medium md:font-normal"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
            >
              Transform your bathroom into a luxurious spa-like retreat with custom frameless glass shower enclosures. Serving Charlotte, NC and surrounding areas with over 15 years of expert installation experience.
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

      {/* Benefits Section */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Why Choose Frameless Shower Doors?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Modern Elegance</h3>
                <p className="text-muted-foreground">
                  Frameless designs create a sleek, open feel that makes your bathroom appear larger and more luxurious.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Premium Quality</h3>
                <p className="text-muted-foreground">
                  We use thick tempered safety glass and high-quality hardware that's built to last for decades.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Droplets className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Easy to Clean</h3>
                <p className="text-muted-foreground">
                  No metal frames means fewer places for mold and mildew to hide. Simply wipe and go.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Custom Fit</h3>
                <p className="text-muted-foreground">
                  Every installation is precision-measured and custom-cut to perfectly fit your unique bathroom space.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Clock className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Increases Home Value</h3>
                <p className="text-muted-foreground">
                  A beautiful frameless shower is a sought-after feature that adds real value to your home.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Professional Installation</h3>
                <p className="text-muted-foreground">
                  Doug personally handles every installation with meticulous attention to detail and craftsmanship.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Our Frameless Shower Work
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${galleryShower1_640} 640w, ${galleryShower1_960} 960w, ${galleryShower1_1280} 1280w`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <img 
                  src={galleryShower1_1280jpg} 
                  alt="Custom frameless glass shower enclosure installed by Glass & Door Pro in a Charlotte, NC area home" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${galleryShower2_640} 640w, ${galleryShower2_960} 960w, ${galleryShower2_1280} 1280w`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <img 
                  src={galleryShower2_1280jpg} 
                  alt="Modern frameless shower door with gold hardware fixtures installed in Monroe, NC" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Our Simple Process
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">1</div>
              <h3 className="text-xl font-bold mb-2">Free Consultation</h3>
              <p className="text-muted-foreground">Contact us and we'll schedule a convenient time to discuss your vision.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">2</div>
              <h3 className="text-xl font-bold mb-2">Precise Measurement</h3>
              <p className="text-muted-foreground">We take detailed measurements to ensure a perfect custom fit.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">3</div>
              <h3 className="text-xl font-bold mb-2">Custom Fabrication</h3>
              <p className="text-muted-foreground">Your glass is precision-cut and edges polished to perfection.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">4</div>
              <h3 className="text-xl font-bold mb-2">Expert Installation</h3>
              <p className="text-muted-foreground">Professional installation with attention to every detail.</p>
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
              <h3 className="text-lg font-bold mb-2">How long does installation take?</h3>
              <p className="text-muted-foreground">Most frameless shower installations are completed in 2-4 hours, depending on the complexity of your design.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">What thickness of glass do you use?</h3>
              <p className="text-muted-foreground">We typically use 3/8" or 1/2" thick tempered safety glass, which provides excellent durability and a premium look.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">Do you offer different hardware finishes?</h3>
              <p className="text-muted-foreground">Yes! We offer chrome, brushed nickel, oil-rubbed bronze, matte black, gold, and other finishes to match your bathroom.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">How do I maintain my frameless shower?</h3>
              <p className="text-muted-foreground">Simply squeegee after each use and clean weekly with a non-abrasive glass cleaner. We can also apply protective coatings.</p>
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
            <a href="/services/window-installation" className="text-primary hover:underline">window installation</a>,{" "}
            <a href="/services/window-repair" className="text-primary hover:underline">window repair</a>,{" "}
            <a href="/services/door-installation" className="text-primary hover:underline">door installation</a>, and{" "}
            <a href="/services/commercial-glass" className="text-primary hover:underline">commercial glass</a>{" "}
            throughout the Charlotte metro area.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Ready to Transform Your Bathroom?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Get a free quote for your custom frameless shower installation today. We're ready to help you create the bathroom of your dreams.
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
