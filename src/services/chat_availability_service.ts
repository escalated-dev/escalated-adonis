import AgentProfile from '../models/agent_profile.js'
import ChatSession from '../models/chat_session.js'

export default class ChatAvailabilityService {
  /**
   * Check if live chat is currently available (at least one online agent
   * who is below their concurrency limit).
   */
  async isAvailable(departmentId?: number): Promise<boolean> {
    const agents = await this.onlineAgents(departmentId)
    if (agents.length === 0) return false

    // Check that at least one agent is below their chat limit
    for (const agent of agents) {
      const activeCount = await ChatSession.query()
        .where('agent_id', agent.userId)
        .where('status', 'active')
        .count('* as total')
        .first()

      const count = Number((activeCount as any)?.$extras?.total ?? 0)
      if (count < agent.maxConcurrentChats) {
        return true
      }
    }

    return false
  }

  /**
   * Get all online agents, optionally filtered by department.
   */
  async onlineAgents(_departmentId?: number): Promise<AgentProfile[]> {
    const query = AgentProfile.query().where('chat_status', 'online')

    // Department filtering would require joining escalated_department_agent
    // pivot table. For now, return all online agents.

    return query
  }

  /**
   * Get the count of chats waiting in queue.
   */
  async queueLength(departmentId?: number): Promise<number> {
    const query = ChatSession.query().where('status', 'waiting')

    if (departmentId) {
      query.where('department_id', departmentId)
    }

    const result = await query.count('* as total').first()
    return Number((result as any)?.$extras?.total ?? 0)
  }
}
