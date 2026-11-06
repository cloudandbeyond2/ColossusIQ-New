import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listEvents, createEvent, updateEvent, deleteEvent } from "@/lib/api/mock/event-store";
import { dispatch } from "@/lib/api/mock/router";
import type { SessionPayload } from "@/lib/auth/session";

const adminSession: SessionPayload = {
  sub: "admin-1",
  role: "admin",
  name: "University Admin",
  tenant: "univ-1",
  college: "COL-1001",
  mfa: true,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

describe("Events store and API routing", () => {
  it("lists initial events", () => {
    const res = listEvents();
    expect(res.events.length).toBeGreaterThan(0);
    expect(res.events[0]).toHaveProperty("title");
    expect(res.events[0]).toHaveProperty("type");
    expect(res.events[0]).toHaveProperty("status");
  });

  it("creates a new event", () => {
    const created = createEvent({
      title: "Annual Hackathon 2026",
      type: "Workshop",
      status: "Upcoming",
      date: "2026-12-01",
      venue: "Tech Auditorium",
      organizer: "CSE Dept",
      capacity: 250,
      description: "24-hour coding challenge",
    });

    expect(created.id).toBeDefined();
    expect(created.title).toBe("Annual Hackathon 2026");
    expect(created.type).toBe("Workshop");

    const list = listEvents();
    expect(list.events.some((e) => e.title === "Annual Hackathon 2026")).toBe(true);
  });

  it("updates an existing event", () => {
    const created = createEvent({
      title: "Old Seminar",
      type: "Seminar",
      status: "Upcoming",
      date: "2026-12-10",
    });

    const updated = updateEvent(created.id, { title: "Updated Seminar", status: "Ongoing" });
    expect(updated).not.toBeNull();
    expect(updated?.title).toBe("Updated Seminar");
    expect(updated?.status).toBe("Ongoing");
  });

  it("deletes an event", () => {
    const created = createEvent({
      title: "Event to delete",
      type: "Academic",
      status: "Upcoming",
      date: "2026-12-15",
    });

    const ok = deleteEvent(created.id);
    expect(ok).toBe(true);

    const list = listEvents();
    expect(list.events.some((e) => e.id === created.id)).toBe(false);
  });

  it("dispatches GET /api/v1/modules/events via router", async () => {
    const res = await dispatch("GET", ["modules", "events"], null, adminSession, new URLSearchParams());
    expect(res.status).toBe(200);
    expect((res.body as any).events).toBeDefined();
    expect(Array.isArray((res.body as any).events)).toBe(true);
  });

  it("dispatches POST /api/v1/modules/events via router", async () => {
    const body = {
      title: "Campus Cultural Eve",
      type: "Cultural",
      status: "Upcoming",
      date: "2026-12-20",
      venue: "Open Air Theatre",
    };
    const res = await dispatch("POST", ["modules", "events"], body, adminSession, new URLSearchParams());
    expect(res.status).toBe(201);
    expect((res.body as any).title).toBe("Campus Cultural Eve");
  });

  it("dispatches PUT /api/v1/modules/events/:id via router", async () => {
    const created = createEvent({ title: "Pre-Update Event", date: "2026-12-25" });
    const res = await dispatch("PUT", ["modules", "events", created.id], { title: "Post-Update Event" }, adminSession, new URLSearchParams());
    expect(res.status).toBe(200);
    expect((res.body as any).title).toBe("Post-Update Event");
  });

  it("dispatches DELETE /api/v1/modules/events/:id via router", async () => {
    const created = createEvent({ title: "Event to remove", date: "2026-12-28" });
    const res = await dispatch("DELETE", ["modules", "events", created.id], null, adminSession, new URLSearchParams());
    expect(res.status).toBe(200);
    expect((res.body as any).ok).toBe(true);
  });
});
