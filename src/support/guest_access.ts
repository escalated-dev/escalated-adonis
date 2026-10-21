import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { DateTime } from 'luxon'
import { escalatedDb, getConfig } from '../helpers/config.js'
import { defaultGuestRateLimitStore, type GuestRateLimitStore } from './guest_rate_limit.js'
import type Ticket from '../models/ticket.js'

/*
|--------------------------------------------------------------------------
| Verified guest access
|--------------------------------------------------------------------------
|
| Ports escalated-laravel's GuestEmailVerification and GuestAccess (see
| docs/guest-access.md).
|
| A guest proves they can read a mailbox with an eight-digit code emailed to
| it (`challenge`, then `consume`). A proven ticket gets an expiring grant
| (`issue`): an opaque, encrypted token whose random nonce is stored on the
| ticket only as a SHA-256 hash. Issuing again rotates the nonce, which revokes
| earlier grants and the attachment links issued with them.
|
*/

export const PURPOSES = ['ticket', 'chat', 'lookup'] as const
export type GuestPurpose = (typeof PURPOSES)[number]

export const CODE_TTL_SECONDS = 600
export const MAX_ATTEMPTS = 5
export const INVALID_CODE = 'This code is invalid, expired or already used. Request a new code.'
const GRANT_PURPOSE = 'escalated-guest-access'
const DIGEST_PURPOSE = 'escalated-guest-email'
const HOUR_MS = 3_600_000

export interface GuestAccessConfig {
  /** Grant lifetime in minutes. Default 1440 (24 h), clamped to 5 minutes .. 7 days. */
  ttlMinutes?: number
  /** Codes one client IP may request for one mailbox per hour. Default 3. */
  challengesPerClientPerHour?: number
  /** Codes one mailbox may receive per hour, across clients. Default 10. */
  challengesPerMailboxPerHour?: number
  /**
   * Keep accepting the permanent 64-character guest tokens issued before
   * verified access, during a transition. Default false, as in Laravel.
   */
  legacyTokens?: boolean
  /**
   * Delivers a code. Defaults to `@adonisjs/mail`. Hosts may route it through
   * their own mailer; tests capture it here.
   */
  sendCode?: (email: string, code: string, purpose: GuestPurpose) => Promise<void> | void
  /** Where the hourly code budgets are counted. Default: `guestRateLimit.store`, else memory. */
  store?: GuestRateLimitStore
}

export class InvalidEmail extends Error {}
export class InvalidCode extends Error {
  constructor() {
    super(INVALID_CODE)
  }
}
export class TooManyChallenges extends Error {
  constructor(public retryAfter: number) {
    super('Please wait before requesting another code.')
  }
}

function options(): GuestAccessConfig {
  return ((getConfig() as any).guestAccess ?? {}) as GuestAccessConfig
}

function clamp(value: unknown, fallback: number, low: number, high: number): number {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(low, Math.min(high, Math.floor(number)))
}

export function grantTtlMinutes(): number {
  return clamp(options().ttlMinutes, 1440, 5, 10080)
}

export function legacyTokensEnabled(): boolean {
  return options().legacyTokens === true
}

export function normalizeEmail(email: unknown): string {
  return String(email ?? '')
    .trim()
    .toLowerCase()
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= 255 && EMAIL_PATTERN.test(email)
}

/** A keyed digest (the application's encryption key) of `value`. */
export async function digest(value: string): Promise<string> {
  const { default: encryption } = await import('@adonisjs/core/services/encryption')
  return encryption.blindIndex(value, DIGEST_PURPOSE)
}

export async function emailDigest(email: unknown): Promise<string> {
  return digest(normalizeEmail(email))
}

function same(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

// ---------------------------------------------------------------------------
// Email codes
// ---------------------------------------------------------------------------

async function deliver(email: string, code: string, purpose: GuestPurpose) {
  const custom = options().sendCode
  if (custom) return custom(email, code, purpose)
  const { default: mail } = await import('@adonisjs/mail/services/main')
  await mail.send((message: any) => {
    message
      .to(email)
      .subject('Your support verification code')
      .text(
        `Your verification code is ${code}.\n\n` +
          'It expires in 10 minutes. If you did not ask for it, you can ignore this email.\n'
      )
  })
}

/**
 * Email a one-time code for `purpose` and return the verification id.
 *
 * Delivery is budgeted per mailbox and client IP, so one client cannot exhaust
 * the owner's budget, and per mailbox across all clients, so the mailbox
 * cannot be flooded.
 */
export async function challenge(
  rawEmail: unknown,
  purpose: string,
  clientIp: string
): Promise<string> {
  const email = normalizeEmail(rawEmail)
  if (!(PURPOSES as readonly string[]).includes(purpose) || !isValidEmail(email)) {
    throw new InvalidEmail('Enter a valid email address.')
  }

  const config = options()
  const perClient = clamp(config.challengesPerClientPerHour, 3, 1, 1000)
  const perMailbox = Math.max(perClient, clamp(config.challengesPerMailboxPerHour, 10, 1, 1000))
  const store =
    config.store ?? (getConfig() as any).guestRateLimit?.store ?? defaultGuestRateLimitStore
  const mailboxKey = `escalated:guest-email:${await digest(email)}`
  const clientKey = `${mailboxKey}:client:${await digest(clientIp || '')}`

  for (const [key, limit] of [
    [clientKey, perClient],
    [mailboxKey, perMailbox],
  ] as const) {
    const { count, resetInMs } = await store.hit(key, HOUR_MS)
    if (count > limit) throw new TooManyChallenges(Math.max(1, Math.ceil(resetInMs / 1000)))
  }

  const { default: GuestVerification } = await import('../models/guest_verification.js')
  // Codes are short-lived; old rows are swept as new ones are made.
  await purgeExpiredVerifications()
  const id = randomUUID()
  const code = String(randomInt(0, 100_000_000)).padStart(8, '0')
  const verification = await GuestVerification.create({
    id,
    emailDigest: await digest(email),
    purpose,
    codeHash: await digest(`${id}:${code}`),
    attempts: 0,
    expiresAt: DateTime.now().plus({ seconds: CODE_TTL_SECONDS }),
    usedAt: null,
  })

  try {
    await deliver(email, code, purpose as GuestPurpose)
  } catch (error) {
    await verification.delete()
    throw error
  }
  return id
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Consume a code, then run `callback`.
 *
 * Every guess is counted, right or wrong, and a wrong guess is never undone.
 * The code is claimed with a conditional update, so two requests cannot both
 * spend it. If `callback` throws, the claim is released so the guest can
 * retry with the same code. Throws `InvalidCode`.
 */
export async function consume<T>(
  verificationId: unknown,
  code: unknown,
  email: unknown,
  purpose: GuestPurpose,
  callback: () => Promise<T>
): Promise<T> {
  if (typeof verificationId !== 'string' || !UUID_PATTERN.test(verificationId)) {
    throw new InvalidCode()
  }
  const { default: GuestVerification } = await import('../models/guest_verification.js')
  const table = await escalatedDb()
  const now = DateTime.now()
  const verification = await GuestVerification.find(verificationId)
  if (
    !verification ||
    verification.usedAt ||
    verification.expiresAt <= now ||
    verification.attempts >= MAX_ATTEMPTS
  ) {
    throw new InvalidCode()
  }

  // Count the guess, unless a concurrent guess got there first.
  const counted = await table
    .from(GuestVerification.table)
    .where('id', verification.id)
    .where('attempts', verification.attempts)
    .whereNull('used_at')
    .update({ attempts: verification.attempts + 1 })
  if (Number(Array.isArray(counted) ? counted[0] : counted) !== 1) throw new InvalidCode()

  const matches =
    same(verification.codeHash, await digest(`${verification.id}:${String(code ?? '')}`)) &&
    same(verification.emailDigest, await emailDigest(email)) &&
    verification.purpose === purpose
  if (!matches) throw new InvalidCode()

  const claimed = await table
    .from(GuestVerification.table)
    .where('id', verification.id)
    .whereNull('used_at')
    .update({ used_at: now.toFormat('yyyy-MM-dd HH:mm:ss') })
  if (Number(Array.isArray(claimed) ? claimed[0] : claimed) !== 1) throw new InvalidCode()

  try {
    return await callback()
  } catch (error) {
    await table.from(GuestVerification.table).where('id', verification.id).update({ used_at: null })
    throw error
  }
}

/** Deletes codes that expired more than a day ago. Returns how many. */
export async function purgeExpiredVerifications(): Promise<number> {
  const { default: GuestVerification } = await import('../models/guest_verification.js')
  const cutoff = DateTime.now().minus({ days: 1 })
  const deleted = await GuestVerification.query()
    .where('expires_at', '<', cutoff.toFormat('yyyy-MM-dd HH:mm:ss'))
    .delete()
  return Number(Array.isArray(deleted) ? deleted[0] : deleted) || 0
}

// ---------------------------------------------------------------------------
// Grants
// ---------------------------------------------------------------------------

/** Records that the ticket's guest email was proven. Does not save. */
export async function markVerified(ticket: Ticket, email: unknown): Promise<void> {
  ticket.guestVerifiedEmail = await emailDigest(email)
  ticket.guestEmailVerifiedAt = DateTime.now()
}

export async function verified(ticket: Ticket): Promise<boolean> {
  return Boolean(
    ticket.guestEmailVerifiedAt &&
    ticket.guestEmail &&
    ticket.guestVerifiedEmail &&
    same(ticket.guestVerifiedEmail, await emailDigest(ticket.guestEmail))
  )
}

export async function active(ticket: Ticket): Promise<boolean> {
  return Boolean(
    (await verified(ticket)) &&
    ticket.guestAccessHash &&
    ticket.guestAccessHash.length === 64 &&
    ticket.guestAccessExpiresAt &&
    ticket.guestAccessExpiresAt > DateTime.now()
  )
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

/**
 * A new grant for a ticket whose guest email has been proven. Saves the
 * ticket. Revokes earlier grants and the permanent legacy `guest_token`.
 * A trusted entry point: never call it without consuming mailbox proof.
 */
export async function issue(ticket: Ticket): Promise<string> {
  if (!(await verified(ticket))) {
    throw new Error('Guest access requires a verified ticket email.')
  }
  const nonce = randomBytes(48).toString('base64url')
  const expires = DateTime.now().plus({ minutes: grantTtlMinutes() }).startOf('second')
  ticket.guestAccessHash = sha256(nonce)
  ticket.guestAccessExpiresAt = expires
  ticket.guestToken = null
  await ticket.save()

  const { default: encryption } = await import('@adonisjs/core/services/encryption')
  const claims = {
    v: 1,
    t: String(ticket.id),
    n: nonce,
    x: Math.floor(expires.toSeconds()),
    e: ticket.guestVerifiedEmail,
  }
  // Base64url so the grant is safe in a route segment and a header.
  return base64url(encryption.encrypt(claims, undefined, GRANT_PURPOSE))
}

/** The ticket an active grant names, or null. Never accepts a legacy token. */
export async function resolve(token: unknown): Promise<Ticket | null> {
  if (typeof token !== 'string' || token === '' || token.length > 4096) return null
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null
  const { default: encryption } = await import('@adonisjs/core/services/encryption')
  let claims: any
  try {
    claims = encryption.decrypt(Buffer.from(token, 'base64url').toString('utf8'), GRANT_PURPOSE)
  } catch {
    return null
  }
  if (
    !claims ||
    typeof claims !== 'object' ||
    claims.v !== 1 ||
    typeof claims.t !== 'string' ||
    !/^\d+$/.test(claims.t) ||
    typeof claims.n !== 'string' ||
    !Number.isInteger(claims.x) ||
    claims.x <= Math.floor(Date.now() / 1000)
  ) {
    return null
  }

  const { default: TicketModel } = await import('../models/ticket.js')
  const ticket = await TicketModel.find(Number(claims.t))
  if (!ticket || ticket.deletedAt || !(await active(ticket))) return null
  if (Math.floor(ticket.guestAccessExpiresAt!.toSeconds()) !== claims.x) return null
  if (!same(ticket.guestAccessHash, sha256(claims.n))) return null
  if (!same(String(claims.e ?? ''), ticket.guestVerifiedEmail ?? '')) return null
  return ticket
}

/** Revokes every grant and the legacy token. Saves the ticket. */
export async function revoke(ticket: Ticket): Promise<void> {
  ticket.guestAccessHash = null
  ticket.guestAccessExpiresAt = null
  ticket.guestToken = null
  await ticket.save()
}

const LEGACY_TOKEN = /^[A-Za-z0-9]{64}$/

/**
 * The ticket a guest route's token opens: an active grant, or, only with
 * `guestAccess.legacyTokens`, a permanent token issued before verification.
 */
export async function ticketForToken(token: unknown): Promise<Ticket | null> {
  const ticket = await resolve(token)
  if (ticket) return ticket
  if (!legacyTokensEnabled() || typeof token !== 'string' || !LEGACY_TOKEN.test(token)) return null
  const { default: TicketModel } = await import('../models/ticket.js')
  return TicketModel.query().where('guest_token', token).first()
}

/** The current guest credential's hash, for binding guest attachment links. */
export async function guestCredential(ticket: Ticket): Promise<string | null> {
  if (await active(ticket)) return ticket.guestAccessHash
  if (legacyTokensEnabled() && ticket.guestToken) return sha256(`legacy:${ticket.guestToken}`)
  return null
}

/** Headers for guest answers: they carry access credentials. */
export function privateResponse(response: {
  header: (name: string, value: string) => unknown
}): void {
  response.header('Cache-Control', 'no-store, private')
  response.header('Referrer-Policy', 'no-referrer')
}
