import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp, type Visit } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { setAccess } from './helpers/access.js'
import { CREDENTIALS, FakeImportAdapter, TOKEN } from './fixtures/fake_import_adapter.js'
import { escalated_addFilter, escalated_removeFilter } from '../../src/support/helpers.js'

/*
|--------------------------------------------------------------------------
| Stored secrets never reach the browser
|--------------------------------------------------------------------------
|
| Import source credentials, webhook signing secrets, inbound email secrets,
| two-factor seeds and API token hashes are kept server-side so the app can
| use them. None of them is shown back to an admin: every page and JSON
| response that carries one of these records is checked here for the raw
| secret anywhere in the body. After escalated-laravel's
| SecretsNeverSerializedTest.
|
| This package has no SSO settings page, so there is no SSO surface to check.
|
*/

const ADMIN = '/support/admin'
const IMPORT_API_KEY = 'imp-key-7f3a9c2e5b1d'
const IMPORT_PASSWORD = 'imp-pass-q8w7e6r5t4'
const WEBHOOK_SECRET = 'whsec-4c8e1a7b9d3f'
const MASK = '********'
const INBOUND_KEYS = ['mailgun_signing_key', 'postmark_inbound_token', 'imap_password']

function assertHasNoSecrets(assert: any, visit: Visit, secrets: string[]) {
  const body = typeof visit.body === 'string' ? visit.body : JSON.stringify(visit.body)
  for (const secret of secrets) {
    assert.notInclude(body, secret, `the response carries ${secret}`)
  }
}

test.group('Stored secrets are never serialized', (group) => {
  let running: TestApp
  let client: InertiaClient
  const adapter = new FakeImportAdapter()
  const register = (adapters: any[]) => [...adapters, adapter]

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    escalated_addFilter('import.adapters', register)
    ;(globalThis as any).__escalated_config.webhooks = { allowPrivateUrls: true }
    await running.db.from('escalated_webhook_deliveries').delete()
    await running.db.from('escalated_webhooks').delete()
    await running.db.from('escalated_import_jobs').delete()
    await running.db.from('escalated_two_factor').delete()
    await running.db.from('escalated_api_tokens').delete()
    await running.db.from('escalated_settings').whereIn('key', INBOUND_KEYS).delete()
    await stampSettings()
  })

  group.each.teardown(() => {
    escalated_removeFilter('import.adapters', register)
    ;(globalThis as any).__escalated_config.webhooks = undefined
  })

  group.each.timeout(30_000)

  async function importJobWithCredentials() {
    const { default: ImportJob } = await import('../../src/models/import_job.js')
    return ImportJob.create({
      userId: TEST_USERS.admin.id,
      platform: 'fakedesk',
      status: 'importing',
      credentials: { api_key: IMPORT_API_KEY, password: IMPORT_PASSWORD },
      progress: { tickets: { total: 10, processed: 4, skipped: 0, failed: 0, cursor: null } },
      errorLog: [],
    })
  }

  async function webhookWithSecret() {
    const { default: Webhook } = await import('../../src/models/webhook.js')
    return Webhook.create({
      url: 'http://127.0.0.1:9/hook',
      events: ['ticket.created'],
      secret: WEBHOOK_SECRET,
      active: true,
    })
  }

  async function storedSecret(id: number) {
    const row = await running.db.from('escalated_webhooks').where('id', id).first()
    return row.secret
  }

  /** SQLite stores a JS Date as a number, which Lucid cannot read back into a DateTime. */
  async function stampSettings() {
    await running.db
      .from('escalated_settings')
      .update({ created_at: sqlTimestamp(), updated_at: sqlTimestamp() })
  }

  async function setSetting(key: string, value: string) {
    const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')
    await EscalatedSetting.set(key, value)
    await stampSettings()
  }

  async function setting(key: string) {
    const row = await running.db.from('escalated_settings').where('key', key).first()
    return row ? row.value : undefined
  }

  // --- Import ----------------------------------------------------------------

  test('import credentials stay out of the import index page', async ({ assert }) => {
    const job = await importJobWithCredentials()

    const visit = await client.visit('GET', `${ADMIN}/import`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assertHasNoSecrets(assert, visit, [IMPORT_API_KEY, IMPORT_PASSWORD])
    const jobs = visit.body.props.jobs
    assert.lengthOf(jobs, 1)
    assert.equal(jobs[0].id, job.id)
    assert.equal(jobs[0].platform, 'fakedesk')
    assert.equal(jobs[0].status, 'importing')
    assert.property(jobs[0], 'created_at')
    assert.notProperty(jobs[0], 'credentials')
  })

  test('import credentials stay out of the progress page and the status json', async ({
    assert,
  }) => {
    const job = await importJobWithCredentials()

    const progress = await client.visit('GET', `${ADMIN}/import/progress/${job.id}`)
    assert.equal(progress.status, 200, JSON.stringify(progress.body))
    assertHasNoSecrets(assert, progress, [IMPORT_API_KEY, IMPORT_PASSWORD])
    const props = progress.body.props.job
    assert.equal(props.id, job.id)
    assert.equal(props.status, 'importing')
    assert.equal(props.progress.tickets.processed, 4)
    assert.property(props, 'error_log')
    assert.notProperty(props, 'credentials')

    const legacy = await client.visit('GET', `${ADMIN}/import/${job.id}`)
    assert.equal(legacy.status, 200, JSON.stringify(legacy.body))
    assertHasNoSecrets(assert, legacy, [IMPORT_API_KEY, IMPORT_PASSWORD])

    const status = await client.visit('GET', `${ADMIN}/import/status/${job.id}`, {
      headers: { 'X-Inertia': '', 'Accept': 'application/json' },
    })
    assert.equal(status.status, 200, JSON.stringify(status.body))
    assert.equal(status.body.status, 'importing')
    assertHasNoSecrets(assert, status, [IMPORT_API_KEY, IMPORT_PASSWORD])
  })

  test('the progress page sends the explicit field list, with the last 50 errors', async ({
    assert,
  }) => {
    const job = await importJobWithCredentials()
    job.errorLog = Array.from({ length: 60 }, (_, i) => ({
      entity_type: 'tickets',
      source_id: `k${i}`,
      error: `failure ${i}`,
      timestamp: new Date().toISOString(),
    }))
    await job.save()

    const visit = await client.visit('GET', `${ADMIN}/import/progress/${job.id}`)

    assert.sameMembers(Object.keys(visit.body.props.job), [
      'id',
      'platform',
      'status',
      'progress',
      'field_mappings',
      'error_log',
      'started_at',
      'completed_at',
      'created_at',
    ])
    assert.lengthOf(visit.body.props.job.error_log, 50)
    assert.equal(visit.body.props.job.error_log[49].source_id, 'k59')
  })

  test('the tested credentials stay out of the connect, test-connection, mapping and review steps', async ({
    assert,
  }) => {
    const connect = await client.visit('GET', `${ADMIN}/import/fakedesk/connect`)
    assert.equal(connect.status, 200, JSON.stringify(connect.body))

    const tested = await client.visit('POST', `${ADMIN}/import/fakedesk/test-connection`, {
      data: { credentials: CREDENTIALS },
      headers: { 'X-Inertia': '' },
    })
    assert.isTrue(tested.body.success, JSON.stringify(tested.body))
    assertHasNoSecrets(assert, tested, [TOKEN])

    const mapping = await client.visit('GET', `${ADMIN}/import/fakedesk/mapping`)
    assert.equal(mapping.status, 200, JSON.stringify(mapping.body))
    assertHasNoSecrets(assert, mapping, [TOKEN])

    const review = await client.visit('POST', `${ADMIN}/import/fakedesk/review`, {
      data: { entity_types: ['tickets'] },
    })
    assert.equal(review.status, 200, JSON.stringify(review.body))
    assertHasNoSecrets(assert, review, [TOKEN])
  })

  test('the import run still reads the stored credentials server-side', async ({ assert }) => {
    const job = await importJobWithCredentials()
    const { default: ImportJob } = await import('../../src/models/import_job.js')

    const found = await ImportJob.findOrFail(job.id)

    assert.deepEqual(found.credentials, { api_key: IMPORT_API_KEY, password: IMPORT_PASSWORD })
    assert.notProperty(found.serialize(), 'credentials')
    assert.notInclude(JSON.stringify(found), IMPORT_API_KEY)
  })

  // --- Webhooks --------------------------------------------------------------

  test('the webhook secret stays out of the index, edit and delivery-log pages', async ({
    assert,
  }) => {
    const webhook = await webhookWithSecret()
    const { default: WebhookDelivery } = await import('../../src/models/webhook_delivery.js')
    await WebhookDelivery.create({
      webhookId: webhook.id,
      event: 'ticket.created',
      payload: { ok: true },
      responseCode: 200,
      attempts: 1,
    } as any)

    const index = await client.visit('GET', `${ADMIN}/webhooks`)
    assert.equal(index.status, 200, JSON.stringify(index.body))
    assertHasNoSecrets(assert, index, [WEBHOOK_SECRET])
    assert.isTrue(index.body.props.webhooks[0].has_secret)

    const edit = await client.visit('GET', `${ADMIN}/webhooks/${webhook.id}/edit`)
    assert.equal(edit.status, 200, JSON.stringify(edit.body))
    assertHasNoSecrets(assert, edit, [WEBHOOK_SECRET])
    assert.isTrue(edit.body.props.webhook.has_secret)
    assert.notProperty(edit.body.props.webhook, 'secret')
    assert.equal(edit.body.props.webhook.url, 'http://127.0.0.1:9/hook')

    const log = await client.visit('GET', `${ADMIN}/webhooks/${webhook.id}/deliveries`)
    assert.equal(log.status, 200, JSON.stringify(log.body))
    assertHasNoSecrets(assert, log, [WEBHOOK_SECRET])
    assert.isTrue(log.body.props.webhook.has_secret)
  })

  test('a webhook without a secret shows has_secret false', async ({ assert }) => {
    const { default: Webhook } = await import('../../src/models/webhook.js')
    const webhook = await Webhook.create({
      url: 'http://127.0.0.1:9/hook',
      events: ['ticket.created'],
      secret: null,
      active: true,
    })

    const edit = await client.visit('GET', `${ADMIN}/webhooks/${webhook.id}/edit`)

    assert.isFalse(edit.body.props.webhook.has_secret)
  })

  test('saving a webhook with the secret left blank keeps the stored secret', async ({
    assert,
  }) => {
    const webhook = await webhookWithSecret()

    for (const secret of ['', null, undefined]) {
      const visit = await client.visit('PUT', `${ADMIN}/webhooks/${webhook.id}`, {
        data: {
          url: 'http://127.0.0.1:9/hook',
          events: ['ticket.created', 'ticket.updated'],
          active: true,
          ...(secret === undefined ? {} : { secret }),
        },
        referer: `${ADMIN}/webhooks/${webhook.id}/edit`,
      })
      assert.equal(visit.status, 302, JSON.stringify(visit.body))
      assert.equal(await storedSecret(webhook.id), WEBHOOK_SECRET)
    }

    const row = await running.db.from('escalated_webhooks').where('id', webhook.id).first()
    assert.include(row.events, 'ticket.updated')
  })

  test('a new webhook secret replaces the stored one, and clear_secret removes it', async ({
    assert,
  }) => {
    const webhook = await webhookWithSecret()
    const payload = { url: 'http://127.0.0.1:9/hook', events: ['ticket.created'], active: true }

    await client.visit('PUT', `${ADMIN}/webhooks/${webhook.id}`, {
      data: { ...payload, secret: 'whsec-new' },
    })
    assert.equal(await storedSecret(webhook.id), 'whsec-new')

    await client.visit('PUT', `${ADMIN}/webhooks/${webhook.id}`, {
      data: { ...payload, secret: '', clear_secret: false },
    })
    assert.equal(await storedSecret(webhook.id), 'whsec-new')

    await client.visit('PUT', `${ADMIN}/webhooks/${webhook.id}`, {
      data: { ...payload, secret: '', clear_secret: true },
    })
    assert.isNull(await storedSecret(webhook.id))
  })

  test('creating a webhook stores the secret as before', async ({ assert }) => {
    const visit = await client.visit('POST', `${ADMIN}/webhooks`, {
      data: { url: 'http://127.0.0.1:9/new', events: ['ticket.created'], secret: 'whsec-created' },
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    const row = await running.db.from('escalated_webhooks').first()
    assert.equal(row.secret, 'whsec-created')
  })

  // --- General settings (inbound email secrets) ------------------------------

  test('the settings page masks inbound email secrets completely', async ({ assert }) => {
    await setSetting('mailgun_signing_key', 'mgk-9d8c7b6a5f4e')
    await setSetting('postmark_inbound_token', 'pmt-1q2w3e4r5t6y')
    await setSetting('imap_password', 'imp-8f7e6d5c4b')

    const visit = await client.visit('GET', `${ADMIN}/settings`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    for (const key of INBOUND_KEYS) {
      assert.equal(visit.body.props.settings[key], MASK, key)
    }
    assertHasNoSecrets(assert, visit, ['mgk-', 'pmt-', 'imp-', '9d8c7b6a5f4e', '8f7e6d5c4b'])
  })

  test('an unset inbound email secret is an empty string', async ({ assert }) => {
    const visit = await client.visit('GET', `${ADMIN}/settings`)

    assert.equal(visit.body.props.settings.imap_password, '')
  })

  test('posting the mask back keeps an inbound secret; a new value replaces it', async ({
    assert,
  }) => {
    await setSetting('mailgun_signing_key', 'mgk-9d8c7b6a5f4e')
    await setSetting('imap_password', 'imp-8f7e6d5c4b')

    const page = await client.visit('GET', `${ADMIN}/settings`)
    const settings = page.body.props.settings
    await client.visit('POST', `${ADMIN}/settings`, {
      data: { ...settings, postmark_inbound_token: undefined, imap_password: 'imp*****' },
    })

    assert.equal(await setting('mailgun_signing_key'), 'mgk-9d8c7b6a5f4e')
    assert.equal(await setting('imap_password'), 'imp-8f7e6d5c4b')

    await stampSettings()
    await client.visit('POST', `${ADMIN}/settings`, {
      data: { ...settings, mailgun_signing_key: 'mgk-rotated' },
    })
    assert.equal(await setting('mailgun_signing_key'), 'mgk-rotated')
  })

  // --- Two-factor and API tokens ---------------------------------------------

  test('the two-factor page carries neither the TOTP seed nor the recovery codes', async ({
    assert,
  }) => {
    const { default: TwoFactor } = await import('../../src/models/two_factor.js')
    await TwoFactor.create({
      userId: TEST_USERS.admin.id,
      secret: 'TOTPSECRETBASE32XX',
      recoveryCodes: ['rc-hash-aaaa-bbbb'],
      confirmedAt: null,
    } as any)
    const row = await running.db
      .from('escalated_two_factor')
      .where('user_id', TEST_USERS.admin.id)
      .first()

    // Two-factor is an install-level switch (ADR
    // 2026-10-29-configurable-access-features); the page exists while it is on.
    setAccess({ twoFactor: true })
    let visit: Visit
    try {
      visit = await client.visit('GET', `${ADMIN}/settings/two-factor`)
    } finally {
      setAccess(undefined)
    }

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Settings/TwoFactor')
    assert.isTrue(visit.body.props.pending)
    assertHasNoSecrets(assert, visit, ['TOTPSECRETBASE32XX', 'rc-hash-aaaa-bbbb', row.secret])
  })

  test('the API token page shows the plaintext token once and never the stored hash', async ({
    assert,
  }) => {
    const { default: ApiToken } = await import('../../src/models/api_token.js')
    const { token, plainTextToken } = await ApiToken.createToken(TEST_USERS.admin as any, 'CI')

    const visit = await client.visit('GET', `${ADMIN}/api-tokens`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.lengthOf(visit.body.props.tokens, 1)
    assertHasNoSecrets(assert, visit, [token.token, plainTextToken])
  })

  // --- Models never serialize their secrets ----------------------------------

  test('every model that stores a secret hides it from serialization', async ({ assert }) => {
    const webhook = await webhookWithSecret()
    const job = await importJobWithCredentials()
    const { default: TwoFactor } = await import('../../src/models/two_factor.js')
    const twoFactor = await TwoFactor.create({
      userId: TEST_USERS.admin.id,
      secret: 'TOTPSECRETBASE32XX',
      recoveryCodes: ['rc-hash-aaaa-bbbb'],
      confirmedAt: null,
    } as any)
    const { default: ApiToken } = await import('../../src/models/api_token.js')
    const { token } = await ApiToken.createToken(TEST_USERS.admin as any, 'CI')

    const serializedWebhook = webhook.serialize()
    assert.notProperty(serializedWebhook, 'secret')
    assert.isTrue(serializedWebhook.has_secret)
    assert.notProperty(job.serialize(), 'credentials')
    assert.notProperty(twoFactor.serialize(), 'secret')
    assert.notProperty(twoFactor.serialize(), 'recovery_codes')
    assert.notProperty(token.serialize(), 'token')
    for (const model of [webhook, job, twoFactor, token]) {
      const json = JSON.stringify(model)
      for (const secret of [WEBHOOK_SECRET, IMPORT_API_KEY, 'TOTPSECRETBASE32XX', token.token]) {
        assert.notInclude(json, secret)
      }
    }
  })
})
