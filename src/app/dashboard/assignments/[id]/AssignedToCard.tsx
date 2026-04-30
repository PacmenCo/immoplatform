"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { IconPlus, IconSearch, IconUserSwap, IconX } from "@/components/ui/Icons";
import { initials } from "@/lib/format";
import type { EligibleFreelancer } from "./ReassignFreelancerButton";

// UI-only prototype. Per-service freelancer assignments are kept in local
// state — nothing is persisted yet. When the schema lands, swap the local
// `setByService` calls for a server action and remove the local map.

type ServiceMeta = {
  key: string;
  label: string;
  short: string;
  color: string;
};

type Props = {
  /** Full service catalog (every available service). The card listens for
   *  changes on the form's `service_<key>` checkboxes and shows a row for
   *  each one currently checked. */
  services: ServiceMeta[];
  /** Service keys checked at first paint — seeds the visible rows before the
   *  form's checkboxes have fired any events. */
  initialSelectedServiceKeys: string[];
  freelancers: EligibleFreelancer[];
  initialFreelancerId: string | null;
  canEdit: boolean;
};

type EditState =
  | { kind: "single"; serviceKey: string }
  | { kind: "all" }
  | null;

export function AssignedToCard({
  services,
  initialSelectedServiceKeys,
  freelancers,
  initialFreelancerId,
  canEdit,
}: Props) {
  // Which services are currently checked on the form. Seeded from the page
  // (so the card paints right on SSR), then kept in sync with the form's
  // checkboxes via the change-listener below.
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    initialSelectedServiceKeys,
  );

  // Per-service freelancer map. Survives un-checks: if you assign Alice to
  // EPC, uncheck EPC, then re-check EPC, Alice is still there. The map only
  // gets reset by an explicit pick, never by a service toggle.
  const [byService, setByService] = useState<Record<string, string>>(() => {
    const seed = initialFreelancerId ?? "";
    const map: Record<string, string> = {};
    for (const k of initialSelectedServiceKeys) map[k] = seed;
    return map;
  });
  const [edit, setEdit] = useState<EditState>(null);

  // Listen to the form's service checkboxes (name="service_<key>") so the
  // card mirrors selections live. Event delegation on `document` keeps the
  // wiring pure-DOM — no shared React tree, no context, no prop drilling
  // from the form. Also re-reads on mount in case anything was toggled
  // before this effect ran.
  useEffect(() => {
    function readDom(): string[] {
      const found: string[] = [];
      document
        .querySelectorAll<HTMLInputElement>(
          'input[type="checkbox"][name^="service_"]',
        )
        .forEach((el) => {
          if (el.checked) found.push(el.name.replace(/^service_/, ""));
        });
      return found;
    }
    const initial = readDom();
    if (initial.length > 0) {
      setSelectedKeys((prev) => {
        if (
          prev.length === initial.length &&
          prev.every((k) => initial.includes(k))
        ) {
          return prev;
        }
        return initial;
      });
    }

    function onChange(e: Event) {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== "checkbox") return;
      if (!target.name.startsWith("service_")) return;
      const key = target.name.replace(/^service_/, "");
      setSelectedKeys((prev) => {
        const has = prev.includes(key);
        if (target.checked && !has) return [...prev, key];
        if (!target.checked && has) return prev.filter((k) => k !== key);
        return prev;
      });
    }
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  // Render only the services currently checked, preserving the catalog order
  // (so EPC/AIV/EK/TK always appear in the same order, regardless of click sequence).
  const visibleServices = services.filter((s) => selectedKeys.includes(s.key));

  function applyOne(serviceKey: string, freelancerId: string) {
    setByService((prev) => ({ ...prev, [serviceKey]: freelancerId }));
    setEdit(null);
  }
  function applyToAll(freelancerId: string) {
    setByService((prev) => {
      const next = { ...prev };
      for (const s of visibleServices) next[s.key] = freelancerId;
      return next;
    });
    setEdit(null);
  }

  // Esc closes any open inline picker.
  useEffect(() => {
    if (!edit) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEdit(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit]);

  const assignedCount = visibleServices.filter((s) => byService[s.key]).length;

  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Assigned to</CardTitle>
          {visibleServices.length > 1 && (
            <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
              {assignedCount} of {visibleServices.length} assigned
            </p>
          )}
        </div>
        {canEdit && visibleServices.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setEdit((e) => (e?.kind === "all" ? null : { kind: "all" }))
            }
            className={
              "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors " +
              (edit?.kind === "all"
                ? "bg-[color-mix(in_srgb,var(--color-brand)_10%,var(--color-bg))] text-[var(--color-brand)]"
                : "text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]")
            }
            title="Apply one freelancer to every service"
          >
            <IconUserSwap size={12} />
            Set all
          </button>
        )}
      </CardHeader>

      <CardBody className="p-0">
        {/* "Set all" inline picker — appears above the rows when active. */}
        {edit?.kind === "all" && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] px-6 py-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
              Set the same freelancer for every service
            </p>
            <FreelancerPicker
              freelancers={freelancers}
              currentId=""
              onPick={(id) => applyToAll(id)}
              onCancel={() => setEdit(null)}
            />
          </div>
        )}

        {visibleServices.length === 0 ? (
          <div className="px-6 py-5 text-sm text-[var(--color-ink-muted)]">
            Pick at least one service in the form — an assignment row will
            appear here for each.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {visibleServices.map((svc) => {
              const fid = byService[svc.key] ?? "";
              const f = freelancers.find((x) => x.id === fid) ?? null;
              const isEditing =
                edit?.kind === "single" && edit.serviceKey === svc.key;
              const RowOuter = canEdit && !isEditing
                ? "button" as const
                : "div" as const;
              return (
                <li
                  key={svc.key}
                  style={{
                    borderLeftWidth: "3px",
                    borderLeftStyle: "solid",
                    borderLeftColor: svc.color,
                  }}
                >
                  {isEditing ? (
                    <div className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-1 inline-flex h-6 shrink-0 items-center justify-center rounded px-2 text-[10px] font-bold tracking-wider text-white"
                          style={{ backgroundColor: svc.color }}
                          title={svc.label}
                        >
                          {svc.short}
                        </span>
                        <div className="min-w-0 flex-1">
                          <FreelancerPicker
                            freelancers={freelancers}
                            currentId={fid}
                            onPick={(id) => applyOne(svc.key, id)}
                            onCancel={() => setEdit(null)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <RowOuter
                      type={RowOuter === "button" ? "button" : undefined}
                      onClick={
                        canEdit
                          ? () =>
                              setEdit({ kind: "single", serviceKey: svc.key })
                          : undefined
                      }
                      className={
                        "group flex w-full items-center gap-3 px-6 py-4 text-left transition-colors " +
                        (canEdit
                          ? "cursor-pointer hover:bg-[var(--color-bg-muted)]"
                          : "")
                      }
                    >
                      <span
                        className="inline-flex h-6 shrink-0 items-center justify-center rounded px-2 text-[10px] font-bold tracking-wider text-white"
                        style={{ backgroundColor: svc.color }}
                        title={svc.label}
                      >
                        {svc.short}
                      </span>
                      {f ? (
                        <>
                          <Avatar
                            initials={initials(f.firstName, f.lastName)}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                              {f.firstName} {f.lastName}
                            </p>
                            <p className="truncate text-xs text-[var(--color-ink-muted)]">
                              {f.region ?? "Inspector"}
                            </p>
                          </div>
                          {canEdit && (
                            <IconUserSwap
                              size={14}
                              className="shrink-0 text-[var(--color-ink-faint)] opacity-0 transition-opacity group-hover:opacity-100"
                            />
                          )}
                        </>
                      ) : (
                        <>
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-ink-faint)]">
                            <UserOutlineIcon />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--color-ink-soft)]">
                              Tap to assign
                            </p>
                          </div>
                          {canEdit && (
                            <IconPlus
                              size={14}
                              className="shrink-0 text-[var(--color-brand)]"
                            />
                          )}
                        </>
                      )}
                    </RowOuter>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Inline freelancer picker — auto-focused search + filtered list, rendered
 * directly into the host (no popover, no portal, nothing to clip). Used by
 * both per-row "Change" / "Assign" and the "Set all" header bar.
 */
function FreelancerPicker({
  freelancers,
  currentId,
  onPick,
  onCancel,
}: {
  freelancers: EligibleFreelancer[];
  currentId: string;
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the search on open.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return freelancers;
    return freelancers.filter((f) => {
      const name = `${f.firstName} ${f.lastName}`.toLowerCase();
      const region = (f.region ?? "").toLowerCase();
      const email = (f.email ?? "").toLowerCase();
      return (
        name.includes(needle) ||
        region.includes(needle) ||
        email.includes(needle)
      );
    });
  }, [q, freelancers]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-[var(--color-ink-muted)]">
            <IconSearch size={14} />
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a name, region, or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] pl-8 pr-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/10"
          />
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
        >
          <IconX size={14} />
        </button>
      </div>

      <ul className="max-h-56 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]">
        <li>
          <button
            type="button"
            onClick={() => onPick("")}
            className={
              "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-muted)] " +
              (currentId === ""
                ? "bg-[color-mix(in_srgb,var(--color-brand)_6%,var(--color-bg))]"
                : "")
            }
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-ink-faint)]">
              <UserOutlineIcon />
            </span>
            <span className="text-[var(--color-ink-soft)]">— Unassigned —</span>
          </button>
        </li>
        {filtered.length === 0 ? (
          <li className="px-3 py-3 text-center text-xs text-[var(--color-ink-muted)]">
            No freelancers match.
          </li>
        ) : (
          filtered.map((f) => {
            const selected = f.id === currentId;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onPick(f.id)}
                  className={
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-muted)] " +
                    (selected
                      ? "bg-[color-mix(in_srgb,var(--color-brand)_6%,var(--color-bg))]"
                      : "")
                  }
                >
                  <Avatar
                    initials={initials(f.firstName, f.lastName)}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--color-ink)]">
                      {f.firstName} {f.lastName}
                    </p>
                    <p className="truncate text-xs text-[var(--color-ink-muted)]">
                      {f.region ?? f.email}
                    </p>
                  </div>
                  {selected && (
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-brand)]">
                      Current
                    </span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function UserOutlineIcon() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
