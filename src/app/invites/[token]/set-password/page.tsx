import { notFound } from "next/navigation";
import { getInviteByToken } from "@/app/actions/invites";
import { SetPasswordForm } from "./SetPasswordForm";

export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getInviteByToken(token);
  if (result.status !== "ok") notFound();

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
