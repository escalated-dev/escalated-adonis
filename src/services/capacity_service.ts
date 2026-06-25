import AgentCapacity from '../models/agent_capacity.js'
import { hasCapacity } from '../support/agent_capacity_math.js'
import type { UserId } from '../helpers/user_id_column.js'

/**
 * Tracks per-agent, per-channel concurrent-ticket load so routing can avoid
 * overloading agents. Mirrors the Laravel CapacityService: a capacity row is
 * created on demand (default ceiling 10, count 0) and the running count is
 * incremented on assignment / decremented on release.
 */
export default class CapacityService {
  /** Whether the agent can accept another ticket on the given channel. */
  async canAcceptTicket(userId: UserId, channel: string = 'default'): Promise<boolean> {
    const capacity = await this.findOrCreate(userId, channel)

    return hasCapacity(capacity.currentCount, capacity.maxConcurrent)
  }

  /** Increment the agent's running load. */
  async incrementLoad(userId: UserId, channel: string = 'default'): Promise<void> {
    const capacity = await this.findOrCreate(userId, channel)
    capacity.currentCount += 1
    await capacity.save()
  }

  /** Decrement the agent's running load (never below zero). */
  async decrementLoad(userId: UserId, channel: string = 'default'): Promise<void> {
    const capacity = await this.findOrCreate(userId, channel)
    if (capacity.currentCount > 0) {
      capacity.currentCount -= 1
      await capacity.save()
    }
  }

  /** All capacity rows, ordered by agent then channel, for the admin view. */
  async allCapacities(): Promise<AgentCapacity[]> {
    return AgentCapacity.query().orderBy('user_id', 'asc').orderBy('channel', 'asc')
  }

  protected async findOrCreate(userId: UserId, channel: string): Promise<AgentCapacity> {
    return AgentCapacity.firstOrCreate(
      { userId, channel },
      {
        userId,
        channel,
        maxConcurrent: AgentCapacity.DEFAULT_MAX_CONCURRENT,
        currentCount: 0,
      }
    )
  }
}
