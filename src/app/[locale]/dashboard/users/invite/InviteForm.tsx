"use client";

import { Link } from "@/i18n/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { Button } from "@/components/ui/Button";
import { IconMail, IconBuilding, IconShield } from "@/components/ui/Icons";
import { createInvite } from "@/app/actions/invites";
import { useUnsavedChanges } from "@/components/dashboard/UnsavedChangesProvider";
import { useFormDirty } from "@/lib/useFormDirty";
import { useTranslateError } from "@/i18n/error";
import type { ActionResult } from "@/app/actions/_types";
import type { Role } from "@/lib/permissions.types";
import { BrandName } from "@/components/BrandName";
import { LegalBillingFields } from "@/components/dashboard/LegalBillingFields";

type RoleOption = {
  value: Role;
  label: string;
  description: string;
};

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
  const t = useTranslations("dashboard.users.invite");
  const tRoles = useTranslations("dashboard.users.invite.roleCard.roles");
  const tTeamRoles = useTranslations("dashboard.users.invite.teamCard.teamRoles");
  const tErr = useTranslateError();

  const ALL_ROLE_OPTIONS: RoleOption[] = [
    { value: "realtor", label: tRoles("realtor.label"), description: tRoles("realtor.description") },
    { value: "freelancer", label: tRoles("freelancer.label"), description: tRoles("freelancer.description") },
    { value: "staff", label: tRoles("staff.label"), description: tRoles("staff.description") },
    { value: "admin", label: tRoles("admin.label"), description: tRoles("admin.description") },
  ];

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
            {t("breadcrumbUsers")}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[var(--color-ink-soft)]">{t("breadcrumbInvite")}</span>
        </nav>

        {state && !state.ok && (
          <p
            role="alert"
            className="mb-6 rounded-md border border-[var(--color-asbestos)]/30 bg-[color-mix(in_srgb,var(--color-asbestos)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-asbestos)]"
          >
            {tErr(state.error)}
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
              <CardTitle>{t("whoCard.title")}</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                {t("whoCard.description")}
              </p>
            </CardHeader>
            <CardBody className="space-y-5">
              <Field label={t("whoCard.emailLabel")} id="invite-email" required>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder={t("whoCard.emailPlaceholder")}
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field
                label={t("whoCard.noteLabel")}
                id="invite-note"
                hint={t("whoCard.noteHint")}
              >
                <Input
                  id="invite-note"
                  name="note"
                  placeholder={t("whoCard.notePlaceholder")}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {t("roleCard.title")}
                <span aria-hidden className="ml-0.5 text-[var(--color-asbestos)]">*</span>
              </CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                {t("roleCard.description")}
              </p>
            </CardHeader>
            <CardBody>
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("roleCard.title")}>
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
                <CardTitle>{teamLocked ? t("teamCard.title") : t("teamCard.titleOptional")}</CardTitle>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                  {teamLocked
                    ? selectedTeam?.name
                      ? t("teamCard.descriptionLocked", { teamName: selectedTeam.name })
                      : t("teamCard.descriptionLockedFallback")
                    : role === "realtor"
                      ? t("teamCard.descriptionRealtor")
                      : t("teamCard.descriptionFreelancer")}
                </p>
              </CardHeader>
              <CardBody className="space-y-5">
                <SearchSelect
                  id="invite-team"
                  label={t("teamCard.teamFieldLabel")}
                  labelIcon={<IconBuilding size={14} />}
                  value={teamId}
                  onChange={setTeamId}
                  placeholder={t("teamCard.teamPlaceholder")}
                  searchPlaceholder={t("teamCard.teamSearchPlaceholder")}
                  clearOptionLabel={t("teamCard.noTeamOption")}
                  disabled={teamLocked}
                  options={teams.map((tm) => ({
                    value: tm.id,
                    label: tm.name,
                    sublabel: tm.city ?? undefined,
                  }))}
                />

                {teamId && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">
                      {t("teamCard.teamRoleHeading")}
                    </p>
                    <div
                      className="grid gap-3 sm:grid-cols-2"
                      role="radiogroup"
                      aria-label={t("teamCard.teamRoleHeading")}
                    >
                      <TeamRoleOption
                        value="member"
                        label={tTeamRoles("member.label")}
                        description={tTeamRoles("member.description")}
                        checked={teamRole === "member"}
                        onChange={setTeamRole}
                        takenLabel={t("teamCard.ownerTakenLabel")}
                      />
                      <TeamRoleOption
                        value="owner"
                        label={tTeamRoles("owner.label")}
                        description={tTeamRoles("owner.description")}
                        checked={teamRole === "owner"}
                        onChange={setTeamRole}
                        disabled={teamHasOwner}
                        disabledReason={
                          teamHasOwner && selectedTeam?.ownerName
                            ? t("teamCard.ownerTakenReason", { ownerName: selectedTeam.ownerName })
                            : undefined
                        }
                        takenLabel={t("teamCard.ownerTakenLabel")}
                      />
                    </div>

                    {teamHasOwner && selectedTeam?.ownerName && (
                      <p className="mt-3 inline-flex items-start gap-2 text-xs text-[var(--color-ink-muted)]">
                        <IconShield
                          size={12}
                          className="mt-0.5 shrink-0 text-[var(--color-ink-muted)]"
                        />
                        <span>
                          {t("teamCard.ownerTakenExplain", {
                            ownerName: selectedTeam.ownerName,
                            teamName: selectedTeam.name,
                          })}
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
                <span aria-hidden className="text-[var(--color-asbestos)]">*</span> {t("footer.requiredHint")}
              </p>
              <div className="flex items-center gap-2">
                <Button href="/dashboard/users" variant="ghost" size="md">
                  {t("footer.cancel")}
                </Button>
                <Button type="submit" size="md" loading={pending}>
                  <IconMail size={14} />
                  {t("footer.submit")}
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
            <CardTitle>{t("preview.title")}</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {t("preview.description")}
            </p>
          </CardHeader>
          <CardBody>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 text-sm">
              <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                <IconMail size={14} />
                <span className="truncate">
                  {t("preview.to")}{" "}
                  {email || <em className="text-[var(--color-ink-faint)]">{t("preview.toFallback")}</em>}
                </span>
              </div>
              <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                <span>{t("preview.from")} <BrandName /> &lt;no-reply@immoplatform.be&gt;</span>
              </div>
              <p className="font-semibold text-[var(--color-ink)]">
                {t.rich("preview.subject", { brand: () => <BrandName /> })}
              </p>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                {selectedTeamForPreview
                  ? t.rich("preview.bodyWithTeam", {
                      brand: () => <BrandName />,
                      strong: (chunks) => <strong>{chunks}</strong>,
                      role: selectedRole?.label ?? "",
                      team: selectedTeamForPreview.name,
                      teamRole,
                    })
                  : t.rich("preview.bodyWithoutTeam", {
                      brand: () => <BrandName />,
                      strong: (chunks) => <strong>{chunks}</strong>,
                      role: selectedRole?.label ?? "",
                    })}
              </p>
              {note && (
                <p className="mt-3 rounded border-l-2 border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 italic text-[var(--color-ink-soft)]">
                  &ldquo;{note}&rdquo;
                </p>
              )}
              <div className="mt-4 inline-block rounded-md bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-[var(--color-on-brand)]">
                {t("preview.cta")}
              </div>
              <p className="mt-4 text-xs text-[var(--color-ink-muted)]">
                {t("preview.expiry")}
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
  takenLabel,
}: {
  value: "member" | "owner";
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: "member" | "owner") => void;
  disabled?: boolean;
  disabledReason?: string;
  takenLabel: string;
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
              {takenLabel}
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
