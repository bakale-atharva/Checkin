import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Discovery stays public; account areas require sign-in. Convex functions
// enforce ownership independently of this redirect.
const isProtectedRoute = createRouteMatcher([
  "/hosting(.*)",
  "/trips(.*)",
  "/checkout(.*)",
  "/messages(.*)",
  "/wishlists(.*)",
  "/billing(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
