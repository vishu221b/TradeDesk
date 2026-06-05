import type { Summary } from "../api/types";

/**
 * Build the opening message for a chat seeded from a saved summary, so the user
 * can immediately ask follow-up questions with the summary already in context.
 */
export function summaryChatSeed(s: Pick<Summary, "title" | "summary">): string {
  return `Here's an AI summary I generated titled "${s.title}":\n\n${s.summary}\n\nUsing this as context, help me with: `;
}
