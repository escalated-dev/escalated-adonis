/*
|--------------------------------------------------------------------------
| Permission Seeder
|--------------------------------------------------------------------------
|
| Seed granular permissions and default system roles.
|
| This seeder is idempotent — safe to run multiple times.
| Permissions are upserted via firstOrCreate on slug.
| Role-permission assignments are replaced for system roles only.
|
|   node ace db:seed --files=database/seeders/permission_seeder.ts
|   — or via the dedicated command:
|   node ace escalated:seed-permissions
|
*/

import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '../../src/models/permission.js'
import Role from '../../src/models/role.js'

const PERMISSIONS = [
  // Tickets
  { slug: 'ticket.view', name: 'View tickets', group: 'Tickets', description: 'View tickets' },
  {
    slug: 'ticket.create',
    name: 'Create tickets',
    group: 'Tickets',
    description: 'Create tickets',
  },
  {
    slug: 'ticket.edit',
    name: 'Edit ticket properties',
    group: 'Tickets',
    description: 'Edit ticket properties',
  },
  {
    slug: 'ticket.delete',
    name: 'Delete tickets',
    group: 'Tickets',
    description: 'Delete tickets',
  },
  {
    slug: 'ticket.assign',
    name: 'Assign tickets',
    group: 'Tickets',
    description: 'Assign tickets to agents',
  },
  {
    slug: 'ticket.merge',
    name: 'Merge tickets',
    group: 'Tickets',
    description: 'Merge tickets together',
  },
  {
    slug: 'ticket.close',
    name: 'Close tickets',
    group: 'Tickets',
    description: 'Close and reopen tickets',
  },
  {
    slug: 'ticket.export',
    name: 'Export tickets',
    group: 'Tickets',
    description: 'Export ticket data',
  },

  // Replies
  {
    slug: 'reply.create',
    name: 'Reply to tickets',
    group: 'Replies',
    description: 'Reply to tickets',
  },
  {
    slug: 'reply.create_internal',
    name: 'Add internal notes',
    group: 'Replies',
    description: 'Add internal notes',
  },
  { slug: 'reply.edit', name: 'Edit replies', group: 'Replies', description: 'Edit replies' },
  { slug: 'reply.delete', name: 'Delete replies', group: 'Replies', description: 'Delete replies' },

  // Knowledge Base
  {
    slug: 'kb.view',
    name: 'View knowledge base',
    group: 'Knowledge Base',
    description: 'View knowledge base',
  },
  {
    slug: 'kb.create',
    name: 'Create articles',
    group: 'Knowledge Base',
    description: 'Create articles',
  },
  { slug: 'kb.edit', name: 'Edit articles', group: 'Knowledge Base', description: 'Edit articles' },
  {
    slug: 'kb.delete',
    name: 'Delete articles',
    group: 'Knowledge Base',
    description: 'Delete articles',
  },
  {
    slug: 'kb.publish',
    name: 'Publish articles',
    group: 'Knowledge Base',
    description: 'Publish/unpublish articles',
  },

  // Departments
  {
    slug: 'department.view',
    name: 'View departments',
    group: 'Departments',
    description: 'View departments',
  },
  {
    slug: 'department.create',
    name: 'Create departments',
    group: 'Departments',
    description: 'Create departments',
  },
  {
    slug: 'department.edit',
    name: 'Edit departments',
    group: 'Departments',
    description: 'Edit departments',
  },
  {
    slug: 'department.delete',
    name: 'Delete departments',
    group: 'Departments',
    description: 'Delete departments',
  },

  // Reports
  {
    slug: 'report.view',
    name: 'View reports',
    group: 'Reports',
    description: 'View reports and analytics',
  },
  {
    slug: 'report.export',
    name: 'Export reports',
    group: 'Reports',
    description: 'Export report data',
  },

  // SLA
  { slug: 'sla.view', name: 'View SLA policies', group: 'SLA', description: 'View SLA policies' },
  {
    slug: 'sla.manage',
    name: 'Manage SLA policies',
    group: 'SLA',
    description: 'Create, edit, delete SLA policies',
  },

  // Automations
  {
    slug: 'automation.view',
    name: 'View automations',
    group: 'Automations',
    description: 'View automations',
  },
  {
    slug: 'automation.manage',
    name: 'Manage automations',
    group: 'Automations',
    description: 'Create, edit, delete automations',
  },

  // Escalation Rules
  {
    slug: 'escalation.view',
    name: 'View escalation rules',
    group: 'Escalation Rules',
    description: 'View escalation rules',
  },
  {
    slug: 'escalation.manage',
    name: 'Manage escalation rules',
    group: 'Escalation Rules',
    description: 'Create, edit, delete escalation rules',
  },

  // Macros
  { slug: 'macro.view', name: 'View macros', group: 'Macros', description: 'View macros' },
  {
    slug: 'macro.create',
    name: 'Create macros',
    group: 'Macros',
    description: 'Create personal macros',
  },
  {
    slug: 'macro.manage',
    name: 'Manage macros',
    group: 'Macros',
    description: 'Create, edit, delete shared macros',
  },

  // Tags
  { slug: 'tag.view', name: 'View tags', group: 'Tags', description: 'View tags' },
  {
    slug: 'tag.manage',
    name: 'Manage tags',
    group: 'Tags',
    description: 'Create, edit, delete tags',
  },

  // Custom Fields
  {
    slug: 'custom_field.view',
    name: 'View custom fields',
    group: 'Custom Fields',
    description: 'View custom fields',
  },
  {
    slug: 'custom_field.manage',
    name: 'Manage custom fields',
    group: 'Custom Fields',
    description: 'Create, edit, delete custom fields',
  },

  // Roles
  { slug: 'role.view', name: 'View roles', group: 'Roles', description: 'View roles' },
  {
    slug: 'role.manage',
    name: 'Manage roles',
    group: 'Roles',
    description: 'Create, edit, delete roles and assign permissions',
  },

  // Users
  { slug: 'user.view', name: 'View users', group: 'Users', description: 'View user profiles' },
  {
    slug: 'user.manage',
    name: 'Manage users',
    group: 'Users',
    description: 'Manage user accounts and agent profiles',
  },

  // Settings
  { slug: 'settings.view', name: 'View settings', group: 'Settings', description: 'View settings' },
  {
    slug: 'settings.manage',
    name: 'Manage settings',
    group: 'Settings',
    description: 'Manage system settings',
  },

  // Webhooks
  { slug: 'webhook.view', name: 'View webhooks', group: 'Webhooks', description: 'View webhooks' },
  {
    slug: 'webhook.manage',
    name: 'Manage webhooks',
    group: 'Webhooks',
    description: 'Create, edit, delete webhooks',
  },

  // API Tokens
  {
    slug: 'api_token.view',
    name: 'View API tokens',
    group: 'API Tokens',
    description: 'View API tokens',
  },
  {
    slug: 'api_token.manage',
    name: 'Manage API tokens',
    group: 'API Tokens',
    description: 'Create, revoke API tokens',
  },

  // Audit Log
  { slug: 'audit.view', name: 'View audit log', group: 'Audit Log', description: 'View audit log' },

  // Plugins
  { slug: 'plugin.view', name: 'View plugins', group: 'Plugins', description: 'View plugins' },
  {
    slug: 'plugin.manage',
    name: 'Manage plugins',
    group: 'Plugins',
    description: 'Install, configure, remove plugins',
  },

  // Custom Objects
  {
    slug: 'custom_object.view',
    name: 'View custom objects',
    group: 'Custom Objects',
    description: 'View custom objects',
  },
  {
    slug: 'custom_object.manage',
    name: 'Manage custom objects',
    group: 'Custom Objects',
    description: 'Create, edit, delete custom object schemas',
  },
  {
    slug: 'custom_object.data',
    name: 'Manage custom object data',
    group: 'Custom Objects',
    description: 'Manage custom object records',
  },
] as const

const ROLES = [
  {
    slug: 'admin',
    name: 'Admin',
    description: 'Full access to all features and settings.',
    permissions: ['*'],
  },
  {
    slug: 'agent',
    name: 'Agent',
    description: 'Standard agent with ticket handling and limited administrative access.',
    permissions: [
      'ticket.*',
      'reply.*',
      'kb.view',
      'report.view',
      'macro.view',
      'macro.create',
      'tag.view',
      'custom_field.view',
      'audit.view',
    ],
  },
  {
    slug: 'light_agent',
    name: 'Light Agent',
    description: 'Limited agent with read-only ticket access and internal note capability.',
    permissions: [
      'ticket.view',
      'reply.create',
      'reply.create_internal',
      'kb.view',
      'macro.view',
      'tag.view',
    ],
  },
] as const

/**
 * Resolve a mix of exact slugs and wildcard patterns to Permission instances.
 *
 * Supports: "ticket.view" (exact) and "ticket.*" (wildcard).
 * A single "*" grants all permissions.
 */
function resolvePermissions(
  patterns: readonly string[],
  slugIndex: Map<string, Permission>
): Permission[] {
  const resolved: Permission[] = []

  for (const pattern of patterns) {
    if (pattern === '*') {
      return [...slugIndex.values()]
    }

    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -1) // e.g. "ticket."
      for (const [slug, perm] of slugIndex) {
        if (slug.startsWith(prefix)) {
          resolved.push(perm)
        }
      }
    } else {
      const perm = slugIndex.get(pattern)
      if (perm) {
        resolved.push(perm)
      }
    }
  }

  // Deduplicate by id
  const seen = new Set<number>()
  return resolved.filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
}

export default class PermissionSeeder extends BaseSeeder {
  async run() {
    // ---- Seed permissions ----
    for (const attrs of PERMISSIONS) {
      const existing = await Permission.findBy('slug', attrs.slug)
      if (existing) {
        existing.merge({ name: attrs.name, group: attrs.group, description: attrs.description })
        await existing.save()
      } else {
        await Permission.create({ ...attrs })
      }
    }

    // ---- Seed roles ----
    const allPermissions = await Permission.all()
    const slugIndex = new Map(allPermissions.map((p) => [p.slug, p]))

    for (const definition of ROLES) {
      let role = await Role.findBy('slug', definition.slug)
      if (role) {
        role.merge({
          name: definition.name,
          description: definition.description,
          isSystem: true,
        })
        await role.save()
      } else {
        role = await Role.create({
          slug: definition.slug,
          name: definition.name,
          description: definition.description,
          isSystem: true,
        })
      }

      const resolved = resolvePermissions(definition.permissions, slugIndex)
      await role.related('permissions').sync(resolved.map((p) => p.id))
    }
  }
}
