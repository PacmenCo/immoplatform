"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Input";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { useTranslateError } from "@/i18n/error";
import {
  markContactHandled,
  updateContactNotes,
} from "@/app/actions/contact";
import type { ActionResult } from "@/app/actions/_types";

type Submission = {
  id: string;
  createdAt: string; // ISO
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  ipAddress: string | null;
  handledAt: string | null; // ISO
  handledByName: string | null;
  notes: string | null;
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ContactSubmissionRow({
  submission,
}: {
  submission: Submission;
}) {
  const t = useTranslations("dashboard.contactMessages.row");
  const tErr = useTranslateError();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  // Notes form — useActionState since we have a textarea + submit
  const boundNotes = updateContactNotes.bind(null, submission.id);
  const [notesState, notesAction, notesPending] = useActionState<
    ActionResult | undefined,
    FormData
  >(boundNotes, undefined);

  const handled = submission.handledAt !== null;

  function toggleHandled() {
    startTransition(async () => {
      await markContactHandled(submission.id, !handled);
    });
  }

  const replySubjectSource = submission.subject ?? t("replyDefaultSubject");
  const replySubject = t("replySubjectPrefix", { subject: replySubjectSource });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="group flex flex-1 min-w-0 items-center gap-4 px-5 py-4 text-left hover:bg-[var(--color-bg-muted)]"
          aria-expanded={expanded}
          aria-label={expanded ? t("collapseAria") : t("expandAria")}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-[var(--color-ink)]">
                {submission.name}
              </span>
              <span className="text-sm text-[var(--color-ink-muted)]">
                · {submission.email}
              </span>
              {handled ? (
                <Badge
                  bg="var(--color-bg-success, #ecfdf5)"
                  fg="var(--color-ink-success, #047857)"
                >
                  {t("statusHandled")}
                </Badge>
              ) : (
                <Badge
                  bg="var(--color-bg-warning, #fef3c7)"
                  fg="var(--color-ink-warning, #b45309)"
                >
                  {t("statusNew")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-[var(--color-ink-soft)] truncate">
              {submission.subject ? (
                <span className="font-medium">
                  {submission.subject} —{" "}
                </span>
              ) : null}
              {submission.message.slice(0, 140)}
              {submission.message.length > 140 ? "…" : ""}
            </p>
          </div>
          <div className="text-xs text-[var(--color-ink-muted)] whitespace-nowrap">
            {dateFmt.format(new Date(submission.createdAt))}
          </div>
          <ChevronIcon expanded={expanded} />
        </button>

        {!handled ? (
          <div className="flex items-center pr-3 sm:pr-4 border-l border-[var(--color-border)]">
            <Button
              size="sm"
              variant="primary"
              onClick={toggleHandled}
              loading={pending}
              className="ml-3 sm:ml-4"
            >
              {t("markHandled")}
            </Button>
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="border-t border-[var(--color-border)] px-5 py-5 space-y-5 bg-[var(--color-bg-alt)]">
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-[var(--color-ink-muted)] mb-1">{t("fields.from")}</p>
              <p className="font-medium">
                {submission.name}{" "}
                <a
                  href={`mailto:${submission.email}`}
                  className="text-[var(--color-brand)] hover:underline"
                >
                  ({submission.email})
                </a>
              </p>
            </div>
            {submission.phone ? (
              <div>
                <p className="text-[var(--color-ink-muted)] mb-1">{t("fields.phone")}</p>
                <p>
                  <a
                    href={`tel:${submission.phone}`}
                    className="text-[var(--color-brand)] hover:underline"
                  >
                    {submission.phone}
                  </a>
                </p>
              </div>
            ) : null}
            {submission.subject ? (
              <div className="sm:col-span-2">
                <p className="text-[var(--color-ink-muted)] mb-1">{t("fields.subject")}</p>
                <p>{submission.subject}</p>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <p className="text-[var(--color-ink-muted)] mb-1">{t("fields.message")}</p>
              <p className="whitespace-pre-wrap">{submission.message}</p>
            </div>
            {submission.ipAddress ? (
              <div>
                <p className="text-[var(--color-ink-muted)] mb-1">{t("fields.ip")}</p>
                <p className="font-mono text-xs">{submission.ipAddress}</p>
              </div>
            ) : null}
            {handled && submission.handledByName ? (
              <div>
                <p className="text-[var(--color-ink-muted)] mb-1">{t("fields.handledBy")}</p>
                <p>{submission.handledByName}</p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={handled ? "secondary" : "primary"}
              onClick={toggleHandled}
              loading={pending}
            >
              {handled ? t("reopen") : t("markHandled")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              href={`mailto:${encodeURIComponent(submission.email)}?subject=${encodeURIComponent(replySubject)}`}
            >
              {t("replyViaEmail")}
            </Button>
          </div>

          <form action={notesAction} className="space-y-2 pt-2 border-t border-[var(--color-border)]">
            <label
              htmlFor={`notes-${submission.id}`}
              className="text-sm font-medium text-[var(--color-ink)]"
            >
              {t("notes.label")}
            </label>
            <Textarea
              id={`notes-${submission.id}`}
              name="notes"
              rows={3}
              defaultValue={submission.notes ?? ""}
              placeholder={t("notes.placeholder")}
              maxLength={2000}
            />
            {notesState && !notesState.ok ? (
              <ErrorAlert>{tErr(notesState.error)}</ErrorAlert>
            ) : null}
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" variant="secondary" loading={notesPending}>
                {t("notes.save")}
              </Button>
              {notesState?.ok ? (
                <span className="text-sm text-[var(--color-ink-muted)]">
                  {t("notes.saved")}
                </span>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </Card>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={
        "shrink-0 text-[var(--color-ink-muted)] transition-transform " +
        (expanded ? "rotate-180" : "")
      }
    >
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}
