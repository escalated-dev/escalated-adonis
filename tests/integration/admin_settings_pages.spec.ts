import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Admin settings sub-pages
|--------------------------------------------------------------------------
|
| The shared Admin/Settings/{CsatSettings,DataRetention,DatabaseConnection,
| EmailSettings,PublicTickets} pages, with the routes, props, validation and
| flashes of escalated-laravel's controllers for them, and the
| `escalated:purge-expired` command that enforces the retention settings.
|
*/

const PREFIX = '/support/admin/settings'

const SETTING_KEYS = [
  'csat_question_text',
  'csat_scale',
  'csat_delivery_trigger',
  'csat_delay_hours',
  'retention_closed_tickets',
  'retention_attachments',
  'retention_audit_logs',
  'retention_user_data_gdpr',
  'email_addresses',
  'default_reply_address',
  'guest_policy_mode',
  'guest_policy_user_id',
  'guest_policy_signup_url_template',
]

test.group('Admin settings sub-pages', (group) => {
  let running: TestApp
  let client: InertiaClient
  let sequence = 0

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    await running.db.from('escalated_settings').whereIn('key', SETTING_KEYS).delete()
  })

  group.each.timeout(30_000)

  async function setting(key: string) {
    const row = await running.db.from('escalated_settings').where('key', key).first()
    return row ? row.value : undefined
  }

  async function setSetting(key: string, value: string) {
    const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')
    await EscalatedSetting.set(key, value)
  }

  async function flashAfter(path: string) {
    const page = await client.visit('GET', path)
    return page.body.flash ?? {}
  }

  async function flashed(path: string, key: string) {
    const flash = await flashAfter(path)
    return flash[key]
  }

  async function ticket(fields: Record<string, unknown> = {}) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.create({
      reference: `RET-${Date.now()}-${++sequence}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject: 'Retention',
      description: 'Made by the retention tests',
      status: 'closed',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
      ...fields,
    } as any)
  }

  async function attachment(attachableId: number, daysAgo: number) {
    const { default: Attachment } = await import('../../src/models/attachment.js')
    const row = await Attachment.create({
      attachableType: 'Ticket',
      attachableId,
      filename: `f${++sequence}.txt`,
      originalFilename: 'f.txt',
      mimeType: 'text/plain',
      size: 1,
      disk: 'private',
      path: `escalated/attachments/missing-${sequence}.txt`,
    } as any)
    const at = DateTime.now().minus({ days: daysAgo })
    row.createdAt = at
    await row.save()
    return row
  }

  async function auditLog(daysAgo: number) {
    const { default: AuditLog } = await import('../../src/models/audit_log.js')
    const row = await AuditLog.create({ action: 'settings.updated' } as any)
    await running.db
      .from('escalated_audit_logs')
      .where('id', row.id)
      .update({ created_at: DateTime.now().minus({ days: daysAgo }).toSQL() })
    return row
  }

  async function exists(table: string, id: number | string) {
    return Boolean(await running.db.from(table).where('id', id).first())
  }

  async function deletedAt(id: number) {
    const row = await running.db.from('escalated_tickets').where('id', id).first()
    return row?.deleted_at ?? null
  }

  async function clearRetentionFixtures() {
    await running.db.from('escalated_attachments').delete()
    await running.db.from('escalated_audit_logs').delete()
    await running.db.from('escalated_tickets').where('reference', 'like', 'RET-%').delete()
  }

  async function purge(args: string[] = []) {
    const ace = await running.app.container.make('ace')
    ace.ui.switchMode('raw')
    await ace.boot()
    const command = await ace.exec('escalated:purge-expired', args)
    const logs = ace.ui.logger.getLogs().map((log: { message: string }) => log.message)
    return { command, logs }
  }

  // ---- CsatSettings -------------------------------------------------------------

  test('csat renders CsatSettings with the four settings and their defaults', async ({
    assert,
  }) => {
    const visit = await client.visit('GET', `${PREFIX}/csat`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Settings/CsatSettings')
    assert.deepEqual(visit.body.props.settings, {
      csat_question_text: 'How would you rate your support experience?',
      csat_scale: '1-5',
      csat_delivery_trigger: 'on_resolve',
      csat_delay_hours: 0,
    })
  })

  test('csat update stores the settings and goes back with a success flash', async ({ assert }) => {
    const visit = await client.visit('POST', `${PREFIX}/csat`, {
      data: {
        csat_question_text: 'How did we do?',
        csat_scale: '1-3',
        csat_delivery_trigger: 'delayed',
        csat_delay_hours: 24,
      },
      referer: `${PREFIX}/csat`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, `${PREFIX}/csat`)
    assert.equal(await setting('csat_question_text'), 'How did we do?')
    assert.equal(await setting('csat_scale'), '1-3')
    assert.equal(await setting('csat_delivery_trigger'), 'delayed')
    assert.equal(await setting('csat_delay_hours'), '24')
    assert.equal(await flashed(`${PREFIX}/csat`, 'success'), 'CSAT settings updated.')
  })

  test('an invalid csat form goes back with field errors and stores nothing', async ({
    assert,
  }) => {
    const visit = await client.visit('POST', `${PREFIX}/csat`, {
      data: {
        csat_question_text: '',
        csat_scale: '1-10',
        csat_delivery_trigger: 'never',
        csat_delay_hours: 500,
      },
      referer: `${PREFIX}/csat`,
    })

    assert.equal(visit.status, 302)
    assert.isUndefined(await setting('csat_scale'))
    const flash = await flashAfter(`${PREFIX}/csat`)
    assert.properties(flash.errors, [
      'csat_question_text',
      'csat_scale',
      'csat_delivery_trigger',
      'csat_delay_hours',
    ])
  })

  // ---- PublicTickets ------------------------------------------------------------

  test('public-tickets renders PublicTickets with the guest policy and its defaults', async ({
    assert,
  }) => {
    const visit = await client.visit('GET', `${PREFIX}/public-tickets`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Settings/PublicTickets')
    assert.deepEqual(visit.body.props.settings, {
      guest_policy_mode: 'unassigned',
      guest_policy_user_id: null,
      guest_policy_signup_url_template: '',
    })

    await setSetting('guest_policy_mode', 'guest_user')
    await setSetting('guest_policy_user_id', '42')
    const saved = await client.visit('GET', `${PREFIX}/public-tickets`)
    assert.equal(saved.body.props.settings.guest_policy_mode, 'guest_user')
    assert.strictEqual(saved.body.props.settings.guest_policy_user_id, '42')
  })

  for (const method of ['POST', 'PUT']) {
    test(`public-tickets ${method} saves the policy and goes back with a success flash`, async ({
      assert,
    }) => {
      const visit = await client.visit(method, `${PREFIX}/public-tickets`, {
        data: {
          guest_policy_mode: 'prompt_signup',
          guest_policy_user_id: 7,
          guest_policy_signup_url_template: 'https://example.test/join?email={email}',
        },
        referer: `${PREFIX}/public-tickets`,
      })

      assert.equal(visit.status, 302, JSON.stringify(visit.body))
      assert.equal(visit.location, `${PREFIX}/public-tickets`)
      assert.equal(await setting('guest_policy_mode'), 'prompt_signup')
      // The user id belongs to guest_user mode only.
      assert.equal(await setting('guest_policy_user_id'), '')
      assert.equal(
        await setting('guest_policy_signup_url_template'),
        'https://example.test/join?email={email}'
      )
      assert.equal(await flashed(`${PREFIX}/public-tickets`, 'success'), 'Guest policy updated.')
    })
  }

  test('public-tickets guest_user mode stores the user id and clears the template', async ({
    assert,
  }) => {
    await setSetting('guest_policy_signup_url_template', 'https://old.test')

    const visit = await client.visit('POST', `${PREFIX}/public-tickets`, {
      data: { guest_policy_mode: 'guest_user', guest_policy_user_id: '9' },
      referer: `${PREFIX}/public-tickets`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(await setting('guest_policy_mode'), 'guest_user')
    assert.equal(await setting('guest_policy_user_id'), '9')
    assert.equal(await setting('guest_policy_signup_url_template'), '')
  })

  test('an invalid public-tickets form goes back with field errors and stores nothing', async ({
    assert,
  }) => {
    for (const data of [
      { guest_policy_mode: 'everyone' },
      { guest_policy_mode: 'guest_user' },
      { guest_policy_mode: 'guest_user', guest_policy_user_id: 0 },
      { guest_policy_mode: 'prompt_signup', guest_policy_signup_url_template: 'x'.repeat(501) },
    ]) {
      const visit = await client.visit('POST', `${PREFIX}/public-tickets`, {
        data,
        referer: `${PREFIX}/public-tickets`,
      })
      assert.equal(visit.status, 302, JSON.stringify(data))
      assert.isUndefined(await setting('guest_policy_mode'), JSON.stringify(data))
      const flash = await flashAfter(`${PREFIX}/public-tickets`)
      assert.isNotEmpty(flash.errors, JSON.stringify(data))
    }
  })

  // ---- DataRetention ------------------------------------------------------------

  test('data-retention renders DataRetention with the settings and an empty preview', async ({
    assert,
  }) => {
    await clearRetentionFixtures()

    const visit = await client.visit('GET', `${PREFIX}/data-retention`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Settings/DataRetention')
    assert.deepEqual(visit.body.props.settings, {
      retention_closed_tickets: 'never',
      retention_attachments: 'never',
      retention_audit_logs: 'never',
      retention_user_data_gdpr: false,
    })
    assert.deepEqual(visit.body.props.purgePreview, { tickets: 0, attachments: 0, audit_logs: 0 })
  })

  test('data-retention previews what each setting would purge', async ({ assert }) => {
    await clearRetentionFixtures()
    const old = await ticket({ closedAt: DateTime.now().minus({ days: 400 }) })
    await ticket({ closedAt: DateTime.now().minus({ days: 10 }) })
    await ticket({ status: 'open', closedAt: DateTime.now().minus({ days: 400 }) })
    await ticket({
      closedAt: DateTime.now().minus({ days: 400 }),
      deletedAt: DateTime.now().minus({ days: 1 }),
    })
    await attachment(old.id, 400)
    await attachment(old.id, 1)
    await auditLog(100)
    await auditLog(1)

    await setSetting('retention_closed_tickets', '1_year')
    await setSetting('retention_attachments', '1_year')
    await setSetting('retention_audit_logs', '90_days')
    await setSetting('retention_user_data_gdpr', '1')

    const visit = await client.visit('GET', `${PREFIX}/data-retention`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.deepEqual(visit.body.props.settings, {
      retention_closed_tickets: '1_year',
      retention_attachments: '1_year',
      retention_audit_logs: '90_days',
      retention_user_data_gdpr: true,
    })
    assert.deepEqual(visit.body.props.purgePreview, { tickets: 1, attachments: 1, audit_logs: 1 })
  })

  test('data-retention update stores the settings and goes back with a success flash', async ({
    assert,
  }) => {
    const visit = await client.visit('POST', `${PREFIX}/data-retention`, {
      data: {
        retention_closed_tickets: '2_years',
        retention_attachments: '5_years',
        retention_audit_logs: '180_days',
        retention_user_data_gdpr: true,
      },
      referer: `${PREFIX}/data-retention`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, `${PREFIX}/data-retention`)
    assert.equal(await setting('retention_closed_tickets'), '2_years')
    assert.equal(await setting('retention_attachments'), '5_years')
    assert.equal(await setting('retention_audit_logs'), '180_days')
    assert.equal(await setting('retention_user_data_gdpr'), '1')
    assert.equal(
      await flashed(`${PREFIX}/data-retention`, 'success'),
      'Data retention settings updated.'
    )

    await client.visit('POST', `${PREFIX}/data-retention`, {
      data: {
        retention_closed_tickets: 'never',
        retention_attachments: 'never',
        retention_audit_logs: 'never',
        retention_user_data_gdpr: '0',
      },
      referer: `${PREFIX}/data-retention`,
    })
    assert.equal(await setting('retention_user_data_gdpr'), '0')
  })

  test('an invalid data-retention form goes back with field errors and stores nothing', async ({
    assert,
  }) => {
    const visit = await client.visit('POST', `${PREFIX}/data-retention`, {
      data: {
        retention_closed_tickets: '90_days',
        retention_attachments: 'forever',
        retention_audit_logs: '1_year',
        retention_user_data_gdpr: 'maybe',
      },
      referer: `${PREFIX}/data-retention`,
    })

    assert.equal(visit.status, 302)
    assert.isUndefined(await setting('retention_closed_tickets'))
    const flash = await flashAfter(`${PREFIX}/data-retention`)
    assert.properties(flash.errors, [
      'retention_closed_tickets',
      'retention_attachments',
      'retention_audit_logs',
      'retention_user_data_gdpr',
    ])
  })

  // ---- escalated:purge-expired ---------------------------------------------------

  test('purge-expired leaves everything alone while retention is never', async ({ assert }) => {
    await clearRetentionFixtures()
    const old = await ticket({ closedAt: DateTime.now().minus({ days: 4000 }) })
    const file = await attachment(old.id, 4000)
    const log = await auditLog(4000)

    const { command, logs } = await purge()

    assert.equal(command.exitCode, 0, JSON.stringify(logs))
    assert.isNull(await deletedAt(old.id))
    assert.isTrue(await exists('escalated_attachments', file.id))
    assert.isTrue(await exists('escalated_audit_logs', log.id))
  })

  test('purge-expired soft-deletes old closed tickets and keeps recent and open ones', async ({
    assert,
  }) => {
    await clearRetentionFixtures()
    await setSetting('retention_closed_tickets', '1_year')
    const old = await ticket({ closedAt: DateTime.now().minus({ days: 400 }) })
    const recent = await ticket({ closedAt: DateTime.now().minus({ days: 30 }) })
    const open = await ticket({ status: 'open', closedAt: DateTime.now().minus({ days: 400 }) })

    const { command, logs } = await purge()

    assert.equal(command.exitCode, 0, JSON.stringify(logs))
    assert.isNotNull(await deletedAt(old.id))
    assert.isTrue(await exists('escalated_tickets', old.id))
    assert.isNull(await deletedAt(recent.id))
    assert.isNull(await deletedAt(open.id))
  })

  test('purge-expired --force deletes old closed tickets and their attachments', async ({
    assert,
  }) => {
    await clearRetentionFixtures()
    await setSetting('retention_closed_tickets', '1_year')
    const old = await ticket({ closedAt: DateTime.now().minus({ days: 400 }) })
    const file = await attachment(old.id, 1)
    const { default: Reply } = await import('../../src/models/reply.js')
    const reply = await Reply.create({ ticketId: old.id, body: 'Reply' } as any)
    const replyFile = await attachment(reply.id, 1)
    await running.db
      .from('escalated_attachments')
      .where('id', replyFile.id)
      .update({ attachable_type: 'Reply' })
    const recent = await ticket({ closedAt: DateTime.now().minus({ days: 30 }) })

    const { command, logs } = await purge(['--force'])

    assert.equal(command.exitCode, 0, JSON.stringify(logs))
    assert.isFalse(await exists('escalated_tickets', old.id))
    assert.isFalse(await exists('escalated_attachments', file.id))
    assert.isFalse(await exists('escalated_replies', reply.id))
    assert.isFalse(await exists('escalated_attachments', replyFile.id))
    assert.isTrue(await exists('escalated_tickets', recent.id))
  })

  test('purge-expired permanently deletes tickets soft-deleted over 30 days ago', async ({
    assert,
  }) => {
    await clearRetentionFixtures()
    const expired = await ticket({ deletedAt: DateTime.now().minus({ days: 31 }) })
    const grace = await ticket({ deletedAt: DateTime.now().minus({ days: 5 }) })

    const { command, logs } = await purge()

    assert.equal(command.exitCode, 0, JSON.stringify(logs))
    assert.isFalse(await exists('escalated_tickets', expired.id))
    assert.isTrue(await exists('escalated_tickets', grace.id))
  })

  test('purge-expired deletes old attachments, audit logs and expired guest codes', async ({
    assert,
  }) => {
    await clearRetentionFixtures()
    await setSetting('retention_attachments', '1_year')
    await setSetting('retention_audit_logs', '90_days')
    const owner = await ticket({ status: 'open' })
    const oldFile = await attachment(owner.id, 400)
    const newFile = await attachment(owner.id, 10)
    const oldLog = await auditLog(100)
    const newLog = await auditLog(10)
    const { default: GuestVerification } = await import('../../src/models/guest_verification.js')
    const expiredCode = await GuestVerification.create({
      id: `ret-expired-${++sequence}`,
      emailDigest: 'x',
      purpose: 'lookup',
      codeHash: 'x',
      attempts: 0,
      expiresAt: DateTime.now().minus({ minutes: 5 }),
    } as any)
    const liveCode = await GuestVerification.create({
      id: `ret-live-${++sequence}`,
      emailDigest: 'x',
      purpose: 'lookup',
      codeHash: 'x',
      attempts: 0,
      expiresAt: DateTime.now().plus({ minutes: 5 }),
    } as any)

    const { command, logs } = await purge()

    assert.equal(command.exitCode, 0, JSON.stringify(logs))
    assert.isFalse(await exists('escalated_attachments', oldFile.id))
    assert.isTrue(await exists('escalated_attachments', newFile.id))
    assert.isFalse(await exists('escalated_audit_logs', oldLog.id))
    assert.isTrue(await exists('escalated_audit_logs', newLog.id))
    assert.isFalse(await exists('escalated_guest_verifications', expiredCode.id))
    assert.isTrue(await exists('escalated_guest_verifications', liveCode.id))
  })

  test('purge-expired --dry-run reports and deletes nothing', async ({ assert }) => {
    await clearRetentionFixtures()
    await setSetting('retention_closed_tickets', '1_year')
    await setSetting('retention_attachments', '1_year')
    await setSetting('retention_audit_logs', '90_days')
    const old = await ticket({ closedAt: DateTime.now().minus({ days: 400 }) })
    const expired = await ticket({ deletedAt: DateTime.now().minus({ days: 31 }) })
    const file = await attachment(old.id, 400)
    const log = await auditLog(100)

    const { command, logs } = await purge(['--dry-run'])

    assert.equal(command.exitCode, 0, JSON.stringify(logs))
    assert.isTrue(logs.some((message: string) => message.includes('DRY RUN')))
    assert.isTrue(logs.some((message: string) => message.includes('Closed tickets: 1')))
    assert.isNull(await deletedAt(old.id))
    assert.isTrue(await exists('escalated_tickets', expired.id))
    assert.isTrue(await exists('escalated_attachments', file.id))
    assert.isTrue(await exists('escalated_audit_logs', log.id))
  })

  // ---- EmailSettings ------------------------------------------------------------

  test('email renders EmailSettings with no addresses and no reply address', async ({ assert }) => {
    const visit = await client.visit('GET', `${PREFIX}/email`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Settings/EmailSettings')
    assert.deepEqual(visit.body.props.addresses, [])
    assert.strictEqual(visit.body.props.defaultReplyAddress, '')
  })

  test('email update stores normalised addresses and the reply address', async ({ assert }) => {
    const visit = await client.visit('POST', `${PREFIX}/email`, {
      data: {
        addresses: [
          {
            email: 'help@example.test',
            display_name: 'Help',
            department_id: 3,
            dkim_status: 'verified',
            extra: 'dropped',
          },
          { email: 'billing@example.test' },
        ],
        default_reply_address: 'help@example.test',
      },
      referer: `${PREFIX}/email`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, `${PREFIX}/email`)
    const expected = [
      {
        email: 'help@example.test',
        display_name: 'Help',
        department_id: 3,
        dkim_status: 'verified',
      },
      {
        email: 'billing@example.test',
        display_name: '',
        department_id: null,
        dkim_status: 'unknown',
      },
    ]
    assert.deepEqual(JSON.parse(await setting('email_addresses')), expected)
    assert.equal(await setting('default_reply_address'), 'help@example.test')

    const page = await client.visit('GET', `${PREFIX}/email`)
    assert.equal(page.body.flash.success, 'Email settings updated.')
    assert.deepEqual(page.body.props.addresses, expected)
    for (const address of page.body.props.addresses) {
      assert.sameMembers(Object.keys(address), [
        'email',
        'display_name',
        'department_id',
        'dkim_status',
      ])
    }
    assert.equal(page.body.props.defaultReplyAddress, 'help@example.test')
  })

  test('email update without a reply address leaves the stored one', async ({ assert }) => {
    await setSetting('default_reply_address', 'keep@example.test')

    const visit = await client.visit('POST', `${PREFIX}/email`, {
      data: { addresses: [{ email: 'a@example.test' }] },
      referer: `${PREFIX}/email`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(await setting('default_reply_address'), 'keep@example.test')
  })

  test('an invalid email form goes back with field errors and stores nothing', async ({
    assert,
  }) => {
    const visit = await client.visit('POST', `${PREFIX}/email`, {
      data: {
        addresses: [
          { email: 'not-an-email', dkim_status: 'great', department_id: 'abc' },
          { email: 'ok@example.test', display_name: 'x'.repeat(256) },
        ],
        default_reply_address: 'nope',
      },
      referer: `${PREFIX}/email`,
    })

    assert.equal(visit.status, 302)
    assert.isUndefined(await setting('email_addresses'))
    const flash = await flashAfter(`${PREFIX}/email`)
    assert.properties(flash.errors, [
      'addresses.0.email',
      'addresses.0.dkim_status',
      'addresses.0.department_id',
      'addresses.1.display_name',
      'default_reply_address',
    ])

    const missing = await client.visit('POST', `${PREFIX}/email`, {
      data: { default_reply_address: 'a@example.test' },
      referer: `${PREFIX}/email`,
    })
    assert.equal(missing.status, 302)
    assert.property(await flashed(`${PREFIX}/email`, 'errors'), 'addresses')
    assert.isUndefined(await setting('default_reply_address'))
  })

  // ---- DatabaseConnection -------------------------------------------------------

  test('database renders DatabaseConnection read-only with the connection in use', async ({
    assert,
  }) => {
    const visit = await client.visit('GET', `${PREFIX}/database`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Settings/DatabaseConnection')
    const props = visit.body.props
    assert.equal(props.current, 'sqlite')
    assert.equal(props.hostDefault, 'sqlite')
    assert.isTrue(props.pinnedByConfig)
    assert.equal(props.tablePrefix, 'escalated_')
    assert.lengthOf(props.connections, 1)

    const [connection] = props.connections
    assert.sameMembers(Object.keys(connection), [
      'name',
      'driver',
      'database',
      'is_current',
      'is_host_default',
      'reachable',
      'migrated',
      'ticket_count',
      'error',
    ])
    const tickets = await running.db.from('escalated_tickets').count('* as total')
    assert.deepEqual(connection, {
      name: 'sqlite',
      driver: 'better-sqlite3',
      database: ':memory:',
      is_current: true,
      is_host_default: true,
      reachable: true,
      migrated: true,
      ticket_count: Number(tickets[0].total),
      error: null,
    })
  })

  test('database test describes a configured connection and refuses an unknown one', async ({
    assert,
  }) => {
    const known = await client.visit('POST', `${PREFIX}/database/test`, {
      data: { connection: 'sqlite' },
      headers: { Accept: 'application/json' },
    })
    assert.equal(known.status, 200, JSON.stringify(known.body))
    assert.equal(known.body.name, 'sqlite')
    assert.isTrue(known.body.reachable)
    assert.isTrue(known.body.migrated)

    const unknown = await client.visit('POST', `${PREFIX}/database/test`, {
      data: { connection: 'nowhere' },
      headers: { Accept: 'application/json' },
    })
    assert.equal(unknown.status, 422)
    assert.property(unknown.body.errors, 'connection')

    const missing = await client.visit('POST', `${PREFIX}/database/test`, {
      data: {},
      headers: { Accept: 'application/json' },
    })
    assert.equal(missing.status, 422)
    assert.property(missing.body.errors, 'connection')
  })

  test('database update is refused because the connection is set in configuration', async ({
    assert,
  }) => {
    const visit = await client.visit('POST', `${PREFIX}/database`, {
      data: { connection: 'sqlite' },
      referer: `${PREFIX}/database`,
    })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, `${PREFIX}/database`)
    assert.equal(
      await flashed(`${PREFIX}/database`, 'error'),
      'The database connection is set in configuration and cannot be changed from here.'
    )
  })

  // ---- Access -------------------------------------------------------------------

  test('a non-admin cannot reach the pages or the writes', async ({ assert }) => {
    const agent = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })

    for (const [method, path] of [
      ['GET', `${PREFIX}/csat`],
      ['POST', `${PREFIX}/csat`],
      ['GET', `${PREFIX}/public-tickets`],
      ['POST', `${PREFIX}/public-tickets`],
      ['PUT', `${PREFIX}/public-tickets`],
      ['GET', `${PREFIX}/data-retention`],
      ['POST', `${PREFIX}/data-retention`],
      ['GET', `${PREFIX}/email`],
      ['POST', `${PREFIX}/email`],
      ['GET', `${PREFIX}/database`],
      ['POST', `${PREFIX}/database/test`],
      ['POST', `${PREFIX}/database`],
    ]) {
      const visit = await agent.visit(method, path, {
        data: method === 'GET' ? undefined : { retention_closed_tickets: '1_year' },
      })
      assert.equal(visit.status, 403, `${method} ${path}`)
    }
    assert.isUndefined(await setting('retention_closed_tickets'))
  })
})
