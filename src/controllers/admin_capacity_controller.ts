import type { HttpContext } from '@adonisjs/core/http'
import AgentCapacity from '../models/agent_capacity.js'
import { getRenderer } from '../rendering/renderer.js'
import { findHostUser } from '../support/user_model.js'

/**
 * Agent capacity: how many concurrent tickets each agent takes per channel.
 * Mirrors escalated-laravel's `Admin\CapacityController`.
 */
export default class AdminCapacityController {
  async index(ctx: HttpContext) {
    const capacities = await AgentCapacity.query().orderBy('user_id', 'asc').orderBy('id', 'asc')

    const names = new Map<string, string>()
    for (const capacity of capacities) {
      const key = String(capacity.userId)
      if (names.has(key)) continue
      const user = await findHostUser(capacity.userId).catch(() => null)
      names.set(key, user?.name ?? user?.fullName ?? user?.email ?? 'Unknown')
    }

    return getRenderer().render(ctx, 'Escalated/Admin/Capacity/Index', {
      capacities: capacities.map((capacity) => {
        const max = Number(capacity.maxConcurrent)
        const current = Number(capacity.currentCount)
        return {
          id: capacity.id,
          user_id: capacity.userId,
          agent_name: names.get(String(capacity.userId)) ?? 'Unknown',
          channel: capacity.channel,
          max_concurrent: max,
          current_count: current,
          // As Laravel's AgentCapacity::loadPercentage().
          load_percentage: max <= 0 ? 100 : Math.round((current / max) * 1000) / 10,
        }
      }),
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const capacity = await AgentCapacity.findOrFail(params.id)
    const value = Number(request.input('max_concurrent'))

    if (!Number.isInteger(value) || value < 1 || value > 999) {
      session.flash('error', 'Max concurrent must be a whole number from 1 to 999.')
      return response.redirect().back()
    }

    capacity.maxConcurrent = value
    await capacity.save()

    session.flash('success', 'Capacity updated.')
    return response.redirect().back()
  }
}
