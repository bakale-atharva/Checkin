import { auth } from "@clerk/nextjs/server";

import { WishlistsOverview } from "@/components/wishlists/wishlists-overview";

export default async function WishlistsPage() {
  await auth.protect();
  return <WishlistsOverview />;
}
