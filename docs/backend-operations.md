# Backend operations runbook

Operational procedures for the Checkin Convex backend: which deployment each
command touches, how integration tests are isolated, how background failures
surface and get repaired, and how support overrides and schema changes are run.
Never commit deploy keys, `.env*` files, or values copied from them.

## Deployments and targeting

| Deployment | Reference | Role (`CHECKIN_DEPLOYMENT_ROLE`) | Used by |
| --- | --- | --- | --- |
| Personal dev | `dev` (selected in `.env.local`) | unset → `standard` | `pnpm run backend`, the Next.js app |
| Integration tests | `dev/integration-tests` | `test` | `pnpm test:integration` only |
| Production | `prod` | unset → `standard` | `npx convex deploy` |

- **Every CLI command defaults to `.env.local`'s dev deployment.** Name another
  target explicitly with `--deployment <ref>` (or `--prod`). Read the target
  line the CLI prints before confirming any mutation.
- **Never run `convex dev` against the test deployment.** `convex dev` rewrites
  `.env.local` to whichever deployment it targets, which would repoint the app
  at the test data. `pnpm test:integration:deploy` uses `convex deploy` with
  the test deploy key instead, which leaves `.env.local` untouched. If
  `.env.local` was repointed, restore it with
  `npx convex deployment select atharva-bakale-7af7c:checkin:dev/atharva-bakale`.
- **`CHECKIN_DEPLOYMENT_ROLE` gates test and demo controls.** Unset or
  unrecognised values are `standard`:
  - `test` — fixture management (`testing:*`), payment-outcome simulation, seeding.
  - `demo` — payment-outcome simulation and seeding only; fixtures stay disabled.
  - `standard` — all of the above refuse to run. Never set a role on production.
- To make the personal dev deployment a demo environment:
  `npx convex env set CHECKIN_DEPLOYMENT_ROLE demo` (default dev target).

## Integration tests

`pnpm test:integration` runs `convex/*.integration.test.ts` with Node's test
runner against the dedicated `dev/integration-tests` deployment. There is no
Vitest and no `convex-test`.

**Local configuration:** `.env.test.local` is gitignored and holds:

- `CONVEX_DEPLOY_KEY` — a `dev:` deploy key for the test deployment only.
- `CHECKIN_CONVEX_TEST_DEPLOYMENT=true` — the explicit opt-in marker.
- `CONVEX_TEST_DEPLOYMENT_URL` — the test deployment's `.convex.cloud` URL.

**Fail-early guarantees** (`lib/testing/integration-target.ts`, unit-tested).
The suite exits non-zero before any network call if any of these hold:

- The marker is missing.
- The URL or deploy key is missing.
- The key is a `prod:` key, or belongs to a different deployment than the URL.
- The URL equals the app's `NEXT_PUBLIC_CONVEX_URL`.

The harness then asks the deployment for its role and refuses anything but `test`.

**Running:**

```sh
pnpm test:integration:deploy   # push current functions + schema to the test deployment
pnpm test:integration          # run the suites (serially; reconciliation is deployment-wide)
```

**Identities and fixtures:**

- Each run generates a random run id. The deploy key acts as synthetic
  identities (issuer `https://checkin-integration.test`, subject
  `itest_<runId>_<role>`), so suites cover guest, host and unrelated-user paths
  without Clerk sessions.
- Listings go through the real draft → upload → publish flow.
- Clock-driven states (expiry, completion, review deadlines, stalled payments)
  are reached with the gated `testing:shiftReservationTimes` and
  `testing:backdatePaymentOperations` fixtures.
- `testing:cleanupRun` deletes only records reachable from that run's
  identities, plus webhook events prefixed `itest_<runId>_`.

**Recreating the test deployment** (one-time; keys stay out of Git):

```sh
npx convex deployment create dev/integration-tests --type dev
npx convex deployment token create checkin-integration-tests --deployment dev/integration-tests --save-env .env.test.local
npx convex env set CHECKIN_DEPLOYMENT_ROLE test --deployment dev/integration-tests
npx convex env set CLERK_FRONTEND_API_URL <clerk issuer URL> --deployment dev/integration-tests
# then append CHECKIN_CONVEX_TEST_DEPLOYMENT=true and CONVEX_TEST_DEPLOYMENT_URL to .env.test.local
```

## Background operations and reconciliation

Scheduled functions drive the time-based transitions:

- Quote expiry.
- Instant payment-hold expiry.
- Request expiry.
- Simulated payment settlement.
- Stay completion and payout.
- Review reveal at the 14-day deadline.

A scheduler miss or failure must not strand data, so the cron
`reconcile background operations` (`convex/crons.ts`) runs
`operations:reconcileBackgroundOperations` every 15 minutes. It is idempotent
and safe to run by hand:

1. **Repairs missed transitions** by calling the same internal mutations the
   scheduler would:
   - Pending holds and requests past their deadline are expired and their nights released.
   - Confirmed stays past checkout are completed.
   - Unrevealed reviews past their window are revealed.
2. **Flags stalled payment operations.** Any simulated operation still pending
   after 25 hours (the simulator's maximum delay is 24 hours) is marked failed:
   - A stalled refund also sets the reservation to `refund_failed` and opens a
     `refund_stalled` event.
   - A stalled charge opens `payment_operation_abandoned`; its hold has already lapsed.
3. **Records failed scheduled functions.** It scans the most recent
   `_scheduled_functions` entries and opens one `scheduled_function_failed`
   event per failure.
4. **Deletes abandoned listing-photo uploads.**

**Operational logging:** every event writes one JSON log line with
`"source":"checkin.ops"`. Events of severity `error` go to `console.error` and
`warning` to `console.warn`. Each event is also stored, deduplicated, in
`operationalEvents`. Refund failures and late-cancellation requests open events
at the moment they happen. Watch with:

```sh
npx convex logs --deployment <ref> | grep checkin.ops
npx convex run operations:listOpenEvents '{}' --deployment <ref>
```

## Support overrides

All overrides are internal functions. They can be run only with deployment
admin access (the CLI or dashboard), never from the app. Run them against the
deployment that owns the data, and always record who acted and why.

| Situation | Command |
| --- | --- |
| Late cancellation request (inside 24h of check-in) | `npx convex run reservations:resolveLateCancellation '{"supportRequestId":"…","approveRefund":true,"supportProfileId":"<your profile id>","resolutionNote":"…"}'` |
| Failed or stalled simulated refund | `npx convex run reservations:retryRefund '{"paymentOperationId":"…","outcome":"success"}'` |
| Force a reconciliation pass | `npx convex run operations:reconcileBackgroundOperations '{}'` |
| Close an incident after acting | `npx convex run operations:resolveEvent '{"eventId":"…","resolvedBy":"<operator>","resolutionNote":"…"}'` |
| Replay a Clerk billing event | Re-deliver it from the Clerk dashboard; the backend ignores duplicate event ids and events older than the stored state. |

**Notes on these overrides:**

- `resolveLateCancellation` writes the resolver, note and time to the support
  request. Approving it cancels the reservation if needed, releases its nights,
  and starts one idempotent refund.
- `retryRefund` only applies to a refund in `failed` state. Each retry
  increments `attempts`, and a repeat failure opens a fresh `refund_failed` event.
- `resolveEvent` requires both an operator and a note.

## Schema evolution

Convex validates every existing document against `convex/schema.ts` on deploy,
so a schema change must be safe for the data already stored:

1. **Additive first.**
   - New tables and new optional fields deploy without a migration.
   - New indexes on small tables deploy directly.
   - On large tables, declare the index `staged: true`, deploy, wait for the
     backfill, then remove the flag in a follow-up deploy.
2. **Required fields and type changes take three deploys:**
   1. Add the field as optional and write it in all mutations.
   2. Backfill existing rows with a batched internal mutation that reschedules
      itself (`ctx.scheduler.runAfter(0, …)`) until done.
   3. Make the field required.
3. **Removing a field:** stop writing it, deploy, clear it from stored documents
   with a batched mutation, then remove it from the schema.
4. **Rehearse on the test deployment first**, then on the personal dev
   deployment, then production:
   - Run `pnpm test:integration:deploy`, then `pnpm test:integration`.
   - Production deploys use `npx convex deploy`; check the printed target first.
5. **Never edit stored booking snapshots** (`reservations.quote`, timestamps,
   cancellation deadline). They are the financial record. Migrations may add
   fields alongside them but must not rewrite them.
