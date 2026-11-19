import Link from "next/link";
import { BookOpenCheck, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-[#141d42] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:32px_32px]" aria-hidden />
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-[#c9962b]/20 blur-3xl" aria-hidden />
        <Link href="/" className="relative inline-flex items-center gap-2.5">
          <span className="rounded-lg bg-white/95 p-1">
            <Logo compact />
          </span>
          <span className="font-serif text-xl font-semibold">
            Colossus<span className="text-[#e0b453]">IQ</span>.ai
          </span>
        </Link>
        <div className="relative mt-auto max-w-lg">
          <p className="font-serif text-4xl font-semibold leading-tight">From classroom to career — with an AI mentor for every student.</p>
          <ul className="mt-8 space-y-4 text-sm text-white/80">
            <li className="flex gap-3">
              <Sparkles className="size-5 shrink-0 text-[#e0b453]" /> Personal AI mentor, tutor, planner and interview coach
            </li>
            <li className="flex gap-3">
              <BookOpenCheck className="size-5 shrink-0 text-[#e0b453]" /> Answers grounded in your institution&apos;s approved documents
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="size-5 shrink-0 text-[#e0b453]" /> Tenant-isolated, MFA-protected and audit-logged
            </li>
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-white/50">© {new Date().getFullYear()} ColossusIQ.ai · Built for Indian higher education</p>
      </aside>
      <main id="main" className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
