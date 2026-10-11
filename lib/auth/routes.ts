const protectedPrefixes = [
  "/host",
  "/trips",
  "/checkout",
  "/messages",
  "/wishlists",
  "/billing",
];

export const protectedApplicationRoutePatterns = protectedPrefixes.flatMap(
  (prefix) => [prefix, `${prefix}/(.*)`],
);

export function isProtectedApplicationPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
