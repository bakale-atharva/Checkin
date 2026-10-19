import { auth } from "@clerk/nextjs/server";

import { NotificationsList } from "@/components/notifications/notifications-list";

export default async function NotificationsPage() {
  await auth.protect();
  return <NotificationsList />;
}
