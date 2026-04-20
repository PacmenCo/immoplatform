# Email delivery

How the `sendEmail()` transport in `src/lib/email.ts` works + how to wire real email in production.

## Two modes

### `EMAIL_PROVIDER=dev` (default)

Logs every `sendEmail` call to the server console — no API keys needed, no risk of accidentally emailing real users from dev. The `Login:` banner at the end of `npm run seed` tells you the dev password; any email we'd send shows up in the `next dev` terminal.

### `EMAIL_PROVIDER=resend`

Sends via [Resend](https://resend.com). Free tier is 3 000 emails / month, 100 / day — enough for a small agency. Paid plan starts at $20 / mo.

Required env:

```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM="Immo <no-reply@yourdomain.com>"
```

Direct `fetch` to `https://api.resend.com/emails` — no SDK dependency, same shape as Platform's Postmark integration minus the extra package.

## Provider setup (Resend)

1. Sign up at [resend.com](https://resend.com).
2. **Add and verify your sending domain** — Resend walks you through DNS records (SPF + DKIM). Without verification, you're stuck on the sandbox `onboarding@resend.dev` address which lands in spam and rate-limits hard.
3. Create an API key from the dashboard (any scope that includes "Send emails" works).
4. Set the three env vars above in production.
5. Deploy. First invite or password-reset call confirms it works.

**If you need to swap to Postmark or SES later**: add a branch to `sendEmail`'s provider switch and a sibling helper (`sendViaPostmark`). The template functions (`inviteEmail`, `passwordResetEmail`, `addedToTeamEmail`) already return a provider-agnostic `{ subject, text }` shape.

## What gets emailed today

Three call sites already exist and will start sending real email the moment you flip `EMAIL_PROVIDER=resend`:

| Trigger | Call site | Template |
|---|---|---|
| New invite sent | `src/app/actions/invites.ts::createInvite` | `inviteEmail` |
| Invite resent | `src/app/actions/invites.ts::resendInvite` | `inviteEmail` |
| Existing user added to team | `src/app/actions/invites.ts::createInvite` (existing-user branch) | `addedToTeamEmail` |
| Password reset requested | `src/app/actions/auth.ts::forgotPassword` | `passwordResetEmail` |

No other triggers are wired yet. The assignment-lifecycle notifications (created / delivered / completed / files uploaded) are tracked in the Command Center as separate work.

## Local testing against a real provider

If you want to test Resend in dev without polluting prod analytics:

1. Create a separate Resend project ("Immo dev") with its own API key.
2. In `.env`, set `EMAIL_PROVIDER=resend` and the test key.
3. Use `EMAIL_FROM="Immo dev <onboarding@resend.dev>"` — Resend's sandbox address works without domain verification but only sends to your own account email.
4. Flip back to `dev` when done testing.

## Caller error handling

`sendEmail()` **throws** on delivery failure. Callers decide how to surface:

- `forgotPassword` **intentionally swallows** — always returns `{ ok: true }` to prevent email enumeration.
- `createInvite` + `resendInvite` propagate the failure. The action returns an error; the invite row still exists (created before the send) and can be resent. This is the right tradeoff — staff want to know immediately when delivery is broken.

If a future trigger needs "best-effort" semantics (don't fail the whole action if email fails), wrap the send in a try/catch at the call site and log via `console.error` / audit.

## Out of scope for this pass

- **HTML email templates.** Plain text works; HTML is a visual polish that can be added without touching the transport — the `SendEmailArgs.html` field is already optional.
- **Bounce + complaint handling.** Resend exposes webhooks for this. Wire when bounce rates become a real concern.
- **Retry + queue.** `sendEmail` runs in-line with the server action. If a user double-submits an invite and Resend briefly errors, the first request fails — user retries manually. For scale, move sends to a queue (Vercel cron or a background worker).
- **Unsubscribe management.** Transactional mail (invites, resets) doesn't require an unsubscribe link. Marketing emails (announcements, digests) would.
