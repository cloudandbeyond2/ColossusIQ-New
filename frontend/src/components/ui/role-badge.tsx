import type { Tone } from "@/lib/api/schemas";
import { toneClasses } from "./primitives";
import { Fi } from "./icon";
import { cn } from "@/lib/utils";

export interface RoleConfig {
  full: string;
  short: string;
  icon: string;
  tone: Tone;
}

const ROLE_CONFIGS: Record<string, RoleConfig> = {
  admin: {
    full: "University Super Admin",
    short: "Super Admin",
    icon: "shield-check",
    tone: "brand",
  },
  "university super admin": {
    full: "University Super Admin",
    short: "Super Admin",
    icon: "shield-check",
    tone: "brand",
  },
  "super admin": {
    full: "University Super Admin",
    short: "Super Admin",
    icon: "shield-check",
    tone: "brand",
  },
  institution: {
    full: "Principal / Institution Admin",
    short: "Principal",
    icon: "school",
    tone: "rose",
  },
  "principal / institution admin": {
    full: "Principal / Institution Admin",
    short: "Principal",
    icon: "school",
    tone: "rose",
  },
  "college principal": {
    full: "College Principal",
    short: "Principal",
    icon: "school",
    tone: "rose",
  },
  principal: {
    full: "Principal / Institution Admin",
    short: "Principal",
    icon: "school",
    tone: "rose",
  },
  hod: {
    full: "Head of Department",
    short: "HOD",
    icon: "users-alt",
    tone: "teal",
  },
  "head of department": {
    full: "Head of Department",
    short: "HOD",
    icon: "users-alt",
    tone: "teal",
  },
  faculty: {
    full: "Faculty",
    short: "Faculty",
    icon: "chalkboard-user",
    tone: "gold",
  },
  placement: {
    full: "Placement Officer",
    short: "Placement",
    icon: "briefcase",
    tone: "sky",
  },
  "placement officer": {
    full: "Placement Officer",
    short: "Placement",
    icon: "briefcase",
    tone: "sky",
  },
  incubation: {
    full: "Incubation Head",
    short: "Incubation",
    icon: "rocket-lunch",
    tone: "amber",
  },
  "incubation head": {
    full: "Incubation Head",
    short: "Incubation",
    icon: "rocket-lunch",
    tone: "amber",
  },
  recruiter: {
    full: "Recruiter",
    short: "Recruiter",
    icon: "handshake",
    tone: "neutral",
  },
  student: {
    full: "Student",
    short: "Student",
    icon: "user-graduate",
    tone: "brand",
  },
};

export function getRoleConfig(role: string): RoleConfig {
  const normalized = role.trim().toLowerCase();
  if (ROLE_CONFIGS[normalized]) return ROLE_CONFIGS[normalized]!;

  for (const [key, config] of Object.entries(ROLE_CONFIGS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return config;
    }
  }

  return {
    full: role,
    short: role,
    icon: "user",
    tone: "brand",
  };
}

export function toneForRole(role: string): Tone {
  return getRoleConfig(role).tone;
}

/**
 * Responsive role badge:
 * - Adapts to available screen space (shows full title on xl+ viewports, clean compact title on smaller screens).
 * - Always includes `whitespace-nowrap shrink-0` to prevent awkward multiline vertical wrapping in tables.
 * - Semantic role tones and matching UIcons for immediate visual clarity.
 * - Accessible hover tooltip with the full formal role title.
 */
export function RoleBadge({
  role,
  className,
  showIcon = true,
  size = "md",
}: {
  role: string;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}) {
  const config = getRoleConfig(role);
  const isDifferent = config.full !== config.short;

  return (
    <span
      title={config.full}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap shrink-0 transition-colors select-none",
        toneClasses[config.tone],
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      {showIcon && <Fi name={config.icon} className={cn("shrink-0", size === "sm" ? "text-[10px]" : "text-[11px]")} />}
      {isDifferent ? (
        <>
          <span className="hidden xl:inline">{config.full}</span>
          <span className="xl:hidden">{config.short}</span>
        </>
      ) : (
        <span>{config.full}</span>
      )}
    </span>
  );
}
