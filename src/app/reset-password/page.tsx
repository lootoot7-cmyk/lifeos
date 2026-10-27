"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { errorKey } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { AuthFrame, FormError, FormNotice } from "@/components/auth-frame";
import { ConfigMissing } from "@/components/shell";
import { Button, Field, Input } from "@/components/ui";

export default function ResetPasswordPage() {
  const { configured, resetPassword } = useAuth();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!configured) return <ConfigMissing />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (cause) {
      setError(t(errorKey(cause)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      footer={
        <Link href="/login/" className="font-medium text-brand underline-offset-4 hover:underline">
          {t("auth.signIn")}
        </Link>
      }
    >
      <h1 className="text-xl font-semibold tracking-tight">{t("auth.resetTitle")}</h1>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <FormError message={error} />
        {sent && <FormNotice message={t("auth.resetSent")} />}
        <Field label={t("auth.email")} htmlFor="reset-email" required>
          <Input
            id="reset-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Button type="submit" block size="lg" loading={busy}>
          {t("auth.resetSend")}
        </Button>
      </form>
    </AuthFrame>
  );
}
