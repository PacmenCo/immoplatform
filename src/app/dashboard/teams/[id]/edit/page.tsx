import { notFound } from "next/navigation";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { TeamForm, type TeamFormInitial } from "@/components/dashboard/TeamForm";
import { BrandingCard } from "@/components/dashboard/BrandingCard";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canEditTeam, hasRole } from "@/lib/permissions";
import { updateTeam } from "@/app/actions/teams";
import { teamLogoImageUrl, teamSignatureImageUrl } from "@/lib/teamBranding";
import { listPricelists, listPricelistItems } from "@/lib/odoo";
import { TeamPriceOverrides } from "./TeamPriceOverrides";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (!(await canEditTeam(session, id))) notFound();
  // v1 parity: commission config + per-team price overrides are admin-only
  // (Admin\TeamController is the only writer). Realtor-owners get the form
  // but with those sections suppressed — both hidden on server-render, and
  // server actions also drop/reject them.
  const isAdmin = hasRole(session, "admin");

  // Admin-only Odoo fetches kicked off in parallel with the Prisma reads.
  // Best-effort: if Odoo is unreachable, the picker hides and team edits
  // still save. Items are batched so changing the dropdown selection
  // client-side doesn't trigger a round-trip.
  const [team, services, overrides, odooData] = await Promise.all([
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
    isAdmin
      ? listPricelists()
          .then(async (pl) => ({
            pricelists: pl,
            items: pl.length
              ? await listPricelistItems(pl.map((p) => p.id)).catch(() => [])
              : [],
          }))
          .catch(() => ({ pricelists: [], items: [] }))
      : Promise.resolve({ pricelists: undefined, items: [] }),
  ]);
  if (!team) notFound();

  const pricelists = odooData.pricelists;
  const pricelistItems = odooData.items;

  const initial: TeamFormInitial = team;
  const boundUpdate = updateTeam.bind(null, id);

  const overrideBySvc = new Map(overrides.map((o) => [o.serviceKey, o]));
  const priceRows = services.map((s) => {
    const o = overrideBySvc.get(s.key);
    return {
      key: s.key,
      label: s.label,
      short: s.short,
      color: s.color,
      basePriceCents: s.unitPrice,
      overrideCents: o?.priceCents ?? null,
      odooPricelistId: o?.odooPricelistId ?? null,
    };
  });

  return (
    <>
      <Topbar
        title={`Edit ${team.name}`}
        subtitle="Update agency details, billing info, pricing, and commission config."
      />

      {/* Two-column on lg+: form/services on the left, branding sticky on
          the right. Below lg, BrandingCard renders first (DOM order) so the
          stack reads identity → form → pricing on small screens. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:max-w-[1320px]">
        <aside className="px-8 pt-6 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-4 lg:self-start lg:pt-8 lg:pr-8 lg:pl-0">
          <BrandingCard
            teamId={id}
            teamName={team.name}
            logoUrl={teamLogoImageUrl({ id, logoUrl: team.logoUrl })}
            signatureUrl={teamSignatureImageUrl({ id, signatureUrl: team.signatureUrl })}
          />
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <TeamForm
            action={boundUpdate}
            initial={initial}
            cancelHref={`/dashboard/teams/${id}`}
            isAdmin={isAdmin}
          />

          {isAdmin && (
            <div className="px-8 pb-28 max-w-[960px] space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Services &amp; pricing</CardTitle>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                    Custom pricing per service. Some services bind to an Odoo
                    pricelist; others use a fixed override price (leave blank for
                    the base price). Existing assignments keep their snapshotted
                    price — changes apply to new work only.
                  </p>
                </CardHeader>
                <CardBody className="p-0">
                  <TeamPriceOverrides
                    teamId={id}
                    rows={priceRows}
                    pricelists={pricelists?.map((p) => ({ id: p.id, name: p.name }))}
                    pricelistItems={pricelistItems}
                  />
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
