# B1 Authentication and Testing Foundation Design

## Purpose

B1 establishes the durable boundary between Clerk authentication and Checkin application data. It gives every later backend feature one server-side authorization path, while keeping public discovery available and avoiding speculative feature APIs.

## Scope

- Wire Clerk session tokens into the Convex React client.
- Store one identity-linked profile per authenticated account in Convex.
- Provide typed authentication and ownership helpers for Convex functions.
- Expose only profile bootstrap and current-profile reads publicly; keep administrative and test-fixture operations internal.
- Establish Node's native test runner, `tsx`, and a dedicated-only integration-test command.
- Document manual verification of email, Google, and GitHub sign-in plus isolated test identities.

## Non-goals

Listings, reservations, wishlists, messages, checkout, billing, and their route surfaces are deferred to their respective phases. B1 does not automate external Clerk dashboard configuration or commit environment variables.

## Architecture

Clerk remains the source of truth for credentials and session state. A client-only provider composes Clerk's `useAuth` with `ConvexProviderWithClerk`, so Convex receives the session JWT. Convex maps `ctx.auth.getUserIdentity().tokenIdentifier` to a `users` document, never accepting a user identifier as an authorization argument.

The schema has a thin `users` table, keyed and indexed by `tokenIdentifier`, with display fields projected from the authenticated identity. A public idempotent profile bootstrap mutation creates or refreshes the caller's profile. A current-profile query returns only the caller's record. Shared helper functions return a typed identity/profile context or throw one stable, typed authorization error; future domain functions use those helpers before reading or writing private data. Internal-only functions may support controlled test fixtures but must reject use unless an explicit non-production deployment guard is configured.

Every registered Convex function uses object syntax and explicit `args` and `returns` validators. Indexes match the identity lookup path. There are no broad public administrative APIs.

## Access Model

Discovery remains public because B1 introduces no discovery functions. Any new protected function requires `ctx.auth.getUserIdentity()` and derives the actor from the token. Ownership checks compare stored owner/profile IDs with that server-derived actor context. Missing authentication produces a typed `UNAUTHENTICATED` error; ownership failures use `FORBIDDEN`. Callers never select another account by passing a Clerk or Convex user ID.

## Test Design

`pnpm test` runs `node --test` through `tsx` for pure TypeScript tests. `pnpm test:integration` invokes an integration entry point only when a dedicated Convex test deployment URL and an explicit test marker are supplied; it exits non-zero before contacting Convex otherwise. It cannot infer or fall back to a development or production target.

Tests cover the deployment-target guard and auth-error contract with Node's built-in assertions. Convex authorization behavior is exercised through the dedicated deployment using separate Clerk identities for guest, host, and unrelated user after those identities are configured. The repository must contain no Vitest configuration, dependency, or `convex-test` dependency.

## Configuration and Verification

Required values stay outside Git: Clerk's public/secret keys for Next.js, `NEXT_PUBLIC_CONVEX_URL`, and the Clerk issuer URL used by Convex. The integration test requires a separate test target plus an explicit marker. Documentation names variables but never includes values.

Verify the B1 delivery with Node tests, lint, TypeScript checking, and a production build. Deploy Convex only to the configured development/test target, then verify one sign-in per enabled method and confirm an authenticated client can bootstrap and read its own profile while unauthenticated and cross-account attempts are rejected.
