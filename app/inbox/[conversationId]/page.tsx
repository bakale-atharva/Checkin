"use client";

import { useParams } from "next/navigation";

import { ConversationThread } from "@/components/messaging/conversation-thread";
import type { Id } from "@/convex/_generated/dataModel";

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  // Keyed so drafts, unsent messages, and the read marker reset per conversation.
  return (
    <ConversationThread
      key={conversationId}
      conversationId={conversationId as Id<"conversations">}
    />
  );
}
