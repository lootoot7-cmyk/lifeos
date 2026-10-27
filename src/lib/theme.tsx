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
import type { ThemePreference } from "@/lib/types";
import { A11Y_STORAGE_KEY, THEME_STORAGE_KEY } from "./theme-script";

interface AccessibilityPrefs {
  largeText: boolean;
  highContrast: boolean;
}

interface ThemeValue extends AccessibilityPrefs {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  setLargeText: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function readTheme(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function readA11y(): AccessibilityPrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(A11Y_STORAGE_KEY) ?? "{}");
    return { largeText: raw?.largeText === true, highContrast: raw?.highContrast === true };
  } catch {
    return { largeText: false, highContrast: false };
  }
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({
  children,
  profileTheme,
}: {
  children: ReactNode;
  /** Theme stored on the user's profile; applied when it becomes known. */
  profileTheme?: ThemePreference;
}) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [a11y, setA11y] = useState<AccessibilityPrefs>({ largeText: false, highContrast: false });
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    if (profileTheme) {
      setThemeState(profileTheme);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, profileTheme);
      } catch {
        // storage unavailable; the in-memory value still applies
      }
      return;
    }
    setThemeState(readTheme());
  }, [profileTheme]);

  useEffect(() => {
    setA11y(readA11y());
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const dark = theme === "dark" || (theme === "system" && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
    root.dataset.textSize = a11y.largeText ? "large" : "normal";
    root.dataset.contrast = a11y.highContrast ? "high" : "normal";
  }, [dark, a11y]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const persistA11y = useCallback((next: AccessibilityPrefs) => {
    setA11y(next);
    try {
      window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      ...a11y,
      setTheme,
      setLargeText: (largeText) => persistA11y({ ...a11y, largeText }),
      setHighContrast: (highContrast) => persistA11y({ ...a11y, highContrast }),
    }),
    [theme, a11y, setTheme, persistA11y],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
