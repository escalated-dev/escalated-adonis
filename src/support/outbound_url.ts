/*
|--------------------------------------------------------------------------
| Outbound URL safety
|--------------------------------------------------------------------------
|
| Outbound webhooks POST to a URL an admin typed in. Unchecked, that URL can
| point the server at its own loopback interface, the private network, or a
| cloud metadata endpoint such as 169.254.169.254, and the delivery log then
| shows whatever came back.
|
| A URL passes only if every address its host resolves to is public. IP
| literals are checked as written, however they are spelled (the URL parser
| normalises `0x7f000001` to `127.0.0.1`). Callers check on save and again
| before each send, because a host name can resolve somewhere else later.
|
*/

import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

export class UnsafeOutboundUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeOutboundUrlError'
  }
}

/**
 * Address ranges that are not publicly routable, or are reserved for special use.
 *
 * One list per family, and an address is checked only against its own: Node's
 * BlockList matches an IPv4 address against IPv6 rules through its IPv4-mapped
 * form, so the `::ffff:0:0/96` rule would otherwise refuse every IPv4 address.
 */
const NON_PUBLIC_IPV4 = new BlockList()
const NON_PUBLIC_IPV6 = new BlockList()

for (const [network, prefix] of [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, including cloud metadata endpoints
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, including broadcast
] as const) {
  NON_PUBLIC_IPV4.addSubnet(network, prefix, 'ipv4')
}

for (const [network, prefix] of [
  ['::', 96], // unspecified, loopback and IPv4-compatible
  ['::ffff:0:0', 96], // IPv4-mapped
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard
  ['2001::', 23], // IETF protocol assignments, including Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local
  ['ff00::', 8], // multicast
] as const) {
  NON_PUBLIC_IPV6.addSubnet(network, prefix, 'ipv6')
}

/** Whether `address` is an IP address outside every non-public range. */
export function isPublicAddress(address: string): boolean {
  const [unzoned] = address.split('%')
  const family = isIP(unzoned)
  if (family === 0) {
    return false
  }
  return family === 4
    ? !NON_PUBLIC_IPV4.check(unzoned, 'ipv4')
    : !NON_PUBLIC_IPV6.check(unzoned, 'ipv6')
}

export type HostResolver = (hostname: string) => Promise<string[]>

const resolveHost: HostResolver = async (hostname) => {
  const entries = await lookup(hostname, { all: true, verbatim: true })
  return entries.map((entry) => entry.address)
}

export interface OutboundUrlOptions {
  /** Allow non-public destinations. The URL still has to be http(s). */
  allowPrivate?: boolean
  /** Resolves a host name to its addresses. Defaults to the system resolver. */
  resolve?: HostResolver
}

/**
 * Throws `UnsafeOutboundUrlError` unless `url` is an http(s) URL, without
 * credentials, whose host resolves only to public addresses.
 */
export async function assertPublicHttpUrl(
  url: string,
  options: OutboundUrlOptions = {}
): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new UnsafeOutboundUrlError('The webhook URL is not a valid URL.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeOutboundUrlError('The webhook URL must use http or https.')
  }
  if (!parsed.hostname) {
    throw new UnsafeOutboundUrlError('The webhook URL must include a host name.')
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeOutboundUrlError('The webhook URL must not include credentials.')
  }

  if (options.allowPrivate) {
    return
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '')

  let addresses: string[]
  if (isIP(host)) {
    addresses = [host]
  } else {
    try {
      addresses = await (options.resolve ?? resolveHost)(host)
    } catch {
      throw new UnsafeOutboundUrlError(`The webhook host "${host}" could not be resolved.`)
    }
  }

  if (addresses.length === 0) {
    throw new UnsafeOutboundUrlError(`The webhook host "${host}" could not be resolved.`)
  }

  if (!addresses.every(isPublicAddress)) {
    throw new UnsafeOutboundUrlError(
      'The webhook URL resolves to a non-public address, which webhooks may not call. ' +
        'Set webhooks.allowPrivateUrls in config/escalated.ts to allow it.'
    )
  }
}
