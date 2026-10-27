"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/components/ui";

export function PageHeader({
  title,
  subtitle,
  action,
  back,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: { href: string; label?: string };
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("mb-5", className)}>
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg"
        >
          <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
          {back.label ?? t("common.back")}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
