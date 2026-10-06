"use client";

import type { ReactNode } from "react";
import type { ResumeDoc, ResumeTemplate } from "@/lib/api/resume-schemas";
import { cn } from "@/lib/utils";

/*
 * The resume as paper. It always draws dark ink on white (never theme colours) so what is on screen is what prints,
 * and every template is a single column with real text — nothing an ATS parser skips.
 */

interface Look {
  page: string;
  name: string;
  headline: string;
  contact: string;
  heading: string;
  gap: string;
  body: string;
  center: boolean;
}

const LOOK: Record<ResumeTemplate, Look> = {
  Classic: {
    page: "font-serif text-[12.5px] leading-[1.45] px-9 py-8",
    name: "text-[26px] font-bold tracking-wide",
    headline: "text-[13px] text-neutral-700",
    contact: "text-[11px] text-neutral-600",
    heading: "border-b border-neutral-800 pb-0.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-neutral-900",
    gap: "mt-4",
    body: "text-neutral-800",
    center: true,
  },
  Modern: {
    page: "font-sans text-[12px] leading-[1.45] px-9 py-8 border-t-[6px] border-teal-700",
    name: "text-[28px] font-extrabold tracking-tight text-neutral-900",
    headline: "text-[13px] font-medium text-teal-700",
    contact: "text-[11px] text-neutral-600",
    heading: "border-l-[3px] border-teal-700 pl-2 text-[11.5px] font-bold uppercase tracking-[0.12em] text-teal-800",
    gap: "mt-4",
    body: "text-neutral-800",
    center: false,
  },
  Compact: {
    page: "font-sans text-[11px] leading-[1.35] px-7 py-6",
    name: "text-[22px] font-bold text-neutral-900",
    headline: "text-[12px] text-neutral-700",
    contact: "text-[10px] text-neutral-600",
    heading: "bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-neutral-900",
    gap: "mt-2.5",
    body: "text-neutral-800",
    center: false,
  },
};

function Block({ look, title, children }: { look: Look; title: string; children: ReactNode }) {
  return (
    <section className={look.gap} style={{ breakInside: "avoid" }}>
      <h3 className={look.heading}>{title}</h3>
      <div className={cn("mt-1.5 space-y-1.5", look.body)}>{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="list-disc space-y-0.5 pl-4">
      {items.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

function Row({ left, sub, right }: { left: string; sub?: string; right?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p>
        <span className="font-semibold text-neutral-900">{left}</span>
        {sub ? <span className="text-neutral-600"> — {sub}</span> : null}
      </p>
      {right ? <span className="shrink-0 text-[0.92em] text-neutral-600">{right}</span> : null}
    </div>
  );
}

export function ResumePaper({ doc }: { doc: ResumeDoc }) {
  const look = LOOK[doc.template];
  const contact = [doc.email, doc.phone, doc.location, ...doc.links].filter(Boolean);
  return (
    <article id="resume-print" className={cn("mx-auto w-full max-w-[794px] bg-white text-neutral-900 shadow-lg ring-1 ring-black/10", look.page)} aria-label="Resume preview">
      <header className={look.center ? "text-center" : ""}>
        <h2 className={look.name}>{doc.name || "Your name"}</h2>
        {doc.headline ? <p className={look.headline}>{doc.headline}</p> : null}
        {contact.length ? <p className={cn("mt-0.5", look.contact)}>{contact.join("  ·  ")}</p> : null}
      </header>

      {doc.summary ? (
        <Block look={look} title="Summary">
          <p>{doc.summary}</p>
        </Block>
      ) : null}

      {doc.education.length ? (
        <Block look={look} title="Education">
          {doc.education.map((e, i) => (
            <div key={i}>
              <Row left={e.degree || e.school} sub={e.degree ? e.school : undefined} right={e.period} />
              {e.score ? <p className="text-neutral-600">{e.score}</p> : null}
            </div>
          ))}
        </Block>
      ) : null}

      {doc.skills.length ? (
        <Block look={look} title="Skills">
          <p>{doc.skills.join("  ·  ")}</p>
        </Block>
      ) : null}

      {doc.projects.length ? (
        <Block look={look} title="Projects">
          {doc.projects.map((p, i) => (
            <div key={i}>
              <Row left={p.name} sub={p.tech} right={p.link} />
              <Bullets items={p.bullets} />
            </div>
          ))}
        </Block>
      ) : null}

      {doc.experience.length ? (
        <Block look={look} title="Experience">
          {doc.experience.map((x, i) => (
            <div key={i}>
              <Row left={x.title || x.org} sub={x.title ? x.org : undefined} right={x.period} />
              <Bullets items={x.bullets} />
            </div>
          ))}
        </Block>
      ) : null}

      {doc.certifications.length ? (
        <Block look={look} title="Certifications">
          <Bullets items={doc.certifications} />
        </Block>
      ) : null}

      {doc.achievements.length ? (
        <Block look={look} title="Achievements">
          <Bullets items={doc.achievements} />
        </Block>
      ) : null}
    </article>
  );
}

/** Hides everything except the resume while printing, and sets A4 with sensible margins. */
export const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 10mm; }
  body * { visibility: hidden !important; }
  #resume-print, #resume-print * { visibility: visible !important; }
  #resume-print { position: absolute; left: 0; top: 0; width: 100% !important; max-width: none !important; box-shadow: none !important; --tw-ring-shadow: 0 0 #0000 !important; }
  html, body { background: #fff !important; }
}`;
