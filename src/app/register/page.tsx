import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your agency account."
      subtitle="Takes under 2 minutes. First assignment is on us."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--color-ink)] hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" id="first">
            <Input id="first" autoComplete="given-name" />
          </Field>
          <Field label="Last name" id="last">
            <Input id="last" autoComplete="family-name" />
          </Field>
        </div>
        <Field label="Agency name" id="agency">
          <Input id="agency" placeholder="Vastgoed Antwerp" />
        </Field>
        <Field label="Work email" id="email">
          <Input id="email" type="email" autoComplete="email" placeholder="you@agency.be" />
        </Field>
        <Field label="Password" id="password" hint="At least 10 characters.">
          <Input id="password" type="password" autoComplete="new-password" />
        </Field>
        <Field label="Region" id="region">
          <Select id="region" defaultValue="flanders">
            <option value="flanders">Flanders</option>
            <option value="brussels">Brussels</option>
            <option value="wallonia">Wallonia</option>
          </Select>
        </Field>

        <label className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
          <span>
            I agree to the{" "}
            <Link href="/legal/terms" className="underline">Terms</Link> and{" "}
            <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
