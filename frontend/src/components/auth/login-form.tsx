"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { PublicColleges } from "@/lib/api/schemas";
import { STREAM_DEFS, STREAMS, streamOfType } from "@/config/streams";
import { ROLE_META, ROLES, type Role } from "@/lib/auth/roles";
import { safeNextPath } from "@/lib/security/redirect";
import { Notice } from "@/components/ui/notices";
import { Button, Field, inputClass, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const LoginInput = z.object({
  email: z.string().trim().email("Enter a valid institutional email").max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const REASONS: Record<string, string> = {
  idle: "You were signed out after a period of inactivity.",
  "signed-out": "You have been signed out.",
  suspended: "Access for your college has been suspended by the university. Contact the university office.",
};

/** Roles that belong to a college (the Super Admin and recruiters sign in on the university page). */
const COLLEGE_ROLES = ROLES.filter((r) => r !== "admin" && r !== "recruiter");

const DOMAINS: Record<string, string> = {
  "COL-1001": "ait.edu.in",
  "COL-1002": "kaveri.ac.in",
  "COL-1003": "kongu.edu.in",
  "COL-1004": "csm.edu.in",
  "COL-1005": "vaigaipoly.ac.in",
  "COL-1006": "mmch.ac.in",
  "COL-1007": "cinahs.ac.in",
  "COL-1008": "bdu.ac.in",
  "COL-1015": "aist.edu.in",
};

function devCredentialsFor(r: Role, cId: string) {
  if (r === "admin") return { email: "admin@tntu.edu.in", password: "Dev-6WQsYmZ2" };
  const domain = DOMAINS[cId] ?? "ait.edu.in";
  const userPrefix = r === "student" ? "student1" : r === "institution" ? "principal" : r === "faculty" ? "faculty" : r === "hod" ? "hod" : r === "placement" ? "placement" : "office";
  return { email: `${userPrefix}@${domain}`, password: "Dev-6WQsYmZ2" };
}

export function LoginForm({ fixedCollege }: { fixedCollege?: { id: string; name: string } } = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<Role>("student");
  // Prefilled only on the demo backend; a real database needs the person's own account.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [colleges, setColleges] = useState<PublicColleges | null>(null);
  const [demo, setDemo] = useState(false);
  const [college, setCollege] = useState(fixedCollege?.id ?? "");
  const isSuperAdmin = role === "admin";

  useEffect(() => {
    let alive = true;
    apiFetch("/api/v1/public/colleges", PublicColleges)
      .then((d) => {
        if (!alive) return;
        setDemo(Boolean(d.demo));
        const initialCol = fixedCollege?.id || d.colleges[0]?.id || "COL-1001";
        if (d.demo) {
          setEmail((v) => v || "demo@ait.edu.in");
          setPassword((v) => v || "demo-password");
        } else if (process.env.NODE_ENV !== "production") {
          const creds = devCredentialsFor(role, initialCol);
          setEmail((v) => v || creds.email);
          setPassword((v) => v || creds.password);
        }
        if (fixedCollege) return;
        setColleges(d);
        setCollege((c) => c || initialCol);
      })
      .catch(() => alive && setFormError("Could not load the list of colleges. Refresh to try again."));
    return () => {
      alive = false;
    };
  }, [fixedCollege]);

  const reason = REASONS[params.get("reason") ?? ""];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = LoginInput.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    if (!isSuperAdmin && !college) {
      setErrors({ college: "Choose your college" });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const r = await apiFetch("/api/v1/auth/login", z.object({ mfaRequired: z.boolean(), mfaHint: z.enum(["demo", "authenticator"]).optional() }), { method: "POST", body: { ...parsed.data, role, ...(isSuperAdmin ? {} : { college }) } });
      sessionStorage.setItem("ciq_mfa_hint", r.mfaHint ?? "demo");
      // Carry a validated same-origin `next` path through MFA.
      const next = safeNextPath(params.get("next"), "");
      if (next) sessionStorage.setItem("ciq_next", next);
      router.replace("/login/mfa");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  };

  const selectRole = (r: Role) => {
    setRole(r);
    if (!demo && process.env.NODE_ENV !== "production") {
      const creds = devCredentialsFor(r, college || "COL-1001");
      setEmail(creds.email);
      setPassword(creds.password);
    }
  };

  const selectCollege = (cId: string) => {
    setCollege(cId);
    if (!demo && process.env.NODE_ENV !== "production") {
      const creds = devCredentialsFor(role, cId);
      setEmail(creds.email);
      setPassword(creds.password);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold text-ink">{fixedCollege ? "Student & staff login" : "Sign in"}</h1>
      <p className="mt-2 text-sm text-ink-2">
        {fixedCollege ? "Choose who you are and sign in with your college account." : "Use your institution account. Single sign-on is available for enterprise campuses."}
      </p>

      {reason ? (
        <Notice tone="sky" className="mt-6">
          {reason}
        </Notice>
      ) : null}

      <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
        <fieldset>
          <legend className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
            Portal {demo ? <span className="rounded bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber">Demo</span> : null}
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(fixedCollege ? COLLEGE_ROLES : ROLES).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => selectRole(r)}
                aria-pressed={role === r}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                  role === r ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-ink-2 hover:border-brand/50",
                )}
              >
                {ROLE_META[r].label.replace("College Principal", "Principal").replace("Head of Department", "HOD").replace("University Super Admin", "Super Admin")}
              </button>
            ))}
          </div>
          {demo ? <p className="mt-2 text-xs text-ink-3">{ROLE_META[role].persona}</p> : null}
        </fieldset>

        {fixedCollege ? (
          <p className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold-soft px-3.5 py-3 text-sm text-ink">
            <span className="text-amber">●</span>
            <span>
              Signing in to <strong>{fixedCollege.name}</strong>
            </span>
          </p>
        ) : isSuperAdmin ? (
          <p className="flex items-start gap-2 rounded-xl border border-violet/30 bg-violet-soft px-3.5 py-3 text-sm text-ink">
            <span className="mt-0.5 text-violet">★</span>
            <span>
              Signing in at <strong>university level</strong> ({colleges?.university ?? "the university"}). You can manage every college and switch into any one after sign-in.
            </span>
          </p>
        ) : (
          <Field label="College" htmlFor="college" error={errors.college} hint={colleges ? `${colleges.colleges.length} colleges of ${colleges.university}` : "Loading colleges…"}>
            <select id="college" className={inputClass} value={college} onChange={(e) => selectCollege(e.target.value)} disabled={!colleges} aria-invalid={Boolean(errors.college)}>
              {STREAMS.map((s) => {
                const list = colleges?.colleges.filter((c) => streamOfType(c.type) === s) ?? [];
                return list.length ? (
                  <optgroup key={s} label={STREAM_DEFS[s].label}>
                    {list.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.city}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
          </Field>
        )}

        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="username" inputMode="email" maxLength={120} className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              maxLength={128}
              className={cn(inputClass, "pr-10")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        {formError ? (
          <p className="rounded-lg bg-rose-soft px-3 py-2 text-sm text-rose" role="alert">
            {formError}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : <LogIn className="size-4" />} Continue
        </Button>
        <Button type="button" variant="secondary" size="lg" className="w-full" disabled>
          Sign in with institution SSO
        </Button>
      </form>

      {demo ? (
        <p className="mt-6 text-xs text-ink-3">
          Demo environment: any email and a password of 8+ characters work. The MFA code is shown on the next screen. Never reuse a real password here.
        </p>
      ) : null}
    </div>
  );
}
