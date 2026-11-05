import { createHash, createHmac } from 'node:crypto'
import { getConfig } from '../helpers/config.js'
import type { UserId } from '../helpers/user_id_column.js'

/*
|--------------------------------------------------------------------------
| Realtime: the agent's private channel
|--------------------------------------------------------------------------
|
| The shared frontend listens with Laravel Echo (`window.Echo`, set up by the
| host): `Echo.private('escalated.agents.{id}').listen('.notification.created')`
| (useRealtime / NotificationBell). AdonisJS has no Echo-compatible server of
| its own, so this package sends to one over the Pusher protocol, which Pusher,
| Soketi and Laravel Reverb all speak, or hands each message to a transport the
| host supplies (`broadcasting.transport`).
|
| Echo authorizes a private channel by posting `socket_id` and `channel_name`
| to its `authEndpoint`; point it at `escalated.broadcasting.auth`
| (`POST /{prefix}/agent/broadcasting/auth`), which signs only the signed-in
| agent's own channel.
|
*/

export interface PusherBroadcastConfig {
  appId: string
  key: string
  secret: string
  /** Pusher's cluster (`mt1`, `eu`, ...); ignored when `host` is set. */
  cluster?: string
  /** A Pusher-protocol server such as Soketi or Reverb (default: Pusher's API host). */
  host?: string
  port?: number
  /** Default true (https). */
  useTLS?: boolean
}

export type BroadcastTransport = (
  channel: string,
  event: string,
  data: Record<string, any>
) => void | Promise<void>

export interface EscalatedBroadcastingConfig {
  /** Off by default: nothing is sent and the auth route is not registered. */
  enabled?: boolean
  /** The channel prefix the frontend subscribes with (default `escalated`). */
  channelPrefix?: string
  /** Send over the Pusher HTTP API (Pusher, Soketi, Reverb). */
  pusher?: PusherBroadcastConfig
  /**
   * Or deliver each message yourself. Called with the private channel's name
   * without Echo's `private-` prefix (`escalated.agents.7`), the event name
   * (`notification.created`) and the payload.
   */
  transport?: BroadcastTransport
}

function settings(): EscalatedBroadcastingConfig | undefined {
  return (getConfig() as any)?.broadcasting
}

/** Broadcasting is on and has somewhere to send. */
export function broadcastingEnabled(): boolean {
  const config = settings()
  return Boolean(config?.enabled && (config.transport || config.pusher))
}

/** Broadcasting is on over the Pusher protocol, so Echo needs channel auth. */
export function pusherConfigured(): boolean {
  return broadcastingEnabled() && Boolean(settings()?.pusher)
}

export function channelPrefix(): string {
  return settings()?.channelPrefix || 'escalated'
}

/** The agent's private channel, as the frontend names it: `escalated.agents.{id}`. */
export function agentChannel(agentId: UserId): string {
  return `${channelPrefix()}.agents.${agentId}`
}

/** The transport for the configured broadcasting, or null while it is off. */
export function configuredTransport(): BroadcastTransport | null {
  if (!broadcastingEnabled()) return null
  const config = settings()!
  if (config.transport) return config.transport
  return pusherTransport(config.pusher!)
}

/**
 * Sends to a Pusher-protocol server's HTTP API (`POST /apps/{id}/events`,
 * signed with the app secret). Channels are private: `private-` is added.
 */
export function pusherTransport(
  config: PusherBroadcastConfig,
  fetcher: typeof fetch = fetch
): BroadcastTransport {
  return async (channel, event, data) => {
    const path = `/apps/${config.appId}/events`
    const body = JSON.stringify({
      name: event,
      channels: [`private-${channel}`],
      data: JSON.stringify(data),
    })
    const params: Record<string, string> = {
      auth_key: config.key,
      auth_timestamp: String(Math.floor(Date.now() / 1000)),
      auth_version: '1.0',
      body_md5: createHash('md5').update(body).digest('hex'),
    }
    const query = Object.keys(params)
      .sort()
      .map((name) => `${name}=${params[name]}`)
      .join('&')
    const signature = createHmac('sha256', config.secret)
      .update(`POST\n${path}\n${query}`)
      .digest('hex')
    const tls = config.useTLS !== false
    const host =
      config.host ?? (config.cluster ? `api-${config.cluster}.pusher.com` : 'api.pusherapp.com')
    const port = config.port ? `:${config.port}` : ''
    const response = await fetcher(
      `${tls ? 'https' : 'http'}://${host}${port}${path}?${query}&auth_signature=${signature}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    )
    if (!response.ok) {
      throw new Error(`Pusher responded ${response.status}`)
    }
  }
}

/**
 * The Pusher-protocol signature for a private channel subscription, for the
 * signed-in user's own agent channel only; null for any other channel.
 */
export function authorizeAgentChannel(
  userId: UserId,
  socketId: string,
  channelName: string
): { auth: string } | null {
  const pusher = settings()?.pusher
  if (!pusher || !pusherConfigured()) return null
  if (!/^\d+\.\d+$/.test(socketId)) return null
  if (channelName !== `private-${agentChannel(userId)}`) return null
  const signature = createHmac('sha256', pusher.secret)
    .update(`${socketId}:${channelName}`)
    .digest('hex')
  return { auth: `${pusher.key}:${signature}` }
}
