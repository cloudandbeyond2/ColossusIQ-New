import "server-only";
import type { SessionPayload } from "@/lib/auth/session";
import {
  MENTOR_AVAILABILITY,
  MENTOR_TYPES,
  type AssignMentorInput,
  type InviteMentorInput,
  type LogSessionInput,
  type MentorItem,
  type MentorNetworkOverview,
} from "@/lib/api/mentor-network-schemas";
import { IncubationError, incubationAudit, incubationCollege } from "./incubation-common";
import { incubationData, type MentorRec } from "./incubation-data";

/** Mentors with their live assignments (from the pipeline) and the number of sessions logged. */
async function hydrate(college: string): Promise<MentorItem[]> {
  const data = incubationData();
  const [mentors, assignments, ventures, counts] = await Promise.all([
    data.mentors(college),
    data.assignments(college),
    data.ventures(college),
    data.sessionCounts(college),
  ]);
  const byVenture = new Map(ventures.map((v) => [v.id, v]));
  return mentors.map((m) => {
    const assignedVentures = assignments
      .filter((a) => a.mentorId === m.id)
      .flatMap((a) => {
        const v = byVenture.get(a.ventureId);
        return v ? [{ ventureId: v.id, ventureName: v.name, stage: v.stage }] : [];
      });
    return {
      ...m,
      activeVenturesCount: assignedVentures.length,
      assignedVentures,
      sessionsCompleted: counts[m.id] ?? 0,
      // Nobody rates mentors yet, so there is no rating to show.
      rating: null,
    };
  });
}

async function one(college: string, id: string): Promise<MentorItem | null> {
  return (await hydrate(college)).find((m) => m.id === id) ?? null;
}

export async function getMentorNetworkOverview(session: SessionPayload): Promise<MentorNetworkOverview> {
  const college = await incubationCollege(session);
  const list = await hydrate(college);
  return {
    totalMentors: list.length,
    availableCount: list.filter((m) => m.availability === "Available").length,
    activeAssignmentsCount: list.reduce((acc, m) => acc + m.assignedVentures.length, 0),
    totalSessionsConducted: list.reduce((acc, m) => acc + m.sessionsCompleted, 0),
    averageRating: null,
    mentors: list,
  };
}

export async function inviteMentor(session: SessionPayload, input: InviteMentorInput): Promise<MentorItem> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const email = input.email.trim().toLowerCase();
  if ((await data.mentors(college)).some((m) => m.email.toLowerCase() === email)) {
    throw new IncubationError("A mentor with this email is already in the network.", 409);
  }
  const created = await data.addMentor(college, {
    name: input.name.trim(),
    designation: input.designation.trim(),
    company: input.company.trim(),
    type: input.type,
    expertise: input.expertise.map((e) => e.trim()).filter(Boolean),
    email,
    phone: input.phone,
    linkedinUrl: input.linkedinUrl,
    availability: input.availability,
    status: "Active",
  });
  await incubationAudit(session, college, `Added mentor ${created.name}`, "mentors");
  return { ...created, activeVenturesCount: 0, assignedVentures: [], sessionsCompleted: 0, rating: null };
}

export async function updateMentor(session: SessionPayload, mentorId: string, updates: Record<string, unknown>): Promise<MentorItem | null> {
  const college = await incubationCollege(session);
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim().length >= 2 ? v.trim().slice(0, max) : undefined);
  const patch: Partial<MentorRec> = {};
  const designation = str(updates.designation, 150);
  const company = str(updates.company, 120);
  if (designation) patch.designation = designation;
  if (company) patch.company = company;
  if (typeof updates.phone === "string") patch.phone = updates.phone.trim().slice(0, 30);
  if (typeof updates.linkedinUrl === "string") patch.linkedinUrl = updates.linkedinUrl.trim().slice(0, 300);
  if (typeof updates.availability === "string") {
    if (!(MENTOR_AVAILABILITY as readonly string[]).includes(updates.availability)) throw new IncubationError("Choose a valid availability.");
    patch.availability = updates.availability as MentorRec["availability"];
  }
  if (typeof updates.type === "string") {
    if (!(MENTOR_TYPES as readonly string[]).includes(updates.type)) throw new IncubationError("Choose a valid mentor type.");
    patch.type = updates.type as MentorRec["type"];
  }
  if (typeof updates.status === "string") {
    if (!["Active", "Pending Invitation", "Inactive"].includes(updates.status)) throw new IncubationError("Choose a valid status.");
    patch.status = updates.status as MentorRec["status"];
  }
  if (Array.isArray(updates.expertise)) {
    const ex = updates.expertise.filter((e): e is string => typeof e === "string").map((e) => e.trim()).filter(Boolean);
    if (ex.length === 0) throw new IncubationError("Add at least one area of expertise.");
    patch.expertise = ex;
  }
  const saved = await incubationData().saveMentor(college, mentorId, patch);
  if (!saved) return null;
  await incubationAudit(session, college, `Updated mentor ${saved.name}`, "mentors");
  return one(college, mentorId);
}

export async function assignMentorToVenture(session: SessionPayload, mentorId: string, input: AssignMentorInput): Promise<MentorItem | null> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const mentor = await data.mentor(college, mentorId);
  if (!mentor) return null;
  const venture = await data.venture(college, input.ventureId);
  if (!venture) throw new IncubationError("That venture is not in the incubation pipeline.", 404);
  await data.assign(college, mentorId, venture.id);
  await incubationAudit(session, college, `Assigned ${mentor.name} to ${venture.name}`, "mentors");
  return one(college, mentorId);
}

export async function unassignMentorFromVenture(session: SessionPayload, mentorId: string, ventureId: string): Promise<MentorItem | null> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const mentor = await data.mentor(college, mentorId);
  if (!mentor) return null;
  await data.unassign(college, mentorId, ventureId);
  await incubationAudit(session, college, `Unassigned ${mentor.name} from a venture`, "mentors");
  return one(college, mentorId);
}

export async function logMentorshipSession(session: SessionPayload, mentorId: string, input: LogSessionInput): Promise<MentorItem | null> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const mentor = await data.mentor(college, mentorId);
  if (!mentor) return null;
  await data.addSession(college, mentorId, {
    ventureName: input.ventureName.trim(),
    topic: input.topic.trim(),
    notes: input.notes.trim(),
    durationMinutes: Math.min(1440, Math.max(1, Math.round(input.durationMinutes))),
    loggedBySub: session.sub,
  });
  return one(college, mentorId);
}

export async function deleteMentor(session: SessionPayload, mentorId: string): Promise<boolean> {
  const college = await incubationCollege(session);
  const data = incubationData();
  const mentor = await data.mentor(college, mentorId);
  if (!mentor) return false;
  const removed = await data.removeMentor(college, mentorId);
  if (removed) await incubationAudit(session, college, `Removed mentor ${mentor.name}`, "mentors");
  return removed;
}
