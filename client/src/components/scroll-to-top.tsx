import { useEffect } from "react";
import { useLocation } from "wouter";

export function ScrollToTop() {
  const [pathname] = useLocation();

  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (hash) {
        setTimeout(() => {
          const element = document.querySelector(hash);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        }, 200);
      } else {
        window.scrollTo(0, 0);
      }
    };

    scrollToHash();

    // Listen for hash changes
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [pathname]);

  return null;
}