"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

/**
 * JSON editor for a template's props. On submit, serialise to the URL and
 * let the server re-render. Defaults come from the template's `previewProps`.
 */
export function EmailPreviewEditor({
  slug,
  initialJson,
}: {
  slug: string;
  initialJson: string;
}) {
  const router = useRouter();
  const t = useTranslations("dashboard.emails.detail.editor");
  const [json, setJson] = useState(initialJson);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    try {
      JSON.parse(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
      return;
    }
    setError(null);
    const url = `/dashboard/_emails/${slug}?props=${encodeURIComponent(json)}`;
    startTransition(() => router.replace(url));
  }

  function reset() {
    setError(null);
    startTransition(() => router.replace(`/dashboard/_emails/${slug}`));
  }

  return (
    <aside className="space-y-2">
      <label
        htmlFor={`props-${slug}`}
        className="block text-sm font-medium text-[var(--color-fg)]"
      >
        {t("label")}
      </label>
      <textarea
        id={`props-${slug}`}
        value={json}
        onChange={(e) => setJson(e.target.value)}
        spellCheck={false}
        className="h-[520px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono text-xs text-[var(--color-fg)]"
      />
      {error ? (
        <p className="text-xs text-[color:var(--color-danger,#b91c1c)]">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={pending}
          className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-brand)] disabled:opacity-60"
        >
          {t("apply")}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-fg)] disabled:opacity-60"
        >
          {t("reset")}
        </button>
      </div>
    </aside>
  );
}
