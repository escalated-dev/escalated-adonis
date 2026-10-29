/*
|--------------------------------------------------------------------------
| escalated:seed-permissions — CLI command
|--------------------------------------------------------------------------
|
| Seed granular permissions and default system roles.
|
|   node ace escalated:seed-permissions
|
| This command is idempotent — safe to run multiple times.
| Permissions are upserted on slug; role-permission assignments
| are replaced for system roles only.
|
*/

import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { PERMISSIONS, seedPermissionsAndRoles } from '../support/permission_catalog.js'

export default class SeedPermissionsCommand extends BaseCommand {
  static commandName = 'escalated:seed-permissions'

  static description = 'Seed granular permissions and default system roles'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { created, updated, roles } = await seedPermissionsAndRoles()

    this.logger.success(
      `Seeded ${PERMISSIONS.length} permissions (${created} created, ${updated} updated).`
    )

    for (const role of roles) {
      this.logger.success(`Role "${role.name}" synced with ${role.permissions} permissions.`)
    }
  }
}
