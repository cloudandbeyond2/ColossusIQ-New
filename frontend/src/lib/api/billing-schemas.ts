import { z } from "zod";

/*
 * Student app-usage fees (shared by the browser and the server). Each student pays one fee per academic year; the
 * University Super Admin sets the fee per plan (or per college), the due date and whether unpaid accounts lock.
 */

export const PLANS = ["Campus Starter", "Campus Pro", "University Enterprise"] as const;
export const GATEWAYS = ["razorpay", "payu", "ccavenue", "paypal"] as const;
export type Gateway = (typeof GATEWAYS)[number];
export const GATEWAY_NAMES: Record<Gateway | "offline", string> = { razorpay: "Razorpay", payu: "PayU", ccavenue: "CCAvenue", paypal: "PayPal", offline: "Offline" };
/** Integration id (Integrations & Setup) that holds each gateway's keys. */
export const GATEWAY_INTEGRATION: Record<Gateway, string> = { razorpay: "payments", payu: "payments-payu", ccavenue: "payments-ccavenue", paypal: "payments-paypal" };
export const OFFLINE_MODES = ["Cash", "Demand draft", "Cheque", "NEFT / RTGS", "UPI (direct)"] as const;
export const CURRENCIES = ["INR", "USD"] as const;

export const DueStatus = z.enum(["Due", "Paid", "Waived"]);
export type DueStatus = z.infer<typeof DueStatus>;
export const PaymentStatus = z.enum(["Created", "Pending verification", "Paid", "Failed", "Rejected"]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;
export const PaymentGateway = z.enum([...GATEWAYS, "offline"]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const YEAR_RE = /^\d{4}-\d{2}$/;

export const BillingSettings = z.object({
  academicYear: z.string().regex(YEAR_RE),
  yearStart: isoDate,
  dueDate: isoDate,
  graceDays: z.number().int().min(0).max(120),
  /** Days before the due date from which students see the due reminder (banner + popup). */
  reminderDays: z.number().int().min(0).max(90),
  currency: z.enum(CURRENCIES),
  autoLock: z.boolean(),
  lockStaff: z.boolean(),
  fees: z.object({ "Campus Starter": z.number().min(0).max(1_000_000), "Campus Pro": z.number().min(0).max(1_000_000), "University Enterprise": z.number().min(0).max(1_000_000) }),
  updatedBy: z.string(),
  updatedAt: z.string().nullable(),
});
export type BillingSettings = z.infer<typeof BillingSettings>;

export const BillingSettingsUpdate = BillingSettings.omit({ updatedBy: true, updatedAt: true })
  .strict()
  .refine((s) => s.dueDate >= s.yearStart, { message: "The due date must be on or after the start of the year.", path: ["dueDate"] })
  .refine((s) => Number(s.academicYear.slice(5)) === (Number(s.academicYear.slice(0, 4)) + 1) % 100, { message: "Write the year as 2026-27.", path: ["academicYear"] });

export const AccessState = z.object({
  locked: z.boolean(),
  reason: z.enum(["student_due", "college_uncleared"]).nullable(),
  academicYear: z.string(),
  dueDate: z.string(),
  lockDate: z.string(),
});
export type AccessState = z.infer<typeof AccessState>;

export const FeePayment = z.object({
  id: z.string(),
  receiptNo: z.string(),
  userSub: z.string(),
  studentName: z.string(),
  college: z.string(),
  collegeName: z.string().optional(),
  academicYear: z.string(),
  amount: z.number(),
  currency: z.string(),
  gateway: PaymentGateway,
  gatewayOrderId: z.string(),
  gatewayPaymentId: z.string(),
  status: PaymentStatus,
  offlineMode: z.string(),
  offlineRef: z.string(),
  proofMediaId: z.string(),
  reviewedBy: z.string(),
  reviewNote: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FeePayment = z.infer<typeof FeePayment>;

export const MyFees = z.object({
  academicYear: z.string(),
  amount: z.number(),
  currency: z.string(),
  dueDate: z.string(),
  lockDate: z.string(),
  status: DueStatus,
  access: AccessState,
  gateways: z.array(z.object({ id: z.enum(GATEWAYS), name: z.string(), needsContact: z.boolean() })),
  offlineModes: z.array(z.string()),
  pendingOffline: z.boolean(),
  payments: z.array(FeePayment),
});
export type MyFees = z.infer<typeof MyFees>;

export const CheckoutBody = z
  .object({
    gateway: z.enum(GATEWAYS),
    email: z.string().trim().toLowerCase().email().max(120).optional(),
    phone: z.string().trim().regex(/^\+?\d{10,13}$/).optional(),
  })
  .strict();
export const Checkout = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("redirect"), url: z.string().url() }),
  z.object({ kind: z.literal("form"), action: z.string().url(), fields: z.record(z.string(), z.string()) }),
]);
export type Checkout = z.infer<typeof Checkout>;

export const OfflineBody = z
  .object({
    mode: z.enum(OFFLINE_MODES),
    reference: z.string().trim().min(3).max(60),
    paidOn: isoDate,
    proof: z.object({ contentType: z.string().max(40), data: z.string().max(3 * 1024 * 1024) }).strict(),
  })
  .strict();

export const CollegeBillingRow = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  plan: z.string(),
  status: z.string(),
  capacity: z.number(),
  students: z.number(),
  fee: z.number(),
  feeOverride: z.number().nullable(),
  paid: z.number(),
  waived: z.number(),
  pending: z.number(),
  due: z.number(),
  collected: z.number(),
  cleared: z.boolean(),
  clearedBy: z.string(),
  clearedAt: z.string().nullable(),
});
export type CollegeBillingRow = z.infer<typeof CollegeBillingRow>;

export const BillingOverview = z.object({
  settings: BillingSettings,
  configured: z.boolean(),
  lockActive: z.boolean(),
  lockDate: z.string(),
  canEdit: z.boolean(),
  colleges: z.array(CollegeBillingRow),
  totals: z.object({ students: z.number(), paid: z.number(), waived: z.number(), pending: z.number(), due: z.number(), collected: z.number(), expected: z.number() }),
  gateways: z.array(z.object({ id: z.enum(GATEWAYS), name: z.string(), integration: z.string(), enabled: z.boolean() })),
});
export type BillingOverview = z.infer<typeof BillingOverview>;

export const StudentDue = z.object({
  userSub: z.string(),
  name: z.string(),
  college: z.string(),
  collegeName: z.string().optional(),
  academicYear: z.string(),
  amount: z.number(),
  status: DueStatus,
  method: z.string(),
  clearedBy: z.string(),
  clearedAt: z.string().nullable(),
});
export type StudentDue = z.infer<typeof StudentDue>;

/* ── Reminders: the due alert for students, and intimations sent by the college office ── */

export const FeeNotice = z.object({ id: z.string(), message: z.string(), sentBy: z.string(), createdAt: z.string() });
export type FeeNotice = z.infer<typeof FeeNotice>;

export const ReminderState = z.object({
  show: z.boolean(),
  academicYear: z.string(),
  amount: z.number(),
  currency: z.string(),
  dueDate: z.string(),
  lockDate: z.string(),
  /** Days until the due date (negative once it has passed). */
  daysLeft: z.number(),
  locked: z.boolean(),
  autoLock: z.boolean(),
  notices: z.array(FeeNotice),
});
export type ReminderState = z.infer<typeof ReminderState>;

export const CollegeStudentFee = z.object({
  userSub: z.string(),
  name: z.string(),
  email: z.string(),
  status: z.enum(["Due", "Paid", "Waived"]),
  amount: z.number(),
  pendingOffline: z.boolean(),
  signedIn: z.boolean(),
  clearedAt: z.string().nullable(),
  lastReminder: z.string().nullable(),
});
export type CollegeStudentFee = z.infer<typeof CollegeStudentFee>;

export const CollegeFees = z.object({
  configured: z.boolean(),
  academicYear: z.string(),
  fee: z.number(),
  currency: z.string(),
  dueDate: z.string(),
  lockDate: z.string(),
  reminderFrom: z.string(),
  lockActive: z.boolean(),
  canRemind: z.boolean(),
  students: z.array(CollegeStudentFee),
  sent: z.array(FeeNotice.extend({ to: z.string() })),
});
export type CollegeFees = z.infer<typeof CollegeFees>;

export const RemindBody = z
  .object({
    /** Specific students; leave out to remind every student whose fee is still due. */
    students: z.array(z.string().min(1).max(120)).max(2000).optional(),
    message: z.string().trim().min(5).max(500),
  })
  .strict();

export const PaymentList = z.object({ payments: z.array(FeePayment) });
export const DueList = z.object({ dues: z.array(StudentDue) });
export const ReviewBody = z.object({ approve: z.boolean(), note: z.string().trim().max(300).default("") }).strict();
export const WaiveBody = z.object({ status: z.enum(["Waived", "Paid", "Due"]), note: z.string().trim().max(300).default("") }).strict();
export const ClearBody = z.object({ cleared: z.boolean(), feeOverride: z.number().min(0).max(1_000_000).nullable().optional() }).strict();
