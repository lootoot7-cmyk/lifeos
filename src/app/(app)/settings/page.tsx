"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, Lock, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { enablePush, pushSupported } from "@/lib/data/push";
import { fileUrl, uploadFile } from "@/lib/data/storage";
import { errorKey } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/language-switch";
import { PageHeader } from "@/components/page";
import {
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Select,
  Toggle,
  cn,
  useToast,
} from "@/components/ui";
import type { NotificationPrefs, ThemePreference } from "@/lib/types";

const FALLBACK_ZONES = [
  "UTC",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kuala_Lumpur",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
];

const THEMES: ThemePreference[] = ["system", "light", "dark"];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function hourLabel(hour: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { hour: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(2020, 0, 1, hour)),
    );
  } catch {
    return `${hour}:00`;
  }
}

function zoneList(current: string): string[] {
  let zones: string[] = FALLBACK_ZONES;
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: "timeZone") => string[] }
    ).supportedValuesOf?.("timeZone");
    if (supported && supported.length > 0) zones = supported;
  } catch {
    // Older browsers: use the common list.
  }
  return zones.includes(current) ? zones : [current, ...zones];
}

export default function SettingsPage() {
  const { user, profile, saveProfile, signOutUser } = useAuth();
  const { t, locale } = useI18n();
  const { theme, setTheme, largeText, highContrast, setLargeText, setHighContrast } = useTheme();
  const toast = useToast();

  const [draft, setDraft] = useState({
    displayName: profile?.displayName ?? "",
    phone: profile?.phone ?? "",
    country: profile?.country ?? "",
    timeZone: profile?.timeZone ?? "UTC",
  });
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    country?: string;
    timeZone?: string;
  }>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushAvailable, setPushAvailable] = useState<boolean | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setDraft({
      displayName: profile.displayName,
      phone: profile.phone ?? "",
      country: profile.country,
      timeZone: profile.timeZone,
    });
  }, [profile?.displayName, profile?.phone, profile?.country, profile?.timeZone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true;
    void pushSupported().then((supported) => {
      if (active) setPushAvailable(supported);
    });
    return () => {
      active = false;
    };
  }, []);

  const zones = useMemo(() => zoneList(profile?.timeZone ?? "UTC"), [profile?.timeZone]);
  const hours = useMemo(
    () => HOURS.map((hour) => ({ value: hour, label: hourLabel(hour, locale) })),
    [locale],
  );

  if (!profile || !user) return null;

  const prefs = profile.notificationPrefs;
  const quietOn = prefs.quietStart !== null && prefs.quietEnd !== null;
  const initial = (profile.displayName || profile.email || "L").trim().charAt(0).toUpperCase() || "L";
  const busy = saving !== null;

  async function saveIdentity(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    const displayName = draft.displayName.trim();
    const phone = draft.phone.trim();
    const country = draft.country.trim().toUpperCase();

    if (!displayName) next.name = t("errors.required");
    if (phone && !/^\+?[0-9][0-9 ()-]{5,}$/.test(phone)) next.phone = t("auth.err.invalidPhone");
    if (country && !/^[A-Z]{2}$/.test(country)) next.country = t("errors.invalidCountry");
    try {
      new Intl.DateTimeFormat("en", { timeZone: draft.timeZone });
    } catch {
      next.timeZone = t("errors.invalidTimeZone");
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving("identity");
    try {
      await saveProfile({ displayName, phone: phone || null, country, timeZone: draft.timeZone });
      toast(t("settings.saved"));
    } catch (cause) {
      toast(t(errorKey(cause)), "danger");
    } finally {
      setSaving(null);
    }
  }

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast(t("errors.fileType"), "danger");
      return;
    }
    setPhotoBusy(true);
    try {
      const attachment = await uploadFile(user.uid, "avatar", file);
      const url = await fileUrl(attachment.path);
      await saveProfile({ photoURL: url });
      toast(t("settings.saved"));
    } catch (cause) {
      toast(t(errorKey(cause)), "danger");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function persistPrefs(patch: Partial<NotificationPrefs>) {
    if (busy) return;
    setSaving("prefs");
    try {
      await saveProfile({ notificationPrefs: { ...prefs, ...patch } });
    } catch (cause) {
      toast(t(errorKey(cause)), "danger");
    } finally {
      setSaving(null);
    }
  }

  async function togglePush(enabled: boolean) {
    if (busy || pushBusy || !user) return;
    if (!enabled) {
      await persistPrefs({ push: false });
      return;
    }

    setPushBusy(true);
    try {
      const outcome = await enablePush(user.uid);
      if (outcome === "granted") {
        await saveProfile({ notificationPrefs: { ...prefs, push: true } });
        toast(t("settings.saved"));
      } else if (outcome === "blocked") {
        toast(t("onboarding.notificationsBlocked"), "danger");
      } else {
        toast(t("settings.pushUnsupported"), "danger");
      }
    } catch (cause) {
      toast(t(errorKey(cause)), "danger");
    } finally {
      setPushBusy(false);
    }
  }

  function pickTheme(next: ThemePreference) {
    setTheme(next);
    if (busy) return;
    setSaving("theme");
    saveProfile({ theme: next })
      .catch((cause) => toast(t(errorKey(cause)), "danger"))
      .finally(() => setSaving(null));
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await signOutUser();
    } catch (cause) {
      toast(t(errorKey(cause)), "danger");
      setSigningOut(false);
    }
  }

  return (
    <div className="animate-fade">
      <PageHeader title={t("settings.title")} />

      <div className="grid max-w-3xl gap-4">
        <Card className="p-5">
          <SectionTitle title={t("settings.profile")} />

          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft text-xl font-semibold text-brand">
              {profile.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoURL} alt="" className="size-full object-cover" />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{t("settings.photo")}</p>
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label={t("settings.changePhoto")}
                onChange={changePhoto}
              />
              <Button
                size="sm"
                variant="secondary"
                className="mt-1.5"
                loading={photoBusy}
                disabled={busy}
                onClick={() => photoInput.current?.click()}
              >
                <Camera aria-hidden className="size-4" />
                {t("settings.changePhoto")}
              </Button>
            </div>
          </div>

          <form onSubmit={saveIdentity} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
            <Field
              label={t("settings.displayName")}
              htmlFor="settings-name"
              required
              error={errors.name}
              className="sm:col-span-2"
            >
              <Input
                id="settings-name"
                value={draft.displayName}
                autoComplete="name"
                onChange={(event) => {
                  setDraft({ ...draft, displayName: event.target.value });
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
              />
            </Field>

            <Field
              label={t("settings.phone")}
              htmlFor="settings-phone"
              error={errors.phone}
              hint={t("auth.phoneHint")}
            >
              <Input
                id="settings-phone"
                type="tel"
                dir="ltr"
                value={draft.phone}
                autoComplete="tel"
                placeholder="+92 300 1234567"
                onChange={(event) => {
                  setDraft({ ...draft, phone: event.target.value });
                  if (errors.phone) setErrors({ ...errors, phone: undefined });
                }}
              />
            </Field>

            <Field
              label={t("settings.country")}
              htmlFor="settings-country"
              hint={t("settings.countryHint")}
              error={errors.country}
            >
              <Input
                id="settings-country"
                value={draft.country}
                maxLength={2}
                autoComplete="country"
                autoCapitalize="characters"
                onChange={(event) => {
                  setDraft({ ...draft, country: event.target.value.toUpperCase() });
                  if (errors.country) setErrors({ ...errors, country: undefined });
                }}
              />
            </Field>

            <Field
              label={t("settings.timeZone")}
              htmlFor="settings-timezone"
              hint={t("settings.timeZoneHint")}
              error={errors.timeZone}
              className="sm:col-span-2"
            >
              <Select
                id="settings-timezone"
                value={draft.timeZone}
                onChange={(event) => {
                  setDraft({ ...draft, timeZone: event.target.value });
                  if (errors.timeZone) setErrors({ ...errors, timeZone: undefined });
                }}
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="sm:col-span-2">
              <Button type="submit" loading={saving === "identity"} disabled={busy && saving !== "identity"}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <SectionTitle title={t("settings.appearance")} />

          <p className="mb-2 text-sm font-medium">{t("settings.theme")}</p>
          <div
            role="group"
            aria-label={t("settings.theme")}
            className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-2 p-1"
          >
            {THEMES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                disabled={busy}
                onClick={() => pickTheme(value)}
                className={cn(
                  "rounded-lg py-2 text-sm font-medium transition disabled:opacity-60",
                  theme === value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
                )}
              >
                {t(`settings.theme.${value}`)}
              </button>
            ))}
          </div>

          <div className="mt-3 divide-y divide-line">
            <Toggle checked={largeText} onChange={setLargeText} label={t("settings.largeText")} />
            <Toggle
              checked={highContrast}
              onChange={setHighContrast}
              label={t("settings.highContrast")}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <span className="text-sm font-medium">{t("settings.language")}</span>
            <LanguageSwitch
              disabled={busy}
              onChange={(language) => {
                saveProfile({ language }).catch((cause) =>
                  toast(t(errorKey(cause)), "danger"),
                );
              }}
            />
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title={t("settings.notifications")} />

          <div className="divide-y divide-line">
            <Toggle
              checked={pushAvailable === false ? false : prefs.push}
              onChange={(value) => void togglePush(value)}
              label={t("settings.push")}
              description={
                pushAvailable === false ? t("settings.pushUnsupported") : undefined
              }
              disabled={pushAvailable === false || pushBusy || busy}
            />
            <Toggle
              checked={prefs.email}
              onChange={(value) => void persistPrefs({ email: value })}
              label={t("settings.emailNotif")}
              disabled={busy}
            />
            <Toggle
              checked={prefs.inApp}
              onChange={(value) => void persistPrefs({ inApp: value })}
              label={t("settings.inApp")}
              disabled={busy}
            />
          </div>

          <div className="mt-3 grid gap-4 border-t border-line pt-3 sm:grid-cols-2">
            <Field label={t("settings.reminderHour")} htmlFor="settings-reminder-hour">
              <Select
                id="settings-reminder-hour"
                value={prefs.reminderHour}
                disabled={busy}
                onChange={(event) => void persistPrefs({ reminderHour: Number(event.target.value) })}
              >
                {hours.map((hour) => (
                  <option key={hour.value} value={hour.value}>
                    {hour.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-3 border-t border-line pt-3">
            <Toggle
              checked={quietOn}
              onChange={(value) =>
                void persistPrefs(
                  value ? { quietStart: 22, quietEnd: 7 } : { quietStart: null, quietEnd: null },
                )
              }
              label={t("settings.quietHours")}
              description={
                quietOn
                  ? `${hourLabel(prefs.quietStart ?? 22, locale)} – ${hourLabel(prefs.quietEnd ?? 7, locale)}`
                  : undefined
              }
              disabled={busy}
            />
            {quietOn && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Field label={t("settings.quietFrom")} htmlFor="settings-quiet-start">
                  <Select
                    id="settings-quiet-start"
                    value={prefs.quietStart ?? 22}
                    disabled={busy}
                    onChange={(event) =>
                      void persistPrefs({ quietStart: Number(event.target.value) })
                    }
                  >
                    {hours.map((hour) => (
                      <option key={hour.value} value={hour.value}>
                        {hour.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("settings.quietTo")} htmlFor="settings-quiet-end">
                  <Select
                    id="settings-quiet-end"
                    value={prefs.quietEnd ?? 7}
                    disabled={busy}
                    onChange={(event) => void persistPrefs({ quietEnd: Number(event.target.value) })}
                  >
                    {hours.map((hour) => (
                      <option key={hour.value} value={hour.value}>
                        {hour.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title={t("settings.account")} />
          <p className="text-sm">
            {t("settings.signedInAs", {
              who: profile.email ?? profile.phone ?? user.email ?? user.uid,
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/privacy/">
              <Button size="sm" variant="secondary">
                <Lock aria-hidden className="size-4" />
                {t("nav.privacy")}
              </Button>
            </Link>
            <Button
              size="sm"
              variant="secondary"
              loading={signingOut}
              onClick={() => void signOut()}
            >
              <LogOut aria-hidden className="size-4" />
              {t("common.signOut")}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle
            title={t("settings.security")}
            action={<ShieldCheck aria-hidden className="size-4 text-muted" />}
          />
          <p className="text-sm text-muted">{t("settings.securityBody")}</p>
        </Card>
      </div>
    </div>
  );
}
