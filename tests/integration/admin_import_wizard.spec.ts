import { createRequire } from 'node:module'
import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import {
  CREDENTIAL_FIELDS,
  CREDENTIALS,
  FakeImportAdapter,
  TICKET_SOURCE_FIELDS,
  TOKEN,
} from './fixtures/fake_import_adapter.js'
import { escalated_addFilter, escalated_removeFilter } from '../../src/support/helpers.js'
import { getConfig } from '../../src/helpers/config.js'

/*
|--------------------------------------------------------------------------
| Admin import wizard
|--------------------------------------------------------------------------
|
| The screens the shared frontend drives
| (src/pages/Admin/Import/{Index,Connect,Mapping,Review,Progress}.vue), on
| escalated-laravel's routes and props (Admin\ImportController,
| ImportService, ImportJob, ImportContext).
|
| The source is FakeImportAdapter, registered through the `import.adapters`
| filter the way a plugin registers a Zendesk or Freshdesk adapter.
|
*/

const BASE = '/support/admin/import'
const FIELD_MAPPINGS = { tickets: { subject: 'title', state: 'status' } }
const SHARED_PROPS = new Set(['errors', 'auth', 'current_user', 'flash', 'escalated', 'plugin_ui'])
// The props each shared page declares, as the frontend package publishes them.
const MANIFEST = createRequire(import.meta.url)('@escalated-dev/escalated/pages.json')

function declared(component: string): string[] {
  return MANIFEST.props[component].props
}

test.group('Admin import wizard', (group) => {
  let running: TestApp
  let client: InertiaClient
  let adapter: FakeImportAdapter
  const register = (adapters: any[]) => [...adapters, adapter]

  group.setup(async () => {
    running = await testApp()
    // The host's users table, which contacts are imported into.
    if (!(await running.db.connection().schema.hasTable('users'))) {
      await running.db.connection().schema.createTable('users', (table: any) => {
        table.increments('id')
        table.string('email').notNullable()
        table.string('name').nullable()
        table.timestamp('created_at').nullable()
        table.timestamp('updated_at').nullable()
      })
    }
  })

  group.each.setup(async () => {
    adapter = new FakeImportAdapter()
    escalated_addFilter('import.adapters', register)
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
  })

  group.each.teardown(async () => {
    escalated_removeFilter('import.adapters', register)
    const { importsSettled } = await import('../../src/services/import_runner.js')
    await importsSettled()
    const ticketRows = await running.db
      .from('escalated_import_source_maps')
      .where('entity_type', 'tickets')
      .select('escalated_id')
    const ticketIds = ticketRows.map((row: any) => Number(row.escalated_id))
    if (ticketIds.length > 0) {
      await running.db.from('escalated_replies').whereIn('ticket_id', ticketIds).delete()
      await running.db.from('escalated_ticket_tag').whereIn('ticket_id', ticketIds).delete()
      await running.db.from('escalated_tickets').whereIn('id', ticketIds).delete()
    }
    await running.db.from('escalated_import_source_maps').delete()
    await running.db.from('escalated_import_jobs').delete()
    await running.db.from('users').delete()
  })

  group.each.timeout(30_000)

  async function screen(path: string, component: string) {
    const visit = await client.visit('GET', path)
    if (visit.status !== 200)
      throw new Error(`${path}: ${visit.status} ${JSON.stringify(visit.body)}`)
    if (visit.body.component !== component) throw new Error(`${path}: ${visit.body.component}`)
    const sent = Object.keys(visit.body.props).filter((key) => !SHARED_PROPS.has(key))
    return { visit, sent, declared: declared(component) }
  }

  function connect(credentials: Record<string, string> = CREDENTIALS) {
    return client.visit('POST', `${BASE}/fakedesk/test-connection`, {
      data: { credentials },
      headers: { 'X-Inertia': '' },
    })
  }

  async function start() {
    const tested = await connect()
    if (tested.body.success !== true) throw new Error(JSON.stringify(tested.body))
    const visit = await client.visit('POST', `${BASE}/fakedesk/start`, {
      data: { field_mappings: FIELD_MAPPINGS },
    })
    const { default: ImportJob } = await import('../../src/models/import_job.js')
    const job = await ImportJob.query().orderBy('created_at', 'desc').firstOrFail()
    return { visit, job }
  }

  async function settle() {
    const { importsSettled } = await import('../../src/services/import_runner.js')
    await importsSettled()
  }

  async function importedTickets(jobId: string) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const rows = await running.db
      .from('escalated_import_source_maps')
      .where({ import_job_id: jobId, entity_type: 'tickets' })
      .select('escalated_id')
    const ids = rows.map((row: any) => Number(row.escalated_id))
    return Ticket.query().whereIn('id', ids).orderBy('id')
  }

  // ---------------------------------------------------------------- Index

  test('Index lists the registered adapters and the recent jobs', async ({ assert }) => {
    const { default: ImportJob } = await import('../../src/models/import_job.js')
    const job = await ImportJob.create({
      platform: 'fakedesk',
      status: 'completed',
      credentials: CREDENTIALS,
    })

    const { visit, sent, declared: props } = await screen(BASE, 'Escalated/Admin/Import/Index')

    assert.sameMembers(sent, props)
    assert.deepEqual(visit.body.props.adapters, [
      { name: 'fakedesk', display_name: 'FakeDesk', credential_fields: CREDENTIAL_FIELDS },
    ])
    const row = visit.body.props.jobs.find((j: any) => j.id === job.id)
    assert.include(row, { platform: 'fakedesk', status: 'completed' })
    assert.isString(row.created_at)
    assert.notProperty(row, 'credentials')
  })

  test('Index is admin only', async ({ assert }) => {
    const agent = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })

    const visit = await agent.visit('GET', BASE)

    assert.notEqual(visit.status, 200)
  })

  // ---------------------------------------------------------------- Connect

  test('Connect renders the credential form for the platform', async ({ assert }) => {
    const {
      visit,
      sent,
      declared: props,
    } = await screen(`${BASE}/fakedesk/connect`, 'Escalated/Admin/Import/Connect')

    assert.sameMembers(sent, props)
    assert.deepEqual(visit.body.props.credential_fields, CREDENTIAL_FIELDS)
    assert.equal(visit.body.props.platform, 'fakedesk')
    assert.equal(visit.body.props.display_name, 'FakeDesk')
  })

  test('Connect answers 404 for a platform no adapter provides', async ({ assert }) => {
    const visit = await client.visit('GET', `${BASE}/nowhere/connect`)
    assert.equal(visit.status, 404)
  })

  test('test-connection answers success false for refused credentials', async ({ assert }) => {
    const visit = await connect({ ...CREDENTIALS, api_token: 'wrong' })

    assert.equal(visit.status, 200)
    assert.deepEqual(visit.body, { success: false })
  })

  test('test-connection answers 422 with the error when the source throws', async ({ assert }) => {
    const visit = await connect({ ...CREDENTIALS, subdomain: 'down' })

    assert.equal(visit.status, 422)
    assert.deepEqual(visit.body, { success: false, error: 'FakeDesk is unreachable' })
  })

  // ---------------------------------------------------------------- Mapping

  test('Mapping sends the visitor back to Connect until a connection is tested', async ({
    assert,
  }) => {
    const visit = await client.visit('GET', `${BASE}/fakedesk/mapping`)

    assert.equal(visit.status, 302)
    assert.equal(visit.location, `${BASE}/fakedesk/connect`)
  })

  test('Mapping renders defaults and source fields read with the stored credentials', async ({
    assert,
  }) => {
    await connect()

    const {
      visit,
      sent,
      declared: props,
    } = await screen(`${BASE}/fakedesk/mapping`, 'Escalated/Admin/Import/Mapping')

    // Everything the page declares except `credentials`, which Laravel does
    // not send either: they stay on the server.
    assert.sameMembers(
      sent,
      props.filter((p) => p !== 'credentials')
    )
    assert.equal(visit.body.props.display_name, 'FakeDesk')
    assert.deepEqual(visit.body.props.entity_types, ['contacts', 'tags', 'tickets', 'replies'])
    assert.deepEqual(visit.body.props.mappings.tickets, {
      defaults: { subject: 'title', state: 'status' },
      source_fields: TICKET_SOURCE_FIELDS,
    })
    assert.deepEqual(visit.body.props.mappings.contacts, { defaults: {}, source_fields: [] })
    assert.deepEqual(adapter.sourceFieldCredentials, CREDENTIALS)
    assert.notInclude(JSON.stringify(visit.body), TOKEN)
  })

  // ---------------------------------------------------------------- Review

  test('Review echoes the choices and writes nothing', async ({ assert }) => {
    const visit = await client.visit('POST', `${BASE}/fakedesk/review`, {
      data: { field_mappings: FIELD_MAPPINGS, entity_types: ['tickets', 'replies'] },
    })

    assert.equal(visit.body.component, 'Escalated/Admin/Import/Review')
    assert.sameMembers(
      Object.keys(visit.body.props).filter((k) => !SHARED_PROPS.has(k)),
      declared('Escalated/Admin/Import/Review')
    )
    assert.deepEqual(visit.body.props, {
      platform: 'fakedesk',
      field_mappings: FIELD_MAPPINGS,
      entity_types: ['tickets', 'replies'],
    })
    const jobs = await running.db.from('escalated_import_jobs').count('* as total')
    assert.equal(Number(jobs[0].total), 0)
  })

  // ---------------------------------------------------------------- start

  test('start refuses without a tested connection', async ({ assert }) => {
    const visit = await client.visit('POST', `${BASE}/fakedesk/start`, {
      data: { field_mappings: FIELD_MAPPINGS },
    })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, `${BASE}/fakedesk/connect`)
    const jobs = await running.db.from('escalated_import_jobs').count('* as total')
    assert.equal(Number(jobs[0].total), 0)
  })

  test('start creates the job, moves the credentials into it and queues the run', async ({
    assert,
  }) => {
    const { visit, job } = await start()

    assert.equal(visit.status, 302)
    assert.equal(visit.location, `${BASE}/progress/${job.id}`)
    assert.equal(job.platform, 'fakedesk')
    assert.equal(String(job.userId), String(TEST_USERS.admin.id))
    assert.deepEqual(job.fieldMappings, FIELD_MAPPINGS)

    const stored = await running.db.from('escalated_import_jobs').where('id', job.id).first()
    assert.notInclude(String(stored.credentials), TOKEN)

    await settle()
    // The session copy is gone once the job holds them.
    const again = await client.visit('GET', `${BASE}/fakedesk/mapping`)
    assert.equal(again.status, 302)
  })

  test('the run imports the tickets end to end, in import mode', async ({ assert }) => {
    const config = getConfig() as any
    const saved = { sla: config.sla, targetedSlas: config.targetedSlas }
    config.sla = { enabled: true }
    config.targetedSlas = true
    const { default: SlaPolicy } = await import('../../src/models/sla_policy.js')
    const policy = await SlaPolicy.create({
      name: `Import default ${Date.now()}`,
      isDefault: true,
      firstResponseHours: { high: 1, urgent: 1, medium: 4 },
      resolutionHours: { high: 8, urgent: 8, medium: 24 },
      businessHoursOnly: false,
      isActive: true,
    } as any)
    const { default: ImportContext } = await import('../../src/support/import_context.js')
    const importing: boolean[] = []
    adapter.onExtract = () => importing.push(ImportContext.isImporting())

    try {
      const { job } = await start()
      // The request that started it is not in import mode.
      assert.isFalse(ImportContext.isImporting())
      await settle()
      await job.refresh()

      assert.equal(job.status, 'completed')
      assert.isNotNull(job.completedAt)
      assert.isNull(job.credentials)
      assert.deepEqual(job.errorLog ?? [], [])
      assert.include(job.progress!.tickets, { total: 3, processed: 3, skipped: 0, failed: 0 })
      assert.sameMembers(Object.keys(job.progress!), ['contacts', 'tags', 'tickets', 'replies'])

      const tickets = await importedTickets(job.id)
      assert.deepEqual(
        tickets.map((t) => t.subject),
        ['Refund please', 'Login broken', 'Feature idea']
      )
      assert.deepEqual(
        tickets.map((t) => t.status),
        ['open', 'resolved', 'open']
      )
      assert.deepEqual(
        tickets.map((t) => t.priority),
        ['high', 'urgent', 'medium']
      )
      const ada = await running.db.from('users').where('email', 'ada@customer.test').first()
      assert.equal(String(tickets[0].requesterId), String(ada.id))
      assert.equal(tickets[0].createdAt.toUTC().toISO(), '2024-01-02T03:04:05.000Z')
      const tags = await running.db
        .from('escalated_ticket_tag')
        .where('ticket_id', tickets[0].id)
        .count('* as total')
      assert.equal(Number(tags[0].total), 1)
      const replies = await running.db
        .from('escalated_replies')
        .whereIn(
          'ticket_id',
          tickets.map((t) => t.id)
        )
        .orderBy('id')
      assert.deepEqual(
        replies.map((r: any) => r.body),
        ['Looking into it', 'Internal note']
      )

      // Import mode: in the run only, and no SLA clock on imported tickets.
      assert.isNotEmpty(importing)
      assert.isTrue(importing.every(Boolean))
      assert.isTrue(tickets.every((t) => t.slaPolicyId === null))
    } finally {
      await policy.delete()
      config.sla = saved.sla
      config.targetedSlas = saved.targetedSlas
    }
  })

  test('import mode stays inside the run: the rest of the process is not silenced', async ({
    assert,
  }) => {
    const { default: ImportContext } = await import('../../src/support/import_context.js')
    let release!: () => void
    let reached!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const atGate = new Promise<void>((resolve) => (reached = resolve))
    const seen: boolean[] = []
    adapter.onExtract = async (entityType) => {
      if (entityType !== 'contacts') return
      seen.push(ImportContext.isImporting())
      reached()
      await gate
    }

    try {
      await start()
      await atGate

      // The run is mid-import, waiting on its source. Live requests and jobs
      // in this process must keep their notifications, SLA clocks and webhooks.
      assert.deepEqual(seen, [true])
      assert.isFalse(ImportContext.isImporting())
    } finally {
      release()
      await settle()
    }
  })

  // ---------------------------------------------------------------- Progress

  async function runningJob() {
    const { default: ImportJob } = await import('../../src/models/import_job.js')
    return ImportJob.create({
      platform: 'fakedesk',
      status: 'importing',
      credentials: CREDENTIALS,
      fieldMappings: FIELD_MAPPINGS,
      progress: { tickets: { total: 3, processed: 1, skipped: 0, failed: 1, cursor: '2' } },
      errorLog: [
        { entity_type: 'tickets', source_id: 'k9', error: 'boom', timestamp: '2024-01-01' },
      ],
    })
  }

  test('Progress renders the job the screen polls', async ({ assert }) => {
    const job = await runningJob()

    const {
      visit,
      sent,
      declared: props,
    } = await screen(`${BASE}/progress/${job.id}`, 'Escalated/Admin/Import/Progress')

    assert.sameMembers(sent, props)
    const sentJob = visit.body.props.job
    assert.include(sentJob, { id: job.id, platform: 'fakedesk', status: 'importing' })
    assert.deepEqual(sentJob.progress, job.progress)
    assert.deepEqual(sentJob.error_log, job.errorLog)
    assert.deepEqual(sentJob.field_mappings, FIELD_MAPPINGS)
    assert.notProperty(sentJob, 'credentials')
    assert.notInclude(JSON.stringify(visit.body), TOKEN)
  })

  test('status answers the poll', async ({ assert }) => {
    const job = await runningJob()

    const visit = await client.visit('GET', `${BASE}/status/${job.id}`, {
      headers: { 'X-Inertia': '' },
    })

    assert.sameMembers(Object.keys(visit.body), [
      'status',
      'progress',
      'error_log',
      'started_at',
      'completed_at',
    ])
    assert.equal(visit.body.status, 'importing')
    assert.deepEqual(visit.body.progress, job.progress)
    assert.deepEqual(visit.body.error_log, job.errorLog)
  })

  test('status answers 404 for an unknown job', async ({ assert }) => {
    const visit = await client.visit('GET', `${BASE}/status/00000000-0000-0000-0000-000000000000`)
    assert.equal(visit.status, 404)
  })

  // ---------------------------------------------------------------- pause / resume / cancel

  test('pauses mid-run and resumes without importing anything twice', async ({ assert }) => {
    adapter.onExtract = async (entityType, cursor) => {
      if (entityType === 'tickets' && cursor === '2') {
        await running.db.from('escalated_import_jobs').update({ status: 'paused' })
      }
    }

    const { job } = await start()
    await settle()
    await job.refresh()

    assert.equal(job.status, 'paused')
    assert.lengthOf(await importedTickets(job.id), 3)
    assert.notProperty(job.progress!, 'replies')
    assert.deepEqual(job.credentials, CREDENTIALS)

    adapter.onExtract = null
    adapter.extractCalls = []
    const visit = await client.visit('POST', `${BASE}/resume/${job.id}`)
    await settle()
    await job.refresh()

    assert.equal(visit.location, `${BASE}/progress/${job.id}`)
    assert.equal(job.status, 'completed')
    const tickets = await importedTickets(job.id)
    assert.lengthOf(tickets, 3)
    const replies = await running.db.from('escalated_replies').whereIn(
      'ticket_id',
      tickets.map((t) => t.id)
    )
    assert.lengthOf(replies, 2)
    // The run picked tickets up from its saved cursor, not from the start.
    assert.notDeepInclude(adapter.extractCalls, ['tickets', null])
    assert.deepInclude(adapter.extractCalls, ['tickets', '2'])
  })

  test('pause stops an importing job', async ({ assert }) => {
    const job = await runningJob()

    const visit = await client.visit('POST', `${BASE}/pause/${job.id}`)
    await job.refresh()

    assert.equal(visit.location, `${BASE}/progress/${job.id}`)
    assert.equal(job.status, 'paused')
  })

  test('resume runs a failed job again through mapping', async ({ assert }) => {
    const { default: ImportJob } = await import('../../src/models/import_job.js')
    const job = await ImportJob.create({
      platform: 'fakedesk',
      status: 'failed',
      credentials: CREDENTIALS,
    })

    await client.visit('POST', `${BASE}/resume/${job.id}`)
    await settle()
    await job.refresh()

    assert.equal(job.status, 'completed')
    assert.lengthOf(await importedTickets(job.id), 3)
  })

  test('cancel stops a job for good and drops its credentials', async ({ assert }) => {
    const { default: ImportJob } = await import('../../src/models/import_job.js')
    const job = await ImportJob.create({
      platform: 'fakedesk',
      status: 'paused',
      credentials: CREDENTIALS,
    })

    const visit = await client.visit('POST', `${BASE}/cancel/${job.id}`)
    await job.refresh()

    assert.equal(visit.location, `${BASE}/progress/${job.id}`)
    assert.equal(job.status, 'failed')
    assert.isNotNull(job.completedAt)
    assert.isNull(job.credentials)
  })

  // ---------------------------------------------------------------- import mode

  test('import mode holds back SLA, escalations and automations', async ({ assert }) => {
    const { default: ImportContext } = await import('../../src/support/import_context.js')
    const { default: SlaService } = await import('../../src/services/sla_service.js')
    const { default: AutomationRunner } = await import('../../src/services/automation_runner.js')

    const results = await ImportContext.suppress(async () => [
      await new SlaService().checkBreaches(),
      await new SlaService().checkWarnings(),
      await new AutomationRunner().run(),
    ])

    assert.deepEqual(results, [0, 0, 0])
    assert.isFalse(ImportContext.isImporting())
  })
})
