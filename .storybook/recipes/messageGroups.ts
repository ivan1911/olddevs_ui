import type { ChatMessageProps } from "../../src/index.js";

/** Consumer data, deliberately outside the shipped runtime and its public message API. */
export interface TimedAuthor {
  authorId: string;
  createdAt?: number;
}

export function messageDateTime(value: number | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

/** Compare each adjacent pair in the supplied order; equal times and exactly five minutes join. */
export function messageGroupPositions(messages: readonly TimedAuthor[]) {
  const joins = (previous: TimedAuthor | undefined, next: TimedAuthor | undefined) => {
    if (!previous || !next || !previous.authorId || previous.authorId !== next.authorId)
      return false;
    if (!messageDateTime(previous.createdAt) || !messageDateTime(next.createdAt)) return false;
    const delta = next.createdAt! - previous.createdAt!;
    return delta >= 0 && delta <= 300000;
  };
  return messages.map((message, index): NonNullable<ChatMessageProps["groupPosition"]> => {
    const previous = joins(messages[index - 1], message);
    const next = joins(message, messages[index + 1]);
    return previous ? (next ? "middle" : "last") : next ? "first" : "single";
  });
}
