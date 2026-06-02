import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BreadcrumbSchema } from "@/components/structured-data";
import { QuoteCtaButton } from "@/components/quote-cta-button";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, usePublicSite } from "@/hooks/use-public-site";
import { Phone } from "lucide-react";
import aboutHero from "@/assets/images/about-hero.webp";
import aboutHeroMobile from "@/assets/images/about-hero-mobile.webp";
import aboutHeroFallback from "@/assets/images/about-hero.png";
import family_640 from "@/assets/images/family-640w.webp";
import family_960 from "@/assets/images/family-960w.webp";
import family_1280 from "@/assets/images/family-1280w.webp";
import family_1280jpg from "@/assets/images/family-1280w.jpg";

export default function About() {
  const siteData = usePublicSite();
  const identity = getPublicBusinessIdentity(siteData);
  const { phone, phoneHref } = siteData;
  const serviceArea = identity.market;
  const homeUrl = buildPublicUrl(identity.siteUrl);
  const aboutUrl = buildPublicUrl(identity.siteUrl, "/about");

  usePageMeta(
    `About ${identity.siteName} | Doug Adams | ${serviceArea}`,
    `Meet Doug Adams, owner of ${identity.siteName} with 15+ years of glass and door installation experience. Serving ${serviceArea}. Call ${phone} to talk through your project.`,
    { canonicalUrl: aboutUrl, ogUrl: aboutUrl },
  );
  return (
    <Layout>
      <BreadcrumbSchema items={[
        { name: "Home", url: homeUrl },
        { name: "About", url: aboutUrl },
      ]} />
      {/* Hero */}
      <style>{`
        .about-hero {
          background-image: image-set(url("${aboutHeroMobile}") type("image/webp"), url("${aboutHeroFallback}") type("image/png"));
        }
        @media (min-width: 768px) {
          .about-hero {
            background-image: image-set(url("${aboutHero}") type("image/webp"), url("${aboutHeroFallback}") type("image/png"));
          }
        }
        @media (min-width: 1024px) {
          .about-hero {
            background-position: center 30% !important;
            min-height: 55vh;
            max-height: 640px;
          }
        }
      `}</style>
      <section
        className="about-hero relative min-h-[50vh] flex items-center bg-cover bg-center bg-scroll lg:bg-fixed"
      >
        {/* Mobile overlay */}
        <div
          className="absolute inset-0 pointer-events-none lg:hidden"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.35) 100%)' }}
        />
        {/* Desktop overlay */}
        <div className="absolute inset-0 bg-black/45 hidden lg:block pointer-events-none" />
        <div className="container mx-auto px-4 text-center relative z-10 py-24">
          <h1
            className="text-4xl md:text-5xl font-heading font-bold mb-6 text-white"
            style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
          >
            About {identity.siteName}
          </h1>
          <p
            className="text-xl text-white/90 max-w-2xl mx-auto"
            style={{ textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}
          >
            Serving {serviceArea} with integrity, craftsmanship, and a commitment to excellence.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="overflow-hidden rounded-xl shadow-xl">
                <picture>
                  <source
                    type="image/webp"
                    srcSet={`${family_640} 640w, ${family_960} 960w, ${family_1280} 1280w`}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <img 
                    src={family_1280jpg} 
                    alt="Doug Adams, owner of Glass & Door Pro, with his family in Charlotte, NC" 
                    className="w-full"
                    loading="lazy"
                    decoding="async"
                  />
                </picture>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-primary font-semibold text-sm uppercase tracking-wider">Our Story</span>
              <h2 className="text-3xl font-heading font-bold mt-2 mb-6">Meet Doug Adams</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  I'm Doug, and I've been installing glass and doors in the Charlotte area for over 15 years. I started Glass and Door Pro because I wanted to do this work the way I think it should be done: one craftsman, one project at a time, with the person who quotes the job actually being the person who shows up to install it.
                </p>
                <p>
                  Most of what I do is frameless shower doors, window and door installation, and window repair. I work on everything from brand-new construction to historic homes — and the tricky, custom projects other contractors don't want to mess with are usually the ones I enjoy most.
                </p>
                <p>
                  Based in Monroe. Serving Charlotte and surrounding areas. Saturday appointments available.
                </p>
              </div>
              
              <div className="mt-8 grid grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-bold text-2xl text-primary mb-1">15+</h3>
                  <p className="text-sm font-medium">Years Experience</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-bold text-2xl text-primary mb-1">500+</h3>
                  <p className="text-sm font-medium">Projects Completed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-heading font-bold mb-4">Our Core Values</h2>
            <p className="text-muted-foreground">
              We build our business on trust, quality, and reliability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold mb-3 text-primary">Precision</h3>
                <p className="text-muted-foreground">
                  In glass work, a millimeter matters. We measure twice, cut once, and ensure every fit is perfect for a watertight, seamless finish.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold mb-3 text-primary">Integrity</h3>
                <p className="text-muted-foreground">
                  We believe in transparent pricing and honest timelines. No hidden fees, no surprises—just quality work delivered as promised.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold mb-3 text-primary">Quality</h3>
                <p className="text-muted-foreground">
                  We use only top-rated hardware and glass. We partner with the best manufacturers to ensure your installation lasts a lifetime.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="py-20 bg-primary text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-heading font-bold mb-6">Work With the Best in Charlotte</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <QuoteCtaButton label="Contact Doug Today" />
            <Button variant="secondary" size="lg" className="text-primary font-bold" asChild>
              <a href={phoneHref}>
                <Phone className="mr-2 h-5 w-5" />
                Call {phone}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
