# Authentication & access — design

Status: design (2026-04-20). Frontend for invite and login is already prototyped; backend is pending (tracked under **Foundation**, **Invite & onboarding flow**, and **Backend — missing endpoints** in the Command Center).

---

## 1. Principles

- **Invite-only by default.** New users always arrive via an invite from someone already on the platform. There's one exception: the agency founder self-registers via `/register` to create the first seat of a new team.
- **Email is the identity.** One email = one user account across all teams. Users can belong to multiple teams with different roles per team.
- **Two role concepts**, always both present:
  - **Platform role** — `admin | staff | realtor | freelancer`. Tied to the person.
  - **Team role** — `owner | member`. Tied to the (user, team) pair. Only present if the user is in a team.
- **Sessions, not JWTs.** Signed, httpOnly, SameSite=Lax cookie. 30-day rolling expiry. Works naturally with Next.js SSR.
- **Passwords hashed with Argon2id** (OWASP recommended). Min 10 characters, no other requirements.
- **Every auth event is audit-logged** (login, logout, password change, invite sent, etc.) — feeds the activity timeline on the user detail page.

---

## 2. Entry points

There are only two ways a user account comes into existence:

### A. Agency self-registration (the first seat of a new org)
`/register` — an agency owner fills in: first name, last name, agency name, work email, password, region.

1. Validate: email not in use. Agency name uniqueness is optional (we recommend allowing duplicates — cities often have multiple "Immo X" offices).
2. Create records atomically (single transaction):
   - `users` row: role = `realtor`, email_verified_at = null
   - `teams` row: the agency
   - `team_members` row: (user, team, team_role = `owner`)
3. Send verification email with a 24-hour token.
4. User clicks link → mark `email_verified_at` → auto-sign-in → redirect to `/onboarding`.
5. If they don't verify within 24h, next login prompts to resend verification (account is usable, but they'll see a banner).

### B. Invite from an existing user (everyone else)
This is the main path and the one the user described. Covered in full in §4 below.

We do **not** support OAuth / social login / SSO in v1 — tracked as a low-priority follow-up.

---

## 3. Data model

```
users
  id              uuid pk
  email           citext unique not null       -- lowercased
  email_verified_at timestamptz null
  password_hash   text null                    -- null while invite is unaccepted
  first_name      text not null
  last_name       text not null
  role            enum(admin, staff, realtor, freelancer) not null
  phone           text null
  region          text null
  avatar_id       uuid null
  bio             text null
  joined_at       timestamptz not null default now()
  last_seen_at    timestamptz null
  deleted_at      timestamptz null             -- soft delete for GDPR

teams
  id              uuid pk
  name            text not null
  city            text
  logo_color      text
  vat, kvk, legal_name, signature_id ...       -- branding fields per Teams feature

team_members
  team_id         uuid fk teams.id
  user_id         uuid fk users.id
  team_role       enum(owner, member) not null
  joined_at       timestamptz not null default now()
  primary key (team_id, user_id)

invites
  id              uuid pk
  email           citext not null              -- who we invited
  role            enum(admin, staff, realtor, freelancer) not null
  team_id         uuid null fk teams.id
  team_role       enum(owner, member) null     -- required iff team_id is set
  token_hash      bytea unique not null        -- we store the HASH, not the raw token
  invited_by      uuid fk users.id
  note            text null
  created_at      timestamptz not null default now()
  expires_at      timestamptz not null default now() + interval '7 days'
  accepted_at     timestamptz null
  revoked_at      timestamptz null
  resend_count    int not null default 0
  last_resent_at  timestamptz null

  check ((team_id is null) = (team_role is null))   -- both or neither
  unique index on (email) where accepted_at is null and revoked_at is null  -- one pending per email

password_resets
  id              uuid pk
  user_id         uuid fk users.id
  token_hash      bytea unique not null
  created_at      timestamptz not null default now()
  expires_at      timestamptz not null default now() + interval '1 hour'
  used_at         timestamptz null

sessions
  id              bytea pk                     -- 32-byte random
  user_id         uuid fk users.id
  active_team_id  uuid null fk teams.id        -- which team the user is acting as
  user_agent      text
  ip              inet
  city, country   text null                    -- derived from IP
  created_at      timestamptz not null default now()
  last_seen_at    timestamptz not null default now()
  expires_at      timestamptz not null default now() + interval '30 days'
  revoked_at      timestamptz null
```

**Token hashing rule:** for invites and password_resets, the DB stores `sha256(token)`. The raw token is emailed once and never persisted. This means a leaked DB can't be used to take over accounts.

---

## 4. Flow: admin invites a new user (primary flow)

This is what the user described: "admin adds a user, user gets mail, user creates password, user logs in; admin also picks team + team role."

### 4.1 Admin sends the invite

UI at `/dashboard/users/invite` (already built). Fields:
- Email (required)
- Platform role (admin / staff / realtor / freelancer, required)
- Team (optional; required if policy says so — see §7)
- Team role (member or owner; required iff team selected)
- Optional note

**`POST /api/invites`**

Body:
```json
{ "email": "lucas@ex.be", "role": "realtor", "team_id": "uuid", "team_role": "member", "note": "Welcome aboard" }
```

Server logic:
1. **Permission check** (see §7).
2. **Email normalization** — lowercase + trim.
3. **Existing user branch**: if a row in `users` already has this email, skip the whole password flow — this is an "add to team" operation. Insert `team_members`, send them a *different* template ("You've been added to team X"), return early. No invite row created.
4. **New user branch** (the primary path):
   - Reject if a pending invite already exists for this email (409 Conflict).
   - Generate a 32-byte url-safe random token.
   - Insert `invites` row with `token_hash = sha256(token)`, 7-day expiry.
   - Enqueue `send_invite_email(invite_id, raw_token)` job. The raw token only lives in memory and in the sent email — never in the DB.
   - Return `201 Created` with the invite object (no raw token in the response).
5. Log `invite.sent` in the audit stream.

### 4.2 Invitee receives the email

Subject: `You're invited to join Immo as a realtor`

Body (React Email template, renders in both HTML and plain text):
- Inviter name + agency
- Assigned role + team + team role
- The optional note (as a blockquote)
- Big button: `Accept invitation →` linking to `https://immo.app/invites/<raw-token>`
- Expiry disclaimer ("This link expires in 7 days on [date]")
- Support contact

### 4.3 Invitee clicks the link

Lands at `/invites/[token]` (already built). The page shows inviter, role, team, team role, 3-step "what's next" preview, Accept / Decline buttons.

**`GET /api/invites/:token`** (public, unauthenticated) — UI fetches this to render the page. Server:
1. Resolve by `sha256(token)`.
2. Respond:
   - `404` — token not found
   - `410` — expired or revoked
   - `409` — already accepted (redirect user to login)
   - `200` — valid; returns inviter info, role, team info, note, expires_at

### 4.4 Invitee accepts & creates password

`/invites/[token]/set-password` (already built). Fields: first name, last name, password (with show/hide + min 10 chars), password confirm, T&C checkbox.

**`POST /api/invites/:token/accept`**

Body:
```json
{ "first_name": "Lucas", "last_name": "Mertens", "password": "…" }
```

Server (single transaction):
1. Resolve invite by `sha256(token)`. 404/410/409 as above.
2. Validate password (length ≥ 10, not in common-password list).
3. Hash password with Argon2id (memory 19 MiB, iterations 2, parallelism 1).
4. Create `users` row with email + role from the invite + name + hash. `email_verified_at = now()` (the invite email IS the verification).
5. If `team_id` was set on the invite, insert `team_members` with the invite's `team_role`.
6. Mark invite `accepted_at = now()`.
7. Create a session, set the cookie, set `active_team_id` to the invite's team (if any) or first membership.
8. Return the user; client navigates to `/dashboard`.
9. Audit: `user.created` + `invite.accepted`.
10. Send "welcome" email (fire-and-forget).

### 4.5 What the admin sees

The Pending invites card on `/dashboard/users` (already built) shows this invite disappear (moved to regular users) once accepted. Per-invite Resend / Revoke actions use:

- **`POST /api/invites/:id/resend`** — same token, bump `expires_at = now() + 7d`, `resend_count++`, re-queue email. Rate-limited to 3 per hour per invite.
- **`POST /api/invites/:id/revoke`** — `revoked_at = now()`. Subsequent accept attempts return 410.

---

## 5. Flow: login (returning user)

### 5.1 Login UI

`/login` (already built). Fields: email, password. "Forgot password?" link.

**`POST /api/auth/login`**

Body: `{ "email", "password" }`

Server:
1. Rate limit: 5 attempts per IP per 10 min, 5 attempts per account per 10 min (whichever fires first).
2. Look up user by email.
3. **Constant-time dance**: if no user, still run a dummy Argon2 verify against a fixed hash to avoid timing enumeration.
4. Verify password. On mismatch, return `401 { error: "invalid_credentials" }`. Never differentiate "no such email" vs "wrong password".
5. If `deleted_at is not null` → `401 { error: "invalid_credentials" }`.
6. Create session.
7. Set cookie: `session=<id>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000`.
8. Audit: `user.signed_in` with device/IP info.
9. Return user + active team context.

### 5.2 Logout

**`POST /api/auth/logout`** — marks `sessions.revoked_at`, clears the cookie.

**`DELETE /api/sessions/me/others`** — revokes all other sessions for the current user (Settings → Active sessions → "Sign out of other sessions").

---

## 6. Flow: forgot + reset password

### 6.1 Request reset

`/forgot-password` (already built). User enters email.

**`POST /api/auth/forgot-password`**

1. Rate limit: 3 per IP per hour, 3 per email per hour.
2. Look up user. Regardless of whether found, respond `200 { ok: true }` (no email enumeration).
3. If found: insert `password_resets` row with `sha256(token)`, 1-hour expiry. Enqueue send email with reset link.
4. Audit: `password_reset.requested` (whether found or not, for security monitoring).

Email subject: `Reset your Immo password`. Link: `https://immo.app/reset-password?token=<raw>`.

### 6.2 Use reset link

`/reset-password` (already built). Accepts `?token=…`. Fields: new password + confirm.

**`POST /api/auth/reset-password`**

Body: `{ "token", "password" }`

1. Resolve by `sha256(token)`. 404/410/409 as usual. Also reject if `used_at is not null`.
2. Validate password.
3. Update `users.password_hash`.
4. Mark reset `used_at = now()`.
5. **Revoke all sessions for this user** (security hygiene — if the account was compromised, we kick the attacker out).
6. Create a fresh session for the caller, set cookie.
7. Audit: `user.password_changed`.
8. Redirect to `/dashboard`.

---

## 7. Permission model — "who can invite whom"

Encoded as a policy check on `POST /api/invites`:

| Caller role | Can invite roles | Team scope | Notes |
|---|---|---|---|
| **admin** | any | any team, any team_role | Platform-wide reach |
| **staff** | everyone except admin | any team, any team_role | Immo support |
| **realtor (team owner)** | realtor, freelancer | their team only, any team_role | Can promote to co-owner |
| **realtor (team member)** | — | cannot invite | |
| **freelancer** | — | cannot invite | |

Additional rules:
- Setting `team_id` requires the caller to be admin, staff, or owner of that specific team.
- You can't invite someone to a role higher than your own (admins aside).
- Demoting the last owner of a team is blocked at the persistence layer; force-transfer first.

---

## 8. Edge cases (handled by design)

| Scenario | Behavior |
|---|---|
| Invite to existing user | Silently add to team + send "added to team X" email; no password flow |
| Invite token expired | 410 Gone → page shows "expired" state + "Request a new invite" |
| Invite token revoked | 410 Gone → page shows "this invite was revoked" |
| Invite already accepted | 409 → redirect to /login |
| Two admins send an invite to the same email within minutes | Second one hits 409 (unique pending index); tell the second admin to ask the first to revoke |
| User completes invite flow while signed in as someone else | New session replaces old (cookie overwritten); old session not revoked unless we want stricter behavior |
| Password reset → all sessions revoked | Intentional; attacker is kicked out |
| User deletes account but is the last owner of a team | Blocked; prompt to transfer ownership first (per GDPR feature todo) |
| Leaked DB | Tokens are stored hashed → attacker can't use existing invite/reset links |
| Timing attack on /login | Constant-time Argon2 dance against dummy hash on "no such email" |

---

## 9. Email-related features (coordinated with Notifications feature)

Auth-related transactional emails (all use the same provider — Postmark preferred):

1. **Invite email** — "You're invited to join Immo"
2. **Added to team email** — "You've been added to team X" (when the invited email already has an account)
3. **Email verification** — "Verify your email" (for agency self-registration only)
4. **Password reset** — "Reset your Immo password"
5. **Password changed** — "Your password was changed" (confirmation after successful reset or /settings change)
6. **New device signed in** — security notice when a login comes from a new IP/UA
7. **Welcome** — sent after first successful account creation

All 7 have corresponding user notification preferences; security ones (#4, #5, #6) are non-optional.

---

## 10. Security decisions

- **Cookies:** `HttpOnly; Secure; SameSite=Lax; Path=/`. Lax is fine for first pass; tighten to Strict later if we find specific risks.
- **CSRF:** SameSite=Lax blocks top-level POST-cross-site. For defense in depth, use origin header check on mutations.
- **Argon2id parameters:** memory = 19 MiB, iterations = 2, parallelism = 1 (OWASP 2025 recommendation).
- **Rate limiting:** per-IP + per-account, using a sliding window. Redis or the auth DB with a cheap index.
- **Token size:** 32 bytes (256 bits), url-safe base64.
- **Secrets:** app signing key (for session cookie HMAC) loaded from env, rotated yearly.
- **Audit:** append-only, 2-year retention. Every auth mutation.
- **No account lockout** (gives attackers a DoS lever). Rate limiting is the mitigation.

---

## 11. Out of scope for v1 (future)

- **2FA / TOTP** — add a `user_totp_secret` column, QR-code enrollment, time-constant verify. Straightforward but not day-1.
- **Passkeys / WebAuthn** — growing browser support, great UX, but adds implementation surface.
- **Google / Microsoft SSO** — already in the Foundation feature as low-priority. Makes sense once we have enough users that managing passwords becomes friction.
- **Scim / SSO provisioning** — relevant only for large clients.
- **Magic-link login** (passwordless) — could replace password entirely for some users; deferred until we have a clearer view of usage patterns.

---

## 12. Frontend mapping

All of these already have prototype UIs. They'll be wired up once the backend endpoints land.

| UI file | Endpoint(s) it will call |
|---|---|
| `/register/page.tsx` | `POST /api/auth/register` |
| `/login/page.tsx` | `POST /api/auth/login` |
| `/forgot-password/page.tsx` | `POST /api/auth/forgot-password` |
| `/reset-password/page.tsx` | `POST /api/auth/reset-password` |
| `/verify-email/page.tsx` | `POST /api/auth/verify-email` (called on link click) + `POST /api/auth/verify-email/resend` |
| `/invites/[token]/page.tsx` | `GET /api/invites/:token` |
| `/invites/[token]/set-password/page.tsx` | `POST /api/invites/:token/accept` |
| `/dashboard/users/invite/page.tsx` | `POST /api/invites` |
| `/dashboard/users/page.tsx` (pending invites) | `GET /api/invites?status=pending`, `POST /api/invites/:id/resend`, `POST /api/invites/:id/revoke` |
| `/dashboard/settings/page.tsx` (active sessions) | `GET /api/sessions/me`, `DELETE /api/sessions/me/others`, `DELETE /api/sessions/:id` |

---

## 13. Build order (for whoever picks this up)

1. **Foundation: DB + Prisma schema** — create users, sessions, invites, password_resets, team_members, audit_log.
2. **Foundation: auth primitives** — password hashing, session creation, cookie set/read, middleware that resolves caller from session.
3. **Foundation: role system** — RoleGuard helper that wraps endpoint handlers.
4. **Invite flow: accept endpoint** — `POST /api/invites/:token/accept` (creates the first real user).
5. **Invite flow: create + GET token endpoints** — `POST /api/invites`, `GET /api/invites/:token`.
6. **Auth: login / logout / forgot-password / reset-password** — needed for returning users.
7. **Email provider + templates** — Postmark setup, React Email, 7 templates above.
8. **Sessions list + revoke + active-team switch** — unblocks /settings and TeamSwitcher.
9. **Audit log** — append-only, feeds activity timeline.

Steps 1–5 are the critical path to get the first real user onto the platform. Steps 6–9 make returning usage + multi-device ergonomic.
