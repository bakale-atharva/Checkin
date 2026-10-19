import { auth } from "@clerk/nextjs/server";

import { ReviewPage } from "@/components/reviews/review-page";

export default async function ReservationReviewPage() {
  await auth.protect();
  return <ReviewPage />;
}
