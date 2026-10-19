import { auth } from "@clerk/nextjs/server";

import { WishlistDetail } from "@/components/wishlists/wishlist-detail";

export default async function WishlistPage() {
  await auth.protect();
  return <WishlistDetail />;
}
