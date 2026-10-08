"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Fi } from "@/components/ui/icon";
import { Button, buttonClass } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api/client";
import { ReminderState } from "@/lib/api/billing-schemas";
import { cn } from "@/lib/utils";

const FEE_PAGE = "/student/fee-payment";
const money = (n: number, currency: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

function seen(key: string): boolean {
  try {
    return sessionStorage.getItem("ciq-fee-popup") === key;
  } catch {
    return false;
  }
}
function remember(key: string) {
  try {
    sessionStorage.setItem("ciq-fee-popup", key);
  } catch {
    /* private mode: the popup just shows again next page load */
  }
}

/**
 * Fee due reminder for students: a banner on every page and a popup once per session (and again whenever the
 * college sends a new reminder), from the reminder window before the due date until the fee is cleared.
 */
export function FeeReminder() {
  const pathname = usePathname();
  const q = useQuery({ queryKey: ["fees", "reminder"], queryFn: () => apiFetch("/api/v1/fees/me/reminder", ReminderState), staleTime: 5 * 60_000, refetchOnWindowFocus: false });
  const [closed, setClosed] = useState<string | null>(null);
  const r = q.data;
  if (!r?.show || pathname === FEE_PAGE) return null;

  const key = `${r.academicYear}:${r.notices[0]?.id ?? "due"}`;
  const popup = closed !== key && !seen(key);
  const close = () => {
    remember(key);
    setClosed(key);
  };
  const overdue = r.daysLeft < 0;
  const when = r.daysLeft > 1 ? `due in ${r.daysLeft} days` : r.daysLeft === 1 ? "due tomorrow" : r.daysLeft === 0 ? "due today" : `overdue by ${-r.daysLeft} day${r.daysLeft === -1 ? "" : "s"}`;
  const tone = r.locked || overdue ? "rose" : "amber";

  return (
    <>
      <div role="status" className={cn("mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm", tone === "rose" ? "border-rose/40 bg-rose/10" : "border-amber/40 bg-amber/10")}>
        <Fi name={tone === "rose" ? "triangle-warning" : "bell-ring"} className={tone === "rose" ? "text-rose" : "text-amber"} />
        <p className="min-w-0 flex-1 text-ink-2">
          <strong className="text-ink">
            App fee {money(r.amount, r.currency)} for {r.academicYear} is {when}.
          </strong>{" "}
          {r.autoLock && !r.locked ? `Pay by ${day(r.dueDate)}; unpaid accounts lock after ${day(r.lockDate)}.` : `Due date: ${day(r.dueDate)}.`}
        </p>
        <Link href={FEE_PAGE} className={buttonClass("primary", "sm")}>
          Pay now
        </Link>
      </div>

      {popup ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="fee-popup-title">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
            <div className={cn("px-6 py-5 text-white", tone === "rose" ? "bg-rose" : "bg-brand-gradient")}>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Fee reminder · {r.academicYear}</p>
              <p id="fee-popup-title" className="mt-1 text-2xl font-semibold">
                {money(r.amount, r.currency)} {when}
              </p>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm text-ink-2">
                Your yearly ColossusIQ app fee is {overdue ? "overdue" : `due by ${day(r.dueDate)}`}. Pay online (UPI, cards, net banking) or record an offline payment under Fees &amp; Payments.
                {r.autoLock ? ` Accounts that are still unpaid after ${day(r.lockDate)} are locked until the fee is cleared.` : ""}
              </p>
              {r.notices.length ? (
                <div className="space-y-2">
                  {r.notices.slice(0, 2).map((n) => (
                    <div key={n.id} className="rounded-xl border border-line bg-surface-2/60 p-3 text-sm">
                      <p className="text-ink">{n.message}</p>
                      <p className="mt-1 text-xs text-ink-3">
                        {n.sentBy} · {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={close}>
                  Remind me later
                </Button>
                <Link href={FEE_PAGE} onClick={close} className={buttonClass("primary")}>
                  <Fi name="credit-card" /> Pay now
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
