import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { CheckCircle, Phone, Sun, Shield, Thermometer, DollarSign, Home } from "lucide-react";
import { QuoteCtaButton } from "@/components/quote-cta-button";
import { ServiceSchema, BreadcrumbSchema } from "@/components/structured-data";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import galleryWindows_640 from "@/assets/images/gallery-windows-640w.webp";
import galleryWindows_960 from "@/assets/images/gallery-windows-960w.webp";
import galleryWindows_1280 from "@/assets/images/gallery-windows-1280w.webp";
import galleryWindows_1280jpg from "@/assets/images/gallery-windows-1280w.jpg";
import gallerySunroom_640 from "@/assets/images/gallery-sunroom-640w.webp";
import gallerySunroom_960 from "@/assets/images/gallery-sunroom-960w.webp";
import gallerySunroom_1280 from "@/assets/images/gallery-sunroom-1280w.webp";
import gallerySunroom_1280jpg from "@/assets/images/gallery-sunroom-1280w.jpg";
import windowParallax from "@/assets/images/window-parallax.webp";

export default function WindowInstallation() {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const { phone, phoneHref } = siteData;
  const homeUrl = buildPublicUrl(identity.siteUrl);
  const servicesUrl = buildPublicUrl(identity.siteUrl, "/#services");
  const serviceUrl = buildPublicUrl(identity.siteUrl, "/services/window-installation");

  usePageMeta(
    `Window Installation | ${identity.market} | ${identity.siteName}`,
    `Energy-efficient residential window installation and replacement in ${identity.market}. Double-hung, casement, sliding, bay, and picture windows. Call ${phone} for a free estimate.`,
    { canonicalUrl: serviceUrl, ogUrl: serviceUrl },
  );

  return (
    <Layout>
      <ServiceSchema
        name="Residential Window Installation"
        description={`Energy-efficient window replacement and installation by ${identity.siteName} in ${identity.market}. Double-hung, casement, sliding, bay, and picture windows.`}
        url={serviceUrl}
      />
      <BreadcrumbSchema items={[
        { name: "Home", url: homeUrl },
        { name: "Services", url: servicesUrl },
        { name: "Window Installation", url: serviceUrl },
      ]} />
      {/* Parallax Hero Section */}
      <section 
        className="relative min-h-[90vh] flex items-center md:items-start bg-cover bg-center bg-scroll md:bg-fixed"
        style={{ backgroundImage: `url(${windowParallax})` }}
      >
        {/* Mobile-only gradient overlay for text readability */}
        <div 
          className="absolute inset-0 pointer-events-none md:hidden"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)' }}
        />
        
        <div className="container mx-auto px-6 md:px-4 relative z-10 pt-24 md:pt-28">
          <div className="max-w-xl">
            <h1 
              className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 md:mb-6 text-white"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
            >
              Residential Window Installation
            </h1>
            <p 
              className="text-base md:text-xl text-white mb-6 md:mb-8 leading-[1.6] md:leading-relaxed font-medium md:font-normal"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
            >
              Upgrade your home with energy-efficient windows that enhance comfort, reduce energy bills, and boost curb appeal. Professional installation serving Charlotte, NC and surrounding communities.
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
            Benefits of New Windows
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Thermometer className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Energy Efficiency</h3>
                <p className="text-muted-foreground">
                  Modern double or triple-pane windows significantly reduce heat transfer, keeping your home comfortable year-round.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <DollarSign className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Lower Energy Bills</h3>
                <p className="text-muted-foreground">
                  Quality windows can reduce heating and cooling costs by up to 25%, saving you money every month.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Sun className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Natural Light</h3>
                <p className="text-muted-foreground">
                  Let more natural light in while blocking harmful UV rays that can fade furniture and flooring.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Enhanced Security</h3>
                <p className="text-muted-foreground">
                  New windows feature improved locking mechanisms and stronger glass for better home security.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <Home className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Curb Appeal</h3>
                <p className="text-muted-foreground">
                  Beautiful new windows dramatically improve your home's appearance and increase property value.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Noise Reduction</h3>
                <p className="text-muted-foreground">
                  Multi-pane windows significantly reduce outside noise, creating a quieter, more peaceful home.
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
            Window Installation Projects
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="aspect-[4/3] overflow-hidden rounded-xl shadow-lg">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${galleryWindows_640} 640w, ${galleryWindows_960} 960w, ${galleryWindows_1280} 1280w`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <img 
                  src={galleryWindows_1280jpg} 
                  alt="Modern residential window installation by Glass & Door Pro in a Charlotte, NC area home" 
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
                  srcSet={`${gallerySunroom_640} 640w, ${gallerySunroom_960} 960w, ${gallerySunroom_1280} 1280w`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <img 
                  src={gallerySunroom_1280jpg} 
                  alt="Bright sunroom with large glass windows installed by Glass & Door Pro in Indian Trail, NC" 
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
              <h3 className="text-xl font-bold mb-2">In-Home Consultation</h3>
              <p className="text-muted-foreground">We evaluate your windows and discuss options that fit your needs and budget.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">2</div>
              <h3 className="text-xl font-bold mb-2">Window Selection</h3>
              <p className="text-muted-foreground">Choose from various styles, materials, and energy-efficient options.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">3</div>
              <h3 className="text-xl font-bold mb-2">Professional Install</h3>
              <p className="text-muted-foreground">Expert installation with proper sealing and insulation for maximum efficiency.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">4</div>
              <h3 className="text-xl font-bold mb-2">Final Inspection</h3>
              <p className="text-muted-foreground">Complete cleanup and walkthrough to ensure your total satisfaction.</p>
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
              <h3 className="text-lg font-bold mb-2">How long does window replacement take?</h3>
              <p className="text-muted-foreground">Most single window replacements take 30-60 minutes. A full home can typically be completed in 1-2 days.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">What types of windows do you install?</h3>
              <p className="text-muted-foreground">We install double-hung, casement, sliding, bay, bow, picture windows, and more in various materials including vinyl, wood, and fiberglass.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">Do you remove and dispose of old windows?</h3>
              <p className="text-muted-foreground">Yes, we handle complete removal and disposal of your old windows, leaving your home clean and tidy.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-2">Are your windows energy efficient?</h3>
              <p className="text-muted-foreground">We offer ENERGY STAR certified windows with Low-E glass, argon gas fills, and insulated frames for maximum efficiency.</p>
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
            Ready to Upgrade Your Windows?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Get a free estimate for your window replacement project. We'll help you find the perfect windows for your home and budget.
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
