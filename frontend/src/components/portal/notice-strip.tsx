"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Fi } from "@/components/ui/icon";
import { Badge } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import { NoticeBoard } from "@/lib/api/notice-schemas";
import { cn } from "@/lib/utils";

/** Home-page strip: unread notices (urgent first), linking to the Notice Board. Renders nothing when all are read. */
export function NoticeStrip({ role }: { role: string }) {
  const q = useQuery({ queryKey: ["notice-board"], queryFn: () => apiFetch("/api/v1/notice-board", NoticeBoard), staleTime: 60_000, retry: false });
  if (!q.data) return null;
  const unread = q.data.notices.filter((n) => !n.read && !n.mine && !n.expired).slice(0, 3);
  if (!unread.length) return null;
  const urgent = unread.some((n) => n.priority === "Urgent");
  return (
    <section aria-label="New notices" className={cn("rounded-2xl border p-4", urgent ? "border-rose/30 bg-rose-soft/40" : "border-brand/20 bg-brand-soft/40")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Fi name="megaphone" className={urgent ? "text-rose" : "text-brand"} /> {q.data.unread} new notice{q.data.unread === 1 ? "" : "s"}
          {q.data.pendingAck ? <Badge tone="rose">{q.data.pendingAck} to acknowledge</Badge> : null}
        </p>
        <Link href={`/${role}/notice-board`} className="text-sm font-medium text-brand hover:underline">
          Open notice board
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {unread.map((n) => (
          <li key={n.id}>
            <Link href={`/${role}/notice-board`} className="flex items-start gap-3 rounded-xl bg-surface px-3 py-2 transition hover:shadow-sm">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.priority === "Urgent" ? "bg-rose" : n.priority === "Important" ? "bg-amber" : "bg-brand")} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{n.title}</span>
                <span className="block truncate text-xs text-ink-3">
                  {n.university ? "University" : n.authorName} · {n.category}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
