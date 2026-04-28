import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconMail } from "@/components/ui/Icons";
import { ContactSubmissionRow } from "./ContactSubmissionRow";

export const metadata = { title: "Contact messages" };

export default async function ContactMessagesPage() {
  const session = await requireSession();
  if (!hasRole(session, "admin")) {
    redirect("/no-access?section=admin");
  }

  // Newest first; cap at 200 for now (volume should be low; revisit when
  // there's a real Inbox-style filter UI).
  const submissions = await prisma.contactSubmission.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      handledBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  const unhandledCount = submissions.filter((s) => s.handledAt === null).length;

  return (
    <>
      <Topbar
        title="Contact messages"
        subtitle={
          submissions.length === 0
            ? "Visitor submissions from the public /contact form will land here."
            : `${submissions.length} total · ${unhandledCount} awaiting reply`
        }
      />

      <div className="p-8 max-w-[1200px] space-y-6">
        {submissions.length === 0 ? (
          <Card className="p-12">
            <EmptyState
              title="No messages yet"
              description="When someone submits the contact form on immoplatform.be, the message will show up here."
              icon={<IconMail size={32} className="text-[var(--color-ink-muted)]" />}
            />
          </Card>
        ) : (
          <ul className="space-y-4">
            {submissions.map((s) => (
              <li key={s.id}>
                <ContactSubmissionRow
                  submission={{
                    id: s.id,
                    createdAt: s.createdAt.toISOString(),
                    name: s.name,
                    email: s.email,
                    phone: s.phone,
                    subject: s.subject,
                    message: s.message,
                    ipAddress: s.ipAddress,
                    handledAt: s.handledAt ? s.handledAt.toISOString() : null,
                    handledByName: s.handledBy
                      ? `${s.handledBy.firstName} ${s.handledBy.lastName}`
                      : null,
                    notes: s.notes,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
