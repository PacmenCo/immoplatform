"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { IconDownload } from "@/components/ui/Icons";

export function DownloadAssignmentPdfButton({ assignmentId }: { assignmentId: string }) {
  const t = useTranslations("dashboard.assignments.downloadPdf");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/assignments/${assignmentId}/pdf`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setError(payload?.error ?? t("fallbackError"));
        return;
      }
      const blob = await res.blob();
      const filename =
        extractFilename(res.headers.get("Content-Disposition")) ?? t("defaultFilename");
      triggerBrowserDownload(blob, filename);
    });
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Button variant="secondary" size="sm" onClick={run} loading={pending}>
        <IconDownload size={12} />
        {t("buttonLabel")}
      </Button>
      {error && <ErrorAlert>{error}</ErrorAlert>}
    </div>
  );
}

function extractFilename(header: string | null): string | null {
  if (!header) return null;
  const m = /filename="([^"]+)"/.exec(header);
  return m?.[1] ?? null;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
