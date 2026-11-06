import "server-only";
import { RESOURCES } from "@/config/resources";
import { getStore } from "@/lib/data";

export const EVENT_TYPES = [
  "Academic",
  "Cultural",
  "Sports",
  "Workshop",
  "Seminar",
  "Exam",
  "Holiday",
  "Other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = ["Upcoming", "Ongoing", "Completed", "Cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface CalEvent {
  id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  date: string;
  endDate?: string;
  time?: string;
  venue?: string;
  organizer?: string;
  capacity?: number;
  registered?: number;
  description?: string;
}

const INITIAL_EVENTS: CalEvent[] = [
  { id: "1", title: "End Semester Examination", type: "Exam", status: "Upcoming", date: "2026-11-10", endDate: "2026-11-25", time: "09:00", venue: "Main Examination Hall", organizer: "Controller of Exams", capacity: 300, registered: 240, description: "End semester exams for all departments." },
  { id: "2", title: "Tech Symposium 2026", type: "Academic", status: "Upcoming", date: "2026-11-05", time: "10:00", venue: "Auditorium", organizer: "CSE Department", capacity: 500, registered: 320 },
  { id: "3", title: "Annual Sports Meet", type: "Sports", status: "Upcoming", date: "2026-10-30", endDate: "2026-10-31", time: "08:00", venue: "Sports Ground", organizer: "Physical Education Dept", capacity: 600, registered: 580 },
  { id: "4", title: "AI Workshop - Basics to Production", type: "Workshop", status: "Completed", date: "2026-10-15", time: "10:00", venue: "Lab 3, Block B", organizer: "Dr. Anand V.", capacity: 60, registered: 60 },
  { id: "5", title: "Diwali Holiday", type: "Holiday", status: "Completed", date: "2026-10-20", endDate: "2026-10-22", organizer: "Administration" },
  { id: "6", title: "Placement Drive - TCS", type: "Academic", status: "Upcoming", date: "2026-11-08", time: "09:00", venue: "Seminar Hall", organizer: "Placement Cell", capacity: 120, registered: 95 },
];

let eventsList: CalEvent[] = [...INITIAL_EVENTS];

export function listEvents(): { events: CalEvent[]; total: number } {
  return { events: [...eventsList], total: eventsList.length };
}

export function createEvent(item: Partial<CalEvent>, collegeId?: string): CalEvent {
  const newEvent: CalEvent = {
    id: item.id && item.id.trim() ? item.id.trim() : `EVT-${Date.now()}`,
    title: item.title && item.title.trim() ? item.title.trim() : "New Event",
    type: (EVENT_TYPES.includes(item.type as EventType) ? item.type : "Academic") as EventType,
    status: (EVENT_STATUSES.includes(item.status as EventStatus) ? item.status : "Upcoming") as EventStatus,
    date: item.date || new Date().toISOString().split("T")[0]!,
    endDate: item.endDate || undefined,
    time: item.time || undefined,
    venue: item.venue || undefined,
    organizer: item.organizer || undefined,
    capacity: item.capacity !== undefined ? Number(item.capacity) : 100,
    registered: item.registered !== undefined ? Number(item.registered) : 0,
    description: item.description || undefined,
  };
  eventsList.unshift(newEvent);

  try {
    const resType = item.type === "Workshop" ? "Workshop"
      : item.type === "Sports" ? "Sports"
      : item.type === "Cultural" ? "Cultural"
      : "Seminar";
    void getStore().records.create(RESOURCES.events!, {
      title: newEvent.title,
      type: resType,
      date: newEvent.date,
      startTime: newEvent.time || "09:00",
      venue: newEvent.venue || "Campus",
      organiser: newEvent.organizer || "Administration",
      capacity: newEvent.capacity || 100,
      registrationOpen: true,
      status: newEvent.status === "Completed" ? "Completed" : newEvent.status === "Cancelled" ? "Cancelled" : "Published",
      description: newEvent.description || "",
    }, collegeId ?? null).catch(() => {});
  } catch {}

  return newEvent;
}

export function updateEvent(id: string, item: Partial<CalEvent>): CalEvent | null {
  const idx = eventsList.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  eventsList[idx] = { ...eventsList[idx]!, ...item };
  return eventsList[idx]!;
}

export function deleteEvent(id: string): boolean {
  const before = eventsList.length;
  eventsList = eventsList.filter((e) => e.id !== id);
  return eventsList.length < before;
}
