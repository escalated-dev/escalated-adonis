import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { Message } from '@adonisjs/mail'
import { SMTPTransport } from '@adonisjs/mail/transports/smtp'

// Exercise Adonis Mail's real Nodemailer adapter without an external mail provider.
async function smtpFixture({ rejectRecipient = false } = {}) {
  const sockets = new Set()
  const recipients = []
  const messages = []
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    let pending = ''
    let data = null
    socket.write('220 localhost test SMTP\r\n')
    socket.on('data', (chunk) => {
      pending += chunk.toString()
      while (pending.includes('\r\n')) {
        const end = pending.indexOf('\r\n')
        const line = pending.slice(0, end)
        pending = pending.slice(end + 2)
        if (data !== null) {
          if (line === '.') {
            messages.push(data.join('\r\n'))
            data = null
            socket.write('250 2.0.0 queued locally\r\n')
          } else {
            data.push(line.replace(/^\.\./, '.'))
          }
        } else if (/^(EHLO|HELO) /i.test(line)) {
          socket.write('250-localhost\r\n250 SIZE 1048576\r\n')
        } else if (/^RCPT TO:/i.test(line)) {
          recipients.push(line)
          socket.write(rejectRecipient ? '550 5.1.1 rejected\r\n' : '250 2.1.5 recipient OK\r\n')
        } else if (line === 'DATA') {
          data = []
          socket.write('354 End with a single dot\r\n')
        } else if (line === 'QUIT') {
          socket.end('221 goodbye\r\n')
        } else {
          socket.write('250 2.0.0 OK\r\n')
        }
      }
    })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return {
    recipients,
    messages,
    transport: new SMTPTransport({
      host: '127.0.0.1',
      port: server.address().port,
      secure: false,
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 3000,
    }),
    async close() {
      for (const socket of sockets) socket.destroy()
      await new Promise((resolve) => server.close(resolve))
    },
  }
}

test('Adonis SMTP preserves ticket recipients, headers, bodies and attachments', async () => {
  const fixture = await smtpFixture()
  try {
    const message = new Message()
    message
      .from('support@example.test', 'Support')
      .to('requester@example.test', 'Requester')
      .cc('agent@example.test')
      .bcc('archive@example.test')
      .replyTo('reply+ticket-42@example.test')
      .subject('Support ticket 42')
      .text('Ticket reply')
      .html('<p>Ticket reply</p>')
      .header('X-Escalated-Ticket', '42')
      .attachData(Buffer.from('Case notes'), { filename: 'notes.txt' })

    const response = await fixture.transport.send(message.toObject().message)
    assert.equal(response.envelope.from, 'support@example.test')
    assert.deepEqual(
      [...response.envelope.to].sort(),
      ['requester@example.test', 'agent@example.test', 'archive@example.test'].sort()
    )
    assert.equal(fixture.recipients.length, 3)
    assert.equal(fixture.messages.length, 1)
    const raw = fixture.messages[0]
    assert.match(raw, /Subject: Support ticket 42/)
    assert.match(raw, /Reply-To: reply\+ticket-42@example\.test/)
    assert.match(raw, /X-Escalated-Ticket: 42/)
    assert.match(raw, /Content-Type: multipart\/mixed/)
    assert.match(raw, /Content-Type: text\/plain/)
    assert.match(raw, /Content-Type: text\/html/)
    assert.match(raw, /<p>Ticket reply<\/p>/)
    assert.match(raw, /filename=notes\.txt/)
    assert.ok(raw.includes(Buffer.from('Case notes').toString('base64')))
    assert.ok(!/^Bcc:/im.test(raw), 'BCC recipients must stay out of the delivered headers')
    assert.match(response.messageId, /^<.+>$/)
  } finally {
    await fixture.transport.close()
    await fixture.close()
  }
})

test('Adonis SMTP reports recipient rejection instead of a successful delivery', async () => {
  const fixture = await smtpFixture({ rejectRecipient: true })
  try {
    const message = new Message().from('support@example.test').to('rejected@example.test')
    await assert.rejects(() => fixture.transport.send(message.toObject().message), /550/)
    assert.equal(fixture.messages.length, 0)
  } finally {
    await fixture.transport.close()
    await fixture.close()
  }
})

test('Adonis provider adapters can still load Nodemailer internal entry points', async () => {
  for (const name of [
    'json',
    'smtp',
    'brevo',
    'resend',
    'mailgun',
    'sparkpost',
    'cloudflare',
    'postmark',
  ]) {
    const module = await import(`@adonisjs/mail/transports/${name}`)
    assert.ok(
      Object.values(module).some((value) => typeof value === 'function'),
      name
    )
  }
})
