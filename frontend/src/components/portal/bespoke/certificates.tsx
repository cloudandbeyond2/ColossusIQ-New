"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { CertificateRow } from "@/lib/api/learning-schemas";
import { KIND_INFO, MyAwards } from "@/lib/api/certificate-schemas";
import { CertificateSheet } from "@/components/certificate/certificate-sheet";
import { useOrigin } from "./certificate-authority";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import { Fi } from "@/components/ui/icon";
import { Badge, Card, CardBody, CardHeader, EmptyState, inputClass } from "@/components/ui/primitives";
import { GradeScale } from "./my-quizzes";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function MyCertificatesModule() {
  const certs = useQuery({ queryKey: ["my-certificates-sheets"], queryFn: () => apiFetch("/api/v1/certificate-desk/mine", MyAwards) });
  const origin = useOrigin();
  const [kind, setKind] = useState<string>("All");
  if (certs.isError) return <LoadError error={certs.error} onRetry={() => void certs.refetch()} />;
  if (certs.isLoading || !certs.data) return <TemplateSkeleton />;
  const kinds = ["All", ...new Set(certs.data.map((c) => KIND_INFO[c.kind].label))];
  const shown = certs.data.filter((c) => kind === "All" || KIND_INFO[c.kind].label === kind);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {certs.data.length ? (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Certificate type">
            {kinds.map((k) => (
              <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${kind === k ? "bg-brand text-white" : "bg-surface-2 text-ink-2 hover:bg-line"}`}>
                {k}
              </button>
            ))}
          </div>
        ) : null}
        {!certs.data.length ? (
          <EmptyState title="No certificates yet" body="Pass a certificate-enabled quiz or course, or receive one from your Principal, and it appears here." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {shown.map((c) => (
              <Card key={c.id} className="card-hover overflow-hidden">
                <Link href={`/verify/${c.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Open certificate ${c.id}`} className="block bg-surface-2 p-3">
                  <div className="overflow-hidden rounded-lg shadow-md ring-1 ring-black/5">
                    <CertificateSheet data={c} verifyUrl={`${origin || "https://your-college"}/verify/${c.id}`} />
                  </div>
                </Link>
                <div className="flex items-start justify-between gap-3 px-5 pt-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-widest text-ink-3">
                      {KIND_INFO[c.kind].heading} {KIND_INFO[c.kind].subtitle}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{c.statement}</p>
                  </div>
                  {c.status === "revoked" ? <Badge tone="rose">Revoked</Badge> : <Badge tone="teal">Verified</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 border-t border-line px-5 py-3 text-sm">
                  <Link href={`/verify/${c.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
                    <Fi name="print" /> View &amp; print
                  </Link>
                  <CopyLink id={c.id} />
                  <span className="ml-auto font-mono text-xs text-ink-3">{c.id}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <GradeScale />
    </div>
  );
}

function CopyLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 font-medium text-ink-2 hover:text-ink"
      onClick={() => {
        void navigator.clipboard?.writeText(`${window.location.origin}/verify/${id}`).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      <Fi name={copied ? "check" : "link-alt"} /> {copied ? "Copied" : "Copy verification link"}
    </button>
  );
}

export function IssuedCertificatesModule() {
  const certs = useQuery({ queryKey: ["issued-certificates"], queryFn: () => apiFetch("/api/v1/certificates", z.array(CertificateRow)) });
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("All");
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (certs.data ?? []).filter((c) => (grade === "All" || c.grade === grade) && (!s || `${c.studentName} ${c.title} ${c.id} ${c.department}`.toLowerCase().includes(s)));
  }, [certs.data, search, grade]);

  if (certs.isError) return <LoadError error={certs.error} onRetry={() => void certs.refetch()} />;
  if (certs.isLoading || !certs.data) return <TemplateSkeleton />;
  const byGrade = ["O", "A+", "A", "B", "C"].map((g) => ({ g, n: certs.data.filter((c) => c.grade === g).length }));
  const showCollege = new Set(certs.data.map((c) => c.collegeId)).size > 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <Card className="col-span-2 p-5 sm:col-span-1">
          <p className="text-sm text-ink-3">Issued</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{certs.data.length}</p>
        </Card>
        {byGrade.map((b) => (
          <Card key={b.g} className="p-5">
            <p className="text-sm text-ink-3">Grade {b.g}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{b.n}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Course & quiz certificates" subtitle="Issued automatically when students pass · signed under the Principal's authority · verifiable by QR at /verify" />
        <CardBody>
          <div className="mb-4 flex flex-wrap gap-3">
            <label htmlFor="cert-search" className="sr-only">
              Search certificates
            </label>
            <input id="cert-search" className={`${inputClass} max-w-xs`} placeholder="Search student, quiz or ID" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={80} />
            <label htmlFor="cert-grade" className="sr-only">
              Grade
            </label>
            <select id="cert-grade" className={`${inputClass} w-auto!`} value={grade} onChange={(e) => setGrade(e.target.value)}>
              {["All", "O", "A+", "A", "B", "C"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          {!rows.length ? (
            <EmptyState title="No certificates" body="Certificates appear here when students pass certificate-enabled quizzes." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                    <th className="py-2 pr-3 font-medium">Certificate</th>
                    <th className="py-2 pr-3 font-medium">Student</th>
                    <th className="py-2 pr-3 font-medium">Quiz</th>
                    <th className="py-2 pr-3 font-medium">Marks</th>
                    <th className="py-2 pr-3 font-medium">Grade</th>
                    <th className="py-2 font-medium">Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-b border-line/60 last:border-0">
                      <td className="py-3 pr-3">
                        <Link href={`/verify/${c.id}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-brand hover:underline">
                          {c.id}
                        </Link>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-ink">{c.studentName}</p>
                        {showCollege ? <p className="text-xs text-ink-3">{c.collegeName}</p> : null}
                      </td>
                      <td className="py-3 pr-3">
                        <p className="text-ink">{c.title}</p>
                        <p className="text-xs text-ink-3">{c.department}</p>
                      </td>
                      <td className="py-3 pr-3">
                        {c.marks}/{c.total} ({c.percentage}%)
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone="gold">{c.grade}</Badge>
                      </td>
                      <td className="py-3 text-ink-3">{fmtDate(c.issuedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
