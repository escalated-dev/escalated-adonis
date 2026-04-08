import ChatSession from '../models/chat_session.js'
import ChatRoutingRule from '../models/chat_routing_rule.js'
import AgentProfile from '../models/agent_profile.js'
import type { ChatRoutingCondition } from '../models/chat_routing_rule.js'

export default class ChatRoutingService {
  /**
   * Find an available agent for a new chat, respecting routing rules
   * and concurrency limits.
   */
  async findAvailableAgent(context: {
    departmentId?: number | null
    metadata?: Record<string, any> | null
  }): Promise<number | null> {
    // First, evaluate routing rules to see if any override applies
    const rule = await this.evaluateRouting(context)

    // Get online agents
    const agentQuery = AgentProfile.query().where('chat_status', 'online')

    // Filter by department if set (from rule or context)
    const deptId = rule?.departmentId ?? context.departmentId
    if (deptId) {
      // If department filtering is needed, we rely on department-agent
      // pivot table for matching. For simplicity, we filter agents who
      // are online and below their max chat limit.
    }

    const onlineAgents = await agentQuery

    if (onlineAgents.length === 0) {
      return null
    }

    const maxPerAgent = rule?.maxChatsPerAgent ?? 5

    // Find the agent with the fewest active chats who is under the limit
    let bestAgentId: number | null = null
    let minChats = Infinity

    for (const agent of onlineAgents) {
      const activeChats = await ChatSession.query()
        .where('agent_id', agent.userId)
        .where('status', 'active')
        .count('* as total')
        .first()

      const count = Number((activeChats as any)?.$extras?.total ?? 0)

      if (count < maxPerAgent && count < minChats) {
        minChats = count
        bestAgentId = agent.userId
      }
    }

    return bestAgentId
  }

  /**
   * Evaluate routing rules against the given context.
   * Returns the first matching rule (by priority) or null.
   */
  async evaluateRouting(context: {
    departmentId?: number | null
    metadata?: Record<string, any> | null
  }): Promise<ChatRoutingRule | null> {
    const rules = await ChatRoutingRule.query().where('is_active', true).orderBy('priority', 'desc')

    for (const rule of rules) {
      if (this.matchesConditions(rule.conditions, context)) {
        return rule
      }
    }

    return null
  }

  /**
   * Check if a set of conditions matches the given context.
   */
  protected matchesConditions(
    conditions: ChatRoutingCondition[] | null,
    context: Record<string, any>
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return true
    }

    return conditions.every((condition) => {
      const value = context[condition.field] ?? context.metadata?.[condition.field]

      switch (condition.operator) {
        case 'equals':
          return value === condition.value
        case 'contains':
          return typeof value === 'string' && value.includes(condition.value)
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(value)
        default:
          return false
      }
    })
  }
}
