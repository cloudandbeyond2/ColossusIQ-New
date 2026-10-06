import "server-only";
import { RESOURCES, WEBSITE, emptyValues, type RecordValue } from "@/config/resources";
import { STREAM_DEFS, streamOfType, type Stream } from "@/config/streams";
import { getStore } from "@/lib/data";
import type { Site } from "@/lib/data/store";
import { getCollege, listColleges } from "./records";

/* One website record per college, created from the college's stream on first use, editable by its Principal. */

const ABOUT: Record<Stream, (name: string, city: string, year: unknown) => string> = {
  engineering: (n, c, y) =>
    `${n}, established in ${y} in ${c}, is an AICTE-approved engineering college affiliated to Tamil Nadu Technical University. We offer undergraduate and postgraduate programmes in computing, electronics, mechanical and civil engineering, with industry-linked labs, an active incubation cell and strong placement outcomes.`,
  medical: (n, c, y) =>
    `${n} (est. ${y}) in ${c} is a government-recognised institution of medical and health sciences with an attached teaching hospital. Our CBME-aligned curriculum combines early clinical exposure, skills-lab training and community postings, preparing compassionate, competent doctors, nurses and allied health professionals.`,
  artsScience: (n, c, y) =>
    `${n}, founded in ${y} in ${c}, offers choice-based undergraduate and postgraduate programmes in languages, commerce, the sciences and computing. A NAAC-accredited campus with a vibrant cultural life, strong research culture and extension activities in the community.`,
  management: (n, c, y) =>
    `${n} (est. ${y}) in ${c} offers industry-integrated management programmes with live projects, analytics labs and a mentorship network of alumni leaders.`,
  polytechnic: (n, c, y) =>
    `${n} (est. ${y}) in ${c} offers hands-on diploma programmes with modern workshops and apprenticeship tie-ups with regional industry.`,
};

const TAGLINE: Record<Stream, string> = {
  engineering: "Engineering minds that build tomorrow",
  medical: "Healing with knowledge, serving with compassion",
  artsScience: "Where ideas, culture and science meet",
  management: "Leaders for a changing world",
  polytechnic: "Skills that power industry",
};

const HIGHLIGHTS: Record<Stream, string> = {
  engineering: "AICTE approved\nNBA-accredited programmes\n92% placement (2025)\nIncubation cell",
  medical: "NMC recognised\n1,120-bed teaching hospital\nCBME curriculum\nSkills & simulation lab",
  artsScience: "NAAC A+\nCBCS curriculum\n40+ clubs & societies\nResearch centre",
  management: "AICTE approved\nIndustry-integrated MBA\nAnalytics lab",
  polytechnic: "DOTE approved\nApprenticeship tie-ups\nModern workshops",
};

async function defaultSite(collegeId: string): Promise<Site | undefined> {
  const c = await getCollege(collegeId);
  if (!c) return undefined;
  const stream = streamOfType(c.type);
  return {
    ...emptyValues(WEBSITE),
    tagline: TAGLINE[stream],
    heroImage: stream === "medical" ? "/campus/hospital.svg" : "/campus/campus.svg",
    announcement: c.admissionsOpen ? "Admissions 2026–27 are open — apply online" : "",
    about: ABOUT[stream](String(c.name), String(c.city), c.established ?? "—"),
    principalMessage: `Welcome to ${String(c.name)}. Our commitment is to every learner's growth — academic, professional and personal. I invite you to explore our programmes and campus life.\n— ${String(c.principal)}, Principal`,
    highlights: HIGHLIGHTS[stream],
    address: `${String(c.name)}, ${String(c.city)}, Tamil Nadu`,
    phone: typeof c.phone === "string" ? c.phone : "9876500000",
    email: typeof c.email === "string" ? c.email : "office@college.edu.in",
    officeHours: "Mon–Sat, 9:00 AM – 5:00 PM",
    showEvents: true,
    showGallery: true,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}

export async function getSite(collegeId: string): Promise<Site | undefined> {
  const s = await getStore().sites.get(collegeId);
  if (s) return s;
  return defaultSite(collegeId);
}

export async function saveSite(collegeId: string, data: Record<string, RecordValue>): Promise<Site> {
  const prev = await getSite(collegeId);
  const next: Site = { ...(prev ?? emptyValues(WEBSITE)), ...data, version: (prev?.version ?? 0) + 1, updatedAt: new Date().toISOString() } as Site;
  return getStore().sites.save(collegeId, next);
}

/* ── public landing payload ─────────────────────── */
export async function publicCollegePage(collegeId: string) {
  const c = await getCollege(collegeId);
  if (!c || c.status !== "Active") return null; // only live colleges have a public site
  const site = (await getSite(collegeId))!;
  const stream = streamOfType(c.type);
  const def = STREAM_DEFS[stream];
  const today = new Date().toISOString().slice(0, 10);
  const events = (await getStore().records.all(RESOURCES.events!, collegeId))
    .filter((e) => e.status === "Published" && String(e.date) >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 6)
    .map((e) => ({ id: e.id, title: String(e.title), type: String(e.type), date: String(e.date), startTime: String(e.startTime), venue: String(e.venue), registrationOpen: e.registrationOpen === true }));
  const gallery = (await getStore().records.all(RESOURCES.gallery!, collegeId))
    .filter((g) => g.status === "Published")
    .sort((a, b) => Number(b.featured === true) - Number(a.featured === true) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12)
    .map((g) => ({ id: g.id, title: String(g.title), caption: String(g.caption ?? ""), category: String(g.category), image: String(g.image) }));
  const programs =
    c.type === "Nursing & Allied Health Sciences"
      ? def.programs.filter((p) => !/^(MBBS|BDS|MD|MS)/.test(p))
      : c.type === "Medical College & Hospital"
        ? def.programs.filter((p) => /^(MBBS|MD|MS|B\.Sc Nursing)/.test(p))
        : def.programs;
  return {
    college: {
      id: c.id,
      name: String(c.name),
      type: String(c.type),
      city: String(c.city),
      established: typeof c.established === "number" ? c.established : null,
      capacity: typeof c.studentCapacity === "number" ? c.studentCapacity : null,
      principal: String(c.principal),
      admissionsOpen: c.admissionsOpen === true && Array.isArray(c.modules) && (c.modules as string[]).includes("Admissions"),
      stream,
      streamLabel: def.label,
      regulator: def.regulator,
    },
    site: {
      tagline: String(site.tagline),
      heroImage: String(site.heroImage),
      announcement: String(site.announcement ?? ""),
      about: String(site.about),
      principalMessage: String(site.principalMessage ?? ""),
      highlights: String(site.highlights ?? "").split("\n").map((h) => h.trim()).filter(Boolean).slice(0, 8),
      address: String(site.address),
      phone: String(site.phone),
      email: String(site.email),
      officeHours: String(site.officeHours ?? ""),
      showEvents: site.showEvents !== false,
      showGallery: site.showGallery !== false,
    },
    programs: [...programs],
    departments: def.departments.filter((d) => !/Administration/.test(d)),
    events,
    gallery,
  };
}
export type PublicCollegePage = NonNullable<Awaited<ReturnType<typeof publicCollegePage>>>;

export async function publicCollegeDirectory() {
  const active = (await listColleges()).filter((c) => c.status === "Active");
  const rows = await Promise.all(
    active.map(async (c) => {
      const site = (await getSite(c.id))!;
      const stream = streamOfType(c.type);
      return { id: c.id, name: String(c.name), type: String(c.type), city: String(c.city), stream, streamLabel: STREAM_DEFS[stream].label, tagline: String(site.tagline), heroImage: String(site.heroImage) };
    }),
  );
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
