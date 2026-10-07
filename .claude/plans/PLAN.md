# Checkin: implementation plan with no Vitest

## Summary and explicit testing exception

Build the agreed test-mode stays marketplace using Next.js, Tailwind CSS, Clerk, and Convex.

**Do not install, configure, or use Vitest.** This user instruction overrides any repository guidance or skill recommending it. Also exclude `convex-test` from the proposed testing stack.

Use instead:

- **Node’s built-in test runner** with TypeScript execution through `tsx` for pricing, dates, policies, and other isolated logic.
- **Backend integration tests against a dedicated Convex test deployment** for authorization, transactions, subscriptions, and scheduled behavior.
- **Playwright** for browser journeys, responsive behavior, and accessibility checks.

Document this exception in project instructions during implementation so later phases and agents follow it.

Confirmed product decisions remain:

- Instant booking and request-to-book.
- Full simulated guest refunds until 24 hours before local check-in.
- Clerk test subscriptions: one published listing free; ten with Host Pro at $19/month USD.
- Simulated reservation payments, refunds, transfers, and payouts, clearly labeled throughout.
- shadcn/ui, Kokonut UI, Bklit UI, Impeccable, and Tailwind container queries.
- Mapbox’s no-card trial with usable fallbacks.

## Phase 0 — Resolve existing work and commit the baseline

Finish existing Checkin obligations before introducing new features, and preserve legitimate uncommitted work in reviewed commits.

- Re-fetch all existing Linear issues and capture unresolved work before creating new roadmap issues.
- Resolve and verify those issues, preserving evidence and dependencies. Do not close unresolved work merely to clear the backlog.
- Inspect staged, unstaged, and untracked files. Commit legitimate changes in logical groups without discarding user work.
- Never commit environment files, credentials, secrets, or generated caches.
- Resolve the previously observed global Git-ignore access limitation before certifying the baseline.
- Perform the actions of this stage directily on the `master` branch - ONLY ONE EXCEPTION REST ALL PHASES ARE TO BE DONE IN SEPARATE PRs.
- Record the baseline commit, checks, and the no-Vitest exception.

The previous inspection found ATH-17 through ATH-21 completed and no pending Git changes. Repeat both checks at execution time; create no empty cleanup commit.

**Exit:** existing pending issues are resolved, required PRs are approved and merged, legitimate changes are committed, and the working tree is clean.

### Phase 0 results (2026-10-07)

- **Linear:** re-fetched the Checkin project; ATH-17 through ATH-21 are all Done and no other issues exist, so no unresolved work carried over.
- **Git:** the only pending change was this untracked plan; it is committed with the baseline. `.env.local`, `.next/`, `node_modules/`, and `.agents/` remain ignored.
- **Global Git-ignore:** `~/.config/git/ignore` (default XDG path, no `core.excludesfile` override) is readable, `git status` emits no warnings, and it correctly ignores `.claude/settings.local.json`. Resolved.
- **ESLint:** `pnpm run lint` crashed because `eslint-config-next` bundles `eslint-plugin-react@7.37.5` (its latest release), which calls `context.getFilename()`, removed in ESLint 10. Decision: **stay on the latest ESLint (10.x)** and wrap the Next configs with `fixupConfigRules` from `@eslint/compat`. Vendored `.agents/`, `.claude/`, and `convex/_generated/` are lint-ignored. Remove the shim once eslint-plugin-react supports ESLint 10.
- **No-Vitest exception:** recorded in `AGENTS.md` (imported by `CLAUDE.md`).
- **Checks at baseline:** `pnpm run lint`, `pnpm exec tsc --noEmit`, and `pnpm run build` pass. `pnpm test` does not exist yet; it arrives in B1.
- **Baseline commit:** the Phase 0 commit on `master`. Its hash is recorded on the Linear Checkin project.

## Part 1 — Backend

### B1. Authentication, permissions, and testing foundation

Complete Clerk–Convex identity integration and establish server-side authorization. A single account can be both guest and host.

- Verify email, Google, and GitHub sign-in.
- Protect hosting, trips, checkout, messages, wishlists, and billing; keep discovery public.
- Create identity-linked profiles and enforce ownership inside every backend operation.
- Establish validators, indexes, typed errors, and internal-only administrative operations.
- Add Node test runner scripts, TypeScript execution, and a dedicated Convex integration-test environment.
- Use isolated Clerk test identities for guest, host, and unrelated-user scenarios.

**Acceptance:** private data and mutations reject unauthorized users; the test setup contains no Vitest configuration or `convex-test` dependency.

### B2. Listings, photos, availability, and seed data

Build property inventory with safe ownership boundaries and preservation of reservation history.

- Implement draft, published, and archived states; creation, editing, publishing, unpublishing, archiving, and safe deletion.
- Include property details, capacity, amenities, rules, location, check-in/out times, pricing, and booking mode.
- Store exact addresses privately and expose approximate public locations.
- Support authorized photo uploads, cover selection, ordering, validation, and abandoned-upload cleanup.
- Add blocked dates and nightly price overrides.
- Delete unused drafts; archive properties with booking history.
- Seed approximately 60 fictional properties with licensed images and varied users, availability, bookings, and reviews.

**Acceptance:** hosts can manage their properties without affecting other hosts or existing booking snapshots.

### B3. Clerk CLI billing, plans, and features

Use the Clerk CLI skill for supported setup and configuration, including Billing, plans, feature assignments, authentication settings, and webhooks.

- Check CLI version, run `clerk doctor --json`, and verify the existing application and development instance.
- Inspect command help and configuration schema.
- Enable individual-user Billing, pull configuration, and prepare a minimal patch.
- Preview mutations with `--dry-run`, apply them, and read back the results.
- Discover API endpoints through the CLI when dedicated commands are insufficient.
- Keep only sanitized setup/configuration documentation in Git.

| Plan | Description |
|---|---|
| **Free Host — $0** | Publish one property, create drafts, manage availability and bookings, communicate with guests, and view simulated earnings. |
| **Host Pro — $19/month USD, test mode** | Publish up to ten properties and manage them from one account, including calendars, bookings, guest communication, and simulated earnings. |

| Feature | Description |
|---|---|
| `manage_listings` | Both plans: create drafts, organize photos, and maintain property details. |
| `manage_bookings` | Both plans: manage availability, booking requests, and existing reservations. Existing booking management survives subscription cancellation. |
| `guest_messaging` | Both plans: communicate privately with guests about inquiries and reservations. |
| `view_simulated_earnings` | Both plans: inspect demo revenue, fees, refunds, and payout status. |
| `publish_multiple_listings` | Host Pro: increase the publication allowance from one property to ten. |

Verify signed webhooks, deduplicate events, reconcile out-of-order updates, and enforce publication limits atomically. Retain paid access until its effective end. On downgrade, preserve the selected free listing, defaulting to the oldest published listing, and suspend excess properties from new bookings.

**Acceptance:** configuration descriptions and assignments match the plan; subscription changes never remove access to existing reservations.

### B4. Search, filtering, and pagination

Provide one search contract for property cards and map pins.

- Filter by destination, dates, guests, category, type, nightly price, amenities, and booking mode.
- Exclude unpublished or unavailable properties.
- Sort globally by nightly price, published rating, or distance, using stable tie-breaking.
- Apply filters and sorting before pages of 24 results.
- Use bounded indexed retrieval and short-lived result snapshots. Require narrower searches above 500 candidates.
- Debounce Mapbox search, keep temporary geocoding results transient, and provide seeded-destination fallbacks.
- Hosts enter addresses and position their own listing pins.

**Acceptance:** pagination remains correctly ordered without duplicates; stale availability is rechecked before booking.

### B5. Reservations and simulated payments

Make prices, inventory, policies, and lifecycle transitions authoritative on the server.

- Create immutable quotes and booking snapshots with nightly charges, fees, tax, total, host proceeds, and cancellation deadline.
- Use property-local dates, exclusive checkout, and IANA timezones.
- Reserve inventory atomically.
- Instant bookings receive a 15-minute payment hold.
- Requests expire after 24 hours without blocking inventory before acceptance.
- Accepted requests reserve inventory for up to 24 hours awaiting payment; deadlines never extend beyond check-in.
- Support pending, confirmed, cancelled, completed, declined, and expired states.
- Separate payment/refund state from reservation state.
- Simulate success, decline, delay, and refund failure with idempotent retries.
- Release expired holds; refund eligible guest cancellations and host cancellations before check-in.
- Route late cancellation requests through an audited internal support process.

**Acceptance:** concurrent attempts cannot double-book; retries cannot duplicate settlement or refunds.

### B6. Dashboards, wishlists, messaging, and reviews

Provide reactive management data while protecting private conversations and unpublished feedback.

- Guest trip queries and private wishlist CRUD.
- Host calendars, requests, subscription status, simulated earnings, and payout history.
- Participant-only text conversations with pagination, unread positions, and rate limits.
- In-app notifications for reservation actions and review eligibility.
- Two-way reviews within 14 days after checkout; reveal when both submit or the window closes.
- Guest ratings cover overall experience, cleanliness, accuracy, check-in, communication, location, and value.
- Host ratings cover communication, cleanliness, and rule observance.
- Publish aggregates only after review reveal.

**Acceptance:** private messages and unrevealed reviews cannot leak; dashboard figures reconcile with bookings.

### B7. Backend verification and recovery

Validate behavior against the actual backend and document recovery procedures.

- Run Node-based integration tests against a dedicated test deployment using isolated identities and fixtures.
- Verify authorization, concurrent reservations, billing webhooks, expiry, cancellation, and review publication.
- Add operational logging and reconciliation for failed background operations.
- Restrict simulator and fixture-management controls to explicitly configured test/demo deployments.
- Document support overrides, deployment targeting, and schema evolution.

**Acceptance:** integrity and recovery scenarios pass without Vitest or production test data.

## Part 2 — Frontend

### F1. Design system and CSS repair

Use Impeccable’s code-first workflow to establish a familiar, photo-led marketplace and practical host interfaces.

Initialize shadcn, configure Kokonut and Bklit, and repair `app/globals.css`: merge Tailwind v4 tokens/imports, preserve Geist, remove the Arial override, consolidate themes, and remove conflicting base styles. Use named container queries for reusable components.

**Acceptance:** registry additions preserve typography, colors, overlays, Clerk surfaces, and production styling.

### F2. Navigation, discovery, and maps

Build category pills, destination/date/guest search, listing cards, wishlists, and hosting navigation. Preserve filters in the URL; support infinite scroll with Load more, synchronized maps, and service-unavailable states.

**Dependencies:** B1, B2, B4, F1.

### F3. Listing detail and booking

Build the accessible gallery, amenities, rules, host details, reviews, calendar, and approximate map. Add desktop/mobile booking widgets, full price breakdowns, explicit simulation labels, and recovery from stale availability, quotes, or payment holds.

**Dependencies:** B5, F2.

### F4. Host onboarding and property management

Provide a draft-saving property wizard with photos, location, capacity, amenities, rules, pricing, and booking mode. Add listing management, Clerk plan descriptions and checkout, publishing allowances, downgrade selection, multi-property calendars, and booking-request actions.

**Dependencies:** B2, B3, B5, F1.

### F5. Trips and simulated earnings

Build trip groups, reservation details, cancellation/refund previews, late-cancellation support requests, and wishlist management. Provide host occupancy and simulated financial summaries using Bklit charts with accessible tables.

**Dependencies:** B6, F3, F4.

### F6. Messaging, notifications, and reviews

Build responsive inbox layouts, live messages, unread badges, retry behavior, and contextual reservation links. Add notifications and review forms explaining deadlines and delayed publication.

**Dependencies:** B6, F3–F5.

### F7. Accessibility, resilience, and final integration

Complete loading, empty, error, permission, and image-fallback states. Verify keyboard access, focus management, reduced motion, contrast, touch targets, narrow containers, and 200% zoom.

Lazy-load heavy surfaces, optimize images, run Playwright journeys and Impeccable visual review, and verify production builds.

**Acceptance:** all agreed guest and host journeys pass without critical functional or accessibility defects.

## Linear and delivery rules

- Use the existing Checkin project and create 15 milestones: Phase 0, B1–B7, and F1–F7.
- Preserve existing completed work and link follow-ups.
- Give every milestone and issue a substantive description covering purpose, behavior, scope, dependencies, acceptance criteria, and verification.
- Explicitly state the no-Vitest exception in testing issues and project documentation.
- Link backend dependencies to frontend issues.
- Follow Backlog → Todo → In Progress → In Review → Done.
- Create a `codex/` branch and PR per phase or separately delivered feature.
- Merge only after approval; attach relevant checks and screenshots.

Delivery order: **Phase 0 → B1/F1 → B2/B3 → B4/F2 → B5/F3/F4 → B6/F5/F6 → B7/F7**.

## Interfaces, testing, and defaults

Convex owns application records and permissions; Clerk owns authentication and subscriptions. Reservation simulation sits behind a replaceable payment-provider interface. Settlement, webhook processing, scheduled transitions, and support overrides remain internal.

Testing commands will distinguish:

- `pnpm test`: isolated Node-runner tests.
- `pnpm test:integration`: dedicated Convex test-deployment checks.
- `pnpm test:e2e`: Playwright browser journeys.

Linting uses the latest ESLint (currently 10.x) with flat config; keep it current rather than pinning back to 9.

Required scenarios include cross-user access, overlapping and adjacent stays, timezone boundaries, exact cancellation cutoffs, duplicate refunds, subscription downgrade, webhook replay, concurrent publishing, pagination, map failure, review reveal, and unread-message behavior. Run lint, type checking, and production builds alongside them.

Integration tests must fail early if a dedicated test target is not configured; they must never fall back to production. Use run-specific fixtures and targeted cleanup.

Defaults remain English, USD, one reservable unit per listing, 1–28-night stays, editable 15:00/11:00 check-in/out, a sample 10% accommodation service fee, and zero demo tax. Host proceeds equal accommodation plus cleaning fees.

Refresh relevant documentation through Context7 and official sources during implementation. Follow Next.js and Convex guidance **except where it conflicts with the explicit no-Vitest instruction**.

Real payments, payouts, taxes, email/SMS, co-host teams, multi-currency settlement, and external calendar synchronization remain future work.
