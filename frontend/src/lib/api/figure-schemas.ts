import { z } from "zod";

/*
 * Lesson figures: labelled diagrams the course author (or the AI, for faculty to review) attaches to a lesson. They are
 * stored as plain data and drawn by our own renderer, so every label is exact text and nothing can carry script.
 */

export const FIGURE_KINDS = ["flow", "cycle", "layers", "tree", "compare", "timeline", "parts"] as const;
export type FigureKind = (typeof FIGURE_KINDS)[number];
export const MAX_FIGURES = 4;

const t = (max: number) => z.string().trim().min(1).max(max);
const opt = (max: number) => z.string().trim().max(max).default("");
const common = { title: t(80), caption: opt(300) };
const step = z.object({ label: t(60), detail: opt(180) });

const Leaf = z.object({ label: t(60) });
const Branch = z.object({ label: t(60), children: z.array(Leaf).max(5).default([]) });

const FigureShapes = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("flow"), ...common, steps: z.array(step).min(3).max(7) }),
  z.object({ kind: z.literal("cycle"), ...common, steps: z.array(step).min(3).max(6) }),
  /** Top of the picture first (for example the application layer above the network layer). */
  z.object({ kind: z.literal("layers"), ...common, layers: z.array(step).min(3).max(6) }),
  z.object({ kind: z.literal("tree"), ...common, root: z.object({ label: t(60), children: z.array(Branch).min(2).max(5) }) }),
  z
    .object({
      kind: z.literal("compare"),
      ...common,
      columns: z.array(t(40)).min(2).max(4),
      rows: z.array(z.object({ label: t(60), cells: z.array(opt(120)).min(2).max(4) })).min(2).max(7),
    })
    ,
  z.object({ kind: z.literal("timeline"), ...common, events: z.array(z.object({ when: t(30), label: t(60), detail: opt(180) })).min(3).max(8) }),
  /** One central idea and the parts it is made of. */
  z.object({ kind: z.literal("parts"), ...common, center: t(60), parts: z.array(step).min(3).max(8) }),
]);
export const Figure = FigureShapes.refine((f) => f.kind !== "compare" || f.rows.every((r) => r.cells.length === f.columns.length), { message: "Every row needs one cell per column", path: ["rows"] });
export type Figure = z.infer<typeof FigureShapes>;

export const KIND_LABEL: Record<FigureKind, string> = {
  flow: "Process",
  cycle: "Cycle",
  layers: "Layers",
  tree: "Hierarchy",
  compare: "Comparison",
  timeline: "Timeline",
  parts: "Components",
};

/** Runs `fn` over every piece of text in a figure (used to clean model or author text). */
export function mapFigureText(f: Figure, fn: (s: string) => string): Figure {
  const s = (v: { label: string; detail: string }) => ({ label: fn(v.label), detail: fn(v.detail) });
  const base = { title: fn(f.title), caption: fn(f.caption) };
  switch (f.kind) {
    case "flow":
    case "cycle":
      return { kind: f.kind, ...base, steps: f.steps.map(s) };
    case "layers":
      return { kind: f.kind, ...base, layers: f.layers.map(s) };
    case "tree":
      return { kind: f.kind, ...base, root: { label: fn(f.root.label), children: f.root.children.map((c) => ({ label: fn(c.label), children: c.children.map((l) => ({ label: fn(l.label) })) })) } };
    case "compare":
      return { kind: f.kind, ...base, columns: f.columns.map(fn), rows: f.rows.map((r) => ({ label: fn(r.label), cells: r.cells.map(fn) })) };
    case "timeline":
      return { kind: f.kind, ...base, events: f.events.map((e) => ({ when: fn(e.when), label: fn(e.label), detail: fn(e.detail) })) };
    case "parts":
      return { kind: f.kind, ...base, center: fn(f.center), parts: f.parts.map(s) };
  }
}

/** Plain-text reading of a figure, for screen readers and as the image's accessible name. */
export function describeFigure(f: Figure): string {
  const join = (xs: string[]) => xs.join("; ");
  switch (f.kind) {
    case "flow":
      return `${f.title}. Steps in order: ${join(f.steps.map((x, i) => `${i + 1}. ${x.label}`))}`;
    case "cycle":
      return `${f.title}. A cycle of: ${join(f.steps.map((x) => x.label))}, then back to the start`;
    case "layers":
      return `${f.title}. Layers from top to bottom: ${join(f.layers.map((x) => x.label))}`;
    case "tree":
      return `${f.title}. ${f.root.label} divides into ${join(f.root.children.map((c) => (c.children.length ? `${c.label} (${c.children.map((l) => l.label).join(", ")})` : c.label)))}`;
    case "compare":
      return `${f.title}. Compares ${f.columns.join(" and ")} on ${join(f.rows.map((r) => r.label))}`;
    case "timeline":
      return `${f.title}. In order: ${join(f.events.map((e) => `${e.when}: ${e.label}`))}`;
    case "parts":
      return `${f.title}. ${f.center} is made of ${join(f.parts.map((p) => p.label))}`;
  }
}
