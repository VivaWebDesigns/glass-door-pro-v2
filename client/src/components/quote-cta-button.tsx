import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const CONTACT_CTA_HREF = "/contact";

interface QuoteCtaButtonProps {
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  showArrow?: boolean;
  "data-testid"?: string;
}

export function QuoteCtaButton({
  label = "Request a Quote",
  className = "text-lg px-8 h-12",
  size = "lg",
  variant = "default",
  showArrow = true,
  "data-testid": testId = "button-quote-cta",
}: QuoteCtaButtonProps) {
  const openContact = () => {
    const contactSection = document.getElementById("contact");
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth", block: "end" });
      return;
    }
    window.location.href = CONTACT_CTA_HREF;
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={openContact}
      data-testid={testId}
    >
      {label} {showArrow && <ArrowRight className="ml-2 h-5 w-5" />}
    </Button>
  );
}
