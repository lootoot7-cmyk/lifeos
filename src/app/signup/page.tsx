"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { errorKey } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { AuthFrame, FormError } from "@/components/auth-frame";
import { ConfigMissing, Splash } from "@/components/shell";
import { Button, Field, Input } from "@/components/ui";

export default function SignupPage() {
  const { configured, loading, user, signUpEmail } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configured && !loading && user) router.replace("/");
  }, [configured, loading, user, router]);

  if (!configured) return <ConfigMissing />;
  if (loading || user) return <Splash />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signUpEmail(name, email, password);
      router.replace("/");
    } catch (cause) {
      setError(t(errorKey(cause)));
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link href="/login/" className="font-medium text-brand underline-offset-4 hover:underline">
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      <h1 className="text-xl font-semibold tracking-tight">{t("auth.createTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("welcome.body")}</p>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <FormError message={error} />
        <Field label={t("auth.name")} htmlFor="signup-name" required>
          <Input
            id="signup-name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label={t("auth.email")} htmlFor="signup-email" required>
          <Input
            id="signup-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label={t("auth.password")} hint={t("auth.passwordHint")} htmlFor="signup-password" required>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button type="submit" block size="lg" loading={busy}>
          {t("auth.signUp")}
        </Button>
      </form>
    </AuthFrame>
  );
}
