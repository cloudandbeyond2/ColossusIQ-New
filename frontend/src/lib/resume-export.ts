import { resumeText, type ResumeDoc } from "@/lib/api/resume-schemas";

/* Client-side downloads for the Resume Builder. Nothing is sent anywhere: the file is made in the browser. */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function fileBase(d: ResumeDoc): string {
  const n = d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${n || "my"}-resume`;
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(d: ResumeDoc) {
  save(new Blob([resumeText(d)], { type: "text/plain;charset=utf-8" }), `${fileBase(d)}.txt`);
}

/** A Word-compatible document (HTML that Word, Pages and Google Docs open and edit). */
export function resumeHtml(d: ResumeDoc): string {
  const h = (t: string) => `<h2 style="font-size:11pt;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #444;padding-bottom:2px;margin:14pt 0 4pt">${esc(t)}</h2>`;
  const ul = (a: string[]) => (a.length ? `<ul style="margin:2pt 0 6pt 18pt;padding:0">${a.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "");
  const head = (left: string, right: string) => `<p style="margin:6pt 0 0"><b>${esc(left)}</b>${right ? ` <span style="color:#555">— ${esc(right)}</span>` : ""}</p>`;
  const parts: string[] = [
    `<h1 style="font-size:20pt;margin:0">${esc(d.name)}</h1>`,
    d.headline ? `<p style="margin:2pt 0;color:#333">${esc(d.headline)}</p>` : "",
    `<p style="margin:2pt 0;color:#555;font-size:9.5pt">${esc([d.email, d.phone, d.location, ...d.links].filter(Boolean).join("  |  "))}</p>`,
  ];
  if (d.summary) parts.push(h("Summary"), `<p>${esc(d.summary)}</p>`);
  if (d.education.length) parts.push(h("Education"), ...d.education.map((e) => `${head(e.degree, e.school)}<p style="margin:0;color:#555">${esc([e.period, e.score].filter(Boolean).join("  |  "))}</p>`));
  if (d.skills.length) parts.push(h("Skills"), `<p>${esc(d.skills.join(", "))}</p>`);
  if (d.projects.length) parts.push(h("Projects"), ...d.projects.map((p) => `${head(p.name, p.tech)}${p.link ? `<p style="margin:0;color:#555">${esc(p.link)}</p>` : ""}${ul(p.bullets)}`));
  if (d.experience.length) parts.push(h("Experience"), ...d.experience.map((x) => `${head(x.title, x.org)}<p style="margin:0;color:#555">${esc(x.period)}</p>${ul(x.bullets)}`));
  if (d.certifications.length) parts.push(h("Certifications"), ul(d.certifications));
  if (d.achievements.length) parts.push(h("Achievements"), ul(d.achievements));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(d.name)} - Resume</title></head><body style="font-family:Calibri,Arial,sans-serif;font-size:10.5pt;line-height:1.35;color:#111">${parts.join("")}</body></html>`;
}

export function downloadWord(d: ResumeDoc) {
  save(new Blob(["﻿", resumeHtml(d)], { type: "application/msword" }), `${fileBase(d)}.doc`);
}

/** Opens the browser's print dialog for the resume only; "Save as PDF" there produces the PDF. */
export function printResume(d: ResumeDoc) {
  const prev = document.title;
  document.title = fileBase(d); // becomes the suggested PDF file name
  const restore = () => {
    document.title = prev;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}
