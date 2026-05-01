"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { IconTrash } from "@/components/ui/Icons";
import { deleteOwnAccount } from "@/app/actions/security";
import { useTranslateError } from "@/i18n/error";

export function DeleteAccountButton() {
  const t = useTranslations("dashboard.settings.profile.danger");
  const tErr = useTranslateError();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      // Successful deletion redirects to /login (throws NEXT_REDIRECT), so we
      // never reach a state update in that branch — the page unmounts.
      const res = await deleteOwnAccount(undefined, formData);
      if (res && !res.ok) {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <IconTrash size={14} />
        {t("open")}
      </Button>

      {open && (
        <Modal
          overlay
          title={t("modalTitle")}
          description={t("modalDescription")}
          onClose={() => !pending && setOpen(false)}
          className="w-full"
          footer={
            <>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                {t("keep")}
              </Button>
              <Button
                variant="danger"
                size="md"
                loading={pending}
                onClick={() => formRef.current?.requestSubmit()}
              >
                {t("confirm")}
              </Button>
            </>
          }
        >
          <form ref={formRef} action={handleSubmit} className="space-y-4">
            {error && <ErrorAlert>{tErr(error)}</ErrorAlert>}
            <Field
              label={t("passwordLabel")}
              id="delete-password"
              hint={t("passwordHint")}
              required
            >
              <PasswordInput
                id="delete-password"
                name="password"
                autoComplete="current-password"
                required
                disabled={pending}
              />
            </Field>
            {/* Submit-via-Enter target; the visible submit lives in the footer. */}
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        </Modal>
      )}
    </>
  );
}
