"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { errorKey } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { AuthFrame, FormError, FormNotice } from "@/components/auth-frame";
import { ConfigMissing, Splash } from "@/components/shell";
import { Button, Field, Input, cn } from "@/components/ui";

type Mode = "email" | "phone";

export default function LoginPage() {
  const { configured, loading, user, signInEmail, signInGoogle, sendPhoneCode, confirmPhoneCode } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | "phone" | "code" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (configured && !loading && user) router.replace("/");
  }, [configured, loading, user, router]);

  if (!configured) return <ConfigMissing />;
  if (loading || user) return <Splash />;

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("email");
    try {
      await signInEmail(email, password);
      router.replace("/");
    } catch (cause) {
      setError(t(errorKey(cause)));
      setBusy(null);
    }
  }

  async function submitGoogle() {
    setError(null);
    setBusy("google");
    try {
      await signInGoogle();
      router.replace("/");
    } catch (cause) {
      setError(t(errorKey(cause)));
      setBusy(null);
    }
  }

  async function submitPhone(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy("phone");
    try {
      if (!recaptchaRef.current) throw new Error("auth/internal-error");
      await sendPhoneCode(phone, recaptchaRef.current);
      setCodeSent(true);
      setNotice(t("auth.codeSent", { phone }));
    } catch (cause) {
      setError(t(errorKey(cause)));
    } finally {
      setBusy(null);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("code");
    try {
      await confirmPhoneCode(code);
      router.replace("/");
    } catch (cause) {
      setError(t(errorKey(cause)));
      setBusy(null);
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
      active ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
    );

  return (
    <AuthFrame
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link href="/signup/" className="font-medium text-brand underline-offset-4 hover:underline">
            {t("auth.signUp")}
          </Link>
        </>
      }
    >
      <h1 className="text-xl font-semibold tracking-tight">{t("auth.welcomeBack")}</h1>
      <p className="mt-1 text-sm text-muted">{t("app.tagline")}</p>

      <div role="tablist" aria-label={t("auth.signIn")} className="mt-5 flex gap-1 rounded-xl bg-surface-2 p-1">
        <button
          role="tab"
          aria-selected={mode === "email"}
          className={tabClass(mode === "email")}
          onClick={() => {
            setMode("email");
            setError(null);
          }}
        >
          {t("auth.withEmail")}
        </button>
        <button
          role="tab"
          aria-selected={mode === "phone"}
          className={tabClass(mode === "phone")}
          onClick={() => {
            setMode("phone");
            setError(null);
          }}
        >
          {t("auth.withPhone")}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <FormError message={error} />
        {mode === "phone" && <FormNotice message={notice} />}

        {mode === "email" ? (
          <form onSubmit={submitEmail} className="space-y-4" noValidate>
            <Field label={t("auth.email")} htmlFor="login-email" required>
              <Input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label={t("auth.password")} htmlFor="login-password" required>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
              />
            </Field>
            <div className="text-end">
              <Link
                href="/reset-password/"
                className="text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                {t("auth.forgot")}
              </Link>
            </div>
            <Button type="submit" block size="lg" loading={busy === "email"}>
              {busy === "email" ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <form onSubmit={submitPhone} className="space-y-4" noValidate>
              <Field label={t("auth.phone")} hint={t("auth.phoneHint")} htmlFor="login-phone" required>
                <Input
                  id="login-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+92 300 1234567"
                />
              </Field>
              <Button type="submit" block variant={codeSent ? "secondary" : "primary"} loading={busy === "phone"}>
                {t("auth.sendCode")}
              </Button>
            </form>

            {codeSent && (
              <form onSubmit={submitCode} className="space-y-4">
                <Field label={t("auth.code")} htmlFor="login-code" required>
                  <Input
                    id="login-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                </Field>
                <Button type="submit" block size="lg" loading={busy === "code"}>
                  {t("auth.verifyCode")}
                </Button>
              </form>
            )}

            <div ref={recaptchaRef} id="recaptcha-container" />
          </div>
        )}

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs uppercase tracking-wide text-muted">{t("auth.or")}</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <Button variant="secondary" block size="lg" onClick={submitGoogle} loading={busy === "google"}>
          {t("auth.withGoogle")}
        </Button>
      </div>
    </AuthFrame>
  );
}
