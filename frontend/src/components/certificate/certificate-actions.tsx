"use client";

import { useState } from "react";
import { Fi } from "@/components/ui/icon";
import { Button } from "@/components/ui/primitives";

/** Print / save as PDF, copy the verification link, and add the certificate to a LinkedIn profile. */
export function CertificateActions({ id, url, name, organisation, issuedAt, revoked }: { id: string; url: string; name: string; organisation: string; issuedAt: string; revoked: boolean }) {
  const [copied, setCopied] = useState(false);
  const d = new Date(issuedAt);
  const linkedIn = `https://www.linkedin.com/profile/add?${new URLSearchParams({ startTask: "CERTIFICATION_NAME", name, organizationName: organisation, issueYear: String(d.getFullYear()), issueMonth: String(d.getMonth() + 1), certUrl: url, certId: id })}`;
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => window.print()} aria-label="Print or save certificate as PDF">
        <Fi name="print" /> Print / save PDF
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        <Fi name={copied ? "check" : "link-alt"} /> {copied ? "Link copied" : "Copy verification link"}
      </Button>
      {!revoked ? (
        <a href={linkedIn} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2">
          <Fi name="share" /> Add to LinkedIn
        </a>
      ) : null}
    </div>
  );
}
