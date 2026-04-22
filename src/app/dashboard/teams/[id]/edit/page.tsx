import { notFound } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { TeamForm, type TeamFormInitial } from "@/components/dashboard/TeamForm";
import { BrandingCard } from "@/components/dashboard/BrandingCard";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canEditTeam } from "@/lib/permissions";
import { updateTeam } from "@/app/actions/teams";
import { teamLogoImageUrl, teamSignatureImageUrl } from "@/lib/teamBranding";
import { TeamPriceOverrides } from "./TeamPriceOverrides";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (!(await canEditTeam(session, id))) notFound();

  const [team, services, overrides] = await Promise.all([
    prisma.team.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        city: true,
        email: true,
        description: true,
        logo: true,
        logoColor: true,
        legalName: true,
        vatNumber: true,
        kboNumber: true,
        iban: true,
        billingEmail: true,
        billingPhone: true,
        billingAddress: true,
        billingPostal: true,
        billingCity: true,
        billingCountry: true,
        defaultClientType: true,
        prefersLogoOnPhotos: true,
        logoUrl: true,
        signatureUrl: true,
        commissionType: true,
        commissionValue: true,
      },
    }),
    prisma.service.findMany({
      where: { active: true },
      orderBy: { key: "asc" },
      select: { key: true, label: true, short: true, color: true, unitPrice: true },
    }),
    prisma.teamServiceOverride.findMany({ where: { teamId: id } }),
  ]);
  if (!team) notFound();

  const initial: TeamFormInitial = team;
  const boundUpdate = updateTeam.bind(null, id);

  const overrideBySvc = new Map(overrides.map((o) => [o.serviceKey, o.priceCents]));
  const priceRows = services.map((s) => ({
    key: s.key,
    label: s.label,
    short: s.short,
    color: s.color,
    basePriceCents: s.unitPrice,
    overrideCents: overrideBySvc.get(s.key) ?? null,
  }));

  return (
    <>
      <Topbar
        title={`Edit ${team.name}`}
        subtitle="Update agency details, billing info, pricing, and commission config."
      />
      <TeamForm
        action={boundUpdate}
        initial={initial}
        cancelHref={`/dashboard/teams/${id}`}
      />

      <div className="px-8 max-w-[960px]">
        <BrandingCard
          teamId={id}
          teamName={team.name}
          logoUrl={teamLogoImageUrl({ id, logoUrl: team.logoUrl })}
          signatureUrl={teamSignatureImageUrl({ id, signatureUrl: team.signatureUrl })}
        />
      </div>

      <div className="px-8 pb-28 max-w-[960px] space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Services &amp; pricing</CardTitle>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Set a per-team override to charge this agency a different price for
              a service. Leave blank to use the base price. Existing assignments
              keep their snapshotted price — changes here apply to new work only.
            </p>
          </CardHeader>
          <CardBody className="p-0">
            <TeamPriceOverrides teamId={id} rows={priceRows} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
