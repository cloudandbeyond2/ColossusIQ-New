"use client";

import { useId, useState } from "react";
import type { CourseUnit, Lesson } from "@/lib/api/learning-schemas";
import { mediaUrl } from "@/lib/media";
import { hostLabel, parseVideoUrl, youtubeEmbed } from "@/lib/video";
import { Fi } from "@/components/ui/icon";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import { cn } from "@/lib/utils";
import { TopicIllustration } from "./illustration";
import { FigureGallery } from "./figure";

/* Chapter colour pairs (gradient start → end). Chosen to stay legible under white text in both themes. */
const PALETTE: Array<[string, string]> = [
  ["#1e2a5a", "#4a5bd4"],
  ["#0f5f59", "#2f9e93"],
  ["#4a3aa8", "#8b74ec"],
  ["#7a5410", "#c8952c"],
  ["#1a4f8c", "#4f93d8"],
  ["#7c2338", "#c85672"],
];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

const KIND: Record<string, { label: string; icon: string }> = {
  overview: { label: "Orientation", icon: "compass-alt" },
  concepts: { label: "Key concepts", icon: "bulb" },
  example: { label: "Worked example", icon: "calculator" },
  practice: { label: "Practice & recap", icon: "clipboard-list-check" },
  revision: { label: "Revision", icon: "book-open-cover" },
};

const isFrame = (u: CourseUnit) => u.lessons.length > 0 && u.lessons.every((l) => l.layout === "overview" || l.layout === "revision");

/* ─────────────────────────── chapter banner (generated artwork) ─────────────────────────── */
export function ChapterBanner({ number, title, part, kind }: { number: number; title: string; part?: string; kind?: string }) {
  const uid = useId().replace(/:/g, "");
  const [from, to] = PALETTE[number % PALETTE.length]!;
  const variant = number % 3;
  const numeral = number === 0 ? "✦" : (ROMAN[number] ?? String(number));
  const k = KIND[kind ?? ""];
  return (
    <div className="relative isolate h-36 overflow-hidden rounded-2xl text-white sm:h-44" style={{ backgroundImage: `linear-gradient(120deg, ${from}, ${to})` }} role="img" aria-label={`Chapter banner: ${title}`}>
      <svg className="absolute inset-0 -z-10 h-full w-full" aria-hidden>
        <defs>
          <pattern id={`dots-${uid}`} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="white" opacity="0.28" />
          </pattern>
          <pattern id={`lines-${uid}`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="14" stroke="white" strokeWidth="1.2" opacity="0.18" />
          </pattern>
        </defs>
        {variant === 0 ? <rect width="100%" height="100%" fill={`url(#dots-${uid})`} /> : null}
        {variant === 1 ? <rect width="100%" height="100%" fill={`url(#lines-${uid})`} /> : null}
        {variant === 2
          ? [60, 110, 160, 210].map((r) => <circle key={r} cx="88%" cy="120%" r={r} fill="none" stroke="white" strokeWidth="1.2" opacity="0.2" />)
          : null}
        <circle cx="96%" cy="-10%" r="120" fill="white" opacity="0.08" />
      </svg>
      <span className="display-italic font-display pointer-events-none absolute -bottom-10 right-4 select-none text-[9.5rem] leading-none text-white/15" aria-hidden>
        {numeral}
      </span>
      <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
        <p className="eyebrow !text-white/75">{part ?? (number === 0 ? "Start here" : `Chapter ${number}`)}</p>
        <div>
          <p className="display text-2xl leading-tight sm:text-3xl">{title}</p>
          {k ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11.5px] font-medium backdrop-blur">
              <Fi name={k.icon} /> {k.label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── infographics ─────────────────────────── */
function Section({ title, icon, children, className }: { title: string; icon: string; children: React.ReactNode; className?: string }) {
  return (
    <figure className={cn("rounded-2xl border border-line bg-surface p-5 sm:p-6", className)}>
      <figcaption className="eyebrow flex items-center gap-2">
        <Fi name={icon} className="text-gold" /> {title}
      </figcaption>
      <div className="mt-4">{children}</div>
    </figure>
  );
}

export function ConceptMap({ title, points }: { title: string; points: string[] }) {
  const hue = ["var(--brand)", "var(--teal)", "var(--violet)", "var(--gold)", "var(--sky)", "var(--rose)"];
  return (
    <Section title="Concept map" icon="chart-network">
      <div className="grid items-center gap-5 md:grid-cols-[210px_1fr]">
        <div className="bg-brand-gradient relative rounded-2xl p-5 text-center text-white shadow-lg shadow-brand/20">
          <Fi name="bulb" className="text-2xl text-[#e0b453]" />
          <p className="display mt-2 text-lg leading-snug">{title}</p>
          <span className="absolute -right-5 top-1/2 hidden h-0 w-5 border-t-2 border-dashed border-brand/40 md:block" aria-hidden />
        </div>
        <ol className="relative space-y-3 md:border-l-2 md:border-dashed md:border-brand/30 md:pl-6">
          {points.map((p, i) => (
            <li key={p} className="relative flex items-start gap-3 rounded-xl border border-line bg-bg p-3.5">
              <span className="absolute -left-[26px] top-1/2 hidden h-0 w-6 border-t-2 border-dashed border-brand/30 md:block" aria-hidden />
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg font-sans tabular-nums text-xs font-medium text-white" style={{ background: hue[i % hue.length] }}>
                {i + 1}
              </span>
              <span className="text-[14px] leading-relaxed text-ink">{p}</span>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

export function TermCards({ terms }: { terms: Array<{ term: string; meaning: string }> }) {
  return (
    <Section title="Key terms" icon="book-alt">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {terms.map((t, i) => (
          <div key={t.term} className="rounded-xl border border-line bg-bg p-4" style={{ borderTop: `3px solid ${["var(--brand)", "var(--gold)", "var(--teal)"][i % 3]}` }}>
            <dt className="display text-lg text-ink">{t.term}</dt>
            <dd className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{t.meaning}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function WatchOut({ items }: { items: string[] }) {
  return (
    <Section title="Watch out — common mistakes" icon="triangle-warning">
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((m) => (
          <li key={m} className="flex gap-3 rounded-xl border border-amber/30 bg-amber-soft p-4 text-[14px] leading-relaxed text-ink">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber font-bold text-white" aria-hidden>
              !
            </span>
            {m}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function RecapChecklist({ points }: { points: string[] }) {
  return (
    <Section title="You should now be able to recall" icon="list-check">
      <ol className="grid gap-3 md:grid-cols-3">
        {points.map((p, i) => (
          <li key={p} className="rounded-xl bg-teal-soft/60 p-4">
            <span className="flex size-8 items-center justify-center rounded-full border-2 border-teal font-sans tabular-nums text-xs font-semibold text-teal">{i + 1}</span>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink">{p}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function PracticeCards({ items }: { items: Array<{ q: string; a: string }> }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  return (
    <Section title="Practice questions" icon="interrogation">
      <ol className="space-y-3">
        {items.map((x, i) => {
          const shown = open.has(i);
          return (
            <li key={x.q} className="rounded-xl border border-line bg-bg p-4">
              <p className="flex gap-3 text-[14.5px] font-medium text-ink">
                <span className="font-sans tabular-nums text-xs text-gold">Q{i + 1}</span>
                {x.q}
              </p>
              {shown ? (
                <p className="mt-3 rounded-lg border border-teal/30 bg-teal-soft p-3 text-[14px] leading-relaxed text-ink">
                  <span className="mr-1 font-semibold text-teal">Model answer:</span> {x.a}
                </p>
              ) : null}
              <button
                type="button"
                aria-expanded={shown}
                onClick={() => setOpen((s) => new Set(shown ? [...s].filter((n) => n !== i) : [...s, i]))}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
              >
                <Fi name={shown ? "eye-crossed" : "eye"} /> {shown ? "Hide answer" : "Show model answer"}
              </button>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

export function CourseMap({ units }: { units: CourseUnit[] }) {
  const chapters = units.map((u, i) => ({ u, i })).filter(({ u }) => !isFrame(u));
  const lessons = units.reduce((s, u) => s + u.lessons.length, 0);
  const minutes = units.reduce((s, u) => s + u.lessons.reduce((m, l) => m + l.minutes, 0), 0);
  return (
    <Section title="Course map" icon="map">
      <div className="mb-5 grid grid-cols-3 gap-3 text-center">
        {[
          [chapters.length, "chapters"],
          [lessons, "lessons"],
          [`~${Math.round(minutes / 60)} h`, "of study"],
        ].map(([v, l]) => (
          <div key={String(l)} className="rounded-xl bg-surface-2 py-3">
            <p className="display text-3xl text-ink">{v}</p>
            <p className="eyebrow mt-1">{l}</p>
          </div>
        ))}
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {chapters.map(({ u, i }) => {
          const [from, to] = PALETTE[i % PALETTE.length]!;
          return (
            <li key={`${u.title}-${i}`} className="flex items-stretch overflow-hidden rounded-xl border border-line bg-bg">
              <span className="display-italic font-display flex w-14 shrink-0 items-center justify-center text-2xl text-white" style={{ backgroundImage: `linear-gradient(160deg, ${from}, ${to})` }}>
                {ROMAN[i] ?? i}
              </span>
              <span className="min-w-0 p-3">
                {u.part ? <span className="eyebrow block !text-[9.5px]">{u.part}</span> : null}
                <span className="block text-[13.5px] font-semibold leading-snug text-ink">{u.title}</span>
                <span className="font-sans tabular-nums text-[11px] text-ink-3">
                  {u.lessons.length} lessons · {u.lessons.reduce((m, l) => m + l.minutes, 0)} min
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

export function RevisionBoard({ units }: { units: CourseUnit[] }) {
  const chapters = units.map((u, i) => ({ u, i })).filter(({ u }) => !isFrame(u));
  return (
    <Section title="The whole course at a glance" icon="layers">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {chapters.map(({ u, i }) => {
          const points = (u.lessons.find((l) => (l.layout ?? "concepts") === "concepts") ?? u.lessons[0])?.keyPoints.slice(0, 3) ?? [];
          const [from] = PALETTE[i % PALETTE.length]!;
          return (
            <article key={`${u.title}-${i}`} className="rounded-xl border border-line bg-bg p-4" style={{ borderLeft: `4px solid ${from}` }}>
              <p className="font-sans tabular-nums text-[10.5px] text-ink-3">CHAPTER {ROMAN[i] ?? i}</p>
              <h4 className="mt-0.5 text-[14.5px] font-semibold text-ink">{u.title}</h4>
              <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-ink-2">
                {points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <Fi name="check" className="mt-1 shrink-0 text-teal" /> {p}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </Section>
  );
}

/* ─────────────────────────── videos, reading and images ─────────────────────────── */
export function MediaBlock({ lesson }: { lesson: Lesson }) {
  const videos = (lesson.videos ?? []).map((v) => ({ ...v, parsed: parseVideoUrl(v.url) })).filter((v) => v.parsed);
  const links = lesson.links ?? [];
  const images = (lesson.images ?? []).map((i) => ({ ...i, src: mediaUrl(i.ref) })).filter((i) => i.src);
  if (!videos.length && !links.length && !images.length) return null;
  return (
    <>
      {images.length ? (
        <Section title="Figures" icon="picture">
          <div className={cn("grid gap-4", images.length > 1 && "sm:grid-cols-2")}>
            {images.map((img) => (
              <figure key={img.ref} className="overflow-hidden rounded-xl border border-line bg-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src!} alt={img.caption || "Lesson figure"} className="max-h-96 w-full object-contain" loading="lazy" />
                {img.caption ? <figcaption className="border-t border-line px-3 py-2 text-[12.5px] text-ink-2">{img.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </Section>
      ) : null}
      {videos.length || links.length ? (
        <Section title="Watch & read" icon="play-circle">
          {videos.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {videos.map((v) =>
                v.parsed!.kind === "youtube" ? (
                  <figure key={v.url} className="overflow-hidden rounded-xl border border-line bg-bg">
                    <div className="aspect-video bg-black">
                      <iframe
                        src={youtubeEmbed(v.parsed!.id)}
                        title={v.title}
                        className="h-full w-full"
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                        allow="encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    </div>
                    <figcaption className="px-3 py-2 text-[13px] font-medium text-ink">{v.title}</figcaption>
                  </figure>
                ) : (
                  <a key={v.url} href={v.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-3 rounded-xl border border-line bg-bg p-4 hover:border-brand/40">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Fi name="play" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-ink">{v.title}</span>
                      <span className="font-sans tabular-nums text-[11px] text-ink-3">{hostLabel(v.url)}</span>
                    </span>
                  </a>
                ),
              )}
            </div>
          ) : null}
          {links.length ? (
            <ul className={cn("flex flex-wrap gap-2", videos.length > 0 && "mt-4")}>
              {links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-[12.5px] text-ink-2 hover:border-brand/40 hover:text-brand">
                    <Fi name={hostLabel(l.url) === "YouTube" ? "play-circle" : "globe"} className="text-brand" />
                    {l.label}
                    <span className="font-sans tabular-nums text-[10px] text-ink-3">{hostLabel(l.url)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {!videos.length ? <p className="mt-3 text-[12px] text-ink-3">Suggested searches — your faculty can pin specific lecture videos to this lesson.</p> : null}
        </Section>
      ) : null}
    </>
  );
}

/* ─────────────────────────── the lesson ─────────────────────────── */
export function LessonContent({ lesson, units, chapterIndex }: { lesson: Lesson; units: CourseUnit[]; chapterIndex: number }) {
  const chapter = units[chapterIndex];
  const layout = lesson.layout;
  const body = <SafeMarkdown className="lesson-content text-[15px] leading-7">{lesson.body}</SafeMarkdown>;
  const revisionNumber = units.length - 1;
  const chapterPoints = chapter?.lessons.find((l) => (l.layout ?? "concepts") === "concepts")?.keyPoints ?? [];
  return (
    <div className="space-y-6">
      <ChapterBanner
        number={layout === "revision" ? revisionNumber : chapterIndex}
        title={chapter?.title ?? lesson.title}
        part={chapter?.part ?? (layout === "revision" ? "Before the final assessment" : undefined)}
        kind={layout}
      />
      {lesson.objectives.length ? (
        <div className="rounded-xl bg-brand-soft/60 p-4">
          <p className="text-sm font-semibold text-ink">By the end of this lesson you can</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">
            {lesson.objectives.map((o) => (
              <li key={o} className="flex gap-2">
                <Fi name="bullseye-arrow" className="mt-1 text-brand" /> {o}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {layout === "overview" ? <CourseMap units={units} /> : null}
      {layout === "revision" ? <RevisionBoard units={units} /> : null}
      {layout === "concepts" && lesson.keyPoints.length ? <ConceptMap title={chapter?.title ?? lesson.title} points={lesson.keyPoints} /> : null}

      {layout === "example" && chapterPoints.length ? (
        <Section title="The idea in one picture" icon="chart-network">
          <TopicIllustration title={chapter?.title ?? lesson.title} points={chapterPoints} kind={(["flow", "layers", "cycle"] as const)[chapterIndex % 3]!} />
        </Section>
      ) : null}

      <FigureGallery figures={lesson.figures} />

      {body}

      {layout === "concepts" && lesson.terms?.length ? <TermCards terms={lesson.terms} /> : null}
      {layout === "example" && lesson.keyPoints.length ? <WatchOut items={lesson.keyPoints} /> : null}
      {layout === "practice" && lesson.keyPoints.length ? <RecapChecklist points={lesson.keyPoints} /> : null}
      {layout === "practice" && lesson.practice?.length ? <PracticeCards items={lesson.practice} /> : null}
      <MediaBlock lesson={lesson} />
    </div>
  );
}
