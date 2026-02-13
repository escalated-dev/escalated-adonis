/*
|--------------------------------------------------------------------------
| Escalated TypeScript Interfaces
|--------------------------------------------------------------------------
*/

import { t } from './support/i18n.js'

/**
 * Ticket statuses
 */
export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_on_customer'
  | 'waiting_on_agent'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'reopened'

/**
 * Ticket priorities
 */
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent' | 'critical'

/**
 * Activity types
 */
export type ActivityType =
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'priority_changed'
  | 'tag_added'
  | 'tag_removed'
  | 'escalated'
  | 'sla_breached'
  | 'replied'
  | 'note_added'
  | 'department_changed'
  | 'reopened'
  | 'resolved'
  | 'closed'

/**
 * Inbound email statuses
 */
export type InboundEmailStatus = 'pending' | 'processed' | 'failed' | 'spam'

/**
 * Status transition map
 */
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'waiting_on_customer', 'waiting_on_agent', 'escalated', 'resolved', 'closed'],
  in_progress: ['waiting_on_customer', 'waiting_on_agent', 'escalated', 'resolved', 'closed'],
  waiting_on_customer: ['open', 'in_progress', 'resolved', 'closed'],
  waiting_on_agent: ['open', 'in_progress', 'escalated', 'resolved', 'closed'],
  escalated: ['in_progress', 'resolved', 'closed'],
  resolved: ['reopened', 'closed'],
  closed: ['reopened'],
  reopened: ['in_progress', 'waiting_on_customer', 'waiting_on_agent', 'escalated', 'resolved', 'closed'],
}

/**
 * Status labels (localized via i18n)
 */
export function getStatusLabels(): Record<TicketStatus, string> {
  return {
    open: t('labels.status.open'),
    in_progress: t('labels.status.in_progress'),
    waiting_on_customer: t('labels.status.waiting_on_customer'),
    waiting_on_agent: t('labels.status.waiting_on_agent'),
    escalated: t('labels.status.escalated'),
    resolved: t('labels.status.resolved'),
    closed: t('labels.status.closed'),
    reopened: t('labels.status.reopened'),
  }
}

/**
 * Status labels (backward-compatible constant, English defaults)
 */
export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_customer: 'Waiting on Customer',
  waiting_on_agent: 'Waiting on Agent',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
}

/**
 * Status colors
 */
export const STATUS_COLORS: Record<TicketStatus, string> = {
  open: '#3B82F6',
  in_progress: '#8B5CF6',
  waiting_on_customer: '#F59E0B',
  waiting_on_agent: '#F97316',
  escalated: '#EF4444',
  resolved: '#10B981',
  closed: '#6B7280',
  reopened: '#3B82F6',
}

/**
 * Priority labels (localized via i18n)
 */
export function getPriorityLabels(): Record<TicketPriority, string> {
  return {
    low: t('labels.priority.low'),
    medium: t('labels.priority.medium'),
    high: t('labels.priority.high'),
    urgent: t('labels.priority.urgent'),
    critical: t('labels.priority.critical'),
  }
}

/**
 * Priority labels (backward-compatible constant, English defaults)
 */
export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
  critical: 'Critical',
}

/**
 * Priority colors
 */
export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: '#6B7280',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#F97316',
  critical: '#EF4444',
}

/**
 * Priority weights
 */
export const PRIORITY_WEIGHTS: Record<TicketPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
  critical: 5,
}

/**
 * Check if a status can transition to another status
 */
export function canTransitionTo(from: TicketStatus, to: TicketStatus): boolean {
  const allowed = STATUS_TRANSITIONS[from] || []
  return allowed.includes(to)
}

/**
 * Check if a status is considered "open"
 */
export function isOpenStatus(status: TicketStatus): boolean {
  return !['resolved', 'closed'].includes(status)
}

/**
 * Configuration interface for the escalated package
 */
export interface EscalatedConfig {
  mode: 'self-hosted' | 'synced' | 'cloud'

  locale?: string

  userModel: string

  hosted: {
    apiUrl: string
    apiKey?: string
  }

  routes: {
    enabled: boolean
    prefix: string
    middleware: string[]
    adminMiddleware: string[]
  }

  tablePrefix: string

  tickets: {
    allowCustomerClose: boolean
    autoCloseResolvedAfterDays: number
    maxAttachmentsPerReply: number
    maxAttachmentSizeKb: number
  }

  priorities: TicketPriority[]
  defaultPriority: TicketPriority

  statuses: TicketStatus[]

  sla: {
    enabled: boolean
    businessHoursOnly: boolean
    businessHours: {
      start: string
      end: string
      timezone: string
      days: number[]
    }
  }

  notifications: {
    channels: string[]
    webhookUrl?: string
    webhookSecret?: string
  }

  storage: {
    disk: string
    path: string
  }

  authorization: {
    isAgent: (user: any) => boolean | Promise<boolean>
    isAdmin: (user: any) => boolean | Promise<boolean>
  }

  plugins: {
    enabled: boolean
    path: string
  }

  activityLog: {
    retentionDays: number
  }

  inboundEmail: {
    enabled: boolean
    adapter: string
    address: string
    mailgun: {
      signingKey?: string
    }
    postmark: {
      token?: string
    }
    ses: {
      region: string
      topicArn?: string
    }
    imap: {
      host?: string
      port: number
      encryption: string
      username?: string
      password?: string
      mailbox: string
    }
  }
}

/**
 * Inbound email message (normalized from any adapter)
 */
export interface InboundMessage {
  messageId?: string
  fromEmail: string
  fromName?: string
  toEmail: string
  subject: string
  bodyText?: string
  bodyHtml?: string
  inReplyTo?: string
  references?: string
  rawHeaders?: Record<string, string>
  attachments: InboundAttachment[]
}

/**
 * Inbound email attachment
 */
export interface InboundAttachment {
  filename: string
  contentType: string
  content: Buffer | string
  size: number
}

/**
 * Macro action
 */
export interface MacroAction {
  type: 'status' | 'priority' | 'assign' | 'tags' | 'department' | 'reply' | 'note'
  value: any
}

/**
 * Escalation rule condition
 */
export interface EscalationCondition {
  field: string
  value: any
}

/**
 * Escalation rule action
 */
export interface EscalationAction {
  type: 'escalate' | 'change_priority' | 'assign_to' | 'change_department'
  value?: any
}

/**
 * Bulk action request payload
 */
export interface BulkActionPayload {
  ticketIds: number[]
  action: 'status' | 'priority' | 'assign' | 'tags' | 'department' | 'delete'
  value?: any
}

/**
 * Blocked file extensions for inbound email
 */
export const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif', 'vbs', 'vbe',
  'js', 'jse', 'wsf', 'wsh', 'ps1', 'psm1', 'psd1', 'reg',
  'cpl', 'hta', 'inf', 'lnk', 'sct', 'shb', 'sys', 'drv',
  'php', 'phtml', 'php3', 'php4', 'php5', 'phar',
  'sh', 'bash', 'csh', 'ksh', 'pl', 'py', 'rb',
  'dll', 'so', 'dylib',
]

/**
 * Allowed HTML tags for inbound email body sanitization
 */
export const ALLOWED_HTML_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr', 'div',
  'span', 'sub', 'sup',
]

/**
 * Allowed sort columns for ticket listing
 */
export const ALLOWED_SORT_COLUMNS = [
  'created_at', 'updated_at', 'status', 'priority',
  'subject', 'reference', 'assigned_to', 'department_id',
  'resolved_at', 'closed_at',
]

// ---- Plugin Types ----

/**
 * Plugin manifest (plugin.json)
 */
export interface PluginManifest {
  name: string
  description?: string
  version?: string
  author?: string
  author_url?: string
  requires?: string
  main_file?: string
}

/**
 * Plugin info returned by PluginService.getAllPlugins()
 */
export interface PluginInfo {
  slug: string
  name: string
  description: string
  version: string
  author: string
  authorUrl: string
  requires: string
  mainFile: string
  isActive: boolean
  activatedAt: string | null
  path: string
  source: string
}

/**
 * Plugin configuration section of EscalatedConfig
 */
export interface PluginConfig {
  enabled: boolean
  path: string
}
