import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { formatUserAgent } from "@/lib/userAgent";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { RevokeSessionButton, SignOutAllButton } from "./SessionRowActions";

function relativeTime(from: Date, now: Date): string {
  const diffMs = now.getTime() - from.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "Active now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon} month${mon === 1 ? "" : "s"} ago`;
  return `${Math.floor(mon / 12)} year${Math.floor(mon / 12) === 1 ? "" : "s"} ago`;
}

export default async function SecuritySettingsPage() {
  const session = await requireSession();

  const sessions = await prisma.session.findMany({
    where: {
      userId: session.user.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      userAgent: true,
      ip: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  const now = new Date();
  const otherCount = sessions.filter((s) => s.id !== session.id).length;

  return (
    <>
      <Topbar title="Security" subtitle="Password, 2FA and active sessions" />

      <div className="p-8 max-w-[960px] space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Use at least 8 characters including a letter and a number. Other
              devices will be signed out when you save.
            </p>
          </CardHeader>
          <CardBody>
            <PasswordChangeForm />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Two-factor authentication</CardTitle>
              <Badge>Not enabled</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Protect your account with an additional step at sign-in.
            </p>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">
                  Authenticator app
                </p>
                <p className="text-sm text-[var(--color-ink-soft)]">
                  Scan a QR code with Google Authenticator, 1Password or similar.
                </p>
              </div>
              <Button variant="secondary" size="md" disabled title="Coming soon">
                Set up 2FA
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active sessions</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Devices currently signed in to your account.
            </p>
          </CardHeader>
          <CardBody className="p-0">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                No active sessions.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {sessions.map((s) => {
                  const ua = formatUserAgent(s.userAgent);
                  const isCurrent = s.id === session.id;
                  return (
                    <li
                      key={s.id}
                      className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-[var(--color-ink)]">
                            {ua.label}
                          </p>
                          {isCurrent && (
                            <Badge
                              bg="color-mix(in srgb, var(--color-epc) 14%, var(--color-bg))"
                              fg="var(--color-epc)"
                            >
                              This device
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                          {s.ip ?? "IP unknown"} · {relativeTime(s.lastSeenAt, now)}
                        </p>
                      </div>
                      {isCurrent ? (
                        <span className="text-xs text-[var(--color-ink-muted)]">—</span>
                      ) : (
                        <RevokeSessionButton sessionId={s.id} device={ua.label} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[var(--color-asbestos)]">Sign out everywhere</CardTitle>
          </CardHeader>
          <CardBody className="flex items-center justify-between gap-4">
            <p className="text-sm text-[var(--color-ink-soft)]">
              Revoke every session except this one.
              {otherCount > 0 && (
                <> Currently <strong>{otherCount}</strong> other session{otherCount === 1 ? "" : "s"} active.</>
              )}
            </p>
            <SignOutAllButton hasOthers={otherCount > 0} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
