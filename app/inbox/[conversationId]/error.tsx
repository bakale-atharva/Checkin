"use client";

import { MessagesSquare } from "lucide-react";

import { RetryButton, RouteMessage } from "@/components/route-message";

/** Shown when the conversation doesn't exist, the viewer isn't a participant, or it failed to load. */
export default function ConversationError({ retry }: { retry: () => void }) {
  return (
    // The inbox shell already renders the page's <main>.
    <RouteMessage
      as="div"
      icon={MessagesSquare}
      title="We couldn’t open this conversation"
      href="/inbox"
      linkLabel="Back to messages"
      action={<RetryButton onRetry={retry} />}
    >
      <p>It may belong to a different account, or the link is incomplete.</p>
    </RouteMessage>
  );
}
