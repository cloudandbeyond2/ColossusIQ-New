import "server-only";
import { ALL_COLLEGES } from "@/config/tenancy";
import type { Role } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { dataBackend, getStore } from "@/lib/data";
import { db, isUuid } from "@/lib/data/postgres/db";
import type { Notification } from "@/lib/api/schemas";
import { feeNotifications } from "@/lib/billing/reminders";
import { calendarNotifications } from "./academic-calendar";
import { assignmentNotifications } from "./assignments";
import { experienceNotifications } from "./experience";
import { noticeNotifications } from "./notices";
import { noticeStore } from "./notice-store";
import type { MockResult } from "./router";

/*
 * Notification management: aggregation across academic notices, assignments, calendar, fees,
 * experience passport and DB notifications, with read-state tracking and deep-link routing.
 */

const readStore = new Map<string, Set<string>>();

export function getReadNotificationIds(userSub: string): Set<string> {
  let set = readStore.get(userSub);
  if (!set) {
    set = new Set<string>();
    readStore.set(userSub, set);
  }
  return set;
}

export function isNotificationRead(userSub: string, notificationId: string): boolean {
  return getReadNotificationIds(userSub).has(notificationId);
}

export function resolveNotificationHref(n: Notification, role: Role): string {
  if (n.href) return n.href;
  const id = n.id.toLowerCase();
  const title = n.title.toLowerCase();

  if (id.startsWith("notice-") || title.includes("notice") || title.includes("announcement")) {
    const noticeId = id.startsWith("notice-") ? n.id.replace(/^notice-/, "") : "";
    return noticeId ? `/${role}/notice-board?id=${encodeURIComponent(noticeId)}` : `/${role}/notice-board`;
  }
  if (id.startsWith("asn-graded-")) {
    const asnId = n.id.replace(/^asn-graded-/, "");
    return `/${role}/assignments?tab=done&id=${encodeURIComponent(asnId)}`;
  }
  if (id.startsWith("asn-")) {
    const asnId = n.id.replace(/^asn-/, "");
    return `/${role}/assignments?tab=todo&id=${encodeURIComponent(asnId)}`;
  }
  if (title.includes("assignment") || title.includes("marked:")) {
    return `/${role}/assignments`;
  }
  if (id.startsWith("cal-") || title.includes("calendar") || title.includes("today:") || title.includes("tomorrow:") || title.includes("event")) {
    return `/${role}/academic-calendar`;
  }
  if (id.startsWith("fee-") || title.includes("fee") || title.includes("dues")) {
    return role === "student" ? "/student/fee-payment" : `/${role}/student-fees`;
  }
  if (id.startsWith("exp-") || title.includes("experience") || title.includes("passport")) {
    return `/${role}/experience`;
  }
  if (title.includes("exam")) {
    return `/${role}/academic-calendar`;
  }
  if (title.includes("evaluation") || title.includes("evaluated")) {
    return role === "faculty" || role === "hod" ? `/${role}/assignments` : `/${role}`;
  }
  if (title.includes("mentor") || title.includes("study plan")) {
    return role === "student" ? "/student/mentor" : `/${role}`;
  }
  if (title.includes("skill booster")) {
    return `/${role}/skill-booster`;
  }
  if (title.includes("security") || title.includes("sign-in") || title.includes("password")) {
    return `/${role}/profile`;
  }
  return `/${role}`;
}

export async function markNotificationRead(session: SessionPayload, notificationId: string): Promise<boolean> {
  const readIds = getReadNotificationIds(session.sub);
  readIds.add(notificationId);

  // If notice notification: mark it read in the notice store
  if (notificationId.startsWith("notice-")) {
    const noticeId = notificationId.replace(/^notice-/, "");
    try {
      await noticeStore().markRead(noticeId, session.sub, session.college === ALL_COLLEGES ? null : session.college, false);
    } catch {
      // Ignore
    }
  }

  // If UUID: mark it read in postgres notification table if applicable
  if (isUuid(notificationId) && dataBackend() === "postgres") {
    try {
      await db().notification.updateMany({
        where: { id: notificationId, userId: session.sub },
        data: { readAt: new Date() },
      });
    } catch {
      // Ignore
    }
  }

  return true;
}

export async function markAllNotificationsRead(session: SessionPayload): Promise<boolean> {
  const list = await getNotificationsList(session);
  const readIds = getReadNotificationIds(session.sub);

  for (const n of list) {
    readIds.add(n.id);
    if (n.id.startsWith("notice-")) {
      const noticeId = n.id.replace(/^notice-/, "");
      try {
        await noticeStore().markRead(noticeId, session.sub, session.college === ALL_COLLEGES ? null : session.college, false);
      } catch {
        // Ignore
      }
    }
    if (isUuid(n.id) && dataBackend() === "postgres") {
      try {
        await db().notification.updateMany({
          where: { id: n.id, userId: session.sub },
          data: { readAt: new Date() },
        });
      } catch {
        // Ignore
      }
    }
  }

  return true;
}

export async function getNotificationsList(session: SessionPayload): Promise<Notification[]> {
  const rawList = [
    ...(await feeNotifications(session)),
    ...(await noticeNotifications(session)),
    ...(await calendarNotifications(session)),
    ...(await assignmentNotifications(session)),
    ...(await experienceNotifications(session)),
    ...(await getStore().notifications.forUser(session)),
  ];

  const cfg = (await getStore().settings.get(session.college, "notifications-config"))
    ?? (session.college !== "all" ? await getStore().settings.get("all", "notifications-config") : undefined);

  let list = rawList;
  if (cfg) {
    // Channel rule: In-app / web notifications disabled
    if (cfg.web === false) {
      return [];
    }

    // Rule: Exam reminders
    if (cfg.exam === "Off") {
      list = list.filter((n) => !n.title.toLowerCase().includes("exam"));
    }

    // Rule: Weekly faculty digest
    if (cfg.digest === false && (session.role === "faculty" || session.role === "institution")) {
      list = list.filter((n) => !n.title.toLowerCase().includes("digest") && !n.title.toLowerCase().includes("weekly summary"));
    }

    // Rule: Quiet hours
    if (typeof cfg.quiet === "string" && cfg.quiet !== "None") {
      const parts = cfg.quiet.split("–");
      if (parts.length === 2) {
        const startHour = parseInt((parts[0] ?? "").split(":")[0] ?? "22", 10);
        const endHour = parseInt((parts[1] ?? "").split(":")[0] ?? "7", 10);
        const curHour = new Date().getHours();
        const inQuiet = startHour > endHour
          ? (curHour >= startHour || curHour < endHour)
          : (curHour >= startHour && curHour < endHour);
        if (inQuiet) {
          list = list.filter((n) => n.tone === "rose" || n.title.toLowerCase().includes("security"));
        }
      }
    }
  }

  const readIds = getReadNotificationIds(session.sub);
  return list.map((n) => {
    const isRead = readIds.has(n.id) || !n.unread;
    return {
      ...n,
      unread: !isRead,
      href: n.href ?? resolveNotificationHref(n, session.role),
    };
  });
}

export async function dispatchNotifications(
  method: string,
  segs: string[],
  _rawBody: unknown,
  session: SessionPayload,
): Promise<MockResult> {
  const [, notifId, action] = segs;

  // GET notifications
  if (method === "GET" && segs.length === 1) {
    const list = await getNotificationsList(session);
    return { status: 200, body: list };
  }

  // POST notifications/:id/read
  if (method === "POST" && notifId && action === "read" && segs.length === 3) {
    const id = decodeURIComponent(notifId);
    await markNotificationRead(session, id);
    return { status: 200, body: { ok: true, id } };
  }

  // POST notifications/read-all
  if (method === "POST" && segs[1] === "read-all" && segs.length === 2) {
    await markAllNotificationsRead(session);
    return { status: 200, body: { ok: true } };
  }

  return { status: 404, body: { error: { code: "not_found", message: "Not found." } } };
}
