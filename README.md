# Checkin

Checkin is a full-stack marketplace for discovering stays, managing listings, and reserving a place to stay. It is being built with a guest experience inspired by familiar travel marketplaces and practical tools for hosts.

The project is in active development. The current release establishes authentication plus the backend foundation for host-managed listings; search, reservations, payments, and host dashboards remain roadmap work.

## What is implemented

- Clerk authentication is connected to Convex.
- Signed-in users get an application profile keyed to Clerk's stable token identifier.
- Convex helpers derive the authenticated user on the server and provide typed authorization errors for future resource ownership checks.
- Hosts can create, edit, publish, unpublish, archive, and safely delete unused listing drafts through ownership-scoped Convex functions.
- Listing photos use Convex storage, pending uploads expire for cleanup, and blocked dates and nightly overrides are maintained separately from listing documents.
- Public listing reads expose only approximate locations and never return a property's exact address.
- Public discovery remains the intended model; future private pages and backend operations must enforce authentication and ownership at the resource itself.
- Isolated TypeScript tests run through Node's built-in test runner and `tsx`.

## Technology

- [Next.js 16](https://nextjs.org/) and React 19
- [Convex](https://www.convex.dev/) for application data and server functions
- [Clerk](https://clerk.com/) for identity and future subscription management
- Tailwind CSS 4
- TypeScript, pnpm, ESLint 10

## Requirements

- Node.js 20.9 or newer
- pnpm
- A Clerk development instance configured for this app
- A Convex development deployment

## Local setup

1. Install dependencies.

   ```bash
   pnpm install
   ```

2. Create a local environment file (for example, `.env.local`). Do not commit it. The app currently requires these values:

   | Variable                            | Used by                           |
   | ----------------------------------- | --------------------------------- |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Next.js / Clerk client            |
   | `CLERK_SECRET_KEY`                  | Next.js / Clerk server            |
   | `NEXT_PUBLIC_CONVEX_URL`            | Convex client                     |
   | `CLERK_FRONTEND_API_URL`            | Convex Clerk issuer configuration |

   Obtain the values from your Clerk and Convex development environments; this repository intentionally contains no credentials or environment values.

3. Start Convex in one terminal.

   ```bash
   pnpm run backend
   ```

4. Start the Next.js app in another terminal.

   ```bash
   pnpm run frontend
   ```

5. Visit [http://localhost:3000](http://localhost:3000).

## Commands

| Command             | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `pnpm run frontend` | Start the Next.js development server.                  |
| `pnpm run backend`  | Start Convex development.                              |
| `pnpm run build`    | Create a production Next.js build.                     |
| `pnpm start`        | Run the production server after a build.               |
| `pnpm run lint`     | Run ESLint.                                            |
| `pnpm test`         | Run isolated TypeScript tests with Node's test runner. |

## Authentication and authorization

Clerk owns sign-in identities. Convex owns Checkin records, including the identity-linked user profile. Backend code must always establish the caller from Convex authentication context and enforce access against the specific resource being read or changed; a client-supplied user ID is never proof of ownership.

For manual verification, use three separate Clerk test accounts: a guest, a host, and an unrelated user. Check email/password, Google, and GitHub sign-in independently. Each account should create or refresh only its own profile. As private resources are added, verify that unauthenticated users are sent to sign-in and that one account cannot read or mutate another account's data.

## Testing policy

This project deliberately does **not** use Vitest or `convex-test`.

- `pnpm test` is reserved for isolated logic such as pricing, dates, and cancellation policies, using Node's built-in test runner with `tsx`.
- A future `pnpm test:integration` command will target a dedicated, non-production Convex deployment and must fail early when that target is not configured.
- A future `pnpm test:e2e` command will cover browser journeys, responsive behavior, and accessibility with Playwright.

Never point tests or fixtures at production data.

## Product roadmap

The implementation plan is maintained in [`.claude/plans/PLAN.md`](.claude/plans/PLAN.md). Its delivery sequence is:

1. **B1 — Authentication, permissions, and testing foundation** (current foundation)
2. **B2–B7 — Backend:** listings and availability, Clerk billing, search, reservations, dashboards, and operational verification
3. **F1–F7 — Frontend:** design system, discovery and maps, booking, host tools, trips and earnings, messaging, and final accessibility/resilience work

The planned marketplace supports instant booking and request-to-book. Until a real payment provider is deliberately introduced, reservation payments, refunds, transfers, and payouts will be clearly marked as simulations. Other agreed defaults include English and USD, one reservable unit per listing, 1–28-night stays, editable 15:00 check-in / 11:00 checkout defaults, a sample 10% accommodation service fee, and zero demo tax.

Real payments, payouts, taxes, email/SMS delivery, co-host teams, multi-currency settlement, and external calendar synchronization remain future work.

## Contributing

Use a `codex/` feature branch and pull request for each implementation phase if you're ChatGPT and use `claude/` if you're Claude. Do not merge a phase until it has been reviewed and approved. Keep environment files, credentials, generated caches, and other secrets out of Git.
