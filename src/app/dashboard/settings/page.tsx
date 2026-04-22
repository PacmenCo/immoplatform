import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { IconAlert } from "@/components/ui/Icons";
import { requireSession } from "@/lib/auth";
import { avatarImageUrl } from "@/lib/avatar";
import { initials, fullName } from "@/lib/format";
import { SettingsNav } from "./_nav";
import { ProfileForm, type ProfileFormInitial } from "./ProfileForm";
import { DeleteAccountButton } from "./DeleteAccountButton";

export default async function SettingsPage() {
  const session = await requireSession();
  const u = session.user;
  const initial: ProfileFormInitial = {
    email: u.email,
    emailVerified: !!u.emailVerifiedAt,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    region: u.region,
    bio: u.bio,
    avatarInitials: initials(u.firstName, u.lastName),
    avatarAlt: fullName(u),
    avatarUrl: avatarImageUrl(u),
  };

  return (
    <>
      <Topbar title="Settings" subtitle="Personal account settings" />

      <div className="p-8 max-w-[1000px]">
        <SettingsNav />

        <div className="mt-6 space-y-6">
          <div className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-bg)] text-[var(--color-ink-muted)]">
              i
            </span>
            <div>
              <p className="font-medium text-[var(--color-ink)]">
                Personal settings
              </p>
              <p className="mt-0.5 text-[var(--color-ink-soft)]">
                These apply only to your account.
              </p>
            </div>
          </div>

          <ProfileForm initial={initial} />

          <Card className="border-[var(--color-asbestos)]/40">
            <CardHeader className="border-[var(--color-asbestos)]/40">
              <div className="flex items-center gap-2">
                <IconAlert
                  size={16}
                  className="text-[var(--color-asbestos)]"
                />
                <CardTitle className="text-[var(--color-asbestos)]">
                  Danger zone
                </CardTitle>
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Actions here can&apos;t be undone. Tread carefully.
              </p>
            </CardHeader>
            <CardBody className="divide-y divide-[var(--color-border)] p-0">
              <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">Delete account</p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    Permanently remove your account and personal data. This cannot be
                    reversed. We&apos;ll ask for your password to confirm.
                  </p>
                </div>
                <DeleteAccountButton />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
