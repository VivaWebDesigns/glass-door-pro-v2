import { useEffect, useId, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePublicBusinessIdentity } from "@/hooks/use-public-site";
import { useToast } from "@/hooks/use-toast";
import { getLeadAttribution, leadTrackingParamLabels } from "@/lib/lead-attribution";
import { apiRequest } from "@/lib/queryClient";
import type { CmsForm, CmsFormField } from "@shared/schema";

const fallbackFields: CmsFormField[] = [
  { id: "name", name: "name", label: "Your Name", type: "text", required: true, placeholder: "John Smith" },
  { id: "email", name: "email", label: "Email Address", type: "email", required: true, placeholder: "john@example.com" },
  { id: "phone", name: "phone", label: "Phone Number", type: "tel", required: false, placeholder: "(704) 555-1234" },
  {
    id: "message",
    name: "message",
    label: "Your Message",
    type: "textarea",
    required: true,
    placeholder: "Tell us about your project...",
  },
];

const supportedLeadFieldTypes = new Set<CmsFormField["type"]>(["text", "email", "tel", "textarea", "select", "checkbox"]);

function initialValues(fields: CmsFormField[]) {
  return Object.fromEntries(fields.map((field) => [field.name, ""]));
}

type CmsLeadFormFieldPreset = "cms" | "originalHome";

function normalizeLeadFormFields(form?: CmsForm | null, fieldPreset: CmsLeadFormFieldPreset = "cms") {
  if (fieldPreset === "originalHome") return fallbackFields;

  const sourceFields = form?.fields.length ? form.fields : fallbackFields;
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  const fields = sourceFields
    .map((field, index) => {
      const name = field.name.trim();
      const idBase = field.id.trim() || name || `field-${index + 1}`;
      const id = seenIds.has(idBase) ? `${idBase}-${index + 1}` : idBase;
      seenIds.add(id);
      return {
        ...field,
        id,
        name,
        label: field.label.trim() || name,
        placeholder: field.placeholder?.trim() || undefined,
        options: field.options?.map((option) => option.trim()).filter(Boolean),
      };
    })
    .filter((field) => {
      if (!field.id || !field.name || !field.label || !supportedLeadFieldTypes.has(field.type) || seenNames.has(field.name)) {
        return false;
      }
      seenNames.add(field.name);
      return true;
    });
  const needsContactFields = !fields.some((field) => field.name === "email" || field.name === "phone");
  if (fields.length === 0) return fallbackFields;
  return needsContactFields
    ? [...fields, ...fallbackFields.filter((field) => field.name === "email" || field.name === "phone")]
    : fields;
}

function publicLeadSubmitErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Please try again or call us directly.";
  const responseBody = error.message.match(/^\d+:\s*(.*)$/)?.[1];

  if (responseBody) {
    try {
      const parsed = JSON.parse(responseBody) as { message?: unknown };
      if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
    } catch {
      if (responseBody.trim()) return responseBody.trim();
    }
  }

  return error.message;
}

export function CmsLeadForm({ form, fieldPreset = "cms" }: { form?: CmsForm | null; fieldPreset?: CmsLeadFormFieldPreset }) {
  const { toast } = useToast();
  const formInstanceId = useId();
  const identity = usePublicBusinessIdentity();
  const isFallbackForm = fieldPreset === "originalHome" || !form?.fields.length;
  const fields = useMemo(() => normalizeLeadFormFields(form, fieldPreset), [form, fieldPreset]);
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(initialValues(fields));
    setErrors({});
  }, [fields]);

  const submitLead = useMutation({
    mutationFn: async () => {
      const nextErrors: Record<string, string> = {};
      for (const field of fields) {
        const value = values[field.name]?.trim() ?? "";
        if (field.required && (!value || (field.type === "checkbox" && value !== "true"))) {
          nextErrors[field.name] = `${field.label} is required.`;
        }
        if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          nextErrors[field.name] = "Enter a valid email address.";
        }
      }

      const hasContactField = fields.some((field) => field.name === "email" || field.name === "phone");
      if (hasContactField && !values.email?.trim() && !values.phone?.trim()) {
        nextErrors.phone = "Email or phone is required.";
      }

      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        throw new Error("Please complete the required fields.");
      }

      setErrors({});
      const attribution = getLeadAttribution();
      const submittedValues = {
        ...Object.fromEntries(fields.map((field) => [field.name, values[field.name]?.trim() ?? ""])),
        ...(attribution.landingPage && attribution.landingPage !== attribution.sourceUrl
          ? { landingPage: attribution.landingPage }
          : {}),
        ...(attribution.landingReferrer && attribution.landingReferrer !== attribution.referrer
          ? { landingReferrer: attribution.landingReferrer }
          : {}),
        ...attribution.trackingFields,
      };
      const firstTouchTrackingLabels = Object.fromEntries(
        Object.keys(attribution.trackingFields).map((key) => [key, `Landing ${leadTrackingParamLabels[key] ?? key}`]),
      );
      const fieldLabels = {
        ...Object.fromEntries(fields.map((field) => [field.name, field.label])),
        landingPage: "Landing Page",
        landingReferrer: "Landing Referrer",
        ...firstTouchTrackingLabels,
      };

      const response = await apiRequest("POST", "/api/crm/leads", {
        name: values.name?.trim() || "Website Lead",
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        service: values.service?.trim() || null,
        message: values.message?.trim() || "New website lead.",
        source: form?.slug ?? "website",
        fields: submittedValues,
        fieldLabels,
        sourceUrl: attribution.sourceUrl || null,
        referrer: attribution.referrer || null,
        notes: null,
        website: values.website?.trim() || "",
      });
      return response.status === 204 ? null : response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message Sent!",
        description: `Thanks for contacting ${identity.siteName}. Doug will be in touch shortly.`,
      });
      setValues(initialValues(fields));
    },
    onError: (error) => {
      if (error instanceof Error && error.message !== "Please complete the required fields.") {
        toast({
          title: "Message could not be sent",
          description: publicLeadSubmitErrorMessage(error),
          variant: "destructive",
        });
      }
    },
  });

  const updateValue = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const { [name]: _fieldError, ...rest } = current;
      return rest;
    });
  };

  const errorMessages = Object.values(errors);
  const formSpacing = isFallbackForm ? "space-y-4" : "space-y-6";
  const controlClassName = isFallbackForm ? "h-12" : undefined;
  const fieldLabelClassName = isFallbackForm ? "block text-sm font-medium" : undefined;

  return (
    <form
      className={formSpacing}
      onSubmit={(event) => {
        event.preventDefault();
        submitLead.mutate();
      }}
    >
      <input
        type="text"
        name="website"
        value={values.website ?? ""}
        onChange={(event) => updateValue("website", event.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      {errorMessages.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <div className="font-semibold">Please check the form</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errorMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      {fields.map((field) => {
        const error = errors[field.name];
        const value = values[field.name] ?? "";
        const fieldId = `${formInstanceId}-${field.id}`;
        const errorId = `${fieldId}-error`;
        const label = (
          <>
            {field.label}
            {field.required && !isFallbackForm && <span className="text-destructive"> *</span>}
          </>
        );

        if (field.type === "textarea") {
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={fieldId} className={fieldLabelClassName}>{label}</Label>
              <Textarea
                id={fieldId}
                className="min-h-[120px]"
                value={value}
                required={field.required}
                maxLength={500}
                placeholder={field.placeholder}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => updateValue(field.name, event.target.value)}
              />
              {error && <p id={errorId} className="text-sm text-destructive">{error}</p>}
            </div>
          );
        }

        if (field.type === "select") {
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={fieldId} className={fieldLabelClassName}>{label}</Label>
              <Select value={value || undefined} onValueChange={(nextValue) => updateValue(field.name, nextValue)}>
                <SelectTrigger id={fieldId} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}>
                  <SelectValue placeholder={field.placeholder || "Select an option"} />
                </SelectTrigger>
                <SelectContent>
                  {(field.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error && <p id={errorId} className="text-sm text-destructive">{error}</p>}
            </div>
          );
        }

        if (field.type === "checkbox") {
          return (
            <div key={field.id} className="space-y-2">
              <label htmlFor={fieldId} className="flex items-center gap-3 text-sm font-medium">
                <input
                  id={fieldId}
                  type="checkbox"
                  checked={value === "true"}
                  onChange={(event) => updateValue(field.name, event.target.checked ? "true" : "")}
                  required={field.required}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  className="h-4 w-4 rounded border"
                />
                {label}
              </label>
              {error && <p id={errorId} className="text-sm text-destructive">{error}</p>}
            </div>
          );
        }

        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldId} className={fieldLabelClassName}>{label}</Label>
            <Input
              id={fieldId}
              className={controlClassName}
              type={field.type === "tel" ? "tel" : field.type === "email" ? "email" : "text"}
              value={value}
              required={field.required}
              maxLength={500}
              placeholder={field.placeholder}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => updateValue(field.name, event.target.value)}
            />
            {error && <p id={errorId} className="text-sm text-destructive">{error}</p>}
          </div>
        );
      })}
      <Button type="submit" className="w-full h-12 text-lg" disabled={submitLead.isPending}>
        {submitLead.isPending ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}
