"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { NOTICES, NOTICE_PARAM, type NoticeKey } from "./notices";

/**
 * Flash a one-shot notice on the assignment detail page from a query param.
 * Used by `createAssignment` to surface partial-success outcomes (the row
 * was created but the supporting-files upload step failed) — the form's
 * `useActionState` value is wiped by `redirect()`, so we forward the warning
 * through `?notice=...` and translate it to a toast on land. After firing
 * we strip the notice param (keeping any other params intact) so a hard
 * refresh doesn't re-toast.
 */
export function Notice({ notice }: { notice: string | null }) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !notice) return;
    const m = NOTICES[notice as NoticeKey];
    if (!m) return;
    fired.current = true;
    toast[m.kind](m.message);
    const next = new URLSearchParams(searchParams);
    next.delete(NOTICE_PARAM);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [notice, toast, router, pathname, searchParams]);
  return null;
}
