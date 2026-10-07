import QRCode from "qrcode";

/**
 * A QR code as one SVG path (dark modules merged into horizontal runs), so it can be drawn as plain React SVG with no
 * image or HTML injection. Medium error correction survives print and phone-camera blur. `size` includes a 2-module
 * quiet zone on every side.
 */
export function qrPath(text: string): { size: number; d: string } {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const data = qr.modules.data;
  const q = 2;
  let d = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!data[y * n + x]) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < n && data[y * n + x + w]) w++;
      d += `M${x + q} ${y + q}h${w}v1h-${w}z`;
      x += w;
    }
  }
  return { size: n + 2 * q, d };
}
