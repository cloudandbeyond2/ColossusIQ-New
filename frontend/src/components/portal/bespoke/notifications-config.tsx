"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Globe,
  Mail,
  MessageSquare,
  Moon,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Users,
  Volume2,
  Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
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
  Spinner,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const DeliveryLogItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  channel: z.enum(["web", "email", "push", "sms", "whatsapp"]),
  targetRole: z.string(),
  dispatchedAt: z.string(),
  status: z.string(),
  reason: z.string().optional(),
});

type DeliveryLogItem = z.infer<typeof DeliveryLogItemSchema>;

const TestNotificationReplySchema = z.object({
  delivered: z.boolean(),
  channel: z.string(),
  status: z.string(),
  reason: z.string().optional(),
  notification: z.any().optional(),
});

type ActiveTab = "channels" | "rules" | "quiet" | "simulator" | "logs";

// ── Channel Switch Card Component ─────────────────────────────
function ChannelSwitchCard({
  title,
  channelId,
  description,
  checked,
  onToggle,
  icon: Icon,
  badgeText,
  providerName,
  latency,
}: {
  title: string;
  channelId: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  icon: React.ComponentType<{ className?: string }>;
  badgeText?: string;
  providerName: string;
  latency: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      onClick={onToggle}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 text-left cursor-pointer",
        checked
          ? "border-emerald-500/30 bg-emerald-500/[0.03] shadow-sm hover:border-emerald-500/50 hover:bg-emerald-500/[0.06]"
          : "border-line/70 bg-surface hover:border-line hover:bg-surface-2/60 opacity-80",
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                checked
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-line bg-surface-2 text-ink-3 group-hover:text-ink",
              )}
            >
              <Icon className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-ink group-hover:text-brand transition-colors">
                  {title}
                </span>
                {badgeText && (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    {badgeText}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-3 mt-0.5">Gateway: {providerName}</p>
            </div>
          </div>

          <button
            id={`toggle-${channelId}`}
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2",
              checked ? "bg-emerald-600 dark:bg-emerald-500 shadow-sm" : "bg-line hover:bg-line-2",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ease-in-out",
                checked ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </div>

        <p className="mt-4 text-xs text-ink-2 leading-relaxed">{description}</p>
      </div>

      <div className="mt-4 pt-3 border-t border-line/50 flex items-center justify-between text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-2 rounded-full",
              checked ? "bg-emerald-500 animate-pulse" : "bg-ink-4",
            )}
          />
          {checked ? "Active & Routing" : "Channel Disabled"}
        </span>
        <span>Avg. Delivery: {latency}</span>
      </div>
    </div>
  );
}

// ── Rule Row Component ─────────────────────────────────────────
function RuleRow({
  title,
  description,
  checked,
  onToggle,
  id,
  icon: Icon,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  id: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      onClick={onToggle}
      className={cn(
        "group flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition-all duration-200",
        checked
          ? "border-emerald-500/30 bg-emerald-500/[0.03] shadow-sm hover:border-emerald-500/50 hover:bg-emerald-500/[0.06]"
          : "border-line/70 bg-surface hover:border-line hover:bg-surface-2/50",
      )}
    >
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        {Icon ? (
          <div
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
              checked
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-line bg-surface-2 text-ink-3 group-hover:text-ink",
            )}
          >
            <Icon className="size-4" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink group-hover:text-brand transition-colors">{title}</p>
          <p className="mt-0.5 text-xs text-ink-3 leading-relaxed">{description}</p>
        </div>
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2",
          checked ? "bg-emerald-600 dark:bg-emerald-500" : "bg-line hover:bg-line-2",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ease-in-out",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

// ── Main Notifications Config Module ──────────────────────────
export function NotificationsConfigModule() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>("channels");
  const [toast, setToast] = useState<{ message: string; tone: "teal" | "rose" | "brand" | "amber" } | null>(null);

  // Simulator Form State
  const [testTitle, setTestTitle] = useState("Internal Assessment Hall Ticket Released");
  const [testBody, setTestBody] = useState("Odd semester hall tickets are ready for download in your academic portal.");
  const [testChannel, setTestChannel] = useState<"web" | "email" | "push" | "sms" | "whatsapp">("web");
  const [testTone, setTestTone] = useState<"brand" | "teal" | "amber" | "rose">("brand");
  const [testRole, setTestRole] = useState<"student" | "faculty" | "institution" | "all">("student");

  // Query settings data
  const moduleQuery = useQuery({
    queryKey: ["module", "notifications-config"],
    queryFn: () => apiFetch("/api/v1/modules/notifications-config", SettingsData),
  });

  // Query delivery logs
  const logsQuery = useQuery({
    queryKey: ["notifications", "delivery-log"],
    queryFn: () => apiFetch("/api/v1/notifications/delivery-log", z.array(DeliveryLogItemSchema)),
  });

  // Extract initial values from query
  const initialValues = useMemo(() => {
    if (!moduleQuery.data?.sections) return {};
    const map: Record<string, string | boolean> = {};
    for (const section of moduleQuery.data.sections) {
      for (const field of section.fields) {
        map[field.id] = field.value;
      }
    }
    return map;
  }, [moduleQuery.data]);

  const [values, setValues] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    if (Object.keys(initialValues).length > 0) {
      setValues(initialValues);
    }
  }, [initialValues]);

  const dirty = useMemo(() => {
    if (Object.keys(values).length === 0 || Object.keys(initialValues).length === 0) return false;
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  const toggle = (key: string, defaultVal = true) => {
    setValues((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? !defaultVal : !prev[key],
    }));
  };

  const setSelect = (key: string, val: string) => {
    setValues((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, string | boolean>) => {
      return apiFetch("/api/v1/modules/notifications-config", UpdateSettingsReply, {
        method: "PUT",
        body: { values: payload },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["module", "notifications-config"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setToast({ message: "Notification policies saved and propagated across campus.", tone: "teal" });
    },
    onError: (err) => {
      setToast({ message: err instanceof ApiError ? err.message : "Failed to save notification policies.", tone: "rose" });
    },
  });

  // Send Test Notification Mutation
  const testMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      body: string;
      channel: string;
      tone: string;
      role: string;
    }) => {
      return apiFetch("/api/v1/notifications/test", TestNotificationReplySchema, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "delivery-log"] });
      if (data.delivered) {
        setToast({
          message: `Dispatched test alert via ${testChannel.toUpperCase()}! Look at your top header notification bell.`,
          tone: "teal",
        });
      } else {
        setToast({
          message: data.reason || `Channel '${testChannel}' is currently turned OFF in your notification rules.`,
          tone: "amber",
        });
      }
    },
    onError: (err) => {
      setToast({
        message: err instanceof ApiError ? err.message : "Failed to dispatch test notification.",
        tone: "rose",
      });
    },
  });

  if (moduleQuery.isLoading) return <TemplateSkeleton />;
  if (moduleQuery.error) return <LoadError error={moduleQuery.error} onRetry={() => moduleQuery.refetch()} />;

  const isChannelActive = (id: string, defaultVal = true) => {
    return values[id] === undefined ? defaultVal : Boolean(values[id]);
  };

  const activeChannelsCount = [
    isChannelActive("web", true),
    isChannelActive("email", true),
    isChannelActive("push", true),
    isChannelActive("sms", false),
    isChannelActive("whatsapp", false),
  ].filter(Boolean).length;

  const currentQuietSchedule = String(values["quiet"] || "22:00–07:00");
  const currentExamSchedule = String(values["exam"] || "7 days and 1 day before");
  const currentFrequencyCap = String(values["frequency-cap"] || "10 per day");

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5",
            toast.tone === "teal" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 backdrop-blur-md",
            toast.tone === "rose" && "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 backdrop-blur-md",
            toast.tone === "amber" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 backdrop-blur-md",
            toast.tone === "brand" && "border-brand/30 bg-brand/10 text-brand backdrop-blur-md",
          )}
        >
          {toast.tone === "teal" && <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />}
          {toast.tone === "rose" && <AlertTriangle className="size-5 shrink-0 text-rose-500" />}
          {toast.tone === "amber" && <AlertCircle className="size-5 shrink-0 text-amber-500" />}
          {toast.tone === "brand" && <Sparkles className="size-5 shrink-0 text-brand" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner & Quick Overview */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface via-surface-2/40 to-brand/[0.04] p-6 lg:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                <BellRing className="size-3.5" /> Campus Notification Engine
              </span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {activeChannelsCount} of 5 Channels Routing
              </span>
            </div>
            <h1 className="mt-3 text-2xl lg:text-3xl font-bold tracking-tight text-ink">
              Notification Rules & Routing Policies
            </h1>
            <p className="mt-2 text-sm text-ink-3 leading-relaxed">
              Configure event-triggered notification channels, quiet hours, delivery rate limits, and audit delivery pipelines across students, faculty, and departments.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {dirty && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setValues(initialValues)}
                disabled={saveMutation.isPending}
                className="gap-2 text-xs"
              >
                <RotateCcw className="size-3.5" /> Revert
              </Button>
            )}

            <Button
              variant={dirty ? "primary" : "secondary"}
              size="md"
              onClick={() => saveMutation.mutate(values)}
              disabled={saveMutation.isPending || !dirty}
              className="gap-2 shadow-sm font-medium"
            >
              {saveMutation.isPending ? (
                <>
                  <Spinner className="size-4" /> Saving Policies…
                </>
              ) : dirty ? (
                <>
                  <Save className="size-4" /> Save Changes
                </>
              ) : (
                <>
                  <Check className="size-4 text-emerald-600" /> All Rules Up to Date
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4 border-t border-line/60 pt-6">
          <div className="rounded-2xl border border-line/80 bg-surface/80 p-3.5 backdrop-blur-sm">
            <p className="text-xs text-ink-3 font-medium">In-App Delivery</p>
            <p className="mt-1 text-lg font-bold text-ink">
              {isChannelActive("web", true) ? "Active (0ms)" : "Suspended"}
            </p>
            <p className="text-[11px] text-ink-3 mt-0.5">Top-bar bell & toasts</p>
          </div>
          <div className="rounded-2xl border border-line/80 bg-surface/80 p-3.5 backdrop-blur-sm">
            <p className="text-xs text-ink-3 font-medium">Quiet Hours Schedule</p>
            <p className="mt-1 text-lg font-bold text-ink">{currentQuietSchedule}</p>
            <p className="text-[11px] text-ink-3 mt-0.5">Emergency bypass enabled</p>
          </div>
          <div className="rounded-2xl border border-line/80 bg-surface/80 p-3.5 backdrop-blur-sm">
            <p className="text-xs text-ink-3 font-medium">Exam Alert Window</p>
            <p className="mt-1 text-lg font-bold text-ink truncate">{currentExamSchedule}</p>
            <p className="text-[11px] text-ink-3 mt-0.5">Automated AI dispatch</p>
          </div>
          <div className="rounded-2xl border border-line/80 bg-surface/80 p-3.5 backdrop-blur-sm">
            <p className="text-xs text-ink-3 font-medium">Daily Rate Limit</p>
            <p className="mt-1 text-lg font-bold text-ink">{currentFrequencyCap}</p>
            <p className="text-[11px] text-ink-3 mt-0.5">Per-student anti-spam</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-line gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("channels")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
            activeTab === "channels"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-ink-3 hover:border-line hover:text-ink",
          )}
        >
          <Radio className="size-4" />
          Delivery Channels
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
            {activeChannelsCount}/5
          </span>
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
            activeTab === "rules"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-ink-3 hover:border-line hover:text-ink",
          )}
        >
          <Volume2 className="size-4" />
          Academic Event Rules
        </button>

        <button
          onClick={() => setActiveTab("quiet")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
            activeTab === "quiet"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-ink-3 hover:border-line hover:text-ink",
          )}
        >
          <Moon className="size-4" />
          Quiet Hours & Throttling
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
            activeTab === "simulator"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-ink-3 hover:border-line hover:text-ink",
          )}
        >
          <Send className="size-4" />
          Live Test Dispatcher
          <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
            activeTab === "logs"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-ink-3 hover:border-line hover:text-ink",
          )}
        >
          <Clock className="size-4" />
          Recent Delivery Log
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-3 font-mono">
            {logsQuery.data?.length ?? 0}
          </span>
        </button>
      </div>

      {/* Tab 1: Channels */}
      {activeTab === "channels" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink">Institutional Delivery Channels</h2>
              <p className="text-xs text-ink-3 mt-1">
                Toggle approval for outward delivery gateways. Disabled channels prevent notifications from routing regardless of event settings.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <ChannelSwitchCard
              title="In-App / Web Bells"
              channelId="web"
              description="Real-time notification bell dropdown, badges, and instant toast alerts across desktop and mobile browsers."
              checked={isChannelActive("web", true)}
              onToggle={() => toggle("web", true)}
              icon={Bell}
              badgeText="Zero Cost"
              providerName="ColossusIQ WebSocket Push"
              latency="< 50ms"
            />

            <ChannelSwitchCard
              title="Official Campus Email"
              channelId="email"
              description="High-reputation transactional delivery with signed DKIM/SPF headers for official notices, fee receipts, and marks."
              checked={isChannelActive("email", true)}
              onToggle={() => toggle("email", true)}
              icon={Mail}
              badgeText="Recommended"
              providerName="SendGrid Campus Pro"
              latency="~ 1.2s"
            />

            <ChannelSwitchCard
              title="Mobile Push Notifications"
              channelId="push"
              description="Native device notifications delivered to Android and iOS student/faculty apps with deep links."
              checked={isChannelActive("push", true)}
              onToggle={() => toggle("push", true)}
              icon={Smartphone}
              badgeText="High Engagement"
              providerName="Firebase Cloud Messaging (FCM)"
              latency="~ 350ms"
            />

            <ChannelSwitchCard
              title="SMS Priority Gateway"
              channelId="sms"
              description="TRAI DLT-approved transactional SMS for emergency alerts, OTPs, and critical fee clearance deadlines."
              checked={isChannelActive("sms", false)}
              onToggle={() => toggle("sms", false)}
              icon={MessageSquare}
              badgeText="DLT Compliant"
              providerName="Twilio / ValueFirst"
              latency="~ 3.5s"
            />

            <ChannelSwitchCard
              title="WhatsApp Business API"
              channelId="whatsapp"
              description="Official green-tick conversational WhatsApp templates for student queries, exam dates, and counseling."
              checked={isChannelActive("whatsapp", false)}
              onToggle={() => toggle("whatsapp", false)}
              icon={Globe}
              badgeText="Meta Cloud API"
              providerName="Meta Business Cloud Gateway"
              latency="~ 800ms"
            />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 flex items-start gap-4">
            <div className="size-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0 mt-0.5">
              <Zap className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Channel Failover & Reliability</p>
              <p className="text-xs text-ink-3 mt-1 leading-relaxed">
                If a student does not open an Urgent alert via Mobile Push within 15 minutes, ColossusIQ will automatically fall back to Email. SMS is strictly reserved for critical reminders to optimize gateway credit consumption.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Rules */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-ink">Academic Event Trigger Rules</h2>
            <p className="text-xs text-ink-3 mt-1">
              Select which campus life events generate automated notifications and set lead times.
            </p>
          </div>

          <div className="space-y-4">
            {/* Exam Reminders Select */}
            <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                  <BellRing className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">Examination Reminders & Hall Tickets</p>
                  <p className="text-xs text-ink-3 mt-0.5">
                    Automated alerts sent to registered students prior to internal and end-semester examinations.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={String(values["exam"] || "7 days and 1 day before")}
                  onChange={(e) => setSelect("exam", e.target.value)}
                  className={cn(inputClass, "w-64 text-sm font-medium")}
                >
                  <option value="Off">Off (Suppress Exam Alerts)</option>
                  <option value="1 day before">1 day before exam</option>
                  <option value="7 days and 1 day before">7 days and 1 day before (Recommended)</option>
                </select>
              </div>
            </div>

            {/* Attendance Rule */}
            <RuleRow
              title="Low Attendance Warnings (<75%)"
              description="Sends automated warnings to students and faculty mentors whenever cumulative attendance slips below university eligibility."
              checked={values["attendance"] === undefined ? true : Boolean(values["attendance"])}
              onToggle={() => toggle("attendance", true)}
              id="attendance-rule"
              icon={AlertTriangle}
            />

            {/* Fee Due Rule */}
            <RuleRow
              title="Tuition & Fee Clearance Reminders"
              description="Dispatches friendly payment due notices 14 days, 7 days, and 1 day before semester fee deadlines."
              checked={values["fees"] === undefined ? true : Boolean(values["fees"])}
              onToggle={() => toggle("fees", true)}
              id="fees-rule"
              icon={Zap}
            />

            {/* Placement Rule */}
            <RuleRow
              title="Campus Placement & Internship Drives"
              description="Notifies eligible final-year and pre-final-year students when new corporate recruitment drives open."
              checked={values["placement"] === undefined ? true : Boolean(values["placement"])}
              onToggle={() => toggle("placement", true)}
              id="placement-rule"
              icon={Radio}
            />

            {/* Digest Rule */}
            <RuleRow
              title="Weekly Faculty & HOD Summary Digest"
              description="Every Monday morning briefing summarizing course progress, pending AI evaluations, and department attendance."
              checked={values["digest"] === undefined ? true : Boolean(values["digest"])}
              onToggle={() => toggle("digest", true)}
              id="digest-rule"
              icon={Users}
            />

            {/* Emergency Broadcast Rule */}
            <RuleRow
              title="Emergency Campus Broadcast Override"
              description="High-severity safety alerts, holiday declarations, and emergency advisories bypass student quiet hours."
              checked={values["emergency"] === undefined ? true : Boolean(values["emergency"])}
              onToggle={() => toggle("emergency", true)}
              id="emergency-rule"
              icon={ShieldAlert}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Quiet Hours & Throttling */}
      {activeTab === "quiet" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-ink">Quiet Hours & Anti-Spam Throttling</h2>
            <p className="text-xs text-ink-3 mt-1">
              Prevent notification fatigue and protect student well-being during nighttime hours.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Quiet Hours Card */}
            <div className="rounded-2xl border border-line bg-surface p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Moon className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink">Nighttime Quiet Hours</h3>
                  <p className="text-xs text-ink-3">Silences non-critical push notifications and SMS</p>
                </div>
              </div>

              <Field htmlFor="quiet-window" label="Active Quiet Hours Window" hint="Alerts queued during this window dispatch at 07:05 AM.">
                <select
                  id="quiet-window"
                  value={String(values["quiet"] || "22:00–07:00")}
                  onChange={(e) => setSelect("quiet", e.target.value)}
                  className={cn(inputClass, "w-full text-sm font-medium mt-1")}
                >
                  <option value="None">None (Deliver Immediately 24/7)</option>
                  <option value="22:00–07:00">22:00 – 07:00 (Standard Campus Policy)</option>
                  <option value="21:00–08:00">21:00 – 08:00 (Extended Rest Period)</option>
                  <option value="23:00–06:00">23:00 – 06:00 (Minimal Night Window)</option>
                </select>
              </Field>

              <div className="rounded-xl border border-line/70 bg-surface-2/50 p-4 text-xs text-ink-3 leading-relaxed">
                <strong className="text-ink">Quiet Hour Behavior:</strong> General announcements, quiz feedback, and placement notices are held in the delivery queue. Security warnings and Emergency broadcasts bypass quiet hours automatically.
              </div>
            </div>

            {/* Frequency Cap Card */}
            <div className="rounded-2xl border border-line bg-surface p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                  <BellOff className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink">Daily Frequency Cap</h3>
                  <p className="text-xs text-ink-3">Maximum notifications delivered to any single student</p>
                </div>
              </div>

              <Field htmlFor="freq-cap" label="Maximum Daily Messages" hint="Batches non-urgent messages into daily digests once limit is reached.">
                <select
                  id="freq-cap"
                  value={String(values["frequency-cap"] || "10 per day")}
                  onChange={(e) => setSelect("frequency-cap", e.target.value)}
                  className={cn(inputClass, "w-full text-sm font-medium mt-1")}
                >
                  <option value="5 per day">5 per day (Strict)</option>
                  <option value="10 per day">10 per day (Recommended)</option>
                  <option value="20 per day">20 per day (Relaxed)</option>
                  <option value="Unlimited">Unlimited</option>
                </select>
              </Field>

              <div className="rounded-xl border border-line/70 bg-surface-2/50 p-4 text-xs text-ink-3 leading-relaxed">
                <strong className="text-ink">Batching Strategy:</strong> When a student hits their daily cap, lower-priority reminders (like library notices or club invites) merge into a single evening digest summary.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Simulator & Live Dispatcher */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink">Live Notification Simulator & Dispatcher</h2>
              <p className="text-xs text-ink-3 mt-1">
                Compose and test live alerts against your active rules. Delivered notifications will instantly appear in the top-header notification bell.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Live Bell Link Active
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Composer Form */}
            <div className="lg:col-span-7 rounded-3xl border border-line bg-surface p-6 space-y-5">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Send className="size-4 text-brand" /> Compose Test Notification
              </h3>

              <Field htmlFor="test-title" label="Notification Title" hint="Clear, actionable heading (e.g. Exam Alert, Fee Reminder)">
                <input
                  id="test-title"
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className={cn(inputClass, "w-full text-sm")}
                  placeholder="e.g. DBMS Unit Test Results Published"
                />
              </Field>

              <Field htmlFor="test-body" label="Message Body" hint="Detailed alert body visible in notification drawers and push cards.">
                <textarea
                  id="test-body"
                  rows={3}
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  className={cn(inputClass, "w-full text-sm leading-relaxed resize-none")}
                  placeholder="e.g. Your evaluation for DBMS Unit Test 2 has been graded. Review marks and model answers now."
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field htmlFor="test-channel" label="Delivery Channel">
                  <select
                    id="test-channel"
                    value={testChannel}
                    onChange={(e) => setTestChannel(e.target.value as any)}
                    className={cn(inputClass, "w-full text-sm")}
                  >
                    <option value="web">In-app / Web Bell</option>
                    <option value="email">Campus Email</option>
                    <option value="push">Mobile Push</option>
                    <option value="sms">SMS Gateway</option>
                    <option value="whatsapp">WhatsApp Alerts</option>
                  </select>
                </Field>

                <Field htmlFor="test-tone" label="Tone / Priority">
                  <select
                    id="test-tone"
                    value={testTone}
                    onChange={(e) => setTestTone(e.target.value as any)}
                    className={cn(inputClass, "w-full text-sm")}
                  >
                    <option value="brand">Brand (Informational)</option>
                    <option value="teal">Teal (Success / Update)</option>
                    <option value="amber">Amber (Warning / Due)</option>
                    <option value="rose">Rose (Urgent / Security)</option>
                  </select>
                </Field>

                <Field htmlFor="test-role" label="Target Audience">
                  <select
                    id="test-role"
                    value={testRole}
                    onChange={(e) => setTestRole(e.target.value as any)}
                    className={cn(inputClass, "w-full text-sm")}
                  >
                    <option value="student">Student Cohort</option>
                    <option value="faculty">Faculty Members</option>
                    <option value="institution">Principal / Management</option>
                    <option value="all">All Campus Roles</option>
                  </select>
                </Field>
              </div>

              {/* Status Warning if selected channel is disabled */}
              {!isChannelActive(testChannel, testChannel === "web" || testChannel === "email" || testChannel === "push") && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                  <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    <strong>Channel Switched OFF:</strong> The channel <code>{testChannel.toUpperCase()}</code> is currently disabled in your Notification Rules. Attempting to dispatch will result in a <em>Blocked by Channel Rule</em> status.
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <p className="text-xs text-ink-3">Dispatches instantly with full audit trail logging.</p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() =>
                    testMutation.mutate({
                      title: testTitle,
                      body: testBody,
                      channel: testChannel,
                      tone: testTone,
                      role: testRole,
                    })
                  }
                  disabled={testMutation.isPending || !testTitle.trim()}
                  className="gap-2 shadow-md"
                >
                  {testMutation.isPending ? (
                    <>
                      <Spinner className="size-4" /> Routing…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" /> Send Test Alert
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Live Visual Preview */}
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Eye className="size-4 text-brand" /> Recipient Live Preview
              </h3>

              {/* Notification Bell Dropdown Item Preview */}
              <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-line/60 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                    Header Bell Dropdown Mockup
                  </span>
                  <Badge tone={testTone}>{testTone.toUpperCase()}</Badge>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-line/80 bg-surface-2/40 p-4 transition-all">
                  <div
                    className={cn(
                      "size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border",
                      testTone === "brand" && "bg-brand/10 border-brand/20 text-brand",
                      testTone === "teal" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-600",
                      testTone === "amber" && "bg-amber-500/10 border-amber-500/20 text-amber-600",
                      testTone === "rose" && "bg-rose-500/10 border-rose-500/20 text-rose-600",
                    )}
                  >
                    <Bell className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-ink truncate">{testTitle || "Notification Title"}</p>
                      <span className="text-[10px] text-ink-3 whitespace-nowrap ml-2">Just now</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-2 leading-relaxed line-clamp-3">
                      {testBody || "Notification body text will appear here."}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-mono text-ink-3">
                        via {testChannel.toUpperCase()}
                      </span>
                      <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] text-ink-3">
                        Audience: {testRole}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Push Banner Preview */}
                <div className="rounded-2xl border border-line/70 bg-ink/5 dark:bg-white/5 p-4 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-ink-3">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Smartphone className="size-3.5" /> ColossusIQ Student App
                    </span>
                    <span>now</span>
                  </div>
                  <p className="text-xs font-semibold text-ink">{testTitle}</p>
                  <p className="text-[11px] text-ink-3 leading-snug line-clamp-2">{testBody}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Delivery Logs */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink">Recent Notification Dispatch Log</h2>
              <p className="text-xs text-ink-3 mt-1">
                Real-time delivery verification across channels, showing latency, recipient cohort, and rule enforcement.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logsQuery.refetch()}
              disabled={logsQuery.isFetching}
              className="gap-2 text-xs"
            >
              <RefreshCw className={cn("size-3.5", logsQuery.isFetching && "animate-spin")} /> Refresh Log
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-surface-2/60 text-ink-3 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Event / Title</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Target Role</th>
                    <th className="py-3 px-4">Dispatched At</th>
                    <th className="py-3 px-4">Delivery Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {logsQuery.isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-3">
                        <Spinner className="size-5 mx-auto mb-2" /> Loading recent dispatch logs…
                      </td>
                    </tr>
                  ) : (logsQuery.data?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-3">
                        No recent dispatches logged. Use the Live Test Dispatcher to test an alert.
                      </td>
                    </tr>
                  ) : (
                    logsQuery.data?.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-2/30 transition-colors">
                        <td className="py-3 px-4 max-w-xs">
                          <p className="font-semibold text-ink truncate">{log.title}</p>
                          <p className="text-[11px] text-ink-3 truncate mt-0.5">{log.body}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] font-mono text-ink">
                            {log.channel.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap capitalize text-ink-2">
                          {log.targetRole}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-ink-3">
                          {log.dispatchedAt}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.status === "Delivered" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-3" /> Delivered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              <AlertCircle className="size-3" /> {log.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
