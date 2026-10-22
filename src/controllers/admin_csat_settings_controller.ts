import type { HttpContext } from '@adonisjs/core/http'
import EscalatedSetting from '../models/escalated_setting.js'
import { getRenderer } from '../rendering/renderer.js'

const SCALES = ['1-3', '1-5']
const TRIGGERS = ['on_resolve', 'delayed', 'manual']

/**
 * CSAT survey settings. Mirrors escalated-laravel's
 * `Admin\CsatSettingsController`: the same four settings, defaults and
 * validation. As there, they are stored for the survey to read; the rating
 * flow does not consult them yet.
 */
export default class AdminCsatSettingsController {
  async index(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/Settings/CsatSettings', {
      settings: {
        csat_question_text: await EscalatedSetting.get(
          'csat_question_text',
          'How would you rate your support experience?'
        ),
        csat_scale: await EscalatedSetting.get('csat_scale', '1-5'),
        csat_delivery_trigger: await EscalatedSetting.get('csat_delivery_trigger', 'on_resolve'),
        csat_delay_hours: await EscalatedSetting.getInt('csat_delay_hours', 0),
      },
    })
  }

  async update({ request, response, session }: HttpContext) {
    const question = request.input('csat_question_text')
    const scale = request.input('csat_scale')
    const trigger = request.input('csat_delivery_trigger')
    const delay = Number(request.input('csat_delay_hours'))

    const error =
      typeof question !== 'string' || question.trim() === '' || question.length > 500
        ? 'The question is required and may not be longer than 500 characters.'
        : !SCALES.includes(scale)
          ? 'The scale must be 1-3 or 1-5.'
          : !TRIGGERS.includes(trigger)
            ? 'The delivery trigger must be on_resolve, delayed or manual.'
            : !Number.isInteger(delay) || delay < 0 || delay > 168
              ? 'The delay must be a whole number of hours from 0 to 168.'
              : null

    if (error) {
      session.flash('error', error)
      return response.redirect().back()
    }

    await EscalatedSetting.set('csat_question_text', question)
    await EscalatedSetting.set('csat_scale', scale)
    await EscalatedSetting.set('csat_delivery_trigger', trigger)
    await EscalatedSetting.set('csat_delay_hours', String(delay))

    session.flash('success', 'CSAT settings updated.')
    return response.redirect().back()
  }
}
