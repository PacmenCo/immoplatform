import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { IconAlert, IconBuilding, IconMail, IconPhone, IconMapPin, IconWallet } from "@/components/ui/Icons";

export type LegalBillingData = {
  entityType: "sole_trader" | "company";
  legalName: string | null;
  vatNumber: string | null;
  kboNumber: string | null;
  iban: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  billingAddress: string | null;
  billingPostal: string | null;
  billingCity: string | null;
  billingCountry: string | null;
};

/** Mask all but the first and last 4-digit groups of a Belgian IBAN. */
function maskIban(iban: string): string {
  const cleaned = iban.replace(/\s+/g, "").toUpperCase();
  if (cleaned.length < 8) return iban;
  const first = cleaned.slice(0, 4);
  const last = cleaned.slice(-4);
  const middleLen = cleaned.length - 8;
  const middle = "•".repeat(middleLen).match(/.{1,4}/g)?.join(" ") ?? "";
  return `${first} ${middle} ${last}`.replace(/\s+/g, " ").trim();
}

/** A "field is set" check that treats empty strings as missing. */
function present(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function LegalBillingDisplay({
  data,
  editHref,
  canEdit = false,
}: {
  data: LegalBillingData | null;
  /** Link to the edit page when an admin can fill in the missing details. */
  editHref?: string;
  canEdit?: boolean;
}) {
  // Empty state — none of the billing fields are populated.
  const fullyEmpty =
    !data ||
    (!present(data.legalName) &&
      !present(data.vatNumber) &&
      !present(data.kboNumber) &&
      !present(data.iban) &&
      !present(data.billingEmail) &&
      !present(data.billingPhone) &&
      !present(data.billingAddress));

  if (fullyEmpty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Legal &amp; billing</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex items-start gap-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
            <IconAlert
              size={16}
              className="mt-0.5 shrink-0 text-[var(--color-ink-muted)]"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--color-ink)]">
                Billing details incomplete
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                Required before payouts can be issued. Add the inspector&apos;s
                VAT number, IBAN, and billing address.
              </p>
              {canEdit && editHref && (
                <Link
                  href={editHref}
                  className="mt-2 inline-flex items-center text-xs font-medium text-[var(--color-brand)] hover:underline"
                >
                  Add billing details →
                </Link>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Combine VAT/KBO into one line since they're the same digits in BE.
  const vatLine = (() => {
    const vat = present(data.vatNumber) ? data.vatNumber : null;
    const kbo = present(data.kboNumber) ? data.kboNumber : null;
    if (!vat && !kbo) return null;
    if (vat && kbo) return `${vat} · KBO ${kbo}`;
    return vat ?? `KBO ${kbo}`;
  })();

  // Single-line address rollup. Skip pieces that are empty so we don't print
  // ", , Belgium" for half-filled records.
  const addressLine = [data.billingAddress, [data.billingPostal, data.billingCity].filter(present).join(" "), data.billingCountry]
    .filter((p): p is string => present(p))
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle>Legal &amp; billing</CardTitle>
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
              (data.entityType === "company"
                ? "bg-[color-mix(in_srgb,var(--color-brand)_10%,var(--color-bg))] text-[var(--color-brand)]"
                : "bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]")
            }
          >
            {data.entityType === "company" ? "Company" : "Sole trader"}
          </span>
        </div>
      </CardHeader>
      <CardBody>
        <dl className="divide-y divide-[var(--color-border)] text-sm">
          {present(data.legalName) && (
            <Row icon={<IconBuilding size={14} />} label="Legal name" value={data.legalName} />
          )}
          {vatLine && (
            <Row icon={<IconWallet size={14} />} label="VAT / KBO" value={vatLine} mono />
          )}
          {present(data.iban) && (
            <Row icon={<IconWallet size={14} />} label="IBAN" value={maskIban(data.iban)} mono />
          )}
          {present(data.billingEmail) && (
            <Row
              icon={<IconMail size={14} />}
              label="Billing email"
              value={
                <a
                  href={`mailto:${data.billingEmail}`}
                  className="hover:text-[var(--color-ink)] hover:underline"
                >
                  {data.billingEmail}
                </a>
              }
            />
          )}
          {present(data.billingPhone) && (
            <Row
              icon={<IconPhone size={14} />}
              label="Billing phone"
              value={
                <a
                  href={`tel:${data.billingPhone}`}
                  className="hover:text-[var(--color-ink)] hover:underline"
                >
                  {data.billingPhone}
                </a>
              }
            />
          )}
          {addressLine && (
            <Row icon={<IconMapPin size={14} />} label="Billing address" value={addressLine} />
          )}
        </dl>
      </CardBody>
    </Card>
  );
}

function Row({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
        <span className="text-[var(--color-ink-faint)]">{icon}</span>
        {label}
      </dt>
      <dd
        className={
          "text-[var(--color-ink-soft)] " +
          (mono ? "font-mono tabular-nums" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}
