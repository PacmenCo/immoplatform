"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { IconTrash } from "@/components/ui/Icons";
import { deleteOwnAccount } from "@/app/actions/security";

export function DeleteAccountButton() {
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
        Delete account…
      </Button>

      {open && (
        <Modal
          overlay
          title="Delete your account"
          description="This removes your profile and signs you out of every device. Assignments you created stay on the platform; your name is kept on them for history."
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
                Keep my account
              </Button>
              <Button
                variant="danger"
                size="md"
                loading={pending}
                onClick={() => formRef.current?.requestSubmit()}
              >
                Delete account
              </Button>
            </>
          }
        >
          <form ref={formRef} action={handleSubmit} className="space-y-4">
            {error && <ErrorAlert>{error}</ErrorAlert>}
            <Field
              label="Confirm with your password"
              id="delete-password"
              hint="We ask for your password so a stolen session can't delete your account."
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
