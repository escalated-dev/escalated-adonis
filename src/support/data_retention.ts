import { DateTime } from 'luxon'
import EscalatedSetting from '../models/escalated_setting.js'
import Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import Attachment from '../models/attachment.js'
import AuditLog from '../models/audit_log.js'
import GuestVerification from '../models/guest_verification.js'
import AttachmentService from '../services/attachment_service.js'

/*
|--------------------------------------------------------------------------
| Data retention
|--------------------------------------------------------------------------
|
| The retention settings the admin Data Retention screen stores, and what
| `escalated:purge-expired` does with them. Mirrors escalated-laravel's
| DataRetentionController and PurgeExpiredDataCommand.
|
| Every setting defaults to "never", so nothing is purged until an admin
| chooses a period.
|
*/

export const TICKET_RETENTION = ['never', '1_year', '2_years', '3_years', '5_years']
export const ATTACHMENT_RETENTION = TICKET_RETENTION
export const AUDIT_LOG_RETENTION = ['never', '90_days', '180_days', '365_days']

/** Soft-deleted tickets are kept this long before they are removed for good. */
export const GRACE_PERIOD_DAYS = 30

const RETENTION_DAYS: Record<string, number | null> = {
  'never': null,
  '90_days': 90,
  '180_days': 180,
  '365_days': 365,
  '1_year': 365,
  '2_years': 730,
  '3_years': 1095,
  '5_years': 1825,
}

export type RetentionSettings = {
  retention_closed_tickets: string
  retention_attachments: string
  retention_audit_logs: string
  retention_user_data_gdpr: boolean
}

export async function retentionSettings(): Promise<RetentionSettings> {
  return {
    retention_closed_tickets:
      (await EscalatedSetting.get('retention_closed_tickets', 'never')) ?? 'never',
    retention_attachments:
      (await EscalatedSetting.get('retention_attachments', 'never')) ?? 'never',
    retention_audit_logs: (await EscalatedSetting.get('retention_audit_logs', 'never')) ?? 'never',
    retention_user_data_gdpr: await EscalatedSetting.getBool('retention_user_data_gdpr', false),
  }
}

/** The days a retention value stands for, or null for "never" (and anything unknown). */
export function retentionDays(value: string | null | undefined): number | null {
  return value ? (RETENTION_DAYS[value] ?? null) : null
}

/** The SQL timestamp before which a record falls outside `days`. */
function cutoff(days: number): string {
  return DateTime.now().minus({ days }).toSQL()!
}

async function cutoffFor(key: string): Promise<{ days: number; before: string } | null> {
  const days = retentionDays(await EscalatedSetting.get(key, 'never'))
  return days === null ? null : { days, before: cutoff(days) }
}

function expiredClosedTickets(before: string) {
  return Ticket.query()
    .where('status', 'closed')
    .whereNotNull('closed_at')
    .where('closed_at', '<', before)
    .whereNull('deleted_at')
}

async function count(query: any): Promise<number> {
  const [row] = await query.count('* as total')
  return Number(row?.$extras?.total ?? 0)
}

export type PurgePreview = { tickets: number; attachments: number; audit_logs: number }

/**
 * What a purge would remove now. Never throws: the screen must still render
 * if a table is missing or the database is unwell.
 */
export async function purgePreview(): Promise<PurgePreview> {
  const preview = { tickets: 0, attachments: 0, audit_logs: 0 }

  try {
    const tickets = await cutoffFor('retention_closed_tickets')
    if (tickets) preview.tickets = await count(expiredClosedTickets(tickets.before))

    const attachments = await cutoffFor('retention_attachments')
    if (attachments) {
      preview.attachments = await count(
        Attachment.query().where('created_at', '<', attachments.before)
      )
    }

    const auditLogs = await cutoffFor('retention_audit_logs')
    if (auditLogs) {
      preview.audit_logs = await count(AuditLog.query().where('created_at', '<', auditLogs.before))
    }
  } catch {
    // Tables may not exist yet.
  }

  return preview
}

export type PurgeLogger = { info(message: string): void; success(message: string): void }

/**
 * Remove a ticket for good, with the files of its attachments and of its
 * replies' attachments. Replies, activities and the other per-ticket rows
 * go with it through their foreign keys' ON DELETE CASCADE.
 */
async function destroyTicket(ticket: Ticket, attachments: AttachmentService) {
  const replies = await Reply.query().where('ticket_id', ticket.id).select('id')
  const replyIds = replies.map((reply) => reply.id)
  const files = await Attachment.query().where((query) => {
    query.where((q) => q.where('attachable_type', 'Ticket').where('attachable_id', ticket.id))
    if (replyIds.length > 0) {
      query.orWhere((q) => q.where('attachable_type', 'Reply').whereIn('attachable_id', replyIds))
    }
  })
  for (const file of files) await attachments.delete(file)
  await ticket.delete()
}

/**
 * Apply the retention settings: soft-delete closed tickets past their period
 * (or delete them with `force`), delete attachments and audit log entries past
 * theirs, remove tickets soft-deleted more than the grace period ago, and
 * drop expired guest verification codes. `dryRun` counts and changes nothing.
 */
export async function purgeExpired(
  options: { dryRun?: boolean; force?: boolean },
  log: PurgeLogger
) {
  const dryRun = Boolean(options.dryRun)
  const force = Boolean(options.force)
  const attachments = new AttachmentService()

  if (dryRun) log.info('DRY RUN — no data will be deleted.')

  // Closed tickets
  const tickets = await cutoffFor('retention_closed_tickets')
  if (!tickets) {
    log.info('Closed tickets: retention set to never, skipping.')
  } else {
    const expired = await expiredClosedTickets(tickets.before)
    log.info(`Closed tickets: ${expired.length} records older than ${tickets.days} days.`)
    if (!dryRun && expired.length > 0) {
      if (force) {
        for (const ticket of expired) await destroyTicket(ticket, attachments)
        log.success(`Permanently deleted ${expired.length} closed tickets.`)
      } else {
        await expiredClosedTickets(tickets.before).update({ deleted_at: DateTime.now().toSQL() })
        log.success(
          `Soft-deleted ${expired.length} closed tickets (${GRACE_PERIOD_DAYS}-day grace period).`
        )
      }
    }
  }

  // Attachments
  const files = await cutoffFor('retention_attachments')
  if (!files) {
    log.info('Attachments: retention set to never, skipping.')
  } else {
    const expired = await Attachment.query().where('created_at', '<', files.before)
    log.info(`Attachments: ${expired.length} records older than ${files.days} days.`)
    if (!dryRun && expired.length > 0) {
      for (const file of expired) await attachments.delete(file)
      log.success(`Deleted ${expired.length} attachments.`)
    }
  }

  // Audit logs
  const auditLogs = await cutoffFor('retention_audit_logs')
  if (!auditLogs) {
    log.info('Audit logs: retention set to never, skipping.')
  } else {
    const expired = await count(AuditLog.query().where('created_at', '<', auditLogs.before))
    log.info(`Audit logs: ${expired} records older than ${auditLogs.days} days.`)
    if (!dryRun && expired > 0) {
      await AuditLog.query().where('created_at', '<', auditLogs.before).delete()
      log.success(`Deleted ${expired} audit log entries.`)
    }
  }

  // Soft-deleted tickets past the grace period
  const graceEnded = await Ticket.query()
    .whereNotNull('deleted_at')
    .where('deleted_at', '<', cutoff(GRACE_PERIOD_DAYS))
  if (graceEnded.length === 0) {
    log.info('No soft-deleted records past grace period.')
  } else {
    log.info(
      `Grace period expired: ${graceEnded.length} soft-deleted tickets for permanent removal.`
    )
    if (!dryRun) {
      for (const ticket of graceEnded) await destroyTicket(ticket, attachments)
      log.success(
        `Permanently removed ${graceEnded.length} tickets past ${GRACE_PERIOD_DAYS}-day grace period.`
      )
    }
  }

  // Expired guest verification codes
  const now = DateTime.now().toSQL()!
  const codes = await count(GuestVerification.query().where('expires_at', '<=', now))
  log.info(`Expired guest verification records: ${codes}`)
  if (!dryRun && codes > 0) {
    await GuestVerification.query().where('expires_at', '<=', now).delete()
  }

  log.success('Purge complete.')
}
