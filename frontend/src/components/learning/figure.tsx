"use client";

import { ArrowDown, ArrowRight, RotateCcw } from "lucide-react";
import { describeFigure, KIND_LABEL, type Figure } from "@/lib/api/figure-schemas";
import { cn } from "@/lib/utils";

/* Fills that stay legible under white text in light and dark themes (same family as the chapter banners). */
const FILL = ["#1e2a5a", "#0f5f59", "#4a3aa8", "#7a5410", "#1a4f8c", "#7c2338"];
const fill = (i: number) => FILL[i % FILL.length]!;

function Card({ i, label, detail, badge }: { i: number; label: string; detail?: string; badge?: string }) {
  return (
    <div className="relative h-full rounded-xl border border-line bg-bg p-3.5 pt-5 shadow-sm">
      <span className="absolute -top-3 left-3 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-sans text-xs font-semibold tabular-nums text-white shadow" style={{ background: fill(i) }}>
        {badge ?? i + 1}
      </span>
      <p className="text-[14px] font-semibold leading-snug text-ink">{label}</p>
      {detail ? <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{detail}</p> : null}
    </div>
  );
}

function Flow({ steps }: { steps: Array<{ label: string; detail: string }> }) {
  const row = steps.length <= 4;
  return (
    <ol className={cn("flex flex-col items-stretch gap-2", row && "md:flex-row md:gap-0")}>
      {steps.map((s, i) => (
        <li key={`${i}-${s.label}`} className={cn("flex flex-col items-center gap-2", row && "md:flex-1 md:flex-row md:gap-0")}>
          <div className="w-full flex-1 pt-3">
            <Card i={i} label={s.label} detail={s.detail} />
          </div>
          {i < steps.length - 1 ? (
            <span className={cn("flex shrink-0 items-center justify-center text-ink-3", row && "md:px-1.5")} aria-hidden>
              <ArrowDown className={cn("size-5", row && "md:hidden")} />
              {row ? <ArrowRight className="hidden size-5 md:block" /> : null}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Cycle({ steps }: { steps: Array<{ label: string; detail: string }> }) {
  return (
    <div>
      <ol className="mx-auto flex max-w-xl flex-col items-stretch gap-2">
        {steps.map((s, i) => (
          <li key={`${i}-${s.label}`} className="flex flex-col items-center gap-2">
            <div className="w-full pt-3">
              <Card i={i} label={s.label} detail={s.detail} />
            </div>
            {i < steps.length - 1 ? <ArrowDown className="size-5 text-ink-3" aria-hidden /> : null}
          </li>
        ))}
      </ol>
      <p className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full bg-brand-soft px-4 py-1.5 text-[13px] font-medium text-brand">
        <RotateCcw className="size-4" aria-hidden /> Then it starts again from step 1
      </p>
    </div>
  );
}

function Layers({ layers }: { layers: Array<{ label: string; detail: string }> }) {
  return (
    <ol className="mx-auto flex max-w-2xl flex-col gap-1.5">
      {layers.map((l, i) => (
        <li key={`${i}-${l.label}`} className="rounded-xl px-4 py-3 text-white shadow-sm" style={{ background: fill(i) }}>
          <p className="text-[14px] font-semibold leading-snug">{l.label}</p>
          {l.detail ? <p className="mt-0.5 text-[13px] leading-relaxed text-white/85">{l.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function Tree({ root }: { root: Extract<Figure, { kind: "tree" }>["root"] }) {
  return (
    <div>
      <p className="mx-auto w-fit max-w-full rounded-xl px-5 py-2.5 text-center text-[15px] font-semibold text-white shadow" style={{ background: fill(0) }}>
        {root.label}
      </p>
      <ul className="mt-3 space-y-3 border-l-2 border-dashed border-brand/30 pl-4 sm:ml-6 sm:pl-6">
        {root.children.map((c, i) => (
          <li key={`${i}-${c.label}`} className="relative">
            <span className="absolute -left-4 top-5 h-0 w-4 border-t-2 border-dashed border-brand/30 sm:-left-6 sm:w-6" aria-hidden />
            <div className="rounded-xl border border-line bg-bg p-3.5">
              <p className="text-[14px] font-semibold text-ink">
                <span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: fill(i + 1) }} aria-hidden />
                {c.label}
              </p>
              {c.children.length ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {c.children.map((l, j) => (
                    <li key={`${j}-${l.label}`} className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-ink-2">
                      {l.label}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Compare({ columns, rows }: { columns: string[]; rows: Array<{ label: string; cells: string[] }> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[420px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr>
            <th className="bg-surface-2 p-3 text-xs font-semibold uppercase tracking-wide text-ink-3" scope="col">
              <span className="sr-only">Aspect</span>
            </th>
            {columns.map((c, i) => (
              <th key={`${i}-${c}`} scope="col" className="p-3 text-[14px] font-semibold text-white" style={{ background: fill(i) }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${i}-${r.label}`} className="border-t border-line">
              <th scope="row" className="bg-surface-2 p-3 align-top font-semibold text-ink">
                {r.label}
              </th>
              {r.cells.map((c, j) => (
                <td key={j} className="p-3 align-top leading-relaxed text-ink-2">
                  {c || "–"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Timeline({ events }: { events: Array<{ when: string; label: string; detail: string }> }) {
  return (
    <ol className="ml-2 space-y-4 border-l-2 border-brand/30 pl-6">
      {events.map((e, i) => (
        <li key={`${i}-${e.label}`} className="relative">
          <span className="absolute -left-[33px] top-1 size-4 rounded-full border-2 border-surface" style={{ background: fill(i) }} aria-hidden />
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-brand">{e.when}</p>
          <p className="text-[14px] font-semibold text-ink">{e.label}</p>
          {e.detail ? <p className="text-[13px] leading-relaxed text-ink-2">{e.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function Parts({ center, parts }: { center: string; parts: Array<{ label: string; detail: string }> }) {
  return (
    <div>
      <p className="mx-auto w-fit max-w-full rounded-2xl px-6 py-3 text-center text-[15px] font-semibold text-white shadow-lg" style={{ background: fill(0) }}>
        {center}
      </p>
      <div className="mx-auto h-4 w-0 border-l-2 border-dashed border-brand/40" aria-hidden />
      <ul className="grid gap-3 border-t-2 border-dashed border-brand/30 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {parts.map((p, i) => (
          <li key={`${i}-${p.label}`} className="rounded-xl border border-line bg-bg p-3.5" style={{ borderTop: `4px solid ${fill(i + 1)}` }}>
            <p className="text-[14px] font-semibold text-ink">{p.label}</p>
            {p.detail ? <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{p.detail}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One lesson figure: a labelled diagram with a caption saying how to read it. */
export function LessonFigure({ figure: f, className }: { figure: Figure; className?: string }) {
  return (
    <figure className={cn("rounded-2xl border border-line bg-surface p-5 sm:p-6", className)}>
      <figcaption className="mb-4">
        <span className="eyebrow">{KIND_LABEL[f.kind]} diagram</span>
        <span className="display mt-1 block text-lg leading-snug text-ink">{f.title}</span>
      </figcaption>
      <div role="img" aria-label={describeFigure(f)}>
        <div aria-hidden>
          {f.kind === "flow" ? <Flow steps={f.steps} /> : null}
          {f.kind === "cycle" ? <Cycle steps={f.steps} /> : null}
          {f.kind === "layers" ? <Layers layers={f.layers} /> : null}
          {f.kind === "tree" ? <Tree root={f.root} /> : null}
          {f.kind === "compare" ? <Compare columns={f.columns} rows={f.rows} /> : null}
          {f.kind === "timeline" ? <Timeline events={f.events} /> : null}
          {f.kind === "parts" ? <Parts center={f.center} parts={f.parts} /> : null}
        </div>
      </div>
      {f.caption ? <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">{f.caption}</p> : null}
    </figure>
  );
}

export function FigureGallery({ figures }: { figures: Figure[] | undefined }) {
  if (!figures?.length) return null;
  return (
    <div className="space-y-6">
      {figures.map((f, i) => (
        <LessonFigure key={`${i}-${f.title}`} figure={f} />
      ))}
    </div>
  );
}
