import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { buildPublicUrl, getPublicBusinessIdentity, getPublicSiteSetting, publicCmsEnabled, usePublicSite } from "@/hooks/use-public-site";
import { CmsLeadForm } from "@/components/cms-lead-form";
import type { CmsForm } from "@shared/schema";

export default function Contact() {
  const siteData = usePublicSite();
  const isPublicCmsEnabled = publicCmsEnabled(siteData.settings);
  const phone = siteData.phone;
  const email = siteData.email;
  const publicSettings = siteData.settings;
  const identity = getPublicBusinessIdentity(siteData);
  const contactUrl = buildPublicUrl(identity.siteUrl, "/contact");

  usePageMeta(
    `Contact ${identity.siteName} | Free Quote | ${identity.market}`,
    `Request a free quote from ${identity.siteName}. Serving ${identity.market} for shower glass, windows, doors, repairs, and commercial glass. Call ${phone} or email ${email}.`,
    { canonicalUrl: contactUrl, ogUrl: contactUrl },
  );
  const { data: cmsForm } = useQuery<CmsForm | null>({
    queryKey: ["/api/cms/public/forms/website-quote-request"],
    enabled: isPublicCmsEnabled,
    retry: false,
    throwOnError: false,
  });
  const siteSettingValue = getPublicSiteSetting(publicSettings, "site");
  const serviceArea = typeof siteSettingValue.market === "string"
    ? siteSettingValue.market
    : identity.market;
  const businessHours =
    typeof siteSettingValue.businessHours === "string" && siteSettingValue.businessHours.trim()
      ? siteSettingValue.businessHours
      : "Mon-Sat: 7am - 6pm";

  return (
    <Layout>
      <section className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-slate-300">Get a free estimate for your project today.</p>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <h2 className="text-3xl font-heading font-bold mb-6 text-primary">Get In Touch</h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Whether you're ready to start your bathroom renovation or just have a few questions about window replacement, we're here to help.
              </p>

              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Phone</h3>
                    <p className="text-muted-foreground mb-1">Call Doug for immediate assistance.</p>
                    <a href={siteData.phoneHref} className="text-xl font-bold hover:text-primary transition-colors">{phone}</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Email</h3>
                    <p className="text-muted-foreground mb-1">Send us your plans or questions.</p>
                    <a href={`mailto:${email}`} className="text-lg font-medium hover:text-primary transition-colors">{email}</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Service Area</h3>
                    <p className="text-muted-foreground">
                      Serving {serviceArea} including Myers Park, Dilworth, South Park, Ballantyne, Matthews, and Huntersville.
                    </p>
                  </div>
                </div>

                 <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Hours</h3>
                    <p className="text-muted-foreground">{businessHours}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div>
              <Card className="shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                  <CardTitle className="text-2xl">{isPublicCmsEnabled ? cmsForm?.name ?? "Send a Message" : "Send a Message"}</CardTitle>
                  {isPublicCmsEnabled && cmsForm?.description && (
                    <p className="text-sm text-muted-foreground">{cmsForm.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <CmsLeadForm form={isPublicCmsEnabled ? cmsForm : null} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
