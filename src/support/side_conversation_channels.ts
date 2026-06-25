/**
 * Accepted side-conversation channels. Kept free of Lucid/DB imports so the
 * validator can be unit-tested in isolation. Mirrors the Laravel
 * SideConversationController's allowed `channel` values.
 */
export const SIDE_CONVERSATION_CHANNELS = ['internal', 'email'] as const

export type SideConversationChannel = (typeof SIDE_CONVERSATION_CHANNELS)[number]

/** Whether a channel value is one of the accepted values. */
export function isValidChannel(channel: string): boolean {
  return (SIDE_CONVERSATION_CHANNELS as readonly string[]).includes(channel)
}
