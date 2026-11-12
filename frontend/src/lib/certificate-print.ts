/**
 * Dedicated helper to print a certificate or document element in isolation.
 * Prevents screen UI, modals, backdrops, and navigation shells from leaking into the printout.
 */
export function printCertificate(element: HTMLElement, title?: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const certTitle = title || "Certificate";

  // Gather stylesheet link tags and style blocks from the host page
  const styleNodes = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
    .map((el) => el.outerHTML)
    .join("\n");

  const htmlClasses = document.documentElement.className || "";

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="en" class="${htmlClasses}">
<head>
  <meta charset="utf-8">
  <title>${certTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title>
  ${styleNodes}
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm;
    }
    *, *::before, *::after {
      visibility: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #1b2233 !important;
      width: 100% !important;
      min-height: 100% !important;
    }
    .print-sheet-wrapper {
      width: 100% !important;
      max-width: 980px !important;
      margin: 10px auto !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
  </style>
</head>
<body class="bg-white">
  <div class="print-sheet-wrapper">
    ${element.outerHTML}
  </div>
</body>
</html>`);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch {
      window.print();
    } finally {
      setTimeout(() => {
        iframe.remove();
      }, 3000);
    }
  }, 350);
}
