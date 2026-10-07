import type { Metadata } from "next";
import { headers } from "next/headers";
import { CertificateActions } from "@/components/certificate/certificate-actions";
import { CertificateSheet } from "@/components/certificate/certificate-sheet";
import { VerifyForm } from "@/components/certificate/verify-form";
import { Fi } from "@/components/ui/icon";
import { Card } from "@/components/ui/primitives";
import { KIND_INFO } from "@/lib/api/certificate-schemas";
import { lookupCertificate } from "@/lib/api/mock/certificate-desk";
import { rateLimit } from "@/lib/api/mock/rate-limit";
import { withRequestContext } from "@/lib/data";

export const metadata: Metadata = { title: "Certificate verification", robots: { index: false, follow: false } };

/** The site's own address for the QR code: PUBLIC_APP_URL when set, else this request's host. */
function originOf(candidate: string): string | null {
  try {
    const u = new URL(candidate);
    return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password ? u.origin : null;
  } catch {
    return null;
  }
}
function siteOrigin(h: Headers): string {
  const configured = originOf((process.env.PUBLIC_APP_URL ?? "").trim());
  if (configured) return configured;
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000").split(",")[0]!.trim();
  const proto = (h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")).split(",")[0]!.trim();
  return originOf(`${proto === "http" ? "http" : "https"}://${host}`) ?? "https://localhost";
}

export default async function VerifyCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw).toUpperCase().slice(0, 20);
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const rl = rateLimit(`verify-page:${ip}`, process.env.NODE_ENV === "production" ? 30 : 300, 10 * 60_000);
  if (!rl.ok) return <Invalid id={id} message="Too many verification requests from your network. Please try again later." />;

  const result = await withRequestContext({ scope: "all", readOnly: true }, () => lookupCertificate(id));
  if (!result.valid) return <Invalid id={id} message={result.tampered ? "This certificate's record failed its signature check and must not be trusted." : "No certificate with this ID was issued by the university."} />;

  const sheet = result.sheet;
  const url = `${siteOrigin(h)}/verify/${sheet.id}`;
  const issued = new Date(sheet.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const revoked = sheet.status === "revoked";
  const kind = KIND_INFO[sheet.kind];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 print:max-w-none print:p-0">
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center print:hidden">
        <div className={`flex items-start gap-3 rounded-2xl border p-4 ${revoked ? "border-rose/40 bg-rose-soft" : "border-teal/30 bg-teal-soft"}`}>
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl text-xl ${revoked ? "bg-rose text-white" : "bg-teal text-white"}`}>
            <Fi name={revoked ? "cross-circle" : "shield-check"} />
          </span>
          <div className="min-w-0">
            <p className={`font-semibold ${revoked ? "text-rose" : "text-teal"}`}>{revoked ? "Genuine certificate, but it has been revoked" : "Verified: this certificate is genuine"}</p>
            <p className="text-sm text-ink-2">
              {kind.heading} {kind.subtitle.toLowerCase()} issued to <b className="text-ink">{sheet.recipientName}</b> by {sheet.profile.collegeName} on {issued}. Signed under the authority of {sheet.profile.principalName}, {sheet.profile.principalDesignation}.
            </p>
            {revoked && sheet.note ? <p className="mt-1 text-sm text-rose">{sheet.note}</p> : null}
            <p className="mt-1 font-mono text-xs text-ink-3">ID {sheet.id} · digital signature checked</p>
          </div>
        </div>
        <CertificateActions id={sheet.id} url={url} name={`${kind.heading} ${kind.subtitle}`} organisation={sheet.profile.collegeName} issuedAt={sheet.issuedAt} revoked={revoked} />
      </div>

      <div className="print-area certificate-print">
        <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/5 print:rounded-none print:shadow-none print:ring-0">
          <CertificateSheet data={sheet} verifyUrl={url} />
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-ink-3 print:hidden">Scan the QR code on a printed copy, or open this page, to confirm a certificate at any time. Anyone presenting an altered copy will see it fail here.</p>
    </div>
  );
}

function Invalid({ id, message }: { id: string; message: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="p-8">
        <span className="flex size-12 items-center justify-center rounded-xl bg-rose-soft text-xl text-rose">
          <Fi name="cross-circle" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-ink">Not verified</h1>
        <p className="mt-1 break-all text-sm text-ink-3">ID: {id}</p>
        <p className="mt-2 text-sm text-ink-2">{message}</p>
        <div className="mt-6">
          <VerifyForm />
        </div>
      </Card>
    </div>
  );
}
