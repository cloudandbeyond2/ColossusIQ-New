"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { SearchResult } from "@/lib/api/schemas";
import type { Role } from "@/lib/auth/roles";
import { cleanText } from "@/lib/security/sanitize";
import { safeNextPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils";

import { createPortal } from "react-dom";

export function CommandPalette({ role, onClose }: { role: Role; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    if (mounted) inputRef.current?.focus();
  }, [mounted]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(cleanText(q, 80)), 200);
    return () => clearTimeout(id);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => apiFetch(`/api/v1/search?q=${encodeURIComponent(debounced)}`, z.array(SearchResult)),
    enabled: debounced.length >= 2,
  });
  const results = useMemo(() => (debounced.length >= 2 ? (data ?? []) : []), [data, debounced]);

  const go = (href: string) => {
    // Results come from the API; only navigate to same-origin paths inside this portal.
    const safe = safeNextPath(href, `/${role}`);
    onClose();
    router.push(safe);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <button
        className="absolute inset-0 cursor-default bg-transparent"
        aria-label="Close search"
        onClick={onClose}
        tabIndex={-1}
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 text-brand shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            maxLength={80}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
              if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
              if (e.key === "Enter" && results[active]) go(results[active].href);
            }}
            placeholder="Search modules, courses, tools…"
            className="h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
            aria-label="Search query"
            aria-controls="search-results"
          />
          <kbd className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3 shadow-xs">
            Esc
          </kbd>
        </div>
        <ul id="search-results" role="listbox" className="max-h-80 overflow-y-auto p-2 divide-y divide-line/20">
          {debounced.length < 2 ? (
            <li className="px-3 py-8 text-center text-sm text-ink-3">
              Type at least 2 characters — try <span className="font-semibold text-ink-2">“resume”</span>,{" "}
              <span className="font-semibold text-ink-2">“interview”</span> or{" "}
              <span className="font-semibold text-ink-2">“DBMS”</span>.
            </li>
          ) : isFetching && results.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-ink-3">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-ink-3">No results found.</li>
          ) : (
            results.map((r, i) => (
              <li key={`${r.href}-${i}`} role="option" aria-selected={i === active} className="pt-1 first:pt-0">
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.href)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm transition-colors",
                    i === active ? "bg-brand-soft text-brand font-medium" : "text-ink hover:bg-surface-2",
                  )}
                >
                  <span className="font-medium">{r.title}</span>
                  <span className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-3 bg-surface-2">
                    {r.kind}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center justify-between border-t border-line/60 bg-surface-2/50 px-4 py-2.5 text-xs text-ink-3">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium">↑</kbd>{" "}
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium">↵</kbd> to select
            </span>
          </div>
          <span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
