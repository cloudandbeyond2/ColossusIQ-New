"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import type { AssignmentItem } from "@/lib/api/assignments-schemas";

export const LIST_KEY = ["assignments-list"] as const;
export const submissionsKey = (id: string) => ["assignment-submissions", id] as const;

/** Server field errors, or one general message for anything else that went wrong. Nothing at all while there is no error. */
export function problemOf(e: unknown, fallback: string): { fields: Record<string, string>; message: string | null } {
  if (e === null || e === undefined) return { fields: {}, message: null };
  if (e instanceof ApiError) {
    const fields = e.fields ?? {};
    return { fields, message: Object.keys(fields).length ? null : e.message };
  }
  return { fields: {}, message: fallback };
}

/** yyyy-MM-ddTHH:mm in the browser's own time zone, for <input type="datetime-local">. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function tomorrowAt5pm(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);
  return toLocalInput(d);
}

export function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** "Due in 2 days", "Due in 5 hours", "Overdue by 3 hours" … */
export function dueText(a: Pick<AssignmentItem, "dueAt" | "due">, now = Date.now()): { text: string; overdue: boolean; soon: boolean } {
  if (!a.dueAt) return { text: `Due ${a.due}`, overdue: false, soon: false };
  const ms = Date.parse(a.dueAt) - now;
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const span = mins < 60 ? `${Math.max(mins, 1)} min` : hours < 48 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${days} days`;
  return ms < 0 ? { text: `Overdue by ${span}`, overdue: true, soon: false } : { text: `Due in ${span}`, overdue: false, soon: ms < 48 * 3_600_000 };
}

/** A centred dialog: closes on Escape or a click outside, and puts focus inside when it opens. */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl border border-line bg-surface p-6 shadow-xl outline-none`}
      >
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-line pb-3">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
