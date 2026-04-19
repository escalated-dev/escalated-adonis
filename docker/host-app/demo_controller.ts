import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import AgentProfile from '@escalated-dev/escalated-adonis/models/agent_profile'
import Department from '@escalated-dev/escalated-adonis/models/department'

const AGENTS: Array<{ userId: number; label: string; chatStatus: string }> = [
  { userId: 1, label: 'Alice (Admin)', chatStatus: 'available' },
  { userId: 2, label: 'Bob (Agent)', chatStatus: 'available' },
  { userId: 3, label: 'Carol (Agent)', chatStatus: 'busy' },
]

const DEPARTMENTS = [
  { name: 'Support', slug: 'support' },
  { name: 'Billing', slug: 'billing' },
]

const LABELS_BY_USER = new Map(AGENTS.map((a) => [a.userId, a.label]))

let seeded = false

async function seedIfEmpty() {
  if (seeded) return
  const count = await AgentProfile.query().count('* as total').first()
  const total = (count as any)?.$extras?.total ?? (count as any)?.total ?? 0
  if (Number(total) > 0) {
    seeded = true
    return
  }
  const now = DateTime.now()
  for (const dep of DEPARTMENTS) {
    await Department.firstOrCreate(
      { slug: dep.slug },
      { name: dep.name, isActive: true, createdAt: now, updatedAt: now } as any
    )
  }
  for (const a of AGENTS) {
    await AgentProfile.create({
      userId: a.userId,
      chatStatus: a.chatStatus,
      maxConcurrentChats: 5,
      createdAt: now,
      updatedAt: now,
    } as any)
  }
  seeded = true
}

export default class DemoController {
  /**
   * GET / → /demo
   */
  async root({ response }: HttpContext) {
    return response.redirect('/demo')
  }

  /**
   * GET /demo — picker listing seeded agent profiles.
   */
  async picker({ response }: HttpContext) {
    await seedIfEmpty()
    const agents = await AgentProfile.query().orderBy('id', 'asc')
    const rows = agents
      .map((a) => {
        const userId = (a as any).userId
        const chatStatus = (a as any).chatStatus ?? 'offline'
        const label = LABELS_BY_USER.get(userId) ?? `Agent ${a.id}`
        return `
          <form method="POST" action="/demo/login/${a.id}">
            <button type="submit" class="user">
              <span>${escape(label)}</span>
              <span class="meta">UserId ${userId} · chat: ${escape(chatStatus)}</span>
            </button>
          </form>`
      })
      .join('')
    return response.type('text/html').send(html('Escalated · AdonisJS Demo', `
      <h1>Escalated AdonisJS Demo</h1>
      <p class="lede">Click an agent to load their profile. Database seeds on first boot.</p>
      ${rows || '<p class="meta">No agents seeded yet.</p>'}
    `))
  }

  /**
   * POST /demo/login/:id — "log in" as the chosen agent.
   *
   * The full host's auth integration would set a session cookie here. For
   * the demo we just redirect to the agent profile page, which proves the
   * package's data is reachable from a normal AdonisJS controller — the
   * same pattern dotnet/spring/phoenix demos use.
   */
  async login({ params, response }: HttpContext) {
    // 303 See Other forces the client to switch the redirected request to
    // GET, even when the original request was POST (default 302 keeps the
    // original method, which would land at "POST /demo/agent/:id" → 404).
    return response.status(303).header('Location', `/demo/agent/${params.id}`).send('')
  }

  /**
   * GET /demo/agent/:id — show the agent's profile + a few counts to
   * prove migrations + seeded data + Lucid model resolution all work
   * end-to-end against Postgres.
   */
  async agentPage({ params, response }: HttpContext) {
    const agent = await AgentProfile.find(params.id)
    if (!agent) {
      return response.status(404).type('text/html').send(html('Agent not found', `
        <h1>Agent not found</h1>
        <p><a href="/demo">Back to picker</a></p>
      `))
    }
    const departmentCount = (await Department.query().count('* as total').first()) as any
    const total = departmentCount?.$extras?.total ?? departmentCount?.total ?? 0
    const userId = (agent as any).userId
    const chatStatus = (agent as any).chatStatus ?? 'offline'
    const maxChats = (agent as any).maxConcurrentChats ?? '—'
    const label = LABELS_BY_USER.get(userId) ?? `Agent ${agent.id}`
    return response.type('text/html').send(html(`Agent ${label}`, `
      <h1>Logged in as ${escape(label)}</h1>
      <p class="meta">UserId: ${userId} · Chat status: ${escape(chatStatus)} · Max concurrent chats: ${maxChats}</p>
      <p>AdonisJS 6 host + Postgres + Lucid round-trip verified end-to-end.
      Department count: ${total}. Click <a href="/demo">back to picker</a>.</p>
    `))
  }
}

function escape(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function html(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>${escape(title)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:2rem}
  .wrap{max-width:720px;margin:0 auto}
  h1{font-size:1.5rem;margin:0 0 .25rem}
  p.lede{color:#94a3b8;margin:0 0 2rem}
  p.meta{color:#94a3b8;font-size:.85rem;margin-bottom:1rem}
  form{display:block;margin:0}
  button.user{display:flex;width:100%;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:.95rem;cursor:pointer;margin-bottom:.5rem;text-align:left}
  button.user:hover{background:#273549;border-color:#475569}
  .meta{color:#94a3b8;font-size:.8rem}
  a{color:#60a5fa}
</style></head><body><div class="wrap">
${body}
</div></body></html>`
}
