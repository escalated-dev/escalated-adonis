import { test } from '@japa/runner'
import { InertiaClient, TEST_USER_HEADER, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS, type TestUser } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Private attachments
|--------------------------------------------------------------------------
|
| Ports escalated-laravel's private attachment delivery
| (docs/private-attachments.md, AttachmentAccess). Files are written private
| and never handed out by disk URL: every page and API answer carries a
| short-lived link to one download route, and that route checks who is
| asking, against the ticket, on every request.
|
*/

const PREFIX = '/support'

test.group('Private attachments', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  let sequence = 0

  async function models() {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const { default: Reply } = await import('../../src/models/reply.js')
    const { default: Attachment } = await import('../../src/models/attachment.js')
    const { default: drive } = await import('@adonisjs/drive/services/main')
    return { Ticket, Reply, Attachment, drive }
  }

  async function openTicket(extra: Record<string, unknown> = {}) {
    const { Ticket } = await models()
    return Ticket.create({
      reference: `ATT-${Date.now()}-${++sequence}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject: 'Attachment ticket',
      description: 'Opened by the private attachment tests',
      status: 'open',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
      ...extra,
    } as any)
  }

  /** A reply with one stored attachment, written straight to a disk. */
  async function replyWithFile(
    ticketId: number,
    options: {
      internal?: boolean
      disk?: string
      name?: string
      mime?: string
      content?: string
    } = {}
  ) {
    const { Reply, Attachment, drive } = await models()
    const reply = await Reply.create({
      ticketId,
      authorType: 'User',
      authorId: TEST_USERS.agent.id,
      body: options.internal ? 'Note' : 'Reply',
      isInternalNote: options.internal ?? false,
      isPinned: false,
      type: options.internal ? 'note' : 'reply',
    } as any)
    const disk = options.disk ?? 'private'
    const path = `escalated/attachments/test-${Date.now()}-${++sequence}.bin`
    await drive.use(disk as any).put(path, options.content ?? 'file contents')
    const attachment = await Attachment.create({
      attachableType: 'Reply',
      attachableId: reply.id,
      filename: path.split('/').pop()!,
      originalFilename: options.name ?? 'invoice.pdf',
      mimeType: options.mime ?? 'application/pdf',
      size: 13,
      disk,
      path,
    })
    return { reply, attachment }
  }

  async function signedUrl(attachment: any, guestTicket?: any) {
    const { attachmentDownloadUrl } = await import('../../src/support/attachment_access.js')
    return attachmentDownloadUrl(attachment, guestTicket ? { guestTicket } : {})
  }

  async function download(
    url: string,
    options: { user?: TestUser | null; headers?: Record<string, string> } = {}
  ) {
    const headers: Record<string, string> = { ...options.headers }
    if (options.user) headers[TEST_USER_HEADER] = String(options.user.id)
    const response = await fetch(running.baseUrl + url, { headers, redirect: 'manual' })
    return { status: response.status, headers: response.headers, text: await response.text() }
  }

  async function statusOf(...args: Parameters<typeof download>) {
    const answer = await download(...args)
    return answer.status
  }

  test('an upload is written to the private default disk, not the public one', async ({
    assert,
  }) => {
    const { Attachment, drive } = await models()
    const ticket = await openTicket()

    const form = new FormData()
    form.append('body', 'Here is the file')
    form.append('attachments[]', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'a.pdf')
    const response = await fetch(`${running.baseUrl}${PREFIX}/${ticket.reference}/reply`, {
      method: 'POST',
      headers: { [TEST_USER_HEADER]: String(TEST_USERS.customer.id) },
      body: form,
      redirect: 'manual',
    })
    assert.include([200, 302], response.status, await response.text())

    const { default: Reply } = await import('../../src/models/reply.js')
    const reply = await Reply.query().where('ticket_id', ticket.id).firstOrFail()
    const attachment = await Attachment.query()
      .where('attachable_type', 'Reply')
      .where('attachable_id', reply.id)
      .firstOrFail()
    assert.equal(attachment.disk, 'private')
    assert.equal(attachment.originalFilename, 'a.pdf')
    assert.isTrue(await drive.use('private').exists(attachment.path))
    assert.isFalse(await drive.use('public').exists(attachment.path))
  })

  test('the customer page carries a signed download link, never the disk path', async ({
    assert,
  }) => {
    const ticket = await openTicket()
    const { attachment } = await replyWithFile(ticket.id)

    const page = await new InertiaClient(running.baseUrl, { user: TEST_USERS.customer }).visit(
      'GET',
      `${PREFIX}/${ticket.reference}`
    )
    assert.equal(page.status, 200, JSON.stringify(page.body))
    const serialized = page.body.props.ticket.replies[0].attachments[0]
    assert.match(
      serialized.url,
      new RegExp(`^/support/attachments/${attachment.id}/download\\?token=`)
    )
    assert.notInclude(JSON.stringify(page.body.props.ticket), attachment.path)
    assert.notProperty(serialized, 'disk')
    assert.notProperty(serialized, 'path')

    const file = await download(serialized.url, { user: TEST_USERS.customer })
    assert.equal(file.status, 200, file.text)
    assert.equal(file.text, 'file contents')
  })

  test('downloads are attachments with a safe name, no-store and nosniff', async ({ assert }) => {
    const ticket = await openTicket()
    const { attachment } = await replyWithFile(ticket.id, {
      name: 'bad"name\r\n.html',
      mime: 'text/html',
    })
    const file = await download(await signedUrl(attachment), { user: TEST_USERS.customer })

    assert.equal(file.status, 200, file.text)
    assert.equal(file.headers.get('content-type'), 'application/octet-stream')
    const disposition = file.headers.get('content-disposition')!
    assert.match(disposition, /^attachment; filename="badname\.html"/)
    assert.notMatch(disposition, /[\r\n]/)
    assert.equal(file.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(file.headers.get('cache-control'), 'private, no-store, max-age=0')
    assert.equal(file.headers.get('referrer-policy'), 'no-referrer')

    const { attachment: png } = await replyWithFile(ticket.id, { name: 'a.png', mime: 'image/png' })
    const image = await download(await signedUrl(png), { user: TEST_USERS.customer })
    assert.equal(image.headers.get('content-type'), 'image/png')
  })

  test('another customer and an anonymous visitor are refused', async ({ assert }) => {
    const ticket = await openTicket()
    const { attachment } = await replyWithFile(ticket.id)
    const url = await signedUrl(attachment)

    assert.equal(await statusOf(url, { user: TEST_USERS.otherCustomer }), 403)
    assert.equal(await statusOf(url), 403)
    assert.equal(await statusOf(url, { user: TEST_USERS.agent }), 200)
  })

  test('an internal-note attachment is for agents only', async ({ assert }) => {
    const ticket = await openTicket()
    const { attachment } = await replyWithFile(ticket.id, { internal: true })
    const url = await signedUrl(attachment)

    assert.equal(await statusOf(url, { user: TEST_USERS.customer }), 403)
    assert.equal(await statusOf(url, { user: TEST_USERS.agent }), 200)
    assert.equal(await statusOf(url, { user: TEST_USERS.admin }), 200)
  })

  test('the agent page signs reply attachments, internal notes included', async ({ assert }) => {
    const ticket = await openTicket()
    await replyWithFile(ticket.id, { internal: true })

    const page = await new InertiaClient(running.baseUrl, { user: TEST_USERS.agent }).visit(
      'GET',
      `${PREFIX}/agent/tickets/${ticket.reference}`
    )
    assert.equal(page.status, 200, JSON.stringify(page.body).slice(0, 500))
    const url = page.body.props.ticket.replies[0].attachments[0].url
    assert.equal(await statusOf(url, { user: TEST_USERS.agent }), 200)
  })

  test('a missing, tampered or expired link is refused', async ({ assert }) => {
    const ticket = await openTicket()
    const { attachment } = await replyWithFile(ticket.id)
    const { attachment: other } = await replyWithFile(ticket.id)
    const url = await signedUrl(attachment)

    assert.equal(
      await statusOf(`${PREFIX}/attachments/${attachment.id}/download`, {
        user: TEST_USERS.agent,
      }),
      403
    )
    assert.equal(await statusOf(url + 'x', { user: TEST_USERS.agent }), 403)
    // A link for one attachment does not open another.
    const swapped = url.replace(`/attachments/${attachment.id}/`, `/attachments/${other.id}/`)
    assert.equal(await statusOf(swapped, { user: TEST_USERS.agent }), 403)

    const { default: encryption } = await import('@adonisjs/core/services/encryption')
    const expired = encryption.encrypt({ attachment: attachment.id }, '1s', 'escalated-attachment')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const late = await download(
      `${PREFIX}/attachments/${attachment.id}/download?token=${encodeURIComponent(expired)}`,
      { user: TEST_USERS.agent }
    )
    assert.equal(late.status, 403)
  })

  test('a missing file or a deleted parent is 404', async ({ assert }) => {
    const { drive, Reply } = await models()
    const ticket = await openTicket()
    const { attachment } = await replyWithFile(ticket.id)
    const url = await signedUrl(attachment)
    await drive.use('private').delete(attachment.path)
    assert.equal(await statusOf(url, { user: TEST_USERS.agent }), 404)

    const { reply, attachment: orphan } = await replyWithFile(ticket.id)
    const orphanUrl = await signedUrl(orphan)
    await Reply.query().where('id', reply.id).delete()
    assert.equal(await statusOf(orphanUrl, { user: TEST_USERS.agent }), 404)
  })

  test('a file stored on the public disk by an earlier release stays readable', async ({
    assert,
  }) => {
    const ticket = await openTicket()
    const { attachment } = await replyWithFile(ticket.id, { disk: 'public', content: 'old file' })
    const file = await download(await signedUrl(attachment), { user: TEST_USERS.customer })
    assert.equal(file.status, 200, file.text)
    assert.equal(file.text, 'old file')
  })

  test('the guest page links work without a session and die when the guest token rotates', async ({
    assert,
  }) => {
    const { randomBytes } = await import('node:crypto')
    const token = randomBytes(32).toString('hex')
    const ticket = await openTicket({
      requesterType: null,
      requesterId: null,
      guestName: 'Guest',
      guestEmail: 'guest@example.com',
      guestToken: token,
    })
    await replyWithFile(ticket.id)
    await replyWithFile(ticket.id, { internal: true })

    const page = await new InertiaClient(running.baseUrl).visit('GET', `${PREFIX}/guest/${token}`)
    assert.equal(page.status, 200, JSON.stringify(page.body).slice(0, 500))
    const replies = page.body.props.ticket.replies
    assert.lengthOf(replies, 1)
    const url = replies[0].attachments[0].url
    assert.equal(await statusOf(url), 200)

    // An agent-issued link for the internal note never opens for a guest.
    const { Attachment } = await models()
    const note = await Attachment.query()
      .where('attachable_type', 'Reply')
      .whereIn(
        'attachable_id',
        running.db
          .from('escalated_replies')
          .select('id')
          .where('ticket_id', ticket.id)
          .where('is_internal_note', true)
      )
      .firstOrFail()
    const { Ticket } = await models()
    const fresh = await Ticket.findOrFail(ticket.id)
    assert.equal(await statusOf(await signedUrl(note, fresh)), 403)

    fresh.guestToken = randomBytes(32).toString('hex')
    await fresh.save()
    assert.equal(await statusOf(url), 403)
  })

  test('API clients download with their bearer token; a bad bearer never falls back', async ({
    assert,
  }) => {
    const { default: ApiToken } = await import('../../src/models/api_token.js')
    const { plainTextToken } = await ApiToken.createToken(
      { id: TEST_USERS.agent.id, constructor: { name: 'User' } },
      'attachment download',
      ['agent']
    )
    const ticket = await openTicket()
    await replyWithFile(ticket.id)

    const shown = await new InertiaClient(running.baseUrl).visit(
      'GET',
      `/support/api/v1/tickets/${ticket.reference}`,
      { headers: { Authorization: `Bearer ${plainTextToken}`, Accept: 'application/json' } }
    )
    assert.equal(shown.status, 200, JSON.stringify(shown.body).slice(0, 500))
    const url = shown.body.data.replies[0].attachments[0].url
    assert.match(url, /^\/support\/attachments\/\d+\/download\?token=/)

    const ok = await download(url, { headers: { Authorization: `Bearer ${plainTextToken}` } })
    assert.equal(ok.status, 200, ok.text)

    const bad = await download(url, {
      user: TEST_USERS.agent,
      headers: { Authorization: 'Bearer not-a-token' },
    })
    assert.equal(bad.status, 401)
  })
})
