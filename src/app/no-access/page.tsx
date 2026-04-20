import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconShield, IconArrowRight } from "@/components/ui/Icons";

const MESSAGES: Record<string, { title: string; body: string }> = {
  users: {
    title: "Team administration is managed by Immo.",
    body:
      "The global users list is only available to platform admins and support staff. To add or remove teammates for your agency, use the Members tab on your team's detail page, or email us at support@immo.app.",
  },
  commissions: {
    title: "Commission management is admin-only.",
    body:
      "The org-wide commission dashboard is available to platform admins. You can still see your own team's commission configuration on your team's detail page.",
  },
  revenue: {
    title: "Platform revenue reports are admin-only.",
    body:
      "Org-wide revenue breakdowns are restricted to admin and staff. Your own team's delivered work shows on your team detail page.",
  },
  announcements: {
    title: "Announcements are managed by Immo.",
    body:
      "Only admins can create platform-wide announcements. You'll see any active ones in the dashboard automatically.",
  },
  admin: {
    title: "Admin tools are restricted.",
    body:
      "The admin console is only available to platform admins and support staff.",
  },
};

const DEFAULT = {
  title: "This section isn't available to your role.",
  body:
    "If you think that's wrong, reach out to your agency owner or email us at support@immo.app.",
};

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const copy =
    (section ? MESSAGES[section as keyof typeof MESSAGES] : undefined) ??
    DEFAULT;

  return (
    <>
      <Topbar title="Not available" subtitle="Access is restricted" />
      <div className="p-8 max-w-[720px]">
        <Card>
          <CardBody className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[color-mix(in_srgb,var(--color-asbestos)_10%,var(--color-bg))] text-[var(--color-asbestos)]">
              <IconShield size={20} />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">
                {copy.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                {copy.body}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button href="/dashboard" size="sm">
                  Return to dashboard
                  <IconArrowRight size={12} />
                </Button>
                <Link
                  href="mailto:support@immo.app"
                  className="text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:underline"
                >
                  Contact support
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
