/*
|--------------------------------------------------------------------------
| Escalated Configuration
|--------------------------------------------------------------------------
|
| Default configuration for the Escalated support ticket system.
| Users can override this by publishing the config file.
|
*/

import env from '#start/env'
import { EscalatedConfig } from '../src/types.js'

const escalatedConfig: EscalatedConfig = {
  /*
  |--------------------------------------------------------------------------
  | Hosting Mode
  |--------------------------------------------------------------------------
  |
  | Determines how ticket data is stored and synced.
  | - "self-hosted": All data in local DB. No external calls.
  | - "synced": Local DB + events synced to cloud.escalated.dev
  | - "cloud": All CRUD proxied to cloud.escalated.dev
  |
  */
  mode: env.get('ESCALATED_MODE', 'self-hosted') as 'self-hosted' | 'synced' | 'cloud',

  /*
  |--------------------------------------------------------------------------
  | User Model
  |--------------------------------------------------------------------------
  */
  userModel: env.get('ESCALATED_USER_MODEL', '#models/user'),

  /*
  |--------------------------------------------------------------------------
  | Hosted / Cloud Configuration
  |--------------------------------------------------------------------------
  */
  hosted: {
    apiUrl: env.get('ESCALATED_API_URL', 'https://cloud.escalated.dev/api/v1'),
    apiKey: env.get('ESCALATED_API_KEY', undefined),
  },

  /*
  |--------------------------------------------------------------------------
  | Routes
  |--------------------------------------------------------------------------
  */
  routes: {
    enabled: true,
    prefix: 'support',
    middleware: ['auth'],
    adminMiddleware: ['auth'],
  },

  /*
  |--------------------------------------------------------------------------
  | Table Prefix
  |--------------------------------------------------------------------------
  */
  tablePrefix: 'escalated_',

  /*
  |--------------------------------------------------------------------------
  | Tickets
  |--------------------------------------------------------------------------
  */
  tickets: {
    allowCustomerClose: true,
    autoCloseResolvedAfterDays: 7,
    maxAttachmentsPerReply: 5,
    maxAttachmentSizeKb: 10240,
  },

  /*
  |--------------------------------------------------------------------------
  | Priorities
  |--------------------------------------------------------------------------
  */
  priorities: ['low', 'medium', 'high', 'urgent', 'critical'],
  defaultPriority: 'medium',

  /*
  |--------------------------------------------------------------------------
  | Statuses
  |--------------------------------------------------------------------------
  */
  statuses: [
    'open', 'in_progress', 'waiting_on_customer', 'waiting_on_agent',
    'escalated', 'resolved', 'closed', 'reopened',
  ],

  /*
  |--------------------------------------------------------------------------
  | SLA
  |--------------------------------------------------------------------------
  */
  sla: {
    enabled: true,
    businessHoursOnly: false,
    businessHours: {
      start: '09:00',
      end: '17:00',
      timezone: 'UTC',
      days: [1, 2, 3, 4, 5], // Monday through Friday
    },
  },

  /*
  |--------------------------------------------------------------------------
  | Notifications
  |--------------------------------------------------------------------------
  */
  notifications: {
    channels: ['mail', 'database'],
    webhookUrl: env.get('ESCALATED_WEBHOOK_URL', undefined),
    webhookSecret: env.get('ESCALATED_WEBHOOK_SECRET', undefined),
  },

  /*
  |--------------------------------------------------------------------------
  | Storage (Attachments)
  |--------------------------------------------------------------------------
  */
  storage: {
    disk: 'public',
    path: 'escalated/attachments',
  },

  /*
  |--------------------------------------------------------------------------
  | Authorization
  |--------------------------------------------------------------------------
  |
  | Define callback functions that determine whether a user is an agent
  | or admin. Override these in your app's config.
  |
  */
  authorization: {
    isAgent: (user: any) => {
      return typeof user.escalatedAgent === 'function'
        ? user.escalatedAgent()
        : typeof user.isEscalatedAgent === 'boolean'
          ? user.isEscalatedAgent
          : false
    },
    isAdmin: (user: any) => {
      return typeof user.escalatedAdmin === 'function'
        ? user.escalatedAdmin()
        : typeof user.isEscalatedAdmin === 'boolean'
          ? user.isEscalatedAdmin
          : false
    },
  },

  /*
  |--------------------------------------------------------------------------
  | Activity Log
  |--------------------------------------------------------------------------
  */
  activityLog: {
    retentionDays: 90,
  },

  /*
  |--------------------------------------------------------------------------
  | Inbound Email
  |--------------------------------------------------------------------------
  */
  inboundEmail: {
    enabled: !!env.get('ESCALATED_INBOUND_EMAIL', false),
    adapter: env.get('ESCALATED_INBOUND_ADAPTER', 'mailgun'),
    address: env.get('ESCALATED_INBOUND_ADDRESS', 'support@example.com'),
    mailgun: {
      signingKey: env.get('ESCALATED_MAILGUN_SIGNING_KEY', undefined),
    },
    postmark: {
      token: env.get('ESCALATED_POSTMARK_INBOUND_TOKEN', undefined),
    },
    ses: {
      region: env.get('ESCALATED_SES_REGION', 'us-east-1'),
      topicArn: env.get('ESCALATED_SES_TOPIC_ARN', undefined),
    },
    imap: {
      host: env.get('ESCALATED_IMAP_HOST', undefined),
      port: Number(env.get('ESCALATED_IMAP_PORT', '993')),
      encryption: env.get('ESCALATED_IMAP_ENCRYPTION', 'ssl'),
      username: env.get('ESCALATED_IMAP_USERNAME', undefined),
      password: env.get('ESCALATED_IMAP_PASSWORD', undefined),
      mailbox: env.get('ESCALATED_IMAP_MAILBOX', 'INBOX'),
    },
  },
}

export default escalatedConfig
