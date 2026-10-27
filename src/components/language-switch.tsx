"use client";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/components/ui";

export function LanguageSwitch({
  onChange,
  className,
  disabled = false,
}: {
  onChange?: (language: "en" | "ur") => void;
  className?: string;
  disabled?: boolean;
}) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("settings.language")}
      className={cn(
        "inline-flex rounded-full border border-line bg-surface p-1",
        disabled && "opacity-60",
        className,
      )}
    >
      {(
        [
          { code: "en", label: "English" },
          { code: "ur", label: "اردو" },
        ] as const
      ).map((option) => (
        <button
          key={option.code}
          type="button"
          disabled={disabled}
          aria-pressed={language === option.code}
          onClick={() => {
            setLanguage(option.code);
            onChange?.(option.code);
          }}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed",
            language === option.code ? "bg-brand text-brand-fg" : "text-muted hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
