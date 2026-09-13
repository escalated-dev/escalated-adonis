import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertPublicHttpUrl,
  isPublicAddress,
  UnsafeOutboundUrlError,
} from '../../src/support/outbound_url.ts'

/**
 * Outbound webhooks POST to a URL an admin types in. Without a check on where
 * that URL points, the server can be made to call its own loopback interface,
 * the private network, or a cloud metadata endpoint (169.254.169.254), and the
 * delivery log shows the response. The check runs on the addresses a host name
 * resolves to, so a public-looking name that resolves inward is refused too.
 */

const resolvesTo =
  (...addresses: string[]) =>
  async () =>
    addresses

const mustNotResolve = async (): Promise<string[]> => {
  throw new Error('an IP literal must not be resolved')
}

describe('isPublicAddress', () => {
  it('refuses loopback, private, shared, link-local, reserved and multicast IPv4', () => {
    for (const address of [
      '0.0.0.0',
      '10.0.0.5',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.3.4',
      '192.0.2.1',
      '192.168.1.10',
      '198.18.0.1',
      '203.0.113.9',
      '224.0.0.1',
      '255.255.255.255',
    ]) {
      assert.equal(isPublicAddress(address), false, address)
    }
  })

  it('refuses loopback, unspecified, mapped, unique-local, link-local and documentation IPv6', () => {
    for (const address of [
      '::',
      '::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '64:ff9b::a00:1',
      '2001:db8::1',
      'fd00::1',
      'fe80::1',
      'ff02::1',
    ]) {
      assert.equal(isPublicAddress(address), false, address)
    }
  })

  it('accepts public addresses', () => {
    for (const address of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111']) {
      assert.equal(isPublicAddress(address), true, address)
    }
  })

  it('refuses anything that is not an IP address', () => {
    assert.equal(isPublicAddress('example.com'), false)
    assert.equal(isPublicAddress(''), false)
  })
})

describe('assertPublicHttpUrl', () => {
  it('accepts an http(s) URL whose host resolves only to public addresses', async () => {
    await assertPublicHttpUrl('https://hooks.example.com/escalated', {
      resolve: resolvesTo('93.184.216.34'),
    })
    await assertPublicHttpUrl('http://93.184.216.34:8080/hook', { resolve: mustNotResolve })
  })

  it('refuses a host that resolves to any non-public address', async () => {
    await assert.rejects(
      assertPublicHttpUrl('https://internal.example.com/hook', {
        resolve: resolvesTo('93.184.216.34', '10.0.0.7'),
      }),
      UnsafeOutboundUrlError
    )
  })

  it('refuses non-public IP literals, however they are written, without resolving them', async () => {
    for (const url of [
      'http://127.0.0.1:3333/hook',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/hook',
      'http://[::ffff:127.0.0.1]/hook',
      'http://0x7f000001/hook',
      'http://2130706433/hook',
    ]) {
      await assert.rejects(
        assertPublicHttpUrl(url, { resolve: mustNotResolve }),
        UnsafeOutboundUrlError,
        url
      )
    }
  })

  it('refuses a host that does not resolve', async () => {
    await assert.rejects(
      assertPublicHttpUrl('https://nowhere.invalid/hook', {
        resolve: async () => {
          throw new Error('ENOTFOUND')
        },
      }),
      UnsafeOutboundUrlError
    )
  })

  it('refuses other schemes, credentials and malformed URLs', async () => {
    for (const url of [
      'ftp://example.com/hook',
      'file:///etc/passwd',
      'https://user:secret@example.com/hook',
      'not a url',
    ]) {
      await assert.rejects(
        assertPublicHttpUrl(url, { resolve: resolvesTo('93.184.216.34') }),
        UnsafeOutboundUrlError,
        url
      )
    }
  })

  it('allows non-public destinations only when explicitly told to, and still checks the scheme', async () => {
    await assertPublicHttpUrl('http://127.0.0.1:3333/hook', { allowPrivate: true })
    await assert.rejects(
      assertPublicHttpUrl('ftp://127.0.0.1/hook', { allowPrivate: true }),
      UnsafeOutboundUrlError
    )
  })
})
