import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

import { Checkout } from "@/components/booking/checkout";

export default async function CheckoutPage() {
  await auth.protect();
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  );
}
