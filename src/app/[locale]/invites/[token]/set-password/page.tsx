import { notFound } from "next/navigation";
import { getInviteByToken } from "@/app/actions/invites";
import { getSession } from "@/lib/auth";
import { SetPasswordForm } from "./SetPasswordForm";
import { AlreadySignedIn } from "../AlreadySignedIn";

export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [result, session] = await Promise.all([getInviteByToken(token), getSession()]);
  if (result.status !== "ok") notFound();

  if (session) {
    return (
      <AlreadySignedIn
        currentEmail={session.user.email}
        inviteEmail={result.invite.email}
        continueHref={`/invites/${token}/set-password`}
      />
    );
  }

  return (
    <SetPasswordForm
      token={token}
      email={result.invite.email}
      role={result.invite.role}
      team={
        result.invite.team
          ? { name: result.invite.team.name, teamRole: result.invite.teamRole ?? "member" }
          : null
      }
    />
  );
}
