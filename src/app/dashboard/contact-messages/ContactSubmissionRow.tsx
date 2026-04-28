"use client";

import { useActionState, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Input";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
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

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-[var(--color-bg-muted)]"
        aria-expanded={expanded}
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
                Handled
              </Badge>
            ) : (
              <Badge
                bg="var(--color-bg-warning, #fef3c7)"
                fg="var(--color-ink-warning, #b45309)"
              >
                New
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
      </button>

      {expanded ? (
        <div className="border-t border-[var(--color-border)] px-5 py-5 space-y-5 bg-[var(--color-bg-alt)]">
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-[var(--color-ink-muted)] mb-1">From</p>
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
                <p className="text-[var(--color-ink-muted)] mb-1">Phone</p>
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
                <p className="text-[var(--color-ink-muted)] mb-1">Subject</p>
                <p>{submission.subject}</p>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <p className="text-[var(--color-ink-muted)] mb-1">Message</p>
              <p className="whitespace-pre-wrap">{submission.message}</p>
            </div>
            {submission.ipAddress ? (
              <div>
                <p className="text-[var(--color-ink-muted)] mb-1">IP</p>
                <p className="font-mono text-xs">{submission.ipAddress}</p>
              </div>
            ) : null}
            {handled && submission.handledByName ? (
              <div>
                <p className="text-[var(--color-ink-muted)] mb-1">Handled by</p>
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
              {handled ? "Mark as new" : "Mark as handled"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              href={`mailto:${encodeURIComponent(submission.email)}?subject=${encodeURIComponent(`Re: ${submission.subject ?? "your message to immoplatform"}`)}`}
            >
              Reply via email
            </Button>
          </div>

          <form action={notesAction} className="space-y-2 pt-2 border-t border-[var(--color-border)]">
            <label
              htmlFor={`notes-${submission.id}`}
              className="text-sm font-medium text-[var(--color-ink)]"
            >
              Internal notes
            </label>
            <Textarea
              id={`notes-${submission.id}`}
              name="notes"
              rows={3}
              defaultValue={submission.notes ?? ""}
              placeholder="Anything the team should know about this lead…"
              maxLength={2000}
            />
            {notesState && !notesState.ok ? (
              <ErrorAlert>{notesState.error}</ErrorAlert>
            ) : null}
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" variant="secondary" loading={notesPending}>
                Save notes
              </Button>
              {notesState?.ok ? (
                <span className="text-sm text-[var(--color-ink-muted)]">
                  Saved.
                </span>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
