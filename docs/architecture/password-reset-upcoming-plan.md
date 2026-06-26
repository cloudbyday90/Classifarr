# Password Reset Upcoming Plan

Status: upcoming implementation plan. This is intentionally scoped as a planning
document until we decide which recovery flows should ship first.

## Goal

Add a secure, self-hosted-friendly password reset system for Classifarr without
creating a weak account recovery path.

The user-facing goal is:

```text
Let an operator recover access without database surgery.
```

The engineering goal is:

```text
Support password changes, email reset links, and local admin recovery with
auditable, single-use credentials and clear deployment behavior.
```

## Current Problem

Classifarr supports account setup and authentication, but account recovery still
needs a first-class design. A simple "forgot password" button is not enough
because many Classifarr installs are self-hosted and may not have SMTP or a
publicly reachable base URL configured.

That creates two different recovery needs:

- A normal authenticated password change for users who still know their current
  password.
- A recovery path for locked-out operators when email delivery may not exist.

## Design Principle

Password reset should be secure by default and operationally useful for
self-hosted deployments.

Current:

```text
locked out -> manual database/container intervention
```

Target:

```text
logged-in user -> change password -> invalidate sessions
locked-out user + email configured -> short-lived reset link
locked-out operator + no email -> local admin recovery command/token
```

The public UI must never expose whether a user exists, whether SMTP is
configured, or whether a reset token was generated.

## Proposed Flows

### 1. Authenticated Password Change

Use when the user is already logged in.

Required behavior:

- Require current password.
- Require new password and confirmation.
- Validate password strength using the same policy used during account setup.
- Re-hash the password with the existing password hashing strategy.
- Revoke existing refresh/session tokens after success.
- Record an audit event.

### 2. Email-Based Forgot Password

Use when SMTP and a trusted application URL are configured.

Required behavior:

- Accept username or email but return a generic response.
- Generate a high-entropy reset token.
- Store only a hashed token.
- Set a short expiry window, likely 15-30 minutes.
- Allow one successful use only.
- Rate limit by IP and account identity.
- Send a reset link through the configured notification/email provider.
- Revoke existing refresh/session tokens after successful reset.
- Record request, success, expired, and failed validation audit events.

### 3. Local Admin Recovery

Use for self-hosted installs that do not configure SMTP.

Required behavior:

- Expose recovery through a local/container command, not an unauthenticated web
  endpoint.
- Require local shell/container access.
- Generate either a one-time browser recovery token or directly set a new
  password after explicit confirmation.
- Record a local recovery audit event.
- Revoke existing refresh/session tokens after recovery.
- Document Docker and Unraid examples.

## Data Model Candidates

Potential migration:

```text
password_reset_tokens
  id
  user_id
  token_hash
  token_prefix
  delivery_channel
  requested_ip_hash
  requested_user_agent_hash
  expires_at
  consumed_at
  created_at
```

Potential supporting fields/tables:

- `auth_audit_events` if no suitable audit table already exists.
- Session/refresh token invalidation marker if current session storage cannot
  revoke all sessions for one user.
- Optional `local_recovery_tokens` table only if local recovery needs separate
  lifecycle semantics from email reset tokens.

## API Surface Candidates

Public endpoints:

- `POST /api/auth/password/forgot`
- `POST /api/auth/password/reset`

Authenticated endpoint:

- `POST /api/auth/password/change`

Admin/local-only tooling:

- `node server/src/scripts/generatePasswordRecoveryToken.mjs`
- or `node server/src/scripts/resetUserPassword.mjs`

The exact script shape should follow the repo's existing script conventions and
should avoid printing secrets except for the one-time recovery token/password
requested by the operator.

## UI Scope

Minimal UI:

- "Forgot password?" link on login when recovery is enabled.
- Reset request form with generic success copy.
- Reset password form for valid tokens.
- Account/settings password-change form for logged-in users.

Admin/settings UI can come later unless needed for SMTP setup validation.

## Security Requirements

- Never store raw reset tokens.
- Never log raw reset tokens.
- Never reveal whether an account exists.
- Enforce token TTL and single-use semantics server-side.
- Rate limit request and validation endpoints.
- Use CSRF/session conventions already established in the app.
- Sanitize token-related responses and audit metadata.
- Revoke existing sessions after successful reset/change.
- Keep all account recovery routes excluded from broad unauthenticated API
  behavior except the two intentional public reset endpoints.

## Implementation Phases

### Phase 0: Discovery

- Inventory current auth tables, password hashing, session/refresh token
  behavior, rate limiting, and audit/logging utilities.
- Decide whether email delivery exists today or whether a notification provider
  abstraction is required first.
- Decide whether recovery should key on username, email, or both.

### Phase 1: Authenticated Password Change

- Add service-level password update primitive.
- Add route and client API function.
- Add logged-in settings UI.
- Add tests for current-password failure, weak-password rejection, successful
  change, and session invalidation.

### Phase 2: Reset Token Storage and Validation

- Add token table migration.
- Add token creation, hashing, lookup, expiry, consume, and cleanup services.
- Add tests for no raw token persistence, expiry, replay rejection, and generic
  responses.

### Phase 3: Email Reset Flow

- Add public request/reset endpoints.
- Add reset pages.
- Add email dispatch if a delivery mechanism is configured.
- Add safe fallback messaging when delivery is unavailable.

### Phase 4: Local Recovery

- Add documented container/local recovery command.
- Add local recovery tests where possible.
- Add Docker/Unraid command examples.

### Phase 5: Retention and Cleanup

- Add scheduled cleanup for expired/consumed tokens.
- Add audit retention rules if audit events are persisted.
- Add operational documentation.

## Open Questions

- Do users have email addresses today, or do we need to add email as optional
  account metadata first?
- Should password reset require SMTP, Discord, or a provider-neutral
  notification abstraction?
- Should local recovery set a password directly or generate a one-time browser
  reset token?
- What is the current session invalidation model, and can it revoke all sessions
  for a user today?
- Should first-admin recovery be allowed only when there is exactly one admin or
  should any named local user be recoverable from the container command?

## Recommended Starting Point

Start with Phase 0 and Phase 1. Authenticated password change is the smallest
secure slice, exercises the password update/session invalidation path, and
reduces risk before adding unauthenticated recovery endpoints.
