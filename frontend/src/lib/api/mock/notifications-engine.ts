import "server-only";
import { sharedState } from "./global-state";

export interface DeliveryLogItem {
  id: string;
  title: string;
  body: string;
  channel: "web" | "email" | "push" | "sms" | "whatsapp";
  targetRole: string;
  dispatchedAt: string;
  status: "Delivered" | "Blocked by Channel Rule" | "Queued";
  reason?: string;
}

const DEFAULT_LOGS: DeliveryLogItem[] = [
  {
    id: "log-1",
    title: "Semester Exam Hall Ticket Published",
    body: "Final timetable & hall tickets for Odd Semester examinations are now available for download.",
    channel: "email",
    targetRole: "student",
    dispatchedAt: "25 minutes ago",
    status: "Delivered",
  },
  {
    id: "log-2",
    title: "Attendance Defaulter Warning (<75%)",
    body: "Critical: Cumulative attendance has dropped to 71.4%. Requires immediate academic counselor review.",
    channel: "sms",
    targetRole: "student",
    dispatchedAt: "1 hour ago",
    status: "Delivered",
  },
  {
    id: "log-3",
    title: "AI Evaluation Batch Completed",
    body: "14 AI-evaluated answers from DBMS Internal Assessment I are queued for faculty sign-off.",
    channel: "web",
    targetRole: "faculty",
    dispatchedAt: "3 hours ago",
    status: "Delivered",
  },
  {
    id: "log-4",
    title: "Weekly Institutional Digest",
    body: "Campus key metrics: 94.2% attendance compliance, 82 placement offers, and AICTE compliance checklist on track.",
    channel: "email",
    targetRole: "institution",
    dispatchedAt: "1 day ago",
    status: "Delivered",
  },
  {
    id: "log-5",
    title: "Accenture On-Campus Drive Registration",
    body: "Final year eligibility window closing in 48 hours for Software Engineering FTE roles.",
    channel: "push",
    targetRole: "student",
    dispatchedAt: "2 days ago",
    status: "Delivered",
  },
];

const deliveryLogs = sharedState("notifications.deliveryLog", () => [...DEFAULT_LOGS]);

export function getDeliveryLogs(): DeliveryLogItem[] {
  return [...deliveryLogs];
}

export function recordDeliveryLog(log: DeliveryLogItem) {
  deliveryLogs.unshift(log);
  if (deliveryLogs.length > 50) {
    deliveryLogs.pop();
  }
}
