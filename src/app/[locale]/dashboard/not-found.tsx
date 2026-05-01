import type { Metadata } from "next";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { IconSearch } from "@/components/ui/Icons";

// Dashboard-scoped 404. Next.js wraps this in `src/app/dashboard/layout.tsx`,
// so the sidebar + signed-in chrome stay visible — without this file, hits to
// unknown /dashboard/* routes would fall back to `src/app/not-found.tsx`
// (the marketing shell), making authenticated users feel signed-out.
export const metadata: Metadata = { title: "Not found" };

export default function DashboardNotFound() {
  return (
    <>
      <Topbar
        title="Page not found"
        subtitle="That dashboard route doesn't exist"
      />
      <div className="p-8 max-w-[1100px]">
        <Card>
          <CardBody>
            <EmptyState
              icon={<IconSearch size={22} />}
              title="We couldn't find that page"
              description="The link may be broken, or the page may have moved."
              action={<Button href="/dashboard">Back to dashboard</Button>}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
