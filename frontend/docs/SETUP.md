# ColossusIQ setup guide

From a fresh checkout to a university running on ColossusIQ: install, configure, create the database, then the
University Super Admin's first-run checklist inside the app.

## 1. Requirements

| | Version |
|---|---|
| Node.js | 20 or newer |
| PostgreSQL | 15 or newer (for production; a demo can run without it) |
| Disk / memory | 2 GB RAM for the app server is enough for a pilot |

## 2. Install and configure

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`. The minimum:

| Variable | What to put |
|---|---|
| `SESSION_SECRET` | 32+ random characters (`openssl rand -base64 48`) |
| `MFA_ENCRYPTION_KEY` | 32+ random characters. Encrypts sign-in secrets, AI keys and integration secrets. Keep it safe: losing it means re-entering those secrets. |
| `PUBLIC_APP_URL` | The site's public address, e.g. `https://campus.your-university.edu` |

Every other variable is optional and documented in [`.env.example`](../.env.example). Integrations and AI providers can
be set up later in the app by the Super Admin instead of in the environment.

## 3. Database

For a quick demo, leave `DATA_BACKEND=memory` (sample data, reset on restart). For a real deployment:

```bash
# .env.local: DATA_BACKEND=postgres and DATABASE_URL=postgresql://user:password@host:5432/colossusiq
npm run db:migrate      # creates every table, row-level security and the ciq_app role grants
npm run db:seed         # university, colleges and reference data
npm run db:dev-accounts # development only: one account per role (password from DEV_PASSWORD)
```

The migrations live in `prisma/migrations` (the same SQL is in `db/migrations` for review). Recent ones:

| Migration | Adds |
|---|---|
| 0013–0014 | Competitive Exam Prep Hub, current affairs, Exam Prep Studio |
| 0015 | AI Providers (Gemini, Claude, ChatGPT) |
| 0016 | Certificate Authority |
| 0017 | Module Control |
| 0018 | University Content Desk, Curriculum Studio, Notice Board |
| 0019 | Integrations & Setup |

## 4. Run

```bash
npm run dev                      # development, http://localhost:3000
npm run build && npm start       # production
```

Demo sign-in: any email, a password of 8+ characters, pick a portal, MFA code **246810** (demo only).

## 5. Super Admin first-run checklist

Sign in as the University Super Admin, stay on **All colleges**, confirm your sign-in code, then:

1. **Colleges**: add each college, its stream and principal; switch off module areas a college does not use.
2. **AI Providers**: add a Gemini key (default), and optionally Claude and ChatGPT as fallbacks; press *Test*.
3. **Integrations & Setup**: connect the services below; press *Test connection* on each.
4. **Module Control**: switch off any module a role should not see (applies to every college).
5. **Users** and **Roles & Permissions**: invite principals and staff.
6. **Curriculum Studio**: create each programme's curriculum (AI can draft the course list and syllabi), review the
   checks panel, then *Publish*. Faculty plan their teaching from it in **Course Roadmap**.
7. **University Content Desk**: publish the first current affairs, question sets and university events. AI drafts wait
   for your review; nothing reaches students until you verify and publish.
8. **Notice Board**: post a welcome notice to every college.
9. **Security Settings** and **Notification Rules**: review the defaults.

## 6. Integrations

All of these are optional. Each shows its status (Connected, Saved, Incomplete, Off, Not set up) on the Super
Admin home and in **Platform → Integrations & Setup**. Secrets are write-only: after saving, only the last four
characters are shown.

> **Current state.** The settings are stored (secrets encrypted), validated and connection-tested today, and server
> code reads them through `activeIntegration()` in `src/lib/integrations/config.ts`. Sending through them (email and
> WhatsApp delivery of notices, file uploads to cloud storage, SSO sign-in, payment checkout, meeting links, ERP
> events) is connected module by module; until a module is connected it keeps its current behaviour (in-app
> notifications, files in the database).

| Integration | Providers | For | Where to get the settings |
|---|---|---|---|
| Cloud storage | Built-in database, Amazon S3, S3-compatible (Cloudflare R2, MinIO, Wasabi, DigitalOcean Spaces), Google Cloud Storage, Azure Blob | Website images, gallery, certificate seals and signatures, Knowledge Base PDFs, handwritten scripts | Create a private bucket and an access key limited to that bucket. Prefer an India region (e.g. `ap-south-1`). |
| Email | SMTP (Google Workspace, Microsoft 365, Zoho…), SendGrid, Resend, Amazon SES | Notices, sign-in, admissions, digests | For Google Workspace use `smtp.gmail.com:587`, STARTTLS and an app password. Set SPF, DKIM and DMARC for your domain. |
| WhatsApp | WhatsApp Cloud API (Meta), Twilio | Urgent notices, exam and fee reminders, placement updates | Meta Business Manager → WhatsApp → API setup: phone number ID, business account ID and a permanent system-user token. Business-initiated messages need approved templates. |
| SMS | MSG91, Twilio | Sign-in codes, urgent alerts | Register your entity and templates on a DLT portal (TRAI) first, then use the DLT IDs in MSG91. |
| Online payments | Razorpay | Admission and examination fees | Razorpay Dashboard → Settings → API keys and Webhooks. |
| Single sign-on | Google Workspace, Microsoft Entra ID | Sign-in | Create an OAuth / OpenID Connect web app for your domain (Google Cloud Console or Entra admin center). MFA still applies. |
| Online classes | Zoom (Server-to-Server OAuth), Jitsi Meet | My Classes, events, placement interviews | Zoom Marketplace → Build App → Server-to-Server OAuth (scopes: meeting:write). |
| ERP / SIS webhook | HTTPS webhook | Admissions, certificates, attendance | Your ERP's endpoint URL; every event is signed: `X-ColossusIQ-Signature: sha256=<HMAC-SHA256(body, secret)>`. |

*Test connection* makes one small read-only request to the provider (no email, message or payment is created; the
ERP webhook receives a signed `ping` event). Addresses on the server itself or a private network are refused.

## 7. Production checklist

- `NODE_ENV=production`, HTTPS in front of the app, `PUBLIC_APP_URL` set to the HTTPS address.
- Strong, unique `SESSION_SECRET` and `MFA_ENCRYPTION_KEY`, stored in your secret manager, backed up.
- PostgreSQL with automated daily backups and point-in-time recovery; the app connects as a role that is subject to
  row-level security (see `db/migrations/0001_init.sql`).
- `DEV_PASSWORD` unset.
- Email: SPF, DKIM and DMARC records published for the sender domain.
- Run `npm run audit`, `npm run typecheck`, `npm run lint` and `npm test` before each release.
