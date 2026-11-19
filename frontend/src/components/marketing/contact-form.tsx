"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { cleanText } from "@/lib/security/sanitize";
import { Button, Field, inputClass } from "@/components/ui/primitives";

const ContactInput = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(120),
  institution: z.string().trim().min(2, "Enter your institution").max(120),
  role: z.enum(["Principal / Leadership", "Registrar / Admin", "HOD / Faculty", "Placement / Incubation", "Other"]),
  students: z.enum(["< 1,000", "1,000–5,000", "5,000–20,000", "20,000+"]),
  message: z.string().trim().max(1000).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree to be contacted" }) }),
  // Honeypot: real users never see or fill this field.
  website: z.string().max(0).optional(),
});

export function ContactForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = {
      name: cleanText(String(fd.get("name") ?? ""), 80),
      email: String(fd.get("email") ?? ""),
      institution: cleanText(String(fd.get("institution") ?? ""), 120),
      role: String(fd.get("role") ?? ""),
      students: String(fd.get("students") ?? ""),
      message: cleanText(String(fd.get("message") ?? ""), 1000),
      consent: fd.get("consent") === "on",
      website: String(fd.get("website") ?? ""),
    };
    const parsed = ContactInput.safeParse(raw);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    // Demo: no network call is made. In production this posts to the CRM endpoint with CSRF + rate limiting.
    setDone(true);
  };

  if (done)
    return (
      <div className="py-10 text-center" role="status">
        <CheckCircle2 className="mx-auto size-10 text-teal" />
        <p className="mt-3 text-xl font-semibold text-ink">Thank you!</p>
        <p className="mt-1 text-ink-2">Your details were validated. (Demo — nothing was sent.)</p>
      </div>
    );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Field label="Full name" htmlFor="c-name" error={errors.name}>
        <input id="c-name" name="name" autoComplete="name" maxLength={80} className={inputClass} />
      </Field>
      <Field label="Work email" htmlFor="c-email" error={errors.email}>
        <input id="c-email" name="email" type="email" autoComplete="email" maxLength={120} className={inputClass} />
      </Field>
      <Field label="Institution" htmlFor="c-inst" error={errors.institution}>
        <input id="c-inst" name="institution" autoComplete="organization" maxLength={120} className={inputClass} />
      </Field>
      <Field label="Your role" htmlFor="c-role" error={errors.role}>
        <select id="c-role" name="role" className={inputClass} defaultValue="Principal / Leadership">
          {ContactInput.shape.role.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      <Field label="Number of students" htmlFor="c-students" error={errors.students}>
        <select id="c-students" name="students" className={inputClass} defaultValue="1,000–5,000">
          {ContactInput.shape.students.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      <div className="hidden" aria-hidden>
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <Field label="What would you like to achieve? (optional)" htmlFor="c-msg" error={errors.message}>
          <textarea id="c-msg" name="message" rows={4} maxLength={1000} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <label className="flex items-start gap-2 text-sm text-ink-2">
          <input type="checkbox" name="consent" className="mt-1 accent-[var(--brand)]" />
          I agree to be contacted about ColossusIQ. We never share your details with third parties.
        </label>
        {errors.consent ? <p className="mt-1 text-xs text-rose">{errors.consent}</p> : null}
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg">
          Request a demo
        </Button>
      </div>
    </form>
  );
}
