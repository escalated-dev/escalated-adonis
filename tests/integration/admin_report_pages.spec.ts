import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Report pages: dashboard, agents, SLA, CSAT, agent detail
|--------------------------------------------------------------------------
|
| The shared Reports overview links to escalated.admin.reports.dashboard,
| .agents, .sla and .csat; the dashboard links to the advanced screens by
| escalated-laravel's names (sla-trends, response-times, resolution-times,
| agent-ranking); the agent ranking links to .agent-detail; the CSAT report
| links to escalated.admin.settings.csat. None of those names existed here,
| so each of those pages failed on its first route() call.
|
| These tests seed a small, known set of tickets and ratings and check every
| prop each page reads, in the shapes escalated-laravel's ReportController and
| ReportingService send.
|
*/

const REPORTS = '/support/admin/reports'

/** A SQL timestamp `hours` before now. */
function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString().slice(0, 19).replace('T', ' ')
}

test.group('Report pages', (group) => {
  let running: TestApp
  let client: InertiaClient
  let policyId: number
  let sequence = 0

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    await running.db.from('escalated_satisfaction_ratings').delete()
    await running.db.from('escalated_replies').delete()
    await running.db.from('escalated_ticket_activities').delete()
    await running.db.from('escalated_tickets').delete()
    await running.db.from('escalated_sla_policies').delete()
    await running.db
      .from('escalated_settings')
      .whereIn('key', [
        'csat_question_text',
        'csat_scale',
        'csat_delivery_trigger',
        'csat_delay_hours',
      ])
      .delete()

    const [id] = await running.db.table('escalated_sla_policies').insert({
      name: 'Standard',
      first_response_hours: JSON.stringify({ low: 8 }),
      resolution_hours: JSON.stringify({ low: 48 }),
      is_active: true,
      created_at: hoursAgo(1000),
      updated_at: hoursAgo(1000),
    })
    policyId = Number(id)
  })

  group.each.timeout(30_000)

  async function ticket(fields: {
    createdHoursAgo: number
    assignedTo?: number | null
    firstResponseAfter?: number | null
    resolvedAfter?: number | null
    breachedFirst?: boolean
    breachedResolution?: boolean
    sla?: boolean
    status?: string
    priority?: string
  }) {
    sequence += 1
    const created = fields.createdHoursAgo
    const [id] = await running.db.table('escalated_tickets').insert({
      reference: `RPT-${sequence}`,
      requester_type: 'User',
      requester_id: TEST_USERS.customer.id,
      subject: `Report ticket ${sequence}`,
      description: 'Seeded by the report page tests',
      status: fields.status ?? 'open',
      priority: fields.priority ?? 'low',
      channel: 'web',
      assigned_to: fields.assignedTo ?? null,
      sla_policy_id: fields.sla === false ? null : policyId,
      sla_first_response_breached: fields.breachedFirst ?? false,
      sla_resolution_breached: fields.breachedResolution ?? false,
      first_response_at:
        fields.firstResponseAfter === null || fields.firstResponseAfter === undefined
          ? null
          : hoursAgo(created - fields.firstResponseAfter),
      resolved_at:
        fields.resolvedAfter === null || fields.resolvedAfter === undefined
          ? null
          : hoursAgo(created - fields.resolvedAfter),
      created_at: hoursAgo(created),
      updated_at: hoursAgo(created),
    })
    return Number(id)
  }

  async function rating(ticketId: number, value: number, createdHoursAgo = 1) {
    await running.db.table('escalated_satisfaction_ratings').insert({
      ticket_id: ticketId,
      rating: value,
      created_at: hoursAgo(createdHoursAgo),
    })
  }

  /**
   * Agent 2: two tickets, one resolved; first responses after 2h and 4h,
   * resolution after 10h. Rated 4 and 2.
   * Unassigned: one ticket, breached on first response.
   * One ticket outside the 30-day window.
   */
  async function seed() {
    const a = await ticket({
      createdHoursAgo: 48,
      assignedTo: TEST_USERS.agent.id,
      firstResponseAfter: 2,
      resolvedAfter: 10,
      status: 'resolved',
      priority: 'high',
    })
    const b = await ticket({
      createdHoursAgo: 24,
      assignedTo: TEST_USERS.agent.id,
      firstResponseAfter: 4,
    })
    const c = await ticket({ createdHoursAgo: 12, breachedFirst: true })
    await ticket({ createdHoursAgo: 24 * 40, assignedTo: TEST_USERS.agent.id })
    await rating(a, 4)
    await rating(b, 2)
    return { a, b, c }
  }

  // ---- Dashboard ----------------------------------------------------------------

  test('dashboard renders Reports/Dashboard with every prop the page reads', async ({ assert }) => {
    await seed()

    const visit = await client.visit('GET', `${REPORTS}/dashboard`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Reports/Dashboard')
    const p = visit.body.props
    assert.equal(p.period_days, 30)

    // Per day, `{label, value}`, inside the window only.
    assert.isArray(p.volume)
    assert.equal(
      p.volume.reduce((sum: number, row: any) => sum + row.value, 0),
      3
    )
    for (const row of p.volume) assert.match(row.label, /^\d{4}-\d{2}-\d{2}$/)

    // All tickets, as Laravel's getTicketsByStatus / ByPriority.
    assert.deepInclude(p.by_status, { label: 'open', value: 3 })
    assert.deepInclude(p.by_status, { label: 'resolved', value: 1 })
    assert.deepInclude(p.by_priority, { label: 'high', value: 1 })

    assert.equal(p.avg_response_hours, 3)
    assert.equal(p.avg_resolution_hours, 10)
    // 3 tickets with a policy in the window, one breached.
    assert.equal(p.sla_compliance, 66.7)
    assert.equal(p.csat_average, 3)

    assert.lengthOf(p.agent_performance, 1)
    const [agent] = p.agent_performance
    assert.equal(agent.agent_id, TEST_USERS.agent.id)
    assert.equal(agent.agent_name, TEST_USERS.agent.name)
    assert.equal(agent.total_tickets, 2)
    assert.equal(agent.resolved_tickets, 1)
    assert.equal(agent.avg_response_hours, 3)
    assert.equal(agent.avg_resolution_hours, 10)
  })

  test('dashboard honours days and is 100% compliant with no SLA tickets', async ({ assert }) => {
    await ticket({ createdHoursAgo: 24 * 10, sla: false })

    const visit = await client.visit('GET', `${REPORTS}/dashboard?days=7`)

    assert.equal(visit.body.props.period_days, 7)
    assert.equal(visit.body.props.sla_compliance, 100)
    assert.equal(visit.body.props.avg_response_hours, 0)
    assert.deepEqual(visit.body.props.agent_performance, [])
  })

  // ---- Agents -------------------------------------------------------------------

  test('agents renders Reports/AgentMetrics', async ({ assert }) => {
    await seed()

    const visit = await client.visit('GET', `${REPORTS}/agents`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Reports/AgentMetrics')
    assert.equal(visit.body.props.period_days, 30)
    const [agent] = visit.body.props.agents
    assert.equal(agent.agent_id, TEST_USERS.agent.id)
    assert.equal(agent.agent_name, TEST_USERS.agent.name)
    assert.equal(agent.total_tickets, 2)
    assert.equal(agent.resolved_tickets, 1)
    assert.equal(agent.avg_response_hours, 3)
    assert.equal(agent.avg_resolution_hours, 10)
  })

  // ---- SLA ----------------------------------------------------------------------

  test('sla renders Reports/SlaReport with compliance by policy and breaches', async ({
    assert,
  }) => {
    const { c } = await seed()

    const visit = await client.visit('GET', `${REPORTS}/sla`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Reports/SlaReport')
    const p = visit.body.props
    assert.equal(p.period_days, 30)
    assert.equal(p.compliance_rate, 66.7)
    assert.deepEqual(p.compliance_by_policy, [
      { policy_name: 'Standard', total: 3, met: 2, breached: 1 },
    ])
    assert.lengthOf(p.breaches, 1)
    const [breach] = p.breaches
    assert.equal(breach.id, c)
    assert.match(breach.reference, /^RPT-/)
    assert.isString(breach.subject)
    assert.isTrue(breach.sla_first_response_breached)
    assert.isFalse(breach.sla_resolution_breached)
    assert.equal(breach.sla_policy.name, 'Standard')
    assert.isString(breach.created_at)
  })

  // ---- CSAT ---------------------------------------------------------------------

  test('csat renders Reports/CsatReport', async ({ assert }) => {
    await seed()

    const visit = await client.visit('GET', `${REPORTS}/csat`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Reports/CsatReport')
    const p = visit.body.props
    assert.equal(p.period_days, 30)
    assert.equal(p.csat_average, 3)
    assert.equal(p.total_ratings, 2)
    // 2 ratings over 3 tickets in the window.
    assert.equal(p.response_rate, 66.7)
    assert.deepEqual(p.by_agent, [
      {
        agent_id: TEST_USERS.agent.id,
        agent_name: TEST_USERS.agent.name,
        avg_rating: 3,
        total_ratings: 2,
      },
    ])
    assert.lengthOf(p.over_time, 1)
    assert.match(p.over_time[0].label, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(p.over_time[0].value, 3)
  })

  // ---- Agent detail ---------------------------------------------------------------

  test('agent detail renders Reports/AgentDetail with the props the page reads', async ({
    assert,
  }) => {
    await seed()

    const visit = await client.visit('GET', `${REPORTS}/agent/${TEST_USERS.agent.id}/detail`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Reports/AgentDetail')
    const p = visit.body.props
    assert.equal(p.period_days, 30)
    assert.equal(p.agent_id, TEST_USERS.agent.id)
    assert.deepEqual(p.agent, { id: TEST_USERS.agent.id, name: TEST_USERS.agent.name })
    assert.equal(p.total_tickets, 2)
    assert.equal(p.resolved_tickets, 1)
    assert.equal(p.avg_frt, 3)
    assert.equal(p.avg_resolution, 10)
    assert.equal(p.csat_score, 3)
    assert.sameMembers(Object.keys(p.response_percentiles), ['p50', 'p75', 'p90', 'p95', 'p99'])
    assert.equal(p.response_percentiles.p50, 3)
    assert.isArray(p.productivity)
    assert.isArray(p.workload)
    assert.equal(
      p.workload.reduce((sum: number, row: any) => sum + row.value, 0),
      2
    )
    assert.deepInclude(p.csat_breakdown, { label: '4 stars', value: 1 })
    assert.deepInclude(p.csat_breakdown, { label: '2 stars', value: 1 })
    // The ticket 40 days ago falls in the previous 30-day period.
    assert.equal(p.prev_total_tickets, 1)
    assert.equal(p.prev_resolved_tickets, 0)
    assert.equal(p.prev_avg_frt, 0)
    assert.equal(p.prev_avg_resolution, 0)
    assert.isNull(p.prev_csat_score)
  })

  // ---- Route names the pages link to ------------------------------------------------

  test('the advanced screens answer at the paths and names the dashboard links to', async ({
    assert,
  }) => {
    const screens: Array<[string, string]> = [
      ['sla-trends', 'Escalated/Admin/Reports/SlaTrends'],
      ['response-times', 'Escalated/Admin/Reports/ResponseTimes'],
      ['resolution-times', 'Escalated/Admin/Reports/ResolutionTimes'],
      ['agent-ranking', 'Escalated/Admin/Reports/AgentRanking'],
    ]

    for (const [path, component] of screens) {
      const visit = await client.visit('GET', `${REPORTS}/${path}`)
      assert.equal(visit.status, 200, `${path}: ${JSON.stringify(visit.body)}`)
      assert.equal(visit.body.component, component)
    }

    const { default: router } = await import('@adonisjs/core/services/router')
    for (const name of [
      'escalated.admin.reports.dashboard',
      'escalated.admin.reports.agents',
      'escalated.admin.reports.sla',
      'escalated.admin.reports.csat',
      'escalated.admin.reports.sla-trends',
      'escalated.admin.reports.response-times',
      'escalated.admin.reports.resolution-times',
      'escalated.admin.reports.agent-ranking',
      'escalated.admin.reports.agent-detail',
      'escalated.admin.reports.cohorts',
      'escalated.admin.reports.comparison',
      'escalated.admin.settings.csat',
      'escalated.admin.settings.csat.update',
    ]) {
      assert.isTrue(router.has(name), `route ${name} is missing`)
    }
  })

  test('report pages are admin only', async ({ assert }) => {
    const agent = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })
    const visit = await agent.visit('GET', `${REPORTS}/dashboard`)
    assert.notEqual(visit.status, 200)
  })

  // ---- CSAT settings ----------------------------------------------------------------

  test('csat settings renders the stored settings with defaults', async ({ assert }) => {
    const visit = await client.visit('GET', '/support/admin/settings/csat')

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Settings/CsatSettings')
    assert.deepEqual(visit.body.props.settings, {
      csat_question_text: 'How would you rate your support experience?',
      csat_scale: '1-5',
      csat_delivery_trigger: 'on_resolve',
      csat_delay_hours: 0,
    })
  })

  test('csat settings saves valid values and refuses invalid ones', async ({ assert }) => {
    const saved = await client.visit('POST', '/support/admin/settings/csat', {
      data: {
        csat_question_text: 'How did we do?',
        csat_scale: '1-3',
        csat_delivery_trigger: 'delayed',
        csat_delay_hours: 24,
      },
      referer: '/support/admin/settings/csat',
    })
    assert.equal(saved.status, 302, JSON.stringify(saved.body))
    assert.equal(saved.location, '/support/admin/settings/csat')

    const after = await client.visit('GET', '/support/admin/settings/csat')
    assert.deepEqual(after.body.props.settings, {
      csat_question_text: 'How did we do?',
      csat_scale: '1-3',
      csat_delivery_trigger: 'delayed',
      csat_delay_hours: 24,
    })

    const refused = await client.visit('POST', '/support/admin/settings/csat', {
      data: {
        csat_question_text: 'x',
        csat_scale: '1-10',
        csat_delivery_trigger: 'delayed',
        csat_delay_hours: 24,
      },
      referer: '/support/admin/settings/csat',
    })
    assert.equal(refused.status, 302)
    const unchanged = await client.visit('GET', '/support/admin/settings/csat')
    assert.equal(unchanged.body.props.settings.csat_scale, '1-3')
  })
})
