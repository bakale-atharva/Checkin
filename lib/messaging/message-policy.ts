export const MESSAGE_RATE_LIMIT = 20;
export const MESSAGE_RATE_WINDOW_MS = 60 * 1000;

export class MessageRateLimitError extends Error {
  constructor() {
    super("Message rate limit exceeded.");
  }
}

export function nextMessageRateLimit(
  current: { windowStartedAt: number; sentCount: number } | null,
  now: number,
) {
  if (!current || now >= current.windowStartedAt + MESSAGE_RATE_WINDOW_MS) {
    return { windowStartedAt: now, sentCount: 1 };
  }
  if (current.sentCount >= MESSAGE_RATE_LIMIT) {
    throw new MessageRateLimitError();
  }
  return { windowStartedAt: current.windowStartedAt, sentCount: current.sentCount + 1 };
}

export function isConversationUnread(
  latestMessageAt: number | undefined,
  lastReadAt: number | undefined,
) {
  return (latestMessageAt ?? 0) > (lastReadAt ?? 0);
}
