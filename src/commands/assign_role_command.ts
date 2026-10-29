/*
|--------------------------------------------------------------------------
| escalated:roles:assign — CLI command
|--------------------------------------------------------------------------
|
| Gives a user an Escalated role, so an install can bootstrap its first admin
| before switching roles & permissions on (ESCALATED_ROLES_PERMISSIONS).
|
|   node ace escalated:roles:assign you@example.com admin
|   node ace escalated:roles:assign 42 light_agent
|
*/

import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Role from '../models/role.js'
import { escalatedDb } from '../helpers/config.js'
import { resolveUserModel } from '../support/user_model.js'

export default class AssignRoleCommand extends BaseCommand {
  static commandName = 'escalated:roles:assign'

  static description = 'Give a user an Escalated role'

  static help = [
    'Give a user (email address or ID) a role, admin by default:',
    '  node ace escalated:roles:assign you@example.com admin',
    '',
    'Seed the permissions and system roles first:',
    '  node ace escalated:seed-permissions',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: "The user's email address or ID" })
  declare user: string

  @args.string({
    description: 'The role slug (admin, agent, light_agent or a custom role)',
    required: false,
  })
  declare role: string

  async run() {
    const identifier = String(this.user ?? '').trim()
    const slug = String(this.role || 'admin').trim()

    const user = await this.findUser(identifier)
    if (!user) {
      this.logger.error(`No user found for [${identifier}].`)
      this.exitCode = 1
      return
    }

    const role = await Role.findBy('slug', slug)
    if (!role) {
      this.logger.error(
        `No role [${slug}]. Seed the system roles with: node ace escalated:seed-permissions`
      )
      this.exitCode = 1
      return
    }

    const db = await escalatedDb()
    const existing = await db
      .from('escalated_role_users')
      .where('role_id', role.id)
      .where('user_id', user.id)
      .first()
    if (!existing) {
      await db.table('escalated_role_users').insert({ role_id: role.id, user_id: user.id })
    }

    this.logger.success(`Gave ${identifier} the ${role.slug} role.`)
  }

  protected async findUser(identifier: string): Promise<{ id: number | string } | null> {
    if (identifier === '') return null
    const UserModel = await resolveUserModel()

    if (identifier.includes('@') && typeof UserModel.findBy === 'function') {
      const byEmail = await UserModel.findBy('email', identifier)
      if (byEmail) return byEmail
    }

    if (/^\d+$/.test(identifier) || /^[0-9a-f-]{36}$/i.test(identifier)) {
      return (await UserModel.find(identifier)) ?? null
    }

    return null
  }
}
