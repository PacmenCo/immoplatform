"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { Button } from "@/components/ui/Button";
import { IconMail, IconBuilding, IconShield } from "@/components/ui/Icons";
import { createInvite } from "@/app/actions/invites";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import type { ActionResult } from "@/app/actions/_types";
import type { Role } from "@/lib/permissions.types";
import { BrandName } from "@/components/BrandName";
import { LegalBillingFields } from "@/components/dashboard/LegalBillingFields";

type RoleOption = {
  value: Role;
  label: string;
  description: string;
};

const ALL_ROLE_OPTIONS: RoleOption[] = [
  {
    value: "realtor",
    label: "Realtor",
    description: "Creates assignments, tracks their agency's work, invites teammates.",
  },
  {
    value: "freelancer",
    label: "Freelancer",
    description: "Certified inspector — accepts assignments and uploads deliverables.",
  },
  {
    value: "staff",
    label: "Staff",
    description: "immoplatform support — can view all teams and help users.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Full platform access — billing, price lists, user management.",
  },
];

export function InviteForm({
  teams,
  viewerRole,
  initialTeamId,
}: {
  teams: Array<{ id: string; name: string; city: string | null; ownerName: string | null }>;
  viewerRole: Role;
  /** Pre-selected team from ?teamId= on the invite page — click-from-team-detail carries over. */
  initialTeamId?: string | null;
}) {
  // v1 parity: realtors can only invite realtor/freelancer (they can't
  // escalate someone to admin/staff via their own-team invite flow).
  // Server-side gate in src/app/actions/invites.ts catches escalation too.
  const roleOptions =
    viewerRole === "realtor"
      ? ALL_ROLE_OPTIONS.filter((r) => r.value === "realtor" || r.value === "freelancer")
      : ALL_ROLE_OPTIONS;

  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    createInvite,
    undefined,
  );
  const [role, setRole] = useState<Role>("realtor");
  // Only honor the query-param seed if that team is in the viewer's allowed
  // list (realtors can't be handed a teamId they don't own via URL).
  const seedTeamId =
    initialTeamId && teams.some((t) => t.id === initialTeamId) ? initialTeamId : "";
  // When the invite was launched from a team page (?teamId=…), the team is
  // locked — the user explicitly chose this team by being there. Otherwise
  // the picker is free.
  const teamLocked = !!seedTeamId;
  const [teamId, setTeamId] = useState<string>(seedTeamId);
  const [teamRole, setTeamRole] = useState<"owner" | "member">("member");
  const [email, setEmail] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const showTeam = role === "realtor" || role === "freelancer";

  const selectedTeam = teams.find((t) => t.id === teamId) ?? null;
  const teamHasOwner = !!selectedTeam?.ownerName;

  // Force-downgrade to member when picked team already has an owner.
  useEffect(() => {
    if (teamHasOwner && teamRole === "owner") {
      setTeamRole("member");
    }
  }, [teamHasOwner, teamRole]);

  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedChanges(useFormDirty(formRef));

  const selectedRole = roleOptions.find((r) => r.value === role);
  const selectedTeamForPreview = teamId ? teams.find((t) => t.id === teamId) ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:max-w-[1280px]">
      <div>
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]"
        >
          <Link href="/dashboard/users" className="hover:text-[var(--color-ink)]">
            Users
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">Invite</span>
        </nav>

        {state && !state.ok && (
          <p
            role="alert"
            className="mb-6 rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
          >
            {state.error}
          </p>
        )}

        <form ref={formRef} action={formAction}>
          {/* Hidden fields the server action reads */}
          <input type="hidden" name="role" value={role} />
          {showTeam && <input type="hidden" name="teamId" value={teamId} />}
          {showTeam && teamId && <input type="hidden" name="teamRole" value={teamRole} />}

          <div className="space-y-6">
            <Card>
            <CardHeader>
              <CardTitle>Who are you inviting?</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                We&apos;ll email them a secure link to create their account.
              </p>
            </CardHeader>
            <CardBody className="space-y-5">
              <Field label="Work email" id="invite-email" required>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder="colleague@agency.be"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field
                label="Optional note"
                id="invite-note"
                hint="Shown on the accept-invite page. Nice for context."
              >
                <Input
                  id="invite-note"
                  name="note"
                  placeholder="Hi Lucas — welcome to our immoplatform workspace."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Role
                <span aria-hidden className="ml-0.5 text-[var(--color-asbestos)]">*</span>
              </CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                Determines what they can see and do on the platform.
              </p>
            </CardHeader>
            <CardBody>
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Role">
                {roleOptions.map((r) => (
                  <label
                    key={r.value}
                    className={
                      "relative flex cursor-pointer flex-col gap-1.5 rounded-[var(--radius-md)] border bg-[var(--color-bg)] p-4 transition-all " +
                      (role === r.value
                        ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/10 bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
                        : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]")
                    }
                  >
                    <input
                      type="radio"
                      name="role_visual"
                      value={r.value}
                      checked={role === r.value}
                      onChange={() => setRole(r.value)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[var(--color-ink)]">
                        {r.label}
                      </span>
                      <span
                        aria-hidden
                        className={
                          "grid h-4 w-4 place-items-center rounded-full border-2 " +
                          (role === r.value
                            ? "border-[var(--color-brand)]"
                            : "border-[var(--color-border-strong)]")
                        }
                      >
                        {role === r.value && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
                        )}
                      </span>
                    </span>
                    <span className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
                      {r.description}
                    </span>
                  </label>
                ))}
              </div>
            </CardBody>
          </Card>

          {role === "freelancer" && (
            <LegalBillingFields defaultEmail={email} />
          )}

          {showTeam && (
            <Card>
              <CardHeader>
                <CardTitle>{teamLocked ? "Team" : "Team (optional)"}</CardTitle>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                  {teamLocked
                    ? `Inviting into ${selectedTeam?.name ?? "this team"}. Open the invite from the Users page if you need to pick a different team.`
                    : role === "realtor"
                    ? "Attach this realtor to an agency team."
                    : "Attach this freelancer to a team they regularly work with."}
                </p>
              </CardHeader>
              <CardBody className="space-y-5">
                <SearchSelect
                  id="invite-team"
                  label="Team / office"
                  labelIcon={<IconBuilding size={14} />}
                  value={teamId}
                  onChange={setTeamId}
                  placeholder="Search a team…"
                  searchPlaceholder="Type a team name or city…"
                  clearOptionLabel="No team (optional)"
                  disabled={teamLocked}
                  options={teams.map((t) => ({
                    value: t.id,
                    label: t.name,
                    sublabel: t.city ?? undefined,
                  }))}
                />

                {teamId && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">
                      Team role
                    </p>
                    <div
                      className="grid gap-3 sm:grid-cols-2"
                      role="radiogroup"
                      aria-label="Team role"
                    >
                      <TeamRoleOption
                        value="member"
                        label="Member"
                        description="Can create and see assignments for the team."
                        checked={teamRole === "member"}
                        onChange={setTeamRole}
                      />
                      <TeamRoleOption
                        value="owner"
                        label="Owner"
                        description="Member + can invite, edit team settings & remove others."
                        checked={teamRole === "owner"}
                        onChange={setTeamRole}
                        disabled={teamHasOwner}
                        disabledReason={
                          teamHasOwner && selectedTeam
                            ? `${selectedTeam.ownerName} already owns this team`
                            : undefined
                        }
                      />
                    </div>

                    {teamHasOwner && selectedTeam && (
                      <p className="mt-3 inline-flex items-start gap-2 text-xs text-[var(--color-ink-muted)]">
                        <IconShield
                          size={12}
                          className="mt-0.5 shrink-0 text-[var(--color-ink-muted)]"
                        />
                        <span>
                          <strong className="font-medium text-[var(--color-ink)]">
                            {selectedTeam.ownerName}
                          </strong>{" "}
                          already owns{" "}
                          <strong className="font-medium text-[var(--color-ink)]">
                            {selectedTeam.name}
                          </strong>
                          . New invites can only join as members. To change the
                          owner, transfer ownership first from the team settings.
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          </div>

          <div className="sticky bottom-0 z-30 mt-6 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 py-4">
              <p className="text-xs text-[var(--color-ink-muted)]">
                <span aria-hidden className="text-[var(--color-asbestos)]">*</span> Required
              </p>
              <div className="flex items-center gap-2">
                <Button href="/dashboard/users" variant="ghost" size="md">
                  Cancel
                </Button>
                <Button type="submit" size="md" loading={pending}>
                  <IconMail size={14} />
                  Send invite
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Live email preview — sticks with the viewport so the user can watch
          it update as they fill in the form. Stacks below on narrow screens. */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Preview email</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              This is what they&apos;ll receive.
            </p>
          </CardHeader>
          <CardBody>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 text-sm">
              <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                <IconMail size={14} />
                <span className="truncate">
                  To: {email || <em className="text-[var(--color-ink-faint)]">colleague@agency.be</em>}
                </span>
              </div>
              <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                <span>From: <BrandName /> &lt;no-reply@immoplatform.be&gt;</span>
              </div>
              <p className="font-semibold text-[var(--color-ink)]">
                You&apos;re invited to join <BrandName />
              </p>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                You&apos;ve been invited to join <BrandName /> as a{" "}
                <strong>{selectedRole?.label}</strong>
                {selectedTeamForPreview ? (
                  <>
                    {" "}on team{" "}
                    <strong>{selectedTeamForPreview.name}</strong>
                    {" "}({teamRole}).
                  </>
                ) : (
                  "."
                )}
              </p>
              {note && (
                <p className="mt-3 rounded border-l-2 border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 italic text-[var(--color-ink-soft)]">
                  &ldquo;{note}&rdquo;
                </p>
              )}
              <div className="mt-4 inline-block rounded-md bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-[var(--color-on-brand)]">
                Accept invitation →
              </div>
              <p className="mt-4 text-xs text-[var(--color-ink-muted)]">
                This link expires in 7 days.
              </p>
            </div>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

function TeamRoleOption({
  value,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  disabledReason,
}: {
  value: "member" | "owner";
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: "member" | "owner") => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <label
      aria-disabled={disabled || undefined}
      title={disabled ? disabledReason : undefined}
      className={
        "relative flex items-start gap-3 rounded-md border bg-[var(--color-bg)] p-3 transition-all " +
        (disabled
          ? "cursor-not-allowed border-[var(--color-border)] opacity-60"
          : "cursor-pointer " +
            (checked
              ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/10 bg-[color-mix(in_srgb,var(--color-brand)_3%,var(--color-bg))]"
              : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"))
      }
    >
      <input
        type="radio"
        name="teamRole_visual"
        value={value}
        checked={checked}
        onChange={() => !disabled && onChange(value)}
        disabled={disabled}
        className="sr-only"
      />
      <span
        aria-hidden
        className={
          "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 " +
          (checked && !disabled
            ? "border-[var(--color-brand)]"
            : "border-[var(--color-border-strong)]")
        }
      >
        {checked && !disabled && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
        )}
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-ink)]">
            {label}
          </span>
          {disabled && (
            <span className="rounded-full bg-[var(--color-bg-muted)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
              Taken
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--color-ink-soft)]">
          {disabled && disabledReason ? disabledReason : description}
        </span>
      </span>
    </label>
  );
}
