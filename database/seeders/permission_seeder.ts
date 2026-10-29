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
import { seedPermissionsAndRoles } from '../../src/support/permission_catalog.js'

export default class PermissionSeeder extends BaseSeeder {
  async run() {
    await seedPermissionsAndRoles()
  }
}
