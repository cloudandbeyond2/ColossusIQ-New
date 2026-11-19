"use client";

import { useId, useState } from "react";
import { TopicIllustration, type IllustrationKind } from "@/components/learning/illustration";
import { Fi } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface PosterData {
  topic: string;
  department: string;
  courseTitle?: string | null;
  what: string;
  keyPoints: string[];
  terms: Array<{ term: string; meaning: string }>;
  mistakes: string[];
  illustration: IllustrationKind;
  question: { q: string; a: string } | null;
  footer?: string;
}

/** One-page infographic lesson: prints on a single A4 sheet and reads well on a phone. */
export function InfographicPoster({ data, className }: { data: PosterData; className?: string }) {
  const [reveal, setReveal] = useState(false);
  const dots = `poster-dots-${useId().replace(/:/g, "")}`;
  return (
    <article className={cn("print-area overflow-hidden rounded-3xl border border-line bg-surface shadow-card", className)} aria-label={`Infographic: ${data.topic}`}>
      {/* header */}
      <header className="bg-brand-gradient relative overflow-hidden px-6 py-7 text-white sm:px-9">
        <svg className="absolute inset-0 h-full w-full opacity-20" aria-hidden>
          <defs>
            <pattern id={dots} width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.3" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${dots})`} />
        </svg>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow !text-white/75">{data.courseTitle ? `${data.courseTitle} · ${data.department}` : data.department}</p>
            <h2 className="display mt-2 text-4xl sm:text-5xl">{data.topic}</h2>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 font-sans tabular-nums text-[11px] uppercase tracking-wider">Infographic lesson</span>
        </div>
      </header>

      <div className="space-y-7 p-6 sm:p-9">
        {/* in one paragraph */}
        <section className="grid gap-5 md:grid-cols-[auto_1fr] md:items-start">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gold-soft text-2xl text-gold">
            <Fi name="bulb" />
          </span>
          <div>
            <p className="eyebrow">In plain words</p>
            <p className="mt-1.5 text-[16px] leading-relaxed text-ink">{data.what}</p>
          </div>
        </section>

        {/* the picture */}
        {data.keyPoints.length ? (
          <section className="rounded-2xl bg-surface-2/70 p-5 sm:p-7">
            <p className="eyebrow mb-5">The idea in one picture</p>
            <TopicIllustration title={data.topic} points={data.keyPoints} kind={data.illustration} />
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* key terms */}
          {data.terms.length ? (
            <section>
              <p className="eyebrow mb-3">Words to know</p>
              <dl className="space-y-2.5">
                {data.terms.map((t, i) => (
                  <div key={t.term} className="flex gap-3 rounded-xl border border-line bg-bg p-3">
                    <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: ["var(--brand)", "var(--gold)", "var(--teal)", "var(--violet)"][i % 4] }} aria-hidden />
                    <div>
                      <dt className="text-[14px] font-semibold text-ink">{t.term}</dt>
                      <dd className="text-[13px] leading-relaxed text-ink-2">{t.meaning}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <div className="space-y-6">
            {/* watch out */}
            {data.mistakes.length ? (
              <section>
                <p className="eyebrow mb-3">Watch out</p>
                <ul className="space-y-2.5">
                  {data.mistakes.map((m) => (
                    <li key={m} className="flex gap-3 rounded-xl border border-amber/30 bg-amber-soft p-3 text-[13.5px] leading-relaxed text-ink">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber text-xs font-bold text-white" aria-hidden>
                        !
                      </span>
                      {m}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* quick check */}
            {data.question ? (
              <section className="rounded-2xl border-2 border-dashed border-teal/40 p-4">
                <p className="eyebrow mb-2 !text-teal">Quick check</p>
                <p className="text-[14.5px] font-medium text-ink">{data.question.q}</p>
                {reveal ? (
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{data.question.a}</p>
                ) : (
                  <button type="button" onClick={() => setReveal(true)} className="mt-2 text-sm font-medium text-teal hover:underline print:hidden">
                    Show answer
                  </button>
                )}
              </section>
            ) : null}
          </div>
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2/60 px-6 py-3 text-[11.5px] text-ink-3 sm:px-9">
        <span>{data.footer ?? "ColossusIQ · Teaching Studio"}</span>
        <span className="font-sans tabular-nums">AI-assisted · reviewed by your faculty</span>
      </footer>
    </article>
  );
}
