import "server-only";
import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import tls from "node:tls";
import type { SettingsData } from "@/lib/api/schemas";
import type { SessionPayload } from "@/lib/auth/session";
import { ALL_COLLEGES, UNIVERSITY } from "@/config/tenancy";
import { getStore } from "@/lib/data";
import { activeIntegration } from "@/lib/integrations/config";
import { publicHost } from "@/lib/integrations/test";
import { getCollege } from "./records";

/*
 * Branding & White Label. What an institution sees on this page starts from its own college record (name, city,
 * principal, official email, ...) and anything the administrator saved overrides it. The saved values are what the
 * whole portal wears: colours, name and logo are applied by the portal layout (brandStyle / resolveBrand), and the
 * domain and email checks talk to the real DNS, TLS and email provider.
 */

type Values = Record<string, string | boolean>;

const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN || "colossusiq.ai").toLowerCase();
export const CNAME_TARGET = (process.env.PLATFORM_CNAME_TARGET || `cname.${PLATFORM_DOMAIN}`).toLowerCase();

const NOT_VERIFIED = "Not verified yet";
const NOT_CHECKED = "Not checked";

const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "yahoo.in", "outlook.com", "hotmail.com", "rediffmail.com", "proton.me", "icloud.com"]);

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The academic year in progress, "2026-2027" (a new year starts in June). */
function academicYear(now = new Date(Date.now() + 5.5 * 3_600_000)): string {
  const y = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 5 ? y : y - 1;
  return `${start}-${start + 1}`;
}

/* ── the page: defaults from the college, then what was saved ───────────────────────────────── */

export async function brandingDefaults(scope: string): Promise<SettingsData> {
  const all = !scope || scope === ALL_COLLEGES;
  const c = all ? undefined : await getCollege(scope);
  const name = str(c?.name) || UNIVERSITY.name;
  const city = str(c?.city);
  const email = str(c?.email).toLowerCase();
  const domain = email.includes("@") ? (email.split("@")[1] ?? "") : "";
  const ownDomain = domain && !FREE_MAIL.has(domain) ? domain : "";
  const principal = str(c?.principal);
  const phone = str(c?.phone);
  const established = c?.established ? String(c.established) : "";

  const words = name.split(/\s+/).filter(Boolean);
  const short = all ? UNIVERSITY.shortName : words.length > 1 ? words.map((w) => w[0]).join("").toUpperCase().slice(0, 5) : name.slice(0, 4).toUpperCase();
  const sub = short.toLowerCase().replace(/[^a-z0-9]/g, "") || "campus";
  const fromAddress = (process.env.EMAIL_FROM || "").trim() || email;
  const footer = [name, city].filter(Boolean).join(", ") + (phone ? ` · ${phone}` : "") + (email ? ` · ${email}` : "");

  return {
    template: "settings",
    sections: [
      {
        title: "Identity & Visual Theme",
        description: "Institution name, logos, colors and styling across student and faculty portals.",
        fields: [
          { id: "name", label: "Display name", type: "text", value: name },
          { id: "shortName", label: "Short Name / Acronym", type: "text", value: short },
          { id: "tagline", label: "Motto / Tagline", type: "text", value: "" },
          { id: "established", label: "Established Year", type: "text", value: established },
          { id: "primary", label: "Primary Brand Colour", type: "color", value: "#1e2a5a" },
          { id: "accent", label: "Accent Gold/Amber Colour", type: "color", value: "#c9962b" },
          { id: "secondary", label: "Secondary / Surface Colour", type: "color", value: "#0f766e" },
          { id: "navDark", label: "Dark Navigation Bar", type: "toggle", value: true },
          { id: "logoPreset", label: "Logo Crest Emblem", type: "select", value: "Academic Crest", options: ["Academic Crest", "Classic University", "STEM & Technology", "Modern Shield"] },
          { id: "logoUrl", label: "Custom Logo URL", type: "text", value: "", help: "A public https:// image link. Shown in the portal sidebar instead of the crest." },
          { id: "faviconUrl", label: "Custom Favicon URL", type: "text", value: "" },
          { id: "borderRadius", label: "Interface Roundness", type: "select", value: "Modern (16px)", options: ["Compact (8px)", "Modern (16px)", "Soft (24px)"] },
          { id: "themePreset", label: "Theme Palette Preset", type: "select", value: "Imperial Navy & Gold", options: ["Imperial Navy & Gold", "Oxford Royal & Cyan", "Emerald Tech & Mint", "Crimson Academic & Ruby", "Midnight Violet & Amber", "Slate Minimalist"] },
        ],
      },
      {
        title: "Domain & White-Label",
        description: "Custom domain, DNS records, SSL certificates and platform attribution.",
        fields: [
          { id: "subdomain", label: "Subdomain", type: "text", value: `${sub}.${PLATFORM_DOMAIN}`, help: "Default access endpoint." },
          { id: "customDomain", label: "Custom Domain", type: "text", value: ownDomain ? `portal.${ownDomain}` : "", help: `Point a CNAME record for this name to ${CNAME_TARGET}, then press Verify.` },
          { id: "dnsCnameTarget", label: "CNAME Target", type: "text", value: CNAME_TARGET },
          { id: "dnsStatus", label: "DNS Status", type: "text", value: NOT_VERIFIED },
          { id: "sslStatus", label: "SSL Certificate", type: "text", value: NOT_CHECKED },
          { id: "forceHttps", label: "Enforce HTTPS Strict Transport", type: "toggle", value: true },
          { id: "hidePoweredBy", label: "Hide 'Powered by ColossusIQ' badge", type: "toggle", value: true },
          { id: "browserTitleFormat", label: "Browser Tab Title Format", type: "text", value: `{page} | ${name}` },
        ],
      },
      {
        title: "Academic Structure & Terminology",
        description: "System nomenclature displayed across courses, portals and reports.",
        fields: [
          { id: "termInstitution", label: "Institution Designation", type: "select", value: all ? "University" : "College", options: ["College", "Institute", "University", "Academy", "Autonomous Institution"] },
          { id: "termHod", label: "Department Head Designation", type: "select", value: "Head of Department (HOD)", options: ["Head of Department (HOD)", "Department Chair", "Program Director", "Dean of Department"] },
          { id: "termFaculty", label: "Teaching Staff Designation", type: "select", value: "Faculty", options: ["Faculty", "Professor", "Instructor", "Lecturer", "Academician"] },
          { id: "termStudentId", label: "Student Identifier Label", type: "select", value: "Roll Number", options: ["Roll Number", "Register Number", "Student ID", "Enrollment Number", "UID"] },
          { id: "termPeriod", label: "Academic Term Cycle", type: "select", value: "Semester", options: ["Semester", "Trimester", "Quarter", "Annual Term"] },
          { id: "academicYearCycle", label: "Active Academic Year", type: "text", value: academicYear() },
          { id: "gradingFormat", label: "Primary Grading Scale", type: "select", value: "10-Point CGPA Scale", options: ["10-Point CGPA Scale", "Percentage System (%)", "Letter Grade (A+ to F)", "4-Point GPA Scale"] },
          { id: "showNaacBadge", label: "Display NAAC Accreditation on Portal", type: "toggle", value: false },
          { id: "showNbaBadge", label: "Display NBA Accreditation on Portal", type: "toggle", value: false },
          { id: "showAicteId", label: "Display AICTE Approval Number", type: "toggle", value: false },
          { id: "aicteApprovalId", label: "AICTE Approval Reference ID", type: "text", value: "" },
        ],
      },
      {
        title: "Notification & Communication Templates",
        description: "Branded email, SMS and WhatsApp delivery sender configurations.",
        fields: [
          { id: "emailSenderName", label: "Email Sender Name", type: "text", value: name },
          { id: "emailSenderAddress", label: "From Email Address", type: "text", value: fromAddress, help: "Must be a sender your email provider has verified (Integrations & Setup → Email)." },
          { id: "emailReplyTo", label: "Reply-To Email Address", type: "text", value: email },
          { id: "emailHeaderColor", label: "Email Header Banner Colour", type: "color", value: "#1e2a5a" },
          { id: "emailFooterText", label: "Campus Address & Legal Footer", type: "text", value: footer },
          { id: "smsSenderId", label: "SMS DLT Sender ID (6 Chars)", type: "text", value: short.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase().padEnd(6, "X") },
          { id: "whatsappBranded", label: "Enable Official WhatsApp Business Sender", type: "toggle", value: false },
        ],
      },
      {
        title: "Certificates & Official Documents",
        description: "Institutional crest, border styling and signatures on generated certificates.",
        fields: [
          { id: "certHeader", label: "Official Certificate Header", type: "text", value: name.toUpperCase() },
          { id: "certAffiliation", label: "Affiliation / Accreditation Subtitle", type: "text", value: all ? "" : `Affiliated to ${UNIVERSITY.name} (${UNIVERSITY.shortName})` },
          { id: "certBorderStyle", label: "Certificate Border Styling", type: "select", value: "Classic Gold Guilloche", options: ["Classic Gold Guilloche", "Modern Dual Border", "Minimalist Slate", "Royal Ornamental"] },
          { id: "certPrimarySignatory", label: "Primary Signatory (Left)", type: "text", value: principal ? `${principal}, Principal` : "" },
          { id: "certSecondarySignatory", label: "Secondary Signatory (Right)", type: "text", value: "" },
          { id: "certShowQrVerification", label: "Include Anti-Fraud QR Verification Code", type: "toggle", value: true },
          { id: "certWatermarkEnabled", label: "Include Anti-Counterfeit Background Watermark", type: "toggle", value: true },
        ],
      },
      {
        title: "Language & AI Voice",
        description: "Default interface language and AI explanation voice.",
        fields: [
          { id: "ui-lang", label: "Default interface language", type: "select", value: "English", options: ["English", "Tamil", "Hindi"] },
          { id: "ai-lang", label: "Default AI explanation language", type: "select", value: "English", options: ["English", "Tamil", "Hindi", "Telugu", "Kannada", "Malayalam"] },
        ],
      },
    ],
  };
}

async function savedBranding(scope: string): Promise<Values | undefined> {
  const store = getStore().settings;
  return (
    ((await store.get(scope, "branding")) as Values | undefined) ??
    (scope !== ALL_COLLEGES ? ((await store.get(ALL_COLLEGES, "branding")) as Values | undefined) : undefined)
  );
}

/** Every branding field with the saved value laid over the college's defaults. */
export async function brandingValues(scope: string): Promise<Values> {
  const base = await brandingDefaults(scope);
  const saved = (await savedBranding(scope)) ?? {};
  const out: Values = {};
  for (const s of base.sections) for (const f of s.fields) out[f.id] = f.id in saved && saved[f.id] !== undefined ? saved[f.id]! : f.value;
  return out;
}

/* ── what the portal wears ───────────────────────────────────────────────────────────────────── */

export interface Brand {
  name: string;
  shortName: string;
  primary: string;
  accent: string;
  secondary: string;
  logoUrl: string;
  customised: boolean;
}

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback);

/** An image link the portal may load: https only. */
export function safeImageUrl(v: unknown): string {
  const raw = str(v);
  if (!raw || raw.length > 300) return "";
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : "";
  } catch {
    return "";
  }
}

export async function resolveBrand(scope: string): Promise<Brand> {
  const v = await brandingValues(scope);
  const saved = await savedBranding(scope);
  return {
    name: str(v.name),
    shortName: str(v.shortName),
    primary: hex(v.primary, "#1e2a5a"),
    accent: hex(v.accent, "#c9962b"),
    secondary: hex(v.secondary, "#0f766e"),
    logoUrl: safeImageUrl(v.logoUrl),
    customised: !!saved && Object.keys(saved).length > 0,
  };
}

/**
 * CSS that re-colours the portal with the institution's palette. Only validated #rrggbb values are written, so the
 * stylesheet can never carry anything an administrator typed. Dark mode gets a lighter tint of the same colours.
 */
export function brandStyle(b: Brand): string | null {
  if (!b.customised) return null;
  const { primary: p, accent: a } = b;
  return [
    `:root{--brand:${p};--brand-strong:color-mix(in oklab,${p} 80%,black);--brand-soft:color-mix(in oklab,${p} 10%,white);--brand-2:color-mix(in oklab,${p} 72%,white);--gold:${a};--gold-soft:color-mix(in oklab,${a} 16%,white);--ring:${a}}`,
    `.dark{--brand:color-mix(in oklab,${p} 52%,white);--brand-strong:color-mix(in oklab,${p} 34%,white);--brand-soft:color-mix(in oklab,${p} 38%,black);--brand-2:color-mix(in oklab,${p} 60%,white);--gold-soft:color-mix(in oklab,${a} 22%,black)}`,
  ].join("");
}

/* ── saving ──────────────────────────────────────────────────────────────────────────────────── */

const DOMAIN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Field-level problems with a branding save, keyed by field id (empty = fine). */
export function validateBranding(values: Values): Record<string, string> {
  const bad: Record<string, string> = {};
  for (const k of ["primary", "accent", "secondary", "emailHeaderColor"]) if (k in values && !HEX.test(String(values[k]))) bad[k] = "Use a colour like #1e2a5a";
  for (const k of ["logoUrl", "faviconUrl"]) if (str(values[k]) && !safeImageUrl(values[k])) bad[k] = "Use a public https:// link";
  if (str(values.customDomain) && !DOMAIN.test(str(values.customDomain).toLowerCase())) bad.customDomain = "Enter a domain like portal.example.edu.in";
  for (const k of ["emailSenderAddress", "emailReplyTo"]) if (str(values[k]) && !EMAIL.test(str(values[k]))) bad[k] = "Enter a valid email address";
  if (!str(values.name)) bad.name = "The display name cannot be empty";
  return bad;
}

/** A changed domain has not been checked yet: forget the old DNS and SSL results. */
export async function withDomainStatus(scope: string, values: Values): Promise<Values> {
  const before = str((await brandingValues(scope)).customDomain).toLowerCase();
  if (str(values.customDomain).toLowerCase() === before) return values;
  return { ...values, dnsStatus: NOT_VERIFIED, sslStatus: NOT_CHECKED };
}

/* ── domain check: real DNS and TLS ──────────────────────────────────────────────────────────── */

export interface DomainCheck {
  ok: boolean;
  domain: string;
  cname: string;
  status: "verified" | "pending" | "failed";
  message: string;
  ssl: string;
  latency: string;
  address: string;
  verifiedAt: string;
}

const dropDot = (s: string) => s.toLowerCase().replace(/\.$/, "");

function certificate(ip: string, domain: string): Promise<string> {
  return new Promise((resolve) => {
    const done = (s: string) => resolve(s);
    try {
      const sock = tls.connect({ host: ip, port: 443, servername: domain, timeout: 5000, rejectUnauthorized: false }, () => {
        const cert = sock.getPeerCertificate();
        const ok = sock.authorized;
        const reason = sock.authorizationError ? String(sock.authorizationError) : "";
        sock.end();
        if (!cert || !cert.valid_to) return done("No certificate was presented");
        const until = new Date(cert.valid_to).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const issuer = (cert.issuer && (cert.issuer.O || cert.issuer.CN)) || "unknown issuer";
        done(ok ? `Active (${issuer}, valid until ${until})` : `Certificate problem: ${reason || "not trusted"} (${issuer}, until ${until})`);
      });
      sock.on("timeout", () => {
        sock.destroy();
        done("No HTTPS response yet (timed out)");
      });
      sock.on("error", () => done("No HTTPS response yet"));
    } catch {
      done("No HTTPS response yet");
    }
  });
}

export async function verifyDomain(session: SessionPayload, raw: string): Promise<DomainCheck> {
  const domain = raw.trim().toLowerCase();
  const base = { domain, cname: CNAME_TARGET, verifiedAt: new Date().toISOString(), address: "", ssl: NOT_CHECKED, latency: "-" };
  if (!DOMAIN.test(domain)) return { ...base, ok: false, status: "failed", message: "Enter a valid domain such as portal.example.edu.in." };

  const t0 = Date.now();
  const cnames = (await dns.resolveCname(domain).catch(() => [] as string[])).map(dropDot);
  let pointed = cnames.includes(CNAME_TARGET);
  let addresses: string[] = [];
  if (!pointed) {
    // An apex or flattened record answers with addresses instead of a CNAME: compare with the platform's own.
    const [mine, theirs] = await Promise.all([dns.resolve4(domain).catch(() => [] as string[]), dns.resolve4(CNAME_TARGET).catch(() => [] as string[])]);
    addresses = mine;
    pointed = mine.length > 0 && mine.some((a) => theirs.includes(a));
  }
  const latency = `${Date.now() - t0}ms`;

  let result: DomainCheck;
  if (!pointed) {
    const found = cnames.length ? `It points to ${cnames[0]}.` : "No CNAME record was found.";
    result = { ...base, latency, ok: false, status: cnames.length || addresses.length ? "failed" : "pending", message: `${found} Create a CNAME for ${domain} pointing to ${CNAME_TARGET}; DNS changes can take a while to spread.` };
  } else {
    const ip = (addresses[0] ?? (await dns.resolve4(domain).catch(() => [] as string[]))[0]) || "";
    // Only ask for the certificate of a public address (never an internal one) and connect to the address we checked.
    const ssl = ip && isIP(ip) && publicHost(ip) ? await certificate(ip, domain) : "No public address to check";
    result = { ...base, latency, address: ip, ssl, ok: true, status: "verified", message: `${domain} points to ${CNAME_TARGET}.` };
  }

  // The result is remembered only for the domain that is saved; a domain still being typed is just a test.
  const saved = await brandingValues(session.college);
  if (str(saved.customDomain).toLowerCase() === domain) {
    const store = getStore().settings;
    const current = (await store.get(session.college, "branding")) ?? {};
    await store.save(session.college, "branding", { ...current, dnsStatus: result.ok ? `Verified (${result.latency})` : result.status === "pending" ? "Waiting for DNS" : "Not pointing to the platform", sslStatus: result.ssl });
  }
  await getStore().audit.add({
    actor: session.name,
    action: `Checked DNS for ${domain}: ${result.status}`,
    target: domain,
    collegeId: session.college === ALL_COLLEGES ? null : session.college,
    actorSub: session.sub,
  });
  return result;
}

/* ── branded test email: sent through the connected email provider ───────────────────────────── */

export interface TestEmail {
  ok: boolean;
  recipient: string;
  subject: string;
  message: string;
  deliveredAt?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendTestEmail(session: SessionPayload, to: string): Promise<TestEmail> {
  const recipient = to.trim();
  const subject = "Branded email preview";
  if (!EMAIL.test(recipient)) return { ok: false, recipient, subject, message: "Enter a valid email address to send the preview to." };

  const email = await activeIntegration("email");
  if (!email?.provider) return { ok: false, recipient, subject, message: "No email provider is connected. Set one up under Integrations & Setup → Email, then try again." };

  const v = await brandingValues(session.college);
  const name = str(v.name);
  const fromAddress = str(v.emailSenderAddress);
  if (!EMAIL.test(fromAddress)) return { ok: false, recipient, subject, message: "Set a valid From Email Address first." };
  const from = `${str(v.emailSenderName) || name} <${fromAddress}>`;
  const replyTo = EMAIL.test(str(v.emailReplyTo)) ? str(v.emailReplyTo) : undefined;
  const header = hex(v.emailHeaderColor, "#1e2a5a");
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e4dfd3;border-radius:12px;overflow:hidden"><div style="background:${header};color:#fff;padding:20px 24px;font-size:18px;font-weight:bold">${esc(name)}</div><div style="padding:24px;color:#1b2233;font-size:14px;line-height:1.6">This is a preview of the emails ${esc(name)} sends from ColossusIQ: fee reminders, notices and results use this sender name, address and header colour.</div><div style="padding:14px 24px;background:#f3f0e8;color:#6b7285;font-size:12px">${esc(str(v.emailFooterText))}</div></div>`;
  const text = `This is a preview of the emails ${name} sends from ColossusIQ.\n\n${str(v.emailFooterText)}`;

  const key = email.secrets.apiKey;
  let res: Response | null = null;
  try {
    if (email.provider === "resend" && key) {
      res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [recipient], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }), signal: AbortSignal.timeout(10_000) });
    } else if (email.provider === "sendgrid" && key) {
      res = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: recipient }] }], from: { email: fromAddress, name: str(v.emailSenderName) || name }, ...(replyTo ? { reply_to: { email: replyTo } } : {}), subject, content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }] }), signal: AbortSignal.timeout(10_000) });
    } else {
      return { ok: false, recipient, subject, message: `Preview emails are sent through Resend or SendGrid. Your connected provider (${email.provider}) can be checked under Integrations & Setup.` };
    }
  } catch {
    return { ok: false, recipient, subject, message: "The email provider did not respond. Try again in a moment." };
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return { ok: false, recipient, subject, message: `The provider refused the email (${res.status}). ${detail}`.trim() };
  }
  await getStore().audit.add({
    actor: session.name,
    action: "Sent white-label test email preview",
    target: recipient,
    collegeId: session.college === ALL_COLLEGES ? null : session.college,
    actorSub: session.sub,
  });
  return { ok: true, recipient, subject, message: `Preview sent to ${recipient}.`, deliveredAt: new Date().toISOString() };
}
