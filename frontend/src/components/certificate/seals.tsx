/*
 * Seals for printed certificates, drawn as SVG so they print sharply at any size.
 * - GoldSeal: the platform's golden verification seal (centre bottom).
 * - GeneratedCollegeSeal: a rubber-stamp style college seal, used until the Principal uploads the real one.
 * Pure components (no hooks): `uid` keeps gradient and path ids unique when several certificates share a page.
 */

const star = (cx: number, cy: number, points: number, outer: number, inner: number) => {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    d += `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
};

export function GoldSeal({ uid, year, className }: { uid: string; year: string; className?: string }) {
  const g = `gs-${uid}`;
  return (
    <svg viewBox="0 0 200 230" className={className} role="img" aria-label="Golden verification seal: digitally signed and verifiable online">
      <defs>
        <radialGradient id={`${g}-gold`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="0.38" stopColor="#f0c75e" />
          <stop offset="0.75" stopColor="#c8902a" />
          <stop offset="1" stopColor="#8a5a12" />
        </radialGradient>
        <linearGradient id={`${g}-rib`} x1="0" x2="1">
          <stop offset="0" stopColor="#7d5310" />
          <stop offset="0.5" stopColor="#d6a43c" />
          <stop offset="1" stopColor="#7d5310" />
        </linearGradient>
        <path id={`${g}-ring`} d="M100 100 m-56 0 a56 56 0 1 1 112 0 a56 56 0 1 1 -112 0" />
      </defs>
      {/* Ribbon tails */}
      <path d="M70 150 L52 225 L74 210 L88 228 L98 158 Z" fill={`url(#${g}-rib)`} />
      <path d="M130 150 L148 225 L126 210 L112 228 L102 158 Z" fill={`url(#${g}-rib)`} />
      {/* Rosette */}
      <path d={star(100, 100, 32, 92, 82)} fill={`url(#${g}-gold)`} stroke="#8a5a12" strokeWidth="1.2" />
      <circle cx="100" cy="100" r="74" fill="none" stroke="#8a5a12" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="70" fill={`url(#${g}-gold)`} stroke="#fff3c4" strokeWidth="1" opacity="0.95" />
      <text fontSize="10.5" fontWeight="700" letterSpacing="2.2" fill="#5c3a06" fontFamily="var(--font-fraunces), Georgia, serif">
        <textPath href={`#${g}-ring`} startOffset="0">
          ✦ DIGITALLY VERIFIED ✦ AUTHENTIC CERTIFICATE ✦ SECURE ✦
        </textPath>
      </text>
      <circle cx="100" cy="100" r="44" fill="none" stroke="#8a5a12" strokeWidth="1.2" />
      <circle cx="100" cy="100" r="41" fill="none" stroke="#fff3c4" strokeWidth="0.8" strokeDasharray="2 2.5" />
      <path d="M82 96 L95 109 L119 84" fill="none" stroke="#5c3a06" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="100" y="128" textAnchor="middle" fontSize="11" fontWeight="800" letterSpacing="1.8" fill="#5c3a06" fontFamily="var(--font-fraunces), Georgia, serif">
        VERIFIED
      </text>
      <text x="100" y="139" textAnchor="middle" fontSize="8" fontWeight="600" letterSpacing="1" fill="#6b4508" fontFamily="var(--font-fraunces), Georgia, serif">
        {year}
      </text>
    </svg>
  );
}

export function GeneratedCollegeSeal({ uid, name, initials, color, className }: { uid: string; name: string; initials: string; color: string; className?: string }) {
  const g = `cs-${uid}`;
  const ring = name.toUpperCase().slice(0, 46);
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={`Seal of ${name}`}>
      <defs>
        <path id={`${g}-ring`} d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" />
      </defs>
      <g fill="none" stroke={color} opacity="0.88">
        <circle cx="100" cy="100" r="94" strokeWidth="5" />
        <circle cx="100" cy="100" r="86" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="58" strokeWidth="2" />
        <circle cx="100" cy="100" r="53" strokeWidth="0.8" />
      </g>
      <text fontSize="15" fontWeight="700" letterSpacing="2.5" fill={color} opacity="0.88" fontFamily="var(--font-fraunces), Georgia, serif">
        <textPath href={`#${g}-ring`} startOffset="0" textLength="440" lengthAdjust="spacingAndGlyphs">
          {`${ring} ★ `}
        </textPath>
      </text>
      <path d={star(100, 62, 5, 9, 4)} fill={color} opacity="0.88" />
      <text x="100" y="112" textAnchor="middle" fontSize="30" fontWeight="800" fill={color} opacity="0.88" fontFamily="var(--font-fraunces), Georgia, serif">
        {initials}
      </text>
      <text x="100" y="136" textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="3" fill={color} opacity="0.88" fontFamily="var(--font-fraunces), Georgia, serif">
        SEAL
      </text>
    </svg>
  );
}

/** An ornamental corner flourish (drawn for the top-left corner; rotate for the others). */
export function CornerOrnament({ color, className, style }: { color: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
        <path d="M6 94 V30 Q6 6 30 6 H94" />
        <path d="M14 94 V36 Q14 14 36 14 H94" strokeWidth="0.8" />
        <path d="M26 26 Q46 14 58 30 Q66 42 50 46 Q40 48 42 38" />
        <path d="M26 26 Q14 46 30 58 Q42 66 46 50 Q48 40 38 42" />
      </g>
      <circle cx="26" cy="26" r="4" fill={color} />
    </svg>
  );
}
