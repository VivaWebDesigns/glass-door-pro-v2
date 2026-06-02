import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { CheckCircle, Phone, Shield, Wrench, AlertTriangle, Clock, DollarSign, Home } from "lucide-react";
import { QuoteCtaButton } from "@/components/quote-cta-button";
import { ServiceSchema, BreadcrumbSchema } from "@/components/structured-data";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import windowRepairBroken_640 from "@/assets/images/window-repair-broken-640w.webp";
import windowRepairBroken_960 from "@/assets/images/window-repair-broken-960w.webp";
import windowRepairBroken_1280 from "@/assets/images/window-repair-broken-1280w.webp";
import windowRepairBroken_1280jpg from "@/assets/images/window-repair-broken-1280w.jpg";
import windowRepairLiving_640 from "@/assets/images/window-repair-living-640w.webp";
import windowRepairLiving_960 from "@/assets/images/window-repair-living-960w.webp";
import windowRepairLiving_1280 from "@/assets/images/window-repair-living-1280w.webp";
import windowRepairLiving_1280jpg from "@/assets/images/window-repair-living-1280w.jpg";
import windowRepairParallax from "@/assets/images/window-repair-parallax.webp";

export default function WindowRepair() {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const { phone, phoneHref } = siteData;
  const homeUrl = buildPublicUrl(identity.siteUrl);
  const servicesUrl = buildPublicUrl(identity.siteUrl, "/#services");
  const serviceUrl = buildPublicUrl(identity.siteUrl, "/services/window-repair");

  usePageMeta(
    `Window Repair | ${identity.market} | ${identity.siteName}`,
    `Fast, reliable window glass repair and replacement in ${identity.market}. Broken glass, foggy windows, seal failures, and storm damage repair. Same-week service. Call ${phone}.`,
    { canonicalUrl: serviceUrl, ogUrl: serviceUrl },
  );

  return (
    <Layout>
      <ServiceSchema
        name="Window Repair Services"
        description={`Fast, reliable window glass repair and replacement by ${identity.siteName} in ${identity.market}. Broken glass, foggy windows, seal failures, storm damage, and single pane upgrades.`}
        url={serviceUrl}
      />
      <BreadcrumbSchema items={[
        { name: "Home", url: homeUrl },
        { name: "Services", url: servicesUrl },
        { name: "Window Repair", url: serviceUrl },
      ]} />
      {/* Desktop-only hero styles */}
      <style>{`
        @media (min-width: 1024px) {
          .repair-hero {
            background-position: 70% 50% !important;
            min-height: 70vh;
            max-height: 760px;
          }
        }
        @media (min-width: 1440px) {
          .repair-hero {
            background-position: 65% 45% !important;
          }
        }
      `}</style>
      
      {/* Parallax Hero Section */}
      <section 
        className="repair-hero relative min-h-[70vh] flex items-center lg:items-start bg-cover bg-[right_center] bg-scroll lg:bg-fixed"
        style={{ backgroundImage: `url(${windowRepairParallax})` }}
      >
        {/* Mobile-only gradient overlay for text readability */}
        <div 
          className="absolute inset-0 pointer-events-none lg:hidden"
          style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.15) 100%)' }}
        />
        {/* Desktop overlay */}
        <div 
          className="absolute inset-0 hidden lg:block pointer-events-none"
          style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.10) 100%)' }}
        />
        
        <div className="container mx-auto px-6 lg:px-4 relative z-10 pt-28 pb-12 lg:pt-32 lg:pb-12">
          <div className="max-w-xl lg:max-w-[600px]">
            <h1 
              className="text-3xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 md:mb-6 text-white"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
            >
              Window Repair Services
            </h1>
            <p 
              className="text-base md:text-xl text-white mb-6 md:mb-8 leading-[1.6] md:leading-relaxed font-medium md:font-normal"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
            >
              Fast, reliable window glass repair and replacement for Charlotte-area homeowners. From foggy windows to broken panes, we restore your windows to like-new condition with expert craftsmanship.
            </p>
            <div className="flex flex-wrap gap-4 relative z-20">
              <QuoteCtaButton label="Get a Free Estimate" data-testid="button-hero-quote" />
              <Button size="lg" variant="outline" className="text-lg px-8 h-12 border-white text-white hover:bg-white hover:text-primary" asChild>
                <a href={phoneHref}>
                  <Phone className="mr-2 h-5 w-5" /> Call {phone}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Common Repair Issues */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Window Problems We Fix
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Broken Glass</h3>
                <p className="text-muted-foreground">
                  Cracked, shattered, or damaged window panes replaced quickly to restore safety and security to your home.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Foggy Windows</h3>
                <p className="text-muted-foreground">
                  Condensation between double-pane glass indicates a failed seal. We replace the insulated glass unit to restore clarity.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Wrench className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Seal Failure</h3>
                <p className="text-muted-foreground">
                  Drafty windows with failed weatherstripping or seals repaired to improve energy efficiency and comfort.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Home className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Storm Damage</h3>
                <p className="text-muted-foreground">
                  Emergency repairs for windows damaged by storms, hail, or flying debris. Fast response to secure your home.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <DollarSign className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Single Pane Upgrade</h3>
                <p className="text-muted-foreground">
                  Upgrade old single-pane windows to energy-efficient double-pane glass without replacing the entire window.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Glass-Only Replacement</h3>
                <p className="text-muted-foreground">
                  Save money by replacing just the glass instead of the entire window unit. Perfect for older windows in good condition.
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
            Window Repair Projects
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${windowRepairBroken_640} 640w, ${windowRepairBroken_960} 960w, ${windowRepairBroken_1280} 1280w`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <img 
                  src={windowRepairBroken_1280jpg} 
                  alt="Broken residential window glass needing repair by Glass & Door Pro in the Charlotte, NC metro area" 
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
                  srcSet={`${windowRepairLiving_640} 640w, ${windowRepairLiving_960} 960w, ${windowRepairLiving_1280} 1280w`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <img 
                  src={windowRepairLiving_1280jpg} 
                  alt="Beautiful living room with professionally repaired windows by Glass & Door Pro in Monroe, NC" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Why Choose Us for Window Repair
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Fast Response</h3>
              <p className="text-muted-foreground">Quick scheduling and same-week service for most repairs in the Charlotte area.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Affordable Pricing</h3>
              <p className="text-muted-foreground">Fair, upfront pricing with no hidden fees. Free estimates on all repairs.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Quality Materials</h3>
              <p className="text-muted-foreground">We use premium glass and materials that meet or exceed industry standards.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">15+ Years Experience</h3>
              <p className="text-muted-foreground">Trusted expertise from a local professional who takes pride in every job.</p>
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
              <h3 className="text-lg font-bold mb-2">How much does window repair cost?</h3>
              <p className="text-muted-foreground">Costs vary depending on window size, glass type, and repair complexity. We provide free estimates so you know the exact cost before we begin.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">Can you repair just the glass without replacing the whole window?</h3>
              <p className="text-muted-foreground">Yes! In many cases, we can replace just the glass pane or insulated glass unit, saving you money compared to full window replacement.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">How long does window repair take?</h3>
              <p className="text-muted-foreground">Most single-window repairs are completed in under an hour. Larger projects or custom glass may require 1-2 days for fabrication.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">Do you offer emergency window repair?</h3>
              <p className="text-muted-foreground">Yes, we offer priority scheduling for emergency situations like broken windows that compromise your home's security.</p>
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
            Need Window Repair in Charlotte?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Don't let a damaged window compromise your home's comfort and security. Contact us today for a free estimate on your window repair project.
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
