"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardHeader, Field, inputClass, Skeleton, Spinner, toneForStatus } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { Checkout, GATEWAY_NAMES, MyFees, type FeePayment } from "@/lib/api/billing-schemas";
import { cn } from "@/lib/utils";

const KEY = ["fees", "me"] as const;
const MAX_IMAGE = 2 * 1024 * 1024;

export const money = (n: number, currency: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const RESULT: Record<string, { tone: "teal" | "rose" | "amber"; text: string }> = {
  paid: { tone: "teal", text: "Payment received. Thank you: your account is cleared for the year." },
  failed: { tone: "rose", text: "The payment did not go through. Nothing was charged; you can try again." },
  unknown: { tone: "amber", text: "We could not confirm the payment yet. If money was taken, it will be confirmed shortly; check again in a few minutes before paying again." },
};

/** Fees & Payments: the student's yearly app fee, online and offline payment, and receipts. */
export function FeePaymentModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/fees/me", MyFees) });
  const params = useSearchParams();
  const result = RESULT[params.get("payment") ?? ""];
  const [receipt, setReceipt] = useState<FeePayment | null>(null);
  if (q.isPending) return <Skeleton className="h-[480px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const due = d.status === "Due" && d.amount > 0;
  const notOpen = !d.offlineModes.length;
  return (
    <div className="space-y-5">
      {result ? (
        <Card className={cn("flex items-start gap-3 p-4 text-sm", result.tone === "teal" ? "border-teal" : result.tone === "rose" ? "border-rose" : "border-amber")} role="status">
          <Fi name={result.tone === "teal" ? "check-circle" : "info"} className={cn("mt-0.5", result.tone === "teal" ? "text-teal" : result.tone === "rose" ? "text-rose" : "text-amber")} />
          <p className="text-ink-2">{result.text}</p>
        </Card>
      ) : null}
      {d.access.locked ? (
        <Card className="flex items-start gap-3 border-rose p-4 text-sm" role="alert">
          <Fi name="lock" className="mt-0.5 text-rose" />
          <p className="text-ink-2">
            Your account is locked because the app fee for {d.academicYear} is unpaid. Pay below (or record an offline payment for the University to verify) and everything opens again.
          </p>
        </Card>
      ) : null}

      <Card className="grid gap-5 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="space-y-1">
          <p className="text-sm text-ink-3">App fee · academic year {d.academicYear}</p>
          <p className="text-3xl font-semibold text-ink">{notOpen ? "—" : money(d.amount, d.currency)}</p>
          {notOpen ? (
            <p className="text-sm text-ink-3">The University has not opened fee payment yet. Nothing is due.</p>
          ) : (
            <p className="text-sm text-ink-3">
              Due by <span className="font-medium text-ink-2">{day(d.dueDate)}</span>
              {due ? <> · unpaid accounts lock after {day(d.lockDate)}</> : null}
            </p>
          )}
        </div>
        {!notOpen ? (
          <Badge tone={d.status === "Due" ? (d.access.locked ? "rose" : "amber") : "teal"} className="h-fit justify-self-start px-3 py-1 text-sm md:justify-self-end">
            {d.status === "Due" ? (d.pendingOffline ? "Awaiting verification" : "Due") : d.status}
          </Badge>
        ) : null}
      </Card>

      {due && !d.pendingOffline ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <PayOnline data={d} />
          <PayOffline data={d} />
        </div>
      ) : null}
      {due && d.pendingOffline ? (
        <Card className="flex items-start gap-3 p-4 text-sm text-ink-2">
          <Fi name="hourglass-end" className="mt-0.5 text-sky" />
          <p>Your offline payment has been sent to the University for verification. Your account is cleared as soon as it is approved.</p>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Payment history" subtitle="Every payment you have made or started, with receipts for completed ones." />
        {d.payments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-5 py-2 font-medium">Year</th>
                  <th className="px-5 py-2 font-medium">Method</th>
                  <th className="px-5 py-2 font-medium">Amount</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {d.payments.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-5 py-3 text-ink-2">{day(p.createdAt)}</td>
                    <td className="px-5 py-3 text-ink-2">{p.academicYear}</td>
                    <td className="px-5 py-3 text-ink-2">{p.gateway === "offline" ? `Offline · ${p.offlineMode}` : GATEWAY_NAMES[p.gateway]}</td>
                    <td className="px-5 py-3 font-medium text-ink">{money(p.amount, p.currency)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={p.status === "Paid" ? "teal" : p.status === "Pending verification" ? "sky" : p.status === "Created" ? "neutral" : toneForStatus(p.status)}>{p.status === "Created" ? "Not completed" : p.status}</Badge>
                      {p.status === "Rejected" && p.reviewNote ? <p className="mt-1 text-xs text-ink-3">{p.reviewNote}</p> : null}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p.status === "Paid" ? (
                        <Button size="sm" variant="secondary" onClick={() => setReceipt(p)}>
                          <Fi name="receipt" /> Receipt
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm text-ink-3">No payments yet.</p>
        )}
      </Card>
      {receipt ? <Receipt payment={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

function PayOnline({ data }: { data: MyFees }) {
  const [gateway, setGateway] = useState(data.gateways[0]?.id ?? null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<{ text: string; fields: Record<string, string> } | null>(null);
  const chosen = data.gateways.find((g) => g.id === gateway);
  const pay = useMutation({
    mutationFn: () => apiFetch("/api/v1/fees/me/checkout", Checkout, { method: "POST", body: { gateway, ...(email ? { email } : {}), ...(phone ? { phone } : {}) }, timeoutMs: 40_000 }),
    onSuccess: (c) => {
      if (c.kind === "redirect") {
        window.location.assign(c.url);
        return;
      }
      // PayU / CCAvenue: post the signed form to the gateway's hosted checkout.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = c.action;
      for (const [k, v] of Object.entries(c.fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    },
    onError: (e) => setError({ text: e instanceof ApiError ? e.message : "The payment could not be started.", fields: e instanceof ApiError ? e.fields : {} }),
  });
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-base font-semibold text-ink">Pay online</h2>
        <p className="text-sm text-ink-3">You will be taken to the gateway&rsquo;s secure page. Card and UPI details are never entered on this site.</p>
      </div>
      {data.gateways.length ? (
        <>
          <div role="radiogroup" aria-label="Payment gateway" className="grid gap-2 sm:grid-cols-2">
            {data.gateways.map((g) => (
              <button key={g.id} type="button" role="radio" aria-checked={gateway === g.id} onClick={() => setGateway(g.id)} className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition", gateway === g.id ? "border-brand bg-brand-soft font-medium text-ink" : "border-line hover:bg-surface-2")}>
                <Fi name="credit-card" className={gateway === g.id ? "text-brand" : "text-ink-3"} />
                {g.name}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={chosen?.needsContact ? "Email" : "Email (optional)"} htmlFor="pay-email" error={error?.fields.email}>
              <input id="pay-email" type="email" autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
            </Field>
            <Field label={chosen?.needsContact ? "Mobile number" : "Mobile (optional)"} htmlFor="pay-phone" error={error?.fields.phone}>
              <input id="pay-phone" type="tel" autoComplete="tel" inputMode="tel" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={14} placeholder="10-digit number" />
            </Field>
          </div>
          {error ? (
            <p className="text-sm text-rose" role="alert">
              {error.text}
            </p>
          ) : null}
          <Button className="w-full" disabled={!gateway || pay.isPending || pay.isSuccess} onClick={() => (setError(null), pay.mutate())}>
            {pay.isPending || pay.isSuccess ? <Spinner /> : <Fi name="lock" />} Pay {money(data.amount, data.currency)}
            {chosen ? ` with ${chosen.name}` : ""}
          </Button>
        </>
      ) : (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink-3">Online payment is not available yet. Pay at the college office or by bank transfer and record it on the right.</p>
      )}
    </Card>
  );
}

function PayOffline({ data }: { data: MyFees }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState(data.offlineModes[0] ?? "");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new ApiError(422, "validation", "Attach a photo of the receipt.", { proof: "Attach a photo of the receipt" });
      if (file.size > MAX_IMAGE) throw new ApiError(422, "validation", "The photo must be 2 MB or smaller.", { proof: "At most 2 MB" });
      const data64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = () => reject(new ApiError(0, "read_failed", "Could not read the file."));
        r.readAsDataURL(file);
      });
      return apiFetch("/api/v1/fees/me/offline", MyFees, { method: "POST", body: { mode, reference, paidOn, proof: { contentType: file.type, data: data64 } }, timeoutMs: 60_000 });
    },
    onSuccess: (r) => qc.setQueryData(KEY, r),
    onError: (e) => {
      setErrors(e instanceof ApiError ? e.fields : {});
      setMessage(e instanceof ApiError ? e.message : "Could not submit.");
    },
  });
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-base font-semibold text-ink">Paid offline?</h2>
        <p className="text-sm text-ink-3">Paid by cash, DD, cheque or bank transfer? Record it here with a photo of the receipt. The University verifies it and clears your account.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="How you paid" htmlFor="off-mode" error={errors.mode}>
          <select id="off-mode" className={inputClass} value={mode} onChange={(e) => setMode(e.target.value)}>
            {data.offlineModes.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Paid on" htmlFor="off-date" error={errors.paidOn}>
          <input id="off-date" type="date" className={inputClass} value={paidOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaidOn(e.target.value)} />
        </Field>
      </div>
      <Field label="Receipt / transaction / DD number" htmlFor="off-ref" error={errors.reference}>
        <input id="off-ref" className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} />
      </Field>
      <Field label="Photo of the receipt" htmlFor="off-proof" hint="PNG, JPEG or WebP, up to 2 MB." error={errors.proof}>
        <input id="off-proof" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-ink" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      {message ? (
        <p className="text-sm text-rose" role="alert">
          {message}
        </p>
      ) : null}
      <Button variant="secondary" className="w-full" disabled={submit.isPending || reference.trim().length < 3} onClick={() => (setErrors({}), setMessage(null), submit.mutate())}>
        {submit.isPending ? <Spinner /> : <Fi name="upload" />} Send for verification
      </Button>
    </Card>
  );
}

function Receipt({ payment: p, onClose }: { payment: FeePayment; onClose: () => void }) {
  const rows: Array<[string, string]> = [
    ["Receipt number", p.receiptNo],
    ["Student", p.studentName],
    ["Academic year", p.academicYear],
    ["Paid with", p.gateway === "offline" ? `Offline · ${p.offlineMode}` : GATEWAY_NAMES[p.gateway]],
    ["Reference", p.gateway === "offline" ? p.offlineRef : p.gatewayPaymentId || p.gatewayOrderId],
    ["Date", day(p.updatedAt)],
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 print:static print:bg-white" role="dialog" aria-modal="true" aria-label="Payment receipt">
      <Card className="w-full max-w-md space-y-4 p-6 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-3">Payment receipt</p>
            <p className="text-lg font-semibold text-ink">ColossusIQ app fee</p>
          </div>
          <Badge tone="teal">Paid</Badge>
        </div>
        <p className="text-3xl font-semibold text-ink">{money(p.amount, p.currency)}</p>
        <dl className="divide-y divide-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-right font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>
            <Fi name="print" /> Print
          </Button>
        </div>
      </Card>
    </div>
  );
}
