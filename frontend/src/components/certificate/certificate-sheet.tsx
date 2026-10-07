import { KIND_INFO, type SheetData, type Theme } from "@/lib/api/certificate-schemas";
import { mediaUrl } from "@/lib/media";
import { qrPath } from "@/lib/qr";
import { CornerOrnament, GeneratedCollegeSeal, GoldSeal } from "./seals";

/*
 * A printable certificate (A4 landscape). Layout, top to bottom: the college / university header with address and
 * accreditation; the certificate title on a ribbon; the recipient and what the certificate is for; then the footer:
 * QR code for online verification (left), the golden verification seal (centre), the college seal with the
 * Principal's signature beneath it (right). Sizes use container units, so the same sheet works as a thumbnail and as
 * a full page. Colours are fixed (a printed document looks the same in light and dark mode). Pure: no hooks.
 */

const PALETTE: Record<Theme, { ink: string; accent: string; deep: string; paper: string; tint: string }> = {
  classic: { ink: "#1b2a4a", accent: "#b8892e", deep: "#8a6418", paper: "#fdfaf2", tint: "#f4ead0" },
  royal: { ink: "#14286e", accent: "#c4a032", deep: "#8f7016", paper: "#f9faff", tint: "#e7ecfb" },
  emerald: { ink: "#0f3d33", accent: "#b8892e", deep: "#7e5d14", paper: "#f8fbf8", tint: "#e3efe8" },
  maroon: { ink: "#5a1426", accent: "#b8892e", deep: "#7e5d14", paper: "#fdf8f3", tint: "#f2e3d9" },
};

const initialsOf = (name: string) =>
  name
    .replace(/[^A-Za-z ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(of|and|the|for)$/i.test(w))
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "C";

const cq = (n: number) => `${n}cqw`;

export function CertificateSheet({ data, verifyUrl, className }: { data: SheetData; verifyUrl: string; className?: string }) {
  const p = data.profile;
  const c = PALETTE[p.theme] ?? PALETTE.classic;
  const info = KIND_INFO[data.kind];
  const uid = (data.id || "preview").replace(/[^A-Za-z0-9]/g, "");
  const qr = qrPath(verifyUrl);
  const logo = mediaUrl(p.logoRef);
  const seal = mediaUrl(p.sealRef);
  const signature = mediaUrl(p.signatureRef);
  const initials = initialsOf(p.collegeName);
  const year = new Date(data.issuedAt).getFullYear().toString();
  const host = verifyUrl.replace(/^https?:\/\//, "").replace(/\/verify\/.*$/, "");

  const monogram = (size: number) => (
    <div style={{ width: cq(size), height: cq(size), borderRadius: "50%", border: `${cq(0.25)} solid ${c.accent}`, background: c.tint, color: c.ink, display: "grid", placeItems: "center", fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 700, fontSize: cq(size * 0.32), letterSpacing: cq(0.1) }}>{initials}</div>
  );

  return (
    <div className={`certificate-sheet relative w-full overflow-hidden ${className ?? ""}`} style={{ aspectRatio: "297 / 210", containerType: "inline-size", background: `radial-gradient(ellipse at 50% 42%, #ffffff 0%, ${c.paper} 55%, ${c.tint} 100%)`, color: c.ink, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      {/* Guilloche-style background lines */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 297 210" preserveAspectRatio="none" aria-hidden="true" style={{ opacity: 0.07 }}>
        {Array.from({ length: 22 }, (_, i) => (
          <path key={i} d={`M0 ${20 + i * 8} Q 74 ${8 + i * 8} 148 ${20 + i * 8} T 297 ${20 + i * 8}`} fill="none" stroke={c.accent} strokeWidth="0.35" />
        ))}
      </svg>
      {/* Watermark */}
      <div className="pointer-events-none absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2" style={{ width: cq(30), opacity: 0.05 }} aria-hidden="true">
        <GeneratedCollegeSeal uid={`wm${uid}`} name={p.collegeName} initials={initials} color={c.ink} />
      </div>
      {/* Frames and corners */}
      <div className="pointer-events-none absolute" style={{ inset: cq(1.1), border: `${cq(0.55)} solid ${c.ink}` }} aria-hidden="true" />
      <div className="pointer-events-none absolute" style={{ inset: cq(1.9), border: `${cq(0.22)} solid ${c.accent}` }} aria-hidden="true" />
      <div className="pointer-events-none absolute" style={{ inset: cq(2.35), border: `${cq(0.07)} solid ${c.accent}` }} aria-hidden="true" />
      {[0, 90, 180, 270].map((deg) => (
        <CornerOrnament key={deg} color={c.accent} className="pointer-events-none absolute" style={{ width: cq(5.2), height: cq(5.2), top: deg < 180 ? cq(2.6) : undefined, bottom: deg >= 180 ? cq(2.6) : undefined, left: deg === 0 || deg === 270 ? cq(2.6) : undefined, right: deg === 90 || deg === 180 ? cq(2.6) : undefined, transform: `rotate(${deg}deg)` }} />
      ))}

      <div className="relative flex h-full flex-col" style={{ padding: `${cq(3.4)} ${cq(8.2)} ${cq(4.4)}` }}>
        {/* Header: college and university */}
        <header className="grid items-center" style={{ gridTemplateColumns: `${cq(9)} 1fr ${cq(9)}`, gap: cq(1.5) }}>
          <div className="flex justify-center">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={`${p.collegeName} logo`} style={{ width: cq(8.4), height: cq(8.4), objectFit: "contain" }} />
            ) : (
              monogram(7.6)
            )}
          </div>
          <div className="text-center">
            <p style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 700, fontSize: cq(2.35), letterSpacing: cq(0.12), textTransform: "uppercase", lineHeight: 1.1 }}>{p.collegeName}</p>
            {p.affiliation ? <p style={{ fontSize: cq(1.12), marginTop: cq(0.35), color: c.deep, fontWeight: 600 }}>{p.affiliation}</p> : null}
            {p.address ? <p style={{ fontSize: cq(1.02), marginTop: cq(0.2), opacity: 0.85 }}>{p.address}</p> : null}
            {p.contact ? <p style={{ fontSize: cq(0.92), marginTop: cq(0.15), opacity: 0.75 }}>{p.contact}</p> : null}
          </div>
          <div className="flex justify-center">
            {p.accreditation ? (
              <div className="text-center" style={{ width: cq(8.6), padding: `${cq(0.6)} ${cq(0.4)}`, border: `${cq(0.18)} solid ${c.accent}`, borderRadius: cq(0.8), background: "#fffdf6", color: c.deep, fontSize: cq(0.85), fontWeight: 700, lineHeight: 1.2, textTransform: "uppercase", letterSpacing: cq(0.05) }}>
                {p.accreditation}
              </div>
            ) : null}
          </div>
        </header>
        {p.motto ? <p className="text-center" style={{ fontSize: cq(0.95), fontStyle: "italic", marginTop: cq(0.4), color: c.deep }}>“{p.motto}”</p> : null}

        {/* Divider */}
        <div className="flex items-center justify-center" style={{ gap: cq(1), marginTop: cq(1.1) }} aria-hidden="true">
          <span style={{ height: cq(0.12), width: cq(22), background: `linear-gradient(90deg, transparent, ${c.accent})` }} />
          <span style={{ width: cq(0.9), height: cq(0.9), transform: "rotate(45deg)", background: c.accent }} />
          <span style={{ height: cq(0.12), width: cq(22), background: `linear-gradient(90deg, ${c.accent}, transparent)` }} />
        </div>

        {/* Title */}
        <div className="text-center" style={{ marginTop: cq(1.2) }}>
          <h1 style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 700, fontSize: cq(4.6), letterSpacing: cq(0.9), textTransform: "uppercase", lineHeight: 1, color: c.ink }}>{info.heading}</h1>
          <div className="relative mx-auto inline-flex items-center justify-center" style={{ marginTop: cq(0.9), padding: `${cq(0.5)} ${cq(3.4)}`, background: `linear-gradient(180deg, ${c.accent}, ${c.deep})`, color: "#fffaf0", fontSize: cq(1.45), fontWeight: 700, letterSpacing: cq(0.45), textTransform: "uppercase", clipPath: `polygon(0 0, 100% 0, calc(100% - ${cq(1.4)}) 50%, 100% 100%, 0 100%, ${cq(1.4)} 50%)` }}>
            {info.subtitle}
          </div>
        </div>

        {/* Body */}
        <div className="text-center" style={{ marginTop: cq(1.6) }}>
          <p style={{ fontSize: cq(1.3), fontStyle: "italic", opacity: 0.85, fontFamily: "var(--font-fraunces), Georgia, serif" }}>{info.lead}</p>
          <p style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontStyle: "italic", fontWeight: 600, fontSize: cq(3.7), color: c.deep, lineHeight: 1.15, marginTop: cq(0.5) }}>{data.recipientName}</p>
          <div className="mx-auto" style={{ width: cq(38), height: cq(0.12), marginTop: cq(0.3), background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)` }} aria-hidden="true" />
          {data.recipientDetail ? <p style={{ fontSize: cq(1.05), marginTop: cq(0.45), opacity: 0.8 }}>{data.recipientDetail}</p> : null}
          <p className="mx-auto" style={{ fontSize: cq(1.38), lineHeight: 1.55, maxWidth: "74%", marginTop: cq(0.9) }}>{data.statement}</p>
          {data.highlights.length ? (
            <div className="flex flex-wrap justify-center" style={{ gap: cq(1.2), marginTop: cq(1.1) }}>
              {data.highlights.map((h) => (
                <div key={h.label} style={{ border: `${cq(0.1)} solid ${c.accent}`, borderRadius: cq(0.6), padding: `${cq(0.35)} ${cq(1.1)}`, background: "rgba(255,255,255,0.7)" }}>
                  <span style={{ fontSize: cq(0.8), textTransform: "uppercase", letterSpacing: cq(0.1), color: c.deep, fontWeight: 700 }}>{h.label}</span>
                  <span style={{ fontSize: cq(1.05), fontWeight: 600, marginLeft: cq(0.6) }}>{h.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer: QR (left) · golden seal (centre) · college seal and Principal's signature (right) */}
        <footer className="mt-auto grid items-end" style={{ gridTemplateColumns: "1fr auto 1fr", gap: cq(2) }}>
          <div className="flex items-end" style={{ gap: cq(1) }}>
            <div style={{ background: "#fff", padding: cq(0.45), border: `${cq(0.12)} solid ${c.accent}`, borderRadius: cq(0.5) }}>
              <svg viewBox={`0 0 ${qr.size} ${qr.size}`} style={{ width: cq(9.2), height: cq(9.2), display: "block" }} shapeRendering="crispEdges" role="img" aria-label={`QR code to verify certificate ${data.id} online`}>
                <rect width={qr.size} height={qr.size} fill="#fff" />
                <path d={qr.d} fill={c.ink} />
              </svg>
            </div>
            <div style={{ fontSize: cq(0.85), lineHeight: 1.45 }}>
              <p style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: cq(0.08), color: c.deep }}>Scan to verify</p>
              <p style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: cq(0.95), fontWeight: 600 }}>{data.id || "CIQ-0000-PREVIEW"}</p>
              <p style={{ opacity: 0.75 }}>{host}/verify</p>
            </div>
          </div>
          <div className="flex justify-center">
            <div style={{ width: cq(11.5) }}>
              <GoldSeal uid={uid} year={year} className="block h-auto w-full" />
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="relative flex flex-col items-center" style={{ width: cq(21) }}>
              <div style={{ width: cq(7.4), height: cq(7.4), transform: "rotate(-8deg)", marginBottom: `-${cq(0.5)}`, opacity: 0.9, mixBlendMode: "multiply" }}>
                {seal ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seal} alt={`Seal of ${p.collegeName}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <GeneratedCollegeSeal uid={uid} name={p.collegeName} initials={initials} color={c.ink} />
                )}
              </div>
              <div className="relative flex items-end justify-center" style={{ height: cq(3.6), width: "100%" }}>
                {signature ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signature} alt={`Signature of ${p.principalName}`} style={{ maxHeight: "100%", maxWidth: "90%", objectFit: "contain" }} />
                ) : (
                  <span style={{ fontFamily: "var(--font-script), cursive", fontSize: cq(2.6), color: c.ink, lineHeight: 1, whiteSpace: "nowrap" }}>{p.principalName}</span>
                )}
              </div>
              <div style={{ width: "100%", height: cq(0.1), background: c.ink, opacity: 0.6, marginTop: cq(0.3) }} />
              <p style={{ fontSize: cq(1.1), fontWeight: 700, marginTop: cq(0.4) }}>{p.principalName}</p>
              <p style={{ fontSize: cq(0.9), opacity: 0.8 }}>
                {p.principalDesignation}, {p.collegeName}
              </p>
            </div>
          </div>
        </footer>
      </div>

      {data.status === "revoked" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
          <span style={{ transform: "rotate(-18deg)", border: `${cq(0.5)} solid #b42318`, color: "#b42318", fontSize: cq(7), fontWeight: 900, letterSpacing: cq(1), padding: `${cq(0.5)} ${cq(3)}`, opacity: 0.75, fontFamily: "var(--font-fraunces), Georgia, serif" }}>REVOKED</span>
        </div>
      ) : null}
    </div>
  );
}
