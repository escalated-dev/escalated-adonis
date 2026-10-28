/**
 * The chat session behind a widget chat token. The widget only ever sees the
 * token (`id` and `session_id` from `POST /chat/start`, as in
 * escalated-laravel); agent routes and the database use the numeric id.
 */
export async function chatSessionFor(token: string) {
  const { default: ChatSession } = await import('../../../src/models/chat_session.js')
  const { hashVisitorToken } = await import('../../../src/services/chat_session_service.js')
  return ChatSession.findByOrFail('visitorToken', hashVisitorToken(token))
}

/** The numeric id of the chat session behind a widget chat token. */
export async function chatSessionIdFor(token: string): Promise<number> {
  const session = await chatSessionFor(token)
  return session.id
}
