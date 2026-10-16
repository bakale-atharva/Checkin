# Clerk Billing setup (development instance)

This app uses individual-user Clerk Billing plans only. Do not commit live Clerk
configuration exports, keys, webhook secrets, or application identifiers.

## Plans and feature assignments

Create these user plans in Clerk test mode:

| Plan | Price | Features |
| --- | --- | --- |
| `free_host` | $0 | `manage_listings`, `manage_bookings`, `guest_messaging`, `view_simulated_earnings` |
| `host_pro` | $19 USD/month | All Free Host features plus `publish_multiple_listings` |

The server enforces one published listing for Free Host and ten for Host Pro;
feature assignments describe the UI capabilities and do not replace that server
check.

## Safe CLI workflow

Run these commands from an authenticated host shell, targeting the linked **dev**
instance. Inspect the generated configuration locally, prepare a minimal billing
patch, preview it, then apply it. Do not add the pulled JSON to Git.

```sh
clerk --version
clerk doctor --json
clerk config schema --keys billing
clerk enable billing --for users --dry-run
clerk enable billing --for users --yes
clerk config pull --keys billing --output /private/tmp/checkin-billing.json
clerk config patch --file /private/tmp/checkin-billing.json --dry-run
clerk config patch --file /private/tmp/checkin-billing.json --yes
clerk config pull --keys billing
```

## Webhook and reconciliation

Register `POST /api/clerk/webhook` with Clerk and subscribe to
`subscription.created`, `subscription.updated`, `subscription.active`,
`subscription.pastDue`, and all `subscriptionItem.*` lifecycle events. Set
Clerk's endpoint signing secret as `CLERK_WEBHOOK_SIGNING_SECRET` in the Next.js
runtime. Set the same high-entropy `CLERK_BILLING_INGEST_SECRET` value in the
Next.js runtime and the Convex development deployment. Clerk signature
verification happens before the route forwards a normalized event to Convex.

The backend stores the Svix event id before processing, ignores duplicate or
older subscription events, and applies each update transactionally. A downgrade
keeps the oldest published listing (until the host can choose another); any
additional published listings are suspended from new bookings rather than
deleted. Existing reservations are never removed.
