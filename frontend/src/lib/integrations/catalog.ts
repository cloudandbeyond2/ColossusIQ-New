/*
 * Integrations catalogue (shared by the browser and the server; holds no secrets). Every external service the
 * platform can use, the providers for each, and the settings each provider needs. The Super Admin configures them in
 * Integrations & Setup; any setting can instead come from the environment variable named here (see .env.example).
 */

export type FieldKind = "text" | "secret" | "number" | "select" | "email" | "url" | "textarea";

export interface IntegrationField {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: readonly string[];
  /** Environment variable that supplies this value when nothing is saved. */
  env?: string;
  max?: number;
}

export interface IntegrationProvider {
  id: string;
  name: string;
  blurb: string;
  fields: IntegrationField[];
  /** Whether "Test connection" can check this provider from the server. */
  testable: boolean;
  docs?: string;
}

export interface IntegrationDef {
  id: string;
  name: string;
  category: "Storage" | "Messaging" | "Payments" | "Identity" | "Teaching" | "Data exchange";
  icon: string;
  description: string;
  /** Modules this integration is for (each reads it through activeIntegration() once it is connected). */
  usedBy: string[];
  /** Fields shared by every provider (e.g. the sender name for email). */
  common?: IntegrationField[];
  providers: IntegrationProvider[];
  /** Environment variable naming the provider when nothing is saved. */
  envProvider: string;
}

const accessKey = (prefix: string): IntegrationField[] => [
  { key: "accessKeyId", label: "Access key ID", kind: "text", required: true, env: `${prefix}_ACCESS_KEY_ID`, max: 128 },
  { key: "secretAccessKey", label: "Secret access key", kind: "secret", required: true, env: `${prefix}_SECRET_ACCESS_KEY`, max: 256 },
];

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "storage",
    name: "Cloud storage",
    category: "Storage",
    icon: "cloud",
    description: "Where uploaded files are kept: website images, certificate seals and signatures, Knowledge Base PDFs and handwritten answer scripts.",
    usedBy: ["College Website", "Photo Gallery", "Certificate Authority", "Knowledge Base", "Handwritten Evaluation"],
    envProvider: "STORAGE_PROVIDER",
    providers: [
      { id: "database", name: "Built-in (database)", blurb: "Files are stored in the platform database. Fine for pilots; move to cloud storage as uploads grow.", fields: [], testable: false },
      {
        id: "s3",
        name: "Amazon S3",
        blurb: "AWS S3 bucket in your account (Mumbai ap-south-1 keeps data in India).",
        testable: true,
        docs: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/creating-bucket.html",
        fields: [
          { key: "bucket", label: "Bucket", kind: "text", required: true, env: "S3_BUCKET", placeholder: "colossusiq-uploads", max: 63 },
          { key: "region", label: "Region", kind: "text", required: true, env: "S3_REGION", placeholder: "ap-south-1", max: 30 },
          ...accessKey("S3"),
          { key: "prefix", label: "Folder prefix (optional)", kind: "text", env: "S3_PREFIX", placeholder: "uploads/", max: 100 },
          { key: "publicBaseUrl", label: "Public / CDN base URL (optional)", kind: "url", env: "S3_PUBLIC_BASE_URL", placeholder: "https://cdn.your-university.edu", max: 200 },
        ],
      },
      {
        id: "s3-compatible",
        name: "S3-compatible",
        blurb: "Cloudflare R2, MinIO, Wasabi, DigitalOcean Spaces or any service that speaks the S3 API.",
        testable: true,
        fields: [
          { key: "endpoint", label: "Endpoint URL", kind: "url", required: true, env: "S3_ENDPOINT", placeholder: "https://<account>.r2.cloudflarestorage.com", max: 200 },
          { key: "bucket", label: "Bucket", kind: "text", required: true, env: "S3_BUCKET", max: 63 },
          { key: "region", label: "Region", kind: "text", required: true, env: "S3_REGION", placeholder: "auto", max: 30 },
          ...accessKey("S3"),
          { key: "prefix", label: "Folder prefix (optional)", kind: "text", env: "S3_PREFIX", max: 100 },
          { key: "publicBaseUrl", label: "Public / CDN base URL (optional)", kind: "url", env: "S3_PUBLIC_BASE_URL", max: 200 },
        ],
      },
      {
        id: "gcs",
        name: "Google Cloud Storage",
        blurb: "A GCS bucket with a service account that can read and write objects.",
        testable: false,
        fields: [
          { key: "bucket", label: "Bucket", kind: "text", required: true, env: "GCS_BUCKET", max: 63 },
          { key: "projectId", label: "Project ID", kind: "text", required: true, env: "GCS_PROJECT_ID", max: 60 },
          { key: "serviceAccountJson", label: "Service account key (JSON)", kind: "secret", required: true, env: "GCS_SERVICE_ACCOUNT_JSON", help: "Paste the whole JSON key file.", max: 6000 },
        ],
      },
      {
        id: "azure",
        name: "Azure Blob Storage",
        blurb: "An Azure storage account container (Central India region available).",
        testable: false,
        fields: [
          { key: "accountName", label: "Storage account name", kind: "text", required: true, env: "AZURE_STORAGE_ACCOUNT", max: 24 },
          { key: "container", label: "Container", kind: "text", required: true, env: "AZURE_STORAGE_CONTAINER", max: 63 },
          { key: "accountKey", label: "Account key", kind: "secret", required: true, env: "AZURE_STORAGE_KEY", max: 200 },
        ],
      },
    ],
  },
  {
    id: "email",
    name: "Email",
    category: "Messaging",
    icon: "envelope",
    description: "Sends sign-in codes, important notices, exam reminders and weekly digests from your university's address.",
    usedBy: ["Notice Board", "Notification Rules", "User Management", "Admissions"],
    envProvider: "EMAIL_PROVIDER",
    common: [
      { key: "fromName", label: "Sender name", kind: "text", required: true, env: "EMAIL_FROM_NAME", placeholder: "Tamil Nadu Technical University", max: 80 },
      { key: "fromAddress", label: "Sender address", kind: "email", required: true, env: "EMAIL_FROM", placeholder: "no-reply@your-university.edu", max: 120 },
      { key: "replyTo", label: "Reply-to address (optional)", kind: "email", env: "EMAIL_REPLY_TO", max: 120 },
    ],
    providers: [
      {
        id: "smtp",
        name: "SMTP server",
        blurb: "Any mail server: Google Workspace, Microsoft 365, Zoho Mail or your own.",
        testable: true,
        fields: [
          { key: "host", label: "SMTP host", kind: "text", required: true, env: "SMTP_HOST", placeholder: "smtp.gmail.com", max: 120 },
          { key: "port", label: "Port", kind: "number", required: true, env: "SMTP_PORT", placeholder: "587" },
          { key: "security", label: "Security", kind: "select", required: true, env: "SMTP_SECURITY", options: ["STARTTLS", "SSL/TLS", "None"] },
          { key: "username", label: "Username", kind: "text", env: "SMTP_USER", max: 120 },
          { key: "password", label: "Password / app password", kind: "secret", env: "SMTP_PASSWORD", max: 200 },
        ],
      },
      { id: "sendgrid", name: "SendGrid", blurb: "Twilio SendGrid email API.", testable: true, fields: [{ key: "apiKey", label: "API key", kind: "secret", required: true, env: "SENDGRID_API_KEY", placeholder: "SG.…", max: 200 }] },
      { id: "resend", name: "Resend", blurb: "Resend email API.", testable: true, fields: [{ key: "apiKey", label: "API key", kind: "secret", required: true, env: "RESEND_API_KEY", placeholder: "re_…", max: 200 }] },
      {
        id: "ses",
        name: "Amazon SES",
        blurb: "AWS Simple Email Service (verify your domain in SES first).",
        testable: false,
        fields: [{ key: "region", label: "Region", kind: "text", required: true, env: "SES_REGION", placeholder: "ap-south-1", max: 30 }, ...accessKey("SES")],
      },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    category: "Messaging",
    icon: "comment-alt",
    description: "Sends urgent notices, exam and fee reminders and placement updates to students' and parents' WhatsApp, using approved message templates.",
    usedBy: ["Notice Board", "Notification Rules", "Placement Drives"],
    envProvider: "WHATSAPP_PROVIDER",
    providers: [
      {
        id: "meta",
        name: "WhatsApp Cloud API (Meta)",
        blurb: "Meta's official WhatsApp Business Platform.",
        testable: true,
        docs: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
        fields: [
          { key: "phoneNumberId", label: "Phone number ID", kind: "text", required: true, env: "WHATSAPP_PHONE_NUMBER_ID", max: 40 },
          { key: "businessAccountId", label: "WhatsApp Business account ID", kind: "text", required: true, env: "WHATSAPP_BUSINESS_ACCOUNT_ID", max: 40 },
          { key: "accessToken", label: "Permanent access token", kind: "secret", required: true, env: "WHATSAPP_ACCESS_TOKEN", max: 600 },
          { key: "verifyToken", label: "Webhook verify token", kind: "secret", env: "WHATSAPP_VERIFY_TOKEN", help: "Any long random text; enter the same in the Meta app's webhook settings.", max: 120 },
          { key: "language", label: "Template language", kind: "select", required: true, env: "WHATSAPP_LANGUAGE", options: ["en", "ta", "hi"] },
        ],
      },
      {
        id: "twilio",
        name: "Twilio WhatsApp",
        blurb: "WhatsApp through a Twilio sender.",
        testable: true,
        fields: [
          { key: "accountSid", label: "Account SID", kind: "text", required: true, env: "TWILIO_ACCOUNT_SID", placeholder: "AC…", max: 40 },
          { key: "authToken", label: "Auth token", kind: "secret", required: true, env: "TWILIO_AUTH_TOKEN", max: 80 },
          { key: "fromNumber", label: "WhatsApp sender number", kind: "text", required: true, env: "TWILIO_WHATSAPP_FROM", placeholder: "+9198XXXXXXXX", max: 20 },
        ],
      },
    ],
  },
  {
    id: "sms",
    name: "SMS",
    category: "Messaging",
    icon: "sms",
    description: "Text messages for sign-in codes and urgent alerts, with India DLT registration.",
    usedBy: ["Notice Board", "Notification Rules"],
    envProvider: "SMS_PROVIDER",
    providers: [
      {
        id: "msg91",
        name: "MSG91",
        blurb: "Indian SMS gateway with DLT template support.",
        testable: false,
        fields: [
          { key: "authKey", label: "Auth key", kind: "secret", required: true, env: "MSG91_AUTH_KEY", max: 80 },
          { key: "senderId", label: "Sender ID (6 letters)", kind: "text", required: true, env: "MSG91_SENDER_ID", max: 6 },
          { key: "dltEntityId", label: "DLT principal entity ID", kind: "text", required: true, env: "MSG91_DLT_ENTITY_ID", max: 30 },
        ],
      },
      {
        id: "twilio",
        name: "Twilio SMS",
        blurb: "SMS through a Twilio number.",
        testable: true,
        fields: [
          { key: "accountSid", label: "Account SID", kind: "text", required: true, env: "TWILIO_ACCOUNT_SID", max: 40 },
          { key: "authToken", label: "Auth token", kind: "secret", required: true, env: "TWILIO_AUTH_TOKEN", max: 80 },
          { key: "fromNumber", label: "Sender number", kind: "text", required: true, env: "TWILIO_SMS_FROM", max: 20 },
        ],
      },
    ],
  },
  {
    id: "payments",
    name: "Razorpay",
    category: "Payments",
    icon: "credit-card",
    description: "Students pay their app fee online through Razorpay (UPI, cards, net banking, wallets). For payment confirmation when a student closes the browser early, add the webhook https://<your site>/api/payments/razorpay/webhook (event payment_link.paid) in the Razorpay dashboard.",
    usedBy: ["Fees & Payments", "Subscriptions & Billing"],
    envProvider: "PAYMENTS_PROVIDER",
    providers: [
      {
        id: "razorpay",
        name: "Razorpay",
        blurb: "UPI, cards, net banking and wallets.",
        testable: true,
        fields: [
          { key: "keyId", label: "Key ID", kind: "text", required: true, env: "RAZORPAY_KEY_ID", placeholder: "rzp_live_…", max: 40 },
          { key: "keySecret", label: "Key secret", kind: "secret", required: true, env: "RAZORPAY_KEY_SECRET", max: 80 },
          { key: "webhookSecret", label: "Webhook secret", kind: "secret", env: "RAZORPAY_WEBHOOK_SECRET", max: 120 },
        ],
      },
    ],
  },
  {
    id: "payments-payu",
    name: "PayU",
    category: "Payments",
    icon: "credit-card",
    description: "Students pay their app fee online through PayU's hosted checkout (INR only).",
    usedBy: ["Fees & Payments"],
    envProvider: "PAYU_PROVIDER",
    providers: [
      {
        id: "payu",
        name: "PayU India",
        blurb: "UPI, cards, net banking and EMI on PayU's hosted page.",
        testable: true,
        fields: [
          { key: "merchantKey", label: "Merchant key", kind: "text", required: true, env: "PAYU_MERCHANT_KEY", max: 40 },
          { key: "salt", label: "Merchant salt", kind: "secret", required: true, env: "PAYU_SALT", max: 120 },
          { key: "mode", label: "Mode", kind: "select", options: ["Test", "Live"], env: "PAYU_MODE" },
        ],
      },
    ],
  },
  {
    id: "payments-ccavenue",
    name: "CCAvenue",
    category: "Payments",
    icon: "credit-card",
    description: "Students pay their app fee online through CCAvenue's hosted checkout. Register this site's address with CCAvenue first.",
    usedBy: ["Fees & Payments"],
    envProvider: "CCAVENUE_PROVIDER",
    providers: [
      {
        id: "ccavenue",
        name: "CCAvenue",
        blurb: "Cards, net banking, UPI and wallets on CCAvenue's hosted page.",
        testable: true,
        fields: [
          { key: "merchantId", label: "Merchant ID", kind: "text", required: true, env: "CCAVENUE_MERCHANT_ID", max: 20 },
          { key: "accessCode", label: "Access code", kind: "text", required: true, env: "CCAVENUE_ACCESS_CODE", max: 40 },
          { key: "workingKey", label: "Working key", kind: "secret", required: true, env: "CCAVENUE_WORKING_KEY", max: 64 },
          { key: "mode", label: "Mode", kind: "select", options: ["Test", "Live"], env: "CCAVENUE_MODE" },
        ],
      },
    ],
  },
  {
    id: "payments-paypal",
    name: "PayPal",
    category: "Payments",
    icon: "credit-card",
    description: "Students pay their app fee with PayPal (useful for international students). The fee currency must be one your PayPal account accepts.",
    usedBy: ["Fees & Payments"],
    envProvider: "PAYPAL_PROVIDER",
    providers: [
      {
        id: "paypal",
        name: "PayPal",
        blurb: "PayPal balance and cards through PayPal Checkout (Orders v2).",
        testable: true,
        fields: [
          { key: "clientId", label: "Client ID", kind: "text", required: true, env: "PAYPAL_CLIENT_ID", max: 120 },
          { key: "clientSecret", label: "Client secret", kind: "secret", required: true, env: "PAYPAL_CLIENT_SECRET", max: 120 },
          { key: "mode", label: "Mode", kind: "select", options: ["Sandbox", "Live"], env: "PAYPAL_MODE" },
        ],
      },
    ],
  },
  {
    id: "sso",
    name: "Single sign-on",
    category: "Identity",
    icon: "key",
    description: "Lets staff and students sign in with their university Google or Microsoft account (MFA still applies).",
    usedBy: ["Sign-in"],
    envProvider: "SSO_PROVIDER",
    providers: [
      {
        id: "google",
        name: "Google Workspace",
        blurb: "OpenID Connect with your Google Workspace domain.",
        testable: true,
        fields: [
          { key: "clientId", label: "OAuth client ID", kind: "text", required: true, env: "GOOGLE_CLIENT_ID", max: 200 },
          { key: "clientSecret", label: "OAuth client secret", kind: "secret", required: true, env: "GOOGLE_CLIENT_SECRET", max: 120 },
          { key: "allowedDomain", label: "Allowed email domain", kind: "text", required: true, env: "GOOGLE_ALLOWED_DOMAIN", placeholder: "your-university.edu", max: 120 },
        ],
      },
      {
        id: "microsoft",
        name: "Microsoft Entra ID",
        blurb: "OpenID Connect with Microsoft 365 / Entra ID.",
        testable: true,
        fields: [
          { key: "tenantId", label: "Directory (tenant) ID", kind: "text", required: true, env: "MICROSOFT_TENANT_ID", max: 60 },
          { key: "clientId", label: "Application (client) ID", kind: "text", required: true, env: "MICROSOFT_CLIENT_ID", max: 60 },
          { key: "clientSecret", label: "Client secret", kind: "secret", required: true, env: "MICROSOFT_CLIENT_SECRET", max: 120 },
        ],
      },
    ],
  },
  {
    id: "meetings",
    name: "Online classes",
    category: "Teaching",
    icon: "video-camera",
    description: "Creates meeting links for online classes, viva sessions, placement interviews and webinars.",
    usedBy: ["My Classes", "Campus Events", "Placement Drives"],
    envProvider: "MEETINGS_PROVIDER",
    providers: [
      {
        id: "zoom",
        name: "Zoom",
        blurb: "A Zoom Server-to-Server OAuth app.",
        testable: true,
        fields: [
          { key: "accountId", label: "Account ID", kind: "text", required: true, env: "ZOOM_ACCOUNT_ID", max: 60 },
          { key: "clientId", label: "Client ID", kind: "text", required: true, env: "ZOOM_CLIENT_ID", max: 60 },
          { key: "clientSecret", label: "Client secret", kind: "secret", required: true, env: "ZOOM_CLIENT_SECRET", max: 120 },
        ],
      },
      {
        id: "jitsi",
        name: "Jitsi Meet",
        blurb: "Free, open-source meetings (meet.jit.si or your own server).",
        testable: true,
        fields: [{ key: "baseUrl", label: "Jitsi server URL", kind: "url", required: true, env: "JITSI_BASE_URL", placeholder: "https://meet.jit.si", max: 200 }],
      },
    ],
  },
  {
    id: "webhook",
    name: "ERP / SIS webhook",
    category: "Data exchange",
    icon: "plug-connection",
    description: "Sends signed events (admissions, results, certificates, attendance) to your university ERP, SIS or LMS so they stay in sync.",
    usedBy: ["Admissions", "Certificate Authority", "My Classes"],
    envProvider: "WEBHOOK_PROVIDER",
    providers: [
      {
        id: "https",
        name: "HTTPS webhook",
        blurb: "POSTs JSON events signed with HMAC-SHA256 (header X-ColossusIQ-Signature).",
        testable: true,
        fields: [
          { key: "url", label: "Endpoint URL", kind: "url", required: true, env: "WEBHOOK_URL", placeholder: "https://erp.your-university.edu/hooks/colossusiq", max: 300 },
          { key: "signingSecret", label: "Signing secret", kind: "secret", required: true, env: "WEBHOOK_SECRET", help: "At least 24 characters; your ERP uses it to check each event's signature.", max: 200 },
        ],
      },
    ],
  },
];

export const INTEGRATION_IDS = INTEGRATIONS.map((i) => i.id);
export const findIntegration = (id: string) => INTEGRATIONS.find((i) => i.id === id);
export const fieldsOf = (def: IntegrationDef, providerId: string): IntegrationField[] => [...(def.common ?? []), ...(def.providers.find((p) => p.id === providerId)?.fields ?? [])];
