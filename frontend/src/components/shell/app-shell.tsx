"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import { Fi, ModuleIcon } from "@/components/ui/icon";
import type { IconName } from "@/config/modules";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/components/providers";
import { Topbar } from "./topbar";
import { IdleGuard } from "./idle-guard";
import { MentorDrawer } from "./mentor-drawer";
import { CollegeSwitcher } from "./college-switcher";

export interface NavGroup {
  group: string;
  items: Array<{ slug: string; title: string; icon: IconName; phase: string }>;
}

export function AppShell({
  role,
  roleLabel,
  name,
  universityName,
  collegeName,
  collegeScope,
  isSuperAdmin,
  nav,
  canChat,
  children,
}: {
  role: Role;
  roleLabel: string;
  name: string;
  universityName: string;
  collegeName: string;
  collegeScope: string;
  isSuperAdmin: boolean;
  nav: NavGroup[];
  canChat: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // College users return to their college's own login page after signing out.
  const loginPath = isSuperAdmin || collegeScope === "all" ? "/login" : `/colleges/${collegeScope}/login`;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);

  // Close the mobile drawer on navigation (state adjusted during render, per React guidance).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar sticky top-0 hidden h-dvh w-[280px] shrink-0 flex-col text-white lg:flex" aria-label="Primary">
        <SidebarContent role={role} roleLabel={roleLabel} universityName={universityName} collegeName={collegeName} nav={nav} pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
          <aside className="bg-sidebar animate-fade-up absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col text-white">
            <button
              className="absolute right-3 top-5 flex size-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <Fi name="cross-small" className="text-lg" />
            </button>
            <SidebarContent role={role} roleLabel={roleLabel} universityName={universityName} collegeName={collegeName} nav={nav} pathname={pathname} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          role={role}
          name={name}
          roleLabel={roleLabel}
          canChat={canChat}
          collegeSwitcher={isSuperAdmin ? <CollegeSwitcher scope={collegeScope} /> : null}
          loginPath={loginPath}
          onMentor={() => setMentorOpen(true)}
          menuButton={
            <button className="flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Fi name="menu-burger" className="text-lg" />
            </button>
          }
        />
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="border-t border-line px-4 py-4 text-center text-xs text-ink-3 sm:px-6">
          {universityName} · {collegeName} · Powered by CollossusIQ.ai · AI suggestions are reviewed by people for high-impact decisions
        </footer>
      </div>

      {canChat ? <MentorDrawer open={mentorOpen} onClose={() => setMentorOpen(false)} role={role} /> : null}
      <IdleGuard loginPath={loginPath} />
    </div>
  );
}

function SidebarContent({
  role,
  roleLabel,
  universityName,
  collegeName,
  nav,
  pathname,
}: {
  role: Role;
  roleLabel: string;
  universityName: string;
  collegeName: string;
  nav: NavGroup[];
  pathname: string;
}) {
  const { t } = usePrefs();
  const home = `/${role}`;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <>
      <div className="px-5 pb-4 pt-5">
        <Link href={home} aria-label="CollossusIQ home">
          <Logo light />
        </Link>
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold/90 text-[#1b2233]">
            <Fi name={collegeName === "All colleges" ? "building" : "school"} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white" title={collegeName}>
              {collegeName}
            </p>
            <p className="truncate text-[11px] text-white/60" title={universityName}>
              {universityName}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-gold/90">{roleLabel}</p>
          </div>
        </div>
      </div>
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-6" aria-label="Modules">
        <NavLink href={home} active={pathname === home} icon="home" label={t("nav.home")} />
        {nav.map((g) => {
          const isCollapsed = collapsed[g.group] ?? false;
          const id = `nav-${g.group.replace(/\W+/g, "-").toLowerCase()}`;
          return (
            <div key={g.group} className="mt-5">
              <button
                className="flex w-full items-center justify-between px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/45 hover:text-white/75"
                onClick={() => setCollapsed((c) => ({ ...c, [g.group]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
                aria-controls={id}
              >
                {g.group}
                <Fi name="angle-small-down" className={cn("text-sm transition-transform", isCollapsed && "-rotate-90")} />
              </button>
              {!isCollapsed ? (
                <ul id={id} className="space-y-0.5">
                  {g.items.map((m) => {
                    const href = `/${role}/${m.slug}`;
                    return (
                      <li key={m.slug}>
                        <NavLink href={href} active={pathname === href || pathname.startsWith(`${href}/`)} icon={m.icon} label={m.title} />
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>
    </>
  );
}

function NavLink({ href, active, icon, label }: { href: string; active: boolean; icon: IconName; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-colors",
        active ? "bg-white/[0.12] font-medium text-white shadow-inner" : "text-white/70 hover:bg-white/[0.06] hover:text-white",
      )}
    >
      {active ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-gold" aria-hidden /> : null}
      <ModuleIcon name={icon} solid={active} className={cn("text-[15px]", active ? "text-gold" : "text-white/55 group-hover:text-white")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}
