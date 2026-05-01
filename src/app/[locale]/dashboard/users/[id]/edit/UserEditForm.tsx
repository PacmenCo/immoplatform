"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { SuccessBanner } from "@/components/ui/SuccessBanner";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import { useTranslateError } from "@/i18n/error";
import {
  updateUserByAdmin,
  resetUserPassword,
} from "@/app/actions/users";
import { ROLE_BADGE } from "@/lib/roleColors";
import type { ActionResult } from "@/app/actions/_types";

export type UserEditInitial = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export function UserEditForm({ initial }: { initial: UserEditInitial }) {
  const t = useTranslations("dashboard.users.edit.profile");
  const tRoles = useTranslations("dashboard.users.roles");
  const tErr = useTranslateError();
  const boundUpdate = updateUserByAdmin.bind(null, initial.id);
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundUpdate, undefined);

  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(useFormDirty(formRef));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {t("description")}
          </p>
        </CardHeader>
        <CardBody>
          <form ref={formRef} action={formAction} className="space-y-6">
            {state && !state.ok && <ErrorAlert>{tErr(state.error)}</ErrorAlert>}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("firstName")} id="firstName" required>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={initial.firstName}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label={t("lastName")} id="lastName" required>
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={initial.lastName}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label={t("email")} id="email" required>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={initial.email}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field
                label={t("role")}
                id="role"
                hint={t("roleHint")}
                required
              >
                <Select id="role" name="role" defaultValue={initial.role}>
                  {Object.keys(ROLE_BADGE).map((role) => (
                    <option key={role} value={role}>
                      {tRoles(role as "admin" | "staff" | "realtor" | "freelancer")}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex items-center justify-end">
              <Button type="submit" size="md" loading={pending}>
                {t("save")}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <PasswordResetCard userId={initial.id} />
    </div>
  );
}

function PasswordResetCard({ userId }: { userId: string }) {
  const t = useTranslations("dashboard.users.edit.passwordReset");
  const tErr = useTranslateError();
  const boundReset = resetUserPassword.bind(null, userId);
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundReset, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setJustSaved(true);
      const id = setTimeout(() => setJustSaved(false), 4000);
      return () => clearTimeout(id);
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          {t("description")}
        </p>
      </CardHeader>
      <CardBody>
        <form ref={formRef} action={formAction} className="grid gap-5 sm:max-w-md">
          {state && !state.ok && <ErrorAlert>{tErr(state.error)}</ErrorAlert>}
          {justSaved && <SuccessBanner>{t("success")}</SuccessBanner>}
          <Field
            label={t("newPassword")}
            id="admin-reset-password"
            hint={t("newPasswordHint")}
            required
          >
            <PasswordInput
              id="admin-reset-password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Field label={t("confirmPassword")} id="admin-reset-confirm" required>
            <PasswordInput
              id="admin-reset-confirm"
              name="confirm"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <div>
            <Button type="submit" variant="secondary" size="md" loading={pending}>
              {t("submit")}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
