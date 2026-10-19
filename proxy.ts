import { clerkMiddleware } from "@clerk/nextjs/server";

// Auth is enforced per resource: protected pages call `auth.protect()` and
// Convex functions check ownership. The proxy only attaches Clerk's auth state.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
