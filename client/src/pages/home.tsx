import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Star, Mail, Phone, Droplets, Grid3X3, DoorOpen, Wrench, Building2, MapPin, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { CmsLeadForm } from "@/components/cms-lead-form";
import { QuoteCtaButton } from "@/components/quote-cta-button";
import { LocalBusinessSchema, BreadcrumbSchema } from "@/components/structured-data";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, publicCmsEnabled, usePublicSite } from "@/hooks/use-public-site";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { CmsForm } from "@shared/schema";
import heroVideo from "@/assets/videos/hero-video.mp4";
import family_640 from "@/assets/images/family-640w.webp";
import family_960 from "@/assets/images/family-960w.webp";
import family_1280 from "@/assets/images/family-1280w.webp";
import family_1280jpg from "@/assets/images/family-1280w.jpg";
import galleryShower1_640 from "@/assets/images/gallery-shower1-640w.webp";
import galleryShower1_960 from "@/assets/images/gallery-shower1-960w.webp";
import galleryShower1_1280 from "@/assets/images/gallery-shower1-1280w.webp";
import galleryShower1_1280jpg from "@/assets/images/gallery-shower1-1280w.jpg";
import galleryShower2_640 from "@/assets/images/gallery-shower2-640w.webp";
import galleryShower2_960 from "@/assets/images/gallery-shower2-960w.webp";
import galleryShower2_1280 from "@/assets/images/gallery-shower2-1280w.webp";
import galleryShower2_1280jpg from "@/assets/images/gallery-shower2-1280w.jpg";
import galleryWindows_640 from "@/assets/images/gallery-windows-640w.webp";
import galleryWindows_960 from "@/assets/images/gallery-windows-960w.webp";
import galleryWindows_1280 from "@/assets/images/gallery-windows-1280w.webp";
import galleryWindows_1280jpg from "@/assets/images/gallery-windows-1280w.jpg";
import galleryDoor3_640 from "@/assets/images/gallery-door3-640w.webp";
import galleryDoor3_960 from "@/assets/images/gallery-door3-960w.webp";
import galleryDoor3_1280 from "@/assets/images/gallery-door3-1280w.webp";
import galleryDoor3_1280jpg from "@/assets/images/gallery-door3-1280w.jpg";
import gallerySunroom_640 from "@/assets/images/gallery-sunroom-640w.webp";
import gallerySunroom_960 from "@/assets/images/gallery-sunroom-960w.webp";
import gallerySunroom_1280 from "@/assets/images/gallery-sunroom-1280w.webp";
import gallerySunroom_1280jpg from "@/assets/images/gallery-sunroom-1280w.jpg";
import galleryDoor1_640 from "@/assets/images/gallery-door1-640w.webp";
import galleryDoor1_960 from "@/assets/images/gallery-door1-960w.webp";
import galleryDoor1_1280 from "@/assets/images/gallery-door1-1280w.webp";
import galleryDoor1_1280jpg from "@/assets/images/gallery-door1-1280w.jpg";
import galleryDoor2_640 from "@/assets/images/gallery-door2-640w.webp";
import galleryDoor2_960 from "@/assets/images/gallery-door2-960w.webp";
import galleryDoor2_1280 from "@/assets/images/gallery-door2-1280w.webp";
import galleryDoor2_1280jpg from "@/assets/images/gallery-door2-1280w.jpg";
import galleryShower1 from "@/assets/images/gallery-shower1-1280w.jpg";

export default function Home() {
  const siteData = usePublicSite();
  const isPublicCmsEnabled = publicCmsEnabled(siteData.settings);
  const identity = getPublicBusinessIdentity(siteData);
  const homeUrl = buildPublicUrl(identity.siteUrl);
  const { data: cmsForm } = useQuery<CmsForm | null>({
    queryKey: ["/api/cms/public/forms/website-quote-request"],
    enabled: isPublicCmsEnabled,
    retry: false,
    throwOnError: false,
  });
  const phone = siteData.phone;
  const phoneHref = siteData.phoneHref;
  const email = siteData.email;
  usePageMeta(
    `${identity.siteName} | ${identity.market} Glass & Door Installation`,
    `${identity.siteName} serves ${identity.market}. Frameless shower doors, window installation, door replacement, window repair, and commercial glass. Call ${phone} for a free quote.`,
    { canonicalUrl: homeUrl, ogUrl: homeUrl },
  );
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const testimonials = [
    {
      text: "Doug was great. He's extremely detailed in his work. Will definitely use him again when I'm ready to upgrade the other shower door. Highly recommend!",
      author: "Thomas F.",
    },
    {
      text: "Very happy with the service by Doug. Fast out to give a quote, friendly and good communication, installation as promised and high quality product.",
      author: "Leah O.",
    },
    {
      text: "Doug was simply fantastic. Very thorough and the shower glass turned out amazing! Highly recommend!",
      author: "Gary D.",
    },
    {
      text: "Doug was a great communicator and made the whole process easy. He took great care during installation of my frameless shower glass to protect my Carrara Marble. He was meticulous, did a great job and was super great to work with! My glass and hardware are STUNNING!",
      author: "Tyler W.",
    },
    {
      text: "Doug was great. From the time I called him he was punctual and thorough. We were extremely satisfied with the work that was done we will definitely be recommending him to others.",
      author: "Donna K.",
    },
    {
      text: "Very pleased with the results on our frameless shower. Doug was great to work with, very responsive, and professional. Would highly recommend for your shower glass project.",
      author: "Will F.",
    },
    {
      text: "Great work! Doug was very professional and did a super job with my house window glass replacements. He arrived on time for the estimate and the install jobs. He also provided me with excellent, detailed proof of payment paperwork after the job was completed.",
      author: "Pam",
    },
    {
      text: "Doug did an AMAZING job!! Very meticulous and made sure it was done right. Will definitely use again and highly recommend.",
      author: "Kristy C.",
    },
  ];

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <Layout>
      <LocalBusinessSchema />
      <BreadcrumbSchema items={[{ name: "Home", url: homeUrl }]} />
      {/* Video Hero Section - Optimized */}
      <section id="hero" className="relative h-[70vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        {/* Poster/fallback background */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${galleryShower1})` }}
        />
        <video 
          autoPlay 
          muted 
          loop 
          playsInline
          preload="metadata"
          onLoadedData={() => setVideoLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
        >
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-slate-900/50" />
        <div className="relative z-10 text-center text-white px-4">
          <h1 className="text-4xl md:text-6xl font-heading font-bold leading-tight mb-6">
            We've got your glass & door<br />needs covered.
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8">
            Specializing in frameless glass showers, windows, and doors for homeowners in {identity.market}.
          </p>
          <QuoteCtaButton label="Get a Free Quote" data-testid="button-hero-quote" />
        </div>
      </section>
      {/* About Section with Family Photo */}
      <section id="about" className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${family_640} 640w, ${family_960} 960w, ${family_1280} 1280w`}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <img 
                  src={family_1280jpg} 
                  alt="Doug Adams, owner of Glass & Door Pro, with his family in Charlotte, NC" 
                  className="rounded-xl shadow-xl w-full max-w-md mx-auto object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-primary font-semibold text-sm uppercase tracking-wider">About Us</span>
              <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2 mb-6">
                Hi there! My name is Doug.
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                Welcome to my glass and door installation business, proudly serving the greater Charlotte, North Carolina area. With over 15 years of hands-on experience, I'm dedicated to providing high-quality, personalized solutions for all your glass and door needs.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Whether you're looking to enhance your home with a custom frameless shower or improve comfort and energy efficiency with new windows or doors, I've got you covered. I handle every project personally—from small repairs to full installations—ensuring each job is completed efficiently, correctly, and with attention to detail.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Services Grid with Learn More Buttons */}
      <section id="services" className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Our Services</span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2">
              What We Offer
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Service 1 - Frameless Showers */}
            <Card className="text-center p-6 hover:shadow-lg transition-shadow border-none bg-white flex flex-col">
              <CardContent className="pt-4 flex-grow flex flex-col">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Droplets className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">Frameless Showers</h3>
                <p className="text-muted-foreground text-sm mb-4 flex-grow">
                  Custom frameless glass shower enclosures that add luxury and value to any bathroom.
                </p>
                <Button variant="outline" size="sm" asChild className="mt-auto" data-testid="button-learn-more-showers">
                  <Link href="/services/frameless-showers">
                    Learn More <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Service 2 - Window Installation */}
            <Card className="text-center p-6 hover:shadow-lg transition-shadow border-none bg-white flex flex-col">
              <CardContent className="pt-4 flex-grow flex flex-col">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Grid3X3 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">Window Installation</h3>
                <p className="text-muted-foreground text-sm mb-4 flex-grow">
                  Energy-efficient window replacements to enhance your property's comfort and curb appeal.
                </p>
                <Button variant="outline" size="sm" asChild className="mt-auto" data-testid="button-learn-more-windows">
                  <Link href="/services/window-installation">
                    Learn More <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Service 3 - Door Installation */}
            <Card className="text-center p-6 hover:shadow-lg transition-shadow border-none bg-white flex flex-col">
              <CardContent className="pt-4 flex-grow flex flex-col">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <DoorOpen className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">Door Installation</h3>
                <p className="text-muted-foreground text-sm mb-4 flex-grow">
                  From entry doors to patio doors, I install options to enhance your home's security and style.
                </p>
                <Button variant="outline" size="sm" asChild className="mt-auto" data-testid="button-learn-more-doors">
                  <Link href="/services/door-installation">
                    Learn More <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Service 4 - Window Repair */}
            <Card className="text-center p-6 hover:shadow-lg transition-shadow border-none bg-white flex flex-col">
              <CardContent className="pt-4 flex-grow flex flex-col">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wrench className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">Window Repair</h3>
                <p className="text-muted-foreground text-sm mb-4 flex-grow">
                  Fast, reliable window glass repair for broken panes, foggy windows, and seal failures.
                </p>
                <Button variant="outline" size="sm" asChild className="mt-auto" data-testid="button-learn-more-repair">
                  <Link href="/services/window-repair">
                    Learn More <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Service 5 - Commercial Glass */}
            <Card className="text-center p-6 hover:shadow-lg transition-shadow border-none bg-white flex flex-col">
              <CardContent className="pt-4 flex-grow flex flex-col">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">Commercial Glass</h3>
                <p className="text-muted-foreground text-sm mb-4 flex-grow">
                  Professional storefront glass, office partitions, and commercial glass solutions for businesses.
                </p>
                <Button variant="outline" size="sm" asChild className="mt-auto" data-testid="button-learn-more-commercial">
                  <Link href="/services/commercial-glass">
                    Learn More <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* Full Width Image Banner */}
      <section className="relative h-[50vh] min-h-[400px]">
        <picture>
          <source
            type="image/webp"
            srcSet={`${galleryDoor2_640} 640w, ${galleryDoor2_960} 960w, ${galleryDoor2_1280} 1280w`}
            sizes="100vw"
          />
          <img 
            src={galleryDoor2_1280jpg} 
            alt="Custom wooden entry door installation with decorative planters by Glass & Door Pro in Charlotte, NC" 
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </section>
      {/* Why Us Section */}
      <section id="why-us" className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-primary font-semibold text-sm uppercase tracking-wider">Why us?</span>
              <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2 mb-6">
                Get the job done right
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                I work closely with my clients to ensure that each installation is tailored to their specific preferences and needs, resulting in a truly unique and beautiful addition to any space.
              </p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                With 15+ years of experience, I have the knowledge and equipment necessary to install any type of glass or door, from standard windows and exterior doors to more complex frameless shower enclosures.
              </p>
              <QuoteCtaButton label="Contact Us" data-testid="button-whyus-contact" />
            </div>
            <div className="relative">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${galleryDoor1_640} 640w, ${galleryDoor1_960} 960w, ${galleryDoor1_1280} 1280w`}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <img 
                  src={galleryDoor1_1280jpg} 
                  alt="Professional entry door installation by Glass & Door Pro serving Monroe and Indian Trail, NC" 
                  className="rounded-xl shadow-xl w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              <div className="absolute -bottom-4 -right-4 bg-primary text-white p-4 rounded-lg shadow-lg">
                <div className="text-2xl font-bold">15+</div>
                <div className="text-sm">Years Experience</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Image Gallery */}
      <section id="gallery" className="py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="aspect-square overflow-hidden rounded-lg shadow-md cursor-pointer">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${galleryShower1_640} 640w, ${galleryShower1_960} 960w, ${galleryShower1_1280} 1280w`}
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                <img 
                  src={galleryShower1_1280jpg} 
                  alt="Frameless glass shower enclosure installed in a Charlotte area home by Glass & Door Pro" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="aspect-square overflow-hidden rounded-lg shadow-md cursor-pointer">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${galleryWindows_640} 640w, ${galleryWindows_960} 960w, ${galleryWindows_1280} 1280w`}
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                <img 
                  src={galleryWindows_1280jpg} 
                  alt="Energy-efficient window installation for homes in Matthews, Mint Hill, and Charlotte, NC" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="aspect-square overflow-hidden rounded-lg shadow-md cursor-pointer">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${galleryDoor3_640} 640w, ${galleryDoor3_960} 960w, ${galleryDoor3_1280} 1280w`}
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                <img 
                  src={galleryDoor3_1280jpg} 
                  alt="Charming blue entry door installed by Glass & Door Pro in the Charlotte, NC metro area" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="aspect-square overflow-hidden rounded-lg shadow-md cursor-pointer">
              <picture>
                <source
                  type="image/webp"
                  srcSet={`${galleryShower2_640} 640w, ${galleryShower2_960} 960w, ${galleryShower2_1280} 1280w`}
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                <img 
                  src={galleryShower2_1280jpg} 
                  alt="Modern frameless shower glass door with sleek hardware installed in Indian Trail, NC" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
          </div>
        </div>
      </section>
      {/* Testimonials Carousel */}
      <section id="reviews" className="py-16 md:py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Reviews</span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2">
              What our clients say
            </h2>
          </div>

          <div className="max-w-3xl mx-auto relative">
            {/* Navigation Arrows */}
            <button 
              onClick={prevTestimonial}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 z-10 bg-white shadow-lg rounded-full p-2 hover:bg-gray-50 transition-colors"
              aria-label="Previous review"
              data-testid="button-prev-review"
            >
              <ChevronLeft className="h-6 w-6 text-gray-600" />
            </button>
            <button 
              onClick={nextTestimonial}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 z-10 bg-white shadow-lg rounded-full p-2 hover:bg-gray-50 transition-colors"
              aria-label="Next review"
              data-testid="button-next-review"
            >
              <ChevronRight className="h-6 w-6 text-gray-600" />
            </button>

            <div className="bg-white rounded-xl shadow-lg p-8 md:p-10">
              {/* Stars */}
              <div className="flex justify-center gap-1 mb-6 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="fill-current h-6 w-6" />
                ))}
              </div>
              
              {/* Review Text */}
              <p className="text-lg md:text-xl text-center text-foreground italic mb-6 leading-relaxed min-h-[100px]">
                "{testimonials[currentTestimonial].text}"
              </p>
              
              {/* Author with Google Icon */}
              <div className="flex flex-col items-center gap-3">
                {/* Google Logo */}
                <svg className="h-6 w-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                
                <div className="font-bold text-lg">{testimonials[currentTestimonial].author}</div>
              </div>
            </div>

            {/* Pagination dots */}
            <div className="flex justify-center gap-2 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentTestimonial ? "bg-primary" : "bg-gray-300 hover:bg-gray-400"
                  }`}
                  aria-label={`Go to review ${index + 1}`}
                  data-testid={`testimonial-dot-${index}`}
                />
              ))}
            </div>

            {/* Review Counter */}
            <div className="text-center mt-4 text-muted-foreground text-sm">
              {currentTestimonial + 1} / {testimonials.length}
            </div>
          </div>
        </div>
      </section>
      {/* Contact Section - With Form and Color */}
      <section id="contact" className="py-16 md:py-20 bg-gradient-to-br from-primary/10 via-accent/30 to-primary/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Contact Us</span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2 mb-4">
              Let us know how we can help!
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Contact us today to learn more about how we can help you enhance the beauty and functionality of your home.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Contact Form */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-heading font-bold mb-6">{isPublicCmsEnabled ? cmsForm?.name ?? "Send us a message" : "Send us a message"}</h3>
              {isPublicCmsEnabled && cmsForm?.description && <p className="mb-5 text-sm text-muted-foreground">{cmsForm.description}</p>}
              <CmsLeadForm form={isPublicCmsEnabled ? cmsForm : null} />
            </div>

            {/* Contact Info Cards */}
            <div className="flex flex-col gap-4">
              <a 
                href={phoneHref}
                className="group bg-white border-2 border-transparent hover:border-primary rounded-xl p-6 flex items-center gap-4 transition-all hover:shadow-lg"
                data-testid="link-phone"
              >
                <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Phone className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Call Us</h3>
                  <p className="text-muted-foreground">{phone}</p>
                </div>
              </a>

              <a 
                href={`mailto:${email}`}
                className="group bg-white border-2 border-transparent hover:border-primary rounded-xl p-6 flex items-center gap-4 transition-all hover:shadow-lg"
                data-testid="link-email"
              >
                <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Mail className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Email Us</h3>
                  <p className="text-muted-foreground">{email}</p>
                </div>
              </a>

              <div className="bg-white border-2 border-transparent rounded-xl p-6 flex items-center gap-4">
                <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shrink-0">
                  <MapPin className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Service Locations</h3>
                  <p className="text-muted-foreground">Charlotte & Surrounding Areas</p>
                </div>
              </div>

              <div className="bg-white border-2 border-transparent rounded-xl p-6 flex items-center gap-4">
                <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shrink-0">
                  <Clock className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Hours</h3>
                  <p className="text-muted-foreground">Mon-Sat: 7am - 6pm</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
