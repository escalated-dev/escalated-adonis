/*
|--------------------------------------------------------------------------
| escalated:two-factor:reset — CLI command
|--------------------------------------------------------------------------
|
| Clears a user's two-factor enrolment (a lost device), so they can sign in
| and set it up again:
|
|   node ace escalated:two-factor:reset you@example.com
|   node ace escalated:two-factor:reset 42
|
*/

import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import TwoFactor from '../models/two_factor.js'
import { resolveUserModel } from '../support/user_model.js'

export default class ResetTwoFactorCommand extends BaseCommand {
  static commandName = 'escalated:two-factor:reset'

  static description = "Remove a user's two-factor enrolment so they can set it up again"

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: "The user's email address or ID" })
  declare user: string

  async run() {
    const identifier = String(this.user ?? '').trim()
    const user = await this.findUser(identifier)
    if (!user) {
      this.logger.error(`No user found for [${identifier}].`)
      this.exitCode = 1
      return
    }

    const existing = await TwoFactor.query().where('user_id', user.id)
    await TwoFactor.query().where('user_id', user.id).delete()

    if (existing.length > 0) {
      this.logger.success(`Removed the two-factor enrolment for ${identifier}.`)
    } else {
      this.logger.info(`${identifier} had no two-factor enrolment.`)
    }
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
