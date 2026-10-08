"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Award,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Languages,
  Laptop,
  Lock,
  Mail,
  Moon,
  Palette,
  QrCode,
  RefreshCw,
  Send,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Undo2,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { SettingsData, UpdateSettingsReply } from "@/lib/api/schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  inputClass,
  Progress,
  Spinner,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

// ── Preset Themes ───────────────────────────────────────────
const THEME_PRESETS = [
  {
    id: "Imperial Navy & Gold",
    name: "Imperial Navy & Gold",
    primary: "#1e2a5a",
    accent: "#c9962b",
    secondary: "#0f766e",
    tagline: "Prestigious engineering & academic institutions",
  },
  {
    id: "Oxford Royal & Cyan",
    name: "Oxford Royal & Cyan",
    primary: "#1e3a8a",
    accent: "#06b6d4",
    secondary: "#2563eb",
    tagline: "Contemporary tech universities & autonomous institutes",
  },
  {
    id: "Emerald Tech & Mint",
    name: "Emerald Tech & Mint",
    primary: "#065f46",
    accent: "#10b981",
    secondary: "#047857",
    tagline: "Polytechnic, applied science & research centers",
  },
  {
    id: "Crimson Academic & Ruby",
    name: "Crimson Academic & Ruby",
    primary: "#881337",
    accent: "#f43f5e",
    secondary: "#9f1239",
    tagline: "Heritage universities & arts and science colleges",
  },
  {
    id: "Midnight Violet & Amber",
    name: "Midnight Violet & Amber",
    primary: "#4c1d95",
    accent: "#f59e0b",
    secondary: "#6d28d9",
    tagline: "Innovative management & design schools",
  },
  {
    id: "Slate Minimalist",
    name: "Slate Minimalist",
    primary: "#1e293b",
    accent: "#3b82f6",
    secondary: "#475569",
    tagline: "Clean, ultra-modern corporate white-labeling",
  },
];

// ── Crest Emblem Presets (SVG Paths) ─────────────────────────
const CREST_PRESETS: Record<string, { label: string; icon: React.ReactNode }> = {
  "Academic Crest": {
    label: "Academic Shield",
    icon: (
      <svg viewBox="0 0 48 48" className="size-full fill-current">
        <path d="M24 4L8 10V22C8 32 15 40 24 44C33 40 40 32 40 22V10L24 4Z" fillOpacity="0.18" />
        <path d="M24 6L10 11.2V22C10 30.5 16.2 37.6 24 41.5C31.8 37.6 38 30.5 38 22V11.2L24 6Z" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <path d="M24 14V34M17 18L31 30M31 18L17 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="24" r="5" fill="currentColor" />
      </svg>
    ),
  },
  "Classic University": {
    label: "Classical Pillars",
    icon: (
      <svg viewBox="0 0 48 48" className="size-full fill-current">
        <path d="M24 6L6 14V17H42V14L24 6Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2" />
        <rect x="10" y="20" width="5" height="16" rx="1.5" fill="currentColor" />
        <rect x="18.5" y="20" width="5" height="16" rx="1.5" fill="currentColor" />
        <rect x="27" y="20" width="5" height="16" rx="1.5" fill="currentColor" />
        <rect x="35" y="20" width="5" height="16" rx="1.5" fill="currentColor" />
        <rect x="6" y="38" width="36" height="4" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  "STEM & Technology": {
    label: "Atom & Circuit",
    icon: (
      <svg viewBox="0 0 48 48" className="size-full fill-current">
        <circle cx="24" cy="24" r="5" fill="currentColor" />
        <ellipse cx="24" cy="24" rx="18" ry="7" stroke="currentColor" strokeWidth="2" fill="none" transform="rotate(30 24 24)" />
        <ellipse cx="24" cy="24" rx="18" ry="7" stroke="currentColor" strokeWidth="2" fill="none" transform="rotate(-30 24 24)" />
        <ellipse cx="24" cy="24" rx="18" ry="7" stroke="currentColor" strokeWidth="2" fill="none" transform="rotate(90 24 24)" />
      </svg>
    ),
  },
  "Modern Shield": {
    label: "Geometric Laurel",
    icon: (
      <svg viewBox="0 0 48 48" className="size-full fill-current">
        <polygon points="24,6 38,14 38,34 24,42 10,34 10,14" stroke="currentColor" strokeWidth="2.5" fill="currentColor" fillOpacity="0.15" />
        <polygon points="24,14 32,19 32,29 24,34 16,29 16,19" fill="currentColor" />
      </svg>
    ),
  },
};

type ActiveTab = "visual" | "domain" | "academic" | "notifications" | "certificates" | "languages";
type PreviewMode = "portal" | "login" | "certificate" | "email";

export function BrandingModule() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["module", "branding"],
    queryFn: () => apiFetch("/api/v1/modules/branding", SettingsData),
  });

  if (isLoading) return <TemplateSkeleton />;
  if (error || !data) return <LoadError error={error} onRetry={() => void refetch()} />;

  return <BrandingEditor key={JSON.stringify(data.sections)} data={data} onSaveSuccess={() => void qc.invalidateQueries({ queryKey: ["module", "branding"] })} />;
}

function BrandingEditor({ data, onSaveSuccess }: { data: SettingsData; onSaveSuccess: () => void }) {
  const initial = useMemo(() => {
    return Object.fromEntries(data.sections.flatMap((s) => s.fields.map((f) => [f.id, f.value])));
  }, [data]);

  const [values, setValues] = useState<Record<string, string | boolean>>(initial);
  const [activeTab, setActiveTab] = useState<ActiveTab>("visual");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("portal");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewDark, setPreviewDark] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ tone: "teal" | "rose" | "brand"; message: string } | null>(null);
  const [dnsCheckResult, setDnsCheckResult] = useState<{ verified: boolean; domain: string; latency?: string; ssl?: string; edgeNode?: string } | null>(null);
  const [isVerifyingDns, setIsVerifyingDns] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [copiedTokens, setCopiedTokens] = useState(false);

  const isDirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);

  const setField = (id: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, string | boolean>) => {
      return apiFetch("/api/v1/modules/branding", UpdateSettingsReply, {
        method: "PUT",
        body: { values: payload },
      });
    },
    onSuccess: () => {
      setNotification({ tone: "teal", message: "White-label branding saved successfully! Changes are live across all portals." });
      onSaveSuccess();
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (err) => {
      setNotification({
        tone: "rose",
        message: err instanceof ApiError ? err.message : "Failed to save branding settings.",
      });
    },
  });

  const handleVerifyDns = async () => {
    setIsVerifyingDns(true);
    try {
      const res = await apiFetch("/api/v1/branding/dns-verify", z.object({
        ok: z.boolean(),
        domain: z.string(),
        cname: z.string(),
        status: z.string(),
        ssl: z.string(),
        latency: z.string(),
        edgeNode: z.string(),
      }), {
        method: "POST",
        body: { domain: String(values["customDomain"] || "portal.ait.edu.in") },
      });
      setDnsCheckResult({
        verified: res.ok,
        domain: res.domain,
        latency: res.latency,
        ssl: res.ssl,
        edgeNode: res.edgeNode,
      });
      setField("dnsStatus", "Verified & Propagated (Active)");
      setField("sslStatus", res.ssl);
      setNotification({ tone: "teal", message: `DNS and SSL verified for ${res.domain}. Response time: ${res.latency} via ${res.edgeNode}.` });
    } catch {
      setNotification({ tone: "rose", message: "DNS verification failed. Ensure CNAME points to cname.colossusiq.ai" });
    } finally {
      setIsVerifyingDns(false);
    }
  };

  const handleSendTestEmail = async () => {
    setIsSendingEmail(true);
    try {
      const res = await apiFetch("/api/v1/branding/test-email", z.object({
        ok: z.boolean(),
        recipient: z.string(),
        subject: z.string(),
      }), {
        method: "POST",
        body: { to: String(values["emailSenderAddress"] || "office@ait.edu.in") },
      });
      setNotification({ tone: "brand", message: `Test white-label notification delivered to ${res.recipient}!` });
    } catch {
      setNotification({ tone: "rose", message: "Could not send test email." });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm("Reset all white-label branding configurations back to default?")) return;
    try {
      await apiFetch("/api/v1/branding/reset", z.object({ ok: z.boolean() }), { method: "POST" });
      setNotification({ tone: "brand", message: "Branding reset to system default." });
      onSaveSuccess();
    } catch {
      setNotification({ tone: "rose", message: "Could not reset branding." });
    }
  };

  const applyPreset = (preset: typeof THEME_PRESETS[number]) => {
    setValues((prev) => ({
      ...prev,
      primary: preset.primary,
      accent: preset.accent,
      secondary: preset.secondary,
      themePreset: preset.id,
      emailHeaderColor: preset.primary,
    }));
    setNotification({ tone: "brand", message: `Applied palette: ${preset.name}` });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCopyTokens = () => {
    const cssVars = `/* ColossusIQ Institutional White-Label Theme Tokens */
:root {
  --brand-primary: ${values["primary"] || "#1e2a5a"};
  --brand-accent: ${values["accent"] || "#c9962b"};
  --brand-secondary: ${values["secondary"] || "#0f766e"};
  --brand-subdomain: "${values["subdomain"] || "ait.colossusiq.ai"}";
  --brand-domain: "${values["customDomain"] || "portal.ait.edu.in"}";
  --brand-institution: "${values["name"] || "Anna Institute of Technology"}";
  --brand-acronym: "${values["shortName"] || "AIT"}";
}`;
    navigator.clipboard.writeText(cssVars);
    setCopiedTokens(true);
    setTimeout(() => setCopiedTokens(false), 2500);
  };

  // Branding Completeness Score Calculation
  const brandScore = useMemo(() => {
    let score = 0;
    if (values["name"]) score += 20;
    if (values["primary"] && values["accent"]) score += 20;
    if (values["subdomain"]) score += 15;
    if (values["customDomain"]) score += 15;
    if (values["emailSenderName"] && values["emailSenderAddress"]) score += 15;
    if (values["certHeader"]) score += 15;
    return Math.min(100, score);
  }, [values]);

  const institutionName = String(values["name"] || "Anna Institute of Technology");
  const acronym = String(values["shortName"] || "AIT");
  const primaryColor = String(values["primary"] || "#1e2a5a");
  const accentColor = String(values["accent"] || "#c9962b");
  const secondaryColor = String(values["secondary"] || "#0f766e");
  const activePresetLogo = String(values["logoPreset"] || "Academic Crest");
  const fallbackCrest = CREST_PRESETS["Academic Crest"]!;
  const selectedCrest = CREST_PRESETS[activePresetLogo] ?? fallbackCrest;
  const termStudentId = String(values["termStudentId"] || "Roll Number");
  const termPeriod = String(values["termPeriod"] || "Semester");
  const customDomain = String(values["customDomain"] || "portal.ait.edu.in");
  const subdomain = String(values["subdomain"] || "ait.colossusiq.ai");

  return (
    <div className="space-y-6">
      {/* ── Top Overview Banner & Live Controls ── */}
      <Card className="border-line/80 bg-gradient-to-r from-surface via-surface to-surface-2/40 shadow-sm">
        <CardBody className="p-5 sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Institution Brand Badge & Score */}
            <div className="flex items-center gap-4">
              <div
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-md transition-colors"
                style={{ backgroundColor: primaryColor, color: accentColor }}
              >
                <div className="size-8">{selectedCrest.icon}</div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{institutionName}</h2>
                  <Badge tone="brand" className="font-mono text-xs">{acronym}</Badge>
                  {values["hidePoweredBy"] ? (
                    <Badge tone="teal" className="gap-1">
                      <ShieldCheck className="size-3" /> White-Label Active
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Standard Brand</Badge>
                  )}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-3">
                  <span className="flex items-center gap-1 font-mono text-ink-2">
                    <Globe className="size-3.5 text-teal" /> {customDomain}
                  </span>
                  <span>•</span>
                  <span>SSL: TLS 1.3 Active</span>
                  <span>•</span>
                  <span>Subdomain: {subdomain}</span>
                </p>
              </div>
            </div>

            {/* Quick Actions & Brand Health */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/80 px-3.5 py-2">
                <div className="text-right">
                  <p className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">Brand Score</p>
                  <p className="text-base font-bold text-ink">{brandScore}% Complete</p>
                </div>
                <div className="w-16">
                  <Progress value={brandScore} tone={brandScore >= 80 ? "teal" : "brand"} className="h-2" />
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyTokens}
                className="gap-1.5 text-xs font-semibold"
                title="Copy CSS variables for developer handoff"
              >
                {copiedTokens ? <Check className="size-3.5 text-teal" /> : <Copy className="size-3.5" />}
                {copiedTokens ? "Copied Tokens" : "Export CSS Tokens"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetDefaults}
                className="gap-1 text-xs text-ink-3 hover:text-rose"
                title="Reset to default"
              >
                <Undo2 className="size-3.5" /> Reset
              </Button>

              <Button
                variant="primary"
                size="md"
                disabled={!isDirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate(values)}
                className="gap-2 shadow-sm"
              >
                {saveMutation.isPending ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
                <span>{isDirty ? "Save All Changes" : "Saved"}</span>
              </Button>
            </div>
          </div>

          {/* Toast Notification Banner */}
          {notification && (
            <div
              className={cn(
                "mt-4 flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-medium transition-all animate-in fade-in slide-in-from-top-1",
                notification.tone === "teal" && "bg-teal-soft text-teal border border-teal/20",
                notification.tone === "rose" && "bg-rose-soft text-rose border border-rose/20",
                notification.tone === "brand" && "bg-brand-soft text-brand border border-brand/20",
              )}
            >
              <div className="flex items-center gap-2">
                {notification.tone === "teal" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
                <span>{notification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="text-current opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Main Two-Column Layout: Form Tabs (Left) + Interactive Live Canvas (Right) ── */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Left Column: Configuration Panels */}
        <div className="space-y-6">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line pb-2">
            {[
              { id: "visual", label: "Visual Identity", icon: Palette },
              { id: "domain", label: "Domain & White-Label", icon: Globe },
              { id: "academic", label: "Academic Terms", icon: Building2 },
              { id: "notifications", label: "Emails & Alerts", icon: Mail },
              { id: "certificates", label: "Certificates", icon: Award },
              { id: "languages", label: "Language & AI", icon: Languages },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-brand text-white shadow-sm"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── TAB 1: Visual Identity ── */}
          {activeTab === "visual" && (
            <div className="space-y-6">
              {/* One-Click Theme Preset Bar */}
              <Card>
                <CardHeader
                  title="One-Click Enterprise Palettes"
                  subtitle="Instantly apply accredited university color harmonies"
                />
                <CardBody className="pt-2">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {THEME_PRESETS.map((preset) => {
                      const isSelected = values["themePreset"] === preset.id || values["primary"] === preset.primary;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className={cn(
                            "flex flex-col rounded-xl border p-3 text-left transition-all hover:scale-[1.01]",
                            isSelected
                              ? "border-brand bg-brand-soft/30 ring-2 ring-brand/20 shadow-sm"
                              : "border-line bg-surface hover:border-brand/40",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-ink">{preset.name}</span>
                            {isSelected && <Check className="size-3.5 text-brand" />}
                          </div>
                          <div className="mt-2.5 flex items-center gap-1.5">
                            <span className="size-4.5 rounded-full border border-white/20 shadow-xs" style={{ backgroundColor: preset.primary }} />
                            <span className="size-4.5 rounded-full border border-white/20 shadow-xs" style={{ backgroundColor: preset.accent }} />
                            <span className="size-4.5 rounded-full border border-white/20 shadow-xs" style={{ backgroundColor: preset.secondary }} />
                          </div>
                          <span className="mt-2 line-clamp-1 text-[10px] text-ink-3">{preset.tagline}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>

              {/* Core Colors & Styling */}
              <Card>
                <CardHeader
                  title="Core Brand Colors & Aesthetics"
                  subtitle="Primary colors used across the navigation bar, buttons, badges and charts"
                />
                <CardBody className="space-y-4 pt-2">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Primary Brand Color" htmlFor="primary">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          id="primary"
                          value={primaryColor}
                          onChange={(e) => setField("primary", e.target.value)}
                          className="size-10 cursor-pointer rounded-lg border border-line p-1 bg-surface"
                        />
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setField("primary", e.target.value)}
                          className={cn(inputClass, "font-mono uppercase text-xs")}
                        />
                      </div>
                    </Field>

                    <Field label="Accent Gold / Highlight" htmlFor="accent">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          id="accent"
                          value={accentColor}
                          onChange={(e) => setField("accent", e.target.value)}
                          className="size-10 cursor-pointer rounded-lg border border-line p-1 bg-surface"
                        />
                        <input
                          type="text"
                          value={accentColor}
                          onChange={(e) => setField("accent", e.target.value)}
                          className={cn(inputClass, "font-mono uppercase text-xs")}
                        />
                      </div>
                    </Field>

                    <Field label="Secondary / Surface Tint" htmlFor="secondary">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          id="secondary"
                          value={secondaryColor}
                          onChange={(e) => setField("secondary", e.target.value)}
                          className="size-10 cursor-pointer rounded-lg border border-line p-1 bg-surface"
                        />
                        <input
                          type="text"
                          value={secondaryColor}
                          onChange={(e) => setField("secondary", e.target.value)}
                          className={cn(inputClass, "font-mono uppercase text-xs")}
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="grid gap-4 pt-2 sm:grid-cols-2">
                    <Field label="Navigation Bar Tint" htmlFor="navDark">
                      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3.5 hover:bg-surface-2/40">
                        <div>
                          <p className="text-xs font-semibold text-ink">Dark Executive Navigation</p>
                          <p className="text-[11px] text-ink-3">Render the main portal navbar in deep brand tint</p>
                        </div>
                        <input
                          type="checkbox"
                          id="navDark"
                          checked={Boolean(values["navDark"])}
                          onChange={(e) => setField("navDark", e.target.checked)}
                          className="size-4.5 rounded accent-brand"
                        />
                      </label>
                    </Field>

                    <Field label="Interface Roundness" htmlFor="borderRadius">
                      <select
                        id="borderRadius"
                        value={String(values["borderRadius"] || "Modern (16px)")}
                        onChange={(e) => setField("borderRadius", e.target.value)}
                        className={inputClass}
                      >
                        <option value="Compact (8px)">Compact (8px)</option>
                        <option value="Modern (16px)">Modern (16px)</option>
                        <option value="Soft (24px)">Soft (24px)</option>
                      </select>
                    </Field>
                  </div>
                </CardBody>
              </Card>

              {/* Institution Identity & Logos */}
              <Card>
                <CardHeader
                  title="Official Institution Identity"
                  subtitle="Institutional name, acronym and heraldic crest displayed to students and recruiters"
                />
                <CardBody className="space-y-4 pt-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Official Display Name" htmlFor="name">
                      <input
                        type="text"
                        id="name"
                        value={institutionName}
                        onChange={(e) => setField("name", e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Anna Institute of Technology"
                      />
                    </Field>

                    <Field label="Acronym / Short Code" htmlFor="shortName">
                      <input
                        type="text"
                        id="shortName"
                        value={acronym}
                        onChange={(e) => setField("shortName", e.target.value)}
                        className={inputClass}
                        placeholder="e.g. AIT"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Motto / Institutional Tagline" htmlFor="tagline">
                      <input
                        type="text"
                        id="tagline"
                        value={String(values["tagline"] || "")}
                        onChange={(e) => setField("tagline", e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Excellence in Engineering & Research"
                      />
                    </Field>

                    <Field label="Year Established" htmlFor="established">
                      <input
                        type="text"
                        id="established"
                        value={String(values["established"] || "2001")}
                        onChange={(e) => setField("established", e.target.value)}
                        className={inputClass}
                        placeholder="e.g. 2001"
                      />
                    </Field>
                  </div>

                  {/* Heraldic Crest Presets */}
                  <div className="pt-2">
                    <label className="block text-xs font-medium text-ink mb-2">Select Heraldic Emblem Style</label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {Object.entries(CREST_PRESETS).map(([key, item]) => {
                        const isChosen = activePresetLogo === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setField("logoPreset", key)}
                            className={cn(
                              "flex flex-col items-center justify-center rounded-xl border p-3.5 transition-all",
                              isChosen
                                ? "border-brand bg-brand-soft/40 shadow-xs ring-2 ring-brand/20 text-brand"
                                : "border-line bg-surface hover:border-brand/40 text-ink-2",
                            )}
                          >
                            <div className="size-10">{item.icon}</div>
                            <span className="mt-2 text-xs font-semibold text-ink">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Field label="Custom Logo Image URL (Optional)" htmlFor="logoUrl" hint="PNG or SVG with transparent background">
                    <input
                      type="text"
                      id="logoUrl"
                      value={String(values["logoUrl"] || "")}
                      onChange={(e) => setField("logoUrl", e.target.value)}
                      className={inputClass}
                      placeholder="https://yourcollege.edu/assets/logo.png"
                    />
                  </Field>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── TAB 2: Domain & White-Label ── */}
          {activeTab === "domain" && (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="White-Label Domains & Subdomains"
                  subtitle="Configure your institution's branded domain with automated DNS & TLS encryption"
                />
                <CardBody className="space-y-4 pt-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Assigned Subdomain" htmlFor="subdomain" hint="Provided ColossusIQ Cloud endpoint">
                      <div className="flex rounded-xl border border-line bg-surface overflow-hidden">
                        <input
                          type="text"
                          id="subdomain"
                          value={String(values["subdomain"] || "").replace(/\.colossusiq\.ai$/, "")}
                          onChange={(e) => setField("subdomain", `${e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")}.colossusiq.ai`)}
                          className="w-full bg-transparent px-3 py-2 text-xs font-mono text-ink focus:outline-none"
                        />
                        <span className="flex items-center bg-surface-2 px-3 text-xs text-ink-3">.colossusiq.ai</span>
                      </div>
                    </Field>

                    <Field label="Dedicated Custom Domain" htmlFor="customDomain" hint="Your college official domain">
                      <input
                        type="text"
                        id="customDomain"
                        value={customDomain}
                        onChange={(e) => setField("customDomain", e.target.value)}
                        className={cn(inputClass, "font-mono text-xs")}
                        placeholder="portal.anna-tech.edu.in"
                      />
                    </Field>
                  </div>

                  {/* DNS Record Helper & Verification Box */}
                  <div className="rounded-2xl border border-line/80 bg-surface-2/40 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-teal" />
                          <h4 className="text-xs font-bold text-ink uppercase tracking-wider">DNS CNAME Setup</h4>
                        </div>
                        <p className="mt-1 text-xs text-ink-3">
                          Add this CNAME record in your domain registrar (GoDaddy, Cloudflare, Route53, etc.)
                        </p>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleVerifyDns}
                        disabled={isVerifyingDns}
                        className="gap-2 shrink-0 font-semibold text-xs"
                      >
                        {isVerifyingDns ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
                        <span>Verify DNS & SSL</span>
                      </Button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono sm:grid-cols-4">
                      <div className="rounded-lg bg-surface p-2 border border-line/60">
                        <span className="text-[10px] text-ink-3 block uppercase">Type</span>
                        <span className="font-bold text-ink">CNAME</span>
                      </div>
                      <div className="rounded-lg bg-surface p-2 border border-line/60">
                        <span className="text-[10px] text-ink-3 block uppercase">Host</span>
                        <span className="font-bold text-ink">portal</span>
                      </div>
                      <div className="rounded-lg bg-surface p-2 border border-line/60">
                        <span className="text-[10px] text-ink-3 block uppercase">Target Value</span>
                        <span className="font-bold text-teal truncate block">cname.colossusiq.ai</span>
                      </div>
                      <div className="rounded-lg bg-surface p-2 border border-line/60">
                        <span className="text-[10px] text-ink-3 block uppercase">Status</span>
                        <span className="font-bold text-teal flex items-center gap-1">
                          <Check className="size-3" /> Active
                        </span>
                      </div>
                    </div>

                    {dnsCheckResult && (
                      <div className="mt-3 rounded-xl border border-teal/30 bg-teal-soft/30 p-3 text-xs text-teal">
                        <p className="font-semibold">✓ DNS Propagated Globally</p>
                        <p className="mt-0.5 text-[11px] text-ink-2">
                          Edge Node: {dnsCheckResult.edgeNode} • SSL: {dnsCheckResult.ssl} • Ping: {dnsCheckResult.latency}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3.5 hover:bg-surface-2/40">
                      <div>
                        <p className="text-xs font-semibold text-ink">Enforce Strict HTTPS & HSTS</p>
                        <p className="text-[11px] text-ink-3">Always redirect unencrypted traffic and require modern TLS 1.3</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(values["forceHttps"])}
                        onChange={(e) => setField("forceHttps", e.target.checked)}
                        className="size-4.5 rounded accent-brand"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3.5 hover:bg-surface-2/40">
                      <div>
                        <p className="text-xs font-semibold text-ink">Pure White-Label (Hide "Powered by ColossusIQ")</p>
                        <p className="text-[11px] text-ink-3">Remove all platform watermarks, vendor links and footer badges</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(values["hidePoweredBy"])}
                        onChange={(e) => setField("hidePoweredBy", e.target.checked)}
                        className="size-4.5 rounded accent-brand"
                      />
                    </label>
                  </div>

                  <Field label="Browser Tab Title Format" htmlFor="browserTitleFormat" hint="Supported placeholder: {page}">
                    <input
                      type="text"
                      id="browserTitleFormat"
                      value={String(values["browserTitleFormat"] || `{page} | ${institutionName}`)}
                      onChange={(e) => setField("browserTitleFormat", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── TAB 3: Academic Nomenclature ── */}
          {activeTab === "academic" && (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Academic Structure & System Terminology"
                  subtitle="Custom nomenclature aligned with your university's statutory governance"
                />
                <CardBody className="space-y-4 pt-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Institution Designation" htmlFor="termInstitution">
                      <select
                        id="termInstitution"
                        value={String(values["termInstitution"] || "Institute")}
                        onChange={(e) => setField("termInstitution", e.target.value)}
                        className={inputClass}
                      >
                        <option value="College">College</option>
                        <option value="Institute">Institute</option>
                        <option value="University">University</option>
                        <option value="Academy">Academy</option>
                        <option value="Autonomous Institution">Autonomous Institution</option>
                      </select>
                    </Field>

                    <Field label="Department Head Title" htmlFor="termHod">
                      <select
                        id="termHod"
                        value={String(values["termHod"] || "Head of Department (HOD)")}
                        onChange={(e) => setField("termHod", e.target.value)}
                        className={inputClass}
                      >
                        <option value="Head of Department (HOD)">Head of Department (HOD)</option>
                        <option value="Department Chair">Department Chair</option>
                        <option value="Program Director">Program Director</option>
                        <option value="Dean of Department">Dean of Department</option>
                      </select>
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Teaching Staff Designation" htmlFor="termFaculty">
                      <select
                        id="termFaculty"
                        value={String(values["termFaculty"] || "Faculty")}
                        onChange={(e) => setField("termFaculty", e.target.value)}
                        className={inputClass}
                      >
                        <option value="Faculty">Faculty</option>
                        <option value="Professor">Professor</option>
                        <option value="Instructor">Instructor</option>
                        <option value="Lecturer">Lecturer</option>
                        <option value="Academician">Academician</option>
                      </select>
                    </Field>

                    <Field label="Student Identifier Label" htmlFor="termStudentId">
                      <select
                        id="termStudentId"
                        value={termStudentId}
                        onChange={(e) => setField("termStudentId", e.target.value)}
                        className={inputClass}
                      >
                        <option value="Roll Number">Roll Number</option>
                        <option value="Register Number">Register Number</option>
                        <option value="Student ID">Student ID</option>
                        <option value="Enrollment Number">Enrollment Number</option>
                        <option value="UID">UID</option>
                      </select>
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Academic Term Cycle" htmlFor="termPeriod">
                      <select
                        id="termPeriod"
                        value={termPeriod}
                        onChange={(e) => setField("termPeriod", e.target.value)}
                        className={inputClass}
                      >
                        <option value="Semester">Semester</option>
                        <option value="Trimester">Trimester</option>
                        <option value="Quarter">Quarter</option>
                        <option value="Annual Term">Annual Term</option>
                      </select>
                    </Field>

                    <Field label="Active Academic Year" htmlFor="academicYearCycle">
                      <input
                        type="text"
                        id="academicYearCycle"
                        value={String(values["academicYearCycle"] || "2026-2027")}
                        onChange={(e) => setField("academicYearCycle", e.target.value)}
                        className={inputClass}
                        placeholder="e.g. 2026-2027"
                      />
                    </Field>
                  </div>

                  <Field label="Primary Grading Scale" htmlFor="gradingFormat">
                    <select
                      id="gradingFormat"
                      value={String(values["gradingFormat"] || "10-Point CGPA Scale")}
                      onChange={(e) => setField("gradingFormat", e.target.value)}
                      className={inputClass}
                    >
                      <option value="10-Point CGPA Scale">10-Point CGPA Scale (UGC / AICTE Standard)</option>
                      <option value="Percentage System (%)">Percentage System (%)</option>
                      <option value="Letter Grade (A+ to F)">Letter Grade (A+ to F)</option>
                      <option value="4-Point GPA Scale">4-Point GPA Scale</option>
                    </select>
                  </Field>

                  {/* Statutory Accreditations Display Toggles */}
                  <div className="space-y-3 pt-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink-3">Statutory Badges on Student Portal</h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3 hover:bg-surface-2/40">
                        <span className="text-xs font-semibold text-ink">NAAC A++ Badge</span>
                        <input
                          type="checkbox"
                          checked={Boolean(values["showNaacBadge"])}
                          onChange={(e) => setField("showNaacBadge", e.target.checked)}
                          className="size-4 rounded accent-brand"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3 hover:bg-surface-2/40">
                        <span className="text-xs font-semibold text-ink">NBA Accredited</span>
                        <input
                          type="checkbox"
                          checked={Boolean(values["showNbaBadge"])}
                          onChange={(e) => setField("showNbaBadge", e.target.checked)}
                          className="size-4 rounded accent-brand"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3 hover:bg-surface-2/40">
                        <span className="text-xs font-semibold text-ink">AICTE ID Display</span>
                        <input
                          type="checkbox"
                          checked={Boolean(values["showAicteId"])}
                          onChange={(e) => setField("showAicteId", e.target.checked)}
                          className="size-4 rounded accent-brand"
                        />
                      </label>
                    </div>

                    <Field label="AICTE Approval EOA Reference" htmlFor="aicteApprovalId">
                      <input
                        type="text"
                        id="aicteApprovalId"
                        value={String(values["aicteApprovalId"] || "F.No. Southern/1-9321458921/2026/EOA")}
                        onChange={(e) => setField("aicteApprovalId", e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── TAB 4: Emails & Communications ── */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="White-Label Communication & Alerts"
                  subtitle="Branded headers, sender addresses and footers for transactional emails, SMS and WhatsApp"
                />
                <CardBody className="space-y-4 pt-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Email Sender Display Name" htmlFor="emailSenderName">
                      <input
                        type="text"
                        id="emailSenderName"
                        value={String(values["emailSenderName"] || `${institutionName} Office`)}
                        onChange={(e) => setField("emailSenderName", e.target.value)}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="From Email Address" htmlFor="emailSenderAddress">
                      <input
                        type="email"
                        id="emailSenderAddress"
                        value={String(values["emailSenderAddress"] || "notifications@ait.edu.in")}
                        onChange={(e) => setField("emailSenderAddress", e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Reply-To Address" htmlFor="emailReplyTo">
                      <input
                        type="email"
                        id="emailReplyTo"
                        value={String(values["emailReplyTo"] || "support@ait.edu.in")}
                        onChange={(e) => setField("emailReplyTo", e.target.value)}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Email Banner Header Color" htmlFor="emailHeaderColor">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          id="emailHeaderColor"
                          value={String(values["emailHeaderColor"] || primaryColor)}
                          onChange={(e) => setField("emailHeaderColor", e.target.value)}
                          className="size-10 cursor-pointer rounded-lg border border-line p-1 bg-surface"
                        />
                        <input
                          type="text"
                          value={String(values["emailHeaderColor"] || primaryColor)}
                          onChange={(e) => setField("emailHeaderColor", e.target.value)}
                          className={cn(inputClass, "font-mono uppercase text-xs")}
                        />
                      </div>
                    </Field>
                  </div>

                  <Field label="Official Campus Footer & Statutory Disclaimer" htmlFor="emailFooterText">
                    <textarea
                      id="emailFooterText"
                      rows={2}
                      value={String(values["emailFooterText"] || `${institutionName}, Chennai. Approved by AICTE, Affiliated to TNTU.`)}
                      onChange={(e) => setField("emailFooterText", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="SMS DLT Sender ID (6 Characters)" htmlFor="smsSenderId" hint="Registered with Telecom Authority">
                      <input
                        type="text"
                        id="smsSenderId"
                        maxLength={6}
                        value={String(values["smsSenderId"] || acronym.slice(0, 6))}
                        onChange={(e) => setField("smsSenderId", e.target.value.toUpperCase())}
                        className={cn(inputClass, "font-mono uppercase tracking-widest")}
                      />
                    </Field>

                    <Field label="WhatsApp Business Delivery" htmlFor="whatsappBranded">
                      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3.5 hover:bg-surface-2/40">
                        <div>
                          <p className="text-xs font-semibold text-ink">Enable Branded WhatsApp Sender</p>
                          <p className="text-[11px] text-ink-3">Deliver timetable and exam alerts with green tick</p>
                        </div>
                        <input
                          type="checkbox"
                          id="whatsappBranded"
                          checked={Boolean(values["whatsappBranded"])}
                          onChange={(e) => setField("whatsappBranded", e.target.checked)}
                          className="size-4.5 rounded accent-brand"
                        />
                      </label>
                    </Field>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSendTestEmail}
                      disabled={isSendingEmail}
                      className="gap-2 text-xs font-semibold"
                    >
                      {isSendingEmail ? <Spinner className="size-3.5" /> : <Send className="size-3.5" />}
                      <span>Send Test Verification Email</span>
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── TAB 5: Certificates & Credentials ── */}
          {activeTab === "certificates" && (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Official Degree & Certificate Branding"
                  subtitle="Custom crests, borders, signatures and cryptographic anti-tamper verification"
                />
                <CardBody className="space-y-4 pt-2">
                  <Field label="Official Certificate Header" htmlFor="certHeader">
                    <input
                      type="text"
                      id="certHeader"
                      value={String(values["certHeader"] || institutionName.toUpperCase())}
                      onChange={(e) => setField("certHeader", e.target.value)}
                      className={cn(inputClass, "uppercase font-bold")}
                    />
                  </Field>

                  <Field label="Affiliation & Autonomy Subtitle" htmlFor="certAffiliation">
                    <input
                      type="text"
                      id="certAffiliation"
                      value={String(values["certAffiliation"] || "Autonomous Institution Affiliated to TNTU")}
                      onChange={(e) => setField("certAffiliation", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Border Ornamentation Style" htmlFor="certBorderStyle">
                    <select
                      id="certBorderStyle"
                      value={String(values["certBorderStyle"] || "Classic Gold Guilloche")}
                      onChange={(e) => setField("certBorderStyle", e.target.value)}
                      className={inputClass}
                    >
                      <option value="Classic Gold Guilloche">Classic Gold Guilloche (Heritage Seal)</option>
                      <option value="Modern Dual Border">Modern Dual Border (Contemporary)</option>
                      <option value="Minimalist Slate">Minimalist Slate (Engineering Sleek)</option>
                      <option value="Royal Ornamental">Royal Ornamental (Intricate Filigree)</option>
                    </select>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Primary Signatory (Left)" htmlFor="certPrimarySignatory">
                      <input
                        type="text"
                        id="certPrimarySignatory"
                        value={String(values["certPrimarySignatory"] || "Dr. Lakshmi Sundaram, Principal")}
                        onChange={(e) => setField("certPrimarySignatory", e.target.value)}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Secondary Signatory (Right)" htmlFor="certSecondarySignatory">
                      <input
                        type="text"
                        id="certSecondarySignatory"
                        value={String(values["certSecondarySignatory"] || "Prof. K. Venkatesh, Controller of Examinations")}
                        onChange={(e) => setField("certSecondarySignatory", e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3.5 hover:bg-surface-2/40">
                      <div>
                        <p className="text-xs font-semibold text-ink">Anti-Fraud QR Verification</p>
                        <p className="text-[11px] text-ink-3">Print verifiable instant validation code on each PDF</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(values["certShowQrVerification"])}
                        onChange={(e) => setField("certShowQrVerification", e.target.checked)}
                        className="size-4.5 rounded accent-brand"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3.5 hover:bg-surface-2/40">
                      <div>
                        <p className="text-xs font-semibold text-ink">Background Security Watermark</p>
                        <p className="text-[11px] text-ink-3">Subtle heraldic watermark to deter photocopies</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(values["certWatermarkEnabled"])}
                        onChange={(e) => setField("certWatermarkEnabled", e.target.checked)}
                        className="size-4.5 rounded accent-brand"
                      />
                    </label>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ── TAB 6: Languages & AI Voice ── */}
          {activeTab === "languages" && (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Interface Language & AI Voice Localization"
                  subtitle="Configure default regional languages for course delivery, study bot and portal UI"
                />
                <CardBody className="space-y-4 pt-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Default Interface Language" htmlFor="ui-lang">
                      <select
                        id="ui-lang"
                        value={String(values["ui-lang"] || "English")}
                        onChange={(e) => setField("ui-lang", e.target.value)}
                        className={inputClass}
                      >
                        <option value="English">English</option>
                        <option value="Tamil">Tamil (தமிழ்)</option>
                        <option value="Hindi">Hindi (हिन्दी)</option>
                      </select>
                    </Field>

                    <Field label="AI Tutor Explanation Voice" htmlFor="ai-lang">
                      <select
                        id="ai-lang"
                        value={String(values["ai-lang"] || "English")}
                        onChange={(e) => setField("ai-lang", e.target.value)}
                        className={inputClass}
                      >
                        <option value="English">English</option>
                        <option value="Tamil">Tamil (தமிழ்)</option>
                        <option value="Hindi">Hindi (हिन्दी)</option>
                        <option value="Telugu">Telugu (తెలుగు)</option>
                        <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                        <option value="Malayalam">Malayalam (മലയാളം)</option>
                      </select>
                    </Field>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </div>

        {/* ── Right Column: Interactive Real-Time Live Preview Canvas ── */}
        <div className="space-y-4">
          <Card className="sticky top-6 overflow-hidden border-line shadow-card">
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <Eye className="size-4 text-brand" />
                  <span>Real-Time White-Label Preview</span>
                </div>
              }
              subtitle="Updates instantly as you customize colors, logos and branding"
              action={
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice((d) => (d === "desktop" ? "mobile" : "desktop"))}
                    className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                    title={`Switch to ${previewDevice === "desktop" ? "Mobile" : "Desktop"} View`}
                  >
                    {previewDevice === "desktop" ? <Smartphone className="size-4" /> : <Laptop className="size-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDark((d) => !d)}
                    className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                    title="Toggle Dark / Light Preview"
                  >
                    {previewDark ? <Sun className="size-4 text-amber-500" /> : <Moon className="size-4" />}
                  </button>
                </div>
              }
            />

            {/* Preview Mode Switcher */}
            <div className="flex border-b border-line bg-surface-2/30 px-3 pt-2">
              {[
                { id: "portal", label: "Student Portal", icon: Laptop },
                { id: "login", label: "Login Screen", icon: Lock },
                { id: "certificate", label: "Degree Certificate", icon: Award },
                { id: "email", label: "Email Alert", icon: Mail },
              ].map((m) => {
                const isSelected = previewMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPreviewMode(m.id as PreviewMode)}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors",
                      isSelected
                        ? "border-brand text-brand"
                        : "border-transparent text-ink-3 hover:text-ink",
                    )}
                  >
                    <m.icon className="size-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            <CardBody className="p-3 sm:p-4">
              <div
                className={cn(
                  "overflow-hidden rounded-2xl border border-line transition-all duration-300",
                  previewDark ? "bg-[#0b0f19] text-white" : "bg-[#f8fafc] text-[#0f172a]",
                  previewDevice === "mobile" ? "mx-auto max-w-[340px]" : "w-full",
                )}
              >
                {/* ── PREVIEW 1: Student Portal Dashboard ── */}
                {previewMode === "portal" && (
                  <div className="space-y-3 pb-4">
                    {/* Branded Nav Bar */}
                    <div
                      className="flex items-center justify-between px-3.5 py-2.5 shadow-sm transition-colors"
                      style={{
                        backgroundColor: values["navDark"] ? "#0d1326" : primaryColor,
                        color: "#ffffff",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="flex size-7 items-center justify-center rounded-lg shadow-xs"
                          style={{ backgroundColor: accentColor, color: primaryColor }}
                        >
                          <div className="size-4">{selectedCrest.icon}</div>
                        </div>
                        <div>
                          <p className="text-xs font-bold tracking-tight leading-tight">{institutionName}</p>
                          <p className="text-[9px] opacity-75 leading-none">Student Academic Portal</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: accentColor, color: "#111827" }}
                        >
                          {acronym}
                        </span>
                        <div className="size-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                          SK
                        </div>
                      </div>
                    </div>

                    {/* Subheader / Welcome Card */}
                    <div className="px-3">
                      <div
                        className="rounded-xl p-3.5 text-white shadow-sm"
                        style={{
                          background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
                              {termPeriod} 6 • Academic Year {String(values["academicYearCycle"] || "2026-2027")}
                            </span>
                            <h3 className="mt-1 text-sm font-extrabold sm:text-base">
                              Welcome back, Saravanan K
                            </h3>
                            <p className="text-[11px] text-white/85">
                              {termStudentId}: <span className="font-mono">2026CS1101</span> • CSE Dept
                            </p>
                          </div>
                          <div
                            className="rounded-lg px-2 py-1 text-center font-bold text-xs shadow-xs"
                            style={{ backgroundColor: accentColor, color: "#111827" }}
                          >
                            <span className="block text-[8px] uppercase tracking-wider">CGPA</span>
                            8.94
                          </div>
                        </div>

                        {/* Statutory Accreditation Chips */}
                        <div className="mt-3 flex flex-wrap gap-1.5 text-[9px]">
                          {values["showNaacBadge"] && (
                            <span className="rounded bg-black/25 px-1.5 py-0.5 font-semibold text-emerald-300">
                              ★ NAAC A++
                            </span>
                          )}
                          {values["showNbaBadge"] && (
                            <span className="rounded bg-black/25 px-1.5 py-0.5 font-semibold text-cyan-300">
                              NBA Accredited
                            </span>
                          )}
                          {values["showAicteId"] && (
                            <span className="rounded bg-black/25 px-1.5 py-0.5 text-white/80 font-mono">
                              AICTE EOA Approved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mini Quick Access Tiles */}
                    <div className="grid grid-cols-2 gap-2 px-3">
                      <div className="rounded-xl border border-line bg-surface p-2.5">
                        <span className="text-[10px] text-ink-3 block">Attendance</span>
                        <span className="text-sm font-bold text-ink">94.2%</span>
                        <div className="mt-1 h-1 rounded-full bg-surface-2 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: "94%", backgroundColor: accentColor }} />
                        </div>
                      </div>
                      <div className="rounded-xl border border-line bg-surface p-2.5">
                        <span className="text-[10px] text-ink-3 block">Upcoming Exam</span>
                        <span className="text-xs font-bold text-ink truncate block">Operating Systems</span>
                        <span className="text-[9px] text-teal font-medium mt-0.5 block">Tomorrow, 09:30 AM</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-3 pt-1 text-center">
                      <p className="text-[9px] text-ink-3">
                        {institutionName} • Affiliated to TNTU
                        {!values["hidePoweredBy"] && (
                          <span className="block text-[8px] text-ink-3 mt-0.5">Powered by ColossusIQ AI</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── PREVIEW 2: White-Label Login Screen ── */}
                {previewMode === "login" && (
                  <div className="flex min-h-[360px] flex-col items-center justify-center p-4">
                    <div className="w-full max-w-[280px] rounded-2xl border border-line bg-surface p-4 shadow-md text-center">
                      {/* Crest & Title */}
                      <div
                        className="mx-auto flex size-12 items-center justify-center rounded-2xl shadow-sm"
                        style={{ backgroundColor: primaryColor, color: accentColor }}
                      >
                        <div className="size-7">{selectedCrest.icon}</div>
                      </div>

                      <h3 className="mt-2.5 text-sm font-bold text-ink">{institutionName}</h3>
                      <p className="text-[10px] text-ink-3">Official Single Sign-On Portal</p>

                      <div className="mt-3.5 space-y-2 text-left">
                        <div>
                          <label className="text-[10px] font-semibold text-ink-2">{termStudentId} / Email</label>
                          <input
                            type="text"
                            readOnly
                            value="2026CS1101"
                            className="mt-0.5 w-full rounded-lg border border-line bg-surface-2/40 px-2.5 py-1.5 text-xs text-ink font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-ink-2">Password</label>
                          <input
                            type="password"
                            readOnly
                            value="••••••••••••"
                            className="mt-0.5 w-full rounded-lg border border-line bg-surface-2/40 px-2.5 py-1.5 text-xs text-ink"
                          />
                        </div>

                        <button
                          type="button"
                          className="mt-2 w-full rounded-xl py-2 text-xs font-bold text-white shadow-xs transition-opacity"
                          style={{ backgroundColor: primaryColor }}
                        >
                          Sign In to Portal
                        </button>
                      </div>

                      <div className="mt-4 border-t border-line/60 pt-2 text-[9px] text-ink-3">
                        <span>Domain: {customDomain}</span>
                        {!values["hidePoweredBy"] && (
                          <span className="block text-[8px] text-ink-3 mt-0.5">Platform: ColossusIQ</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PREVIEW 3: Degree Certificate ── */}
                {previewMode === "certificate" && (
                  <div className="p-3">
                    <div
                      className={cn(
                        "relative rounded-xl border-4 p-4 text-center shadow-md",
                        previewDark ? "bg-[#131b2e] border-amber-500/40" : "bg-[#fffdfa] border-[#b8860b]",
                      )}
                      style={{
                        backgroundImage: values["certWatermarkEnabled"]
                          ? "radial-gradient(circle at center, rgba(201, 150, 43, 0.05) 0%, transparent 70%)"
                          : "none",
                      }}
                    >
                      {/* Watermark in background */}
                      {values["certWatermarkEnabled"] && (
                        <div
                          className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-5"
                          style={{ color: primaryColor }}
                        >
                          <div className="size-48">{selectedCrest.icon}</div>
                        </div>
                      )}

                      {/* Seal Top */}
                      <div
                        className="mx-auto flex size-10 items-center justify-center rounded-full"
                        style={{ color: accentColor }}
                      >
                        <div className="size-7">{selectedCrest.icon}</div>
                      </div>

                      <h2
                        className="mt-1 font-serif text-sm font-extrabold uppercase tracking-widest"
                        style={{ color: primaryColor }}
                      >
                        {String(values["certHeader"] || institutionName.toUpperCase())}
                      </h2>
                      <p className="text-[8px] tracking-wide text-ink-3 font-serif italic">
                        {String(values["certAffiliation"] || "Autonomous Institution Affiliated to TNTU")}
                      </p>

                      <div className="my-2 border-b border-line/60 w-24 mx-auto" />

                      <p className="text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold">
                        Certificate of Academic Achievement
                      </p>

                      <p className="text-[9px] text-ink-3 mt-1">This is to certify that</p>
                      <h4 className="font-serif text-xs font-bold text-ink tracking-wide mt-0.5">
                        SARAVANAN K
                      </h4>
                      <p className="text-[8px] text-ink-3 max-w-[240px] mx-auto mt-0.5 leading-snug">
                        has successfully completed all requirements for the Bachelor of Technology in Computer Science & Artificial Intelligence
                      </p>

                      {/* Signatories & QR Code */}
                      <div className="mt-4 flex items-end justify-between px-2 pt-2 border-t border-line/40 text-[8px]">
                        <div className="text-left">
                          <p className="font-serif italic text-[9px] font-bold text-ink-2">Lakshmi S.</p>
                          <p className="text-[7px] text-ink-3 font-sans">
                            {String(values["certPrimarySignatory"] || "Dr. Lakshmi Sundaram, Principal")}
                          </p>
                        </div>

                        {values["certShowQrVerification"] && (
                          <div className="flex flex-col items-center">
                            <QrCode className="size-6 text-ink-2" />
                            <span className="text-[6px] text-ink-3 font-mono">SECURE-VERIFY</span>
                          </div>
                        )}

                        <div className="text-right">
                          <p className="font-serif italic text-[9px] font-bold text-ink-2">K. Venkatesh</p>
                          <p className="text-[7px] text-ink-3 font-sans">
                            {String(values["certSecondarySignatory"] || "Controller of Exams")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PREVIEW 4: Transactional Email ── */}
                {previewMode === "email" && (
                  <div className="p-3">
                    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs text-left">
                      {/* Email Header Bar */}
                      <div
                        className="p-3 text-white"
                        style={{ backgroundColor: String(values["emailHeaderColor"] || primaryColor) }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="flex size-6 items-center justify-center rounded"
                            style={{ backgroundColor: accentColor, color: primaryColor }}
                          >
                            <div className="size-3.5">{selectedCrest.icon}</div>
                          </div>
                          <div>
                            <p className="text-xs font-bold leading-none">{institutionName}</p>
                            <p className="text-[9px] text-white/80 leading-none mt-0.5">
                              {String(values["emailSenderName"] || `${institutionName} Office`)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Email Body */}
                      <div className="p-3 space-y-2 text-xs">
                        <p className="text-[10px] text-ink-3">
                          From: <span className="font-mono text-ink-2">{String(values["emailSenderAddress"] || "notifications@ait.edu.in")}</span>
                        </p>
                        <p className="font-semibold text-ink">
                          Dear Saravanan K,
                        </p>
                        <p className="text-[11px] text-ink-2 leading-relaxed">
                          Your course registration for {termPeriod} 6 is confirmed. Please review your personalized timetable and syllabus units on the portal.
                        </p>

                        <div className="pt-1">
                          <button
                            type="button"
                            className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white shadow-xs"
                            style={{ backgroundColor: primaryColor }}
                          >
                            Access {acronym} Portal →
                          </button>
                        </div>

                        {/* Footer */}
                        <div className="pt-3 border-t border-line text-[9px] text-ink-3 space-y-0.5">
                          <p>{String(values["emailFooterText"] || `${institutionName}, Chennai`)}</p>
                          <p className="text-[8px]">Automated notification. Please do not reply directly to this email.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
