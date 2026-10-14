"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { usePrefs } from "@/components/providers";
import { apiFetch } from "@/lib/api/client";
import { Notification } from "@/lib/api/schemas";
import { signOut } from "@/lib/auth/client";
import type { Role } from "@/lib/auth/roles";
import { LANG_LABEL, LANGS, isLang } from "@/lib/i18n/dict";
import { cn } from "@/lib/utils";
import { toneBar } from "@/components/ui/primitives";
import { CommandPalette } from "./command-palette";
import { Fi } from "@/components/ui/icon";

export function Topbar({
  role,
  name,
  roleLabel,
  canChat,
  onMentor,
  menuButton,
  collegeSwitcher,
  loginPath = "/login",
}: {
  role: Role;
  name: string;
  roleLabel: string;
  canChat: boolean;
  onMenu?: () => void;
  onMentor: () => void;
  menuButton: ReactNode;
  collegeSwitcher?: ReactNode;
  loginPath?: string;
}) {
  const { t, theme, toggleTheme, lang, setLang } = usePrefs();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = name
    .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s*/, "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-surface/80 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/70">
      <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
        {menuButton}
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-bg px-3.5 text-left text-sm text-ink-3 transition-colors hover:border-brand/40 sm:max-w-md"
          aria-label="Search"
        >
          <Fi name="search" className="shrink-0 text-sm" />
          <span className="truncate">{t("nav.search")}</span>
          <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
        </button>

        {collegeSwitcher}
        <div className="ml-auto flex items-center gap-1">
          {canChat ? (
            <button onClick={onMentor} className="hidden h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-amber px-4 text-sm font-medium text-white shadow-md shadow-gold/25 hover:brightness-105 md:inline-flex">
              <Fi name="sparkles" />
              {t("nav.mentor")}
            </button>
          ) : null}

          <label className="sr-only" htmlFor="lang-select">
            {t("nav.language")}
          </label>
          <select
            id="lang-select"
            value={lang}
            onChange={(e) => isLang(e.target.value) && setLang(e.target.value)}
            className="hidden h-10 rounded-lg border-0 bg-transparent px-2 text-sm text-ink-2 hover:bg-surface-2 sm:block"
          >
            {LANGS.map((l) => (
              <option key={l} value={l} className="bg-surface text-ink">
                {LANG_LABEL[l]}
              </option>
            ))}
          </select>

          <button onClick={toggleTheme} className="flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2" aria-label={t("nav.theme")}>
            <Fi name={theme === "dark" ? "sun" : "moon"} className="text-lg" />
          </button>

          <NotificationsMenu label={t("nav.notifications")} role={role} />

          <UserMenu name={name} roleLabel={roleLabel} initials={initials} signOutLabel={t("nav.signout")} role={role} loginPath={loginPath} />
        </div>
      </div>
      {paletteOpen ? <CommandPalette role={role} onClose={() => setPaletteOpen(false)} /> : null}
    </header>
  );
}

function useClickOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function resolveNotificationTarget(n: Notification, role: Role): string {
  if (n.href) return n.href;
  const id = n.id.toLowerCase();
  const title = n.title.toLowerCase();

  if (id.startsWith("notice-") || title.includes("notice") || title.includes("announcement")) {
    const noticeId = id.startsWith("notice-") ? n.id.replace(/^notice-/, "") : "";
    return noticeId ? `/${role}/notice-board?id=${encodeURIComponent(noticeId)}` : `/${role}/notice-board`;
  }
  if (id.startsWith("asn-graded-")) {
    const asnId = n.id.replace(/^asn-graded-/, "");
    return `/${role}/assignments?tab=done&id=${encodeURIComponent(asnId)}`;
  }
  if (id.startsWith("asn-") || title.includes("assignment") || title.includes("marked:")) {
    const asnId = id.startsWith("asn-") ? n.id.replace(/^asn-/, "") : "";
    return asnId ? `/${role}/assignments?tab=todo&id=${encodeURIComponent(asnId)}` : `/${role}/assignments`;
  }
  if (id.startsWith("cal-") || title.includes("calendar") || title.includes("today:") || title.includes("tomorrow:") || title.includes("event")) {
    return `/${role}/academic-calendar`;
  }
  if (id.startsWith("fee-") || title.includes("fee") || title.includes("dues")) {
    return role === "student" ? "/student/fee-payment" : `/${role}/student-fees`;
  }
  if (id.startsWith("exp-") || title.includes("experience") || title.includes("passport")) {
    return `/${role}/experience`;
  }
  if (title.includes("exam")) {
    return `/${role}/academic-calendar`;
  }
  if (title.includes("evaluation") || title.includes("evaluated")) {
    return role === "faculty" || role === "hod" ? `/${role}/assignments` : `/${role}`;
  }
  if (title.includes("mentor") || title.includes("study plan")) {
    return role === "student" ? "/student/mentor" : `/${role}`;
  }
  if (title.includes("skill booster")) {
    return `/${role}/skill-booster`;
  }
  if (title.includes("security") || title.includes("sign-in") || title.includes("password")) {
    return `/${role}/profile`;
  }
  return `/${role}`;
}

function NotificationsMenu({ label, role }: { label: string; role: Role }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  const router = useRouter();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/api/v1/notifications", z.array(Notification)),
  });

  const unread = data?.filter((n) => n.unread).length ?? 0;

  const handleNotificationClick = async (n: Notification) => {
    setOpen(false);

    // Optimistically mark as read so notification badge decreases immediately
    if (n.unread) {
      qc.setQueryData<Notification[]>(["notifications"], (prev) => {
        if (!prev) return [];
        return prev.map((item) => (item.id === n.id ? { ...item, unread: false } : item));
      });

      try {
        await apiFetch(`/api/v1/notifications/${encodeURIComponent(n.id)}/read`, z.object({ ok: z.boolean() }), { method: "POST" });
      } catch {
        // Non-blocking
      }

      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notice-board"] });
    }

    const targetHref = resolveNotificationTarget(n, role);
    if (targetHref) {
      router.push(targetHref);
    }
  };

  const handleMarkAllRead = async () => {
    qc.setQueryData<Notification[]>(["notifications"], (prev) => {
      if (!prev) return [];
      return prev.map((item) => ({ ...item, unread: false }));
    });

    try {
      await apiFetch("/api/v1/notifications/read-all", z.object({ ok: z.boolean() }), { method: "POST" });
    } catch {
      // Non-blocking
    }

    void qc.invalidateQueries({ queryKey: ["notifications"] });
    void qc.invalidateQueries({ queryKey: ["notice-board"] });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 transition-colors"
        aria-label={`${label} (${unread} unread)`}
        aria-expanded={open}
      >
        <Fi name="bell" className="text-lg" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-rose text-[10px] font-bold text-white shadow-sm ring-2 ring-surface">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-84 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl z-50">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-surface/90 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">{label}</span>
              {unread > 0 ? (
                <span className="rounded-full bg-rose-soft px-2 py-0.5 text-[11px] font-semibold text-rose">
                  {unread} new
                </span>
              ) : null}
            </div>
            {unread > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-brand hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <ul className="max-h-96 overflow-y-auto divide-y divide-line/60">
            {(data ?? []).length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-ink-3">
                <Fi name="bell" className="mx-auto mb-2 text-2xl text-ink-3/40" />
                <p>No notifications</p>
              </li>
            ) : (
              (data ?? []).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none cursor-pointer",
                      n.unread ? "bg-brand-soft/10" : "opacity-85",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full transition-all",
                        n.unread ? cn(toneBar[n.tone], "ring-2 ring-current/20 scale-110") : "bg-line",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn("text-sm transition-colors", n.unread ? "font-semibold text-ink" : "font-medium text-ink-2")}>
                          {n.title}
                        </p>
                        <Fi name="chevron-right" className="shrink-0 text-xs text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <p className="mt-0.5 text-xs text-ink-2 line-clamp-2 leading-relaxed">{n.body}</p>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-ink-3">
                        <span>{n.when}</span>
                        {n.unread ? <span className="font-semibold text-brand text-[10px] uppercase tracking-wider">Unread</span> : null}
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="border-t border-line bg-surface-2/40 px-3 py-2 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/${role}/notice-board`);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            >
              <Fi name="megaphone" className="text-xs" />
              Open notice board
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserMenu({ name, roleLabel, initials, signOutLabel, role, loginPath }: { name: string; roleLabel: string; initials: string; signOutLabel: string; role: Role; loginPath: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surface-2" aria-expanded={open} aria-label="Account menu">
        <span className="bg-brand-gradient flex size-9 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-surface">{initials}</span>
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="text-xs text-ink-3">{roleLabel}</p>
            <p className="mt-1 inline-flex rounded bg-teal-soft px-1.5 py-0.5 text-[11px] font-medium text-teal">MFA verified</p>
          </div>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void signOut("user", loginPath);
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-rose hover:bg-surface-2"
            data-role={role}
          >
            <Fi name="sign-out-alt" />
            {signOutLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
