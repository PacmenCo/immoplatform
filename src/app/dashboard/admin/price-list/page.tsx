import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ServicePill } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { IconCheck, IconPlus } from "@/components/ui/Icons";
import { SERVICES } from "@/lib/mockData";

const ROWS = [
  {
    id: "p_1",
    service: "epc" as const,
    name: "Energy Performance Certificate — residential",
    description: "Energy performance inspection + certificate for a single residential unit.",
    unit: 165,
    odoo: "product_epc_residential",
    active: true,
  },
  {
    id: "p_2",
    service: "asbestos" as const,
    name: "Asbestos Inventory Attest — standard",
    description: "Mandatory inspection for buildings built before 2001, single parcel.",
    unit: 245,
    odoo: "product_asb_standard",
    active: true,
  },
  {
    id: "p_3",
    service: "electrical" as const,
    name: "Electrical Inspection — AREI",
    description: "Legally required electrical installation inspection, residential.",
    unit: 195,
    odoo: "product_elec_arei",
    active: true,
  },
  {
    id: "p_4",
    service: "fuel" as const,
    name: "Fuel Tank Check — above ground",
    description: "Periodic inspection for above-ground domestic fuel tanks.",
    unit: 135,
    odoo: "product_fuel_above",
    active: true,
  },
  {
    id: "p_5",
    service: "fuel" as const,
    name: "Fuel Tank Check — buried",
    description: "Inspection of buried tanks, includes leak detection.",
    unit: 215,
    odoo: "product_fuel_buried",
    active: false,
  },
];

const ODOO_PRODUCTS = [
  "product_epc_residential",
  "product_asb_standard",
  "product_elec_arei",
  "product_fuel_above",
  "product_fuel_buried",
  "product_combo_pack",
];

export default function PriceListPage() {
  return (
    <>
      <Topbar title="Price list" subtitle="Master service catalog and Odoo mapping" />

      <div className="p-8 max-w-[1400px] space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--color-ink-muted)]">Changes apply platform-wide unless a team has an override.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">Discard</Button>
            <Button size="sm"><IconCheck size={14} />Save changes</Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Service items</CardTitle>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{ROWS.length} items · {ROWS.filter(r => r.active).length} active</p>
            </div>
            <Button size="sm"><IconPlus size={14} />Add row</Button>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-alt)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Service</th>
                  <th className="px-6 py-3 text-left font-medium">Name / description</th>
                  <th className="px-6 py-3 text-left font-medium">Unit price</th>
                  <th className="px-6 py-3 text-left font-medium">Odoo product</th>
                  <th className="px-6 py-3 text-left font-medium">Active</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => {
                  const s = SERVICES[r.service];
                  return (
                    <tr key={r.id} className="border-t border-[var(--color-border)] align-top">
                      <td className="px-6 py-4">
                        <ServicePill color={s.color} label={s.short} />
                      </td>
                      <td className="px-6 py-4 min-w-[260px]">
                        <Input defaultValue={r.name} className="mb-2" />
                        <Textarea rows={2} defaultValue={r.description} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-[var(--color-ink-muted)] text-sm">€</span>
                          <Input type="number" defaultValue={r.unit} className="h-9 max-w-[120px]" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Select defaultValue={r.odoo} className="max-w-[240px]">
                          {ODOO_PRODUCTS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-6 py-4">
                        <label className="inline-block">
                          <span className="relative inline-block h-6 w-11 rounded-full bg-[var(--color-border-strong)]">
                            <input type="checkbox" defaultChecked={r.active} className="peer sr-only" />
                            <span className="absolute inset-0 rounded-full bg-[var(--color-border-strong)] peer-checked:bg-[var(--color-brand)] transition-colors" />
                            <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[var(--color-bg)] shadow-sm peer-checked:translate-x-5 transition-transform" />
                          </span>
                        </label>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm">Delete</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
