This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Authentication and testing

Clerk owns sign-in identities; Convex stores an application profile keyed by the authenticated identity's stable token identifier. Private pages, Route Handlers, Server Functions, and Convex operations must enforce authentication at the resource itself; discovery remains public. Never place Clerk or Convex environment values in Git.

Run isolated TypeScript tests with Node's built-in runner:

```bash
pnpm test
```

There is intentionally no Vitest or `convex-test` configuration in this project. B7 will add backend integration suites against a dedicated non-production Convex deployment.

For manual Clerk verification, maintain three isolated test identities: a guest, a host, and an unrelated account. In the Clerk test instance, verify email/password, Google, and GitHub sign-in separately. For each identity, confirm that the authenticated client creates or refreshes only its own Convex profile. When private resources are added, verify that an unauthenticated request redirects to sign-in and one identity cannot read or mutate another identity's data.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
