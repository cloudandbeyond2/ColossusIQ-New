"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { AwardForm, emptyAward, previewSheet } from "@/components/certificate/award-form";
import { CertificateSheet } from "@/components/certificate/certificate-sheet";
import { Fi } from "@/components/ui/icon";
import { LoadError } from "@/components/ui/load-error";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Skeleton, Spinner } from "@/components/ui/primitives";
import { ApiError, apiFetch } from "@/lib/api/client";
import { AwardRow, DeskOverview, KIND_INFO, type AwardBody } from "@/lib/api/certificate-schemas";
import { cn } from "@/lib/utils";
import { useOrigin } from "./certificate-authority";

const KEY = ["certificate-desk"] as const;
const TONE = { Pending: "amber", Issued: "teal", Rejected: "neutral", Revoked: "rose" } as const;

/** Certificate Requests (faculty, HOD): ask the Principal to issue a certificate, and follow its status. */
export function CertificateRequestsModule() {
  const q = useQuery({ queryKey: KEY, queryFn: () => apiFetch("/api/v1/certificate-desk", DeskOverview) });
  const qc = useQueryClient();
  const origin = useOrigin();
  const [draft, setDraft] = useState<AwardBody>(emptyAward());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const send = useMutation({
    mutationFn: (b: AwardBody) => apiFetch("/api/v1/certificate-desk/awards", AwardRow, { method: "POST", body: b }),
    onSuccess: (r) => {
      setDraft(emptyAward());
      setErrors({});
      setMessage({ tone: "ok", text: `Sent to the Principal: a certificate of ${KIND_INFO[r.kind].label.toLowerCase()} for ${r.recipientName}.` });
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fields);
      setMessage({ tone: "error", text: e instanceof ApiError ? e.message : "Could not send the request." });
    },
  });
  if (q.isPending) return <Skeleton className="h-[600px]" />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  return (
    <div className="space-y-5">
      <Card className="flex items-start gap-3 p-4 text-sm text-ink-2">
        <Fi name="shield-check" className="mt-0.5 text-lg text-brand" />
        <p>
          The Principal is the college&apos;s certifying authority. Requests you send here are checked and signed by {d.profile.principalName}; once approved, the certificate reaches the student&apos;s portal and can be verified online.
        </p>
      </Card>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={cn("rounded-xl px-4 py-2 text-sm", message.tone === "error" ? "bg-rose-soft text-rose" : "bg-teal-soft text-teal")}>
          {message.text}
        </p>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,440px)_1fr]">
        <Card>
          <CardHeader title="Request a certificate" />
          <CardBody>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate(draft);
              }}
            >
              <AwardForm value={draft} onChange={setDraft} students={d.students} errors={errors} />
              <Button type="submit" className="w-full" disabled={send.isPending}>
                {send.isPending ? <Spinner /> : <Fi name="paper-plane" />} Send to the Principal
              </Button>
            </form>
          </CardBody>
        </Card>
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink-3">Preview</p>
          <div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-black/5">
            <CertificateSheet data={previewSheet(draft, d.profile)} verifyUrl={`${origin || "https://your-college"}/verify/CIQ-0000-PREVIEW`} />
          </div>
        </div>
      </div>
      <Card>
        <CardHeader title="My requests" />
        <CardBody className="p-0">
          {!d.awards.length ? (
            <div className="p-6">
              <EmptyState title="No requests yet" body="Requests you send to the Principal appear here with their status." />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {d.awards.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-ink">{a.recipientName}</p>
                    <p className="text-xs text-ink-3">
                      {KIND_INFO[a.kind].label}
                      {a.eventName ? ` · ${a.eventName}` : ""}
                      {a.decisionNote ? ` · Principal's note: ${a.decisionNote}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={TONE[a.status]}>{a.status}</Badge>
                    {a.publicId ? (
                      <Link href={`/verify/${a.publicId}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand hover:underline">
                        View
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
