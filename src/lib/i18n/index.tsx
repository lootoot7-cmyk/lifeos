"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Language } from "@/lib/types";
import { en, type MessageKey } from "./en";
import { ur } from "./ur";

export type { MessageKey };

const dictionaries: Record<Language, Record<MessageKey, string>> = { en, ur };

export const LANGUAGES: Array<{ code: Language; label: string; locale: string }> = [
  { code: "en", label: "English", locale: "en-GB" },
  { code: "ur", label: "اردو", locale: "ur-PK" },
];

export function localeFor(language: Language): string {
  return language === "ur" ? "ur-PK" : "en-GB";
}

export function dirFor(language: Language): "rtl" | "ltr" {
  return language === "ur" ? "rtl" : "ltr";
}

const STORAGE_KEY = "lifeos.language";

export function storedLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "ur" ? "ur" : "en";
  } catch {
    return "en";
  }
}

export function rememberLanguage(language: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Private mode without storage: the profile value still applies for this session.
  }
}

type Vars = Record<string, string | number>;

interface I18nValue {
  language: Language;
  locale: string;
  dir: "rtl" | "ltr";
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

export function I18nProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  /** Language from the signed-in profile; takes effect once known. */
  initialLanguage?: Language;
}) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    setLanguageState(initialLanguage ?? storedLanguage());
  }, [initialLanguage]);

  useEffect(() => {
    const dir = dirFor(language);
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    rememberLanguage(next);
    setLanguageState(next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dictionary = dictionaries[language];
    return {
      language,
      locale: localeFor(language),
      dir: dirFor(language),
      setLanguage,
      t: (key, vars) => interpolate(dictionary[key] ?? en[key] ?? key, vars),
    };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
