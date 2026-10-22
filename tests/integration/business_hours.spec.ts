import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Business hours and holidays
|--------------------------------------------------------------------------
|
| Business-hours SLA deadlines were counted against fixed configured hours
| (`sla.businessHours`), with no schedules, time zones per team or holidays.
| These cover the shared Admin/BusinessHours/* pages with the props
| escalated-laravel's BusinessHoursController passes, the writes those pages
| post, and how SlaService picks a schedule: the policy's, then the ticket
| department's, then the default one, and with none the configured hours as
| before.
|
*/

const PAGES = '/support/admin/business-hours'
const POLICIES = '/support/admin/sla-policies'
const DEPARTMENTS = '/support/admin/departments'

const nineToFive = { start: '09:00', end: '17:00' }
const weekdays = {
  monday: nineToFive,
  tuesday: nineToFive,
  wednesday: nineToFive,
  thursday: nineToFive,
  friday: nineToFive,
  saturday: { start: '', end: '' },
  sunday: { start: '', end: '' },
}

test.group('Business hours', (group) => {
  let running: TestApp
  let client: InertiaClient

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    await running.db.from('escalated_holidays').delete()
    await running.db.from('escalated_business_schedules').delete()
  })

  group.each.timeout(30_000)

  async function schedule(
    name: string,
    options: {
      timezone?: string
      isDefault?: boolean
      hours?: Record<string, { start: string; end: string }>
      holidays?: Array<{ name: string; date: string; recurring?: boolean }>
    } = {}
  ) {
    const [id] = await running.db.table('escalated_business_schedules').insert({
      name,
      timezone: options.timezone ?? 'UTC',
      is_default: options.isDefault ?? false,
      schedule: JSON.stringify(options.hours ?? weekdays),
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
    for (const holiday of options.holidays ?? []) {
      await running.db.table('escalated_holidays').insert({
        schedule_id: Number(id),
        name: holiday.name,
        date: holiday.date,
        recurring: holiday.recurring ?? false,
        created_at: sqlTimestamp(),
        updated_at: sqlTimestamp(),
      })
    }
    return Number(id)
  }

  // ---- Pages --------------------------------------------------------------------

  test('index renders BusinessHours/Index with schedules and their holidays', async ({
    assert,
  }) => {
    const id = await schedule('Head office', {
      timezone: 'America/Toronto',
      isDefault: true,
      holidays: [{ name: 'Christmas', date: '2026-12-25', recurring: true }],
    })

    const visit = await client.visit('GET', PAGES)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/BusinessHours/Index')
    const [row] = visit.body.props.schedules
    assert.sameMembers(Object.keys(row), [
      'id',
      'name',
      'timezone',
      'is_default',
      'schedule',
      'holidays',
      'created_at',
      'updated_at',
    ])
    assert.equal(row.id, id)
    assert.equal(row.name, 'Head office')
    assert.equal(row.timezone, 'America/Toronto')
    assert.isTrue(row.is_default)
    assert.deepEqual(row.schedule.monday, nineToFive)
    assert.deepEqual(row.schedule.saturday, { start: '', end: '' })
    assert.lengthOf(row.holidays, 1)
    const holiday = row.holidays[0]
    assert.sameMembers(Object.keys(holiday), [
      'id',
      'schedule_id',
      'name',
      'date',
      'recurring',
      'created_at',
      'updated_at',
    ])
    assert.equal(holiday.schedule_id, id)
    assert.equal(holiday.name, 'Christmas')
    assert.equal(holiday.date, '2026-12-25')
    assert.isTrue(holiday.recurring)
  })

  test('index renders an empty list when nothing is configured', async ({ assert }) => {
    const visit = await client.visit('GET', PAGES)
    assert.equal(visit.body.component, 'Escalated/Admin/BusinessHours/Index')
    assert.deepEqual(visit.body.props.schedules, [])
  })

  test('create renders BusinessHours/Form with the time zones and no schedule', async ({
    assert,
  }) => {
    const visit = await client.visit('GET', `${PAGES}/create`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/BusinessHours/Form')
    const { timezones } = visit.body.props
    assert.isArray(timezones)
    assert.include(timezones, 'UTC')
    assert.include(timezones, 'America/New_York')
    assert.include(timezones, 'Europe/London')
    assert.notExists(visit.body.props.schedule)
  })

  test('edit renders BusinessHours/Form with the schedule and its holidays', async ({ assert }) => {
    const id = await schedule('Support', {
      holidays: [{ name: 'Founders day', date: '2026-06-01' }],
    })

    const visit = await client.visit('GET', `${PAGES}/${id}/edit`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/BusinessHours/Form')
    const props = visit.body.props
    assert.include(props.timezones, 'UTC')
    assert.equal(props.schedule.id, id)
    assert.equal(props.schedule.name, 'Support')
    assert.equal(props.schedule.timezone, 'UTC')
    assert.isFalse(props.schedule.is_default)
    assert.deepEqual(props.schedule.schedule.friday, nineToFive)
    assert.equal(props.schedule.holidays[0].name, 'Founders day')
    assert.equal(props.schedule.holidays[0].date, '2026-06-01')
    assert.isFalse(props.schedule.holidays[0].recurring)
  })

  test('edit of a missing schedule is a 404', async ({ assert }) => {
    const visit = await client.visit('GET', `${PAGES}/999999/edit`)
    assert.equal(visit.status, 404)
  })

  // ---- Writes -------------------------------------------------------------------

  test('store creates the schedule with its holidays and takes over the default', async ({
    assert,
  }) => {
    const previous = await schedule('Old default', { isDefault: true })

    const visit = await client.visit('POST', PAGES, {
      data: {
        name: 'EMEA',
        timezone: 'Europe/London',
        is_default: true,
        schedule: weekdays,
        holidays: [
          { name: 'New Year', date: '2027-01-01', recurring: true },
          { name: 'Offsite', date: '2026-11-13', recurring: false },
        ],
      },
      referer: `${PAGES}/create`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PAGES)
    const row = await running.db.from('escalated_business_schedules').where('name', 'EMEA').first()
    assert.equal(row.timezone, 'Europe/London')
    assert.isTrue(Boolean(row.is_default))
    const stored = typeof row.schedule === 'string' ? JSON.parse(row.schedule) : row.schedule
    assert.deepEqual(stored.monday, nineToFive)
    const holidays = await running.db
      .from('escalated_holidays')
      .where('schedule_id', row.id)
      .orderBy('date')
    assert.deepEqual(
      holidays.map((h: any) => [h.name, String(h.date).slice(0, 10), Boolean(h.recurring)]),
      [
        ['Offsite', '2026-11-13', false],
        ['New Year', '2027-01-01', true],
      ]
    )
    const old = await running.db.from('escalated_business_schedules').where('id', previous).first()
    assert.isFalse(Boolean(old.is_default))

    const index = await client.visit('GET', PAGES)
    assert.equal(index.body.flash.success, 'Business schedule created.')
  })

  test('store with invalid fields goes back with errors and creates nothing', async ({
    assert,
  }) => {
    const visit = await client.visit('POST', PAGES, {
      data: {
        name: '',
        timezone: 'Mars/Olympus',
        schedule: weekdays,
        holidays: [{ name: '', date: 'not-a-date' }],
      },
      referer: `${PAGES}/create`,
    })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, `${PAGES}/create`)
    const count = await running.db.from('escalated_business_schedules').count('* as total')
    assert.equal(Number(count[0].total), 0)

    const form = await client.visit('GET', `${PAGES}/create`)
    const errors = form.body.flash.errors
    assert.properties(errors, ['name', 'timezone', 'holidays.0.name', 'holidays.0.date'])
  })

  test('store without a schedule is refused', async ({ assert }) => {
    await client.visit('POST', PAGES, {
      data: { name: 'No hours', timezone: 'UTC' },
      referer: `${PAGES}/create`,
    })
    const form = await client.visit('GET', `${PAGES}/create`)
    assert.property(form.body.flash.errors, 'schedule')
  })

  test('update changes the schedule and replaces its holidays', async ({ assert }) => {
    const id = await schedule('Support', {
      holidays: [{ name: 'Old holiday', date: '2026-05-01' }],
    })
    const other = await schedule('Other', { isDefault: true })

    const visit = await client.visit('PUT', `${PAGES}/${id}`, {
      data: {
        name: 'Support APAC',
        timezone: 'Asia/Tokyo',
        is_default: true,
        schedule: { ...weekdays, saturday: { start: '10:00', end: '14:00' } },
        holidays: [{ name: 'Culture Day', date: '2026-11-03', recurring: true }],
      },
      referer: `${PAGES}/${id}/edit`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PAGES)
    const row = await running.db.from('escalated_business_schedules').where('id', id).first()
    assert.equal(row.name, 'Support APAC')
    assert.equal(row.timezone, 'Asia/Tokyo')
    assert.isTrue(Boolean(row.is_default))
    const stored = typeof row.schedule === 'string' ? JSON.parse(row.schedule) : row.schedule
    assert.deepEqual(stored.saturday, { start: '10:00', end: '14:00' })
    const holidays = await running.db.from('escalated_holidays').where('schedule_id', id)
    assert.deepEqual(
      holidays.map((h: any) => h.name),
      ['Culture Day']
    )
    const previous = await running.db
      .from('escalated_business_schedules')
      .where('id', other)
      .first()
    assert.isFalse(Boolean(previous.is_default))
  })

  test('PATCH updates as PUT does', async ({ assert }) => {
    const id = await schedule('Support')
    const visit = await client.visit('PATCH', `${PAGES}/${id}`, {
      data: { name: 'Patched', timezone: 'UTC', schedule: weekdays, holidays: [] },
    })
    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    const row = await running.db.from('escalated_business_schedules').where('id', id).first()
    assert.equal(row.name, 'Patched')
  })

  test('destroy deletes the schedule, its holidays and the references to it', async ({
    assert,
  }) => {
    const id = await schedule('Doomed', { holidays: [{ name: 'H', date: '2026-07-01' }] })
    const [policyId] = await running.db.table('escalated_sla_policies').insert({
      name: 'Gold',
      first_response_hours: JSON.stringify({ high: 1 }),
      resolution_hours: JSON.stringify({ high: 4 }),
      business_hours_only: true,
      business_schedule_id: id,
      is_default: false,
      is_active: true,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
    const [departmentId] = await running.db.table('escalated_departments').insert({
      name: `Doomed dept ${Date.now()}`,
      slug: `doomed-${Date.now()}`,
      is_active: true,
      business_schedule_id: id,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })

    const visit = await client.visit('DELETE', `${PAGES}/${id}`, { referer: PAGES })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PAGES)
    assert.notExists(await running.db.from('escalated_business_schedules').where('id', id).first())
    assert.lengthOf(await running.db.from('escalated_holidays').where('schedule_id', id), 0)
    const policy = await running.db.from('escalated_sla_policies').where('id', policyId).first()
    assert.isNull(policy.business_schedule_id)
    const department = await running.db
      .from('escalated_departments')
      .where('id', departmentId)
      .first()
    assert.isNull(department.business_schedule_id)
    await running.db.from('escalated_sla_policies').where('id', policyId).delete()
    await running.db.from('escalated_departments').where('id', departmentId).delete()
  })

  test('the pages are admin-only', async ({ assert }) => {
    const agent = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })
    const visit = await agent.visit('GET', PAGES)
    assert.notEqual(visit.status, 200)
    assert.notEqual(visit.body?.component, 'Escalated/Admin/BusinessHours/Index')
  })

  // ---- SLA policy reference -----------------------------------------------------

  test('an SLA policy save sets business_schedule_id only when it is sent', async ({ assert }) => {
    const id = await schedule('Policy hours')
    const policyForm = {
      name: 'Silver',
      first_response_hours: { high: 2 },
      resolution_hours: { high: 8 },
      business_hours_only: true,
      is_active: true,
    }

    await client.visit('POST', POLICIES, { data: { ...policyForm, business_schedule_id: id } })
    const policy = await running.db.from('escalated_sla_policies').where('name', 'Silver').first()
    assert.equal(Number(policy.business_schedule_id), id)

    // The shared form does not send the key: the reference stays.
    await client.visit('PUT', `${POLICIES}/${policy.id}`, { data: policyForm })
    const kept = await running.db.from('escalated_sla_policies').where('id', policy.id).first()
    assert.equal(Number(kept.business_schedule_id), id)

    await client.visit('PUT', `${POLICIES}/${policy.id}`, {
      data: { ...policyForm, business_schedule_id: null },
    })
    const cleared = await running.db.from('escalated_sla_policies').where('id', policy.id).first()
    assert.isNull(cleared.business_schedule_id)
    await running.db.from('escalated_sla_policies').where('id', policy.id).delete()
  })

  test('the SLA policy and department forms list the schedules by name', async ({ assert }) => {
    const zulu = await schedule('Zulu shift')
    const alpha = await schedule('Alpha weekend')
    const expected = [
      { id: alpha, name: 'Alpha weekend' },
      { id: zulu, name: 'Zulu shift' },
    ]
    const [policyId] = await running.db.table('escalated_sla_policies').insert({
      name: `Picker ${Date.now()}`,
      first_response_hours: JSON.stringify({ high: 1 }),
      resolution_hours: JSON.stringify({ high: 4 }),
      business_hours_only: true,
      business_schedule_id: alpha,
      is_default: false,
      is_active: true,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
    const [departmentId] = await running.db.table('escalated_departments').insert({
      name: `Picker dept ${Date.now()}`,
      slug: `picker-${Date.now()}`,
      is_active: true,
      business_schedule_id: zulu,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })

    for (const [path, component] of [
      [`${POLICIES}/create`, 'Escalated/Admin/SlaPolicies/Form'],
      [`${POLICIES}/${policyId}/edit`, 'Escalated/Admin/SlaPolicies/Form'],
      [`${DEPARTMENTS}/create`, 'Escalated/Admin/Departments/Form'],
      [`${DEPARTMENTS}/${departmentId}/edit`, 'Escalated/Admin/Departments/Form'],
    ]) {
      const visit = await client.visit('GET', path)
      assert.equal(visit.status, 200, JSON.stringify(visit.body))
      assert.equal(visit.body.component, component)
      assert.deepEqual(
        visit.body.props.schedules.map((row: any) => ({ id: Number(row.id), name: row.name })),
        expected,
        path
      )
      assert.sameMembers(Object.keys(visit.body.props.schedules[0]), ['id', 'name'])
    }

    // The records carry the snake_case keys the shared forms read.
    const departmentEdit = await client.visit('GET', `${DEPARTMENTS}/${departmentId}/edit`)
    const department = departmentEdit.body.props.department
    assert.equal(Number(department.business_schedule_id), zulu)
    assert.properties(department, ['id', 'name', 'slug', 'description', 'is_active'])
    const policyEdit = await client.visit('GET', `${POLICIES}/${policyId}/edit`)
    const policy = policyEdit.body.props.policy
    assert.equal(Number(policy.business_schedule_id), alpha)
    assert.properties(policy, [
      'id',
      'name',
      'first_response_hours',
      'resolution_hours',
      'business_hours_only',
      'is_default',
      'is_active',
    ])

    await running.db.from('escalated_sla_policies').where('id', policyId).delete()
    await running.db.from('escalated_departments').where('id', departmentId).delete()
  })

  test('a department save sets business_schedule_id only when it is sent', async ({ assert }) => {
    const id = await schedule('Department hours')
    const name = `Returns ${Date.now()}`

    await client.visit('POST', DEPARTMENTS, {
      data: { name, is_active: true, business_schedule_id: id },
    })
    const dept = await running.db.from('escalated_departments').where('name', name).first()
    assert.equal(Number(dept.business_schedule_id), id)

    await client.visit('PUT', `${DEPARTMENTS}/${dept.id}`, { data: { name, is_active: true } })
    const kept = await running.db.from('escalated_departments').where('id', dept.id).first()
    assert.equal(Number(kept.business_schedule_id), id)

    await client.visit('PUT', `${DEPARTMENTS}/${dept.id}`, {
      data: { name, is_active: true, business_schedule_id: null },
    })
    const cleared = await running.db.from('escalated_departments').where('id', dept.id).first()
    assert.isNull(cleared.business_schedule_id)
    await running.db.from('escalated_departments').where('id', dept.id).delete()
  })

  test('a schedule that does not exist is a field error and saves nothing', async ({ assert }) => {
    const id = await schedule('Kept hours')
    const name = `Ghost ${Date.now()}`

    const created = await client.visit('POST', DEPARTMENTS, {
      data: { name, business_schedule_id: 999999 },
      referer: `${DEPARTMENTS}/create`,
    })
    assert.equal(created.status, 302)
    assert.equal(created.location, `${DEPARTMENTS}/create`)
    assert.notExists(await running.db.from('escalated_departments').where('name', name).first())
    const form = await client.visit('GET', `${DEPARTMENTS}/create`)
    assert.property(form.body.flash.errors, 'business_schedule_id')

    const [policyId] = await running.db.table('escalated_sla_policies').insert({
      name: `Kept ${Date.now()}`,
      first_response_hours: JSON.stringify({ high: 1 }),
      resolution_hours: JSON.stringify({ high: 4 }),
      business_hours_only: true,
      business_schedule_id: id,
      is_default: false,
      is_active: true,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
    const updated = await client.visit('PUT', `${POLICIES}/${policyId}`, {
      data: {
        name: 'Renamed',
        first_response_hours: { high: 1 },
        resolution_hours: { high: 4 },
        business_schedule_id: 999999,
      },
      referer: `${POLICIES}/${policyId}/edit`,
    })
    assert.equal(updated.status, 302)
    assert.equal(updated.location, `${POLICIES}/${policyId}/edit`)
    const policy = await running.db.from('escalated_sla_policies').where('id', policyId).first()
    assert.equal(Number(policy.business_schedule_id), id)
    assert.notEqual(policy.name, 'Renamed')

    const ghost = await client.visit('POST', POLICIES, {
      data: {
        name: `Ghost policy ${Date.now()}`,
        first_response_hours: { high: 1 },
        resolution_hours: { high: 4 },
        business_schedule_id: 999999,
      },
      referer: `${POLICIES}/create`,
    })
    assert.equal(ghost.location, `${POLICIES}/create`)
    const ghosts = await running.db
      .from('escalated_sla_policies')
      .where('name', 'like', 'Ghost policy%')
    assert.lengthOf(ghosts, 0)
    await running.db.from('escalated_sla_policies').where('id', policyId).delete()
  })

  // ---- SLA deadlines ------------------------------------------------------------

  async function dueDates(options: { policySchedule?: number; departmentSchedule?: number }) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const { default: SlaPolicy } = await import('../../src/models/sla_policy.js')
    const { default: Department } = await import('../../src/models/department.js')
    const { default: SlaService } = await import('../../src/services/sla_service.js')

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const department = await Department.create({
      name: `Dept ${stamp}`,
      slug: `dept-${stamp}`,
      isActive: true,
      businessScheduleId: options.departmentSchedule ?? null,
    })
    const policy = await SlaPolicy.create({
      name: `Policy ${stamp}`,
      description: null,
      isDefault: false,
      firstResponseHours: { high: 2 },
      resolutionHours: { high: 2 },
      businessHoursOnly: true,
      businessScheduleId: options.policySchedule ?? null,
      isActive: true,
    } as any)
    const ticket = await Ticket.create({
      reference: `BH-${stamp}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject: 'Business hours',
      description: 'Business hours SLA test',
      status: 'open',
      priority: 'high',
      ticketType: 'question',
      channel: 'web',
      departmentId: department.id,
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
    // Monday 2026-10-19 16:00 UTC.
    ticket.createdAt = DateTime.fromISO('2026-10-19T16:00:00Z')

    await new SlaService().attachPolicy(ticket, policy)

    const stored = await Ticket.findOrFail(ticket.id)
    await stored.delete()
    await policy.delete()
    await department.delete()
    return {
      firstResponse: stored.firstResponseDueAt!.toUTC().toISO(),
      resolution: stored.resolutionDueAt!.toUTC().toISO(),
    }
  }

  // Monday 16:00 UTC plus 2 business hours, per schedule:
  //  - configured hours (09:00-17:00 UTC weekdays): Tuesday 10:00
  //  - default schedule (12:00-17:00 UTC):           Tuesday 13:00
  //  - department schedule (09:00-17:00 Toronto):    Monday 18:00
  //  - policy schedule (Tuesday a holiday):          Wednesday 10:00
  async function threeSchedules() {
    await schedule('Default', {
      isDefault: true,
      hours: {
        ...weekdays,
        monday: { start: '12:00', end: '17:00' },
        tuesday: { start: '12:00', end: '17:00' },
      },
    })
    const department = await schedule('Toronto', { timezone: 'America/Toronto' })
    const policy = await schedule('Policy', {
      holidays: [{ name: 'Closed', date: '2026-10-20' }],
    })
    return { department, policy }
  }

  test('the policy schedule comes first', async ({ assert }) => {
    const ids = await threeSchedules()
    const due = await dueDates({ policySchedule: ids.policy, departmentSchedule: ids.department })
    assert.equal(due.firstResponse, '2026-10-21T10:00:00.000Z')
    assert.equal(due.resolution, '2026-10-21T10:00:00.000Z')
  })

  test('then the department schedule', async ({ assert }) => {
    const ids = await threeSchedules()
    const due = await dueDates({ departmentSchedule: ids.department })
    assert.equal(due.firstResponse, '2026-10-19T18:00:00.000Z')
  })

  test('then the default schedule', async ({ assert }) => {
    await threeSchedules()
    const due = await dueDates({})
    assert.equal(due.firstResponse, '2026-10-20T13:00:00.000Z')
  })

  test('a reference to a deleted schedule falls through to the next', async ({ assert }) => {
    const ids = await threeSchedules()
    const due = await dueDates({ policySchedule: 999999, departmentSchedule: ids.department })
    assert.equal(due.firstResponse, '2026-10-19T18:00:00.000Z')
  })

  test('with no schedule configured, the configured hours apply as before', async ({ assert }) => {
    const due = await dueDates({})
    assert.equal(due.firstResponse, '2026-10-20T10:00:00.000Z')
    assert.equal(due.resolution, '2026-10-20T10:00:00.000Z')
  })
})
