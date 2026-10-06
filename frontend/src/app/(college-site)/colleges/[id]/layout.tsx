import Link from "next/link";
import { notFound } from "next/navigation";
import { COLLEGE_ID_RE, UNIVERSITY } from "@/config/tenancy";
import { publicCollegePage } from "@/lib/api/mock/website";
import { withRequestContext } from "@/lib/data";
import { Fi } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/primitives";
import { CollegeNav } from "@/components/college-site/college-nav";
import { initials } from "@/components/college-site/initials";

export default async function CollegeSiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = COLLEGE_ID_RE.test(id) ? await withRequestContext({ scope: id, readOnly: true }, () => publicCollegePage(id)) : null;
  if (!page) notFound();
  const { college } = page;
  const base = `/colleges/${college.id}`;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href={base} className="flex min-w-0 items-center gap-3" aria-label={`${college.name} home`}>
            <span className="bg-brand-gradient flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold tracking-wide text-gold shadow-md shadow-brand/20">
              {initials(college.name)}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-ink sm:text-base">{college.name}</span>
              <span className="block truncate text-[11px] text-ink-3">Affiliated to {UNIVERSITY.name}</span>
            </span>
          </Link>
          <CollegeNav base={base} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {college.admissionsOpen ? (
              <LinkButton href={`/apply?college=${college.id}`} size="sm" variant="secondary" className="max-sm:hidden">
                Apply
              </LinkButton>
            ) : null}
            <LinkButton href={`${base}/login`} size="sm" variant="gold">
              <Fi name="sign-in-alt" /> <span className="hidden sm:inline">Student &amp; Staff</span> Login
            </LinkButton>
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="bg-sidebar text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div>
            <p className="font-semibold">{college.name}</p>
            <p className="mt-1 text-sm text-white/60">
              {college.type} · {college.city}
            </p>
            <p className="mt-3 text-xs text-white/50">{college.regulator}</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Quick links</p>
            <ul className="mt-2 space-y-1.5 text-white/70">
              <li>
                <Link href={`${base}#programmes`} className="hover:text-white">
                  Programmes
                </Link>
              </li>
              <li>
                <Link href={`${base}#events`} className="hover:text-white">
                  Events
                </Link>
              </li>
              <li>
                <Link href={`${base}#gallery`} className="hover:text-white">
                  Gallery
                </Link>
              </li>
              <li>
                <Link href={`${base}/login`} className="hover:text-white">
                  Student &amp; staff login
                </Link>
              </li>
            </ul>
          </div>
          <div className="text-sm text-white/70">
            <p className="font-semibold text-white">{UNIVERSITY.name}</p>
            <p className="mt-2">
              <Link href="/colleges" className="hover:text-white">
                All affiliated colleges
              </Link>
            </p>
            <p className="mt-4 text-xs text-white/40">
              Powered by CollossusIQ.ai
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
