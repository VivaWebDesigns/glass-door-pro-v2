export const leadAttributionStorageKey = "gdpLeadAttribution";

export const leadTrackingParamLabels: Record<string, string> = {
  utm_source: "UTM Source",
  utm_medium: "UTM Medium",
  utm_campaign: "UTM Campaign",
  utm_term: "UTM Term",
  utm_content: "UTM Content",
  gclid: "Google Click ID",
  fbclid: "Facebook Click ID",
};

type StoredLeadAttribution = {
  landingPage: string;
  landingReferrer: string;
};

export type LeadAttribution = StoredLeadAttribution & {
  sourceUrl: string;
  referrer: string;
  trackingFields: Record<string, string>;
};

export function currentLeadSourceUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function currentLeadReferrer() {
  if (typeof document === "undefined") return "";
  return document.referrer || "";
}

function trackingFieldsFromUrl(url: string) {
  if (!url.trim() || typeof window === "undefined") return {};

  try {
    const parsed = new URL(url, window.location.origin);
    return Object.fromEntries(
      Object.keys(leadTrackingParamLabels)
        .map((key) => [key, parsed.searchParams.get(key)?.trim() ?? ""] as const)
        .filter(([_key, value]) => value),
    );
  } catch {
    return {};
  }
}

function readStoredLeadAttribution(fallback: StoredLeadAttribution) {
  if (typeof window === "undefined") return fallback;

  try {
    const saved = window.sessionStorage.getItem(leadAttributionStorageKey);
    const parsed = saved ? (JSON.parse(saved) as Partial<StoredLeadAttribution>) : null;
    return {
      landingPage:
        typeof parsed?.landingPage === "string" && parsed.landingPage.trim()
          ? parsed.landingPage
          : fallback.landingPage,
      landingReferrer:
        typeof parsed?.landingReferrer === "string"
          ? parsed.landingReferrer
          : fallback.landingReferrer,
    };
  } catch {
    return fallback;
  }
}

export function initializeLeadAttribution() {
  if (typeof window === "undefined") return;

  try {
    const landingPage = currentLeadSourceUrl();
    if (landingPage.startsWith("/admin")) return;
    if (window.sessionStorage.getItem(leadAttributionStorageKey)) return;
    window.sessionStorage.setItem(
      leadAttributionStorageKey,
      JSON.stringify({
        landingPage,
        landingReferrer: currentLeadReferrer(),
      }),
    );
  } catch {
    // Browsers can block session storage. Forms still submit current-page attribution.
  }
}

export function getLeadAttribution(): LeadAttribution {
  const sourceUrl = currentLeadSourceUrl();
  const referrer = currentLeadReferrer();
  const fallback = { landingPage: sourceUrl, landingReferrer: referrer };

  initializeLeadAttribution();

  const landing = readStoredLeadAttribution(fallback);
  const currentTracking = trackingFieldsFromUrl(sourceUrl);
  const landingTracking = landing.landingPage !== sourceUrl ? trackingFieldsFromUrl(landing.landingPage) : {};
  const firstTouchTracking = Object.fromEntries(
    Object.entries(landingTracking).filter(([key, value]) => currentTracking[key] !== value),
  );

  return {
    sourceUrl,
    referrer,
    ...landing,
    trackingFields: firstTouchTracking,
  };
}
