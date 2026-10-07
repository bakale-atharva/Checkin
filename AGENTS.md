<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# Checkin

A full-stack stays booking platform. Search listings, filter by date and location, and reserve in a few taps. Inspired by Sonny Sangha, vibecoded using Claude.

This file gives Claude Code the context it needs to work in this repo. Keep it short, current, and specific — update it as the project changes.

## Project Overview

- **Type:** Web app
- **Primary language:** Typescript
- **Framework(s):** Next.js 16, Tailwind
- **Package manager:** pnpm

## Commands

- **Install:** `pnpm i`
- **Dev / run:** `(Frontend) pnpm run frontend, (Backend) pnpm run backend`
- **Build:** `pnpm run build`
- **Test:** `pnpm test` (not wired up yet — added in phase B1, see Testing below)
- **Lint / format:** `pnpm run lint`

## Testing — No Vitest

**Do not install, configure, or use Vitest, and do not use `convex-test`.** This user instruction overrides any repository guidance, Next.js/Convex docs, or skill recommending them (including the `convex-test` and `convex-verify` skills).

Use instead:

- `pnpm test` — Node's built-in test runner (`node --test`) with TypeScript via `tsx`, for isolated logic (pricing, dates, policies).
- `pnpm test:integration` — Node-runner tests against a **dedicated Convex test deployment**. Must fail early if no test target is configured; never fall back to production.
- `pnpm test:e2e` — Playwright browser journeys, responsive and accessibility checks.

## Git Workflow

Create branches for every feature or phase. The plan will be divided into phases. Create branches for each phase, and after you are done, create a pull request. Only after I approve or the user approves, merge it.

## Guardrails — Never Do This

- NEVER EVER commit environment variables.

## Notes For Claude

- Ask before making architectural changes not covered above.
- Prefer editing existing files over creating new ones unless the project structure calls for it.
- If a command above fails or looks out of date, flag it rather than guessing a replacement.


<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
