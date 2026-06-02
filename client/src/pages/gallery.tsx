import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import Layout from "@/components/layout";
import { BreadcrumbSchema } from "@/components/structured-data";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, usePublicBusinessIdentity } from "@/hooks/use-public-site";

import img01 from "@/assets/gallery/frameless-showers/01.jpg";
import img02 from "@/assets/gallery/frameless-showers/02.jpg";
import img03 from "@/assets/gallery/frameless-showers/03.jpg";
import img04 from "@/assets/gallery/frameless-showers/04.jpg";
import img05 from "@/assets/gallery/frameless-showers/05.jpg";
import img06 from "@/assets/gallery/frameless-showers/06.jpg";
import img07 from "@/assets/gallery/frameless-showers/07.jpg";
import img08 from "@/assets/gallery/frameless-showers/08.jpg";
import img09 from "@/assets/gallery/frameless-showers/09.jpg";
import img10 from "@/assets/gallery/frameless-showers/10.jpg";
import img12 from "@/assets/gallery/frameless-showers/12.jpg";

/**
 * IMAGE OPTIMIZATION GUIDELINES:
 * - Export widths: 320, 640, 960, 1280, 1600
 * - Prefer WebP (and AVIF if available)
 * - Target file sizes: thumbnails < 80KB, large < 250KB
 * - Strip metadata
 * - Keep consistent aspect ratio (4:3)
 */

interface GalleryImage {
  src: string;
  alt: string;
  title: string;
}

const getSrcSet = (src: string) => {
  return `${src} 320w, ${src} 640w, ${src} 960w, ${src} 1280w, ${src} 1600w`;
};

const framelessShowerImages: GalleryImage[] = [
  { src: img03, alt: "Black frame glass shower enclosure with marble walls and freestanding tub installed by Glass & Door Pro in SouthPark, Charlotte, NC", title: "Frameless Shower Install — SouthPark" },
  { src: img01, alt: "Frameless glass shower enclosure with marble walls and built-in bench installed by Glass & Door Pro in Myers Park, Charlotte, NC", title: "Frameless Shower Install — Myers Park" },
  { src: img06, alt: "Corner frameless shower with gold hardware and blue accent walls installed by Glass & Door Pro in Weddington, NC", title: "Frameless Shower Install — Weddington" },
  { src: img09, alt: "Sliding frameless shower door with marble walls and patterned floor installed by Glass & Door Pro in Waxhaw, NC", title: "Frameless Shower Install — Waxhaw" },
  { src: img02, alt: "Modern frameless shower with barn door hardware and wood ceiling installed by Glass & Door Pro in Dilworth, Charlotte, NC", title: "Frameless Shower Install — Dilworth" },
  { src: img08, alt: "Large frameless shower enclosure with dual shower heads installed by Glass & Door Pro in Marvin, NC near Monroe", title: "Frameless Shower Install — Marvin" },
  { src: img05, alt: "Black frame shower door with dark tile and modern hardware installed by Glass & Door Pro in Plaza Midwood, Charlotte, NC", title: "Frameless Shower Install — Plaza Midwood" },
  { src: img12, alt: "Frameless sliding shower door with gold hardware and wood vanity installed by Glass & Door Pro in Matthews, NC", title: "Frameless Shower Install — Matthews" },
  { src: img04, alt: "Corner frameless shower with gold hardware and blue tile floor installed by Glass & Door Pro in Ballantyne, Charlotte, NC", title: "Frameless Shower Install — Ballantyne" },
  { src: img07, alt: "Frameless glass shower with gray subway tile and half wall installed by Glass & Door Pro in the Lake Norman area, NC", title: "Frameless Shower Install — Lake Norman" },
  { src: img10, alt: "Frameless glass shower enclosure with patterned floor tile installed by Glass & Door Pro in Fort Mill, SC near Charlotte", title: "Frameless Shower Install — Fort Mill" },
];

interface Category {
  id: string;
  title: string;
  subtitle: string;
  images: GalleryImage[];
  coverImage?: string;
}

const galleryCategories: Category[] = [
  {
    id: "frameless-showers",
    title: "Frameless Showers",
    subtitle: "Recent installations",
    images: framelessShowerImages,
    coverImage: framelessShowerImages[0].src,
  },
  {
    id: "windows",
    title: "Windows",
    subtitle: "Coming Soon",
    images: [],
  },
  {
    id: "doors",
    title: "Doors",
    subtitle: "Coming Soon",
    images: [],
  },
  {
    id: "commercial-glass",
    title: "Commercial Glass",
    subtitle: "Coming Soon",
    images: [],
  },
];

function Lightbox({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrev,
}: {
  images: GalleryImage[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    modalRef.current?.focus();
    document.body.style.overflow = "hidden";

    const focusableSelector = 'button, [tabindex]';
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleFocusTrap);

    return () => {
      document.body.style.overflow = "";
      previousFocus.current?.focus();
      document.removeEventListener("keydown", handleFocusTrap);
    };
  }, []);

  useEffect(() => {
    const nextIdx = (currentIndex + 1) % images.length;
    const prevIdx = (currentIndex - 1 + images.length) % images.length;
    const preloadNext = new Image();
    preloadNext.src = images[nextIdx].src;
    const preloadPrev = new Image();
    preloadPrev.src = images[prevIdx].src;
  }, [currentIndex, images]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    },
    [onClose, onPrev, onNext]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) onNext();
      else onPrev();
    }
  };

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onKeyDown={handleKeyDown}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid="lightbox-modal"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 z-[110] text-white/80 hover:text-white transition-colors"
        aria-label="Close lightbox"
        data-testid="button-lightbox-close"
      >
        <X className="h-8 w-8" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        className="absolute left-2 md:left-6 z-[110] text-white/70 hover:text-white transition-colors p-2"
        aria-label="Previous image"
        data-testid="button-lightbox-prev"
      >
        <ChevronLeft className="h-8 w-8 md:h-10 md:w-10" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className="absolute right-2 md:right-6 z-[110] text-white/70 hover:text-white transition-colors p-2"
        aria-label="Next image"
        data-testid="button-lightbox-next"
      >
        <ChevronRight className="h-8 w-8 md:h-10 md:w-10" />
      </button>

      <div
        className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[currentIndex].src}
          srcSet={getSrcSet(images[currentIndex].src)}
          sizes="90vw"
          alt={images[currentIndex].alt}
          className="max-w-full max-h-[85vh] object-contain rounded-lg select-none"
          draggable={false}
          data-testid={`img-lightbox-${currentIndex}`}
        />
      </div>

      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center bg-black/50 px-5 py-2.5 rounded-full"
        data-testid="text-lightbox-counter"
      >
        <p className="text-white text-sm font-medium">{images[currentIndex].title}</p>
        <p className="text-white/60 text-xs mt-0.5">{currentIndex + 1} / {images.length}</p>
      </div>
    </div>
  );
}

export default function Gallery() {
  const identity = usePublicBusinessIdentity();
  const homeUrl = buildPublicUrl(identity.siteUrl);
  const galleryUrl = buildPublicUrl(identity.siteUrl, "/gallery");

  usePageMeta(
    `Project Gallery | ${identity.siteName} | ${identity.market}`,
    `Browse frameless shower door installations completed by ${identity.siteName} across ${identity.market}.`,
    { canonicalUrl: galleryUrl, ogUrl: galleryUrl },
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeCategoryData = galleryCategories.find((c) => c.id === activeCategory);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    const idx = lightboxIndex;
    setLightboxIndex(null);
    if (idx !== null && thumbnailRefs.current[idx]) {
      thumbnailRefs.current[idx]?.focus();
    }
  };

  const nextImage = () => {
    if (lightboxIndex === null || !activeCategoryData) return;
    setLightboxIndex((lightboxIndex + 1) % activeCategoryData.images.length);
  };

  const prevImage = () => {
    if (lightboxIndex === null || !activeCategoryData) return;
    setLightboxIndex(
      (lightboxIndex - 1 + activeCategoryData.images.length) %
        activeCategoryData.images.length
    );
  };

  const handleImageError = (index: number) => {
    setImageErrors((prev) => new Set(prev).add(index));
  };

  return (
    <Layout>
      <BreadcrumbSchema items={[
        { name: "Home", url: homeUrl },
        { name: "Gallery", url: galleryUrl },
      ]} />
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1
              className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-slate-900 mb-4"
              data-testid="text-gallery-title"
            >
              Gallery
            </h1>
            <p
              className="text-lg text-slate-600 max-w-2xl mx-auto"
              data-testid="text-gallery-subtitle"
            >
              Explore our work by category.
            </p>
          </div>

          {!activeCategory ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {galleryCategories.map((category, index) => (
                category.images.length > 0 && category.coverImage ? (
                  <button
                    key={category.id}
                    onClick={() => {
                      setActiveCategory(category.id);
                      setImageErrors(new Set());
                    }}
                    className="group relative overflow-hidden rounded-xl aspect-[4/3] cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 bg-slate-200"
                    data-testid={`card-category-${category.id}`}
                  >
                    <img
                      src={category.coverImage}
                      srcSet={getSrcSet(category.coverImage)}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      alt={category.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : "low"}
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-300 group-hover:from-black/80" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-left">
                      <h2 className="text-xl md:text-2xl font-heading font-bold text-white mb-1">
                        {category.title}
                      </h2>
                      <p className="text-sm text-white/80">{category.subtitle}</p>
                      <p className="text-xs text-white/60 mt-2">
                        {category.images.length} photos
                      </p>
                    </div>
                  </button>
                ) : (
                  <div
                    key={category.id}
                    className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50 p-6 text-center"
                    data-testid={`card-category-${category.id}`}
                  >
                    <h2 className="text-xl md:text-2xl font-heading font-bold text-slate-900 mb-2">
                      {category.title}
                    </h2>
                    <p className="text-sm text-slate-500">{category.subtitle}</p>
                  </div>
                )
              ))}
            </div>
          ) : (
            <div>
              <button
                onClick={() => {
                  setActiveCategory(null);
                  setImageErrors(new Set());
                }}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors mb-8"
                data-testid="button-back-categories"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to categories
              </button>

              {activeCategoryData && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  {activeCategoryData.images.map((image, index) => {
                    if (imageErrors.has(index)) return null;
                    return (
                      <div key={index} className="flex flex-col">
                        <button
                          ref={(el) => {
                            thumbnailRefs.current[index] = el;
                          }}
                          onClick={() => openLightbox(index)}
                          className="group relative overflow-hidden rounded-lg aspect-[4/3] cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 bg-slate-100"
                          data-testid={`button-gallery-image-${index}`}
                        >
                          <picture>
                            <source srcSet={getSrcSet(image.src)} sizes="(max-width: 640px) 50vw, 33vw" type="image/webp" />
                            <img
                              src={image.src}
                              srcSet={getSrcSet(image.src)}
                              sizes="(max-width: 640px) 50vw, 33vw"
                              alt={image.alt}
                              width={640}
                              height={480}
                              loading={index < 2 ? "eager" : "lazy"}
                              fetchPriority={index < 2 ? "high" : "low"}
                              decoding="async"
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              onError={() => handleImageError(index)}
                            />
                          </picture>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                        </button>
                        <p className="mt-2 text-xs md:text-sm text-slate-600 font-medium text-center" data-testid={`text-gallery-title-${index}`}>
                          {image.title}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {lightboxIndex !== null && activeCategoryData && (
        <Lightbox
          images={activeCategoryData.images}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNext={nextImage}
          onPrev={prevImage}
        />
      )}
    </Layout>
  );
}
