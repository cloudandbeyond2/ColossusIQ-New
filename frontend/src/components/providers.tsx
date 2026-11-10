"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DICTS, type Lang, type TKey } from "@/lib/i18n/dict";
import { ApiError } from "@/lib/api/client";

type Theme = "light" | "dark";

export interface Prefs {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  toggleTheme: () => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const DEFAULT_PREFS: Prefs = {
  lang: "en",
  setLang: () => {},
  theme: "light",
  toggleTheme: () => {},
  t: (key: TKey, vars?: Record<string, string | number>) => {
    let s = DICTS.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  },
};

const PrefsContext = createContext<Prefs>(DEFAULT_PREFS);

/** Preference cookies hold no personal data; they only let the server render the right theme/language. */
function setPrefCookie(name: string, value: string) {
  if (typeof document === "undefined" || typeof location === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export function Providers({
  children,
  initialLang = "en",
  initialTheme = "light",
}: {
  children: ReactNode;
  initialLang?: Lang;
  initialTheme?: Theme;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && count < 2,
          },
        },
      }),
  );
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setPrefCookie("ciq_lang", l);
    document.documentElement.lang = l;
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      setPrefCookie("ciq_theme", next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => {
      let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, theme, toggleTheme, t }), [lang, setLang, theme, toggleTheme, t]);

  return (
    <QueryClientProvider client={queryClient}>
      <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
    </QueryClientProvider>
  );
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  return ctx ?? DEFAULT_PREFS;
}
