"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Dashboard-wide guard against discarding unsaved form edits.
 *
 * Two layers:
 * 1. `beforeunload` — browser-owned native dialog on tab close / reload /
 *    typed-URL navigation.
 * 2. Document-level click capture on `<a>` elements — intercepts Next Link
 *    navigations (Sidebar, Topbar, breadcrumbs, in-page links). When dirty,
 *    we prevent the click and surface a styled `<ConfirmDialog>` instead of
 *    `window.confirm`. If the user confirms, we manually `router.push` to
 *    the captured href.
 *
 * Forms register their dirty state via `useUnsavedChanges(dirty)`.
 */

type DirtySubscription = () => boolean;

type Ctx = {
  register: (probe: DirtySubscription) => () => void;
};

const UnsavedChangesCtx = createContext<Ctx | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const probesRef = useRef<Set<DirtySubscription>>(new Set());
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const ctx: Ctx = {
    register: (probe) => {
      probesRef.current.add(probe);
      return () => {
        probesRef.current.delete(probe);
      };
    },
  };

  useEffect(() => {
    function isDirty(): boolean {
      for (const probe of probesRef.current) {
        if (probe()) return true;
      }
      return false;
    }

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };

    const onClick = (e: MouseEvent) => {
      if (!isDirty()) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (destination.origin !== window.location.origin) return;

      // Same-page hash / no-op click — let it through.
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash !== window.location.hash
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      // Preserve the full destination (path + query + hash) so we can
      // navigate there if the user confirms.
      setPendingHref(destination.pathname + destination.search + destination.hash);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return (
    <UnsavedChangesCtx.Provider value={ctx}>
      {children}
      <ConfirmDialog
        open={pendingHref !== null}
        tone="danger"
        title="Leave without saving?"
        description="You have unsaved changes on this page. If you leave now, they'll be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => {
          const href = pendingHref;
          setPendingHref(null);
          if (href) router.push(href);
        }}
        onCancel={() => setPendingHref(null)}
      />
    </UnsavedChangesCtx.Provider>
  );
}

export function useUnsavedChanges(dirty: boolean) {
  const ctx = useContext(UnsavedChangesCtx);
  useEffect(() => {
    if (!ctx) return;
    return ctx.register(() => dirty);
  }, [ctx, dirty]);
}
