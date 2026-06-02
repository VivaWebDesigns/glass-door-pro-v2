import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { CheckCircle, Phone, Shield, Lock, Home, Paintbrush, DoorOpen } from "lucide-react";
import { QuoteCtaButton } from "@/components/quote-cta-button";
import { ServiceSchema, BreadcrumbSchema } from "@/components/structured-data";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import galleryDoor1_640 from "@/assets/images/gallery-door1-640w.webp";
import galleryDoor1_960 from "@/assets/images/gallery-door1-960w.webp";
import galleryDoor1_1280 from "@/assets/images/gallery-door1-1280w.webp";
import galleryDoor1_1280jpg from "@/assets/images/gallery-door1-1280w.jpg";
import galleryDoor2_640 from "@/assets/images/gallery-door2-640w.webp";
import galleryDoor2_960 from "@/assets/images/gallery-door2-960w.webp";
import galleryDoor2_1280 from "@/assets/images/gallery-door2-1280w.webp";
import galleryDoor2_1280jpg from "@/assets/images/gallery-door2-1280w.jpg";
import galleryDoor3_640 from "@/assets/images/gallery-door3-640w.webp";
import galleryDoor3_960 from "@/assets/images/gallery-door3-960w.webp";
import galleryDoor3_1280 from "@/assets/images/gallery-door3-1280w.webp";
import galleryDoor3_1280jpg from "@/assets/images/gallery-door3-1280w.jpg";
import doorParallax from "@/assets/images/door-parallax.webp";

export default function DoorInstallation() {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const { phone, phoneHref } = siteData;
  const homeUrl = buildPublicUrl(identity.siteUrl);
  const servicesUrl = buildPublicUrl(identity.siteUrl, "/#services");
  const serviceUrl = buildPublicUrl(identity.siteUrl, "/services/door-installation");

  usePageMeta(
    `Door Installation | ${identity.market} | ${identity.siteName}`,
    `Expert door installation in ${identity.market}. Entry doors, French doors, patio doors, sliding glass doors, and storm doors. Call ${phone} for a free quote.`,
    { canonicalUrl: serviceUrl, ogUrl: serviceUrl },
  );

  return (
    <Layout>
      <ServiceSchema
        name="Door Installation Services"
        description={`Expert door installation by ${identity.siteName} in ${identity.market}. Entry doors, French doors, patio doors, sliding glass doors, and storm doors.`}
        url={serviceUrl}
      />
      <BreadcrumbSchema items={[
        { name: "Home", url: homeUrl },
        { name: "Services", url: servicesUrl },
        { name: "Door Installation", url: serviceUrl },
      ]} />
      {/* Desktop-only hero styles */}
      <style>{`
        @media (min-width: 1024px) {
          .door-hero {
            background-position: center 20% !important;
            min-height: 70vh;
            max-height: 760px;
          }
        }
        @media (min-width: 1440px) {
          .door-hero {
            background-position: center 15% !important;
          }
        }
      `}</style>
      
      {/* Parallax Hero Section */}
      <section 
        className="door-hero relative min-h-[70vh] flex items-center lg:items-start bg-cover bg-center bg-scroll lg:bg-fixed"
        style={{ backgroundImage: `url(${doorParallax})` }}
      >
        {/* Mobile-only gradient overlay for text readability */}
        <div 
          className="absolute inset-0 pointer-events-none lg:hidden"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)' }}
        />
        {/* Desktop overlay */}
        <div className="absolute inset-0 bg-black/30 hidden lg:block pointer-events-none" />
        
        <div className="container mx-auto px-6 lg:px-4 relative z-10 pt-28 pb-12 lg:pt-48 lg:pb-12">
          <div className="max-w-xl lg:max-w-[600px]">
            <h1 
              className="text-3xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 md:mb-6 text-white"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
            >
              Door Installation Services
            </h1>
            <p 
              className="text-base md:text-xl text-white mb-6 md:mb-8 leading-[1.6] md:leading-relaxed font-medium md:font-normal"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
            >
              From stunning entry doors to functional patio doors, we provide expert installation that enhances your home's security, energy efficiency, and curb appeal. Serving Charlotte, NC and surrounding areas.
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
            Why Upgrade Your Doors?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Lock className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Enhanced Security</h3>
                <p className="text-muted-foreground">
                  Modern doors feature advanced locking systems and reinforced frames that protect your family.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Energy Efficiency</h3>
                <p className="text-muted-foreground">
                  Insulated doors prevent drafts and heat loss, reducing your energy bills significantly.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Paintbrush className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Curb Appeal</h3>
                <p className="text-muted-foreground">
                  A beautiful entry door is one of the best investments for boosting your home's first impression.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Home className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Increased Home Value</h3>
                <p className="text-muted-foreground">
                  Quality door replacements offer one of the highest returns on investment in home improvement.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <DoorOpen className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Wide Selection</h3>
                <p className="text-muted-foreground">
                  Choose from entry doors, patio doors, French doors, sliding doors, and storm doors.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Professional Fit</h3>
                <p className="text-muted-foreground">
                  Proper installation ensures your door operates smoothly and seals correctly for years to come.
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
            Door Installation Gallery
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${galleryDoor1_640} 640w, ${galleryDoor1_960} 960w, ${galleryDoor1_1280} 1280w`}
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <img 
                  src={galleryDoor1_1280jpg} 
                  alt="Modern black entry door with glass panels installed by Glass & Door Pro in Charlotte, NC" 
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
                  srcSet={`${galleryDoor2_640} 640w, ${galleryDoor2_960} 960w, ${galleryDoor2_1280} 1280w`}
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <img 
                  src={galleryDoor2_1280jpg} 
                  alt="Elegant wooden front door with sidelights installed by Glass & Door Pro in Monroe, NC" 
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
                  srcSet={`${galleryDoor3_640} 640w, ${galleryDoor3_960} 960w, ${galleryDoor3_1280} 1280w`}
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <img 
                  src={galleryDoor3_1280jpg} 
                  alt="Charming blue entry door with window panes installed by Glass & Door Pro in Indian Trail, NC" 
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
            Our Installation Process
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">1</div>
              <h3 className="text-xl font-bold mb-2">Consultation</h3>
              <p className="text-muted-foreground">We assess your current doors and discuss style, material, and security options.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">2</div>
              <h3 className="text-xl font-bold mb-2">Selection</h3>
              <p className="text-muted-foreground">Choose from a wide variety of doors, hardware, and finishes to match your home.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">3</div>
              <h3 className="text-xl font-bold mb-2">Installation</h3>
              <p className="text-muted-foreground">Expert installation with proper shimming, sealing, and hardware adjustment.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">4</div>
              <h3 className="text-xl font-bold mb-2">Final Check</h3>
              <p className="text-muted-foreground">We ensure smooth operation, proper locks, and clean up the work area.</p>
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
              <h3 className="text-lg font-bold mb-2">What types of doors do you install?</h3>
              <p className="text-muted-foreground">We install entry doors, French doors, patio doors, sliding glass doors, storm doors, and interior doors in various materials.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">How long does door installation take?</h3>
              <p className="text-muted-foreground">Most single door installations are completed in 2-4 hours. Complex installations like French or patio doors may take longer.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">What door materials are available?</h3>
              <p className="text-muted-foreground">We offer fiberglass, steel, wood, and composite doors. Each has benefits for durability, insulation, and aesthetics.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">Do you install door hardware?</h3>
              <p className="text-muted-foreground">Yes, we install all hardware including handles, locks, deadbolts, hinges, and smart lock systems.</p>
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
            <a href="/services/commercial-glass" className="text-primary hover:underline">commercial glass</a>{" "}
            throughout the Charlotte metro area.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Ready for a New Door?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Get a free quote for your door installation project. We'll help you find the perfect door that enhances your home's beauty and security.
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
