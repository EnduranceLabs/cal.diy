"use client";

import { ErrorCode } from "@calcom/features/auth/lib/ErrorCode";
import { HOSTED_CAL_FEATURES, WEBAPP_URL, WEBSITE_URL } from "@calcom/lib/constants";
import { emailRegex } from "@calcom/lib/emailSchema";
import { getSafeRedirectUrl } from "@calcom/lib/getSafeRedirectUrl";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { getI18nEditAttributes } from "@calcom/lib/i18nEditMode";
import { Alert } from "@calcom/ui/components/alert";
import { Icon } from "@calcom/ui/components/icon";
import { LastUsed, useLastUsed } from "@calcom/web/modules/auth/hooks/useLastUsed";
import AddToHomescreen from "@components/AddToHomescreen";
import BackupCode from "@components/auth/BackupCode";
import TwoFactor from "@components/auth/TwoFactor";
import { Button } from "@coss/ui/components/button";
import { Field, FieldLabel } from "@coss/ui/components/field";
import { Input } from "@coss/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@coss/ui/components/input-group";
import { Separator } from "@coss/ui/components/separator";
import { zodResolver } from "@hookform/resolvers/zod";
import type { inferSSRProps } from "@lib/types/inferSSRProps";
import type { getServerSideProps } from "@server/lib/auth/login/getServerSideProps";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";

interface LoginValues {
  email: string;
  password: string;
  totpCode: string;
  backupCode: string;
  csrfToken: string;
}

const MicrosoftIcon = () => <img className="size-4" src="/microsoft-logo.svg" alt="" />;

const GoogleIcon = () => <img className="size-4" src="/google-icon-colored.svg" alt="" />;

const LOGIN_HERO_FEATURE_KEYS = [
  "login_hero_feature_calendar",
  "login_hero_feature_booking",
  "login_hero_feature_privacy",
] as const;

function BackgroundGrid() {
  const rows = 9;
  const cols = 18;
  const size = 60;
  const gap = 8;
  const radius = 8;
  const width = cols * size + (cols - 1) * gap;
  const height = rows * size + (rows - 1) * gap;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        className="[--grid-fill:#f7f7f7] [--grid-stroke:rgba(34,42,53,0.08)] dark:[--grid-fill:#1f1f1f] dark:[--grid-stroke:rgba(255,255,255,0.08)]">
        <defs>
          <radialGradient id="gridFade" cx="50%" cy="50%" rx="70%" ry="70%">
            <stop offset="20%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="gridMask">
            <rect width={width} height={height} fill="url(#gridFade)" />
          </mask>
          <filter id="gridShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(34,42,53,0.05)" />
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(19,19,22,0.03)" />
          </filter>
        </defs>
        <g mask="url(#gridMask)">
          {Array.from({ length: rows * cols }).map((_, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = col * (size + gap);
            const y = row * (size + gap);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={size}
                height={size}
                rx={radius}
                fill="var(--grid-fill)"
                stroke="var(--grid-stroke)"
                strokeWidth="1"
                filter="url(#gridShadow)"
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
export type PageProps = inferSSRProps<typeof getServerSideProps>;
export default function Login({
  csrfToken,
  isGoogleLoginEnabled,
  isOutlookLoginEnabled,
  totpEmail,
}: PageProps) {
  const searchParams = useCompatSearchParams();
  const { t, i18n } = useLocale();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const i18nEdit = (key: string) => getI18nEditAttributes(key, locale);
  const router = useRouter();
  const formSchema = z
    .object({
      email: z
        .string()
        .min(1, `${t("error_required_field")}`)
        .regex(emailRegex, `${t("enter_valid_email")}`),
      ...(totpEmail ? {} : { password: z.string().min(1, `${t("error_required_field")}`) }),
    })
    // Passthrough other fields like totpCode
    .passthrough();
  const methods = useForm<LoginValues>({ resolver: zodResolver(formSchema) });
  const { register, formState } = methods;
  const [twoFactorRequired, setTwoFactorRequired] = useState(!!totpEmail || false);
  const [twoFactorLostAccess, setTwoFactorLostAccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUsed, setLastUsed] = useLastUsed();
  const [showPassword, setShowPassword] = useState(false);

  const errorMessages: { [key: string]: string } = {
    // [ErrorCode.SecondFactorRequired]: t("2fa_enabled_instructions"),
    // Don't leak information about whether an email is registered or not
    [ErrorCode.IncorrectEmailPassword]: t("incorrect_email_password"),
    [ErrorCode.IncorrectTwoFactorCode]: `${t("incorrect_2fa_code")} ${t("please_try_again")}`,
    [ErrorCode.InternalServerError]: `${t("something_went_wrong")} ${t("please_try_again_and_contact_us")}`,
    [ErrorCode.ThirdPartyIdentityProviderEnabled]: t("account_created_with_identity_provider"),
  };

  let callbackUrl = searchParams?.get("callbackUrl") || "";

  if (/"\//.test(callbackUrl)) callbackUrl = callbackUrl.substring(1);

  // If not absolute URL, make it absolute
  if (!/^https?:\/\//.test(callbackUrl)) {
    callbackUrl = `${WEBAPP_URL}/${callbackUrl}`;
  }

  const safeCallbackUrl = getSafeRedirectUrl(callbackUrl);

  callbackUrl = safeCallbackUrl || "";

  const onSubmit = async (values: LoginValues) => {
    setErrorMessage(null);
    // telemetry.event(telemetryEventTypes.login, collectPageParameters());
    const res = await signIn<"credentials">("credentials", {
      ...values,
      callbackUrl,
      redirect: false,
    });
    if (!res) setErrorMessage(errorMessages[ErrorCode.InternalServerError]);
    // we're logged in! let's do a hard refresh to the desired url
    else if (!res.error) {
      setLastUsed("credentials");
      router.push(callbackUrl);
    } else if (res.error === ErrorCode.SecondFactorRequired) setTwoFactorRequired(true);
    else if (res.error === ErrorCode.IncorrectBackupCode) setErrorMessage(t("incorrect_backup_code"));
    else if (res.error === ErrorCode.MissingBackupCodes) setErrorMessage(t("missing_backup_codes"));
    // fallback if error not found
    else setErrorMessage(errorMessages[res.error] || t("something_went_wrong"));
  };

  const showSocialLogin = isGoogleLoginEnabled || isOutlookLoginEnabled;
  const showSignupLink =
    process.env.NEXT_PUBLIC_DISABLE_SIGNUP !== "true" && searchParams?.get("register") !== "false";
  const loginSubtitleKey = twoFactorRequired ? "2fa_code" : "welcome_back_sign_in";
  const submitLabelKey = twoFactorRequired ? "submit" : "continue";

  return (
    <div className="relative min-h-screen overflow-hidden bg-default text-emphasis">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-[#09090b] via-[#312e81] to-[#0891b2] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-24 top-16 size-72 rounded-full bg-cyan-300/30 blur-3xl" />
          <div className="absolute bottom-20 right-0 size-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.18)_0%,transparent_36%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:48px_48px]" />

          <div className="relative z-10 flex items-center justify-between">
            <p className="font-cal text-xl font-bold">Cal.diy</p>
            <span
              {...i18nEdit("login_hero_badge")}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
              {t("login_hero_badge")}
            </span>
          </div>

          <div className="relative z-10 max-w-2xl">
            <p
              {...i18nEdit("login_hero_kicker")}
              className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-100/80">
              {t("login_hero_kicker")}
            </p>
            <h1
              {...i18nEdit("login_hero_title")}
              className="font-cal text-5xl font-bold leading-tight tracking-[-0.04em] xl:text-6xl">
              {t("login_hero_title")}
            </h1>
            <p {...i18nEdit("login_hero_description")} className="mt-6 max-w-xl text-lg text-white/75">
              {t("login_hero_description")}
            </p>

            <ul className="mt-10 grid gap-3 text-sm text-white/85">
              {LOGIN_HERO_FEATURE_KEYS.map((featureKey) => (
                <li key={featureKey} className="flex items-center gap-3">
                  <span
                    className="flex size-6 items-center justify-center rounded-full bg-white/15 text-xs text-cyan-100 ring-1 ring-white/20"
                    aria-hidden="true">
                    ✓
                  </span>
                  <span {...i18nEdit(featureKey)}>{t(featureKey)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="relative z-10 rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-xl"
            aria-hidden="true">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p {...i18nEdit("login_hero_card_title")} className="text-sm font-medium text-white/70">
                  {t("login_hero_card_title")}
                </p>
                <p {...i18nEdit("login_hero_card_subtitle")} className="mt-1 text-xl font-semibold">
                  {t("login_hero_card_subtitle")}
                </p>
              </div>
              <div
                {...i18nEdit("login_hero_card_time")}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#312e81]">
                {t("login_hero_card_time")}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {LOGIN_HERO_FEATURE_KEYS.map((featureKey, index) => (
                <div key={featureKey} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                  <div className="mb-8 h-2 w-10 rounded-full bg-cyan-200/70" />
                  <p className="text-sm font-medium text-white/80">0{index + 1}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center overflow-y-auto px-4 py-10 sm:px-6 lg:px-10">
          <BackgroundGrid />

          <div className="relative z-10 flex w-full max-w-md flex-col items-center">
            <div className="mb-6 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#312e81] via-[#4f46e5] to-[#0891b2] p-6 text-white shadow-lg lg:hidden">
              <p
                {...i18nEdit("login_hero_kicker")}
                className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
                {t("login_hero_kicker")}
              </p>
              <h1
                {...i18nEdit("login_hero_title")}
                className="mt-3 font-cal text-3xl font-bold leading-tight">
                {t("login_hero_title")}
              </h1>
              <p {...i18nEdit("login_hero_description")} className="mt-3 text-sm text-white/75">
                {t("login_hero_description")}
              </p>
            </div>

            {/* Main Card */}
            <div className="w-full rounded-xl border border-subtle bg-default p-10 shadow-sm">
              {/* Logo */}
              <div className="mb-2 text-center">
                <p className="font-cal text-xl font-bold text-emphasis">Cal.diy</p>
              </div>

              {/* Heading */}
              <p
                {...i18nEdit(loginSubtitleKey)}
                className="mb-8 text-center text-sm text-subtle"
                data-testid="login-subtitle">
                {t(loginSubtitleKey)}
              </p>

              <FormProvider {...methods}>
                {/* Social Login Buttons */}
                {!twoFactorRequired && showSocialLogin && (
                  <>
                    <div className="flex flex-col gap-2">
                      {isGoogleLoginEnabled && (
                        <Button
                          className="w-full py-1"
                          disabled={formState.isSubmitting}
                          data-testid="google"
                          onClick={async (e) => {
                            e.preventDefault();
                            setLastUsed("google");
                            await signIn("google", {
                              callbackUrl,
                            });
                          }}>
                          <GoogleIcon />
                          <span {...i18nEdit("signin_with_google")}>{t("signin_with_google")}</span>
                          {lastUsed === "google" && <LastUsed />}
                        </Button>
                      )}
                      {isOutlookLoginEnabled && (
                        <Button
                          variant="outline"
                          className="w-full py-1"
                          data-testid="microsoft"
                          onClick={async (e) => {
                            e.preventDefault();
                            setLastUsed("microsoft");
                            await signIn("azure-ad", {
                              callbackUrl,
                            });
                          }}>
                          <MicrosoftIcon />
                          <span {...i18nEdit("signin_with_microsoft")}>{t("signin_with_microsoft")}</span>
                          {lastUsed === "microsoft" && <LastUsed />}
                        </Button>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="my-6 flex items-center gap-4">
                      <Separator className="flex-1" />
                      <span {...i18nEdit("or")} className="text-sm text-zinc-400">
                        {t("or").toLowerCase()}
                      </span>
                      <Separator className="flex-1" />
                    </div>
                  </>
                )}

                <form onSubmit={methods.handleSubmit(onSubmit)} noValidate data-testid="login-form">
                  <input
                    defaultValue={csrfToken || undefined}
                    type="hidden"
                    hidden
                    {...register("csrfToken")}
                  />

                  {!twoFactorRequired && (
                    <div className="space-y-6">
                      {/* Email Field */}
                      <Field>
                        <FieldLabel {...i18nEdit("email")}>{t("email")}</FieldLabel>
                        <Input
                          id="email"
                          type="email"
                          defaultValue={totpEmail || (searchParams?.get("email") as string)}
                          autoComplete="email"
                          {...register("email")}
                        />
                        {formState.errors.email && (
                          <p data-testid="field-error" className="text-destructive-foreground text-xs">
                            {formState.errors.email.message}
                          </p>
                        )}
                      </Field>

                      {/* Password Field */}
                      <Field>
                        <div className="flex w-full items-center justify-between">
                          <FieldLabel {...i18nEdit("password")}>{t("password")}</FieldLabel>
                          <Link
                            {...i18nEdit("forgot")}
                            href="/auth/forgot-password"
                            className="text-sm text-subtle hover:text-emphasis">
                            {t("forgot")}
                          </Link>
                        </div>
                        <InputGroup className="overflow-hidden">
                          <InputGroupInput
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            {...register("password")}
                          />
                          <InputGroupAddon align="inline-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? t("hide_password") : t("show_password")}>
                              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </Button>
                          </InputGroupAddon>
                        </InputGroup>
                        {formState.errors.password && (
                          <p data-testid="field-error" className="text-destructive-foreground text-xs">
                            {formState.errors.password.message}
                          </p>
                        )}
                      </Field>
                    </div>
                  )}

                  {/* Two Factor */}
                  {twoFactorRequired && (
                    <div className="space-y-4">
                      {!twoFactorLostAccess ? <TwoFactor center /> : <BackupCode center />}
                    </div>
                  )}

                  {/* Error Message */}
                  {errorMessage && <Alert severity="error" title={errorMessage} className="mt-4" />}

                  {/* Submit Button */}
                  <Button
                    {...i18nEdit(submitLabelKey)}
                    type="submit"
                    variant="outline"
                    className="mt-8 w-full"
                    disabled={formState.isSubmitting}>
                    {t(submitLabelKey)}
                  </Button>
                </form>

                {/* Two Factor Footer */}
                {twoFactorRequired && (
                  <div className="mt-4 flex justify-center gap-4">
                    {!totpEmail ? (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            if (twoFactorLostAccess) {
                              setTwoFactorLostAccess(false);
                              methods.setValue("backupCode", "");
                            } else {
                              setTwoFactorRequired(false);
                              methods.setValue("totpCode", "");
                            }
                            setErrorMessage(null);
                          }}>
                          <Icon name="arrow-left" className="mr-2 size-4" />
                          <span {...i18nEdit("go_back")}>{t("go_back")}</span>
                        </Button>
                        {!twoFactorLostAccess && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setTwoFactorLostAccess(true);
                              setErrorMessage(null);
                              methods.setValue("totpCode", "");
                            }}>
                            <Icon name="lock" className="mr-2 size-4" />
                            <span {...i18nEdit("lost_access")}>{t("lost_access")}</span>
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          window.location.replace("/");
                        }}>
                        <span {...i18nEdit("cancel")}>{t("cancel")}</span>
                      </Button>
                    )}
                  </div>
                )}
              </FormProvider>
            </div>

            {/* Footer Links */}
            {!twoFactorRequired && (
              <div className="mt-6 flex items-center justify-center gap-4 text-center">
                {showSignupLink && (
                  <Link
                    {...i18nEdit("create_account")}
                    href={
                      callbackUrl
                        ? `${WEBSITE_URL}/signup?redirect=${encodeURIComponent(callbackUrl)}`
                        : `${WEBSITE_URL}/signup`
                    }
                    className="text-sm font-medium text-emphasis hover:underline">
                    {t("create_account")}
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <AddToHomescreen />
    </div>
  );
}
