/*
|--------------------------------------------------------------------------
| Route permissions
|--------------------------------------------------------------------------
|
| The permission each admin, agent and staff API route requires while roles &
| permissions is enforced (ADR 2026-10-29-configurable-access-features). A copy
| of escalated-laravel's src/Support/RoutePermissions.php, with this port's
| extra route names added.
|
| Keys are route names, or patterns where `*` matches anything (dots
| included). The first match wins, so exact names come before patterns. A
| route that matches nothing is refused by the EnforceRoutePermissions
| middleware, and a test enumerates the router so a new route cannot ship
| without an entry here.
|
| Every slug is one the permission seeder already seeds; none are invented.
|
*/

/** Statuses whose change needs ticket.close as well as ticket.edit. */
export const CLOSING_STATUSES = ['resolved', 'closed', 'reopened'] as const

/** Bulk actions => the permissions each needs. */
export const BULK_ACTIONS: Record<string, string[]> = {
  status: ['ticket.edit'],
  priority: ['ticket.edit'],
  assign: ['ticket.assign'],
  tags: ['ticket.edit'],
  department: ['ticket.edit'],
  delete: ['ticket.delete'],
}

type Entries = Array<[string, string[]]>

/**
 * `index` (and any extra read actions) => `{group}.view`; anything else under
 * the resource => `{group}.manage`.
 */
function resource(name: string, group: string, extraReads: string[] = []): Entries {
  return [
    [`escalated.admin.${name}.index`, [`${group}.view`]],
    ...extraReads.map((read): [string, string[]] => [
      `escalated.admin.${name}.${read}`,
      [`${group}.view`],
    ]),
    [`escalated.admin.${name}.*`, [`${group}.manage`]],
  ]
}

/**
 * Route name => required permission slugs. An empty list means "staff, no
 * particular permission" and is reserved for personal screens.
 */
export const ROUTE_PERMISSIONS: Entries = [
  // ---- Personal ------------------------------------------------------------
  // Your own two-factor enrolment.
  ['escalated.admin.two-factor.*', []],

  // ---- Tickets (admin and agent panels, staff API) --------------------------
  ['escalated.agent.dashboard', ['ticket.view']],
  ['escalated.api.dashboard', ['ticket.view']],
  ['escalated.api.auth.validate', []],
  ['escalated.api.realtime', ['ticket.view']],
  ['escalated.admin.agents.search', ['ticket.view']],
  ['escalated.api.agents', ['ticket.view']],
  ['escalated.api.departments', ['ticket.view']],
  ['escalated.api.tags', ['ticket.view']],
  ['escalated.api.canned-responses', ['ticket.view']],
  ['escalated.api.macros', ['macro.view']],
  // The signed-in agent's own @-mentions.
  ['escalated.agent.mentions', ['ticket.view']],
  ['escalated.agent.mentions.read', ['ticket.view']],

  ['escalated.*.tickets.index', ['ticket.view']],
  ['escalated.*.tickets.show', ['ticket.view']],
  ['escalated.admin.tickets.merge-search', ['ticket.view']],
  ['escalated.*.tickets.follow', ['ticket.view']],
  ['escalated.*.tickets.presence', ['ticket.view']],
  ['escalated.*.tickets.typing', ['ticket.view']],
  ['escalated.admin.tickets.links.index', ['ticket.view']],
  ['escalated.admin.tickets.side-conversations.index', ['ticket.view']],
  ['escalated.api.tickets.subjects.index', ['ticket.view']],

  ['escalated.api.tickets.store', ['ticket.create']],
  ['escalated.*.tickets.split', ['ticket.create']],
  ['escalated.*.tickets.update', ['ticket.edit']],
  ['escalated.*.tickets.status', ['ticket.edit']],
  ['escalated.*.tickets.priority', ['ticket.edit']],
  ['escalated.*.tickets.tags', ['ticket.edit']],
  ['escalated.*.tickets.department', ['ticket.edit']],
  ['escalated.*.tickets.pin', ['ticket.edit']],
  ['escalated.*.tickets.custom-action', ['ticket.edit']],
  ['escalated.*.tickets.snooze', ['ticket.edit']],
  ['escalated.*.tickets.unsnooze', ['ticket.edit']],
  ['escalated.*.tickets.subjects.*', ['ticket.edit']],
  ['escalated.admin.tickets.links.store', ['ticket.edit']],
  ['escalated.admin.tickets.links.destroy', ['ticket.edit']],
  ['escalated.*.tickets.assign', ['ticket.assign']],
  ['escalated.admin.tickets.merge', ['ticket.merge']],
  ['escalated.api.tickets.destroy', ['ticket.delete']],
  ['escalated.*.tickets.macro', ['macro.view', 'ticket.edit']],
  // Bulk: per action, see requiredPermissions().
  ['escalated.*.tickets.bulk', ['ticket.view']],

  ['escalated.*.tickets.reply', ['reply.create']],
  ['escalated.*.tickets.note', ['reply.create_internal']],
  ['escalated.admin.tickets.side-conversations.*', ['reply.create']],

  ['escalated.admin.saved-views.*', ['ticket.view']],
  ['escalated.agent.views.*', ['ticket.view']],

  // ---- Live chat --------------------------------------------------------------
  ['escalated.admin.chat.routing-rules.index', ['settings.view']],
  ['escalated.admin.chat.routing-rules.*', ['settings.manage']],
  ['escalated.admin.chat.settings', ['settings.view']],
  ['escalated.admin.chat.settings.update', ['settings.manage']],
  ['escalated.admin.chat.active', ['ticket.view']],
  ['escalated.admin.chat.queue', ['ticket.view']],
  ['escalated.admin.chat.*', ['reply.create']],
  ['escalated.agent.chats.index', ['ticket.view']],
  ['escalated.agent.chats.queue', ['ticket.view']],
  ['escalated.agent.chats.*', ['reply.create']],

  // ---- Reports ----------------------------------------------------------------
  ['escalated.admin.reports.export', ['report.export']],
  ['escalated.api.reports.export', ['report.export']],
  ['escalated.admin.reports', ['report.view']],
  ['escalated.admin.reports.*', ['report.view']],
  ['escalated.api.reports.*', ['report.view']],

  // ---- Knowledge base ---------------------------------------------------------
  ['escalated.admin.kb-articles.index', ['kb.view']],
  ['escalated.admin.kb-articles.create', ['kb.create']],
  ['escalated.admin.kb-articles.store', ['kb.create']],
  ['escalated.admin.kb-articles.edit', ['kb.edit']],
  ['escalated.admin.kb-articles.update', ['kb.edit']],
  ['escalated.admin.kb-articles.destroy', ['kb.delete']],
  ['escalated.admin.kb-categories.index', ['kb.view']],
  ['escalated.admin.kb-categories.store', ['kb.edit']],
  ['escalated.admin.kb-categories.update', ['kb.edit']],
  ['escalated.admin.kb-categories.destroy', ['kb.delete']],

  // ---- Departments ------------------------------------------------------------
  ['escalated.admin.departments.index', ['department.view']],
  ['escalated.admin.departments.create', ['department.create']],
  ['escalated.admin.departments.store', ['department.create']],
  ['escalated.admin.departments.edit', ['department.edit']],
  ['escalated.admin.departments.update', ['department.edit']],
  ['escalated.admin.departments.destroy', ['department.delete']],

  // ---- Admin resources: index => *.view, everything else => *.manage ---------
  ...resource('sla-policies', 'sla'),
  ...resource('business-hours', 'sla'),
  ...resource('escalation-rules', 'escalation'),
  ...resource('automations', 'automation'),
  ...resource('workflows', 'automation', ['logs', 'workflow-logs']),
  ...resource('tags', 'tag'),
  ...resource('custom-fields', 'custom_field'),
  ...resource('statuses', 'settings'),
  ...resource('roles', 'role'),
  ...resource('skills', 'user'),
  ...resource('capacity', 'user'),
  ...resource('webhooks', 'webhook', ['deliveries']),
  ...resource('api-tokens', 'api_token'),
  ...resource('plugins', 'plugin'),
  ...resource('canned-responses', 'macro'),

  // Macros: anyone who may create one may save it; shared edits manage.
  ['escalated.admin.macros.index', ['macro.view']],
  ['escalated.admin.macros.store', ['macro.create']],
  ['escalated.admin.macros.*', ['macro.manage']],

  // Custom objects: schemas manage, records data.
  ['escalated.admin.custom-objects.records', ['custom_object.view']],
  ['escalated.admin.custom-objects.records.*', ['custom_object.data']],
  ...resource('custom-objects', 'custom_object'),

  // Users
  ['escalated.admin.users.index', ['user.view']],
  ['escalated.admin.users.role', ['user.manage']],
  ['escalated.admin.users.roles', ['role.manage']],

  ['escalated.admin.audit-log', ['audit.view']],
  ['escalated.admin.audit-logs.index', ['audit.view']],

  // ---- Settings ---------------------------------------------------------------
  ['escalated.admin.settings', ['settings.view']],
  ['escalated.admin.settings.update', ['settings.manage']],
  ['escalated.admin.settings.database.test', ['settings.manage']],
  ['escalated.admin.settings.*.update', ['settings.manage']],
  ['escalated.admin.settings.*', ['settings.view']],
  ['escalated.admin.import.*', ['settings.manage']],

  // ---- Newsletters (ADR 2026-05-19-newsletter-system) --------------------------
  ['escalated.admin.newsletters.*', ['newsletters.manage']],
]

const compiled = ROUTE_PERMISSIONS.map(([pattern, slugs]) => ({
  pattern,
  slugs,
  regex: pattern.includes('*')
    ? new RegExp(
        '^' +
          pattern
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*') +
          '$'
      )
    : null,
}))

/** The slugs mapped to the route name, or null when it is not mapped. */
export function mappedPermissions(routeName: string): string[] | null {
  for (const entry of compiled) {
    if (entry.pattern === routeName || entry.regex?.test(routeName)) return [...entry.slugs]
  }
  return null
}

export function isMapped(routeName: string): boolean {
  return mappedPermissions(routeName) !== null
}

function closing(status: unknown): string[] {
  return typeof status === 'string' && (CLOSING_STATUSES as readonly string[]).includes(status)
    ? ['ticket.close']
    : []
}

/**
 * The slugs a request to the named route needs, given its body, or null when
 * the route is not mapped (the caller refuses it).
 *
 * Actions decided by the body are checked per action: a status change to
 * resolved/closed/reopened also needs ticket.close, and a bulk action needs
 * the permission of the action it names.
 */
export function requiredPermissions(
  routeName: string,
  input: (key: string) => unknown
): string[] | null {
  let required = mappedPermissions(routeName)
  if (required === null) return null

  if (/^escalated\..+\.tickets\.bulk$/.test(routeName)) {
    const action = String(input('action') ?? '')
    required = [...required, ...(BULK_ACTIONS[action] ?? [])]
    if (action === 'status') required = [...required, ...closing(input('value'))]
  } else if (required.includes('ticket.edit') && input('status') !== undefined) {
    required = [...required, ...closing(input('status'))]
  }

  return [...new Set(required)]
}
