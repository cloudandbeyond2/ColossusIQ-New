"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Building2, Sparkles, X, Check, Globe, Shield, Palette, School, ArrowRight } from "lucide-react";
import { Button, Card, inputClass } from "@/components/ui/primitives";
import { UNIVERSITY } from "@/config/tenancy";
import { apiFetch, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ciq_institutional_setup_completed";

const COLOR_PRESETS = [
  { name: "Royal Navy", primary: "#1e2a5a", accent: "#c9962b" },
  { name: "Oxford Blue", primary: "#0f3a60", accent: "#0284c7" },
  { name: "Emerald Tech", primary: "#064e3b", accent: "#10b981" },
  { name: "Crimson Academic", primary: "#881337", accent: "#f43f5e" },
  { name: "Deep Violet", primary: "#3b0764", accent: "#a855f7" },
  { name: "Slate Minimal", primary: "#1e293b", accent: "#64748b" },
];

export function InstitutionalSetupWizard({ onCompleted }: { onCompleted?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(UNIVERSITY.name || "");
  const [shortName, setShortName] = useState(UNIVERSITY.shortName || "");
  const [campusName, setCampusName] = useState("Main Campus / School of Engineering");
  const [domain, setDomain] = useState("campus.edu");
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if the administrator has completed the initial setup
    const isCompleted = localStorage.getItem(STORAGE_KEY);
    // If not completed or if the current institution matches the generic unconfigured placeholder, prompt setup
    const isUnconfigured = !process.env.NEXT_PUBLIC_INSTITUTION_NAME || process.env.NEXT_PUBLIC_INSTITUTION_NAME === "Your Institution / University Name";
    if (!isCompleted && isUnconfigured) {
      // Small timeout for smooth entry animation
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      // Update global white-label branding configuration
      return apiFetch("/api/v1/modules/branding", z.object({ ok: z.boolean(), values: z.record(z.any()) }), {
        method: "PUT",
        body: {
          values: {
            name: name.trim() || UNIVERSITY.name,
            shortName: shortName.trim() || UNIVERSITY.shortName,
            customDomain: domain.trim(),
            primary: selectedColor.primary,
            accent: selectedColor.accent,
            certHeader: (name.trim() || UNIVERSITY.name).toUpperCase(),
            certAffiliation: `Autonomous Institution · ${name.trim() || UNIVERSITY.name}`,
          },
        },
      });
    },
    onSuccess: () => {
      setSuccess(true);
      setError(null);
      localStorage.setItem(STORAGE_KEY, "true");
      void qc.invalidateQueries({ queryKey: ["university-overview"] });
      void qc.invalidateQueries({ queryKey: ["module", "branding"] });
      setTimeout(() => {
        setOpen(false);
        if (onCompleted) onCompleted();
      }, 1400);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? `${err.message} (${err.code})` : (err instanceof Error ? err.message : "Failed to save institutional identity.");
      setError(msg);
    },
  });

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
    if (onCompleted) onCompleted();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Decorative Top Gradient Header */}
        <div className="bg-brand-gradient p-6 text-white sm:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md text-gold shadow-inner">
                <Building2 className="size-6" />
              </span>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
                  <Sparkles className="size-3" /> Quick Setup Wizard
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Initialize Institutional Identity</h2>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close setup wizard"
            >
              <X className="size-5" />
            </button>
          </div>
          <p className="mt-2 text-sm text-white/80 leading-relaxed max-w-xl">
            Welcome to ColossusIQ. Set your institution name, acronym, and brand theme. This immediately personalizes portal headers, diplomas, and reports across all campuses.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-5 max-h-[70vh] overflow-y-auto">
          {error ? (
            <div className="rounded-xl border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="flex items-center gap-3 rounded-2xl border border-teal/40 bg-teal-soft p-5 text-teal animate-in fade-in">
              <div className="flex size-10 items-center justify-center rounded-xl bg-teal text-white shadow-sm">
                <Check className="size-5" />
              </div>
              <div>
                <p className="text-base font-semibold">Institutional Identity Initialized!</p>
                <p className="text-xs opacity-90">Your portal is now customized and ready for all colleges and students.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
                    Official Institution / University Name
                  </label>
                  <div className="relative">
                    <School className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-3" />
                    <input
                      type="text"
                      className={cn(inputClass, "pl-10 text-sm font-medium")}
                      placeholder="e.g. Oxford Institute of Technology / St. Xavier's University"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
                    Short Name / Acronym
                  </label>
                  <input
                    type="text"
                    className={cn(inputClass, "text-sm font-medium uppercase")}
                    placeholder="e.g. OIT / SXU"
                    maxLength={10}
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-ink-3">Used on badges, SMS sender ID and mobile topbar.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
                    Campus Web Domain
                  </label>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-3" />
                    <input
                      type="text"
                      className={cn(inputClass, "pl-10 text-sm font-medium")}
                      placeholder="e.g. campus.institution.edu"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-3">Domain for institutional email notices and logins.</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
                    First Campus / Flagship College Name
                  </label>
                  <input
                    type="text"
                    className={cn(inputClass, "text-sm font-medium")}
                    placeholder="e.g. School of Engineering & Technology"
                    value={campusName}
                    onChange={(e) => setCampusName(e.target.value)}
                  />
                </div>
              </div>

              {/* Color Theme Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2 flex items-center gap-1.5">
                  <Palette className="size-3.5" /> Primary Brand Theme Palette
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {COLOR_PRESETS.map((preset) => {
                    const isSelected = selectedColor.name === preset.name;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setSelectedColor(preset)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all",
                          isSelected
                            ? "border-brand bg-surface-2 ring-2 ring-brand/25 font-semibold text-ink"
                            : "border-line bg-surface hover:border-brand/40 text-ink-2"
                        )}
                      >
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg shadow-xs" style={{ backgroundColor: preset.primary }}>
                          <span className="size-2 rounded-full" style={{ backgroundColor: preset.accent }} />
                        </div>
                        <span className="text-xs truncate">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/40 px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-medium text-ink-3 hover:text-ink transition-colors"
          >
            Configure later in Branding Settings
          </button>
          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              onClick={handleDismiss}
              disabled={saveMutation.isPending}
            >
              Skip
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || success}
              className="gap-2"
            >
              {saveMutation.isPending ? "Saving..." : (
                <>
                  Save & Apply Identity <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
