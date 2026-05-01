"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import { useTranslateError } from "@/i18n/error";
import { IconMegaphone, IconCheck } from "@/components/ui/Icons";
import type { ActionResult } from "@/app/actions/_types";

export type AnnouncementFormInitial = {
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "danger";
  startsAt: string;      // YYYY-MM-DD
  endsAt: string;        // YYYY-MM-DD
  isActive: boolean;
  isDismissible: boolean;
};

type Props = {
  action: (
    prev: ActionResult | undefined,
    formData: FormData,
  ) => Promise<ActionResult>;
  initial?: AnnouncementFormInitial;
  submitLabel?: string;
  cancelHref: string;
};

const TYPE_STYLES: Record<
  AnnouncementFormInitial["type"],
  { bg: string; fg: string }
> = {
  info:    { bg: "#eff6ff", fg: "#1d4ed8" },
  success: { bg: "#ecfdf5", fg: "#047857" },
  warning: { bg: "#fef3c7", fg: "#b45309" },
  danger:  { bg: "#fef2f2", fg: "#b91c1c" },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AnnouncementForm({ action, initial, submitLabel, cancelHref }: Props) {
  const t = useTranslations("dashboard.shared.announcementForm");
  const tErr = useTranslateError();
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  // Controlled for the live preview only — submit still reads everything from the form.
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [type, setType] = useState<AnnouncementFormInitial["type"]>(initial?.type ?? "info");

  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(useFormDirty(formRef));

  const submit = submitLabel ?? (initial ? t("submitEdit") : t("submitCreate"));
  const preview = TYPE_STYLES[type];
  const TYPE_LABELS = {
    info: t("typeInfo"),
    success: t("typeSuccess"),
    warning: t("typeWarning"),
    danger: t("typeDanger"),
  } as const;

  return (
    <form ref={formRef} action={formAction} className="max-w-[960px] p-8 pb-28 space-y-6">
      {state && !state.ok && <ErrorAlert>{tErr(state.error)}</ErrorAlert>}

      <Card>
        <CardHeader><CardTitle>{t("contentTitle")}</CardTitle></CardHeader>
        <CardBody className="space-y-6">
          <Field label={t("title")} id="title" hint={t("titleHint")} required>
            <Input
              id="title"
              name="title"
              placeholder={t("titlePlaceholder")}
              defaultValue={initial?.title ?? ""}
              onChange={(e) => setTitle(e.currentTarget.value)}
              maxLength={200}
              required
            />
          </Field>
          <Field label={t("body")} id="body" hint={t("bodyHint")} required>
            <Textarea
              id="body"
              name="body"
              rows={5}
              placeholder={t("bodyPlaceholder")}
              defaultValue={initial?.body ?? ""}
              onChange={(e) => setBody(e.currentTarget.value)}
              maxLength={2000}
              required
            />
          </Field>
          <div className="grid gap-6 md:grid-cols-3">
            <Field label={t("type")} id="type">
              <Select
                id="type"
                name="type"
                defaultValue={initial?.type ?? "info"}
                onChange={(e) => setType(e.currentTarget.value as AnnouncementFormInitial["type"])}
              >
                <option value="info">{t("typeInfo")}</option>
                <option value="success">{t("typeSuccess")}</option>
                <option value="warning">{t("typeWarning")}</option>
                <option value="danger">{t("typeDanger")}</option>
              </Select>
            </Field>
            <Field label={t("startDate")} id="startsAt" required>
              <Input
                id="startsAt"
                name="startsAt"
                type="date"
                defaultValue={initial?.startsAt ?? todayIso()}
                required
              />
            </Field>
            <Field label={t("endDate")} id="endsAt" required>
              <Input
                id="endsAt"
                name="endsAt"
                type="date"
                defaultValue={initial?.endsAt ?? plusDaysIso(14)}
                required
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("visibilityTitle")}</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <Switch
            id="isActive"
            name="isActive"
            label={t("active")}
            description={t("activeDescription")}
            defaultChecked={initial?.isActive ?? true}
          />
          <Switch
            id="isDismissible"
            name="isDismissible"
            label={t("dismissible")}
            description={t("dismissibleDescription")}
            defaultChecked={initial?.isDismissible ?? true}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("previewTitle")}</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-start gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
            <span
              aria-hidden
              className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md"
              style={{ backgroundColor: preview.bg, color: preview.fg }}
            >
              <IconMegaphone size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-[var(--color-ink)]">
                  {title || t("previewTitleFallback")}
                </h3>
                <Badge bg={preview.bg} fg={preview.fg}>{TYPE_LABELS[type]}</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)] whitespace-pre-line">
                {body || t("previewBodyFallback")}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button href={cancelHref} variant="ghost" size="md">{t("cancel")}</Button>
        <Button type="submit" size="md" loading={pending}>
          <IconCheck size={16} />
          {submit}
        </Button>
      </div>
    </form>
  );
}
