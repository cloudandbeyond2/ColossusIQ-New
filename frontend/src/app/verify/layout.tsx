import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="CollossusIQ home">
            <Logo />
          </Link>
          <Link href="/verify" className="text-sm font-medium text-brand hover:underline">
            Verify another certificate
          </Link>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-ink-3 print:hidden">
        Certificates are signed by the university and can be checked here at any time.
      </footer>
    </div>
  );
}
